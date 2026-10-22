import type { CSSProperties, ReactNode } from "react";
import { TransferIcon, WalkIcon } from "@/assets/icons";
import { ArrivalChip, BusNumber, BusTypeLabel, MissedBusNotice } from "@/components/StatusChips";
import { BUS_TYPE_META, formatDistance } from "@/utils/format";
import type { BusArrival, BusLeg, Leg, TransitRoute } from "@/utils/types";

type Segment = { kind: "walk" } | { kind: "bus"; color: string } | null;

type Dot = { className: string; style?: CSSProperties };

function segmentOf(leg: Leg | undefined): Segment {
  if (!leg) return null;
  return leg.kind === "walk" ? { kind: "walk" } : { kind: "bus", color: BUS_TYPE_META[leg.busType].color };
}

function RailLine({ segment, className }: { segment: Segment; className: string }) {
  if (!segment) return null;
  return (
    <span
      className={`absolute left-1/2 w-0 -translate-x-px border-l-2 ${
        segment.kind === "walk" ? "border-dotted border-line-strong" : "border-solid"
      } ${className}`}
      style={segment.kind === "bus" ? { borderColor: segment.color } : undefined}
    />
  );
}

function Step({
  time,
  incoming,
  outgoing,
  dot,
  last = false,
  children,
}: {
  time?: string;
  incoming: Segment;
  outgoing: Segment;
  dot?: Dot;
  last?: boolean;
  children: ReactNode;
}) {
  return (
    <li className="flex">
      <div className="w-14 shrink-0 pt-0.5 text-sm text-ink-2 tabular">
        {time && <time dateTime={time}>{time}</time>}
      </div>
      <div className="relative w-6 shrink-0" aria-hidden="true">
        {dot ? (
          <>
            <RailLine segment={incoming} className="top-0 h-3" />
            <RailLine segment={outgoing} className="top-3 bottom-0" />
            <span
              className={`absolute top-1.5 left-1/2 size-3 -translate-x-1/2 rounded-full ${dot.className}`}
              style={dot.style}
            />
          </>
        ) : (
          <RailLine segment={outgoing} className="inset-y-0" />
        )}
      </div>
      <div className={`min-w-0 flex-1 pl-2 ${last ? "" : "pb-5"}`}>{children}</div>
    </li>
  );
}

function nextArrivalLabel(arrival: BusArrival): string {
  const { status } = arrival;
  if (status.kind === "live") return `다음 차 ${status.minutes}분 뒤`;
  if (status.kind === "garage") return `다음 차 ${status.departAt} 출발`;
  return "다음 차 없음";
}

function BoardArrivals({ leg }: { leg: BusLeg }) {
  const caught = leg.arrivals[leg.catchIndex];
  const missed = leg.arrivals.slice(0, leg.catchIndex);
  const later = leg.arrivals.slice(leg.catchIndex + 1);
  const firstMissed = missed[0]?.status;
  const caughtStatus = caught?.status;

  return (
    <>
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        {missed.map((arrival, i) => (
          <ArrivalChip key={`missed-${i}`} arrival={arrival} missed />
        ))}
        {caught && <ArrivalChip arrival={caught} />}
        {later.map((arrival, i) => (
          <span
            key={`later-${i}`}
            className="inline-flex h-6 max-w-full items-center rounded-sm border border-line px-1.5 text-xs text-muted tabular"
          >
            <span className="truncate">{nextArrivalLabel(arrival)}</span>
          </span>
        ))}
      </div>
      {firstMissed?.kind === "live" && caughtStatus?.kind === "live" && (
        <div className="mt-1.5">
          <MissedBusNotice
            routeNo={leg.routeNo}
            missedInMinutes={firstMissed.minutes}
            nextInMinutes={caughtStatus.minutes}
          />
        </div>
      )}
    </>
  );
}

function busDot(leg: BusLeg): Dot {
  return { className: "border-2 bg-surface", style: { borderColor: BUS_TYPE_META[leg.busType].color } };
}

function isTransferAfter(legs: Leg[], index: number): boolean {
  const next = legs[index + 1];
  if (next?.kind === "bus") return true;
  return next?.kind === "walk" && legs[index + 2]?.kind === "bus";
}

export function StepTimeline({
  route,
  originName,
  destinationName,
}: {
  route: TransitRoute;
  originName: string;
  destinationName: string;
}) {
  const { legs } = route;
  const steps: ReactNode[] = [];

  steps.push(
    <Step
      key="origin"
      time={route.leaveAt}
      incoming={null}
      outgoing={segmentOf(legs[0])}
      dot={{ className: "border-2 border-ink bg-surface" }}
    >
      <p className="truncate text-base font-semibold text-ink">{originName}</p>
      <p className="text-sm font-semibold text-accent tabular">
        {route.leaveInMinutes <= 0 ? "지금 출발" : `${route.leaveInMinutes}분 뒤 출발`}
      </p>
    </Step>,
  );

  legs.forEach((leg, i) => {
    if (leg.kind === "walk") {
      steps.push(
        <Step key={`walk-${i}`} incoming={null} outgoing={segmentOf(leg)}>
          <p className="flex items-center gap-1 pt-0.5 text-sm text-muted tabular">
            <WalkIcon size={16} className="shrink-0" />
            <span className="truncate">
              도보 {formatDistance(leg.distanceM)} · {leg.minutes}분
            </span>
          </p>
        </Step>,
      );
      return;
    }

    const transfer = isTransferAfter(legs, i);

    steps.push(
      <Step
        key={`board-${i}`}
        time={leg.boardAt}
        incoming={segmentOf(legs[i - 1])}
        outgoing={segmentOf(leg)}
        dot={busDot(leg)}
      >
        <p className="truncate text-base font-semibold text-ink">{leg.boardStop.name} 승차</p>
        <p className="text-sm text-muted tabular">ARS {leg.boardStop.arsId}</p>
        <div className="mt-2 flex min-w-0 items-center gap-2">
          <BusNumber routeNo={leg.routeNo} busType={leg.busType} />
          <BusTypeLabel busType={leg.busType} />
        </div>
        <BoardArrivals leg={leg} />
        <p className="mt-2 text-sm text-muted tabular">
          {leg.stopCount}정류장 이동 · {leg.rideMinutes}분
        </p>
      </Step>,
    );

    steps.push(
      <Step
        key={`alight-${i}`}
        time={leg.alightAt}
        incoming={segmentOf(leg)}
        outgoing={segmentOf(legs[i + 1])}
        dot={busDot(leg)}
      >
        <p className="flex min-w-0 items-center gap-1.5 text-base font-semibold text-ink">
          <span className="truncate">
            {leg.alightStop.name} 하차{transfer ? " · 환승" : ""}
          </span>
          {transfer && <TransferIcon size={18} className="shrink-0 text-ink-2" />}
        </p>
      </Step>,
    );
  });

  steps.push(
    <Step
      key="destination"
      time={route.arriveAt}
      incoming={segmentOf(legs[legs.length - 1])}
      outgoing={null}
      dot={{ className: "bg-ink" }}
      last
    >
      <p className="truncate text-base font-semibold text-ink">{destinationName}</p>
      <p className="text-sm text-muted">대기 포함 실제 도착</p>
    </Step>,
  );

  return <ol aria-label="이동 단계">{steps}</ol>;
}
