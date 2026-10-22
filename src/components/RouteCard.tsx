import Link from "next/link";
import { NotifyButton } from "@/components/NotifyButton";
import { SegmentBar } from "@/components/SegmentBar";
import { ArrivalChip, BusNumber, MissedBusNotice } from "@/components/StatusChips";
import { formatFare } from "@/utils/format";
import type { BusArrival, BusLeg, NotifyState, TransitRoute } from "@/utils/types";

function arrivalPhrase(leg: BusLeg, isFirst: boolean): string {
  const { status } = leg.arrivals[leg.catchIndex];
  if (status.kind === "garage") return `${status.departAt} 출발 예정`;
  if (status.kind === "ended") return "운행 종료";
  return isFirst ? `버스 도착까지 ${status.minutes}분` : `환승 버스 ${leg.routeNo}번 도착까지 ${status.minutes}분`;
}

function liveMinutes(arrival: BusArrival | undefined): number | null {
  return arrival?.status.kind === "live" ? arrival.status.minutes : null;
}

function BusLegRow({ leg, isFirst, quickTransferChance }: { leg: BusLeg; isFirst: boolean; quickTransferChance?: number }) {
  const caught = leg.arrivals[leg.catchIndex];
  const missedIn = leg.catchIndex > 0 ? liveMinutes(leg.arrivals[0]) : null;
  const nextIn = liveMinutes(caught);

  return (
    <li className="flex flex-col gap-2">
      <div className="flex min-w-0 items-center gap-2">
        <BusNumber routeNo={leg.routeNo} busType={leg.busType} />
        <span className="min-w-0 truncate text-sm text-ink-2">{leg.boardStop.name} 승차</span>
        <span className="ml-auto shrink-0 text-sm font-semibold text-ink tabular">{arrivalPhrase(leg, isFirst)}</span>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {caught && <ArrivalChip arrival={caught} />}
        {quickTransferChance !== undefined && (
          <span className="inline-flex h-5 shrink-0 items-center rounded-sm border border-line px-1.5 text-xs text-muted tabular">
            바로 환승 {quickTransferChance}%
          </span>
        )}
      </div>
      {missedIn !== null && nextIn !== null && (
        <MissedBusNotice routeNo={leg.routeNo} missedInMinutes={missedIn} nextInMinutes={nextIn} />
      )}
    </li>
  );
}

export function RouteCard({
  route,
  href,
  rank,
  notifyState,
  onNotifyChange,
}: {
  route: TransitRoute;
  href: string;
  rank: number;
  notifyState: NotifyState;
  onNotifyChange: (next: NotifyState) => void;
}) {
  const busLegs = route.legs.filter((leg): leg is BusLeg => leg.kind === "bus");
  const transfer = route.transferCount > 0 ? `환승 ${route.transferCount}회` : "환승 없음";

  return (
    <article className="relative flex flex-col gap-4 bg-surface px-4 py-5">
      <div className="flex min-h-5 items-center justify-between gap-3">
        {rank === 0 ? <span className="text-sm font-semibold text-accent">가장 빨리 도착</span> : <span />}
        <span className="truncate text-sm text-muted tabular">
          {formatFare(route.fare)} · {transfer}
        </span>
      </div>

      <Link href={href} className="flex flex-col gap-2 rounded-sm after:absolute after:inset-0">
        <span className="flex items-end justify-between gap-3">
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
        </span>
        <span className="text-sm text-muted tabular">
          지금 출발 기준 총 {route.totalMinutes}분 · 이동 {route.travelMinutes}분 + 대기{" "}
          {route.waitMinutes + route.marginMinutes}분
        </span>
      </Link>

      <SegmentBar legs={route.legs} showRouteNumbers />

      {busLegs.length > 0 && (
        <ul className="flex flex-col gap-3">
          {busLegs.map((leg, i) => (
            <BusLegRow
              key={`${leg.routeNo}-${leg.boardStop.id}`}
              leg={leg}
              isFirst={i === 0}
              quickTransferChance={i === 1 ? route.quickTransferChance : undefined}
            />
          ))}
        </ul>
      )}

      <div className="relative z-10 flex justify-end">
        <NotifyButton state={notifyState} onChange={onNotifyChange} />
      </div>
    </article>
  );
}
