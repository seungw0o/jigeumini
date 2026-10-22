import { NotifyButton } from "@/components/NotifyButton";
import { SegmentBar } from "@/components/SegmentBar";
import { StaleBadge } from "@/components/StatusChips";
import { formatFare } from "@/utils/format";
import type { NotifyState, TransitRoute } from "@/utils/types";

export function RouteSummary({
  route,
  secondsAgo,
  onRefresh,
  notifyState,
  onNotifyChange,
}: {
  route: TransitRoute;
  /** 실시간 정보 갱신 후 경과 초 */
  secondsAgo: number;
  onRefresh: () => void;
  notifyState: NotifyState;
  onNotifyChange: (next: NotifyState) => void;
}) {
  const transfer = route.transferCount > 0 ? `환승 ${route.transferCount}회` : "환승 없음";

  return (
    <section aria-labelledby="route-summary-title" className="px-4 pt-1 pb-4 lg:pt-5">
      <h1 id="route-summary-title" className="flex items-end justify-between gap-3">
        {route.leaveInMinutes <= 0 ? (
          <span className="text-[32px] leading-none font-bold text-accent">지금 출발</span>
        ) : (
          <span className="flex items-baseline gap-1 text-accent">
            <span className="text-[32px] leading-none font-bold tabular">{route.leaveInMinutes}</span>
            <span className="text-base font-semibold whitespace-nowrap">분 뒤 출발</span>
          </span>
        )}
        <span className="flex shrink-0 items-baseline gap-1.5">
          <span className="text-sm text-muted">도착</span>
          <span className="text-[32px] leading-none font-bold text-ink tabular">{route.arriveAt}</span>
        </span>
      </h1>
      <p className="mt-2 text-sm text-muted tabular">
        지금 출발 기준 총 {route.totalMinutes}분 · 이동 {route.travelMinutes}분 + 대기{" "}
        {route.waitMinutes + route.marginMinutes}분 · {formatFare(route.fare)} · {transfer}
      </p>

      <div className="mt-4">
        <SegmentBar legs={route.legs} showRouteNumbers />
      </div>

      <div className="mt-3 flex min-h-11 items-center justify-between gap-3">
        <StaleBadge secondsAgo={secondsAgo} onRefresh={onRefresh} />
        <NotifyButton state={notifyState} onChange={onNotifyChange} />
      </div>
    </section>
  );
}
