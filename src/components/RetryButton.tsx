"use client";

import { RefreshIcon } from "@/assets/icons";
import { usePendingAction } from "@/hooks/usePendingAction";

const VARIANT = {
  state: "h-control min-w-40 px-5 bg-action-primary text-action-primary-fg hover:bg-action-primary-pressed",
  inline: "h-11 px-4 bg-action-secondary text-action-secondary-fg hover:bg-action-secondary-pressed",
};

export function RetryButton({ onRetry, variant = "inline" }: { onRetry: () => unknown; variant?: keyof typeof VARIANT }) {
  const { pending, run } = usePendingAction(onRetry);
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
