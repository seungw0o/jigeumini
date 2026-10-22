import { isTight, leaveLabel, realtimeBadgeLabel } from "@/utils/format";
import type { TransitRoute } from "@/utils/types";

const SIZE = {
  sm: "h-6 px-2 text-xs",
  md: "h-7 px-2.5 text-xs",
  lg: "h-7 px-3 text-sm",
} as const;

export function LeaveBadge({
  route,
  size = "md",
}: {
  route: Pick<TransitRoute, "leaveInMinutes" | "realtime">;
  size?: keyof typeof SIZE;
}) {
  const status = realtimeBadgeLabel(route);
  const tone = status
    ? "bg-surface-muted text-realtime-missing"
    : isTight(route)
      ? "bg-status-tight-soft text-status-tight"
      : "bg-brand text-fg";
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full font-bold whitespace-nowrap tabular ${tone} ${SIZE[size]}`}
    >
      {status ?? leaveLabel(route)}
    </span>
  );
}
