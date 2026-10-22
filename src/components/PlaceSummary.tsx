import { CloseIcon } from "@/assets/icons";
import { formatDistance } from "@/utils/format";
import type { Place } from "@/utils/types";

export function PlaceSummary({
  place,
  onSetOrigin,
  onSetDestination,
  onClose,
}: {
  place: Place;
  onSetOrigin: (p: Place) => void;
  onSetDestination: (p: Place) => void;
  onClose?: () => void;
}) {
  const meta = [place.category, place.distanceM !== undefined ? formatDistance(place.distanceM) : null]
    .filter(Boolean)
    .join(" · ");

  return (
    <section aria-labelledby={`place-${place.id}-name`} className="px-4 pt-2 pb-4">
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1 pt-1.5">
          <h2 id={`place-${place.id}-name`} className="line-clamp-2 text-xl font-bold text-ink">
            {place.name}
          </h2>
          {meta && <p className="mt-0.5 truncate text-sm text-muted tabular">{meta}</p>}
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label="장소 정보 닫기"
            className="-mr-2 inline-flex size-11 shrink-0 items-center justify-center rounded-md text-ink-2 hover:bg-canvas"
          >
            <CloseIcon size={22} />
          </button>
        )}
      </div>

      <dl className="mt-3 space-y-1 text-sm">
        <div className="flex gap-3">
          <dt className="w-8 shrink-0 text-muted">주소</dt>
          <dd className="min-w-0 flex-1 text-ink-2">{place.address}</dd>
        </div>
        <div className="flex gap-3">
          <dt className="w-8 shrink-0 text-muted">좌표</dt>
          <dd className="min-w-0 flex-1 truncate text-muted tabular">
            {place.position.lat.toFixed(5)}, {place.position.lng.toFixed(5)}
          </dd>
        </div>
      </dl>

      <div className="mt-4 grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => onSetOrigin(place)}
          className="h-11 rounded-md border border-line-strong bg-surface text-base font-semibold text-ink hover:bg-canvas"
        >
          출발
        </button>
        <button
          type="button"
          onClick={() => onSetDestination(place)}
          className="h-11 rounded-md bg-accent text-base font-semibold text-white hover:bg-accent-strong"
        >
          도착
        </button>
      </div>
    </section>
  );
}

export function PlaceSummarySkeleton() {
  const block = "rounded-sm bg-line animate-pulse motion-reduce:animate-none";
  return (
    <div aria-busy="true" className="px-4 pt-2 pb-4">
      <span className="sr-only">장소 정보를 불러오는 중</span>
      <div aria-hidden="true">
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1 pt-1.5">
            <div className="flex h-7 items-center">
              <div className={`h-5 w-1/2 ${block}`} />
            </div>
            <div className="mt-0.5 flex h-5 items-center">
              <div className={`h-3.5 w-1/3 ${block}`} />
            </div>
          </div>
          <div className="-mr-2 size-11 shrink-0" />
        </div>

        <div className="mt-3 space-y-1">
          <div className="flex h-5 items-center gap-3">
            <div className={`h-3.5 w-8 shrink-0 ${block}`} />
            <div className={`h-3.5 w-3/5 ${block}`} />
          </div>
          <div className="flex h-5 items-center gap-3">
            <div className={`h-3.5 w-8 shrink-0 ${block}`} />
            <div className={`h-3.5 w-2/5 ${block}`} />
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2">
          <div className={`h-11 rounded-md bg-line animate-pulse motion-reduce:animate-none`} />
          <div className={`h-11 rounded-md bg-line animate-pulse motion-reduce:animate-none`} />
        </div>
      </div>
    </div>
  );
}
