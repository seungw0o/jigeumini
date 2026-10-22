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
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface pb-[env(safe-area-inset-bottom)] lg:hidden"
    >
      <ul className="grid h-14 grid-cols-4">
        {TABS.map(({ key, label, Icon }) => {
          const current = active === key;
          return (
            <li key={key} className="flex">
              <button
                type="button"
                aria-current={current ? "page" : undefined}
                onClick={() => onSelect(key)}
                className={`relative flex flex-1 flex-col items-center justify-center gap-0.5 text-2xs focus-visible:outline-offset-[-2px] ${
                  current ? "font-bold text-fg" : "text-fg-muted hover:text-fg-secondary"
                }`}
              >
                {current && (
                  <span
                    aria-hidden="true"
                    className="absolute top-0 left-1/2 h-[3px] w-6 -translate-x-1/2 rounded-b-sm bg-brand"
                  />
                )}
                <Icon size={24} />
                {label}
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
