"use client";

import { useId } from "react";
import { BellIcon, BellOffIcon, CheckIcon } from "@/assets/icons";
import type { NotifyState } from "@/utils/types";

const DENIED_HINT = "브라우저 설정에서 알림을 허용해 주세요";

type Variant = "block" | "primary" | "compact";

const LABEL: Record<NotifyState, string> = {
  idle: "출발 알림 받기",
  on: "출발 알림 켜짐",
  denied: "알림 차단됨",
};

const NEXT: Record<NotifyState, NotifyState> = { idle: "on", on: "idle", denied: "denied" };

const TONE: Record<Variant, Record<NotifyState, string>> = {
  block: {
    idle: "h-9 w-full rounded-md bg-brand text-fg hover:bg-brand-strong",
    on: "h-9 w-full rounded-md border border-brand-ink/30 bg-brand-soft text-brand-ink",
    denied: "h-9 w-full rounded-md border border-border bg-surface-muted text-fg-subtle",
  },
  primary: {
    idle: "h-11 rounded-lg bg-brand px-5 text-fg hover:bg-brand-strong",
    on: "h-11 rounded-lg border border-brand-ink/30 bg-brand-soft px-5 text-brand-ink",
    denied: "h-11 rounded-lg bg-bg px-5 text-fg-muted",
  },
  compact: {
    idle: "h-8 rounded-full border border-border-strong bg-surface px-3 text-fg-secondary hover:bg-surface-muted",
    on: "h-8 rounded-full bg-brand-soft px-3 text-brand-ink",
    denied: "h-8 rounded-full bg-bg px-3 text-fg-subtle",
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
  return <p className="truncate text-xs text-fg-muted">{DENIED_HINT}</p>;
}
