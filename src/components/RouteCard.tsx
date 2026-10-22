"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { BusGlyph } from "@/assets/icons";
import { NotifyButton } from "@/components/NotifyButton";
import { SegmentBar } from "@/components/SegmentBar";
import { ArrivalText, BusBadge, MissedBusNotice, PillButton } from "@/components/StatusChips";
import { BUS_TYPE_META, formatClock, formatFare, leaveLabel, transferLabel } from "@/utils/format";
import type { BusArrival, BusLeg, BusType, NotifyState, TransitRoute } from "@/utils/types";

function liveMinutes(arrival: BusArrival | undefined): number | null {
  return arrival?.status.kind === "live" ? arrival.status.minutes : null;
}

function LegTypeLabel({ busType }: { busType: BusType }) {
  const meta = BUS_TYPE_META[busType];
  return (
    <span
      className="relative inline-flex items-center gap-1 bg-surface py-px pr-1 text-13 font-bold"
      style={{ color: meta.color }}
    >
      <BusGlyph size={14} />
      {meta.label}
    </span>
  );
}

function Separator() {
  return <span aria-hidden="true" className="mx-2 h-2.5 w-px shrink-0 bg-line-strong" />;
}

function BoardRow({
  leg,
  isFirst,
  quickTransferChance,
  onArrivalInfo,
}: {
  leg: BusLeg;
  isFirst: boolean;
  quickTransferChance?: number;
  onArrivalInfo: () => void;
}) {
  const shown = leg.arrivals.slice(leg.catchIndex, leg.catchIndex + (isFirst ? 2 : 1));
  const missedIn = leg.catchIndex > 0 ? liveMinutes(leg.arrivals[0]) : null;
  const nextIn = liveMinutes(leg.arrivals[leg.catchIndex]);

  return (
    <li className="grid grid-cols-[52px_minmax(0,1fr)] pb-1.5">
      <div>
        <LegTypeLabel busType={leg.busType} />
      </div>
      <div className="min-w-0">
        <div className="flex min-w-0 items-center gap-1.5">
          <span className="min-w-0 truncate text-sm text-ink">{leg.boardStop.name}</span>
          {isFirst && <span className="shrink-0 text-sm text-muted">승차</span>}
          {quickTransferChance !== undefined && (
            <span className="shrink-0 text-2xs text-subtle tabular">바로 환승 {quickTransferChance}%</span>
          )}
          <span className="relative z-10 -my-1 ml-auto shrink-0 pl-2">
            <PillButton onClick={onArrivalInfo} label={`${leg.routeNo}번 ${leg.boardStop.name} 도착정보`}>
              도착정보
            </PillButton>
          </span>
        </div>
        {shown.length > 0 && (
          <ul className="mt-0.5 flex flex-col">
            {shown.map((arrival, i) => (
              <li key={i} className="flex h-5 min-w-0 items-center gap-2">
                <BusBadge routeNo={arrival.routeNo} busType={arrival.busType} />
                <ArrivalText arrival={arrival} />
              </li>
            ))}
          </ul>
        )}
        {missedIn !== null && nextIn !== null && (
          <div className="mt-1">
            <MissedBusNotice routeNo={leg.routeNo} missedInMinutes={missedIn} nextInMinutes={nextIn} />
          </div>
        )}
      </div>
    </li>
  );
}

export function RouteCard({
  route,
  href,
  badge,
  notifyState,
  onNotifyChange,
}: {
  route: TransitRoute;
  href: string;
  badge?: string;
  notifyState: NotifyState;
  onNotifyChange: (next: NotifyState) => void;
}) {
  const router = useRouter();
  const busLegs = route.legs.filter((leg): leg is BusLeg => leg.kind === "bus");
  const lastBus = busLegs[busLegs.length - 1];
  const openDetail = () => router.push(href);

  return (
    <article className="relative bg-surface px-4 pt-3.5 pb-3">
      {badge && <p className="text-13 leading-4 font-bold text-ink">{badge}</p>}
      <Link href={href} className="flex items-baseline gap-2 rounded-sm after:absolute after:inset-0">
        <span className="text-ink">
          <span className="sr-only">총 소요 </span>
          <span className="text-[26px] leading-7 font-bold tabular">{route.totalMinutes}</span>
          <span className="ml-0.5 text-base font-semibold">분</span>
        </span>
        <span className="text-15 font-bold whitespace-nowrap text-accent">{leaveLabel(route)}</span>
      </Link>
      <p className="flex min-w-0 items-center text-13 leading-4 whitespace-nowrap text-muted tabular">
        <span className="shrink-0">
          {formatClock(route.leaveAt)} - {formatClock(route.arriveAt)}
        </span>
        <Separator />
        <span className="shrink-0">{formatFare(route.fare)}</span>
        <Separator />
        <span className="truncate">{transferLabel(route.transferCount)}</span>
      </p>

      <div className="mt-2">
        <SegmentBar legs={route.legs} />
      </div>

      {lastBus && (
        <ol className="relative mt-2 before:absolute before:top-2 before:bottom-2.5 before:left-[6.5px] before:w-px before:bg-line-strong">
          {busLegs.map((leg, i) => (
            <BoardRow
              key={`${leg.routeNo}-${leg.boardStop.id}`}
              leg={leg}
              isFirst={i === 0}
              quickTransferChance={i > 0 ? route.quickTransferChance : undefined}
              onArrivalInfo={openDetail}
            />
          ))}
          <li className="grid grid-cols-[52px_minmax(0,1fr)] items-center">
            <span className="relative inline-flex items-center gap-1 justify-self-start bg-surface pr-1 text-13 font-bold text-muted">
              <span className="flex size-3.5 items-center justify-center">
                <span className="size-2.5 rounded-full border-2 border-subtle bg-surface" />
              </span>
              하차
            </span>
            <span className="min-w-0 truncate text-sm text-ink">{lastBus.alightStop.name}</span>
          </li>
        </ol>
      )}

      <div className="relative z-10 mt-2">
        <NotifyButton variant="block" state={notifyState} onChange={onNotifyChange} />
      </div>
    </article>
  );
}
