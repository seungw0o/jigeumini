import type { ArrivalRow, CollectorErrorRow, Sink } from "./collector";

export class D1Sink implements Sink {
  constructor(private readonly db: D1Database) {}

  async save({ arrivals }: { arrivals: ArrivalRow[] }): Promise<void> {
    const statements: D1PreparedStatement[] = [];
    const insertArrival = this.db.prepare(
      "INSERT INTO arrivals (node_id, route_no, plate_no, arrived_at, inferred) VALUES (?, ?, ?, ?, ?)",
    );
    const insertError = this.db.prepare(
      "INSERT INTO prediction_errors (node_id, route_no, plate_no, lead_bucket_min, predicted_at, error_sec, hour_kst, weekday) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    );
    for (const arrival of arrivals) {
      statements.push(insertArrival.bind(arrival.nodeId, arrival.routeNo, arrival.plateNo, arrival.arrivedAt, arrival.inferred ? 1 : 0));
      for (const error of arrival.errors) {
        statements.push(
          insertError.bind(arrival.nodeId, arrival.routeNo, arrival.plateNo, error.leadBucketMin, error.predictedAt, error.errorSec, error.hourKst, error.weekday),
        );
      }
    }
    if (statements.length > 0) await this.db.batch(statements);
  }

  async logError(row: CollectorErrorRow): Promise<void> {
    await this.db
      .prepare("INSERT INTO collector_errors (node_id, at, code, message) VALUES (?, ?, ?, ?)")
      .bind(row.nodeId, row.at, row.code, row.message)
      .run();
  }
}

export async function enabledStopIds(db: D1Database): Promise<string[]> {
  const { results } = await db.prepare("SELECT node_id FROM watched_stops WHERE enabled = 1 ORDER BY node_id").all<{ node_id: string }>();
  return results.map((row) => row.node_id);
}

export async function health(db: D1Database) {
  const [watched, last] = await db.batch<{ n?: number; arrived_at?: string }>([
    db.prepare("SELECT COUNT(*) AS n FROM watched_stops WHERE enabled = 1"),
    // id 역순 1행: MAX(arrived_at)은 전체를 훑어서 rows read가 커진다
    db.prepare("SELECT arrived_at FROM arrivals ORDER BY id DESC LIMIT 1"),
  ]);
  return { ok: true, watched: watched.results[0]?.n ?? 0, lastArrivalAt: last.results[0]?.arrived_at ?? null };
}

export interface ErrorStats {
  n: number;
  medianSec: number;
  p80Sec: number;
  p90Sec: number;
}

/** nearest-rank 백분위: 오름차순 정렬 후 index max(0, ceil(p*len)-1) */
export function nearestRank(values: number[], p: number): number {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.max(0, Math.ceil(p * sorted.length) - 1)];
}

/** nearest-rank 백분위 */
export function summarize(values: number[]): ErrorStats {
  const sorted = [...values].sort((a, b) => a - b);
  const at = (p: number) => sorted[Math.max(0, Math.ceil(p * sorted.length) - 1)];
  return { n: sorted.length, medianSec: at(0.5), p80Sec: at(0.8), p90Sec: at(0.9) };
}

export async function stopStats(db: D1Database, nodeId: string) {
  const [counts, errors] = await db.batch<Record<string, unknown>>([
    db
      .prepare(
        "SELECT (SELECT COUNT(*) FROM arrivals WHERE node_id = ?1) AS arrivals, (SELECT COUNT(*) FROM prediction_errors WHERE node_id = ?1) AS errors",
      )
      .bind(nodeId),
    db.prepare("SELECT route_no, lead_bucket_min, error_sec FROM prediction_errors WHERE node_id = ?").bind(nodeId),
  ]);

  type RouteErrors = { all: number[]; byBucket: Map<number, number[]> };
  const byRoute = new Map<string, RouteErrors>();
  for (const row of errors.results as { route_no: string; lead_bucket_min: number; error_sec: number }[]) {
    const route: RouteErrors = byRoute.get(row.route_no) ?? { all: [], byBucket: new Map() };
    route.all.push(row.error_sec);
    route.byBucket.set(row.lead_bucket_min, [...(route.byBucket.get(row.lead_bucket_min) ?? []), row.error_sec]);
    byRoute.set(row.route_no, route);
  }

  return {
    stop: nodeId,
    counts: counts.results[0] ?? { arrivals: 0, errors: 0 },
    routes: [...byRoute.entries()]
      .sort(([a], [b]) => a.localeCompare(b, "ko", { numeric: true }))
      .map(([routeNo, route]) => ({
        routeNo,
        ...summarize(route.all),
        byLeadMin: [...route.byBucket.entries()]
          .sort(([a], [b]) => b - a)
          .map(([leadMin, values]) => ({ leadMin, ...summarize(values) })),
      })),
  };
}
