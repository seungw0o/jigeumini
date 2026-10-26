// 카카오 경로의 정류장(이름만 있음)을 대전 BIS 정류장 ID로 잇는 순수 함수.
// 방법: 카카오 BUS 구간의 첫 정류장 이름과 path 첫 좌표를 기준으로, TAGO 주변 정류장 중
// 이름이 같은(공백 무시) 정류장 가운데 가장 가까운 것을 고른다. 같은 이름의 길 건너편 정류장
// (예: 대덕대학교 43420 약 4m vs 43430 약 71m)은 거리로 갈린다.

import type { LatLng } from "@/utils/types";
import { haversineMeters } from "./geo";
import { routeNoKey } from "../shared/region";
import type { DaejeonArrival } from "./daejeon/types";
import type { KakaoTransitStep } from "./kakao/types";
import { toDaejeonNodeId } from "./tago/ids";
import type { TagoStop } from "./tago/types";

/** 이보다 먼 같은 이름 정류장은 다른 정류장으로 본다(m) */
export const DEFAULT_MAX_MATCH_DISTANCE_M = 150;

export interface StopTarget {
  name: string;
  position: LatLng;
}

export interface StopMatch {
  tagoNodeId: string;
  /** 대전 BUS_NODE_ID, getArrivalsByStopId에 그대로 넣는다 */
  daejeonNodeId: string;
  arsId: string | null;
  name: string;
  distanceM: number;
}

export function normalizeStopName(name: string): string {
  return name.replace(/\s+/g, "");
}

/** BUS 구간의 승차 정류장 기준점: 첫 정류장 이름 + path 첫 좌표 */
export function boardingTargetOf(step: Pick<KakaoTransitStep, "stopNames" | "path">): StopTarget | null {
  const name = step.stopNames[0];
  const position = step.path[0];
  return name && position ? { name, position } : null;
}

/** BUS 구간의 하차 정류장 기준점: 마지막 정류장 이름 + path 마지막 좌표 */
export function alightingTargetOf(step: Pick<KakaoTransitStep, "stopNames" | "path">): StopTarget | null {
  const name = step.stopNames.at(-1);
  const position = step.path.at(-1);
  return name && position ? { name, position } : null;
}

/** 지역 정류장 후보. stopId는 지역이 붙은 ID(서울 "seoul:<ARS>") */
export interface StopCandidate {
  stopId: string;
  arsId: string | null;
  name: string;
  position: LatLng;
}

/** 서울 정류장 이름 비교용: 카카오는 "서울역버스환승센터(5번승강장)(중)"처럼 괄호를 붙이고 서울 API는 "서울역버스환승센터"로 준다 */
export function normalizeSeoulStopName(name: string): string {
  return normalizeStopName(name.replace(/\([^)]*\)/g, ""));
}

/** 이름이 같고 maxDistanceM 안에 있는 후보를 가까운 순으로 */
export function sameNameCandidates(
  target: StopTarget,
  candidates: StopCandidate[],
  normalize: (name: string) => string,
  maxDistanceM: number = DEFAULT_MAX_MATCH_DISTANCE_M,
): (StopCandidate & { distanceM: number })[] {
  const wanted = normalize(target.name);
  return candidates
    .filter((stop) => normalize(stop.name) === wanted)
    .map((stop) => ({ ...stop, distanceM: haversineMeters(target.position, stop.position) }))
    .filter((stop) => stop.distanceM <= maxDistanceM)
    .sort((a, b) => a.distanceM - b.distanceM);
}

/** 승강장처럼 같은 이름 정류장이 몇 m 간격으로 붙어 있으면 거리로 못 가른다(서울역버스환승센터 02003~02006, 10m 안팎).
 * 가까운 순으로 도착 정보를 보고 그 노선이 서는 첫 정류장을 고른다. 어느 곳에도 없으면(경기 버스 등) 가장 가까운 곳 */
export async function pickServedCandidate<T extends StopCandidate>(
  candidates: T[],
  routeNos: string[],
  arrivalsOf: (candidate: T) => Promise<DaejeonArrival[]>,
  maxChecks = 4,
): Promise<{ candidate: T | null; complete: boolean }> {
  let complete = true;
  for (const candidate of candidates.slice(0, maxChecks)) {
    let arrivals: DaejeonArrival[];
    try {
      arrivals = await arrivalsOf(candidate);
    } catch {
      complete = false;
      continue;
    }
    const wanted = new Set(routeNos.map((no) => routeNoKey(no, candidate.stopId)));
    if (arrivals.some((a) => wanted.has(routeNoKey(a.routeNo, candidate.stopId)))) return { candidate, complete: true };
  }
  return { candidate: candidates[0] ?? null, complete };
}

export function matchStop(
  target: StopTarget,
  candidates: TagoStop[],
  maxDistanceM: number = DEFAULT_MAX_MATCH_DISTANCE_M,
): StopMatch | null {
  const wanted = normalizeStopName(target.name);
  let best: StopMatch | null = null;
  for (const stop of candidates) {
    if (normalizeStopName(stop.name) !== wanted) continue;
    const daejeonNodeId = toDaejeonNodeId(stop.nodeId);
    if (!daejeonNodeId) continue;
    const distanceM = haversineMeters(target.position, stop.position);
    if (distanceM > maxDistanceM || (best && best.distanceM <= distanceM)) continue;
    best = { tagoNodeId: stop.nodeId, daejeonNodeId, arsId: stop.arsId, name: stop.name, distanceM };
  }
  return best;
}
