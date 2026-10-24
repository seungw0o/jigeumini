import { nearestRank } from "./db";
import { kstIso } from "./kst";

export const WINDOW_DAYS = 28;

// src/apis/margins/types.ts 와 같은 모양 (워커는 앱 코드를 import할 수 없다)
export interface MarginBucket {
  leadMin: 3 | 5 | 10;
  n: number;
  p10Sec: number;
}

export interface StopMargin {
  nodeId: string;
  n: number;
  p10Sec: number;
  byLead: MarginBucket[];
}

export interface MarginsResponse {
  windowDays: number;
  generatedAt: string;
  stops: StopMargin[];
}

// predicted_at 은 +09:00 고정 ISO 문자열이라 문자열 비교가 시간순과 같다
const MARGINS_SQL = "SELECT node_id, lead_bucket_min, error_sec FROM prediction_errors WHERE predicted_at >= ?";

export async function stopMargins(db: D1Database, nowMs: number): Promise<MarginsResponse> {
  const since = kstIso(nowMs - WINDOW_DAYS * 24 * 60 * 60 * 1000);
  const { results } = await db
    .prepare(MARGINS_SQL)
    .bind(since)
    .all<{ node_id: string; lead_bucket_min: number; error_sec: number }>();

  type StopValues = { all: number[]; byLead: Map<number, number[]> };
  const byStop = new Map<string, StopValues>();
  for (const row of results) {
    const stop: StopValues = byStop.get(row.node_id) ?? { all: [], byLead: new Map() };
    stop.all.push(row.error_sec);
    const bucket = stop.byLead.get(row.lead_bucket_min) ?? [];
    bucket.push(row.error_sec);
    stop.byLead.set(row.lead_bucket_min, bucket);
    byStop.set(row.node_id, stop);
  }

  const stops = [...byStop.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([nodeId, stop]): StopMargin => ({
      nodeId,
      n: stop.all.length,
      p10Sec: nearestRank(stop.all, 0.1),
      byLead: [...stop.byLead.entries()]
        .sort(([a], [b]) => a - b)
        .map(([leadMin, values]): MarginBucket => ({ leadMin: leadMin as 3 | 5 | 10, n: values.length, p10Sec: nearestRank(values, 0.1) })),
    }));

  return { windowDays: WINDOW_DAYS, generatedAt: new Date(nowMs).toISOString(), stops };
}
