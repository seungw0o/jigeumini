import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { fixture, restoreAll, stubFetch, useTestKeys } from "../__fixtures__/fetch-stub";
import { getTransitRoutes } from "../kakao/kakao.server";
import type { KakaoTransitResult, KakaoTransitStep } from "../kakao/types";
import { stopKey, toPlannedRoutes } from "./plan";
import type { PlannedBusLeg, PlannedWalkLeg } from "./types";

beforeEach(useTestKeys);
afterEach(restoreAll);

const ORIGIN = { name: "대덕대학교", position: { lat: 36.39007, lng: 127.362274 } };
const DEST = { name: "갤러리아타임월드", position: { lat: 36.35272, lng: 127.37907 } };

async function loadFixture(): Promise<KakaoTransitResult> {
  stubFetch(() => ({ body: fixture("kakao-transit.json") }));
  return getTransitRoutes({ origin: ORIGIN.position, destination: DEST.position });
}

function step(mode: KakaoTransitStep["mode"], stops: string[], vehicles: string[] = [], type = "일반"): KakaoTransitStep {
  return {
    mode,
    guidance: "",
    distanceM: 100,
    seconds: 60,
    stopNames: stops,
    vehicles: vehicles.map((name) => ({ name, type })),
    path: [
      { lat: 36.1, lng: 127.1 },
      { lat: 36.2, lng: 127.2 },
    ],
  };
}

function result(...stepLists: KakaoTransitStep[][]): KakaoTransitResult {
  return {
    status: "OK",
    counts: { total: stepLists.length, bus: 0, subway: 0, busAndSubway: 0 },
    routes: stepLists.map((steps) => ({
      type: "BUS",
      totalDistanceM: 1000,
      totalSeconds: 600,
      transfers: steps.filter((s) => s.mode !== "walk").length - 1,
      fare: { value: 1500, min: null, max: null },
      steps,
    })),
  };
}

describe("toPlannedRoutes (fixture: 대덕대학교 → 갤러리아타임월드)", () => {
  test("keeps bus/walk routes in Kakao order with stable ids", async () => {
    const routes = toPlannedRoutes(await loadFixture(), ORIGIN, DEST);
    expect(routes.map((route) => route.id)).toEqual(["l0", "l1", "l2", "l3", "l4", "l5", "l6", "l7"]);
    expect(routes[0]).toMatchObject({ fare: 1500, transferCount: 0, totalSeconds: 1240 });
    const direct = routes[0].legs[0] as PlannedBusLeg;
    expect(direct).toMatchObject({ kind: "bus", routeNos: ["318"], busType: "trunk" });
    expect(direct.board).toMatchObject({ name: "대덕대학교", nodeId: null, arsId: null });
    expect(direct.alight.name).toBe("갤러리아타임월드");
    expect(direct.board.position).toEqual(direct.path[0]);
  });

  test("keeps back-to-back bus steps as two bus legs with all vehicles of the shared segment", async () => {
    const routes = toPlannedRoutes(await loadFixture(), ORIGIN, DEST);
    const transfer = routes[5].legs.filter((leg): leg is PlannedBusLeg => leg.kind === "bus");
    expect(transfer).toHaveLength(2);
    expect(transfer[0].routeNos).toEqual(["606"]);
    expect(transfer[1].routeNos).toEqual(["301", "604", "318"]);
  });

  test("maps 마을 to village and names walk ends after the surrounding bus stops", async () => {
    const routes = toPlannedRoutes(await loadFixture(), ORIGIN, DEST);
    const [first, walk, second] = routes[2].legs as [PlannedBusLeg, PlannedWalkLeg, PlannedBusLeg];
    expect(first.busType).toBe("village");
    expect(walk).toMatchObject({ kind: "walk", from: first.alight.name, to: second.board.name });
  });
});

describe("toPlannedRoutes (constructed)", () => {
  test("drops subway routes and bus steps without vehicles or path", () => {
    const noPath = { ...step("bus", ["A", "B"], ["5"]), path: [] };
    const routes = toPlannedRoutes(
      result(
        [step("bus", ["A", "B"], ["101"]), step("walk", []), step("subway", ["X", "Y"], ["1호선"])],
        [step("bus", ["A", "B"], [])],
        [noPath],
        [step("bus", ["A", "B", "C"], ["101", "101", "102"], "광역")],
      ),
      ORIGIN,
      DEST,
    );
    expect(routes).toHaveLength(1);
    expect(routes[0].id).toBe("l0");
    expect(routes[0].legs.find((leg) => leg.kind === "bus")).toMatchObject({
      routeNos: ["101", "102"],
      busType: "outer",
      stopCount: 2,
    });
  });

  test("walks before the first and after the last bus use the origin and destination names", () => {
    const [route] = toPlannedRoutes(
      result([step("walk", []), step("bus", ["승차", "하차"], ["7"]), step("walk", [])]),
      ORIGIN,
      DEST,
    );
    expect(route.legs[0]).toMatchObject({ kind: "walk", from: "대덕대학교", to: "승차" });
    expect(route.legs[2]).toMatchObject({ kind: "walk", from: "하차", to: "갤러리아타임월드" });
  });
});

describe("missing first/last-mile walks", () => {
  const A = { lat: 36.38, lng: 127.36 };
  const B = { lat: 36.36, lng: 127.37 };
  const origin = { name: "출발", position: { lat: 36.3809, lng: 127.36 } };
  const destination = { name: "도착", position: { lat: 36.3582, lng: 127.37 } };
  const busOnly = (totalSeconds: number) => {
    const input = result([{ ...step("bus", ["승차", "하차"], ["318"]), seconds: 600, path: [A, B] }]);
    input.routes[0].totalSeconds = totalSeconds;
    return input;
  };

  test("splits Kakao's unexplained time over the missing walks by distance", () => {
    const [route] = toPlannedRoutes(busOnly(900), origin, destination);
    const [before, bus, after] = route.legs as [PlannedWalkLeg, PlannedBusLeg, PlannedWalkLeg];
    expect([before.kind, bus.kind, after.kind]).toEqual(["walk", "bus", "walk"]);
    expect(before).toMatchObject({ from: "출발", to: "승차", distanceM: 100 });
    expect(after).toMatchObject({ from: "하차", to: "도착", distanceM: 200 });
    expect(before.seconds + after.seconds).toBe(300);
    expect(after.seconds).toBeGreaterThan(before.seconds * 1.8);
  });

  test("falls back to a walking speed when Kakao leaves no spare time", () => {
    const [route] = toPlannedRoutes(busOnly(600), origin, destination);
    expect(route.legs[0]).toMatchObject({ kind: "walk", seconds: 118 });
  });

  test("adds nothing when the stop is at the origin", () => {
    const [route] = toPlannedRoutes(busOnly(600), { name: "출발", position: A }, { name: "도착", position: B });
    expect(route.legs.map((leg) => leg.kind)).toEqual(["bus"]);
  });
});

test("stopKey ignores spaces and rounds to 4 decimals", () => {
  expect(stopKey({ name: "대덕 대학교", position: { lat: 36.390071, lng: 127.36227449 } })).toBe("대덕대학교@36.3901,127.3623");
});
