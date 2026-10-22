import type { ReactNode } from "react";
import { BusStopIcon, HistoryIcon, StarFilledIcon, SubwayIcon } from "@/assets/icons";

export type ChipKey = "favorites" | "stops" | "subway" | "recentRoutes" | "home";

function HomeIcon({ size = 16, className }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
      className={className}
    >
      <path fill="currentColor" d="M12 3.2 2.8 11h2.7v9.3h5.2v-5.6h2.6v5.6h5.2V11h2.7L12 3.2Z" />
    </svg>
  );
}

const CHIPS: { key: ChipKey; label: string; icon: ReactNode }[] = [
  { key: "favorites", label: "즐겨찾기", icon: <StarFilledIcon size={16} className="text-[#f5a400]" /> },
  { key: "stops", label: "정류장", icon: <BusStopIcon size={16} strokeWidth={2.2} className="text-bus-trunk" /> },
  { key: "subway", label: "지하철역", icon: <SubwayIcon size={16} strokeWidth={2.2} className="text-bus-branch" /> },
  { key: "recentRoutes", label: "최근 경로", icon: <HistoryIcon size={16} strokeWidth={2.2} className="text-ink-2" /> },
  { key: "home", label: "집", icon: <HomeIcon size={16} className="text-bus-outer" /> },
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
            className={`relative flex h-8 shrink-0 items-center gap-1 rounded-full px-3 text-13 font-semibold whitespace-nowrap shadow-float transition-colors before:absolute before:-inset-x-0 before:-inset-y-1 lg:shadow-none ${
              pressed
                ? "bg-ink text-white"
                : "bg-surface text-ink hover:bg-fill lg:border lg:border-line"
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
