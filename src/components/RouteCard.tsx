import Link from "next/link";
import { LeaveBadge } from "@/components/LeaveBadge";
import { NotifyButton } from "@/components/NotifyButton";
import { ArrivalText, BusNumber, MissedBusNotice, RunLabelBadge } from "@/components/StatusChips";
import { TimeRibbon } from "@/components/TimeRibbon";
import { formatFare, leaveLabel, totalLabel, transferLabel } from "@/utils/format";
import { formatShortClock } from "@/utils/ribbon";
import type { BusArrival, BusLeg, NotifyState, TransitRoute } from "@/utils/types";

function liveMinutes(arrival: BusArrival | undefined): number | null {
  return arrival?.status.kind === "live" ? arrival.status.minutes : null;
}

function CatchArrival({ arrival }: { arrival: BusArrival }) {
  const { status } = arrival;
  if (status.kind !== "live") return <ArrivalText arrival={arrival} />;
  return (
    <span className="inline-flex min-w-0 items-center gap-1.5">
      <span className="truncate">
        <span className="font-semibold text-live">{status.minutes <= 1 ? "곧 도착" : `${status.minutes}분`}</span>
        <span className="text-muted"> · {status.stopsAway}정류장 전</span>
      </span>
      {arrival.runLabel && <RunLabelBadge runLabel={arrival.runLabel} />}
    </span>
  );
}

function nextArrivalText(arrival: BusArrival | undefined): string | null {
  if (!arrival) return null;
  const { status } = arrival;
  if (status.kind === "live") return `다음 ${status.minutes}분`;
  if (status.kind === "garage") return `다음 ${formatShortClock(status.departAt)} 출발`;
  return null;
}

function BoardRow({ leg, quickTransferChance }: { leg: BusLeg; quickTransferChance?: number }) {
  const catchArrival = leg.arrivals[leg.catchIndex];
  const next = nextArrivalText(leg.arrivals[leg.catchIndex + 1]);
  const missedIn = leg.catchIndex > 0 ? liveMinutes(leg.arrivals[0]) : null;

  return (
    <li className="grid grid-cols-[44px_minmax(0,1fr)] gap-y-0.5">
      <div className="pt-px">
        <BusNumber routeNo={leg.routeNo} busType={leg.busType} />
      </div>
      <div className="min-w-0">
        <div className="flex h-6 min-w-0 items-center gap-1 text-sm">
          <span className="min-w-0 truncate font-medium text-ink">{leg.boardStop.name}</span>
          <span className="shrink-0 text-muted">승차</span>
          {quickTransferChance !== undefined && (
            <span className="ml-auto shrink-0 pl-2 text-xs text-muted tabular">바로 환승 {quickTransferChance}%</span>
          )}
        </div>
        {catchArrival && (
          <p className="flex h-5 min-w-0 items-center gap-2 text-13 whitespace-nowrap tabular">
            <CatchArrival arrival={catchArrival} />
            {next && <span className="shrink-0 text-muted">{next}</span>}
          </p>
        )}
        {missedIn !== null && (
          <div className="mt-1">
            <MissedBusNotice routeNo={leg.routeNo} missedInMinutes={missedIn} />
          </div>
        )}
      </div>
    </li>
  );
}

export function RouteCard({
  route,
  href,
  now,
  badge,
  notifyState,
  onNotifyChange,
}: {
  route: TransitRoute;
  href: string;
  now: string;
  badge?: string;
  notifyState: NotifyState;
  onNotifyChange: (next: NotifyState) => void;
}) {
  const busLegs = route.legs.filter((leg): leg is BusLeg => leg.kind === "bus");
  const lastBus = busLegs[busLegs.length - 1];
  const arrive = formatShortClock(route.arriveAt);

  return (
    <article className="relative bg-surface px-4 pt-3 pb-3">
      {badge && <p className="mb-1.5 text-xs leading-4 font-bold text-brand-ink">{badge}</p>}
      <Link
        href={href}
        aria-label={`${totalLabel(route)}, 도착 예상 ${arrive}, ${leaveLabel(route)}`}
        className="flex items-center justify-between gap-3 rounded-sm after:absolute after:inset-0"
      >
        <span className="shrink-0 text-[24px] leading-7 font-bold text-ink tabular">{totalLabel(route)}</span>
        <LeaveBadge route={route} size="lg" />
      </Link>
      <p className="mt-1 flex min-w-0 items-baseline text-13 whitespace-nowrap text-muted tabular">
        <span className="shrink-0">
          <span className="text-ink-2">도착 예상</span>{" "}
          <span className="text-15 font-semibold text-ink">{arrive}</span> · {formatFare(route.fare)} ·&nbsp;
        </span>
        <span className="truncate">{transferLabel(route.transferCount)}</span>
      </p>

      <TimeRibbon route={route} now={now} variant="compact" className="mt-3" />

      {lastBus && (
        <ol className="mt-3 flex flex-col gap-1.5 border-t border-line pt-2.5">
          {busLegs.map((leg, i) => (
            <BoardRow
              key={`${leg.routeNo}-${leg.boardStop.id}`}
              leg={leg}
              quickTransferChance={i > 0 ? route.quickTransferChance : undefined}
            />
          ))}
          <li className="grid h-6 grid-cols-[44px_minmax(0,1fr)] items-center text-sm">
            <span className="text-xs font-semibold text-muted">하차</span>
            <span className="min-w-0 truncate font-medium text-ink">{lastBus.alightStop.name}</span>
          </li>
        </ol>
      )}

      <div className="relative z-10 mt-3">
        <NotifyButton variant="block" state={notifyState} onChange={onNotifyChange} />
      </div>
    </article>
  );
}
