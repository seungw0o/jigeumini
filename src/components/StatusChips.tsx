import { BusGlyph, ClockIcon, RefreshIcon } from "@/assets/icons";
import { BUS_TYPE_META } from "@/utils/format";
import type { BusArrival, BusType } from "@/utils/types";

export function BusNumber({
  routeNo,
  busType,
  size = "md",
}: {
  routeNo: string;
  busType: BusType;
  size?: "sm" | "md";
}) {
  const meta = BUS_TYPE_META[busType];
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-[3px] border-[1.5px] bg-surface font-bold tabular ${
        size === "sm" ? "h-[18px] min-w-[18px] px-1 text-2xs" : "h-[22px] min-w-[22px] px-1.5 text-13"
      }`}
      style={{ borderColor: meta.color, color: meta.color }}
    >
      <span className="sr-only">{meta.label} </span>
      {routeNo}
    </span>
  );
}

export function BusBadge({ routeNo, busType }: { routeNo: string; busType: BusType }) {
  const meta = BUS_TYPE_META[busType];
  return (
    <span className="inline-flex shrink-0 items-center gap-1 text-15 font-bold text-ink tabular">
      <BusGlyph size={16} style={{ color: meta.color }} />
      <span className="sr-only">{meta.label} </span>
      {routeNo}
    </span>
  );
}

export function BusTypeLabel({ busType }: { busType: BusType }) {
  const meta = BUS_TYPE_META[busType];
  return (
    <span className="inline-flex shrink-0 items-center gap-1 text-15 font-bold" style={{ color: meta.color }}>
      <BusGlyph size={16} />
      {meta.label}
    </span>
  );
}

export function RunLabelBadge({ runLabel }: { runLabel: "first" | "last" }) {
  return (
    <span
      className={`inline-flex h-[18px] shrink-0 items-center rounded-[3px] px-1 text-2xs font-semibold ${
        runLabel === "last" ? "bg-danger-soft text-danger" : "bg-canvas text-ink-2"
      }`}
    >
      {runLabel === "last" ? "막차" : "첫차"}
    </span>
  );
}

export function ArrivalText({ arrival, missed = false }: { arrival: BusArrival; missed?: boolean }) {
  const { status } = arrival;
  if (missed) {
    const text = status.kind === "live" ? `${status.minutes}분 ${status.stopsAway}정류장 전` : "놓침";
    return <span className="text-13 text-subtle line-through tabular">{text}</span>;
  }
  return (
    <span className="inline-flex min-w-0 items-center gap-1.5 text-13 tabular">
      {status.kind === "live" && (
        <>
          <span className="font-semibold whitespace-nowrap text-live">
            {status.minutes <= 1 ? "곧 도착" : `${status.minutes}분`}
          </span>
          <span className="truncate text-muted">{status.stopsAway}정류장 전</span>
        </>
      )}
      {status.kind === "garage" && (
        <>
          <span className="font-semibold whitespace-nowrap text-warn">{status.departAt} 출발</span>
          <span className="truncate text-muted">차고지 대기</span>
        </>
      )}
      {status.kind === "ended" && <span className="text-subtle">운행 종료</span>}
      {arrival.runLabel && <RunLabelBadge runLabel={arrival.runLabel} />}
    </span>
  );
}

export function ArrivalChip({ arrival, missed = false }: { arrival: BusArrival; missed?: boolean }) {
  return (
    <span className="inline-flex h-6 max-w-full items-center rounded-full bg-fill px-2">
      <ArrivalText arrival={arrival} missed={missed} />
    </span>
  );
}

export function MissedBusNotice({
  routeNo,
  missedInMinutes,
}: {
  routeNo: string;
  missedInMinutes: number;
}) {
  return (
    <p className="flex items-start gap-1 text-xs text-warn">
      <ClockIcon size={14} className="mt-px shrink-0" />
      <span className="tabular">
        {missedInMinutes}분 뒤 {routeNo}번은 어려워요, <strong className="font-semibold">다음 {routeNo} 기준</strong>이에요
      </span>
    </p>
  );
}

export function StaleBadge({
  secondsAgo,
  onRefresh,
}: {
  secondsAgo: number;
  onRefresh?: () => void;
}) {
  const stale = secondsAgo >= 60;
  const label = secondsAgo < 60 ? `${secondsAgo}초 전 정보` : `${Math.floor(secondsAgo / 60)}분 전 정보`;
  return (
    <span className={`inline-flex items-center gap-0.5 text-xs tabular ${stale ? "text-warn" : "text-subtle"}`}>
      <span>{label}</span>
      {onRefresh && (
        <button
          type="button"
          onClick={onRefresh}
          aria-label="실시간 정보 새로고침"
          className="-my-2.5 -mr-2 inline-flex size-10 items-center justify-center rounded-full text-muted hover:bg-fill"
        >
          <RefreshIcon size={15} />
        </button>
      )}
    </span>
  );
}
