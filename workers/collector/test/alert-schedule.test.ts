import { describe, expect, it } from "vitest";
import type { PlannedRoute } from "../../../src/apis/live/types";
import { estimateRoute } from "../../../src/shared/estimate";
import { decideAlert, FAR_POLL_MAX_MS, MAX_LIFETIME_MS, MAX_MISSES, NEAR_POLL_MS } from "../src/alert-schedule";
import { alertPayload } from "../src/alert-monitor";
import { departureOf } from "../src/leave-by";
import { arrivalsOf, MIN, T0 } from "./helpers";

const POS = { lat: 36.35, lng: 127.38 };
const plan: PlannedRoute = {
  id: "l0",
  fare: 1500,
  transferCount: 0,
  totalSeconds: 1800,
  legs: [
    { kind: "walk", seconds: 300, distanceM: 300, from: "출발", to: "둔산경찰서", path: [] },
    {
      kind: "bus",
      routeNos: ["318"],
      busType: "branch",
      seconds: 1200,
      distanceM: 6000,
      stopCount: 8,
      board: { name: "둔산경찰서", position: POS, nodeId: "8001318", arsId: "12345" },
      alight: { name: "대전역", position: POS, nodeId: "8001999", arsId: "54321" },
      path: [],
    },
    { kind: "walk", seconds: 120, distanceM: 100, from: "대전역", to: "도착", path: [] },
  ],
};
const clock = { fetchedAtMs: T0, nowMs: T0 };

describe("departureOf", () => {
  it("matches the screen leave-by: bus in 15 min - walk 5 - default margin 2 = 09:08", () => {
    const arrivals = arrivalsOf({ route: "318", plate: "P1", msg: "03", sec: 15 * 60, pos: 5 });
    const departure = departureOf(plan, arrivals, clock, undefined);
    const screen = estimateRoute(plan, { "8001318": { ok: true, arrivals } }, clock);
    expect(departure).toEqual({
      leaveByMs: T0 + 8 * MIN,
      leaveAt: "09:08",
      routeNo: "318",
      boardStopName: "둔산경찰서",
      busInMinutes: 15,
      boardAt: "09:15",
    });
    expect(departure?.leaveAt).toBe(screen.leaveAt);
  });

  it("follows a late bus: the next check moves leave-by later", () => {
    const late = arrivalsOf({ route: "318", plate: "P1", msg: "03", sec: 20 * 60, pos: 6 });
    expect(departureOf(plan, late, clock, undefined)?.leaveByMs).toBe(T0 + 13 * MIN);
  });

  it("returns null when no catchable bus of the route is listed", () => {
    const tooSoon = arrivalsOf({ route: "318", plate: "P1", msg: "03", sec: 3 * 60, pos: 1 });
    const otherRoute = arrivalsOf({ route: "102", plate: "P2", msg: "03", sec: 15 * 60, pos: 5 });
    expect(departureOf(plan, tooSoon, clock, undefined)).toBeNull();
    expect(departureOf(plan, otherRoute, clock, undefined)).toBeNull();
  });

  it("builds the sw.js payload with the route detail url", () => {
    const arrivals = arrivalsOf({ route: "318", plate: "P1", msg: "03", sec: 13 * 60, pos: 4 });
    const departure = departureOf(plan, arrivals, clock, undefined);
    expect(departure).not.toBeNull();
    expect(alertPayload("a1", "l0", "from=1,2&to=3,4", departure!)).toEqual({
      title: "지금 나가세요",
      body: "지금 나가면 318번 탈 수 있어요 · 둔산경찰서 13분 뒤",
      tag: "alert-a1",
      url: "/routes/l0?from=1,2&to=3,4",
    });
  });
});

describe("decideAlert", () => {
  const base = { nowMs: T0, createdAtMs: T0, misses: 0 };

  it("sends once now reaches leave-by minus 2 min", () => {
    expect(decideAlert({ ...base, leaveByMs: T0 + 2 * MIN })).toEqual({ kind: "send" });
    expect(decideAlert({ ...base, leaveByMs: T0 + MIN })).toEqual({ kind: "send" });
  });

  it("polls every minute within 15 min, never past the notify time", () => {
    expect(decideAlert({ ...base, leaveByMs: T0 + 12 * MIN })).toEqual({ kind: "wait", atMs: T0 + NEAR_POLL_MS });
    expect(decideAlert({ ...base, leaveByMs: T0 + 2 * MIN + 20_000 })).toEqual({ kind: "wait", atMs: T0 + 20_000 });
  });

  it("polls sparsely when far away, waking before the 15 min window", () => {
    expect(decideAlert({ ...base, leaveByMs: T0 + 60 * MIN })).toEqual({ kind: "wait", atMs: T0 + FAR_POLL_MAX_MS });
    expect(decideAlert({ ...base, leaveByMs: T0 + 19 * MIN })).toEqual({ kind: "wait", atMs: T0 + 2 * MIN });
  });

  it("retries a missing bus, then gives up after MAX_MISSES", () => {
    expect(decideAlert({ ...base, leaveByMs: null, misses: MAX_MISSES - 1 })).toEqual({ kind: "wait", atMs: T0 + NEAR_POLL_MS });
    expect(decideAlert({ ...base, leaveByMs: null, misses: MAX_MISSES })).toEqual({ kind: "fail", reason: "no_bus" });
  });

  it("fails after the lifetime cap even if a bus is listed", () => {
    expect(decideAlert({ ...base, createdAtMs: T0 - MAX_LIFETIME_MS - 1, leaveByMs: T0 + 30 * MIN })).toEqual({
      kind: "fail",
      reason: "expired",
    });
  });
});
