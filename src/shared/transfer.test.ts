import { describe, expect, test } from "vitest";
import type { MarginBucket, MarginsResponse, StopMargin } from "@/apis/margins/types";
import { catchChance } from "./transfer";

const RAMP = [0.5, 0.4, 0.3, 0.2, 0.15, 0.1, 0.08, 0.06, 0.04, 0.02, 0.01];
const FLAT = (v: number) => Array.from({ length: 11 }, () => v);

const bucket = (leadMin: MarginBucket["leadMin"], n: number, earlyRate: number[]): MarginBucket => ({
  leadMin,
  n,
  p10Sec: -30,
  earlyRate,
});

const stop = (overrides: Partial<StopMargin> = {}): StopMargin => ({
  nodeId: "S1",
  n: 200,
  p10Sec: -30,
  earlyRate: RAMP,
  byLead: [],
  ...overrides,
});

const margins = (...stops: StopMargin[]): MarginsResponse => ({
  windowDays: 14,
  generatedAt: "2026-10-26T00:00:00Z",
  stops,
});

const ask = (over: Partial<Parameters<typeof catchChance>[0]> = {}) =>
  catchChance({ nodeId: "S1", slackSec: 0, leadSec: 360, margins: margins(stop()), ...over });

describe("catchChance interpolation", () => {
  test("slack 0 and 30 read the measured points directly", () => {
    expect(ask({ slackSec: 0 })).toBeCloseTo(1 - 0.5);
    expect(ask({ slackSec: 30 })).toBeCloseTo(1 - 0.4);
  });

  test("slack 45 is the midpoint between the 30 s and 60 s points", () => {
    expect(ask({ slackSec: 45 })).toBeCloseTo(1 - (0.4 + 0.3) / 2);
  });

  test("slack at or beyond 300 s uses the 300 s point", () => {
    expect(ask({ slackSec: 300 })).toBeCloseTo(1 - 0.01);
    expect(ask({ slackSec: 900 })).toBeCloseTo(1 - 0.01);
  });

  test("negative or non-finite slack is undefined", () => {
    expect(ask({ slackSec: -1 })).toBeUndefined();
    expect(ask({ slackSec: Number.NaN })).toBeUndefined();
  });
});

describe("catchChance lead bucket selection", () => {
  const perLead = stop({
    byLead: [bucket(3, 50, FLAT(0.1)), bucket(5, 50, FLAT(0.2)), bucket(10, 50, FLAT(0.3)), bucket(15, 50, FLAT(0.4)), bucket(20, 50, FLAT(0.5))],
  });
  const at = (leadSec: number) => catchChance({ nodeId: "S1", slackSec: 0, leadSec, margins: margins(perLead) });

  test("600 s (10 min) picks the 10 bucket", () => {
    expect(at(600)).toBeCloseTo(1 - 0.3);
  });

  test("1000 s (16.7 min) picks the 15 bucket", () => {
    expect(at(1000)).toBeCloseTo(1 - 0.4);
  });

  test("450 s (7.5 min) ties between 5 and 10 and picks the larger, 10", () => {
    expect(at(450)).toBeCloseTo(1 - 0.3);
  });
});

describe("catchChance summary fallback", () => {
  test("thin bucket (n < 30) falls back to the stop summary when stop n >= 100", () => {
    const thin = margins(stop({ byLead: [bucket(10, 29, FLAT(0.3))] }));
    expect(catchChance({ nodeId: "S1", slackSec: 0, leadSec: 600, margins: thin })).toBeCloseTo(1 - 0.5);
  });

  test("missing bucket falls back to the stop summary", () => {
    const missing = margins(stop({ byLead: [bucket(3, 50, FLAT(0.1))] }));
    expect(catchChance({ nodeId: "S1", slackSec: 0, leadSec: 600, margins: missing })).toBeCloseTo(1 - 0.5);
  });
});

describe("catchChance insufficient data", () => {
  test("thin bucket and thin stop (n < 100) is undefined", () => {
    const thin = margins(stop({ n: 99, byLead: [bucket(10, 29, FLAT(0.3))] }));
    expect(catchChance({ nodeId: "S1", slackSec: 0, leadSec: 600, margins: thin })).toBeUndefined();
  });

  test("margins undefined is undefined", () => {
    expect(ask({ margins: undefined })).toBeUndefined();
  });

  test("unknown nodeId is undefined", () => {
    expect(ask({ nodeId: "NOPE" })).toBeUndefined();
  });

  test("earlyRate with length other than 11 is undefined", () => {
    const short = margins(stop({ earlyRate: RAMP.slice(0, 10) }));
    expect(ask({ margins: short })).toBeUndefined();
  });
});
