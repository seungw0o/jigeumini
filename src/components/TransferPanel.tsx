import { ChevronRightIcon } from "@/assets/icons";
import { BusNumber, garageDepartLabel, LIVE_ISSUE_LABEL, StaleBadge } from "@/components/StatusChips";
import { isLiveTimed } from "@/utils/format";
import { formatShortClock } from "@/utils/ribbon";
import type { BusLeg, TransitRoute } from "@/utils/types";

function arrivalText(leg: BusLeg, prefix: string, route: TransitRoute): string {
  const name = `${prefix}${leg.routeNo}번`;
  if (leg.liveIssue) return `${name} ${LIVE_ISSUE_LABEL[leg.liveIssue]}`;
  const status = leg.arrivals[leg.catchIndex]?.status;
  if (!status && route.realtime === "loading") return `${name} 실시간 확인 중`;
  if (!status && !isLiveTimed(route)) return `${name} ${LIVE_ISSUE_LABEL.unavailable}`;
  if (!status || status.kind === "ended") return `${name} 운행 종료`;
  if (status.kind === "garage") return `${name} ${garageDepartLabel(status.departAt)}`;
  return `${name} 도착까지 ${status.minutes}분`;
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
  const live = isLiveTimed(route);
  const waitKnown = (leg: BusLeg) => live && !leg.liveIssue;

  return (
    <section aria-labelledby="transfer-panel-title" className="rounded-lg border border-border bg-surface px-4 pt-3 pb-4">
      <div className="flex min-h-8 items-center justify-between gap-3">
        <h2 id="transfer-panel-title" className="truncate text-sm font-bold text-fg">
          환승 실시간
        </h2>
        <StaleBadge secondsAgo={secondsAgo} onRefresh={onRefresh} />
      </div>
      <ul className="mt-1 divide-y divide-divider">
        {transfers.map(({ prev, next }) => (
          <li key={`${prev.routeNo}-${next.routeNo}-${next.boardAt}`} className="py-3 first:pt-2 last:pb-0">
            <p className="flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-1 text-xs text-fg tabular">
              <span className="inline-flex items-center gap-1">
                <BusNumber routeNo={prev.routeNo} busType={prev.busType} size="sm" />
                <time dateTime={prev.alightAt} className="font-semibold">
                  {formatShortClock(prev.alightAt)}
                </time>
                하차
              </span>
              <ChevronRightIcon size={14} className="shrink-0 text-fg-subtle" />
              <span className="inline-flex items-center gap-1">
                <BusNumber routeNo={next.routeNo} busType={next.busType} size="sm" />
                <time dateTime={next.boardAt} className="font-semibold">
                  {formatShortClock(next.boardAt)}
                </time>
                승차
              </span>
            </p>
            <p className="mt-2 text-xs text-fg-muted tabular">{arrivalText(prev, "버스 ", route)}</p>
            <p className="text-xs text-fg-muted tabular">
              {arrivalText(next, "환승 버스 ", route)}
              {waitKnown(next) && ` · 환승 대기 ${next.waitMinutes}분`}
            </p>
          </li>
        ))}
      </ul>
      {route.quickTransferChance !== undefined && busLegs.slice(1).every(waitKnown) && (
        <p className="mt-3 inline-flex h-6 items-center rounded-full bg-status-ok-soft px-2.5 text-xs font-semibold text-status-ok tabular">
          바로 환승 {route.quickTransferChance}%
        </p>
      )}
    </section>
  );
}

export function RideInsightPlaceholder() {
  return (
    <section aria-labelledby="ride-insight-title">
      <div className="rounded-lg border border-dashed border-border-strong bg-surface-muted px-4 py-3.5">
        <div className="flex items-center gap-1.5">
          <h2 id="ride-insight-title" className="truncate text-xs font-semibold text-fg-secondary">
            탑승 중 예측
          </h2>
          <span className="inline-flex h-5 shrink-0 items-center rounded-sm bg-surface px-1.5 text-xs text-fg-muted ring-1 ring-border ring-inset">
            준비 중
          </span>
        </div>
        <p className="mt-1 text-xs text-fg-muted">탑승 중 예측 정보는 아직 제공하지 않아요.</p>
        <dl className="mt-2 flex flex-wrap gap-x-4 text-xs text-fg-muted tabular">
          <div className="flex gap-1">
            <dt>평균 속도</dt>
            <dd className="text-fg-subtle">
              <span aria-hidden="true">—</span>
              <span className="sr-only">준비 중</span>
            </dd>
          </div>
          <div className="flex gap-1">
            <dt>환승 가능성</dt>
            <dd className="text-fg-subtle">
              <span aria-hidden="true">—</span>
              <span className="sr-only">준비 중</span>
            </dd>
          </div>
        </dl>
      </div>
    </section>
  );
}
