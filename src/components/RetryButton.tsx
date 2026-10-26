"use client";

import { useEffect, useRef } from "react";
import { RefreshIcon } from "@/assets/icons";
import { showToast } from "@/components/Toast";
import { usePendingAction } from "@/hooks/usePendingAction";

const DEFAULT_FAIL_MESSAGE = "아직 안 돼요. 잠시 후 다시 시도해 주세요";

const VARIANT = {
  state: "h-control min-w-40 px-5 bg-action-primary text-action-primary-fg hover:bg-action-primary-pressed",
  inline: "h-11 px-4 bg-action-secondary text-action-secondary-fg hover:bg-action-secondary-pressed",
};

export function RetryButton({
  onRetry,
  variant = "inline",
  failMessage = DEFAULT_FAIL_MESSAGE,
}: {
  onRetry: () => unknown;
  variant?: keyof typeof VARIANT;
  /** null이면 토스트를 띄우지 않는다 (결과를 바로 알 수 없는 재시도) */
  failMessage?: string | null;
}) {
  const { pending, run } = usePendingAction(onRetry);
  const wasPending = useRef(false);
  // 다시 시도가 성공하면 이 버튼이 있던 안내·오류 화면이 사라진다. 끝났는데도 남아 있으면 또 실패한 것
  useEffect(() => {
    if (wasPending.current && !pending && failMessage) showToast(failMessage);
    wasPending.current = pending;
  }, [pending, failMessage]);
  return (
    <button
      type="button"
      onClick={run}
      disabled={pending}
      aria-busy={pending}
      className={`inline-flex shrink-0 items-center justify-center gap-1.5 rounded-md text-sm font-semibold disabled:opacity-80 ${VARIANT[variant]}`}
    >
      {pending && <RefreshIcon size={15} className="motion-safe:animate-spin" aria-hidden />}
      {pending ? "다시 시도 중" : "다시 시도"}
    </button>
  );
}
