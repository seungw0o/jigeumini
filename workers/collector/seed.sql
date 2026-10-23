-- 감시 정류소. node_id = 대전 BUS_NODE_ID (TAGO nodeid에서 DJB를 뺀 값). 노선 수는 TAGO getSttnThrghRouteList 2026-10-23 기준.
-- 바꿀 때: wrangler d1 execute jigeumini --remote --command "UPDATE watched_stops SET enabled = 0 WHERE node_id = '...'"
INSERT OR IGNORE INTO watched_stops (node_id, name, enabled, created_at) VALUES
  ('8001318', '대덕대학교 (ARS 43420, 318·604·708·912 등 6개 노선, 퇴근 탑승)', 1, '2026-10-23T10:00:00+09:00'),
  ('8001568', '통계센터 (3·318·604 등 9개 노선, 퇴근 3번 환승)', 1, '2026-10-23T10:40:00+09:00'),
  ('8007244', '예미지7단지 (3·123, 출근 3번 탑승)', 1, '2026-10-23T10:40:00+09:00'),
  ('8002452', '은하수네거리 (ARS 32060, 예미지 방면 3번 등 9개 노선)', 1, '2026-10-23T10:40:00+09:00');
-- 2026-10-23 오너 요청으로 아래 거점 정류소는 끔 (원격 D1에서 enabled = 0)
-- 8002412 유성온천역7번출구, 8001412 대전역/역전시장, 8001934 서대전역네거리
