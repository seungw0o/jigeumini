import type { ReactNode } from "react";
import { BusStopIcon, HistoryIcon, PinIcon, StarFilledIcon } from "@/assets/icons";

export type ChipKey = "favorites" | "stops" | "recentRoutes" | "frequent";

const CHIPS: { key: ChipKey; label: string; icon: ReactNode }[] = [
  { key: "favorites", label: "즐겨찾기", icon: <StarFilledIcon size={16} className="text-brand" /> },
  { key: "stops", label: "정류장", icon: <BusStopIcon size={16} strokeWidth={2.2} className="text-bus-trunk" /> },
  { key: "recentRoutes", label: "최근 경로", icon: <HistoryIcon size={16} strokeWidth={2.2} className="text-fg-secondary" /> },
  { key: "frequent", label: "자주 가는 곳", icon: <PinIcon size={16} strokeWidth={2.2} className="text-bus-outer" /> },
];

export function CategoryChips({
  active,
  onToggle,
}: {
  active: ChipKey | null;
  onToggle: (key: ChipKey) => void;
}) {
  return (
    <div
      role="group"
      aria-label="빠른 찾기"
      className="no-scrollbar -mx-3 flex gap-1.5 overflow-x-auto px-3 py-1 lg:mx-0 lg:flex-wrap lg:overflow-visible lg:px-0"
    >
      {CHIPS.map((chip) => {
        const pressed = active === chip.key;
        return (
          <button
            key={chip.key}
            type="button"
            aria-pressed={pressed}
            onClick={() => onToggle(chip.key)}
            className={`relative flex h-8 shrink-0 items-center gap-1 rounded-md px-3 text-xs font-semibold whitespace-nowrap shadow-float transition-colors before:absolute before:inset-x-0 before:-inset-y-1.5 lg:shadow-none ${
              pressed
                ? "bg-fg text-fg-inverse lg:border lg:border-fg"
                : "bg-surface text-fg hover:bg-surface-muted lg:border lg:border-border"
            }`}
          >
            {chip.icon}
            {chip.label}
          </button>
        );
      })}
    </div>
  );
}
