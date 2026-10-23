import type { Prediction } from "./tracker";

/** 도착 몇 분 전의 예측을 볼지와, 그 리드에서 얼마나 벗어난 관측까지 받아줄지(초) */
export const LEAD_BUCKETS = [
  { minutes: 10, toleranceSec: 120 },
  { minutes: 5, toleranceSec: 60 },
  { minutes: 3, toleranceSec: 60 },
] as const;

export interface PredictionError {
  leadBucketMin: number;
  predictedAt: number;
  /** 실제 도착 - (관측 시각 + 예측 초). 양수면 예측보다 늦게 왔다 */
  errorSec: number;
}

export function computeErrors(arrivedAt: number, predictions: Prediction[]): PredictionError[] {
  const errors: PredictionError[] = [];
  for (const bucket of LEAD_BUCKETS) {
    const target = bucket.minutes * 60;
    let best: { prediction: Prediction; distance: number } | null = null;
    for (const prediction of predictions) {
      const distance = Math.abs((arrivedAt - prediction.observedAt) / 1000 - target);
      if (distance <= bucket.toleranceSec && (!best || distance < best.distance)) best = { prediction, distance };
    }
    if (!best) continue;
    const predictedArrival = best.prediction.observedAt + best.prediction.etaSeconds * 1000;
    errors.push({
      leadBucketMin: bucket.minutes,
      predictedAt: best.prediction.observedAt,
      errorSec: Math.round((arrivedAt - predictedArrival) / 1000),
    });
  }
  return errors;
}
