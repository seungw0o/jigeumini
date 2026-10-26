import type { ReactNode } from "react";
import { LocateIcon } from "@/assets/icons";

/**
 * 지도 화면 공통 골격.
 * 모바일: 지도가 화면 전체, header는 지도 위 상단에 뜨고, panel(BottomSheet)은 하단 고정.
 * lg 이상: 좌측 390px 패널(header + panel), 우측 지도.
 */
export function MapLayout({
  map,
  header,
  panel,
  controls,
}: {
  map: ReactNode;
  header?: ReactNode;
  panel?: ReactNode;
  controls?: ReactNode;
}) {
  return (
    <div className="relative h-dvh w-full overflow-hidden bg-bg lg:grid lg:grid-cols-[390px_minmax(0,1fr)]">
      <div className="absolute inset-0 lg:relative lg:col-start-2 lg:row-start-1 lg:h-dvh">
        {map}
        {controls && (
          <div className="absolute right-3 top-(--controls-top,9rem) z-10 flex flex-col gap-2 lg:right-5 lg:top-5">
            {controls}
          </div>
        )}
      </div>
      <div className="pointer-events-none absolute inset-x-0 top-0 z-20 lg:pointer-events-auto lg:relative lg:col-start-1 lg:row-start-1 lg:flex lg:h-dvh lg:min-h-0 lg:flex-col lg:bg-surface lg:shadow-card">
        {header && (
          <div className="pointer-events-auto px-3 pt-[max(0.75rem,env(safe-area-inset-top))] lg:shrink-0 lg:px-gutter lg:pt-5 lg:pb-3">
            {header}
          </div>
        )}
        <div className="pointer-events-auto lg:flex lg:min-h-0 lg:flex-1 lg:flex-col lg:overflow-y-auto">{panel}</div>
      </div>
    </div>
  );
}

function MapControlButton({
  label,
  pressed,
  onClick,
  children,
}: {
  label: string;
  pressed?: boolean;
  onClick?: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={pressed}
      onClick={onClick}
      className={`flex size-11 items-center justify-center rounded-md shadow-float transition-colors ${
        pressed
          ? "bg-brand-soft text-brand-ink"
          : "bg-surface text-fg-secondary hover:bg-surface-muted active:bg-skeleton"
      }`}
    >
      {children}
    </button>
  );
}

export function DefaultMapControls({ onLocate }: { onLocate?: () => void }) {
  return (
    <MapControlButton label="현재 위치로 이동" onClick={onLocate}>
      <LocateIcon size={22} />
    </MapControlButton>
  );
}
