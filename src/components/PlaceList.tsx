import { CloseIcon, HistoryIcon, PinIcon, StarIcon } from "@/assets/icons";
import { formatDistance } from "@/utils/format";
import type { Place } from "@/utils/types";

const ICONS = { pin: PinIcon, history: HistoryIcon, star: StarIcon };

export function PlaceList({
  places,
  onSelect,
  onRemove,
  icon = "pin",
  emptyText,
}: {
  places: Place[];
  onSelect: (p: Place) => void;
  onRemove?: (p: Place) => void;
  icon?: keyof typeof ICONS;
  emptyText?: string;
}) {
  if (places.length === 0) {
    return emptyText ? <p className="px-4 py-5 text-xs text-fg-muted">{emptyText}</p> : null;
  }

  const Icon = ICONS[icon];

  return (
    <ul>
      {places.map((place) => (
        <li key={place.id} className="flex items-center">
          <button
            type="button"
            onClick={() => onSelect(place)}
            className="flex h-[52px] min-w-0 flex-1 items-center gap-3 px-4 text-left hover:bg-surface-muted focus-visible:outline-offset-[-2px]"
          >
            <Icon size={18} className="shrink-0 text-fg-muted" />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold text-fg">{place.name}</span>
              {place.address && (
                <span className="block truncate text-xs text-fg-muted">{place.address}</span>
              )}
            </span>
            {place.distanceM !== undefined && !onRemove && (
              <span className="shrink-0 text-xs text-fg-muted tabular">
                {formatDistance(place.distanceM)}
              </span>
            )}
          </button>
          {onRemove && (
            <button
              type="button"
              aria-label={`${place.name} 삭제`}
              onClick={() => onRemove(place)}
              className="mr-2 flex size-10 shrink-0 items-center justify-center rounded-md text-fg-subtle hover:text-fg"
            >
              <CloseIcon size={16} />
            </button>
          )}
        </li>
      ))}
    </ul>
  );
}
