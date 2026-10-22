"use client";

import { useRef, type KeyboardEvent } from "react";

export type ResultTab = "all" | "bus" | "subway" | "mixed";

const TABS: { key: ResultTab; label: string }[] = [
  { key: "all", label: "전체" },
  { key: "bus", label: "버스" },
  { key: "subway", label: "지하철" },
  { key: "mixed", label: "버스+지하철" },
];

export const resultTabId = (key: ResultTab) => `route-tab-${key}`;
export const RESULT_PANEL_ID = "route-tabpanel";

export function ResultTabs({
  value,
  counts,
  onChange,
}: {
  value: ResultTab;
  counts: Record<ResultTab, number>;
  onChange: (next: ResultTab) => void;
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  function handleKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    e.preventDefault();
    const current = TABS.findIndex((t) => t.key === value);
    const next = (current + (e.key === "ArrowRight" ? 1 : -1) + TABS.length) % TABS.length;
    onChange(TABS[next].key);
    refs.current[next]?.focus();
  }

  return (
    <div
      role="tablist"
      aria-label="경로 종류"
      onKeyDown={handleKeyDown}
      className="no-scrollbar flex h-11 gap-5 overflow-x-auto border-b border-line px-4"
    >
      {TABS.map((tab, i) => {
        const active = tab.key === value;
        return (
          <button
            key={tab.key}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role="tab"
            id={resultTabId(tab.key)}
            aria-selected={active}
            aria-controls={RESULT_PANEL_ID}
            tabIndex={active ? 0 : -1}
            onClick={() => onChange(tab.key)}
            className={`relative shrink-0 text-15 whitespace-nowrap tabular ${
              active
                ? "font-bold text-ink after:absolute after:inset-x-0 after:-bottom-px after:h-0.5 after:bg-ink"
                : "text-subtle hover:text-muted"
            }`}
          >
            {tab.label} {counts[tab.key]}
          </button>
        );
      })}
    </div>
  );
}
