import { describe, expect, it } from "vitest";
import { nearestRank } from "../src/db";
import type { Env } from "../src/env";
import worker from "../src/index";
import { kstIso } from "../src/kst";
import { foldNewErrors } from "../src/margin-hist";
import { stopMargins } from "../src/margins";
import { createTestD1 } from "./d1-sqlite";
import { T0 } from "./helpers";

const DAY = 24 * 60 * 60 * 1000;
const PLATE = "대전70자1234";
const ROUTE = "급행9";

async function seed(db: ReturnType<typeof createTestD1>, rows: { node?: string; lead: number; err: number; at?: number }[]) {
  for (const r of rows) {
    await db
      .prepare(
        "INSERT INTO prediction_errors (node_id, route_no, plate_no, lead_bucket_min, predicted_at, error_sec, hour_kst, weekday) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      )
      .bind(r.node ?? "8001318", ROUTE, PLATE, r.lead, kstIso(r.at ?? T0 - DAY), r.err, 9, 4)
      .run();
  }
  await foldNewErrors(db, T0);
}

describe("nearestRank p10", () => {
  it("10 values -> smallest, 11 values -> 2nd smallest", () => {
    const ten = [50, 40, 30, 20, 10, 0, -10, -20, -30, -40];
    expect(nearestRank(ten, 0.1)).toBe(-40);
    expect(nearestRank([...ten, 60], 0.1)).toBe(-30);
  });
});

describe("stopMargins", () => {
  it("applies nearest-rank p10 on known values through D1", async () => {
    const db = createTestD1();
    await seed(db, Array.from({ length: 11 }, (_, i) => ({ lead: 5, err: i * 10 - 30 })));
    const { stops } = await stopMargins(db, T0);
    expect(stops[0].p10Sec).toBe(-20);
  });

  it("histograms are cumulative: windowDays counts from the oldest error", async () => {
    const db = createTestD1();
    await seed(db, [
      { lead: 3, err: -500, at: T0 - 29 * DAY },
      { lead: 3, err: -100, at: T0 - 27 * DAY },
    ]);
    const res = await stopMargins(db, T0);
    expect(res.windowDays).toBe(29);
    expect(res.stops).toEqual([{ nodeId: "8001318", n: 2, p10Sec: -500, byLead: [{ leadMin: 3, n: 2, p10Sec: -500 }] }]);
  });

  it("errors not yet folded by the morning cron are not visible", async () => {
    const db = createTestD1();
    await seed(db, [{ lead: 5, err: -40 }]);
    await db
      .prepare(
        "INSERT INTO prediction_errors (node_id, route_no, plate_no, lead_bucket_min, predicted_at, error_sec, hour_kst, weekday) VALUES ('8001318', 'x', 'y', 5, ?, -900, 9, 4)",
      )
      .bind(kstIso(T0))
      .run();
    const { stops } = await stopMargins(db, T0);
    expect(stops).toEqual([{ nodeId: "8001318", n: 1, p10Sec: -40, byLead: [{ leadMin: 5, n: 1, p10Sec: -40 }] }]);
  });

  it("aggregates per bucket and over all buckets (10 s bins), sorted by lead and node", async () => {
    const db = createTestD1();
    await seed(db, [
      { lead: 10, err: 30 },
      { lead: 10, err: -60 },
      { lead: 3, err: 5 },
      { lead: 5, err: -20 },
      { lead: 5, err: 15 },
      { node: "8000001", lead: 5, err: 7 },
    ]);
    const res = await stopMargins(db, T0);
    expect(res.generatedAt).toBe(new Date(T0).toISOString());
    expect(res.stops).toEqual([
      { nodeId: "8000001", n: 1, p10Sec: 0, byLead: [{ leadMin: 5, n: 1, p10Sec: 0 }] },
      {
        nodeId: "8001318",
        n: 5,
        p10Sec: -60,
        byLead: [
          { leadMin: 3, n: 1, p10Sec: 0 },
          { leadMin: 5, n: 2, p10Sec: -20 },
          { leadMin: 10, n: 2, p10Sec: -60 },
        ],
      },
    ]);
  });

  it("15/20 min buckets are listed in byLead but kept out of the stop-wide n and p10", async () => {
    const db = createTestD1();
    await seed(db, [
      { lead: 5, err: -20 },
      { lead: 15, err: -300 },
      { lead: 20, err: -400 },
      { node: "8000001", lead: 20, err: -100 },
    ]);
    const { stops } = await stopMargins(db, T0);
    expect(stops).toEqual([
      {
        nodeId: "8001318",
        n: 1,
        p10Sec: -20,
        byLead: [
          { leadMin: 5, n: 1, p10Sec: -20 },
          { leadMin: 15, n: 1, p10Sec: -300 },
          { leadMin: 20, n: 1, p10Sec: -400 },
        ],
      },
    ]);
  });

  it("serialized output never contains plate or route values", async () => {
    const db = createTestD1();
    await seed(db, [{ lead: 5, err: -10 }]);
    const body = JSON.stringify(await stopMargins(db, T0));
    expect(body).not.toContain(PLATE);
    expect(body).not.toContain(ROUTE);
    expect(body).not.toMatch(/plate|route/i);
  });
});

describe("GET /margins", () => {
  const ORIGIN = "http://localhost:3000";
  const makeEnv = () => ({ ALLOWED_ORIGINS: ORIGIN, DB: createTestD1(), STOP_MONITOR: {} }) as unknown as Env;
  const ctx = { waitUntil() {}, passThroughOnException() {} } as never;
  const call = (origin: string) =>
    worker.fetch!(new Request("https://w.test/margins", { headers: { Origin: origin } }) as never, makeEnv(), ctx);

  it("200 with cache header and ACAO for an allowed origin", async () => {
    const res = await call(ORIGIN);
    expect(res.status).toBe(200);
    expect(res.headers.get("Cache-Control")).toBe("public, max-age=600");
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe(ORIGIN);
    expect(await res.json()).toMatchObject({ windowDays: 0, stops: [] });
  });

  it("no ACAO for a disallowed origin", async () => {
    const res = await call("https://evil.example");
    expect(res.status).toBe(200);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBeNull();
  });
});
