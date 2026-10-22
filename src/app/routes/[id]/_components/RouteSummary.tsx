import { SegmentBar } from "@/components/SegmentBar";
import { StaleBadge } from "@/components/StatusChips";
import { formatClock, formatFare, leaveLabel, transferLabel } from "@/utils/format";
import type { BusLeg, TransitRoute } from "@/utils/types";

function Divider() {
  return <span aria-hidden="true" className="h-3 w-px shrink-0 bg-line-strong" />;
}

function busSummary(route: TransitRoute): string {
  const routeNos = route.legs.filter((leg): leg is BusLeg => leg.kind === "bus").map((leg) => `${leg.routeNo}번`);
  return routeNos.length > 0 ? routeNos.join(" → ") : "도보";
}

export function RouteSummary({
  route,
  best,
  baseTime,
  secondsAgo,
  onRefresh,
}: {
  route: TransitRoute;
  best: boolean;
  baseTime: string;
  secondsAgo: number;
  onRefresh: () => void;
}) {
  return (
    <section aria-labelledby="route-summary-title">
      <div className="px-4 pt-2 pb-4 lg:pt-4">
        <div className="flex min-h-5 items-center justify-between gap-3">
          <p className="truncate text-13 font-bold text-ink tabular">{best ? "최적" : busSummary(route)}</p>
          <StaleBadge secondsAgo={secondsAgo} onRefresh={onRefresh} />
        </div>
        <h1 id="route-summary-title" className="mt-0.5 flex flex-wrap items-baseline gap-x-2">
          <span className="text-ink tabular">
            <span className="text-[26px] leading-8 font-bold">{route.totalMinutes}</span>
            <span className="text-base font-semibold">분</span>
          </span>
          <span className="text-15 font-bold text-accent">{leaveLabel(route)}</span>
        </h1>
        <p className="mt-1 flex flex-wrap items-center gap-x-2 text-13 text-muted tabular">
          <span>
            {formatClock(route.leaveAt)} - {formatClock(route.arriveAt)}
          </span>
          <Divider />
          <span>{formatFare(route.fare)}</span>
          <Divider />
          <span>{transferLabel(route.transferCount)}</span>
        </p>
        <div className="mt-3">
          <SegmentBar legs={route.legs} showRouteNumbers />
        </div>
      </div>
      <p className="border-y border-line px-4 py-3 text-13 text-muted tabular">
        {formatClock(baseTime)} 기준 (출발 대기 {Math.max(route.leaveInMinutes, 0)}분)
      </p>
    </section>
  );
}
