import { kstIso } from "./kst";

// 오차 히스토그램: [아래 넘침, 10초 칸 240개(-1200초 이상 1200초 미만), 위 넘침].
// 칸 수를 더하면 날마다 정확히 합쳐진다. P10은 합친 칸에서 nearest-rank로 찾고 그 칸의 아래 끝을 돌려준다:
// 실제 P10보다 최대 10초 더 이른(음수 쪽) 값이라 여유가 줄어드는 쪽으로는 틀리지 않고, 여유는 분 단위로 올림하므로 충분하다.
export const BIN_SEC = 10;
export const HIST_MIN_SEC = -1200;
export const HIST_MAX_SEC = 1200;
const INNER_BINS = (HIST_MAX_SEC - HIST_MIN_SEC) / BIN_SEC;
export const HIST_LENGTH = INNER_BINS + 2;

const FOLD_PAGE_ROWS = 10_000;
const IN_CHUNK = 50;

export type Hist = number[];

export const emptyHist = (): Hist => new Array<number>(HIST_LENGTH).fill(0);

export function binIndex(errorSec: number): number {
  if (errorSec < HIST_MIN_SEC) return 0;
  if (errorSec >= HIST_MAX_SEC) return HIST_LENGTH - 1;
  return 1 + Math.floor((errorSec - HIST_MIN_SEC) / BIN_SEC);
}

/** 칸이 대표하는 값: 아래 넘침은 HIST_MIN_SEC, 위 넘침은 HIST_MAX_SEC, 나머지는 칸의 아래 끝 */
export function binValue(index: number): number {
  if (index <= 0) return HIST_MIN_SEC;
  if (index >= HIST_LENGTH - 1) return HIST_MAX_SEC;
  return HIST_MIN_SEC + (index - 1) * BIN_SEC;
}

export function addToHist(hist: Hist, errorSec: number): void {
  hist[binIndex(errorSec)] += 1;
}

export function mergeHist(a: Hist, b: Hist): Hist {
  return a.map((count, i) => count + (b[i] ?? 0));
}

export const histCount = (hist: Hist): number => hist.reduce((sum, count) => sum + count, 0);

/** nearest-rank 백분위(raw의 db.nearestRank와 같은 순위)를 칸 단위로 */
export function histPercentile(hist: Hist, p: number): number {
  const n = histCount(hist);
  if (n === 0) throw new Error("histPercentile: empty histogram");
  const rank = Math.max(1, Math.ceil(p * n));
  let seen = 0;
  for (let i = 0; i < hist.length; i++) {
    seen += hist[i];
    if (seen >= rank) return binValue(i);
  }
  return binValue(hist.length - 1);
}

/**
 * 조기 도착 비율 (s = 0, 30, …, 300초; index = s/30). 칸 경계가 10초 배수라 count(오차 < -s)를 칸에서 정확히 센다.
 * 칸 k는 [v, v+10)이므로 끝 v+10이 -s 이하인 칸은 전부 -s보다 이르고, 그렇지 않은 칸은 하나도 해당하지 않는다.
 * 아래 넘침 칸은 항상 포함하고(s <= 300 < 1200), 위 넘침 칸은 세지 않는다.
 */
export function histEarlyRate(hist: Hist): number[] {
  const n = histCount(hist);
  return Array.from({ length: 11 }, (_, i) => {
    const threshold = 30 * i;
    let early = hist[0];
    for (let k = 1; k < HIST_LENGTH - 1; k++) {
      if (binValue(k) + BIN_SEC <= -threshold) early += hist[k];
    }
    return Math.round((early / n) * 1000) / 1000;
  });
}

export function parseHist(json: string): Hist {
  const parsed: unknown = JSON.parse(json);
  if (!Array.isArray(parsed) || parsed.length !== HIST_LENGTH || !parsed.every((v) => Number.isInteger(v) && v >= 0)) {
    throw new Error("margin_hist: bad bins");
  }
  return parsed as Hist;
}

interface FoldResult {
  fromId: number;
  toId: number;
  rows: number;
  keys: number;
}

const histKey = (nodeId: string, lead: number) => `${nodeId}|${lead}`;

/**
 * 지난 접기 이후 새로 들어온 prediction_errors만(id 범위) 읽어 margin_hist에 더한다.
 * 히스토그램 갱신과 fold_state 전진을 한 batch(트랜잭션)로 써서 두 번 더해지지 않는다.
 */
export async function foldNewErrors(db: D1Database, nowMs: number): Promise<FoldResult> {
  const state = await db.prepare("SELECT last_error_id FROM fold_state WHERE id = 1").first<{ last_error_id: number }>();
  const fromId = state?.last_error_id ?? 0;
  const max = await db.prepare("SELECT COALESCE(MAX(id), 0) AS id FROM prediction_errors").first<{ id: number }>();
  const toId = max?.id ?? 0;
  if (toId <= fromId) return { fromId, toId: fromId, rows: 0, keys: 0 };

  const fresh = new Map<string, { nodeId: string; lead: number; hist: Hist }>();
  let cursor = fromId;
  let rows = 0;
  while (cursor < toId) {
    const { results } = await db
      .prepare("SELECT id, node_id, lead_bucket_min, error_sec FROM prediction_errors WHERE id > ? AND id <= ? ORDER BY id LIMIT ?")
      .bind(cursor, toId, FOLD_PAGE_ROWS)
      .all<{ id: number; node_id: string; lead_bucket_min: number; error_sec: number }>();
    if (results.length === 0) break;
    for (const row of results) {
      const key = histKey(row.node_id, row.lead_bucket_min);
      const entry = fresh.get(key) ?? { nodeId: row.node_id, lead: row.lead_bucket_min, hist: emptyHist() };
      addToHist(entry.hist, row.error_sec);
      fresh.set(key, entry);
    }
    rows += results.length;
    cursor = results[results.length - 1].id;
  }

  const nodeIds = [...new Set([...fresh.values()].map((entry) => entry.nodeId))];
  const existing = new Map<string, Hist>();
  for (let i = 0; i < nodeIds.length; i += IN_CHUNK) {
    const chunk = nodeIds.slice(i, i + IN_CHUNK);
    const { results } = await db
      .prepare(`SELECT node_id, lead_bucket_min, bins FROM margin_hist WHERE node_id IN (${chunk.map(() => "?").join(", ")})`)
      .bind(...chunk)
      .all<{ node_id: string; lead_bucket_min: number; bins: string }>();
    for (const row of results) existing.set(histKey(row.node_id, row.lead_bucket_min), parseHist(row.bins));
  }

  const at = kstIso(nowMs);
  const upsert = db.prepare(
    `INSERT INTO margin_hist (node_id, lead_bucket_min, n, bins, updated_at) VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(node_id, lead_bucket_min) DO UPDATE SET n = excluded.n, bins = excluded.bins, updated_at = excluded.updated_at`,
  );
  const statements = [...fresh.entries()].map(([key, entry]) => {
    const prev = existing.get(key);
    const merged = prev ? mergeHist(prev, entry.hist) : entry.hist;
    return upsert.bind(entry.nodeId, entry.lead, histCount(merged), JSON.stringify(merged), at);
  });
  statements.push(
    db
      .prepare(
        `INSERT INTO fold_state (id, last_error_id, folded_at) VALUES (1, ?, ?)
         ON CONFLICT(id) DO UPDATE SET last_error_id = excluded.last_error_id, folded_at = excluded.folded_at`,
      )
      .bind(cursor, at),
  );
  await db.batch(statements);
  return { fromId, toId: cursor, rows, keys: fresh.size };
}
