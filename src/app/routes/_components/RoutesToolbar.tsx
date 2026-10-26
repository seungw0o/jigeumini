"use client";

import { ChevronDownIcon } from "@/assets/icons";
import type { RouteSortKey } from "@/utils/types";

const SORT_OPTIONS: { key: RouteSortKey; label: string }[] = [
  { key: "arrival", label: "도착 빠른 순" },
  { key: "walk", label: "도보 짧은 순" },
  { key: "transfer", label: "환승 적은 순" },
];

function isSortKey(value: string): value is RouteSortKey {
  return SORT_OPTIONS.some((o) => o.key === value);
}

export function RoutesToolbar({
  sort,
  onSortChange,
}: {
  sort: RouteSortKey;
  onSortChange?: (next: RouteSortKey) => void;
}) {
  return (
    <div className="flex h-14 items-center border-b border-divider px-4">
      <label className="relative inline-flex h-11 shrink-0 items-center">
        <span className="sr-only">정렬</span>
        <select
          value={sort}
          disabled={!onSortChange}
          onChange={(e) => {
            if (isSortKey(e.target.value)) onSortChange?.(e.target.value);
          }}
          className="h-11 cursor-pointer appearance-none rounded-md bg-transparent pr-7 pl-2.5 text-sm font-medium text-fg-secondary hover:bg-action-secondary disabled:cursor-default"
        >
          {SORT_OPTIONS.map((o) => (
            <option key={o.key} value={o.key}>
              {o.label}
            </option>
          ))}
        </select>
        <ChevronDownIcon size={16} className="pointer-events-none absolute right-2 text-fg-muted" />
      </label>
    </div>
  );
}
