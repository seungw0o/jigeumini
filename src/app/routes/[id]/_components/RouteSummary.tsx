import { Fragment } from "react";
import { ChevronRightIcon } from "@/assets/icons";
import { LeaveBadge } from "@/components/LeaveBadge";
import { BusNumber, StaleBadge } from "@/components/StatusChips";
import { TimeRibbon } from "@/components/TimeRibbon";
import {
  ESTIMATE_NOTE,
  formatDistance,
  formatFare,
  isLiveTimed,
  realtimeNote,
  totalLabel,
  transferLabel,
} from "@/utils/format";
import { formatShortClock } from "@/utils/ribbon";
import type { BusLeg, TransitRoute } from "@/utils/types";

export function BusSequence({ route, size = "md" }: { route: TransitRoute; size?: "sm" | "md" }) {
  const buses = route.legs.filter((leg): leg is BusLeg => leg.kind === "bus");
  if (buses.length === 0) return <span className="text-xs font-semibold text-fg-secondary">도보</span>;
  return (
    <span className="flex min-w-0 items-center gap-0.5">
      {buses.map((leg, i) => (
        <Fragment key={`${leg.routeNo}-${leg.boardAt}`}>
          {i > 0 && <ChevronRightIcon size={size === "sm" ? 12 : 14} className="shrink-0 text-fg-subtle" />}
          <BusNumber leg={leg} size={size} />
        </Fragment>
      ))}
    </span>
  );
}

export function RouteSummary({
  route,
  now,
  fetchedAtMs,
  onRefresh,
}: {
  route: TransitRoute;
  now: string;
  fetchedAtMs: number;
  onRefresh: () => void;
}) {
  const note = realtimeNote(route);
  const walkM = route.legs.reduce((sum, leg) => (leg.kind === "walk" ? sum + leg.distanceM : sum), 0);
  return (
    <section aria-labelledby="route-summary-title" className="border-b border-divider px-gutter pt-3 pb-6 lg:pt-6">
      <div className="flex min-h-6 items-center justify-between gap-3">
        <BusSequence route={route} />
        <StaleBadge fetchedAtMs={fetchedAtMs} onRefresh={onRefresh} />
      </div>
      <div className="mt-4 flex items-center justify-between gap-3">
        <h1 id="route-summary-title" className="min-w-0 truncate text-lg font-bold text-fg tabular">
          {totalLabel(route)}
        </h1>
        <LeaveBadge route={route} />
      </div>
      <p className="mt-1 text-xs text-fg-secondary tabular">
        {isLiveTimed(route) && (
          <>
            {formatShortClock(route.leaveAt)} 출발 –{" "}
            <span className="font-semibold text-fg">{formatShortClock(route.arriveAt)}</span> 도착 예상
            {route.realtime === "partial" && " 이후"} ·{" "}
          </>
        )}
        {formatFare(route.fare)} · {transferLabel(route.transferCount)}
        {walkM > 0 && ` · 도보 ${formatDistance(walkM)}`}
      </p>
      {note && <p className="mt-3 text-xs break-keep text-realtime-missing">{note}</p>}
      {route.realtime !== "unavailable" && (
        <p className={`${note ? "mt-1" : "mt-3"} text-xs break-keep text-fg-muted`}>{ESTIMATE_NOTE}</p>
      )}
      <TimeRibbon route={route} now={now} variant="full" className="mt-5" />
    </section>
  );
}
