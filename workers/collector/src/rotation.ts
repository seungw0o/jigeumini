import { kstDate, kstIso } from "./kst";

// 하루에 한 구씩 돌아가며 정류소를 잰다. 오너 결정(2026-10-26): 하루 60곳 = 고정 4곳 + 순환 56곳.
export const ROTATION_DISTRICTS = ["유성구", "서구", "중구", "대덕구", "동구"] as const;
export const MAX_DAILY_STOPS = 60;
export const D1_DAILY_ROWS_WRITTEN_LIMIT = 100_000;
/** 전날 쓴 행이 한도의 80%를 넘으면 오늘 정류소 수를 줄인다 */
const VALVE_TRIGGER_RATIO = 0.8;
/** 줄일 때는 정류소당 행 수로 나눠 한도의 70%에 맞춘다 */
const VALVE_TARGET_RATIO = 0.7;
/** 줄인 뒤에는 하루에 이만큼씩만 다시 늘린다 (60을 넘지 않는다) */
const RECOVERY_STEP = 8;

interface PreviousDay {
  stopCount: number;
  /** 전날 아침부터 오늘 아침까지 수집기가 쓴 행 수. 모르면 null */
  rowsWritten: number | null;
}

/** 오늘 잴 정류소 수(고정 포함). 안전 밸브는 줄이기만 하고, 자동으로 60을 넘기지 않는다 */
export function dailyStopCount(previous: PreviousDay | null, pinnedCount: number): number {
  const floor = Math.min(pinnedCount, MAX_DAILY_STOPS);
  if (previous === null || previous.rowsWritten === null) return MAX_DAILY_STOPS;
  const { stopCount, rowsWritten } = previous;
  if (rowsWritten > D1_DAILY_ROWS_WRITTEN_LIMIT * VALVE_TRIGGER_RATIO && stopCount > 0) {
    const perStop = rowsWritten / stopCount;
    const target = Math.floor((D1_DAILY_ROWS_WRITTEN_LIMIT * VALVE_TARGET_RATIO) / perStop);
    return Math.max(floor, Math.min(stopCount - 1, target));
  }
  return Math.max(floor, Math.min(MAX_DAILY_STOPS, stopCount + RECOVERY_STEP));
}

/** 전날 구 다음 구. 처음이면 유성구 */
export function nextDistrict(previous: string | null): string {
  const index = ROTATION_DISTRICTS.indexOf(previous as (typeof ROTATION_DISTRICTS)[number]);
  return ROTATION_DISTRICTS[(index + 1) % ROTATION_DISTRICTS.length];
}

interface RotationDayRow {
  day: string;
  district: string;
  stop_count: number;
  errors_max_id: number;
  arrivals_max_id: number;
  collector_errors_max_id: number;
}

export interface RotationResult {
  day: string;
  district: string;
  stopCount: number;
  pinned: string[];
  rotating: string[];
  rowsWrittenPrev: number | null;
  reused: boolean;
}

const CANDIDATES_SQL = `SELECT node_id, name, ars FROM stop_catalog
  WHERE district = ? AND node_id NOT IN (SELECT node_id FROM pinned_stops)
  ORDER BY last_measured_on IS NOT NULL, last_measured_on, node_id
  LIMIT ?`;

/**
 * 아침 Cron: 오늘 잴 정류소를 고르고 watched_stops를 바꾼다. 같은 날 다시 불리면 고른 것을 그대로 둔다.
 * 순환 정류소는 오늘의 구에서 한 번도 안 잰 곳 먼저, 그다음 가장 오래전에 잰 곳 순으로 뽑는다.
 * 그 구에 남은 정류소가 모자라면 다음 구들에서 채운다.
 */
export async function chooseDailyStops(db: D1Database, nowMs: number): Promise<RotationResult> {
  const day = kstDate(nowMs);
  const pinnedRows = (await db.prepare("SELECT node_id FROM pinned_stops ORDER BY node_id").all<{ node_id: string }>()).results;
  const pinned = pinnedRows.map((row) => row.node_id);

  const today = await db.prepare("SELECT * FROM rotation_days WHERE day = ?").bind(day).first<RotationDayRow & { rows_written_prev: number | null }>();
  if (today) {
    const { results } = await db
      .prepare("SELECT node_id FROM watched_stops WHERE enabled = 1 AND node_id NOT IN (SELECT node_id FROM pinned_stops) ORDER BY node_id")
      .all<{ node_id: string }>();
    return {
      day,
      district: today.district,
      stopCount: today.stop_count,
      pinned,
      rotating: results.map((row) => row.node_id),
      rowsWrittenPrev: today.rows_written_prev,
      reused: true,
    };
  }

  const previous = await db.prepare("SELECT * FROM rotation_days WHERE day < ? ORDER BY day DESC LIMIT 1").bind(day).first<RotationDayRow>();
  // INTEGER PRIMARY KEY의 MAX(id)는 rowid 끝만 보므로 전체를 훑지 않는다
  const ids = await db
    .prepare(
      `SELECT (SELECT COALESCE(MAX(id), 0) FROM prediction_errors) AS errors,
              (SELECT COALESCE(MAX(id), 0) FROM arrivals) AS arrivals,
              (SELECT COALESCE(MAX(id), 0) FROM collector_errors) AS collector_errors`,
    )
    .first<{ errors: number; arrivals: number; collector_errors: number }>();
  const maxIds = ids ?? { errors: 0, arrivals: 0, collector_errors: 0 };
  const rowsWrittenPrev = previous
    ? maxIds.errors - previous.errors_max_id + (maxIds.arrivals - previous.arrivals_max_id) + (maxIds.collector_errors - previous.collector_errors_max_id)
    : null;

  const stopCount = dailyStopCount(previous ? { stopCount: previous.stop_count, rowsWritten: rowsWrittenPrev } : null, pinned.length);
  const rotatingCount = Math.max(0, stopCount - pinned.length);
  const district = nextDistrict(previous?.district ?? null);

  const chosen: { node_id: string; name: string; ars: string | null }[] = [];
  const start = ROTATION_DISTRICTS.indexOf(district as (typeof ROTATION_DISTRICTS)[number]);
  for (let step = 0; step < ROTATION_DISTRICTS.length && chosen.length < rotatingCount; step++) {
    const name = ROTATION_DISTRICTS[(start + step) % ROTATION_DISTRICTS.length];
    const { results } = await db.prepare(CANDIDATES_SQL).bind(name, rotatingCount - chosen.length).all<{ node_id: string; name: string; ars: string | null }>();
    chosen.push(...results);
  }

  const at = kstIso(nowMs);
  const enable = db.prepare(
    "INSERT INTO watched_stops (node_id, name, enabled, created_at) VALUES (?, ?, 1, ?) ON CONFLICT(node_id) DO UPDATE SET enabled = 1",
  );
  const markMeasured = db.prepare("UPDATE stop_catalog SET last_measured_on = ?, measure_count = measure_count + 1 WHERE node_id = ?");
  await db.batch([
    // 어제의 순환 정류소를 끈다. 켜져 있던 DO는 다음 알람에서 꺼진 것을 보고 멈춘다
    db.prepare("UPDATE watched_stops SET enabled = 0 WHERE enabled = 1 AND node_id NOT IN (SELECT node_id FROM pinned_stops)"),
    db
      .prepare(
        "INSERT INTO watched_stops (node_id, name, enabled, created_at) SELECT node_id, name, 1, ? FROM pinned_stops WHERE true ON CONFLICT(node_id) DO UPDATE SET enabled = 1",
      )
      .bind(at),
    ...chosen.flatMap((stop) => [
      enable.bind(stop.node_id, `${stop.name}${stop.ars ? ` (ARS ${stop.ars})` : ""} · 순환 측정`, at),
      markMeasured.bind(day, stop.node_id),
    ]),
    db
      .prepare(
        `INSERT INTO rotation_days (day, district, stop_count, rotating_count, errors_max_id, arrivals_max_id, collector_errors_max_id, rows_written_prev, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(day, district, pinned.length + chosen.length, chosen.length, maxIds.errors, maxIds.arrivals, maxIds.collector_errors, rowsWrittenPrev, at),
  ]);

  return {
    day,
    district,
    stopCount: pinned.length + chosen.length,
    pinned,
    rotating: chosen.map((stop) => stop.node_id).sort(),
    rowsWrittenPrev,
    reused: false,
  };
}
