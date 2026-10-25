// 우리 Route Handler(/api/*)와 브라우저 사이에서 오가는 응답 모양. server-only가 아니라 클라이언트에서도 import한다.

import type { BusType, LatLng, Place } from "../../utils/types";
import type { DaejeonArrival } from "../daejeon/types";
import type { ApiErrorCode } from "../errors";

export interface LiveError {
  /** ApiErrorCode, 또는 FORCED(?fail= QA 플래그), NO_MATCH(정류장 매칭 실패), BAD_REQUEST */
  code: ApiErrorCode | "FORCED" | "NO_MATCH" | "BAD_REQUEST";
  message: string;
}

/** GET /api/places?q=&lat=&lng= */
export interface PlacesResponse {
  places: Place[];
}

export interface RouteEnd {
  name: string;
  position: LatLng;
}

export interface PlannedStop {
  name: string;
  /** 카카오 path에서 이 정류장 위치(승차는 첫 점, 하차는 마지막 점) */
  position: LatLng;
  /** TAGO 매칭으로 찾은 대전 BUS_NODE_ID. 매칭 실패면 null */
  nodeId: string | null;
  arsId: string | null;
}

export interface PlannedWalkLeg {
  kind: "walk";
  seconds: number;
  distanceM: number;
  from: string;
  to: string;
  path: LatLng[];
}

export interface PlannedBusLeg {
  kind: "bus";
  /** 이 구간을 같이 다니는 노선 번호들(카카오 vehicles 순서). [0]이 기본 표시 노선 */
  routeNos: string[];
  /** 카카오 vehicle type으로 추정한 유형. 실시간 도착 정보의 ROUTE_TP가 있으면 그쪽이 우선 */
  busType: BusType;
  seconds: number;
  distanceM: number;
  stopCount: number;
  board: PlannedStop;
  alight: PlannedStop;
  path: LatLng[];
}

export type PlannedLeg = PlannedWalkLeg | PlannedBusLeg;

/** 카카오 경로 하나. 분 단위로 바뀌지 않으니 세션 동안 캐시한다 */
export interface PlannedRoute {
  /** 같은 출발/도착 검색 안에서 안정적인 id ("l0", "l1", ... 카카오 순서) */
  id: string;
  fare: number;
  transferCount: number;
  totalSeconds: number;
  legs: PlannedLeg[];
}

/** GET /api/routes?from=lat,lng&fromName=&to=lat,lng&toName= */
export interface RoutePlan {
  origin: RouteEnd;
  destination: RouteEnd;
  routes: PlannedRoute[];
}

export type StopArrivals = { ok: true; arrivals: DaejeonArrival[] } | { ok: false; error: LiveError };

/** GET /api/arrivals?stops=8001318,8001319 */
export interface ArrivalsResponse {
  /** 서버가 대전 BIS에 물어본 시각(ISO). ETA는 이 시각부터 센다 */
  fetchedAt: string;
  /** 대전 BUS_NODE_ID별 결과. 정류장 하나가 실패해도 나머지는 온다 */
  stops: Record<string, StopArrivals>;
}

export interface LiveErrorResponse {
  error: LiveError;
}
