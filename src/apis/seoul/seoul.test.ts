import { afterEach, describe, expect, test } from "vitest";
import { fixture, restoreAll, stubFetch } from "../__fixtures__/fetch-stub";
import { fetchSeoulArrivals, fetchSeoulStations, seoulArrivalState } from "./parse";

const KEY = "test-data-key";
const json = (body: string, status = 200) => ({ body, status });

afterEach(restoreAll);

describe("fetchSeoulArrivals (live fixture: 서울역버스환승센터 02004, 2026-10-26 09:47)", () => {
  test("calls getStationByUid over http with resultType=json and the ARS id", async () => {
    const calls = stubFetch(() => json(fixture("seoul-arrivals-02004.json")));
    await fetchSeoulArrivals(KEY, "02004");

    expect(calls).toHaveLength(1);
    expect(calls[0].url.protocol).toBe("http:");
    expect(calls[0].url.host).toBe("ws.bus.go.kr");
    expect(calls[0].url.pathname).toBe("/api/rest/stationinfo/getStationByUid");
    expect(calls[0].url.searchParams.get("arsId")).toBe("02004");
    expect(calls[0].url.searchParams.get("resultType")).toBe("json");
    expect(calls[0].url.searchParams.get("serviceKey")).toBe(KEY);
  });

  test("splits one route row into the first and second bus", async () => {
    stubFetch(() => json(fixture("seoul-arrivals-02004.json")));
    const arrivals = await fetchSeoulArrivals(KEY, "02004");
    const route100 = arrivals.filter((a) => a.routeNo === "100");

    expect(route100).toHaveLength(2);
    expect(route100[0]).toMatchObject({
      routeCd: "100100549",
      routeType: "trunk",
      stopNodeId: "seoul:02004",
      arsId: "02004",
      stopName: "서울역버스환승센터",
      destination: "용산구청",
      plateNo: null,
      infoAt: null,
      state: { kind: "approaching", phase: "minutesAway", etaSeconds: 409, stopsAway: 3 },
    });
    expect(route100[1].state).toEqual({ kind: "approaching", phase: "minutesAway", etaSeconds: 1155, stopsAway: 8 });
  });

  test("maps each arrmsg kind: 곧 도착, [0번째 전], 출발대기, 운행종료", async () => {
    stubFetch(() => json(fixture("seoul-arrivals-02004.json")));
    const arrivals = await fetchSeoulArrivals(KEY, "02004");
    const states = (routeNo: string) => arrivals.filter((a) => a.routeNo === routeNo).map((a) => a.state);

    expect(states("150")[0]).toEqual({ kind: "approaching", phase: "entering", etaSeconds: 71, stopsAway: 0 });
    expect(states("742")[0]).toEqual({ kind: "approaching", phase: "minutesAway", etaSeconds: 240, stopsAway: 0 });
    expect(states("750A")).toEqual([
      { kind: "approaching", phase: "minutesAway", etaSeconds: 301, stopsAway: 1 },
      { kind: "waitingAtDepot", scheduledDeparture: null },
    ]);
    expect(states("새벽A504")).toEqual([{ kind: "unknown", msgType: "운행종료" }]);
  });

  test("routeType: 3 간선 -> trunk, 15 심야 -> trunk, 8 경기 -> unknown", async () => {
    stubFetch(() => json(fixture("seoul-arrivals-02004.json")));
    const arrivals = await fetchSeoulArrivals(KEY, "02004");
    const typeOf = (routeNo: string) => arrivals.find((a) => a.routeNo === routeNo)?.routeType;

    expect(typeOf("421")).toBe("trunk");
    expect(typeOf("N15")).toBe("trunk");
    expect(typeOf("5101화성")).toBe("unknown");
  });

  test("headerCd 4 with itemList null -> empty list", async () => {
    stubFetch(() => json(fixture("seoul-arrivals-empty.json")));
    await expect(fetchSeoulArrivals(KEY, "99999")).resolves.toEqual([]);
  });

  test("unregistered key (HTTP 401 JSON) -> SERVICE_KEY_INVALID", async () => {
    stubFetch(() => json(fixture("seoul-badkey.json"), 401));
    await expect(fetchSeoulArrivals(KEY, "02004")).rejects.toMatchObject({ code: "SERVICE_KEY_INVALID", source: "seoul", status: 401 });
  });

  test("other headerCd -> SERVICE_ERROR, non-JSON -> PARSE", async () => {
    stubFetch(() => json(JSON.stringify({ msgHeader: { headerCd: "1", headerMsg: "시스템 오류" }, msgBody: { itemList: null } })));
    await expect(fetchSeoulArrivals(KEY, "02004")).rejects.toMatchObject({ code: "SERVICE_ERROR", source: "seoul" });

    stubFetch(() => json("<html>oops</html>"));
    await expect(fetchSeoulArrivals(KEY, "02004")).rejects.toMatchObject({ code: "PARSE", source: "seoul" });
  });
});

describe("seoulArrivalState", () => {
  test("isArrive 1 -> arrived", () => {
    expect(seoulArrivalState("곧 도착", 0, "1")).toEqual({ kind: "approaching", phase: "arrived", etaSeconds: 0, stopsAway: 0 });
  });

  test("unknown text without a time -> unknown", () => {
    expect(seoulArrivalState("회차지 대기", 0, "0")).toEqual({ kind: "unknown", msgType: "회차지 대기" });
  });
});

describe("fetchSeoulStations (live fixture: 서울역버스환승센터 반경 200m)", () => {
  test("passes WGS84 lon/lat as tmX/tmY and drops virtual stops without an ARS id", async () => {
    const calls = stubFetch(() => json(fixture("seoul-stations-seoulstation.json")));
    const stations = await fetchSeoulStations(KEY, { lat: 37.55547292, lng: 126.97256712 }, 200);

    expect(calls[0].url.pathname).toBe("/api/rest/stationinfo/getStationByPos");
    expect(calls[0].url.searchParams.get("tmX")).toBe("126.97256712");
    expect(calls[0].url.searchParams.get("tmY")).toBe("37.55547292");
    expect(calls[0].url.searchParams.get("radius")).toBe("200");
    expect(stations.map((s) => s.arsId)).toEqual(["02004", "02005", "02006", "02007", "02003", "02282", "78470", "02218"]);
    expect(stations[0]).toEqual({
      arsId: "02004",
      stationId: "101000004",
      name: "서울역버스환승센터",
      position: { lat: 37.5554029828, lng: 126.9725924801 },
    });
  });
});
