import { describe, expect, test } from "vitest";
import type { DaejeonArrival } from "@/apis/daejeon/types";
import type { PlannedBusLeg, PlannedLeg, PlannedRoute, PlannedWalkLeg, StopArrivals } from "@/apis/live/types";
import type { MarginsResponse } from "@/apis/margins/types";
import { estimateRoute, estimateRoutes, kstClock } from "./estimate";
import { buildRibbon } from "@/utils/ribbon";
import type { BusLeg, TransitRoute } from "@/utils/types";

const NOW = Date.parse("2026-10-22T09:48:00+09:00");
const CLOCK = { fetchedAtMs: NOW, nowMs: NOW };
const POS = { lat: 36.35, lng: 127.38 };

const walk = (seconds: number): PlannedWalkLeg => ({
  kind: "walk",
  seconds,
  distanceM: seconds,
  from: "출발",
  to: "도착",
  path: [POS],
});

const bus = (routeNos: string[], seconds: number, boardNodeId: string | null): PlannedBusLeg => ({
  kind: "bus",
  routeNos,
  busType: "branch",
  seconds,
  distanceM: seconds * 5,
  stopCount: 5,
  board: { name: `정류장 ${boardNodeId}`, position: POS, nodeId: boardNodeId, arsId: "12345" },
  alight: { name: "하차", position: POS, nodeId: null, arsId: null },
  path: [POS],
});

const plan = (legs: PlannedLeg[], id = "l0"): PlannedRoute => ({
  id,
  fare: 1500,
  transferCount: legs.filter((l) => l.kind === "bus").length - 1,
  totalSeconds: legs.reduce((sum, l) => sum + l.seconds, 0),
  legs,
});

const arrival = (routeNo: string, state: DaejeonArrival["state"]): DaejeonArrival => ({
  routeCd: `30000${routeNo}`,
  routeNo,
  routeType: "trunk",
  destination: "종점",
  stopNodeId: "S1",
  arsId: "12345",
  stopName: "정류장",
  plateNo: null,
  lastStopNodeId: null,
  runType: "normal",
  state,
  infoAt: null,
});
const eta = (routeNo: string, etaSeconds: number) =>
  arrival(routeNo, { kind: "approaching", phase: "minutesAway", etaSeconds, stopsAway: 3 });
const depot = (routeNo: string, scheduledDeparture: string) =>
  arrival(routeNo, { kind: "waitingAtDepot", scheduledDeparture });
const ok = (...arrivals: DaejeonArrival[]): StopArrivals => ({ ok: true, arrivals });

const direct318 = plan([walk(420), bus(["318"], 1200, "S1"), walk(180)]);
const busLegs = (route: TransitRoute) => route.legs.filter((l): l is BusLeg => l.kind === "bus");

describe("estimateRoute", () => {
  test("a) skips a bus that comes too soon and catches the next one", () => {
    const route = estimateRoute(direct318, { S1: ok(eta("318", 300), eta("318", 1140)) }, CLOCK);
    const [leg] = busLegs(route);
    expect(leg.catchIndex).toBe(1);
    expect(leg.boardAt).toBe("10:07");
    expect(route).toMatchObject({
      leaveInMinutes: 10,
      leaveAt: "09:58",
      totalMinutes: 42,
      arriveAt: "10:30",
      travelMinutes: 30,
      marginMinutes: 2,
      realtime: "live",
    });
  });

  test("b) a bus arriving exactly at walk + margin is catchable", () => {
    const route = estimateRoute(direct318, { S1: ok(eta("318", 540)) }, CLOCK);
    expect(route.leaveInMinutes).toBe(0);
    expect(route.leaveAt).toBe("09:48");
    expect(route.realtime).toBe("live");
  });

  test("c) picks the earliest catchable bus among the leg's vehicles", () => {
    const leg = plan([walk(420), bus(["301", "604", "318"], 1200, "S1"), walk(180)]);
    const stops = { S1: ok(eta("318", 1140), eta("1", 600), eta("301", 300), eta("604", 900)) };
    const [busLeg] = busLegs(estimateRoute(leg, stops, CLOCK));
    expect(busLeg.routeNo).toBe("604");
    expect(busLeg.arrivals.map((a) => a.routeNo)).toEqual(["301", "604", "318"]);
    expect(busLeg.catchIndex).toBe(1);
    expect(busLeg.busType).toBe("trunk");
  });

  test("d) uses a depot bus's scheduled departure as its time", () => {
    const route = estimateRoute(direct318, { S1: ok(depot("318", "10:05")) }, CLOCK);
    const [leg] = busLegs(route);
    expect(leg.boardAt).toBe("10:05");
    expect(leg.arrivals[0].status).toEqual({ kind: "garage", departAt: "10:05" });
    expect(route.leaveAt).toBe("09:56");
  });

  test("e) failed stop fetch makes the route unavailable with no waits", () => {
    const failed: StopArrivals = { ok: false, error: { code: "FORCED", message: "fail" } };
    const route = estimateRoute(direct318, { S1: failed }, CLOCK);
    expect(route.realtime).toBe("unavailable");
    expect(busLegs(route)[0].liveIssue).toBe("unavailable");
    expect(route.totalMinutes).toBe(route.travelMinutes);
    expect(route).toMatchObject({ leaveInMinutes: 0, leaveAt: "09:48", marginMinutes: 0 });
  });

  test("f) unmatched boarding stop is unavailable", () => {
    const route = estimateRoute(plan([walk(420), bus(["318"], 1200, null)]), {}, CLOCK);
    expect(route.realtime).toBe("unavailable");
    expect(busLegs(route)[0].boardStop.id).toBe("l0-1-board");
  });

  test("g) list without this route is noBus", () => {
    const route = estimateRoute(direct318, { S1: ok(eta("1", 900)) }, CLOCK);
    expect(route.realtime).toBe("noBus");
    expect(busLegs(route)[0].liveIssue).toBe("noBus");
  });

  test("h) transfer bus waits for the first arrival after reaching the stop", () => {
    const transfer = plan([walk(420), bus(["318"], 1200, "S1"), bus(["604"], 600, "S2"), walk(180)]);
    const s1 = ok(eta("318", 1140));
    const route = estimateRoute(transfer, { S1: s1, S2: ok(eta("604", 2280), eta("604", 2700)) }, CLOCK);
    const [, second] = busLegs(route);
    expect(second.boardAt).toBe("10:33");
    expect(second.waitMinutes).toBe(6);
    expect(route).toMatchObject({ realtime: "live", waitMinutes: 6, arriveAt: "10:46", totalMinutes: 58 });

    const missing = estimateRoute(transfer, { S1: s1, S2: ok() }, CLOCK);
    const [, noBus] = busLegs(missing);
    expect(missing.realtime).toBe("partial");
    expect(noBus).toMatchObject({ liveIssue: "noBus", waitMinutes: 0, boardAt: "10:27" });
  });

  test("i) stale data anchors ETAs at fetchedAt", () => {
    const route = estimateRoute(direct318, { S1: ok(eta("318", 1140)) }, { fetchedAtMs: NOW - 30_000, nowMs: NOW });
    expect(route).toMatchObject({ leaveAt: "09:57", leaveInMinutes: 9, arriveAt: "10:30", totalMinutes: 42 });
    expect(busLegs(route)[0].arrivals[0].status).toEqual({ kind: "live", minutes: 18, stopsAway: 3 });
  });

  test("j) missing arrivals is loading", () => {
    const route = estimateRoute(direct318, undefined, CLOCK);
    expect(route.realtime).toBe("loading");
    expect(route.totalMinutes).toBe(30);
  });

  test("n) total minutes follow the shown clocks, not seconds within the minute", () => {
    const stops = { S1: ok(eta("318", 1150)) };
    const early = estimateRoute(direct318, stops, CLOCK);
    const late = estimateRoute(direct318, stops, { fetchedAtMs: NOW, nowMs: NOW + 50_000 });
    expect(early).toMatchObject({ arriveAt: "10:31", totalMinutes: 43 });
    expect(late).toMatchObject({ arriveAt: "10:31", totalMinutes: 43 });
  });

  test("m) ribbon total matches the route total", () => {
    const route = estimateRoute(direct318, { S1: ok(eta("318", 300), eta("318", 1140)) }, CLOCK);
    expect(Math.abs(buildRibbon(route, kstClock(NOW)).totalMinutes - route.totalMinutes)).toBeLessThanOrEqual(1);
  });
});

describe("estimateRoutes", () => {
  test("k) orders live routes by arrival, then the rest", () => {
    const plans = [
      plan([walk(420), bus(["318"], 1200, "X")], "unavailable"),
      plan([walk(420), bus(["318"], 1200, "S1"), walk(180)], "slow"),
      plan([walk(420), bus(["604"], 1200, "S2"), walk(180)], "fast"),
    ];
    const stops = { S1: ok(eta("318", 1140)), S2: ok(eta("604", 600)) };
    expect(estimateRoutes(plans, stops, CLOCK).map((r) => r.id)).toEqual(["fast", "slow", "unavailable"]);
  });
});

describe("data-based margin", () => {
  // 도보 420초(7분) -> 리드 5분 버킷, P10 -250초 -> 여유 5분
  const zeros = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
  const marginsOf = (n: number): MarginsResponse => ({
    windowDays: 14,
    generatedAt: "2026-10-22T00:00:00+09:00",
    stops: [{ nodeId: "S1", n, p10Sec: -250, earlyRate: zeros, byLead: [{ leadMin: 5, n, p10Sec: -250, earlyRate: zeros }] }],
  });
  const stops = { S1: ok(eta("318", 1140)) };

  test("a) uses the stop's P10 margin and leaves 3 minutes earlier", () => {
    const base = estimateRoute(direct318, stops, CLOCK);
    const route = estimateRoute(direct318, stops, CLOCK, marginsOf(200));
    expect(base).toMatchObject({ leaveAt: "09:58", marginMinutes: 2 });
    expect(route).toMatchObject({ leaveAt: "09:55", leaveInMinutes: 7, marginMinutes: 5 });
  });

  test("a) skips a bus catchable with 2 minutes but not with 5", () => {
    const both = { S1: ok(eta("318", 540), eta("318", 1140)) };
    const base = busLegs(estimateRoute(direct318, both, CLOCK))[0];
    const route = estimateRoute(direct318, both, CLOCK, marginsOf(200));
    const [leg] = busLegs(route);
    expect(base).toMatchObject({ catchIndex: 0, boardAt: "09:57" });
    expect(leg).toMatchObject({ catchIndex: 1, boardAt: "10:07" });
    expect(route.marginMinutes).toBe(5);
  });

  test("b) a stop with n < 100 keeps the 2-minute margin", () => {
    const route = estimateRoute(direct318, stops, CLOCK, marginsOf(99));
    expect(route).toEqual(estimateRoute(direct318, stops, CLOCK));
    expect(route.marginMinutes).toBe(2);
  });

  test("c) undefined margins match the 3-argument call", () => {
    expect(estimateRoute(direct318, stops, CLOCK, undefined)).toEqual(estimateRoute(direct318, stops, CLOCK));
  });

  test("d) estimateRoutes passes margins through", () => {
    const routes = estimateRoutes([direct318], stops, CLOCK, marginsOf(200));
    expect(routes[0]).toMatchObject({ leaveAt: "09:55", marginMinutes: 5 });
  });
});

describe("kstClock", () => {
  test("l) formats KST and wraps past midnight", () => {
    expect(kstClock(NOW)).toBe("09:48");
    expect(kstClock(Date.parse("2026-10-22T23:59:30+09:00") + 60_000)).toBe("00:00");
  });
});

describe("estimateRoute with Seoul stops", () => {
  const seoul = (routeNo: string, etaSeconds: number) => ({ ...eta(routeNo, etaSeconds), stopNodeId: "seoul:02004", arsId: "02004" });

  test("Kakao 'N75(심야)' matches the Seoul arrival row 'N75'", () => {
    const route = estimateRoute(plan([walk(120), bus(["N75(심야)"], 1200, "seoul:02004")]), { "seoul:02004": ok(seoul("N75", 900)) }, CLOCK);
    expect(route.realtime).toBe("live");
    expect(busLegs(route)[0].routeNo).toBe("N75");
  });

  test("a route the Seoul stop does not list at all (e.g. a Gyeonggi bus) is unavailable, not noBus", () => {
    const route = estimateRoute(plan([walk(120), bus(["9300"], 1200, "seoul:02004")]), { "seoul:02004": ok(seoul("421", 900)) }, CLOCK);
    expect(route.realtime).toBe("unavailable");
    expect(busLegs(route)[0].liveIssue).toBe("unavailable");
  });

  test("Daejeon keeps noBus for a route missing from the list", () => {
    const route = estimateRoute(plan([walk(120), bus(["604"], 1200, "S1")]), { S1: ok(eta("318", 900)) }, CLOCK);
    expect(route.realtime).toBe("noBus");
  });
});
