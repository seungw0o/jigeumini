import Link from "next/link";
import { LeaveBadge } from "@/components/LeaveBadge";
import { NotifyButton } from "@/components/NotifyButton";
import {
  ArrivalText,
  BusNumber,
  LIVE_ISSUE_LABEL,
  MissedBusNotice,
  RunLabelBadge,
} from "@/components/StatusChips";
import { TimeRibbon } from "@/components/TimeRibbon";
import {
  formatFare,
  isLiveTimed,
  leaveLabel,
  realtimeBadgeLabel,
  realtimeNote,
  totalLabel,
  transferLabel,
} from "@/utils/format";
import { formatShortClock } from "@/utils/ribbon";
import type { BusArrival, BusLeg, NotifyState, TransitRoute } from "@/utils/types";

function liveMinutes(arrival: BusArrival | undefined): number | null {
  return arrival?.status.kind === "live" ? arrival.status.minutes : null;
}

function CatchArrival({ arrival }: { arrival: BusArrival }) {
  const { status } = arrival;
  if (status.kind !== "live") return <ArrivalText arrival={arrival} />;
  return (
    <span className="inline-flex min-w-0 items-center gap-1.5">
      <span className="truncate">
        <span className="font-semibold text-realtime tabular">{status.minutes <= 1 ? "곧 도착" : `${status.minutes}분`}</span>
        <span className="text-fg-muted"> · {status.stopsAway}정류장 전</span>
      </span>
      {arrival.runLabel && <RunLabelBadge runLabel={arrival.runLabel} />}
    </span>
  );
}

function nextArrivalText(arrival: BusArrival | undefined): string | null {
  if (!arrival) return null;
  const { status } = arrival;
  if (status.kind === "live") return `다음 ${status.minutes}분`;
  if (status.kind === "garage") return status.departAt ? `다음 ${formatShortClock(status.departAt)} 출발` : "다음 차고지 대기";
  return null;
}

function BoardRow({
  leg,
  live,
  pending,
  quickTransferChance,
}: {
  leg: BusLeg;
  live: boolean;
  pending: boolean;
  quickTransferChance?: number;
}) {
  const catchArrival = leg.liveIssue ? undefined : leg.arrivals[leg.catchIndex];
  const next = nextArrivalText(leg.arrivals[leg.catchIndex + 1]);
  const missedIn = live && !leg.liveIssue && leg.catchIndex > 0 ? liveMinutes(leg.arrivals[0]) : null;
  const statusText = leg.liveIssue ? LIVE_ISSUE_LABEL[leg.liveIssue] : !catchArrival && pending ? "실시간 확인 중" : null;

  return (
    <li className="grid grid-cols-[48px_minmax(0,1fr)]">
      <div>
        <BusNumber routeNo={leg.routeNo} busType={leg.busType} />
      </div>
      <div className="min-w-0">
        <div className="flex h-5.5 min-w-0 items-center gap-1 text-xs">
          <span className="min-w-0 truncate font-semibold text-fg-secondary">{leg.boardStop.name}</span>
          <span className="shrink-0 text-fg-muted">승차</span>
          {quickTransferChance !== undefined && (
            <span className="ml-auto shrink-0 pl-2 text-fg-muted tabular">바로 환승 {quickTransferChance}%</span>
          )}
        </div>
        {statusText && <p className="flex h-5 min-w-0 items-center text-xs whitespace-nowrap text-realtime-missing">{statusText}</p>}
        {catchArrival && (
          <p className="flex h-5 min-w-0 items-center gap-2 text-xs whitespace-nowrap tabular">
            <CatchArrival arrival={catchArrival} />
            {next && <span className="shrink-0 text-fg-muted">{next}</span>}
          </p>
        )}
        {missedIn !== null && (
          <div className="mt-1">
            <MissedBusNotice routeNo={leg.routeNo} missedInMinutes={missedIn} />
          </div>
        )}
      </div>
    </li>
  );
}

export function RouteCard({
  route,
  href,
  now,
  badge,
  notifyState,
  onNotifyChange,
}: {
  route: TransitRoute;
  href: string;
  now: string;
  badge?: string;
  notifyState: NotifyState;
  onNotifyChange: (next: NotifyState) => void;
}) {
  const busLegs = route.legs.filter((leg): leg is BusLeg => leg.kind === "bus");
  const lastBus = busLegs[busLegs.length - 1];
  const arrive = formatShortClock(route.arriveAt);
  const live = isLiveTimed(route);
  const pending = route.realtime === "loading";
  const note = live ? null : realtimeNote(route);
  const arriveSuffix = route.realtime === "partial" ? " 이후" : "";
  const arriveSpoken = live ? `도착 예상 ${arrive}${arriveSuffix}` : (note ?? "도착 예상 확인 중");

  return (
    <article className="relative rounded-lg bg-surface p-4 shadow-card">
      {badge && <p className="mb-2 text-xs font-semibold text-brand-ink">{badge}</p>}
      <Link
        href={href}
        aria-label={`${totalLabel(route)}, ${arriveSpoken}, ${realtimeBadgeLabel(route) ?? leaveLabel(route)}`}
        className="flex items-center justify-between gap-3 rounded-md after:absolute after:inset-0 after:rounded-lg"
      >
        <span className="min-w-0 truncate text-lg font-bold text-fg tabular">{totalLabel(route)}</span>
        <LeaveBadge route={route} />
      </Link>
      {/* 시간 범위·요금·환승을 한 줄 요약으로 (오너 요청: 큰 글자 대신 깔끔한 요약 줄) */}
      <p className="mt-1 flex min-w-0 text-xs whitespace-nowrap text-fg-secondary tabular">
        {(live || pending) && (
          <span className="shrink-0">
            {live ? (
              <>
                {formatShortClock(route.leaveAt)} 출발 – <span className="font-semibold text-fg">{arrive}</span> 도착 예상
                {arriveSuffix}
              </>
            ) : (
              "도착 예상 확인 중"
            )}
            &nbsp;·&nbsp;
          </span>
        )}
        <span className="shrink-0">{formatFare(route.fare)} ·&nbsp;</span>
        <span className="truncate">{transferLabel(route.transferCount)}</span>
      </p>
      {note && <p className="mt-0.5 text-xs text-fg-secondary">{note}</p>}

      <TimeRibbon route={route} now={now} variant="compact" className="mt-4" />

      {lastBus && (
        <ol className="mt-3 flex flex-col gap-2 border-t border-divider pt-3">
          {busLegs.map((leg, i) => (
            <BoardRow
              key={`${leg.routeNo}-${leg.boardStop.id}`}
              leg={leg}
              live={live}
              pending={pending}
              quickTransferChance={i > 0 ? route.quickTransferChance : undefined}
            />
          ))}
          <li className="grid h-5.5 grid-cols-[48px_minmax(0,1fr)] items-center text-xs">
            <span className="font-semibold text-fg-muted">하차</span>
            <span className="min-w-0 truncate font-semibold text-fg-secondary">{lastBus.alightStop.name}</span>
          </li>
        </ol>
      )}

      {(live || pending) && (
        // 확인 중에는 자리만 잡아 두어 실시간이 들어와도 카드 높이가 그대로다
        <div className={`relative z-10 mt-4 ${live ? "" : "invisible"}`} aria-hidden={live ? undefined : true}>
          <NotifyButton variant="block" state={notifyState} onChange={onNotifyChange} />
        </div>
      )}
    </article>
  );
}
