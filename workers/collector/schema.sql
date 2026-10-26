-- 대전 BIS 도착 예측 오차 수집. 적용: wrangler d1 execute jigeumini --local|--remote --file=schema.sql
-- D1 무료 한도(하루 100,000 rows written, 인덱스 갱신과 DELETE 포함) 때문에 인덱스는 꼭 필요한 것만 둔다.

CREATE TABLE IF NOT EXISTS watched_stops (
  node_id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS arrivals (
  id INTEGER PRIMARY KEY,
  node_id TEXT NOT NULL,
  route_no TEXT NOT NULL,
  plate_no TEXT NOT NULL,
  arrived_at TEXT NOT NULL,
  inferred INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS prediction_errors (
  id INTEGER PRIMARY KEY,
  node_id TEXT NOT NULL,
  route_no TEXT NOT NULL,
  plate_no TEXT NOT NULL,
  lead_bucket_min INTEGER NOT NULL,
  predicted_at TEXT NOT NULL,
  error_sec INTEGER NOT NULL,
  hour_kst INTEGER NOT NULL,
  weekday INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS collector_errors (
  id INTEGER PRIMARY KEY,
  node_id TEXT NOT NULL,
  at TEXT NOT NULL,
  code TEXT NOT NULL,
  message TEXT NOT NULL
);

-- 사용자별 즐겨찾기 장소. uid는 검증된 Firebase ID 토큰에서만 온다.
CREATE TABLE IF NOT EXISTS favorites (
  uid TEXT NOT NULL,
  place_id TEXT NOT NULL,
  name TEXT NOT NULL,
  address TEXT NOT NULL,
  category TEXT NOT NULL,
  lat REAL NOT NULL,
  lng REAL NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (uid, place_id)
);

-- 웹 푸시 구독. 기기(브라우저)마다 하나라 uid 하나에 여러 개일 수 있다. uid는 검증된 Firebase ID 토큰에서만 온다.
CREATE TABLE IF NOT EXISTS push_subscriptions (
  endpoint TEXT PRIMARY KEY,
  uid TEXT NOT NULL,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS push_subscriptions_uid ON push_subscriptions (uid);

-- 한 번만 울리는 출발 알림. plan_json(카카오 경로, path 제외)으로 화면과 같은 출발 시각을 다시 계산한다.
-- status: pending -> sent | cancelled | failed
CREATE TABLE IF NOT EXISTS alerts (
  id TEXT PRIMARY KEY,
  uid TEXT NOT NULL,
  route_id TEXT NOT NULL,
  pair_query TEXT NOT NULL,
  board_node_id TEXT NOT NULL,
  route_no TEXT NOT NULL,
  walk_before_sec INTEGER NOT NULL,
  plan_json TEXT NOT NULL,
  notify_before_min INTEGER NOT NULL,
  status TEXT NOT NULL,
  leave_by_at TEXT,
  fail_reason TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  sent_at TEXT
);
CREATE INDEX IF NOT EXISTS alerts_uid_status ON alerts (uid, status);

-- 아래는 migrations/0002_stop_rotation.sql과 같다 (오너 정류소 4곳 시드는 마이그레이션에만 있다).
-- 대전 정류소 전체. node_id = BUS_NODE_ID (TAGO nodeid에서 DJB를 뺀 값), district = 카카오 coord2regioncode의 구.
-- last_measured_on: 마지막으로 순환 측정에 뽑힌 KST 날짜(YYYY-MM-DD), 한 번도 안 뽑혔으면 NULL.
CREATE TABLE IF NOT EXISTS stop_catalog (
  node_id TEXT PRIMARY KEY,
  ars TEXT,
  name TEXT NOT NULL,
  lat REAL NOT NULL,
  lng REAL NOT NULL,
  district TEXT NOT NULL,
  last_measured_on TEXT,
  measure_count INTEGER NOT NULL DEFAULT 0
);

-- 순환과 상관없이 매일 켜 두는 정류소 (오너가 쓰는 4곳).
CREATE TABLE IF NOT EXISTS pinned_stops (
  node_id TEXT PRIMARY KEY,
  name TEXT NOT NULL
);

-- 아침 Cron이 하루에 한 행씩 남긴다. *_max_id는 그 시각의 테이블별 최대 id라서
-- 다음 날 차이가 하루 동안 수집기가 쓴 행 수다(안전 밸브가 본다).
CREATE TABLE IF NOT EXISTS rotation_days (
  day TEXT PRIMARY KEY,
  district TEXT NOT NULL,
  stop_count INTEGER NOT NULL,
  rotating_count INTEGER NOT NULL,
  errors_max_id INTEGER NOT NULL,
  arrivals_max_id INTEGER NOT NULL,
  collector_errors_max_id INTEGER NOT NULL,
  rows_written_prev INTEGER,
  created_at TEXT NOT NULL
);

-- 정류소 × 리드 버킷별 오차 히스토그램. bins = JSON 배열 [아래 넘침, 10초 칸 240개(-1200..1200초), 위 넘침].
-- 칸 수를 더하기만 하면 되므로 날마다 정확히 합쳐진다.
CREATE TABLE IF NOT EXISTS margin_hist (
  node_id TEXT NOT NULL,
  lead_bucket_min INTEGER NOT NULL,
  n INTEGER NOT NULL,
  bins TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (node_id, lead_bucket_min)
);

-- 밤 접기가 어디까지 읽었는지 (prediction_errors.id). 한 행만 쓴다.
CREATE TABLE IF NOT EXISTS fold_state (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  last_error_id INTEGER NOT NULL,
  folded_at TEXT NOT NULL
);
