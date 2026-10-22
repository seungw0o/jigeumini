import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { fixture, restoreAll, stubFetch, useTestKeys } from "../__fixtures__/fetch-stub";
import { getTransitRoutes, getWalkRoute, searchPlaces } from "./kakao.server";

beforeEach(useTestKeys);
afterEach(restoreAll);

const ORIGIN = { lat: 36.39007, lng: 127.362274 };
const DEST = { lat: 36.35272, lng: 127.37907 };

describe("getTransitRoutes (live fixture: 대덕대학교 → 갤러리아타임월드)", () => {
  test("maps routes with steps, vehicles, stops and path coords", async () => {
    const calls = stubFetch(() => ({ body: fixture("kakao-transit.json") }));
    const result = await getTransitRoutes({
      origin: ORIGIN,
      destination: DEST,
      originName: "대덕대학교",
      destinationName: "갤러리아타임월드",
    });

    expect(calls[0].url.pathname).toBe("/v2/routing/publictraffic");
    expect(calls[0].url.searchParams.get("start_x")).toBe("127.362274");
    expect(calls[0].url.searchParams.get("start_y")).toBe("36.39007");
    expect(calls[0].headers.get("Authorization")).toBe("KakaoAK test-kakao-key");

    expect(result.status).toBe("OK");
    expect(result.counts.total).toBe(14);
    expect(result.routes.length).toBe(14);

    const direct318 = result.routes[0];
    expect(direct318).toMatchObject({
      type: "BUS",
      totalDistanceM: 5851,
      totalSeconds: 1240,
      transfers: 0,
      fare: { value: 1500 },
    });
    expect(direct318.steps).toHaveLength(1);
    expect(direct318.steps[0]).toMatchObject({
      mode: "bus",
      vehicles: [{ name: "318", type: "일반" }],
    });
    expect(direct318.steps[0].stopNames[0]).toBe("대덕대학교");
    expect(direct318.steps[0].stopNames.at(-1)).toBe("갤러리아타임월드");
    expect(direct318.steps[0].path.length).toBeGreaterThan(2);
    expect(typeof direct318.steps[0].path[0].lat).toBe("number");
    expect(typeof direct318.steps[0].path[0].lng).toBe("number");

    const transfer = result.routes.find((route) => route.transfers > 0);
    expect(transfer !== undefined).toBe(true);
    expect(transfer!.steps.length).toBeGreaterThan(1);
    const walkStep = transfer!.steps.find((step) => step.mode === "walk");
    if (walkStep) expect(walkStep.vehicles).toEqual([]);
  });
});

describe("getWalkRoute (live fixture)", () => {
  test("returns distance, time, and a path", async () => {
    stubFetch(() => ({ body: fixture("kakao-walk.json") }));
    const walk = await getWalkRoute(ORIGIN, DEST);
    expect(walk.distanceM).toBe(5777);
    expect(walk.seconds).toBe(5401);
    expect(walk.path.length).toBeGreaterThan(2);
    expect(typeof walk.path[0].lat).toBe("number");
    expect(typeof walk.path[0].lng).toBe("number");
  });
});

describe("searchPlaces (live fixture: 갤러리아타임월드)", () => {
  test("maps places to the domain Place shape with position and distance", async () => {
    const calls = stubFetch(() => ({ body: fixture("kakao-keyword.json") }));
    const result = await searchPlaces("갤러리아타임월드", { near: ORIGIN, radiusM: 20000 });

    expect(calls[0].url.searchParams.get("query")).toBe("갤러리아타임월드");
    expect(calls[0].url.searchParams.get("x")).toBe("127.362274");
    expect(calls[0].url.searchParams.get("sort")).toBe("distance");

    expect(result.totalCount).toBeGreaterThan(0);
    const first = result.places[0];
    expect(first.id).toBe("10126730");
    expect(first.name).toBe("갤러리아백화점 타임월드점");
    expect(first.address).toBe("대전 서구 대덕대로 211");
    expect(first.position.lat).toBeGreaterThan(36);
    expect(first.position.lng).toBeGreaterThan(127);
    expect(first.distanceM).toBeGreaterThan(0);
  });
});
