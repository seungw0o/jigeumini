import { leaveLabel } from "@/utils/format";
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
  route: Pick<TransitRoute, "leaveInMinutes">;
  size?: keyof typeof SIZE;
}) {
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-sm bg-brand font-bold whitespace-nowrap text-ink tabular ${SIZE[size]}`}
    >
      {leaveLabel(route)}
    </span>
  );
}
