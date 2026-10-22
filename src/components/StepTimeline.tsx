import type { ReactNode } from "react";
import { BusGlyph } from "@/assets/icons";
import { ArrivalText, BusBadge, MissedBusNotice } from "@/components/StatusChips";
import { BUS_TYPE_META, formatDistance, leaveLabel } from "@/utils/format";
import type { BusLeg, Leg, TransitRoute } from "@/utils/types";

type Segment = { kind: "walk" } | { kind: "bus"; color: string } | null;

type Marker =
  | { kind: "origin" }
  | { kind: "destination" }
  | { kind: "board"; color: string }
  | { kind: "alight"; color: string };

type StepData = {
  key: string;
  time?: string;
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
    return <span className={`absolute left-1/2 w-0 -translate-x-px border-l-2 border-dotted border-walk-text ${className}`} />;
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
    case "origin":
      return <Pin color="var(--color-pin-origin)" text="출발" />;
    case "destination":
      return <Pin color="var(--color-pin-destination)" text="도착" />;
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
  const { time, incoming, outgoing, marker, walk } = step;
  const pinned = marker?.kind === "origin";
  return (
    <li className="flex">
      <div className={`w-[52px] shrink-0 ${walk ? "" : "pt-3.5"}`}>
        {time && (
          <time
            dateTime={time}
            className="inline-flex h-5 items-center rounded-[3px] border border-line-strong bg-surface px-1 text-xs text-ink-2 tabular"
          >
            {time}
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
          divider ? "border-b border-line" : ""
        }`}
      >
        {step.content}
      </div>
    </li>
  );
}

function StopTitle({ children }: { children: ReactNode }) {
  return <p className="text-15 font-bold text-ink">{children}</p>;
}

function BoardContent({ leg }: { leg: BusLeg }) {
  const visible = leg.arrivals.slice(0, leg.catchIndex + 2);
  const firstMissed = leg.arrivals[0]?.status;
  const caught = leg.arrivals[leg.catchIndex]?.status;

  return (
    <>
      <StopTitle>{leg.boardStop.name} 승차</StopTitle>
      <p className="text-xs text-muted tabular">{leg.boardStop.arsId}</p>
      <div className="mt-2 flex items-start gap-2.5">
        <span className="flex h-[18px] items-center">
          <BusBadge routeNo={leg.routeNo} busType={leg.busType} />
        </span>
        <ul className="flex min-w-0 flex-col gap-0.5">
          {visible.map((arrival, i) => (
            <li key={i} className="flex min-h-[18px] min-w-0 items-center">
              <ArrivalText arrival={arrival} missed={i < leg.catchIndex} />
            </li>
          ))}
        </ul>
      </div>
      {leg.catchIndex > 0 && firstMissed?.kind === "live" && caught?.kind === "live" && (
        <div className="mt-1.5">
          <MissedBusNotice routeNo={leg.routeNo} missedInMinutes={firstMissed.minutes} nextInMinutes={caught.minutes} />
        </div>
      )}
      <p className="mt-2 text-xs text-muted tabular">
        {leg.stopCount}정류장 이동 · {leg.rideMinutes}분
      </p>
    </>
  );
}

function hasBusAfter(legs: Leg[], index: number): boolean {
  return legs.slice(index + 1).some((leg) => leg.kind === "bus");
}

function buildSteps(route: TransitRoute, originName: string, destinationName: string): StepData[] {
  const { legs } = route;
  const steps: StepData[] = [
    {
      key: "origin",
      time: route.leaveAt,
      incoming: null,
      outgoing: segmentOf(legs[0]),
      marker: { kind: "origin" },
      content: (
        <>
          <StopTitle>{originName}</StopTitle>
          <p className="text-13 font-semibold text-accent tabular">{leaveLabel(route)}</p>
        </>
      ),
    },
  ];

  legs.forEach((leg, i) => {
    if (leg.kind === "walk") {
      steps.push({
        key: `walk-${i}`,
        incoming: null,
        outgoing: segmentOf(leg),
        walk: true,
        content: (
          <p className="text-13 text-muted tabular">
            도보 {formatDistance(leg.distanceM)} · <strong className="font-bold text-ink-2">{leg.minutes}분</strong>
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
      content: <BoardContent leg={leg} />,
    });
    steps.push({
      key: `alight-${i}`,
      time: leg.alightAt,
      incoming: segmentOf(leg),
      outgoing: segmentOf(legs[i + 1]),
      marker: { kind: "alight", color },
      content: (
        <p className="flex min-w-0 items-center gap-1.5">
          <span className="text-15 font-bold text-ink">{leg.alightStop.name} 하차</span>
          {hasBusAfter(legs, i) && (
            <span className="inline-flex h-[18px] shrink-0 items-center rounded-[3px] bg-fill px-1 text-2xs font-semibold text-ink-2">
              환승
            </span>
          )}
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
        <p className="text-xs text-muted">대기 포함 실제 도착</p>
      </>
    ),
  });

  return steps;
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
  const steps = buildSteps(route, originName, destinationName);

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
