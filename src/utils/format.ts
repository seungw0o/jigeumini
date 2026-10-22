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

export function totalLabel(route: Pick<TransitRoute, "totalMinutes">): string {
  return `약 ${formatDuration(route.totalMinutes)}`;
}

export const ESTIMATE_NOTE = "실시간 정보 기준 예상이에요, 교통 상황에 따라 달라질 수 있어요";

export function transferLabel(count: number): string {
  return count > 0 ? `환승 ${count}회` : "환승 없음";
}

export const BUS_TYPE_META: Record<
  BusType,
  { label: string; color: string }
> = {
  express: { label: "급행", color: "var(--color-bus-express)" },
  trunk: { label: "간선", color: "var(--color-bus-trunk)" },
  branch: { label: "지선", color: "var(--color-bus-branch)" },
  village: { label: "마을", color: "var(--color-bus-village)" },
  outer: { label: "외곽", color: "var(--color-bus-outer)" },
};
