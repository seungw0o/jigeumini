import { HistoryIcon, PinIcon } from "@/assets/icons";
import { formatDistance } from "@/utils/format";
import type { Place } from "@/utils/types";

export function PlaceList({
  places,
  onSelect,
  icon = "pin",
  emptyText,
}: {
  places: Place[];
  onSelect: (p: Place) => void;
  icon?: "pin" | "history";
  emptyText?: string;
}) {
  if (places.length === 0) {
    return emptyText ? <p className="px-4 py-6 text-sm text-muted">{emptyText}</p> : null;
  }

  const Icon = icon === "history" ? HistoryIcon : PinIcon;

  return (
    <ul>
      {places.map((place) => (
        <li key={place.id} className="border-b border-line last:border-b-0">
          <button
            type="button"
            onClick={() => onSelect(place)}
            className="flex h-14 w-full items-center gap-3 px-4 text-left hover:bg-canvas"
          >
            <Icon size={20} className="shrink-0 text-muted" />
            <span className="min-w-0 flex-1">
              <span className="block truncate font-semibold text-ink">{place.name}</span>
              {place.address && (
                <span className="block truncate text-sm text-muted">{place.address}</span>
              )}
            </span>
            {place.distanceM !== undefined && (
              <span className="shrink-0 text-sm text-muted tabular">
                {formatDistance(place.distanceM)}
              </span>
            )}
          </button>
        </li>
      ))}
    </ul>
  );
}
