"use client";

import { useState } from "react";
import { BusGlyph, ClockIcon, RefreshIcon } from "@/assets/icons";
import { BUS_TYPE_LABEL, legBusColor } from "@/utils/format";
import { formatShortClock } from "@/utils/ribbon";
import type { BusArrival, BusLeg, LegLiveIssue } from "@/utils/types";

type ChipLeg = Pick<BusLeg, "routeNo" | "busType" | "boardStop">;

export const LIVE_ISSUE_LABEL: Record<LegLiveIssue, string> = {
  unavailable: "실시간 정보 없음",
  noBus: "다음 차 정보 없음",
};

/** 실시간 API가 예정 출발 시각을 안 주면 departAt은 빈 문자열 */
export function garageDepartLabel(departAt: string): string {
  return departAt ? `차고지 출발 예정 ${formatShortClock(departAt)}` : "차고지 출발 대기";
}

export function BusNumber({ leg, size = "md" }: { leg: ChipLeg; size?: "sm" | "md" }) {
  const { color, fg } = legBusColor(leg);
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-sm font-bold tabular ${
        size === "sm" ? "h-5 min-w-5 px-1.5 text-xs" : "h-5.5 min-w-8 px-1.5 text-xs"
      }`}
      style={{ backgroundColor: color, color: fg }}
    >
      <span className="sr-only">{BUS_TYPE_LABEL[leg.busType]} </span>
      {leg.routeNo}
    </span>
  );
}

export function BusBadge({ leg }: { leg: ChipLeg }) {
  return (
    <span className="inline-flex shrink-0 items-center gap-1 text-sm font-bold text-fg tabular">
      <BusGlyph size={16} style={{ color: legBusColor(leg).color }} />
      <span className="sr-only">{BUS_TYPE_LABEL[leg.busType]} </span>
      {leg.routeNo}
    </span>
  );
}

export function RunLabelBadge({ runLabel }: { runLabel: "first" | "last" }) {
  return (
    <span
      className={`inline-flex h-5 shrink-0 items-center rounded-full px-2 text-xs font-semibold ${
        runLabel === "last" ? "bg-danger-soft text-danger" : "bg-surface-muted text-fg-secondary"
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
    return <span className="text-xs text-fg-muted line-through tabular">{text}</span>;
  }
  return (
    <span className="inline-flex min-w-0 items-center gap-1.5 text-xs tabular">
      {status.kind === "live" && (
        <>
          <span className="font-semibold whitespace-nowrap text-realtime">
            {status.minutes <= 1 ? "곧 도착" : `${status.minutes}분`}
          </span>
          <span className="truncate text-fg-muted">{status.stopsAway}정류장 전</span>
        </>
      )}
      {status.kind === "garage" && (
        <span className="truncate font-semibold text-status-tight">{garageDepartLabel(status.departAt)}</span>
      )}
      {status.kind === "ended" && <span className="text-fg-muted">운행 종료</span>}
      {arrival.runLabel && <RunLabelBadge runLabel={arrival.runLabel} />}
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
    <p className="flex items-start gap-1 text-xs text-status-tight">
      <ClockIcon size={14} className="mt-px shrink-0" />
      <span className="tabular">
        {missedInMinutes}분 뒤 {routeNo}번은 어려워요, <strong className="font-semibold">다음 {routeNo} 기준</strong>이에요
      </span>
    </p>
  );
}

// 응답이 빨라도 눌렀다는 게 보이도록 한 바퀴는 돈다
const MIN_SPIN_MS = 600;

export function StaleBadge({
  secondsAgo,
  onRefresh,
}: {
  secondsAgo: number;
  onRefresh?: () => unknown;
}) {
  const [spinning, setSpinning] = useState(false);
  const stale = secondsAgo >= 60;
  const label = secondsAgo < 60 ? `${secondsAgo}초 전 정보` : `${Math.floor(secondsAgo / 60)}분 전 정보`;
  return (
    <span className={`inline-flex items-center gap-0.5 text-xs whitespace-nowrap tabular ${stale ? "text-status-tight" : "text-fg-muted"}`}>
      <span>{label}</span>
      {onRefresh && (
        <button
          type="button"
          onClick={() => {
            setSpinning(true);
            const minSpin = new Promise((resolve) => setTimeout(resolve, MIN_SPIN_MS));
            void Promise.allSettled([Promise.resolve(onRefresh()), minSpin]).then(() => setSpinning(false));
          }}
          disabled={spinning}
          aria-label="실시간 정보 새로고침"
          aria-busy={spinning}
          className="-my-3 -mr-2 inline-flex size-11 items-center justify-center rounded-full text-fg-muted hover:bg-action-secondary disabled:hover:bg-transparent"
        >
          <RefreshIcon size={15} className={spinning ? "motion-safe:animate-spin" : undefined} />
        </button>
      )}
    </span>
  );
}
