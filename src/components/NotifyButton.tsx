"use client";

import { useId } from "react";
import { BellIcon, BellOffIcon, CheckIcon } from "@/assets/icons";
import type { NotifyState } from "@/utils/types";

const DENIED_HINT = "브라우저 설정에서 알림을 허용해 주세요";
// 웹 푸시는 홈 화면에 추가한 앱에서만 된다 (iOS Safari)
const INSTALL_HINT = "홈 화면에 추가하면 출발 알림을 받을 수 있어요";
const HINT = "truncate text-xs text-fg-muted";

type Variant = "block" | "primary" | "compact";

const LABEL: Record<NotifyState, string> = {
  idle: "출발 알림 받기",
  on: "출발 알림 켜짐",
  denied: "알림 차단됨",
};

const NEXT: Record<NotifyState, NotifyState> = { idle: "on", on: "idle", denied: "denied" };

const TONE: Record<Variant, Record<NotifyState, string>> = {
  block: {
    idle: "h-11 w-full rounded-md bg-action-secondary text-action-secondary-fg hover:bg-action-secondary-pressed",
    on: "h-11 w-full rounded-md bg-brand-soft text-brand-ink",
    denied: "h-11 w-full rounded-md bg-surface-muted text-fg-muted",
  },
  primary: {
    idle: "h-control rounded-md bg-action-primary px-5 text-action-primary-fg hover:bg-action-primary-pressed",
    on: "h-control rounded-md bg-brand-soft px-5 text-brand-ink",
    denied: "h-control rounded-md bg-surface-muted px-5 text-fg-muted",
  },
  compact: {
    idle: "h-8 rounded-full px-3 text-fg-secondary hover:bg-action-secondary",
    on: "h-8 rounded-full bg-brand-soft px-3 text-brand-ink",
    denied: "h-8 rounded-full px-3 text-fg-muted",
  },
};

export function NotifyButton({
  state,
  onChange,
  variant = "compact",
}: {
  state: NotifyState;
  onChange: (next: NotifyState) => void;
  variant?: Variant;
}) {
  const hintId = useId();
  const Icon = state === "on" ? CheckIcon : state === "denied" ? BellOffIcon : BellIcon;

  return (
    <>
      <button
        type="button"
        onClick={() => onChange(NEXT[state])}
        aria-pressed={state === "on"}
        aria-describedby={state === "denied" ? hintId : undefined}
        className={`relative inline-flex shrink-0 items-center justify-center gap-1.5 text-sm font-semibold whitespace-nowrap ${
          variant === "compact" ? "before:absolute before:-inset-1.5" : ""
        } ${TONE[variant][state]}`}
      >
        <Icon size={variant === "compact" ? 15 : 17} className="shrink-0" />
        {LABEL[state]}
      </button>
      {state === "denied" && (
        <span id={hintId} className="sr-only">
          {DENIED_HINT}
        </span>
      )}
    </>
  );
}

export function NotifyDeniedHint() {
  return <p className={HINT}>{DENIED_HINT}</p>;
}

export function NotifyInstallHint() {
  return (
    <p role="status" className={HINT}>
      {INSTALL_HINT}
    </p>
  );
}
