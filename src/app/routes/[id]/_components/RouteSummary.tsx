import { Fragment } from "react";
import { ChevronRightIcon } from "@/assets/icons";
import { LeaveBadge } from "@/components/LeaveBadge";
import { BusNumber, StaleBadge } from "@/components/StatusChips";
import { TimeRibbon } from "@/components/TimeRibbon";
import { ESTIMATE_NOTE, formatFare, realtimeNote, totalLabel, transferLabel } from "@/utils/format";
import { formatShortClock } from "@/utils/ribbon";
import type { BusLeg, TransitRoute } from "@/utils/types";

export function BusSequence({ route, size = "md" }: { route: TransitRoute; size?: "sm" | "md" }) {
  const buses = route.legs.filter((leg): leg is BusLeg => leg.kind === "bus");
  if (buses.length === 0) return <span className="text-13 font-semibold text-ink-2">도보</span>;
  return (
    <span className="flex min-w-0 items-center gap-0.5">
      {buses.map((leg, i) => (
        <Fragment key={`${leg.routeNo}-${leg.boardAt}`}>
          {i > 0 && <ChevronRightIcon size={size === "sm" ? 12 : 14} className="shrink-0 text-subtle" />}
          <BusNumber routeNo={leg.routeNo} busType={leg.busType} size={size} />
        </Fragment>
      ))}
    </span>
  );
}

export function RouteSummary({
  route,
  now,
  secondsAgo,
  onRefresh,
}: {
  route: TransitRoute;
  now: string;
  secondsAgo: number;
  onRefresh: () => void;
}) {
  const note = realtimeNote(route);
  return (
    <section aria-labelledby="route-summary-title" className="border-b border-line px-4 pt-2 pb-4 lg:pt-4">
      <div className="flex min-h-6 items-center justify-between gap-3">
        <BusSequence route={route} />
        <StaleBadge secondsAgo={secondsAgo} onRefresh={onRefresh} />
      </div>
      <h1 id="route-summary-title" className="mt-2 flex items-center justify-between gap-3">
        <span className="shrink-0 text-[26px] leading-8 font-bold text-ink tabular">{totalLabel(route)}</span>
        <LeaveBadge route={route} size="lg" />
      </h1>
      <p className="mt-1 text-13 text-muted tabular">
        <span className="text-ink-2">도착 예상</span>{" "}
        <span className="text-15 font-semibold text-ink">{formatShortClock(route.arriveAt)}</span> ·{" "}
        {formatFare(route.fare)} · {transferLabel(route.transferCount)}
      </p>
      {note && <p className="mt-1 text-xs break-keep text-muted">{note}</p>}
      <p className="mt-1 text-xs text-muted">{ESTIMATE_NOTE}</p>
      <TimeRibbon route={route} now={now} variant="full" className="mt-4" />
    </section>
  );
}
