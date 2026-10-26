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
    <section aria-labelledby={`place-${place.id}-name`} className="px-gutter pt-3 pb-5">
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1 pt-1">
          <h2 id={`place-${place.id}-name`} className="truncate text-md font-bold text-fg">
            {place.name}
          </h2>
          <p className="mt-0.5 truncate text-xs text-fg-muted tabular">
            {place.category}
            {place.distanceM !== undefined && (
              <>
                <span aria-hidden="true" className="px-1.5 text-fg-subtle">·</span>
                {formatDistance(place.distanceM)}
              </>
            )}
          </p>
          <p className="mt-0.5 truncate text-xs text-fg-muted">{place.address}</p>
        </div>
        <div className="-mr-2 flex shrink-0 items-center">
          <button
            type="button"
            aria-label={favorite ? "즐겨찾기 해제" : "즐겨찾기 추가"}
            aria-pressed={favorite}
            onClick={() => onToggleFavorite?.(place)}
            className="flex size-11 items-center justify-center rounded-md hover:bg-surface-muted"
          >
            {favorite ? (
              <StarFilledIcon size={20} className="text-brand" />
            ) : (
              <StarIcon size={20} className="text-fg-secondary" />
            )}
          </button>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              aria-label="장소 정보 닫기"
              className="flex size-11 items-center justify-center rounded-md text-fg-secondary hover:bg-surface-muted"
            >
              <CloseIcon size={20} />
            </button>
          )}
        </div>
      </div>

      <div className="mt-4 flex items-center gap-2">
        <button
          type="button"
          onClick={() => onSetOrigin(place)}
          className="h-control flex-1 rounded-md bg-action-secondary px-4 text-sm font-semibold text-action-secondary-fg transition-colors hover:bg-action-secondary-pressed"
        >
          출발
        </button>
        <button
          type="button"
          onClick={() => onSetDestination(place)}
          className="h-control flex-[2] rounded-md bg-action-primary px-4 text-sm font-bold text-action-primary-fg transition-colors hover:bg-action-primary-pressed"
        >
          도착
        </button>
      </div>
    </section>
  );
}
