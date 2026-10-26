"use client";

import { useState } from "react";
import type { Alert } from "@/apis/push/client";
import { BellIcon } from "@/assets/icons";
import { RetryButton } from "@/components/RetryButton";
import { showToast } from "@/components/Toast";
import { ALERT_OFF_FAILED_MESSAGE, usePendingAlerts } from "@/hooks/useDepartureAlerts";
import { kstClock } from "@/shared/estimate";
import { formatShortClock } from "@/utils/ribbon";
import { parseRoutePair } from "@/utils/routeQuery";

const NOTE = "px-gutter py-6 text-sm text-fg-muted";

function alertTitle(alert: Alert): string {
  const pair = parseRoutePair(new URLSearchParams(alert.pairQuery));
  return pair ? `${pair.origin.name} → ${pair.destination.name}` : "출발 알림";
}

function alertDetail(alert: Alert): string {
  const leaveBy = alert.leaveByAt ? `${formatShortClock(kstClock(Date.parse(alert.leaveByAt)))} 전에 출발` : "출발 시각 계산 중";
  const buses = alert.busNos && alert.busNos.length > 0 ? alert.busNos : [alert.routeNo];
  return `${buses.map((no) => `${no}번`).join(" → ")} · ${leaveBy}`;
}

export function AlertsList({ onOpen }: { onOpen: (href: string) => void }) {
  const { env, query, remove, authStatus } = usePendingAlerts();
  const [busy, setBusy] = useState<Set<string>>(() => new Set());

  if (env === "local") return <p className={NOTE}>지금은 출발 알림을 보낼 수 없어요</p>;
  if (env === "install") return <p className={NOTE}>홈 화면에 추가하면 출발 알림을 받을 수 있어요</p>;
  if (authStatus === "error" || query.isError) {
    return (
      <div className="flex items-center justify-between gap-3 px-gutter py-4">
        <p className="text-sm text-fg-muted">알림을 불러오지 못했어요</p>
        <RetryButton onRetry={() => query.refetch()} failMessage="아직 알림을 불러오지 못했어요" />
      </div>
    );
  }
  if (env === "unknown" || query.isPending) return <p className={NOTE}>알림을 불러오고 있어요</p>;

  const alerts = query.data.filter((a) => a.status === "pending");
  if (alerts.length === 0) {
    return <p className={NOTE}>켜 둔 출발 알림이 없어요. 경로에서 출발 알림을 받아 보세요.</p>;
  }

  function turnOff(alert: Alert) {
    setBusy((prev) => new Set(prev).add(alert.id));
    remove(alert)
      .catch((error: unknown) => {
        console.error("alert off failed:", error instanceof Error ? error.message : error);
        showToast(ALERT_OFF_FAILED_MESSAGE);
      })
      .finally(() =>
        setBusy((prev) => {
          const next = new Set(prev);
          next.delete(alert.id);
          return next;
        }),
      );
  }

  return (
    <ul className="divide-y divide-divider">
      {alerts.map((alert) => {
        const title = alertTitle(alert);
        return (
          <li key={alert.id} className="flex items-center">
            <button
              type="button"
              onClick={() => onOpen(`/routes/${encodeURIComponent(alert.routeId)}?${alert.pairQuery}`)}
              className="flex h-row min-w-0 flex-1 items-center gap-3 pl-gutter text-left hover:bg-surface-muted focus-visible:-outline-offset-2"
            >
              <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-brand-soft text-brand-ink">
                <BellIcon size={18} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold text-fg">{title}</span>
                <span className="block truncate text-xs text-fg-muted tabular">{alertDetail(alert)}</span>
              </span>
            </button>
            <button
              type="button"
              aria-label={`${title} 출발 알림 끄기`}
              disabled={busy.has(alert.id)}
              onClick={() => turnOff(alert)}
              className="mx-3 h-9 shrink-0 rounded-full bg-action-secondary px-3.5 text-xs font-semibold text-action-secondary-fg hover:bg-action-secondary-pressed disabled:opacity-50"
            >
              끄기
            </button>
          </li>
        );
      })}
    </ul>
  );
}
