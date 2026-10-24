// TAGO와 대전 BIS의 ID 변환. 2026-10-22 실호출로 확인: DJB8001318 -> BUS_NODE_ID 8001318 (ARS 43420),
// DJB30300062 -> ROUTE_CD 30300062 (318번). 대전(DJB) ID가 아니면 null.

const DAEJEON_PREFIX = "DJB";

function stripDaejeonPrefix(tagoId: string): string | null {
  const id = tagoId.trim();
  if (!id.startsWith(DAEJEON_PREFIX)) return null;
  const rest = id.slice(DAEJEON_PREFIX.length);
  return /^\d+$/.test(rest) ? rest : null;
}

export function toDaejeonNodeId(tagoNodeId: string): string | null {
  return stripDaejeonPrefix(tagoNodeId);
}

export function toDaejeonRouteCd(tagoRouteId: string): string | null {
  return stripDaejeonPrefix(tagoRouteId);
}
