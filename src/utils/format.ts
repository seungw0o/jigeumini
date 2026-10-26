import type { BusType, TransitRoute } from "./types";

export function formatClock(hhmm: string): string {
  const [h, m] = hhmm.split(":").map(Number);
  const period = h < 12 ? "오전" : "오후";
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${period} ${hour12}:${String(m).padStart(2, "0")}`;
}

export function formatFare(won: number): string {
  return `${won.toLocaleString("ko-KR")}원`;
}

export function formatDistance(m: number): string {
  return m < 1000 ? `${m}m` : `${(m / 1000).toFixed(1)}km`;
}

export function formatDuration(minutes: number): string {
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

export const BUS_TYPE_META: Record<
  BusType,
  /** fg: 노선 색 위 글자 색, 없으면 흰색(--color-fg-inverse) */
  { label: string; color: string; fg?: string }
> = {
  express: { label: "급행", color: "var(--color-bus-express)" },
  trunk: { label: "간선", color: "var(--color-bus-trunk)" },
  branch: { label: "지선", color: "var(--color-bus-branch)" },
  village: { label: "마을", color: "var(--color-bus-village)" },
  outer: { label: "외곽", color: "var(--color-bus-outer)" },
  wide: { label: "광역", color: "var(--color-bus-wide)" },
  circular: { label: "순환", color: "var(--color-bus-circular)", fg: "var(--color-fg)" },
};
