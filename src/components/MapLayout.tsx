import type { ReactNode } from "react";
import { LayersIcon, LocateIcon, StarFilledIcon, StarIcon } from "@/assets/icons";

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
    <div className="relative h-dvh w-full overflow-hidden lg:grid lg:grid-cols-[390px_minmax(0,1fr)]">
      <div className="absolute inset-0 lg:relative lg:col-start-2 lg:row-start-1 lg:h-dvh">
        {map}
        {controls && (
          <div className="absolute right-3 top-(--controls-top,9rem) z-10 flex flex-col gap-2.5 lg:right-4 lg:top-4">
            {controls}
          </div>
        )}
      </div>
      <div className="pointer-events-none absolute inset-x-0 top-0 z-20 lg:pointer-events-auto lg:relative lg:col-start-1 lg:row-start-1 lg:flex lg:h-dvh lg:min-h-0 lg:flex-col lg:border-r lg:border-line lg:bg-surface">
        {header && (
          <div className="pointer-events-auto px-3 pt-[max(0.75rem,env(safe-area-inset-top))] lg:shrink-0 lg:border-b lg:border-line lg:px-4 lg:py-4">
            {header}
          </div>
        )}
        <div className="pointer-events-auto lg:flex lg:min-h-0 lg:flex-1 lg:flex-col lg:overflow-y-auto">{panel}</div>
      </div>
    </div>
  );
}

export function MapControlButton({
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
      className={`flex size-11 items-center justify-center rounded-lg bg-surface shadow-float transition-colors hover:bg-fill active:bg-canvas [&>svg]:size-[22px] ${
        pressed ? "text-brand-ink" : "text-ink-2"
      }`}
    >
      {children}
    </button>
  );
}

export function DefaultMapControls({
  onLocate,
  onLayers,
  layersOn,
  onFavorites,
  favoritesOn,
}: {
  onLocate?: () => void;
  onLayers?: () => void;
  layersOn?: boolean;
  onFavorites?: () => void;
  favoritesOn?: boolean;
}) {
  return (
    <>
      <MapControlButton label="지도 레이어" pressed={layersOn} onClick={onLayers}>
        <LayersIcon size={22} />
      </MapControlButton>
      <MapControlButton label="즐겨찾기 표시" pressed={favoritesOn} onClick={onFavorites}>
        {favoritesOn ? <StarFilledIcon size={22} className="text-brand" /> : <StarIcon size={22} />}
      </MapControlButton>
      <div className="mt-2.5 flex">
        <MapControlButton label="현재 위치로 이동" onClick={onLocate}>
          <LocateIcon size={22} />
        </MapControlButton>
      </div>
    </>
  );
}
