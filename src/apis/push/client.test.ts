import { describe, expect, test } from "vitest";
import type { PlannedRoute } from "@/apis/live/types";
import { alertRequestBody, alertsByRoute, base64UrlToBytes, type Alert } from "./client";

const stop = { name: "정류장", position: { lat: 36.35, lng: 127.38 }, nodeId: "8001318", arsId: "12345" };
const plan: PlannedRoute = {
  id: "l0",
  fare: 1500,
  transferCount: 0,
  totalSeconds: 1200,
  legs: [
    { kind: "walk", seconds: 120, distanceM: 150, from: "출발", to: "정류장", path: [{ lat: 36.39, lng: 127.36 }] },
    {
      kind: "bus",
      routeNos: ["102"],
      busType: "trunk",
      seconds: 900,
      distanceM: 4000,
      stopCount: 8,
      board: stop,
      alight: stop,
      path: [{ lat: 36.39, lng: 127.36 }, { lat: 36.35, lng: 127.38 }],
    },
  ],
};

function alert(overrides: Partial<Alert>): Alert {
  return {
    id: "a1",
    routeId: "l0",
    pairQuery: "from=1,2&to=3,4",
    routeNo: "102",
    boardNodeId: "8001318",
    status: "pending",
    leaveByAt: null,
    createdAt: "2026-10-25T00:00:00.000Z",
    ...overrides,
  };
}

describe("push client helpers", () => {
  test("decodes unpadded base64url into bytes", () => {
    expect([...base64UrlToBytes("-_8")]).toEqual([0xfb, 0xff]);
    expect([...base64UrlToBytes("AQID")]).toEqual([1, 2, 3]);
    // VAPID 공개키(비압축 P-256 점)는 65바이트, 0x04로 시작한다
    const key = Buffer.from([4, ...new Array(64).fill(7)]).toString("base64url");
    const bytes = base64UrlToBytes(key);
    expect(bytes.length).toBe(65);
    expect(bytes[0]).toBe(4);
  });

  test("builds the alert body without leg paths or a leading ?", () => {
    const body = alertRequestBody("l0", "?from=1,2&to=3,4", plan);
    expect(body.routeId).toBe("l0");
    expect(body.pairQuery).toBe("from=1,2&to=3,4");
    expect(body.plan.legs.map((leg) => leg.path)).toEqual([[], []]);
    expect(body.plan.legs[1]).toMatchObject({ kind: "bus", routeNos: ["102"], board: stop });
    expect(plan.legs[0].path).toHaveLength(1);
  });

  test("maps only pending alerts of the current pair to routes", () => {
    const byRoute = alertsByRoute(
      [
        alert({ id: "a1", routeId: "l0" }),
        alert({ id: "a2", routeId: "l1", pairQuery: "from=9,9&to=8,8" }),
        alert({ id: "a3", routeId: "l2", status: "sent" }),
      ],
      "from=1,2&to=3,4",
    );
    expect(Object.keys(byRoute)).toEqual(["l0"]);
    expect(byRoute.l0.id).toBe("a1");
  });
});
