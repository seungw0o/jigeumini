import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { fixture, restoreAll, stubFetch, useTestKeys } from "../__fixtures__/fetch-stub";
import { getArrivalsByArs, getArrivalsByStopId, getBusPositions } from "./daejeon.server";

const xml = (body: string) => ({ body, contentType: "application/xml;charset=UTF-8" });

function serviceResult(items: string, headerCd = "0") {
  return `<?xml version="1.0"?><ServiceResult><msgHeader><headerCd>${headerCd}</headerCd><headerMsg>msg</headerMsg></msgHeader><msgBody>${items}</msgBody></ServiceResult>`;
}

beforeEach(useTestKeys);
afterEach(restoreAll);

describe("getArrivalsByStopId (live fixture: 대덕대학교 8001318, 2026-10-22 14:47)", () => {
  test("maps every item to a domain arrival and calls the stop-id endpoint", async () => {
    const calls = stubFetch(() => xml(fixture("daejeon-arrivals-stopid.xml")));
    const arrivals = await getArrivalsByStopId("8001318");

    expect(calls).toHaveLength(1);
    expect(calls[0].url.pathname).toBe("/6300000/arrive/getArrInfoByStopID");
    expect(calls[0].url.searchParams.get("BusStopID")).toBe("8001318");
    expect(calls[0].url.searchParams.get("serviceKey")).toBe("test-data-key");
    expect(arrivals.map((arrival) => arrival.routeNo)).toEqual(["1", "912", "604", "708", "318", "121"]);

    const bus912 = arrivals.find((arrival) => arrival.routeNo === "912");
    expect(bus912).toMatchObject({
      routeCd: "30300145",
      routeType: "trunk",
      stopNodeId: "8001318",
      arsId: "43420",
      stopName: "대덕대학교",
      runType: "normal",
      state: { kind: "approaching", phase: "minutesAway", etaSeconds: 160, stopsAway: 3 },
    });
    expect(arrivals[0]).toMatchObject({ routeType: "village", infoAt: "2026-10-22T14:47:42+09:00" });
  });

  test("MSG_TP 07 reads EXTIME_SEC as the depot departure HHMM, not seconds", async () => {
    stubFetch(() => xml(fixture("daejeon-arrivals-stopid.xml")));
    const arrivals = await getArrivalsByStopId("8001318");

    expect(arrivals.find((arrival) => arrival.routeNo === "318")).toMatchObject({
      routeCd: "30300062",
      runType: null,
      state: { kind: "waitingAtDepot", scheduledDeparture: "14:57" },
    });
    expect(arrivals.find((arrival) => arrival.routeNo === "121")?.state).toEqual({
      kind: "waitingAtDepot",
      scheduledDeparture: "15:11",
    });
  });

  test("MSG_TP 07 with a three-digit morning time and with an unreadable value", async () => {
    stubFetch(() =>
      xml(
        serviceResult(
          "<itemList><ROUTE_NO>318</ROUTE_NO><MSG_TP>07</MSG_TP><EXTIME_SEC>905</EXTIME_SEC></itemList>" +
            "<itemList><ROUTE_NO>604</ROUTE_NO><MSG_TP>07</MSG_TP><EXTIME_SEC>2575</EXTIME_SEC></itemList>",
        ),
      ),
    );
    const arrivals = await getArrivalsByStopId("8001318");
    expect(arrivals.map((arrival) => arrival.state)).toEqual([
      { kind: "waitingAtDepot", scheduledDeparture: "09:05" },
      { kind: "waitingAtDepot", scheduledDeparture: null },
    ]);
  });

  test("unknown MSG_TP is kept as unknown instead of dropped", async () => {
    stubFetch(() => xml(serviceResult("<itemList><ROUTE_NO>1</ROUTE_NO><MSG_TP>09</MSG_TP></itemList>")));
    expect((await getArrivalsByStopId("8001318"))[0].state).toEqual({ kind: "unknown", msgType: "09" });
  });

  test("headerCd 4 (결과 없음, live fixture) is an empty list, not an error", async () => {
    stubFetch(() => xml(fixture("daejeon-arrivals-empty.xml")));
    expect(await getArrivalsByStopId("8999999")).toEqual([]);
  });

  test("other headerCd values are SERVICE_ERROR, a missing header is PARSE", async () => {
    stubFetch(() => xml(serviceResult("", "9")));
    await expect(getArrivalsByStopId("8001318")).rejects.toMatchObject({ code: "SERVICE_ERROR", source: "daejeon" });
    stubFetch(() => xml("<html>maintenance</html>"));
    await expect(getArrivalsByStopId("8001318")).rejects.toMatchObject({ code: "PARSE" });
  });
});

describe("getArrivalsByArs", () => {
  test("calls getArrInfoByUid with arsId", async () => {
    const calls = stubFetch(() => xml(fixture("daejeon-arrivals-ars.xml")));
    const arrivals = await getArrivalsByArs("43420");
    expect(calls[0].url.pathname).toBe("/6300000/arrive/getArrInfoByUid");
    expect(calls[0].url.searchParams.get("arsId")).toBe("43420");
    expect(arrivals).toHaveLength(6);
  });
});

describe("getBusPositions (live fixture: 318 ROUTE_CD 30300062)", () => {
  test("maps positions with numbers, ISO times and the event type", async () => {
    const calls = stubFetch(() => xml(fixture("daejeon-buspos.xml")));
    const positions = await getBusPositions("30300062");
    expect(calls[0].url.searchParams.get("busRouteId")).toBe("30300062");
    expect(positions).toHaveLength(6);
    expect(positions[0]).toEqual({
      routeCd: "30300062",
      plateNo: "대전75자9718",
      nodeId: "8002428",
      arsId: "21810",
      position: { lat: 36.315786, lng: 127.398398 },
      direction: 0,
      event: "periodic",
      passedAt: "2026-10-22T14:48:16+09:00",
      storedAt: "2026-10-22T14:48:18+09:00",
      totalDistanceM: 5363,
    });
  });
});
