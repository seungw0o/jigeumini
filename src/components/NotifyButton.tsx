"use client";

import { useId } from "react";
import { BellIcon, BellOffIcon, CheckIcon } from "@/assets/icons";
import type { NotifyState } from "@/utils/types";

const DENIED_HINT = "브라우저 설정에서 알림을 허용해 주세요";

const VIEW: Record<NotifyState, { label: string; tone: string; next: NotifyState }> = {
  idle: { label: "알림 받기", tone: "border-line-strong bg-surface text-ink-2 hover:bg-canvas", next: "on" },
  on: { label: "알림 켜짐", tone: "border-transparent bg-accent-soft text-accent-strong", next: "idle" },
  denied: { label: "알림 차단됨", tone: "border-transparent bg-canvas text-muted", next: "denied" },
};

export function NotifyButton({ state, onChange }: { state: NotifyState; onChange: (next: NotifyState) => void }) {
  const hintId = useId();
  const view = VIEW[state];
  const Icon = state === "on" ? CheckIcon : state === "denied" ? BellOffIcon : BellIcon;

  return (
    <>
      <button
        type="button"
        onClick={() => onChange(view.next)}
        aria-pressed={state === "on"}
        aria-describedby={state === "denied" ? hintId : undefined}
        className={`inline-flex h-11 min-w-32 shrink-0 items-center justify-center gap-1.5 rounded-md border px-3 text-sm font-semibold whitespace-nowrap ${view.tone}`}
      >
        <Icon size={18} className="shrink-0" />
        {view.label}
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
  return <p className="truncate text-xs text-muted">{DENIED_HINT}</p>;
}
