import type { ComponentType } from "react";
import { BellIcon, MapIcon, RouteIcon, StarIcon } from "@/assets/icons";

export type TabKey = "map" | "route" | "favorites" | "alerts";

const TABS: { key: TabKey; label: string; Icon: ComponentType<{ size?: number }> }[] = [
  { key: "map", label: "지도", Icon: MapIcon },
  { key: "route", label: "길찾기", Icon: RouteIcon },
  { key: "favorites", label: "즐겨찾기", Icon: StarIcon },
  { key: "alerts", label: "알림", Icon: BellIcon },
];

export function BottomTabBar({
  active,
  onSelect,
}: {
  active: TabKey;
  onSelect: (key: TabKey) => void;
}) {
  return (
    <nav
      aria-label="주요 메뉴"
      className="fixed inset-x-0 bottom-0 z-40 bg-surface pb-[env(safe-area-inset-bottom)] shadow-bar lg:hidden"
    >
      <ul className="grid h-row grid-cols-4">
        {TABS.map(({ key, label, Icon }) => {
          const current = active === key;
          return (
            <li key={key} className="flex">
              <button
                type="button"
                aria-current={current ? "page" : undefined}
                onClick={() => onSelect(key)}
                className={`flex flex-1 flex-col items-center justify-center gap-0.5 text-2xs focus-visible:-outline-offset-2 ${
                  current ? "font-bold text-fg" : "font-medium text-fg-muted hover:text-fg-secondary"
                }`}
              >
                <span
                  aria-hidden="true"
                  className={`flex h-7 w-14 items-center justify-center rounded-full transition-colors ${
                    current ? "bg-brand-soft" : ""
                  }`}
                >
                  <Icon size={22} />
                </span>
                {label}
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
