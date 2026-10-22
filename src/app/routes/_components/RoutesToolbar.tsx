import { StaleBadge } from "@/components/StatusChips";

export function RoutesToolbar({
  baseTime,
  secondsAgo,
  onRefresh,
}: {
  baseTime: string;
  secondsAgo: number;
  onRefresh?: () => void;
}) {
  return (
    <div className="sticky top-0 z-10 flex h-12 items-center justify-between gap-3 border-b border-line bg-surface px-4">
      <h2 className="shrink-0 text-sm font-semibold text-ink">빨리 도착하는 순</h2>
      <div className="flex min-w-0 items-center gap-2">
        <span className="truncate text-sm text-muted tabular max-[359px]:hidden">기준 {baseTime}</span>
        <StaleBadge secondsAgo={secondsAgo} onRefresh={onRefresh} />
      </div>
    </div>
  );
}
