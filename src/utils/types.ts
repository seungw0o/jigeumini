// 도메인 타입. 실제 API 매핑 결과가 이 모양을 따른다.
// 시간 문자열은 모두 "HH:MM" (24시간제, Asia/Seoul).

export type LatLng = { lat: number; lng: number };

export interface Place {
  id: string;
  name: string;
  address: string;
  category: string;
  position: LatLng;
  /** 현재 위치 기준 직선 거리(m). 위치 권한이 없으면 없음 */
  distanceM?: number;
}

/** 버스 유형. 대전: 급행 / 간선 / 지선 / 마을 / 외곽, 서울은 간선 / 지선 / 마을에 광역(wide) / 순환(circular)이 더 있다 */
export type BusType = "express" | "trunk" | "branch" | "village" | "outer" | "wide" | "circular";

export interface BusStop {
  id: string;
  name: string;
  /** 정류장 ARS 번호 (5자리) */
  arsId: string;
  position: LatLng;
}

/** 정류장에 오는 버스 한 대의 상태 */
export type ArrivalStatus =
  /** 운행 중: N분 뒤 도착, N정류장 전 */
  | { kind: "live"; minutes: number; stopsAway: number }
  /** 차고지 대기: 분 대신 예정 출발 시각 */
  | { kind: "garage"; departAt: string }
  /** 운행 종료 */
  | { kind: "ended" };

export interface BusArrival {
  routeNo: string;
  busType: BusType;
  status: ArrivalStatus;
  /** 첫차 / 막차 표시 */
  runLabel?: "first" | "last";
}

export interface WalkLeg {
  kind: "walk";
  minutes: number;
  distanceM: number;
  /** 출발 지점 이름 (장소 또는 정류장) */
  from: string;
  to: string;
}

export interface BusLeg {
  kind: "bus";
  routeNo: string;
  busType: BusType;
  boardStop: BusStop;
  alightStop: BusStop;
  stopCount: number;
  rideMinutes: number;
  /** 승차 정류장에 오는 이 노선 버스들, 가까운 순. [0]이 탈 버스 */
  arrivals: BusArrival[];
  /** 걸어서 정류장에 도착한 시점에 [0] 버스를 놓치는 경우: 실제로 탈 버스의 arrivals 인덱스 */
  catchIndex: number;
  /** 정류장 도착 ~ 버스 도착 사이 대기(분) */
  waitMinutes: number;
  /** 이 버스 탑승 예정 시각 */
  boardAt: string;
  alightAt: string;
  /** 실시간 기준이 아닌 구간이면 그 이유. 없으면 실시간(목 데이터 포함). boardAt은 정류장 도착 시각(대기 0)으로 둠다 */
  liveIssue?: LegLiveIssue;
}

/** unavailable: 도착 정보를 못 받음(실패, 정류장 매칭 실패) / noBus: 받았지만 탈 수 있는 이 노선 버스가 목록에 없음 */
export type LegLiveIssue = "unavailable" | "noBus";

/**
 * 경로 전체의 실시간 상태. 없으면 "live"(목 데이터).
 * live: 모든 버스가 실시간 기준 / partial: 첫 버스는 실시간, 환승 버스 대기를 모름(도착은 그보다 늦을 수 있음)
 * loading: 도착 정보 받는 중 / unavailable: 첫 버스 도착 정보를 못 받음 / noBus: 첫 버스 다음 차 정보 없음.
 * live/partial이 아니면 leaveAt·leaveInMinutes는 의미가 없고, totalMinutes·arriveAt은 대기 없는 이동 시간 기준이다.
 */
export type RealtimeState = "live" | "partial" | "loading" | "unavailable" | "noBus";

export type Leg = WalkLeg | BusLeg;

export interface TransitRoute {
  id: string;
  /** 여유를 미리 뺀 출발 시각(이 시각 전에 나서면 된다)과 지금부터 남은 분. 1 미만이면 빠듯함 */
  leaveAt: string;
  leaveInMinutes: number;
  /** 대기 포함 도착 예상 시각 */
  arriveAt: string;
  /** 지금부터 도착까지 (대기 + 여유 포함) */
  totalMinutes: number;
  /** 지도앱이 보여주는 순수 이동 시간 (도보 + 탑승) */
  travelMinutes: number;
  /** 정류장 대기 합계 */
  waitMinutes: number;
  /** 출발 시각에 미리 넣어 둔 여유(분). 정류장에 그만큼 일찍 도착한다 */
  marginMinutes: number;
  fare: number;
  transferCount: number;
  legs: Leg[];
  /** 환승 경로에서 "바로 환승" 확률 (0~100). 보조 정보, 없으면 숨김 */
  quickTransferChance?: number;
  /** 지도에 그릴 좌표열. legs와 같은 순서, leg마다 하나 */
  path: LatLng[][];
  /** 없으면 "live" */
  realtime?: RealtimeState;
}

export type NotifyState = "idle" | "on" | "denied";

/** 경로 목록 정렬 기준 */
export type RouteSortKey = "arrival" | "walk" | "transfer";

/** 지도에 그리는 선 하나. 버스 구간이면 label(노선 번호)을 말풍선으로 띄운다 */
export interface MapPath {
  points: LatLng[];
  color: string;
  kind: "walk" | "bus";
  label?: string;
  /** label 글자 색. 없으면 흰색 */
  labelColor?: string;
}

export type MarkerTone = "origin" | "destination" | "stop" | "transfer" | "current" | "place" | "favorite";

export interface MapMarker {
  id: string;
  position: LatLng;
  label?: string;
  tone: MarkerTone;
}

/** 타임 리본 구간: 출발 전 / 도보 / 첫 정류장 여유 / 환승 대기 / 탑승 */
export type RibbonSegmentKind = "before" | "walk" | "stop" | "transfer" | "bus";

/** 지금부터 도착까지 시간축 위의 한 구간. start/end는 "HH:MM" */
export interface RibbonSegment {
  kind: RibbonSegmentKind;
  start: string;
  end: string;
  minutes: number;
  /** bus 구간만 */
  routeNo?: string;
  busType?: BusType;
  /** stop / transfer 구간만: 기다리는 정류장 */
  stopName?: string;
}

/** 시간축 위의 사건. offset은 지금부터 지난 분 */
export interface RibbonMark {
  kind: "now" | "leave" | "board" | "arrive";
  time: string;
  offset: number;
  /** board만 */
  routeNo?: string;
}

export interface Ribbon {
  now: string;
  segments: RibbonSegment[];
  marks: RibbonMark[];
  /** 지금부터 도착까지 (segments minutes 합) */
  totalMinutes: number;
}
