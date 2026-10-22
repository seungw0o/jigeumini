import { ChevronRightIcon } from "@/assets/icons";
import { BusNumber, StaleBadge } from "@/components/StatusChips";
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
  secondsAgo: number;
  onRefresh?: () => void;
}) {
  if (route.transferCount === 0) return null;

  const busLegs = route.legs.filter((leg): leg is BusLeg => leg.kind === "bus");
  const transfers = busLegs.slice(1).map((leg, i) => ({ prev: busLegs[i], next: leg }));

  return (
    <section aria-labelledby="transfer-panel-title" className="px-4 pt-2.5 pb-3">
      <div className="flex min-h-8 items-center justify-between gap-3">
        <h2 id="transfer-panel-title" className="truncate text-15 font-bold text-ink">
          환승 실시간
        </h2>
        <StaleBadge secondsAgo={secondsAgo} onRefresh={onRefresh} />
      </div>
      <ul className="divide-y divide-line">
        {transfers.map(({ prev, next }) => (
          <li key={`${prev.routeNo}-${next.routeNo}-${next.boardAt}`} className="py-2">
            <p className="flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-1 text-13 text-ink tabular">
              <span className="inline-flex items-center gap-1">
                <BusNumber routeNo={prev.routeNo} busType={prev.busType} size="sm" />
                <time dateTime={prev.alightAt} className="font-semibold">
                  {prev.alightAt}
                </time>
                하차
              </span>
              <ChevronRightIcon size={14} className="shrink-0 text-subtle" />
              <span className="inline-flex items-center gap-1">
                <BusNumber routeNo={next.routeNo} busType={next.busType} size="sm" />
                <time dateTime={next.boardAt} className="font-semibold">
                  {next.boardAt}
                </time>
                승차
              </span>
            </p>
            <p className="mt-1 text-13 text-muted tabular">
              {transferArrivalText(next.arrivals[next.catchIndex])} · 환승 대기 {next.waitMinutes}분
            </p>
          </li>
        ))}
      </ul>
      {route.quickTransferChance !== undefined && (
        <p className="text-xs text-muted tabular">바로 환승 확률 {route.quickTransferChance}%</p>
      )}
    </section>
  );
}

export function RideInsightPlaceholder() {
  return (
    <section aria-labelledby="ride-insight-title" className="px-4 py-3">
      <div className="rounded-md border border-dashed border-line-strong px-3 py-2.5">
        <div className="flex items-center gap-1.5">
          <h2 id="ride-insight-title" className="truncate text-13 font-semibold text-ink-2">
            탑승 중 예측
          </h2>
          <span className="inline-flex h-[18px] shrink-0 items-center rounded-[3px] bg-fill px-1 text-2xs text-muted">
            준비 중
          </span>
        </div>
        <p className="mt-0.5 text-xs text-muted">버스 평균 속도로 환승 가능성을 계산할 예정이에요.</p>
        <dl className="mt-1.5 flex flex-wrap gap-x-4 text-xs text-subtle tabular">
          <div className="flex gap-1">
            <dt>평균 속도</dt>
            <dd>
              <span aria-hidden="true">—</span>
              <span className="sr-only">준비 중</span>
            </dd>
          </div>
          <div className="flex gap-1">
            <dt>환승 가능성</dt>
            <dd>
              <span aria-hidden="true">—</span>
              <span className="sr-only">준비 중</span>
            </dd>
          </div>
        </dl>
      </div>
    </section>
  );
}
