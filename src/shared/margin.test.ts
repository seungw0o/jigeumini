import { describe, expect, test } from "vitest";
import type { MarginBucket, MarginsResponse, StopMargin } from "@/apis/margins/types";
import { pickMarginMinutes } from "./margin";

const bucket = (leadMin: MarginBucket["leadMin"], n: number, p10Sec: number): MarginBucket => ({
  leadMin,
  n,
  p10Sec,
});

const stop = (overrides: Partial<StopMargin> = {}): StopMargin => ({
  nodeId: "S1",
  n: 200,
  p10Sec: -30,
  byLead: [bucket(3, 50, -30), bucket(5, 50, -90), bucket(10, 50, -200)],
  ...overrides,
});

const margins = (...stops: StopMargin[]): MarginsResponse => ({
  windowDays: 14,
  generatedAt: "2026-10-23T00:00:00Z",
  stops,
});

describe("pickMarginMinutes", () => {
  test("falls back to the default when data is missing or too thin", () => {
    expect(pickMarginMinutes("S1", 360, undefined)).toBe(2);
    expect(pickMarginMinutes(null, 360, margins(stop()))).toBe(2);
    expect(pickMarginMinutes("NOPE", 360, margins(stop()))).toBe(2);
    expect(pickMarginMinutes("S1", 360, margins(stop({ n: 99 })))).toBe(2);
  });

  test("picks the lead bucket closest to the walk time, tie to the larger", () => {
    const m = margins(
      stop({
        byLead: [bucket(3, 50, -60), bucket(5, 50, -180), bucket(10, 50, -420)],
      }),
    );
    expect(pickMarginMinutes("S1", 2 * 60, m)).toBe(1);
    expect(pickMarginMinutes("S1", 6 * 60, m)).toBe(3);
    expect(pickMarginMinutes("S1", 9 * 60, m)).toBe(7);
    expect(pickMarginMinutes("S1", 4 * 60, m)).toBe(3);
  });

  test("falls back to the all-bucket P10 when the bucket is thin or missing", () => {
    const thin = margins(stop({ p10Sec: -383, byLead: [bucket(5, 29, -30)] }));
    expect(pickMarginMinutes("S1", 6 * 60, thin)).toBe(7);

    const missing = margins(stop({ p10Sec: -79, byLead: [bucket(3, 50, -30)] }));
    expect(pickMarginMinutes("S1", 6 * 60, missing)).toBe(2);
  });

  test("converts P10 seconds to clamped whole minutes", () => {
    const withP10 = (p10Sec: number) => pickMarginMinutes("S1", 3 * 60, margins(stop({ p10Sec, byLead: [] })));
    expect(withP10(-24)).toBe(1);
    expect(withP10(-79)).toBe(2);
    expect(withP10(-383)).toBe(7);
    expect(withP10(-600)).toBe(7);
    expect(withP10(30)).toBe(1);
    expect(withP10(-120)).toBe(2);
  });
});
