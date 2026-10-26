import type { ReactNode } from "react";
import { BellIcon, HistoryIcon, StarFilledIcon } from "@/assets/icons";

export type ChipKey = "favorites" | "recentRoutes" | "alerts";

// 모바일은 하단 탭에 알림이 있어, 알림 칩은 데스크톱에서만 보인다
const CHIPS: { key: ChipKey; label: string; icon: ReactNode; desktopOnly?: boolean }[] = [
  { key: "favorites", label: "즐겨찾기", icon: <StarFilledIcon size={16} className="text-brand" /> },
  { key: "recentRoutes", label: "최근 경로", icon: <HistoryIcon size={16} strokeWidth={2.2} /> },
  { key: "alerts", label: "알림", icon: <BellIcon size={16} />, desktopOnly: true },
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
      className="no-scrollbar -mx-3 flex gap-2 overflow-x-auto px-3 py-0.5 lg:mx-0 lg:flex-wrap lg:overflow-visible lg:px-0"
    >
      {CHIPS.map((chip) => {
        const pressed = active === chip.key;
        return (
          <button
            key={chip.key}
            type="button"
            aria-pressed={pressed}
            onClick={() => onToggle(chip.key)}
            className={`relative ${chip.desktopOnly ? "hidden lg:flex" : "flex"} h-9 shrink-0 items-center gap-1.5 rounded-full px-3.5 text-xs font-semibold whitespace-nowrap transition-colors before:absolute before:inset-x-0 before:-inset-y-1 ${
              pressed
                ? "bg-surface-inverse text-fg-inverse shadow-float lg:shadow-none"
                : "bg-surface text-fg-secondary shadow-float hover:bg-surface-muted lg:shadow-none lg:ring-1 lg:ring-border lg:ring-inset"
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
