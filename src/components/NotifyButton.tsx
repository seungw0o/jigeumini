"use client";

import { useId } from "react";
import { BellIcon, BellOffIcon, CheckIcon } from "@/assets/icons";
import { useDesktopDevice } from "@/hooks/useDesktopDevice";
import type { NotifyState } from "@/utils/types";

const DENIED_HINT = "브라우저 설정에서 알림을 허용해 주세요";
// 웹 푸시는 홈 화면에 추가한 앱에서만 된다 (iOS Safari)
const INSTALL_HINT = "홈 화면에 추가하면 출발 알림을 받을 수 있어요";
// 푸시 설정(VAPID 키, 워커 주소)이 없는 배포에서는 알림을 보낼 수 없다
const UNAVAILABLE_HINT = "지금은 출발 알림을 보낼 수 없어요";
// 푸시 구독은 기기마다 따로라, 컴퓨터에서 켜면 휴대폰이 아니라 그 컴퓨터로 온다
const DESKTOP_HINT = "알림은 이 컴퓨터로 와요";
const HINT = "truncate text-xs text-fg-muted";

type Variant = "block" | "primary";

const LABEL: Record<NotifyState, string> = {
  idle: "출발 알림 받기",
  on: "출발 알림 켜짐",
  denied: "알림 차단됨",
  unavailable: "출발 알림 받기",
};

const NEXT: Record<NotifyState, NotifyState> = { idle: "on", on: "idle", denied: "denied", unavailable: "unavailable" };

const TONE: Record<Variant, Record<NotifyState, string>> = {
  block: {
    idle: "h-11 w-full rounded-md bg-action-secondary text-action-secondary-fg hover:bg-action-secondary-pressed",
    on: "h-11 w-full rounded-md bg-brand-soft text-brand-ink",
    denied: "h-11 w-full rounded-md bg-surface-muted text-fg-muted",
    unavailable: "h-11 w-full rounded-md bg-surface-muted text-fg-muted",
  },
  primary: {
    idle: "h-control rounded-md bg-action-primary px-5 text-action-primary-fg hover:bg-action-primary-pressed",
    on: "h-control rounded-md bg-brand-soft px-5 text-brand-ink",
    denied: "h-control rounded-md bg-surface-muted px-5 text-fg-muted",
    unavailable: "h-control rounded-md bg-surface-muted px-5 text-fg-muted",
  },
};

export function NotifyButton({
  state,
  onChange,
  variant = "block",
}: {
  state: NotifyState;
  onChange: (next: NotifyState) => void;
  variant?: Variant;
}) {
  const hintId = useId();
  const Icon = state === "on" ? CheckIcon : state === "denied" || state === "unavailable" ? BellOffIcon : BellIcon;
  const hint = state === "denied" ? DENIED_HINT : state === "unavailable" ? UNAVAILABLE_HINT : null;

  return (
    <>
      <button
        type="button"
        onClick={() => onChange(NEXT[state])}
        disabled={state === "unavailable"}
        aria-pressed={state === "on"}
        aria-describedby={hint ? hintId : undefined}
        className={`inline-flex shrink-0 items-center justify-center gap-1.5 text-sm font-semibold whitespace-nowrap ${TONE[variant][state]}`}
      >
        <Icon size={17} className="shrink-0" />
        {LABEL[state]}
      </button>
      {hint && (
        <span id={hintId} className="sr-only">
          {hint}
        </span>
      )}
    </>
  );
}

export function NotifyDeniedHint() {
  return <p className={HINT}>{DENIED_HINT}</p>;
}

export function NotifyDesktopHint({ state }: { state: NotifyState }) {
  const desktop = useDesktopDevice();
  if (!desktop || (state !== "idle" && state !== "on")) return null;
  return <p className={HINT}>{DESKTOP_HINT}</p>;
}

export function NotifyUnavailableHint() {
  return <p className={HINT}>{UNAVAILABLE_HINT}</p>;
}

export function NotifyInstallHint() {
  return (
    <p role="status" className={HINT}>
      {INSTALL_HINT}
    </p>
  );
}
