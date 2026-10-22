import type { LatLng } from "@/utils/types";

/** 대전 ROUTE_TP 1 급행 2 간선 3 지선 4 외곽 5 마을 6 첨단. UI의 BusType에는 첨단이 없어서 따로 둔다 */
export type BusRouteType = "express" | "trunk" | "branch" | "outer" | "village" | "advanced" | "unknown";

/** MSG_TP 01 도착, 02 출발, 03 N분 후 도착, 04 교차로 통과, 06 진입 중 */
export type ApproachPhase = "arrived" | "departed" | "minutesAway" | "passingIntersection" | "entering";

export type ArrivalState =
  | { kind: "approaching"; phase: ApproachPhase; etaSeconds: number; stopsAway: number }
  /** MSG_TP 07 차고지 운행 대기. scheduledDeparture는 "HH:MM", 읽을 수 없으면 null */
  | { kind: "waitingAtDepot"; scheduledDeparture: string | null }
  | { kind: "unknown"; msgType: string };

/** LAST_CAT 1 첫차 2 막차 3 일반. 차고지 대기에서 0이 오기도 해서(관측) 그때는 null */
export type RunType = "first" | "last" | "normal";

export interface DaejeonArrival {
  routeCd: string;
  routeNo: string;
  routeType: BusRouteType;
  destination: string;
  /** 정류소 BUS_NODE_ID (7자리, TAGO nodeid에서 DJB를 뺀 값) */
  stopNodeId: string;
  arsId: string;
  stopName: string;
  plateNo: string | null;
  lastStopNodeId: string | null;
  runType: RunType | null;
  state: ArrivalState;
  /** 정보 제공 시각, ISO 8601 +09:00 */
  infoAt: string | null;
}

export interface DaejeonBusPosition {
  routeCd: string;
  plateNo: string;
  /** 마지막으로 지난 정류소 BUS_NODE_ID */
  nodeId: string;
  arsId: string;
  position: LatLng;
  /** DIR 원값 (0/1, 의미는 문서화되지 않음) */
  direction: number | null;
  /** EVT_CD 1 주기 위치, 2 정류소/노드 통과 */
  event: "periodic" | "stop" | "unknown";
  /** ARR_TIME, ISO 8601 +09:00 */
  passedAt: string | null;
  /** STRE_DT, ISO 8601 +09:00 */
  storedAt: string | null;
  totalDistanceM: number | null;
}
