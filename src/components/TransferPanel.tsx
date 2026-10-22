import { ChevronRightIcon } from "@/assets/icons";
import { StaleBadge } from "@/components/StatusChips";
import type { BusArrival, BusLeg, TransitRoute } from "@/utils/types";

function transferArrivalText(arrival: BusArrival | undefined): string {
  const status = arrival?.status;
  if (!status || status.kind === "ended") return "환승 버스 운행 종료";
  if (status.kind === "garage") return `환승 버스 ${status.departAt} 출발 예정`;
  return `환승 버스 도착까지 ${status.minutes}분`;
}

export function TransferPanel({
  route,
  secondsAgo,
  onRefresh,
}: {
  route: TransitRoute;
  /** 실시간 정보 갱신 후 경과 초 */
  secondsAgo: number;
  onRefresh?: () => void;
}) {
  if (route.transferCount === 0) return null;

  const busLegs = route.legs.filter((leg): leg is BusLeg => leg.kind === "bus");
  const transfers = busLegs.slice(1).map((leg, i) => ({ prev: busLegs[i], next: leg }));

  return (
    <section aria-labelledby="transfer-panel-title" className="border-y border-line py-3">
      <div className="flex min-h-11 items-center justify-between gap-3">
        <h2 id="transfer-panel-title" className="truncate text-base font-semibold text-ink">
          환승 실시간
        </h2>
        <StaleBadge secondsAgo={secondsAgo} onRefresh={onRefresh} />
      </div>
      <ul className="divide-y divide-line">
        {transfers.map(({ prev, next }) => (
          <li key={`${prev.routeNo}-${next.routeNo}-${next.boardAt}`} className="py-2.5">
            <p className="flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-0.5 text-base text-ink tabular">
              <span className="min-w-0">
                <span className="font-semibold">{prev.routeNo}번</span> 하차{" "}
                <time dateTime={prev.alightAt} className="font-semibold">
                  {prev.alightAt}
                </time>
              </span>
              <ChevronRightIcon size={16} className="shrink-0 text-muted" />
              <span className="min-w-0">
                <span className="font-semibold">{next.routeNo}번</span> 도착{" "}
                <time dateTime={next.boardAt} className="font-semibold">
                  {next.boardAt}
                </time>
              </span>
            </p>
            <p className="mt-0.5 text-sm text-ink-2 tabular">
              {transferArrivalText(next.arrivals[next.catchIndex])} · 환승 대기 {next.waitMinutes}분
            </p>
          </li>
        ))}
      </ul>
      {route.quickTransferChance !== undefined && (
        <p className="text-xs text-muted tabular">바로 환승 {route.quickTransferChance}%</p>
      )}
    </section>
  );
}

export function RideInsightPlaceholder() {
  return (
    <section aria-labelledby="ride-insight-title" className="border-t border-line py-4">
      <div className="flex items-center gap-2">
        <h2 id="ride-insight-title" className="truncate text-base font-semibold text-ink">
          탑승 중 예측
        </h2>
        <span className="inline-flex h-5 shrink-0 items-center rounded-sm border border-line px-1.5 text-xs text-muted">
          준비 중
        </span>
      </div>
      <p className="mt-1 text-sm text-muted">버스 평균 속도로 환승 가능성을 계산하는 기능을 준비하고 있어요.</p>
      <dl className="mt-3 grid grid-cols-2 divide-x divide-line rounded-md border border-dashed border-line-strong">
        <div className="min-w-0 px-3 py-2.5">
          <dt className="truncate text-xs text-muted">평균 속도</dt>
          <dd className="text-base text-muted tabular">
            <span aria-hidden="true">—</span>
            <span className="sr-only">준비 중</span>
          </dd>
        </div>
        <div className="min-w-0 px-3 py-2.5">
          <dt className="truncate text-xs text-muted">환승 가능성</dt>
          <dd className="text-base text-muted tabular">
            <span aria-hidden="true">—</span>
            <span className="sr-only">준비 중</span>
          </dd>
        </div>
      </dl>
    </section>
  );
}
