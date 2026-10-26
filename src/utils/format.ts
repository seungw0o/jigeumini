import { regionOf, type Region } from "../shared/region";
import type { BusLeg, BusType, TransitRoute } from "./types";

export function formatFare(won: number): string {
  return `${won.toLocaleString("ko-KR")}원`;
}

export function formatDistance(m: number): string {
  return m < 1000 ? `${m}m` : `${(m / 1000).toFixed(1)}km`;
}

function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes}분`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h}시간` : `${h}시간 ${m}분`;
}

export function isTight(route: Pick<TransitRoute, "leaveInMinutes">): boolean {
  return route.leaveInMinutes < 1;
}

export function leaveLabel(route: Pick<TransitRoute, "leaveInMinutes">): string {
  return isTight(route) ? "빠듯해요, 지금 바로 출발" : `${route.leaveInMinutes}분 안에 출발`;
}

/** 실시간 도착 정보로 대기까지 계산한 경로인지. 아니면 leaveAt은 의미가 없고 시간은 이동 시간만이다 */
export function isLiveTimed(route: Pick<TransitRoute, "realtime">): boolean {
  const state = route.realtime ?? "live";
  return state === "live" || state === "partial";
}

export function totalLabel(route: Pick<TransitRoute, "totalMinutes" | "realtime">): string {
  if (!isLiveTimed(route)) return `이동 약 ${formatDuration(route.totalMinutes)}`;
  return route.realtime === "partial"
    ? `약 ${formatDuration(route.totalMinutes)} 이상`
    : `약 ${formatDuration(route.totalMinutes)}`;
}

/** LeaveBadge 자리에 대신 보여 줄 짧은 상태. 대기까지 계산한 경로면 null */
export function realtimeBadgeLabel(route: Pick<TransitRoute, "realtime">): string | null {
  switch (route.realtime) {
    case "loading":
      return "실시간 확인 중";
    case "unavailable":
      return "실시간 정보 없음";
    case "noBus":
      return "다음 차 정보 없음";
    default:
      return null;
  }
}

/** 경로 카드와 상세에 한 줄로 붙이는 설명. 실시간 경로면 null */
export function realtimeNote(route: Pick<TransitRoute, "realtime">): string | null {
  switch (route.realtime) {
    case "unavailable":
      return "실시간 정보를 못 받았어요. 기다리는 시간 없이 이동 시간만 계산했어요";
    case "noBus":
      return "다음 차 정보가 없어요. 기다리는 시간 없이 이동 시간만 계산했어요";
    case "partial":
      return "환승 버스 실시간 정보가 없어 환승 대기는 빼고 계산했어요";
    default:
      return null;
  }
}

export const ESTIMATE_NOTE = "실시간 정보 기준 예상이에요, 교통 상황에 따라 달라질 수 있어요";

export function transferLabel(count: number): string {
  return count > 0 ? `환승 ${count}회` : "환승 없음";
}

export const BUS_TYPE_LABEL: Record<BusType, string> = {
  express: "급행",
  trunk: "간선",
  branch: "지선",
  village: "마을",
  outer: "외곽",
  wide: "광역",
  circular: "순환",
};

/** 노선 색(color)과 그 위 글자 색(fg). 칩 글자는 13px 굵게라 WCAG 4.5:1 이상인 쪽을 고른다 */
export interface BusColor {
  color: string;
  fg: string;
}

const WHITE = "#ffffff";
const BLACK = "#000000";

// 대전: 대전교통정보센터(traffic.daejeon.go.kr) 노선 유형 배지 색(.tp_ex 급행, .tp_ct 도시, .tp_arnd 외곽, .tp_town 마을, .tp_mtr 광역).
// 지선은 공식 색 값이 없어 예전 초록을 그대로 쓰고, 순환은 대전에 없어 간선 색을 쓴다.
// 서울: 서울시 TOPIS(topis.seoul.go.kr) 노선 유형 색(routeType 3 간선, 4 지선, 5 순환, 6 광역, 8 경기).
// 마을은 서울시 안내(차량 Green)대로 지선 초록, 서울에 없는 급행은 광역 빨강, 외곽은 경기 주황을 쓴다.
export const BUS_COLORS: Record<Region, Record<BusType, BusColor>> = {
  daejeon: {
    express: { color: "#d10000", fg: WHITE },
    trunk: { color: "#0071c2", fg: WHITE },
    branch: { color: "#1f9a45", fg: BLACK },
    village: { color: "#3d8f14", fg: BLACK },
    outer: { color: "#ecb700", fg: BLACK },
    wide: { color: "#e5732e", fg: BLACK },
    circular: { color: "#0071c2", fg: WHITE },
  },
  seoul: {
    express: { color: "#bd1d1e", fg: WHITE },
    trunk: { color: "#4569cf", fg: WHITE },
    branch: { color: "#46ae1d", fg: BLACK },
    village: { color: "#46ae1d", fg: BLACK },
    outer: { color: "#f7941d", fg: BLACK },
    wide: { color: "#bd1d1e", fg: WHITE },
    circular: { color: "#ca9300", fg: BLACK },
  },
};

/** 지역을 모르면(서비스 지역 밖) 대전 색을 쓴다 */
export function busColor(busType: BusType, region: Region | null): BusColor {
  return BUS_COLORS[region ?? "daejeon"][busType];
}

/** 버스 구간의 지역은 승차 정류장 좌표로 정한다 */
export function legBusColor(leg: Pick<BusLeg, "busType" | "boardStop">): BusColor {
  return busColor(leg.busType, regionOf(leg.boardStop.position));
}
