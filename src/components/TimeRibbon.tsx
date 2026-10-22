import type { ReactNode } from "react";
import { BUS_TYPE_META } from "@/utils/format";
import { buildRibbon, formatShortClock } from "@/utils/ribbon";
import type { RibbonMark, RibbonSegment, TransitRoute } from "@/utils/types";

type Variant = "compact" | "full";

/** 라벨이 들어갈지 판단하는 기준 폭. 390px 폰의 카드/패널 본문 폭 */
const NOMINAL_WIDTH = 358;
const LABEL_GAP = 6;
const INNER_PADDING = 4;

const VARIANT = {
  compact: { bar: "h-5.5", text: "text-2xs leading-none", textPx: 11, bus: "text-xs leading-none", busPx: 12 },
  full: { bar: "h-7", text: "text-xs leading-none", textPx: 12, bus: "text-13 leading-none", busPx: 13 },
} as const;

const HATCH =
  "bg-canvas bg-[image:repeating-linear-gradient(135deg,var(--color-line-strong)_0_1px,transparent_1px_5px)]";

/** Pretendard 기준 대략 폭: 한글 1em, 숫자·라틴 0.62em, 콜론 0.32em, 공백 0.3em */
function estimateWidth(text: string, fontPx: number, bold = false): number {
  let em = 0;
  for (const ch of text) {
    if (/[\u3131-\u318e\uac00-\ud7a3]/.test(ch)) em += 1;
    else if (ch === " ") em += 0.3;
    else if (ch === ":") em += 0.32;
    else em += 0.62;
  }
  return em * fontPx * (bold ? 1.06 : 1);
}

function toPct(offset: number, total: number): number {
  return total > 0 ? (offset / total) * 100 : 0;
}

function innerLabelCandidates(seg: RibbonSegment, variant: Variant): string[] {
  const m = `${seg.minutes}분`;
  switch (seg.kind) {
    case "home":
      return variant === "full" ? [`집에서 ${m}`, `집 ${m}`, m] : [`집 ${m}`, m];
    case "walk":
      return variant === "full" ? [`도보 ${m}`, m] : [m];
    case "stop":
      return [m];
    case "transfer":
      return variant === "full" ? [`환승 대기 ${m}`, `환승 ${m}`, m] : [m];
    case "bus":
      return seg.routeNo ? [seg.routeNo] : [];
  }
}

const SEGMENT_CLASS: Record<RibbonSegment["kind"], string> = {
  home: "bg-brand text-ink font-semibold",
  walk: "bg-walk text-walk-text font-medium",
  stop: `${HATCH} text-muted font-medium`,
  transfer: `${HATCH} text-ink-2 font-semibold`,
  bus: "text-white font-bold",
};

function Segment({
  seg,
  offset,
  total,
  isLast,
  variant,
}: {
  seg: RibbonSegment;
  offset: number;
  total: number;
  isLast: boolean;
  variant: Variant;
}) {
  const size = VARIANT[variant];
  const isBus = seg.kind === "bus";
  const fontPx = isBus ? size.busPx : size.textPx;
  const widthPx = (seg.minutes / total) * NOMINAL_WIDTH - (isLast ? 0 : 1);
  const label = innerLabelCandidates(seg, variant).find(
    (text) => estimateWidth(text, fontPx, isBus || seg.kind === "home") + INNER_PADDING <= widthPx,
  );
  const widthPct = toPct(seg.minutes, total);

  return (
    <div
      className={`absolute inset-y-0 flex items-center justify-center overflow-hidden whitespace-nowrap tabular ${isBus ? size.bus : size.text} ${SEGMENT_CLASS[seg.kind]}`}
      style={{
        left: `${toPct(offset, total)}%`,
        width: isLast ? `${widthPct}%` : `calc(${widthPct}% - 1px)`,
        backgroundColor: isBus && seg.busType ? BUS_TYPE_META[seg.busType].color : undefined,
      }}
    >
      {label}
    </div>
  );
}

type Anchor = "start" | "center" | "end";

interface LabelSpec {
  key: string;
  pct: number;
  width: number;
  anchors: Anchor[];
}

interface Placement {
  className: string;
  style: { left?: string | number; right?: string | number };
}

/** 우선순위 순서로 받은 라벨을 겹치지 않게 배치. 자리가 없으면 버린다. 양 끝은 컨테이너 안으로 붙인다 */
function placeLabels(specs: LabelSpec[]): Map<string, Placement> {
  const taken: Array<[number, number]> = [];
  const placed = new Map<string, Placement>();
  for (const spec of specs) {
    const x = (spec.pct / 100) * NOMINAL_WIDTH;
    for (const anchor of spec.anchors) {
      let left = anchor === "start" ? x : anchor === "center" ? x - spec.width / 2 : x - spec.width;
      let placement: Placement;
      if (left <= 0) {
        left = 0;
        placement = { className: "", style: { left: 0 } };
      } else if (left + spec.width >= NOMINAL_WIDTH) {
        left = NOMINAL_WIDTH - spec.width;
        placement = { className: "", style: { right: 0 } };
      } else if (anchor === "start") {
        placement = { className: "", style: { left: `${spec.pct}%` } };
      } else if (anchor === "end") {
        placement = { className: "", style: { right: `${100 - spec.pct}%` } };
      } else {
        placement = { className: "-translate-x-1/2", style: { left: `${spec.pct}%` } };
      }
      const right = left + spec.width;
      if (taken.some(([l, r]) => left < r + LABEL_GAP && right + LABEL_GAP > l)) continue;
      taken.push([left, right]);
      placed.set(spec.key, placement);
      break;
    }
  }
  return placed;
}

function markKey(mark: RibbonMark, index: number): string {
  return `${mark.kind}-${index}`;
}

function PlacedLabel({ placement, className, children }: { placement: Placement; className: string; children: ReactNode }) {
  return (
    <span className={`absolute whitespace-nowrap ${placement.className} ${className}`} style={placement.style}>
      {children}
    </span>
  );
}

function CompactTimes({ marks, total }: { marks: RibbonMark[]; total: number }) {
  const now = marks.find((m) => m.kind === "now");
  const leave = marks.find((m) => m.kind === "leave");
  const arrive = marks.find((m) => m.kind === "arrive");
  const items: Array<{ mark: RibbonMark; text: string; anchors: Anchor[]; node: ReactNode }> = [];
  if (arrive) {
    const time = formatShortClock(arrive.time);
    items.push({
      mark: arrive,
      text: `${time} 도착`,
      anchors: ["end"],
      node: (
        <>
          <span className="font-semibold text-ink">{time}</span> <span className="text-muted">도착</span>
        </>
      ),
    });
  }
  if (leave) {
    const time = formatShortClock(leave.time);
    items.push({
      mark: leave,
      text: `${time} 출발`,
      anchors: ["start", "center", "end"],
      node: (
        <span className="text-brand-ink">
          <span className="font-semibold">{time}</span> 출발
        </span>
      ),
    });
  }
  if (now) {
    const time = formatShortClock(now.time);
    items.push({
      mark: now,
      text: `지금 ${time}`,
      anchors: ["start"],
      node: (
        <>
          <span className="text-muted">지금</span> <span className="text-ink-2">{time}</span>
        </>
      ),
    });
  }

  const placed = placeLabels(
    items.map((item) => ({
      key: item.mark.kind,
      pct: toPct(item.mark.offset, total),
      width: estimateWidth(item.text, 12, true),
      anchors: item.anchors,
    })),
  );

  return (
    <div className="relative mt-1 h-4 text-xs leading-4 tabular">
      {items.map((item) => {
        const placement = placed.get(item.mark.kind);
        return placement ? (
          <PlacedLabel key={item.mark.kind} placement={placement} className="top-0">
            {item.node}
          </PlacedLabel>
        ) : null;
      })}
    </div>
  );
}

function fullPriority(mark: RibbonMark, boardIndex: number): number {
  if (mark.kind === "arrive") return 0;
  if (mark.kind === "leave") return 1;
  if (mark.kind === "board") return boardIndex === 0 ? 2 : 3 + boardIndex;
  return 100;
}

function Caption({ mark }: { mark: RibbonMark }) {
  switch (mark.kind) {
    case "now":
      return <span className="text-muted">지금</span>;
    case "leave":
      return <span className="font-semibold text-brand-ink">출발</span>;
    case "board":
      return (
        <>
          <span className="font-bold text-ink-2">{mark.routeNo}</span> <span className="text-muted">탑승</span>
        </>
      );
    case "arrive":
      return <span className="font-semibold text-ink">도착</span>;
  }
}

function captionText(mark: RibbonMark): string {
  return { now: "지금", leave: "출발", board: `${mark.routeNo} 탑승`, arrive: "도착" }[mark.kind];
}

const TIME_TONE: Record<RibbonMark["kind"], string> = {
  now: "text-ink-2",
  leave: "font-semibold text-brand-ink",
  board: "text-ink-2",
  arrive: "font-semibold text-ink",
};

function layoutFullLabels(marks: RibbonMark[], total: number) {
  let boardIndex = 0;
  const entries = marks.map((mark, i) => {
    const key = markKey(mark, i);
    const priority = fullPriority(mark, mark.kind === "board" ? boardIndex++ : 0);
    const time = formatShortClock(mark.time);
    const width = Math.max(estimateWidth(captionText(mark), 11, true), estimateWidth(time, 12, true));
    return { key, mark, priority, time, width };
  });
  const placed = placeLabels(
    [...entries]
      .sort((a, b) => a.priority - b.priority)
      .map((e) => ({
        key: e.key,
        pct: toPct(e.mark.offset, total),
        width: e.width,
        anchors: ["center", "start", "end"] as Anchor[],
      })),
  );
  return { entries, placed };
}

function Tick({ pct }: { pct: number }) {
  const style = pct <= 0 ? { left: 0 } : pct >= 100 ? { right: 0 } : { left: `${pct}%` };
  return <span className={`absolute top-0 h-1 w-px bg-subtle ${pct > 0 && pct < 100 ? "-translate-x-1/2" : ""}`} style={style} />;
}

function describe(seg: RibbonSegment): string {
  switch (seg.kind) {
    case "home":
      return `집에서 ${seg.minutes}분 기다렸다가 ${formatShortClock(seg.end)} 출발`;
    case "walk":
      return `도보 ${seg.minutes}분`;
    case "stop":
      return `정류장에서 ${seg.minutes}분`;
    case "transfer":
      return `환승 대기 ${seg.minutes}분`;
    case "bus":
      return `${seg.routeNo}번 ${formatShortClock(seg.start)} 탑승, ${seg.minutes}분`;
  }
}

export function TimeRibbon({
  route,
  now,
  variant = "compact",
  className,
}: {
  route: TransitRoute;
  now: string;
  variant?: Variant;
  className?: string;
}) {
  const ribbon = buildRibbon(route, now);
  const total = ribbon.totalMinutes;
  const size = VARIANT[variant];

  let offset = 0;
  const positioned = ribbon.segments.map((seg) => {
    const start = offset;
    offset += seg.minutes;
    return { seg, start };
  });

  const full = variant === "full" ? layoutFullLabels(ribbon.marks, total) : null;
  const hasHome = ribbon.segments[0]?.kind === "home";

  return (
    <div className={`tracking-normal ${className ?? ""}`}>
      <div aria-hidden="true">
        {full && (
          <div className="relative mb-1 h-3.5 text-2xs">
            {full.entries.map((e) => {
              const placement = full.placed.get(e.key);
              return placement ? (
                <PlacedLabel key={e.key} placement={placement} className="top-0">
                  <Caption mark={e.mark} />
                </PlacedLabel>
              ) : null;
            })}
          </div>
        )}

        <div className={`relative ${size.bar}`}>
          <div className="absolute inset-0 overflow-hidden rounded-sm bg-surface">
            {total > 0 &&
              positioned.map(({ seg, start }, i) => (
                <Segment
                  key={`${seg.kind}-${seg.start}`}
                  seg={seg}
                  offset={start}
                  total={total}
                  isLast={i === positioned.length - 1}
                  variant={variant}
                />
              ))}
          </div>
          <span className="absolute top-1/2 left-0 size-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-ink ring-2 ring-surface" />
        </div>

        {full ? (
          <div className="relative mt-0.5 h-5.5 text-xs leading-4 tabular">
            {full.entries
              .filter((e) => e.mark.kind !== "now")
              .map((e) => (
                <Tick key={`tick-${e.key}`} pct={toPct(e.mark.offset, total)} />
              ))}
            {full.entries.map((e) => {
              const placement = full.placed.get(e.key);
              return placement ? (
                <PlacedLabel key={e.key} placement={placement} className={`top-1.5 ${TIME_TONE[e.mark.kind]}`}>
                  {e.time}
                </PlacedLabel>
              ) : null;
            })}
          </div>
        ) : (
          <CompactTimes marks={ribbon.marks} total={total} />
        )}
      </div>

      <ol className="sr-only">
        <li>지금 {formatShortClock(ribbon.now)}</li>
        {!hasHome && <li>{formatShortClock(route.leaveAt)} 바로 출발</li>}
        {ribbon.segments.map((seg) => (
          <li key={`${seg.kind}-${seg.start}`}>{describe(seg)}</li>
        ))}
        <li>{formatShortClock(route.arriveAt)} 도착</li>
      </ol>
    </div>
  );
}
