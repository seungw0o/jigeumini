import { CloseIcon, StarFilledIcon, StarIcon } from "@/assets/icons";
import { formatDistance } from "@/utils/format";
import type { Place } from "@/utils/types";

export function PlaceSummary({
  place,
  onSetOrigin,
  onSetDestination,
  onClose,
  favorite = false,
  onToggleFavorite,
}: {
  place: Place;
  onSetOrigin: (p: Place) => void;
  onSetDestination: (p: Place) => void;
  onClose?: () => void;
  favorite?: boolean;
  onToggleFavorite?: (p: Place) => void;
}) {
  return (
    <section aria-labelledby={`place-${place.id}-name`} className="px-4 pt-1 pb-4">
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1 pt-2">
          <div className="flex min-w-0 items-baseline gap-1.5">
            <h2 id={`place-${place.id}-name`} className="truncate text-lg font-bold text-ink">
              {place.name}
            </h2>
            <span className="shrink-0 text-13 text-muted">{place.category}</span>
          </div>
          <p className="mt-1 truncate text-13 text-ink-2">{place.address}</p>
          <p className="mt-0.5 truncate text-xs tabular">
            {place.distanceM !== undefined && (
              <span className="text-muted">{formatDistance(place.distanceM)}</span>
            )}
            {place.distanceM !== undefined && <span aria-hidden="true" className="px-1 text-line-strong">|</span>}
            <span className="text-subtle">
              {place.position.lat.toFixed(5)}, {place.position.lng.toFixed(5)}
            </span>
          </p>
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label="장소 정보 닫기"
            className="-mr-2 inline-flex size-10 shrink-0 items-center justify-center rounded-md text-ink-2 hover:bg-fill"
          >
            <CloseIcon size={20} />
          </button>
        )}
      </div>

      <div className="mt-3 flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => onSetOrigin(place)}
          className="relative h-9 rounded-md border border-line-strong bg-surface px-4 text-sm font-semibold text-ink before:absolute before:-inset-y-0.5 before:inset-x-0 hover:bg-fill"
        >
          출발
        </button>
        <button
          type="button"
          onClick={() => onSetDestination(place)}
          className="relative h-9 rounded-md bg-brand px-4 text-sm font-semibold text-ink before:absolute before:-inset-y-0.5 before:inset-x-0 hover:bg-brand-strong"
        >
          도착
        </button>
        <button
          type="button"
          aria-label="즐겨찾기 추가"
          aria-pressed={favorite}
          onClick={() => onToggleFavorite?.(place)}
          className="relative ml-auto flex size-9 items-center justify-center rounded-md border border-line-strong bg-surface before:absolute before:-inset-0.5 hover:bg-fill"
        >
          {favorite ? (
            <StarFilledIcon size={18} className="text-brand" />
          ) : (
            <StarIcon size={18} className="text-ink-2" />
          )}
        </button>
      </div>
    </section>
  );
}

export function PlaceSummarySkeleton() {
  const block = "rounded-sm bg-line animate-pulse motion-reduce:animate-none";
  return (
    <div aria-busy="true" className="px-4 pt-1 pb-4">
      <span className="sr-only">장소 정보를 불러오는 중</span>
      <div aria-hidden="true">
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1 pt-2">
            <div className="flex h-7 items-center gap-1.5">
              <div className={`h-[18px] w-2/5 ${block}`} />
              <div className={`h-3 w-12 ${block}`} />
            </div>
            <div className="mt-1 flex h-[18px] items-center">
              <div className={`h-3 w-3/5 ${block}`} />
            </div>
            <div className="mt-0.5 flex h-4 items-center">
              <div className={`h-3 w-2/5 ${block}`} />
            </div>
          </div>
          <div className="-mr-2 size-10 shrink-0" />
        </div>

        <div className="mt-3 flex items-center gap-1.5">
          <div className="h-9 w-[62px] rounded-md bg-line animate-pulse motion-reduce:animate-none" />
          <div className="h-9 w-[62px] rounded-md bg-line animate-pulse motion-reduce:animate-none" />
          <div className="ml-auto size-9 rounded-md bg-line animate-pulse motion-reduce:animate-none" />
        </div>
      </div>
    </div>
  );
}
