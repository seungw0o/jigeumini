import { describe, expect, test } from "vitest";
import { fixture } from "./__fixtures__/fetch-stub";
import { haversineMeters } from "./geo";
import {
  alightingTargetOf,
  boardingTargetOf,
  DEFAULT_MAX_MATCH_DISTANCE_M,
  matchStop,
  normalizeSeoulStopName,
  normalizeStopName,
  pickServedCandidate,
  sameNameCandidates,
  type StopCandidate,
} from "./matching";
import { parseSeoulArrivals, parseSeoulStations, readSeoulItems } from "./seoul/parse";
import type { TagoStop } from "./tago/types";

const stop = (nodeId: string, name: string, arsId: string | null, lat: number, lng: number): TagoStop => ({
  nodeId,
  name,
  arsId,
  position: { lat, lng },
  cityCode: 25,
});

const DAEDEOK_43420 = stop("DJB8001318", "대덕대학교", "43420", 36.39007, 127.362274);
const DAEDEOK_43430 = stop("DJB8001319", "대덕대학교", "43430", 36.390736, 127.36219);
const DAEDEOK_SHORT = stop("DJB9001029", "대덕대학", null, 36.390774, 127.36313);

const KAKAO_318_FIRST_POINT = { lat: 36.39009989, lng: 127.36228785 };

describe("haversineMeters", () => {
  test("대덕대학교 43420 vs kakao path first point is ~4m", () => {
    const d = haversineMeters(DAEDEOK_43420.position, KAKAO_318_FIRST_POINT);
    expect(d).toBeLessThan(10);
    expect(d).toBeGreaterThan(0);
  });

  test("대덕대학교 43430 (길 건너편) vs kakao path first point is ~71m", () => {
    const d = haversineMeters(DAEDEOK_43430.position, KAKAO_318_FIRST_POINT);
    expect(d).toBeGreaterThan(50);
    expect(d).toBeLessThan(100);
  });
});

describe("normalizeStopName", () => {
  test("strips all whitespace", () => {
    expect(normalizeStopName("대덕 대학교")).toBe("대덕대학교");
    expect(normalizeStopName("  대덕대학교  ")).toBe("대덕대학교");
  });
});

describe("matchStop", () => {
  const candidates = [DAEDEOK_43420, DAEDEOK_43430, DAEDEOK_SHORT];

  test("picks the closer same-name stop (43420 at ~4m, not 43430 at ~71m)", () => {
    const match = matchStop({ name: "대덕대학교", position: KAKAO_318_FIRST_POINT }, candidates);
    expect(match).toMatchObject({
      tagoNodeId: "DJB8001318",
      daejeonNodeId: "8001318",
      arsId: "43420",
      name: "대덕대학교",
    });
    expect(match!.distanceM).toBeLessThan(10);
  });

  test("does not match a differently-named stop even if close (대덕대학 vs 대덕대학교)", () => {
    const match = matchStop({ name: "대덕대학교", position: DAEDEOK_SHORT.position }, [DAEDEOK_SHORT]);
    expect(match).toBeNull();
  });

  test("normalizes spaces in names", () => {
    const spacedCandidate = stop("DJB8001318", "대덕 대학교", "43420", 36.39007, 127.362274);
    const match = matchStop({ name: "대덕대학교", position: KAKAO_318_FIRST_POINT }, [spacedCandidate]);
    expect(match).toMatchObject({ daejeonNodeId: "8001318" });
  });

  test("returns null when all same-name stops exceed maxDistance", () => {
    const match = matchStop({ name: "대덕대학교", position: KAKAO_318_FIRST_POINT }, candidates, 1);
    expect(match).toBeNull();
  });

  test("returns null for empty candidates", () => {
    expect(matchStop({ name: "대덕대학교", position: KAKAO_318_FIRST_POINT }, [])).toBeNull();
  });

  test("rejects non-Daejeon TAGO ids", () => {
    const nonDaejeon = stop("ICB1234567", "대덕대학교", "99999", 36.39007, 127.362274);
    expect(matchStop({ name: "대덕대학교", position: KAKAO_318_FIRST_POINT }, [nonDaejeon])).toBeNull();
  });

  test("default max distance is 150m", () => {
    expect(DEFAULT_MAX_MATCH_DISTANCE_M).toBe(150);
  });
});

describe("boardingTargetOf / alightingTargetOf", () => {
  const step = {
    stopNames: ["대덕대학교", "한국전자통신연구원", "갤러리아타임월드"],
    path: [
      { lat: 36.39009989, lng: 127.36228785 },
      { lat: 36.35, lng: 127.378 },
    ],
  };

  test("boarding = first stop + first path point", () => {
    expect(boardingTargetOf(step)).toEqual({ name: "대덕대학교", position: step.path[0] });
  });

  test("alighting = last stop + last path point", () => {
    expect(alightingTargetOf(step)).toEqual({ name: "갤러리아타임월드", position: step.path[1] });
  });

  test("returns null when data is missing", () => {
    expect(boardingTargetOf({ stopNames: [], path: [] })).toBeNull();
    expect(alightingTargetOf({ stopNames: ["a"], path: [] })).toBeNull();
  });
});

describe("Seoul matching (live fixtures 2026-10-26)", () => {
  const candidatesFrom = (name: string): StopCandidate[] =>
    parseSeoulStations(readSeoulItems("getStationByPos", JSON.parse(fixture(name)))).map((s) => ({
      stopId: `seoul:${s.arsId}`,
      arsId: s.arsId,
      name: s.name,
      position: s.position,
    }));
  const arrivals02004 = parseSeoulArrivals(readSeoulItems("getStationByUid", JSON.parse(fixture("seoul-arrivals-02004.json"))), "02004");

  test("Kakao's platform suffix is ignored for Seoul names", () => {
    expect(normalizeSeoulStopName("서울역버스환승센터(5번승강장)(중)")).toBe("서울역버스환승센터");
  });

  test("길 건너편: 지하철2호선강남역 picks 22012 at ~9m, not the same-name 22011 across the road at ~116m", () => {
    const [nearest, ...rest] = sameNameCandidates(
      { name: "지하철2호선강남역", position: { lat: 37.50084994, lng: 127.02630035 } },
      candidatesFrom("seoul-stations-gangnam.json"),
      normalizeSeoulStopName,
    );
    expect(nearest).toMatchObject({ stopId: "seoul:22012" });
    expect(nearest.distanceM).toBeLessThan(15);
    expect(rest.map((c) => c.stopId)).toEqual(["seoul:22011"]);
  });

  describe("서울역버스환승센터 platforms ~10m apart are split by route", () => {
    const platform5 = { name: "서울역버스환승센터(5번승강장)(중)", position: { lat: 37.55547292, lng: 126.97256712 } };
    const candidates = () => sameNameCandidates(platform5, candidatesFrom("seoul-stations-seoulstation.json"), normalizeSeoulStopName);
    const route402 = { ...arrivals02004[0], routeNo: "402", stopNodeId: "seoul:02005", arsId: "02005" };

    test("same-name candidates in distance order", () => {
      expect(candidates().map((c) => c.arsId)).toEqual(["02004", "02005", "02006", "02003"]);
    });

    test("421 is served at the nearest platform 02004", async () => {
      const picked = await pickServedCandidate(candidates(), ["421"], async (c) => (c.arsId === "02004" ? arrivals02004 : []));
      expect(picked).toEqual({ candidate: expect.objectContaining({ arsId: "02004" }), complete: true });
    });

    test("402 is not at 02004, so the next platform that serves it wins", async () => {
      const picked = await pickServedCandidate(candidates(), ["402"], async (c) =>
        c.arsId === "02004" ? arrivals02004 : c.arsId === "02005" ? [route402] : [],
      );
      expect(picked.candidate?.arsId).toBe("02005");
    });

    test("a bus no platform knows (e.g. Gyeonggi) falls back to the nearest; a failed lookup marks the pick incomplete", async () => {
      expect(await pickServedCandidate(candidates(), ["9300"], async () => arrivals02004)).toEqual({
        candidate: expect.objectContaining({ arsId: "02004" }),
        complete: true,
      });
      const failing = await pickServedCandidate(candidates(), ["402"], async () => {
        throw new Error("timeout");
      });
      expect(failing).toEqual({ candidate: expect.objectContaining({ arsId: "02004" }), complete: false });
    });
  });
});
