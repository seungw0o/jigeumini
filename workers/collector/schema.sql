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
