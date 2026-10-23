-- 감시 정류소. node_id = 대전 BUS_NODE_ID (TAGO nodeid에서 DJB를 뺀 값). 노선 수는 TAGO getSttnThrghRouteList 2026-10-23 기준.
-- 바꿀 때: wrangler d1 execute jigeumini --remote --command "UPDATE watched_stops SET enabled = 0 WHERE node_id = '...'"
INSERT OR IGNORE INTO watched_stops (node_id, name, enabled, created_at) VALUES
  ('8001318', '대덕대학교 (ARS 43420, 6개 노선)', 1, '2026-10-23T10:00:00+09:00'),
  ('8002412', '유성온천역7번출구 (ARS 41330, 20개 노선)', 1, '2026-10-23T10:00:00+09:00'),
  ('8001412', '대전역/역전시장 (ARS 10040, 17개 노선)', 1, '2026-10-23T10:00:00+09:00'),
  ('8001934', '서대전역네거리 (ARS 22040, 16개 노선)', 1, '2026-10-23T10:00:00+09:00');
