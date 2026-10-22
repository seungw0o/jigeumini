import { describe, expect, test } from "bun:test";
import { haversineMeters } from "./geo";
import {
  alightingTargetOf,
  boardingTargetOf,
  DEFAULT_MAX_MATCH_DISTANCE_M,
  matchStop,
  normalizeStopName,
} from "./matching";
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
