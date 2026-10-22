import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { fixture, restoreAll, stubFetch, useTestKeys } from "../__fixtures__/fetch-stub";
import { toDaejeonNodeId, toDaejeonRouteCd } from "./ids";
import { findNearbyStops, getRoutesThroughStop, searchStopsByName } from "./tago.server";

beforeEach(useTestKeys);
afterEach(restoreAll);

describe("findNearbyStops (live fixture: 대덕대학교 근처 500m)", () => {
  test("maps all stops with coords, nodeId and optional arsId", async () => {
    const calls = stubFetch(() => ({ body: fixture("tago-nearby.json") }));
    const stops = await findNearbyStops({ lat: 36.39007, lng: 127.362274 });

    expect(calls[0].url.pathname).toContain("getCrdntPrxmtSttnList");
    expect(calls[0].url.searchParams.get("gpsLati")).toBe("36.39007");
    expect(stops.length).toBeGreaterThan(0);

    const daedeok = stops.find((stop) => stop.nodeId === "DJB8001318");
    expect(daedeok).toMatchObject({
      name: "대덕대학교",
      arsId: "43420",
      position: { lat: 36.39007, lng: 127.362274 },
      cityCode: 25,
    });

    const noArs = stops.find((stop) => stop.nodeId === "DJB9001029");
    expect(noArs).toMatchObject({ name: "대덕대학", arsId: null });
  });
});

describe("searchStopsByName", () => {
  test("array result (live fixture: 대덕대학교 → 2 stops)", async () => {
    stubFetch(() => ({ body: fixture("tago-byname.json") }));
    const stops = await searchStopsByName("대덕대학교");
    expect(stops).toHaveLength(2);
    expect(stops.map((stop) => stop.arsId)).toEqual(["43420", "43430"]);
  });

  test("single-item result (live fixture: numOfRows=1 → item is object, not array)", async () => {
    stubFetch(() => ({ body: fixture("tago-byname-single.json") }));
    const stops = await searchStopsByName("대덕대학교");
    expect(stops).toHaveLength(1);
    expect(stops[0].nodeId).toBe("DJB8001318");
  });

  test("empty result (live fixture: items is \"\")", async () => {
    stubFetch(() => ({ body: fixture("tago-byname-empty.json") }));
    expect(await searchStopsByName("없는정류장이름xyz")).toEqual([]);
  });

  test("SERVICE_ERROR from resultCode 99 (session limit)", async () => {
    stubFetch(() => ({ body: fixture("tago-session-limit.json") }));
    await expect(searchStopsByName("대전동신과학고")).rejects.toMatchObject({
      code: "SERVICE_ERROR",
      source: "tago",
    });
  });
});

describe("getRoutesThroughStop (live fixture: DJB8001318)", () => {
  test("maps routes with routeType from Korean label", async () => {
    stubFetch(() => ({ body: fixture("tago-routes.json") }));
    const routes = await getRoutesThroughStop("DJB8001318");
    expect(routes.length).toBeGreaterThan(0);

    const bus318 = routes.find((route) => route.routeNo === "318");
    expect(bus318).toMatchObject({
      routeId: "DJB30300062",
      routeType: "trunk",
      routeTypeLabel: "간선버스",
      startStopName: "오월드",
      endStopName: "대덕대학",
    });

    const bus1 = routes.find((route) => route.routeNo === "1");
    expect(bus1).toMatchObject({ routeType: "village", routeTypeLabel: "마을버스" });
  });
});

describe("ID conversions", () => {
  test("toDaejeonNodeId strips DJB, rejects non-Daejeon", () => {
    expect(toDaejeonNodeId("DJB8001318")).toBe("8001318");
    expect(toDaejeonNodeId("DJB30300062")).toBe("30300062");
    expect(toDaejeonNodeId("ICB1234567")).toBeNull();
    expect(toDaejeonNodeId("")).toBeNull();
    expect(toDaejeonNodeId("DJB")).toBeNull();
    expect(toDaejeonNodeId("DJBabc")).toBeNull();
  });

  test("toDaejeonRouteCd strips DJB prefix from route ids", () => {
    expect(toDaejeonRouteCd("DJB30300062")).toBe("30300062");
    expect(toDaejeonRouteCd("NOT_DAEJEON")).toBeNull();
  });
});
