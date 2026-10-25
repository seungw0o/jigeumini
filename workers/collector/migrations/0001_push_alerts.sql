-- 출발 알림(웹 푸시) 테이블. 적용: wrangler d1 migrations apply jigeumini --local|--remote
-- 기존 테이블은 schema.sql로 만들었으므로 이 마이그레이션은 새 테이블만 만든다.

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
