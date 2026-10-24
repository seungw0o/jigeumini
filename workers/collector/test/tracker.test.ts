import { describe, expect, test } from "vitest";
import { parseArrivals } from "../../../src/apis/daejeon/parse";
import { fixture } from "../../../src/apis/__fixtures__/fetch-stub";
import { trackArrivals, type Tracks } from "../src/tracker";
import { arrivalsOf, MIN, T0 } from "./helpers";

function feed(steps: { at: number; arrivals: ReturnType<typeof arrivalsOf> }[]) {
  let tracks: Tracks = {};
  const detected = [];
  for (const step of steps) {
    const result = trackArrivals(tracks, step.arrivals, step.at);
    tracks = result.tracks;
    detected.push(...result.detected);
  }
  return { tracks, detected };
}

describe("trackArrivals", () => {
  test("MSG_TP 01 after approaching predictions is an observed arrival carrying those predictions", () => {
    const { detected } = feed([
      { at: T0, arrivals: arrivalsOf({ route: "318", plate: "A", msg: "03", sec: 300 }) },
      { at: T0 + MIN, arrivals: arrivalsOf({ route: "318", plate: "A", msg: "03", sec: 230 }) },
      { at: T0 + 5 * MIN, arrivals: arrivalsOf({ route: "318", plate: "A", msg: "01" }) },
    ]);
    expect(detected).toEqual([
      {
        routeNo: "318",
        routeCd: "RC318",
        plateNo: "A",
        arrivedAt: T0 + 5 * MIN,
        inferred: false,
        predictions: [
          { observedAt: T0, etaSeconds: 300 },
          { observedAt: T0 + MIN, etaSeconds: 230 },
        ],
      },
    ]);
  });

  test("MSG_TP 02 counts once while the bus stays listed as departed", () => {
    const { detected } = feed([
      { at: T0, arrivals: arrivalsOf({ route: "604", plate: "B", msg: "06", sec: 40 }) },
      { at: T0 + MIN, arrivals: arrivalsOf({ route: "604", plate: "B", msg: "02" }) },
      { at: T0 + 2 * MIN, arrivals: arrivalsOf({ route: "604", plate: "B", msg: "02" }) },
      { at: T0 + 3 * MIN, arrivals: arrivalsOf() },
    ]);
    expect(detected).toHaveLength(1);
    expect(detected[0]).toMatchObject({ plateNo: "B", arrivedAt: T0 + MIN, inferred: false });
  });

  test("a bus last predicted <= 2 min away that vanishes is an inferred arrival at the observation time", () => {
    const { detected, tracks } = feed([
      { at: T0, arrivals: arrivalsOf({ route: "1", plate: "C", msg: "03", sec: 200 }) },
      { at: T0 + MIN, arrivals: arrivalsOf({ route: "1", plate: "C", msg: "03", sec: 110 }) },
      { at: T0 + 2 * MIN, arrivals: arrivalsOf({ route: "1", plate: "D", msg: "03", sec: 900 }) },
    ]);
    expect(detected).toEqual([
      expect.objectContaining({ plateNo: "C", arrivedAt: T0 + 2 * MIN, inferred: true }),
    ]);
    expect(Object.keys(tracks)).toEqual(["RC1|D"]);
  });

  test("vanishing while still far away, or after a long gap in polling, is not an arrival", () => {
    const far = feed([
      { at: T0, arrivals: arrivalsOf({ route: "1", plate: "E", msg: "03", sec: 400 }) },
      { at: T0 + MIN, arrivals: arrivalsOf() },
    ]);
    const gap = feed([
      { at: T0, arrivals: arrivalsOf({ route: "1", plate: "F", msg: "03", sec: 60 }) },
      { at: T0 + 10 * MIN, arrivals: arrivalsOf() },
    ]);
    expect(far.detected).toEqual([]);
    expect(gap.detected).toEqual([]);
  });

  test("depot rows (MSG_TP 07, live fixture) are not tracked for errors", () => {
    const { tracks } = trackArrivals({}, parseArrivals(fixture("daejeon-arrivals-stopid.xml")), T0);
    const routes = Object.values(tracks).map((track) => track.routeNo);
    expect(routes).toEqual(["1", "912", "604", "708"]);
  });
});
