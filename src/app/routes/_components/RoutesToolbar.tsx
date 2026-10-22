"use client";

import { ChevronDownIcon } from "@/assets/icons";
import { StaleBadge } from "@/components/StatusChips";
import type { RouteSortKey } from "@/utils/types";

export const SORT_OPTIONS: { key: RouteSortKey; label: string }[] = [
  { key: "arrival", label: "빠른 도착순" },
  { key: "walk", label: "적게 걷는 순" },
  { key: "transfer", label: "환승 적은 순" },
];

function isSortKey(value: string): value is RouteSortKey {
  return SORT_OPTIONS.some((o) => o.key === value);
}

export function RoutesToolbar({
  baseTime,
  secondsAgo,
  onRefresh,
  sort,
  onSortChange,
}: {
  baseTime: string;
  secondsAgo: number;
  onRefresh?: () => void;
  sort: RouteSortKey;
  onSortChange?: (next: RouteSortKey) => void;
}) {
  return (
    <div className="flex h-11 items-center justify-between gap-2 border-b border-line px-4">
      <div className="flex min-w-0 items-center gap-2.5">
        <button
          type="button"
          aria-haspopup="listbox"
          aria-expanded="false"
          className="-ml-1 inline-flex h-11 shrink-0 items-center gap-0.5 px-1 text-sm whitespace-nowrap"
        >
          <span className="font-semibold text-accent tabular">오늘 {baseTime}</span>
          <span className="ml-1 font-semibold text-ink">출발</span>
          <ChevronDownIcon size={16} className="text-ink-2" />
        </button>
        <span className="min-w-0 max-[359px]:hidden">
          <StaleBadge secondsAgo={secondsAgo} onRefresh={onRefresh} />
        </span>
      </div>
      <label className="relative -mr-1 inline-flex h-11 shrink-0 items-center">
        <span className="sr-only">정렬</span>
        <select
          value={sort}
          disabled={!onSortChange}
          onChange={(e) => {
            if (isSortKey(e.target.value)) onSortChange?.(e.target.value);
          }}
          className="h-11 cursor-pointer appearance-none bg-transparent pr-6 pl-1 text-13 text-ink-2 disabled:cursor-default"
        >
          {SORT_OPTIONS.map((o) => (
            <option key={o.key} value={o.key}>
              {o.label}
            </option>
          ))}
        </select>
        <ChevronDownIcon size={15} className="pointer-events-none absolute right-1 text-ink-2" />
      </label>
    </div>
  );
}
