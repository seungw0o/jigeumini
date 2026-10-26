import { describe, expect, test } from "vitest";
import { computeErrors } from "../src/prediction-errors";
import { T0 } from "./helpers";

const at = (secondsBefore: number, etaSeconds: number) => ({ observedAt: T0 - secondsBefore * 1000, etaSeconds });

describe("computeErrors", () => {
  test("takes the observation closest to 10/5/3 min before arrival; positive = came later than predicted", () => {
    const predictions = [at(660, 600), at(600, 540), at(420, 400), at(310, 340), at(180, 180), at(120, 150)];
    expect(computeErrors(T0, predictions)).toEqual([
      { leadBucketMin: 10, predictedAt: T0 - 600_000, errorSec: 60 },
      { leadBucketMin: 5, predictedAt: T0 - 310_000, errorSec: -30 },
      { leadBucketMin: 3, predictedAt: T0 - 180_000, errorSec: 0 },
    ]);
  });

  test("also records 20 and 15 min leads for far predictions (transfer buses)", () => {
    const predictions = [at(1260, 1200), at(1200, 1150), at(900, 930), at(600, 600)];
    expect(computeErrors(T0, predictions)).toEqual([
      { leadBucketMin: 20, predictedAt: T0 - 1_200_000, errorSec: 50 },
      { leadBucketMin: 15, predictedAt: T0 - 900_000, errorSec: -30 },
      { leadBucketMin: 10, predictedAt: T0 - 600_000, errorSec: 0 },
    ]);
  });

  test("a bucket with no observation inside its tolerance is skipped", () => {
    expect(computeErrors(T0, [at(420, 400)])).toEqual([]);
    expect(computeErrors(T0, [])).toEqual([]);
  });
});
