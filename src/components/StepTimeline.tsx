import type { ReactNode } from "react";
import { BusGlyph } from "@/assets/icons";
import { LeaveBadge } from "@/components/LeaveBadge";
import { ArrivalText, BusBadge, LIVE_ISSUE_LABEL, MissedBusNotice } from "@/components/StatusChips";
import { BUS_TYPE_META, formatDistance, isLiveTimed } from "@/utils/format";
import { buildRibbon, formatShortClock } from "@/utils/ribbon";
import type { BusLeg, Leg, Ribbon, TransitRoute } from "@/utils/types";

type Segment = { kind: "before" } | { kind: "walk" } | { kind: "bus"; color: string } | null;

type Marker =
  | { kind: "before" }
  | { kind: "origin" }
  | { kind: "destination" }
  | { kind: "board"; color: string }
  | { kind: "alight"; color: string };

type StepData = {
  key: string;
  time?: string;
  emphasize?: boolean;
  incoming: Segment;
  outgoing: Segment;
  marker?: Marker;
  walk?: boolean;
  content: ReactNode;
};

function segmentOf(leg: Leg | undefined): Segment {
  if (!leg) return null;
  return leg.kind === "walk" ? { kind: "walk" } : { kind: "bus", color: BUS_TYPE_META[leg.busType].color };
}

function Rail({ segment, className }: { segment: Segment; className: string }) {
  if (!segment) return null;
  if (segment.kind === "walk") {
    return <span className={`absolute left-1/2 w-0 -translate-x-px border-l-2 border-dotted border-walk-fg ${className}`} />;
  }
  if (segment.kind === "before") {
    return <span className={`absolute left-1/2 w-1 -translate-x-1/2 bg-brand ${className}`} />;
  }
  return (
    <span
      className={`absolute left-1/2 w-1 -translate-x-1/2 ${className}`}
      style={{ backgroundColor: segment.color }}
    />
  );
}

function Pin({ color, text }: { color: string; text: string }) {
  return (
    <svg width="22" height="28" viewBox="0 0 22 28" className="absolute top-2.5 left-1/2 -translate-x-1/2">
      <path
        d="M11 27.5C11 27.5 1 17.6 1 10.8 1 5.1 5.5 1 11 1s10 4.1 10 9.8C21 17.6 11 27.5 11 27.5Z"
        fill={color}
        stroke="var(--color-surface)"
        strokeWidth="1.2"
      />
      <text
        x="11"
        y="13.6"
        textAnchor="middle"
        fontSize="7.5"
        fontWeight="700"
        letterSpacing="-0.3"
        fill="var(--color-surface)"
      >
        {text}
      </text>
    </svg>
  );
}

function MarkerGlyph({ marker }: { marker: Marker }) {
  switch (marker.kind) {
    case "before":
      return (
        <span className="absolute top-6 left-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-xs bg-brand ring-2 ring-surface" />
      );
    case "origin":
      return <Pin color="var(--color-map-origin)" text="출발" />;
    case "destination":
      return <Pin color="var(--color-map-destination)" text="도착" />;
    case "board":
      return (
        <span
          className="absolute top-6 left-1/2 flex size-[22px] -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 bg-surface"
          style={{ borderColor: marker.color, color: marker.color }}
        >
          <BusGlyph size={12} />
        </span>
      );
    case "alight":
      return (
        <span
          className="absolute top-6 left-1/2 size-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] bg-surface"
          style={{ borderColor: marker.color }}
        />
      );
  }
}

function Step({ step, divider, tightBottom }: { step: StepData; divider: boolean; tightBottom: boolean }) {
  const { time, emphasize, incoming, outgoing, marker, walk } = step;
  const pinned = marker?.kind === "origin";
  return (
    <li className="flex">
      <div className={`w-[52px] shrink-0 ${walk ? "" : "pt-3.5"}`}>
        {time && (
          <time
            dateTime={time}
            className={`flex h-5 items-center text-xs tabular ${emphasize ? "font-semibold text-fg" : "text-fg-muted"}`}
          >
            {formatShortClock(time)}
          </time>
        )}
      </div>
      <div className="relative w-6 shrink-0" aria-hidden="true">
        {marker ? (
          <>
            <Rail segment={incoming} className="top-0 h-6" />
            <Rail segment={outgoing} className={`${pinned ? "top-9" : "top-6"} bottom-0`} />
            <MarkerGlyph marker={marker} />
          </>
        ) : (
          <Rail segment={outgoing} className="inset-y-0" />
        )}
      </div>
      <div
        className={`min-w-0 flex-1 pr-4 pl-2.5 ${walk ? "pt-0.5" : "pt-3.5"} ${tightBottom ? "pb-2" : "pb-3.5"} ${
          divider ? "border-b border-border" : ""
        }`}
      >
        {step.content}
      </div>
    </li>
  );
}

function StopTitle({ children }: { children: ReactNode }) {
  return <p className="text-sm font-bold text-fg">{children}</p>;
}

function WaitTag({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex h-5 shrink-0 items-center rounded-sm bg-bg px-1.5 text-xs font-semibold text-fg-secondary tabular">
      {children}
    </span>
  );
}

function BoardContent({
  leg,
  transferWait,
  isTransfer,
  pending,
}: {
  leg: BusLeg;
  transferWait?: number;
  isTransfer: boolean;
  pending: boolean;
}) {
  const visible = leg.liveIssue ? [] : leg.arrivals.slice(0, leg.catchIndex + 2);
  const statusText = leg.liveIssue
    ? LIVE_ISSUE_LABEL[leg.liveIssue]
    : visible.length === 0 && pending
      ? "실시간 확인 중"
      : null;
  const firstMissed = leg.arrivals[0]?.status;
  const caught = leg.arrivals[leg.catchIndex]?.status;

  return (
    <>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <StopTitle>{leg.boardStop.name} 승차</StopTitle>
        {transferWait !== undefined && !leg.liveIssue && <WaitTag>환승 대기 {transferWait}분</WaitTag>}
      </div>
      <p className="text-xs text-fg-muted tabular">{leg.boardStop.arsId}</p>
      <div className="mt-2 flex items-start gap-2.5">
        <span className="flex h-[18px] items-center">
          <BusBadge routeNo={leg.routeNo} busType={leg.busType} />
        </span>
        <ul className="flex min-w-0 flex-col gap-0.5">
          {statusText && <li className="flex min-h-[18px] min-w-0 items-center text-xs text-fg-muted">{statusText}</li>}
          {visible.map((arrival, i) => (
            <li key={i} className="flex min-h-[18px] min-w-0 items-center">
              <ArrivalText arrival={arrival} missed={i < leg.catchIndex} />
            </li>
          ))}
        </ul>
      </div>
      {isTransfer && leg.liveIssue && (
        <p className="mt-1.5 text-xs text-fg-muted">환승 버스 실시간 정보가 없어 대기 시간은 빼고 계산했어요</p>
      )}
      {!leg.liveIssue && leg.catchIndex > 0 && firstMissed?.kind === "live" && caught?.kind === "live" && (
        <div className="mt-1.5">
          <MissedBusNotice routeNo={leg.routeNo} missedInMinutes={firstMissed.minutes} />
        </div>
      )}
      <p className="mt-2 text-xs text-fg-muted tabular">
        {leg.stopCount}정류장 이동 · {leg.rideMinutes}분
      </p>
    </>
  );
}

function hasBusAfter(legs: Leg[], index: number): boolean {
  return legs.slice(index + 1).some((leg) => leg.kind === "bus");
}

function transferWaitOf(ribbon: Ribbon, leg: BusLeg): number {
  return ribbon.segments.find((seg) => seg.kind === "transfer" && seg.end === leg.boardAt)?.minutes ?? leg.waitMinutes;
}

function buildSteps(route: TransitRoute, now: string, originName: string, destinationName: string): StepData[] {
  const { legs } = route;
  const ribbon = buildRibbon(route, now);
  const live = isLiveTimed(route);
  const pending = route.realtime === "loading";
  const beforeMinutes = ribbon.segments[0]?.kind === "before" ? ribbon.segments[0].minutes : 0;
  const steps: StepData[] = [];

  if (beforeMinutes > 0) {
    steps.push({
      key: "before",
      time: now,
      incoming: null,
      outgoing: { kind: "before" },
      marker: { kind: "before" },
      content: (
        <>
          <StopTitle>출발 전 {beforeMinutes}분</StopTitle>
          <p className="text-xs text-fg-muted tabular">지금 {formatShortClock(now)}</p>
        </>
      ),
    });
  }

  steps.push({
    key: "origin",
    time: route.leaveAt,
    emphasize: true,
    incoming: beforeMinutes > 0 ? { kind: "before" } : null,
    outgoing: segmentOf(legs[0]),
    marker: { kind: "origin" },
    content: (
      <>
        <StopTitle>{originName}</StopTitle>
        <div className="mt-1 flex">
          <LeaveBadge route={route} size="sm" />
        </div>
      </>
    ),
  });

  let seenBus = false;
  legs.forEach((leg, i) => {
    if (leg.kind === "walk") {
      steps.push({
        key: `walk-${i}`,
        incoming: null,
        outgoing: segmentOf(leg),
        walk: true,
        content: (
          <p className="text-xs text-fg-muted tabular">
            도보 {formatDistance(leg.distanceM)} · <strong className="font-bold text-fg-secondary">{leg.minutes}분</strong>
          </p>
        ),
      });
      return;
    }

    const color = BUS_TYPE_META[leg.busType].color;
    steps.push({
      key: `board-${i}`,
      time: leg.boardAt,
      incoming: segmentOf(legs[i - 1]),
      outgoing: segmentOf(leg),
      marker: { kind: "board", color },
      content: (
        <BoardContent
          leg={leg}
          transferWait={seenBus && live ? transferWaitOf(ribbon, leg) : undefined}
          isTransfer={seenBus}
          pending={pending}
        />
      ),
    });
    seenBus = true;
    steps.push({
      key: `alight-${i}`,
      time: leg.alightAt,
      incoming: segmentOf(leg),
      outgoing: segmentOf(legs[i + 1]),
      marker: { kind: "alight", color },
      content: (
        <p className="flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-1">
          <span className="text-sm font-bold text-fg">{leg.alightStop.name} 하차</span>
          {hasBusAfter(legs, i) && <WaitTag>환승</WaitTag>}
        </p>
      ),
    });
  });

  steps.push({
    key: "destination",
    time: route.arriveAt,
    incoming: segmentOf(legs[legs.length - 1]),
    outgoing: null,
    marker: { kind: "destination" },
    content: (
      <>
        <StopTitle>{destinationName}</StopTitle>
        <p className="text-xs text-fg-muted">
          {!live ? "기다리는 시간 없이 계산한 도착 예상" : route.realtime === "partial" ? "환승 대기는 뺀 도착 예상" : "대기까지 더한 도착 예상"}
        </p>
      </>
    ),
  });

  return steps;
}

export function StepTimeline({
  route,
  now,
  originName,
  destinationName,
}: {
  route: TransitRoute;
  now: string;
  originName: string;
  destinationName: string;
}) {
  const steps = buildSteps(route, now, originName, destinationName);

  return (
    <ol aria-label="이동 단계" className="pl-4">
      {steps.map((step, i) => {
        const next = steps[i + 1];
        const nextIsWalk = next?.walk === true;
        return <Step key={step.key} step={step} divider={!!next && !nextIsWalk} tightBottom={nextIsWalk} />;
      })}
    </ol>
  );
}
