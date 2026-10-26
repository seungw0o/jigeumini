-- 대전 전체 정류소 순환 측정과 미리 계산한 여유(히스토그램). 적용: wrangler d1 migrations apply jigeumini --local|--remote
-- 카탈로그 내용은 seeds/stop_catalog.sql로 따로 넣는다 (wrangler d1 execute jigeumini --local|--remote --file=seeds/stop_catalog.sql).
-- D1 무료 한도(하루 100,000 rows written)를 아끼려고 인덱스는 두지 않는다. 카탈로그는 3천 행이라 하루 한 번 훑어도 싸다.

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
INSERT OR IGNORE INTO pinned_stops (node_id, name) VALUES
  ('8001318', '대덕대학교 (ARS 43420, 318·604·708·912 등 6개 노선, 퇴근 탑승)'),
  ('8001568', '통계센터 (3·318·604 등 9개 노선, 퇴근 3번 환승)'),
  ('8007244', '예미지7단지 (3·123, 출근 3번 탑승)'),
  ('8002452', '은하수네거리 (ARS 32060, 예미지 방면 3번 등 9개 노선)');

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
