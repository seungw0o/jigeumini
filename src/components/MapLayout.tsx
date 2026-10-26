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
          <div className="absolute right-3 bottom-[calc(var(--map-sheet-offset,0px)+var(--map-sheet-h,0px)+0.75rem)] z-10 flex flex-col gap-2 transition-[bottom] duration-(--map-sheet-motion,0ms) ease-sheet lg:right-5 lg:bottom-5 lg:transition-none">
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
  onClick,
  children,
}: {
  label: string;
  onClick?: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="flex size-11 items-center justify-center rounded-md bg-surface text-fg-secondary shadow-float transition-colors hover:bg-surface-muted active:bg-skeleton"
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
