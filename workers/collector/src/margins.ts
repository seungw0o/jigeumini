import { histCount, histEarlyRate, histPercentile, mergeHist, parseHist, type Hist } from "./margin-hist";

const DAY_MS = 24 * 60 * 60 * 1000;

// src/apis/margins/types.ts 와 같은 모양 (워커는 앱 코드를 import할 수 없다)
type LeadMin = 3 | 5 | 10 | 15 | 20;

/** 정류장 전체 n·P10(출발 여유의 대체값)에 넣는 구간. 15·20분은 수집 전용이라 byLead에만 싣는다 */
const SUMMARY_MAX_LEAD_MIN = 10;

interface MarginBucket {
  leadMin: LeadMin;
  n: number;
  p10Sec: number;
  // 오차 < -s초인 비율, s = 0,30,…,300 (index = s/30)
  earlyRate: number[];
}

interface StopMargin {
  nodeId: string;
  n: number;
  p10Sec: number;
  // 오차 < -s초인 비율, s = 0,30,…,300 (index = s/30); 3/5/10분 합산
  earlyRate: number[];
  byLead: MarginBucket[];
}

interface MarginsResponse {
  windowDays: number;
  generatedAt: string;
  stops: StopMargin[];
}

/**
 * 아침 Cron이 접어 둔 margin_hist만 읽는다 (prediction_errors를 훑지 않는다).
 * 히스토그램은 수집 시작부터 누적이라 windowDays는 가장 오래된 오차부터 지금까지의 일수다.
 * P10은 칸의 아래 끝이라 raw nearest-rank보다 최대 10초 이르다 (margin-hist.ts 참고).
 */
export async function stopMargins(db: D1Database, nowMs: number): Promise<MarginsResponse> {
  const [hists, first] = await db.batch<{ node_id?: string; lead_bucket_min?: number; bins?: string; predicted_at?: string }>([
    db.prepare("SELECT node_id, lead_bucket_min, bins FROM margin_hist ORDER BY node_id, lead_bucket_min"),
    // INTEGER PRIMARY KEY 앞쪽 1행이라 전체를 훑지 않는다
    db.prepare("SELECT predicted_at FROM prediction_errors ORDER BY id LIMIT 1"),
  ]);

  const byStop = new Map<string, { leadMin: number; hist: Hist }[]>();
  for (const row of hists.results as { node_id: string; lead_bucket_min: number; bins: string }[]) {
    const hist = parseHist(row.bins);
    if (histCount(hist) === 0) continue;
    const list = byStop.get(row.node_id) ?? [];
    list.push({ leadMin: row.lead_bucket_min, hist });
    byStop.set(row.node_id, list);
  }

  const stops = [...byStop.entries()].flatMap(([nodeId, buckets]): StopMargin[] => {
    const summary = buckets.filter((b) => b.leadMin <= SUMMARY_MAX_LEAD_MIN).map((b) => b.hist);
    if (summary.length === 0) return [];
    const all = summary.reduce(mergeHist);
    return [{
      nodeId,
      n: histCount(all),
      p10Sec: histPercentile(all, 0.1),
      earlyRate: histEarlyRate(all),
      byLead: buckets.map(({ leadMin, hist }) => ({ leadMin: leadMin as LeadMin, n: histCount(hist), p10Sec: histPercentile(hist, 0.1), earlyRate: histEarlyRate(hist) })),
    }];
  });

  const firstAt = first.results[0]?.predicted_at;
  const windowDays = firstAt ? Math.max(1, Math.ceil((nowMs - Date.parse(firstAt)) / DAY_MS)) : 0;
  return { windowDays, generatedAt: new Date(nowMs).toISOString(), stops };
}
