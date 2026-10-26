import "server-only";

import type { LatLng } from "@/utils/types";
import type { DaejeonArrival } from "../daejeon/types";
import { readKey } from "../http.server";
import { createArrivalsCache } from "../live/arrivalsCache";
import { fetchSeoulArrivals, fetchSeoulStations, type SeoulStation } from "./parse";

// 개발 계정은 서비스별 하루 1,000회라 정류장마다 25초 동안 한 번만 묻는다(화면은 25초마다 새로 고친다)
const SEOUL_ARRIVALS_TTL_MS = 25_000;

const arrivalsCache = createArrivalsCache({
  ttlMs: SEOUL_ARRIVALS_TTL_MS,
  load: (arsId) => fetchSeoulArrivals(readKey("DATA_GO_KR_KEY", "seoul"), arsId, { timeoutMs: 4000 }),
});

export function getSeoulArrivals(arsId: string): Promise<DaejeonArrival[]> {
  return arrivalsCache.get(arsId);
}

// 정류장은 움직이지 않으니 같은 좌표 주변 정류장 목록은 프로세스가 살아 있는 동안 한 번만 묻는다.
// 한 경로 검색 안에서도 같은 승차 지점이 노선별로 여러 번 나와서(2026-10-26 서울역→강남역 실측: 9회 중 서로 다른 좌표 6곳) 진행 중인 요청을 같이 기다린다.
const stationsMemo = new Map<string, Promise<SeoulStation[]>>();
const STATIONS_MEMO_LIMIT = 2000;

export function getSeoulStationsNear(position: LatLng, radiusM: number): Promise<SeoulStation[]> {
  const key = `${position.lat.toFixed(5)},${position.lng.toFixed(5)}@${radiusM}`;
  const cached = stationsMemo.get(key);
  if (cached) return cached;
  if (stationsMemo.size >= STATIONS_MEMO_LIMIT) stationsMemo.clear();
  const pending = fetchSeoulStations(readKey("DATA_GO_KR_KEY", "seoul"), position, radiusM, { timeoutMs: 4000 });
  stationsMemo.set(key, pending);
  pending.catch(() => {
    if (stationsMemo.get(key) === pending) stationsMemo.delete(key);
  });
  return pending;
}
