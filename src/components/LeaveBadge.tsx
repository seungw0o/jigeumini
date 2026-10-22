import { leaveLabel, realtimeBadgeLabel } from "@/utils/format";
import type { TransitRoute } from "@/utils/types";

const SIZE = {
  sm: "h-5 px-1.5 text-xs",
  md: "h-6 px-2 text-13",
  lg: "h-7 px-2 text-15",
} as const;

export function LeaveBadge({
  route,
  size = "md",
}: {
  route: Pick<TransitRoute, "leaveInMinutes" | "realtime">;
  size?: keyof typeof SIZE;
}) {
  const status = realtimeBadgeLabel(route);
  const tone = status ? "bg-fill text-ink-2" : "bg-brand text-ink";
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-sm font-bold whitespace-nowrap tabular ${tone} ${SIZE[size]}`}
    >
      {status ?? leaveLabel(route)}
    </span>
  );
}
