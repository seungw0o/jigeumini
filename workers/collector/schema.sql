-- 대전 BIS 도착 예측 오차 수집. 적용: wrangler d1 execute jigeumini --local|--remote --file=schema.sql
-- D1 무료 한도(하루 100,000 rows written, 인덱스 갱신과 DELETE 포함) 때문에 인덱스는 꼭 필요한 것만 둔다.

CREATE TABLE IF NOT EXISTS watched_stops (
  node_id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS observations (
  id INTEGER PRIMARY KEY,
  node_id TEXT NOT NULL,
  route_no TEXT NOT NULL,
  route_cd TEXT NOT NULL,
  plate_no TEXT,
  observed_at TEXT NOT NULL,
  info_at TEXT,
  msg_tp TEXT NOT NULL,
  eta_seconds INTEGER,
  stops_away INTEGER
);
CREATE INDEX IF NOT EXISTS observations_node_observed ON observations (node_id, observed_at);

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
