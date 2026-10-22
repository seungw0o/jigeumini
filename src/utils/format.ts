import type { BusType } from "./types";

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
