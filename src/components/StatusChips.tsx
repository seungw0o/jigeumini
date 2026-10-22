import { BusIcon, ClockIcon, RefreshIcon } from "@/assets/icons";
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
      className={`inline-flex shrink-0 items-center gap-1 rounded-sm font-semibold text-white tabular ${
        size === "sm" ? "h-5 px-1.5 text-xs" : "h-6 px-2 text-sm"
      }`}
      style={{ backgroundColor: meta.color }}
    >
      <span className="sr-only">{meta.label} </span>
      {routeNo}
    </span>
  );
}

export function BusTypeLabel({ busType }: { busType: BusType }) {
  const meta = BUS_TYPE_META[busType];
  return (
    <span className="inline-flex items-center gap-1 text-sm font-semibold" style={{ color: meta.color }}>
      <BusIcon size={16} />
      {meta.label}
    </span>
  );
}

export function RunLabelBadge({ runLabel }: { runLabel: "first" | "last" }) {
  return (
    <span
      className={`inline-flex h-5 shrink-0 items-center rounded-sm border px-1.5 text-xs font-semibold ${
        runLabel === "last"
          ? "border-danger/30 bg-danger-soft text-danger"
          : "border-line-strong bg-surface text-ink-2"
      }`}
    >
      {runLabel === "last" ? "막차" : "첫차"}
    </span>
  );
}

export function ArrivalChip({ arrival, missed = false }: { arrival: BusArrival; missed?: boolean }) {
  const { status } = arrival;
  let main: string;
  let sub: string | null = null;
  let tone = "bg-accent-soft text-accent-strong";

  if (status.kind === "live") {
    main = status.minutes <= 1 ? "곧 도착" : `${status.minutes}분 뒤 도착`;
    sub = `${status.stopsAway}정류장 전`;
  } else if (status.kind === "garage") {
    main = `${status.departAt} 출발 예정`;
    sub = "차고지 대기";
    tone = "bg-warn-soft text-warn";
  } else {
    main = "운행 종료";
    tone = "bg-canvas text-muted";
  }
  if (missed) tone = "bg-canvas text-muted line-through decoration-1";

  return (
    <span className={`inline-flex h-7 max-w-full items-center gap-1.5 rounded-md px-2 text-sm tabular ${tone}`}>
      <span className="truncate font-semibold">{main}</span>
      {sub && <span className="truncate opacity-80">{sub}</span>}
      {arrival.runLabel && !missed && <RunLabelBadge runLabel={arrival.runLabel} />}
    </span>
  );
}

export function MissedBusNotice({
  routeNo,
  missedInMinutes,
  nextInMinutes,
}: {
  routeNo: string;
  missedInMinutes: number;
  nextInMinutes: number;
}) {
  return (
    <p className="flex items-start gap-1.5 text-sm text-warn">
      <ClockIcon size={16} className="mt-0.5 shrink-0" />
      <span>
        {missedInMinutes}분 뒤 {routeNo}번은 걸어가면 놓쳐요. 다음 차 <strong className="tabular">{nextInMinutes}분 뒤</strong>
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
    <span className={`inline-flex items-center gap-1 text-sm tabular ${stale ? "text-warn" : "text-muted"}`}>
      <span>{label}</span>
      {onRefresh && (
        <button
          type="button"
          onClick={onRefresh}
          aria-label="실시간 정보 새로고침"
          className="-my-2 inline-flex size-11 items-center justify-center rounded-md text-ink-2 hover:bg-canvas"
        >
          <RefreshIcon size={18} />
        </button>
      )}
    </span>
  );
}
