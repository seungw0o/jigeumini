import { afterEach, describe, expect, test } from "vitest";
import { fixture, restoreAll, stubFetch } from "../../../src/apis/__fixtures__/fetch-stub";
import { POLL_INTERVAL_MS, runTick, type ArrivalRow, type CollectorErrorRow, type ObservationRow, type Sink, type TickInput } from "../src/collector";
import { fetchStopArrivals } from "../src/daejeon";
import { MIN, serviceResult, T0 } from "./helpers";

class MemorySink implements Sink {
  observations: ObservationRow[] = [];
  arrivals: ArrivalRow[] = [];
  errors: CollectorErrorRow[] = [];
  async save(rows: { observations: ObservationRow[]; arrivals: ArrivalRow[] }) {
    this.observations.push(...rows.observations);
    this.arrivals.push(...rows.arrivals);
  }
  async logError(row: CollectorErrorRow) {
    this.errors.push(row);
  }
}

const KEY = "worker-test-key";
const input = (sink: Sink, overrides: Partial<TickInput> = {}): TickInput => ({
  nodeId: "8001318",
  now: T0,
  tick: 0,
  observationEvery: 5,
  tracks: {},
  sink,
  fetchArrivals: (nodeId) => fetchStopArrivals(KEY, nodeId),
  ...overrides,
});

afterEach(restoreAll);

describe("runTick loop control", () => {
  test("QUOTA_EXCEEDED logs to collector_errors and stops the loop until the next Cron", async () => {
    const body = `<OpenAPI_ServiceResponse><cmmMsgHeader><errMsg>SERVICE ERROR</errMsg>
      <returnAuthMsg>LIMITED_NUMBER_OF_SERVICE_REQUESTS_EXCEEDS_ERROR</returnAuthMsg>
      <returnReasonCode>22</returnReasonCode></cmmMsgHeader></OpenAPI_ServiceResponse>`;
    stubFetch(() => ({ body, status: 200, contentType: "text/xml" }));
    const sink = new MemorySink();
    const result = await runTick(input(sink));
    expect(result).toMatchObject({ nextAlarmAt: null, stopReason: "QUOTA_EXCEEDED" });
    expect(sink.errors).toEqual([expect.objectContaining({ nodeId: "8001318", code: "QUOTA_EXCEEDED", at: "2026-10-23T09:00:00+09:00" })]);
    expect(sink.errors[0].message).not.toContain(KEY);
  });

  test("SERVICE_KEY_INVALID (live 403 fixture) also stops the loop", async () => {
    stubFetch(() => ({ body: fixture("daejeon-badkey.xml"), status: 403, contentType: "application/xml" }));
    const result = await runTick(input(new MemorySink()));
    expect(result).toMatchObject({ nextAlarmAt: null, stopReason: "SERVICE_KEY_INVALID" });
  });

  test("other errors are logged and the loop keeps going in 60 s", async () => {
    stubFetch(() => ({ body: "<html>bad gateway</html>", status: 502, contentType: "text/html" }));
    const sink = new MemorySink();
    const result = await runTick(input(sink));
    expect(result).toMatchObject({ nextAlarmAt: T0 + POLL_INTERVAL_MS, stopReason: null });
    expect(sink.errors.map((error) => error.code)).toEqual(["HTTP"]);
  });

  test("outside 05:30-23:30 KST it stops without calling the API", async () => {
    const calls = stubFetch(() => ({ body: serviceResult(), contentType: "text/xml" }));
    const result = await runTick(input(new MemorySink(), { now: Date.UTC(2026, 9, 23, 19, 0) }));
    expect(result).toMatchObject({ nextAlarmAt: null, stopReason: "OUTSIDE_WINDOW" });
    expect(calls).toHaveLength(0);
  });
});

describe("runTick rows", () => {
  test("live fixture: observations on every Nth tick only, depot rows keep MSG_TP 07 with no ETA", async () => {
    const calls = stubFetch(() => ({ body: fixture("daejeon-arrivals-stopid.xml"), contentType: "text/xml" }));
    const sink = new MemorySink();
    await runTick(input(sink, { tick: 0 }));
    await runTick(input(sink, { tick: 1, now: T0 + MIN }));
    expect(calls[0].url.searchParams.get("BusStopID")).toBe("8001318");
    expect(sink.observations).toHaveLength(6);
    expect(sink.observations.find((row) => row.routeNo === "318")).toMatchObject({ msgTp: "07", etaSeconds: null, stopsAway: null });
    expect(sink.observations.find((row) => row.routeNo === "912")).toMatchObject({
      msgTp: "03",
      etaSeconds: 160,
      stopsAway: 3,
      observedAt: "2026-10-23T09:00:00+09:00",
      infoAt: "2026-10-22T14:48:06+09:00",
    });
  });

  test("arrival detected across ticks writes one arrival row with its 3-min bucket error", async () => {
    const sink = new MemorySink();
    stubFetch(() => ({ body: serviceResult({ route: "318", plate: "A", msg: "03", sec: 170 }), contentType: "text/xml" }));
    const first = await runTick(input(sink, { now: T0 - 3 * MIN }));
    stubFetch(() => ({ body: serviceResult({ route: "318", plate: "A", msg: "01" }), contentType: "text/xml" }));
    await runTick(input(sink, { now: T0, tick: 1, tracks: first.tracks }));
    expect(sink.arrivals).toEqual([
      {
        nodeId: "8001318",
        routeNo: "318",
        plateNo: "A",
        arrivedAt: "2026-10-23T09:00:00+09:00",
        inferred: false,
        errors: [{ leadBucketMin: 3, predictedAt: "2026-10-23T08:57:00+09:00", errorSec: 10, hourKst: 8, weekday: 5 }],
      },
    ]);
  });
});
