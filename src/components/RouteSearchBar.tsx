"use client";

import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { usePlaceSearch } from "@/apis/queries/usePlaceSearch.query";
import { CloseIcon, HistoryIcon, LocateIcon, MoreIcon, PinIcon, SwapIcon } from "@/assets/icons";
import { mockCurrentPosition } from "@/app/_mocks/places";
import { formatDistance } from "@/utils/format";
import type { LatLng, Place } from "@/utils/types";

type Field = "origin" | "destination";

type Option = { key: string; kind: "current" | "recent" | "result"; place: Place };

// usePlaceSearch의 디바운스와 같은 값: 그 전까지 결과는 이전 검색어의 것이다
const SEARCH_DEBOUNCE_MS = 250;

function currentPlace(position: LatLng): Place {
  return { id: "current", name: "현재 위치", address: "", category: "현재 위치", position };
}

const FIELD_COPY: Record<Field, { label: string; placeholder: string; clear: string }> = {
  origin: { label: "출발지", placeholder: "출발지 검색", clear: "출발지 지우기" },
  destination: { label: "도착지", placeholder: "도착지 검색", clear: "도착지 지우기" },
};

export function RouteSearchBar({
  origin,
  destination,
  onChange,
  onSubmit,
  onBack,
  search,
  currentPosition = mockCurrentPosition,
  recent,
  compact = false,
}: {
  origin: Place | null;
  destination: Place | null;
  onChange: (next: { origin: Place | null; destination: Place | null }) => void;
  onSubmit?: () => void;
  onBack?: () => void;
  /** 목 데이터 동기 검색. 없으면 카카오 장소 검색을 쓴다 */
  search?: (q: string) => Place[];
  /** "현재 위치" 옵션의 좌표. null이면 옵션을 숨긴다 */
  currentPosition?: LatLng | null;
  recent: Place[];
  compact?: boolean;
}) {
  const baseId = useId();
  const listboxId = `${baseId}-listbox`;
  const recentLabelId = `${baseId}-recent`;
  const optionId = (i: number) => `${baseId}-opt-${i}`;

  const originRef = useRef<HTMLInputElement>(null);
  const destinationRef = useRef<HTMLInputElement>(null);

  const [field, setField] = useState<Field | null>(null);
  const [draft, setDraft] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [menuOpen, setMenuOpen] = useState(false);

  const values: Record<Field, Place | null> = { origin, destination };
  const query = field && draft !== null ? draft.trim() : "";
  const live = usePlaceSearch(query, { near: currentPosition, enabled: !search });
  const [settledQuery, setSettledQuery] = useState(query);
  useEffect(() => {
    const id = setTimeout(() => setSettledQuery(query), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(id);
  }, [query]);

  let options: Option[] = [];
  if (field && query) {
    options = (search ? search(query) : live.places).map((place) => ({
      key: `r-${place.id}`,
      kind: "result",
      place,
    }));
  } else if (field) {
    options = [
      ...(field === "origin" && currentPosition
        ? [{ key: "current", kind: "current" as const, place: currentPlace(currentPosition) }]
        : []),
      ...recent.map((place) => ({ key: `h-${place.id}`, kind: "recent" as const, place })),
    ];
  }
  const searching =
    !search &&
    query !== "" &&
    options.length === 0 &&
    (query !== settledQuery || live.isFetching);
  const noResults = query !== "" && options.length === 0 && !searching;
  const expanded = open && field !== null && (options.length > 0 || noResults || searching);
  const currentOption = options[0]?.kind === "current" ? options[0] : null;
  const recentOptions = options.filter((o) => o.kind === "recent");
  const resultOptions = options.filter((o) => o.kind === "result");

  function reset() {
    setDraft(null);
    setOpen(false);
    setActiveIndex(-1);
  }

  function select(place: Place) {
    const next = field === "origin" ? { origin: place, destination } : { origin, destination: place };
    onChange(next);
    reset();
    if (next.origin && next.destination) onSubmit?.();
  }

  function moveActive(next: number) {
    setActiveIndex(next);
    document.getElementById(optionId(next))?.scrollIntoView({ block: "nearest" });
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    const count = options.length;
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (!expanded) {
        setOpen(true);
        return;
      }
      if (count === 0) return;
      const step = e.key === "ArrowDown" ? 1 : -1;
      const from = activeIndex < 0 ? (step === 1 ? -1 : count) : activeIndex;
      moveActive((from + step + count) % count);
    } else if (e.key === "Enter") {
      if (!expanded) return;
      const target = options[activeIndex] ?? (query ? options[0] : undefined);
      if (target) {
        e.preventDefault();
        select(target.place);
      }
    } else if (e.key === "Escape" && expanded) {
      e.preventDefault();
      setOpen(false);
      setActiveIndex(-1);
    }
  }

  function clear(f: Field) {
    onChange(f === "origin" ? { origin: null, destination } : { origin, destination: null });
    setField(f);
    setDraft("");
    setOpen(true);
    setActiveIndex(-1);
    (f === "origin" ? originRef : destinationRef).current?.focus();
  }

  function swap() {
    onChange({ origin: destination, destination: origin });
    reset();
  }

  function renderOption(o: Option, i: number) {
    const Icon = o.kind === "current" ? LocateIcon : o.kind === "recent" ? HistoryIcon : PinIcon;
    return (
      <div
        key={o.key}
        id={optionId(i)}
        role="option"
        aria-selected={i === activeIndex}
        tabIndex={-1}
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => select(o.place)}
        className="flex h-12 cursor-pointer items-center gap-3 px-4 hover:bg-surface-muted aria-selected:bg-surface-muted"
      >
        <Icon
          size={18}
          className={`shrink-0 ${o.kind === "current" ? "text-(--color-current)" : "text-fg-muted"}`}
        />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold text-fg">{o.place.name}</span>
          {o.place.address && (
            <span className="block truncate text-xs text-fg-muted">{o.place.address}</span>
          )}
        </span>
        {o.kind === "result" && o.place.distanceM !== undefined && (
          <span className="shrink-0 text-xs text-fg-muted tabular">
            {formatDistance(o.place.distanceM)}
          </span>
        )}
      </div>
    );
  }

  function renderRow(f: Field) {
    const place = values[f];
    const copy = FIELD_COPY[f];
    const value = field === f && draft !== null ? draft : (place?.name ?? "");
    const isActiveField = field === f && expanded;
    return (
      <div className="group flex h-11 items-center">
        <span className="flex w-6 shrink-0 justify-start" aria-hidden="true">
          <span
            className={`size-2.5 rounded-full border-[3px] bg-surface ${
              f === "origin" ? "border-map-origin" : "border-map-destination"
            }`}
          />
        </span>
        <input
          ref={f === "origin" ? originRef : destinationRef}
          type="text"
          role="combobox"
          aria-label={copy.label}
          aria-expanded={isActiveField}
          aria-controls={listboxId}
          aria-autocomplete="list"
          aria-activedescendant={
            isActiveField && activeIndex >= 0 ? optionId(activeIndex) : undefined
          }
          autoComplete="off"
          enterKeyHint="search"
          placeholder={copy.placeholder}
          value={value}
          onFocus={() => {
            setField(f);
            setDraft(null);
            setOpen(true);
            setActiveIndex(-1);
          }}
          onChange={(e) => {
            setField(f);
            setDraft(e.target.value);
            setOpen(true);
            setActiveIndex(-1);
          }}
          onKeyDown={handleKeyDown}
          className="h-full min-w-0 flex-1 rounded-md bg-transparent text-sm text-fg placeholder:text-fg-subtle focus-visible:outline-offset-[-2px]"
        />
        {value !== "" && (
          <button
            type="button"
            aria-label={copy.clear}
            onClick={() => clear(f)}
            className="invisible flex size-10 shrink-0 items-center justify-center rounded-md text-fg-subtle hover:text-fg group-focus-within:visible group-hover:visible focus-visible:outline-offset-[-2px]"
          >
            <CloseIcon size={16} />
          </button>
        )}
      </div>
    );
  }

  return (
    <div
      className="relative"
      data-compact={compact || undefined}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
          setField(null);
          setMenuOpen(false);
          reset();
        }
      }}
    >
      <div
        className={`flex rounded-lg border border-border bg-surface ${
          compact ? "" : "shadow-float lg:shadow-none"
        }`}
      >
        <div className="flex w-10 shrink-0 items-center justify-center">
          <button
            type="button"
            aria-label="출발지와 도착지 바꾸기"
            onClick={swap}
            className="flex size-10 items-center justify-center rounded-md text-fg-secondary hover:text-fg focus-visible:outline-offset-[-2px]"
          >
            <SwapIcon size={18} />
          </button>
        </div>
        <div className={`min-w-0 flex-1 divide-y divide-divider ${onBack ? "" : "pr-1"}`}>
          {renderRow("origin")}
          {renderRow("destination")}
        </div>
        {onBack && (
          <div className="relative flex w-10 shrink-0 flex-col">
            <button
              type="button"
              aria-label="뒤로"
              onClick={onBack}
              className="flex h-11 items-center justify-center rounded-md text-fg-secondary hover:text-fg focus-visible:outline-offset-[-2px]"
            >
              <CloseIcon size={20} />
            </button>
            <button
              type="button"
              aria-label="더보기"
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((v) => !v)}
              className="flex h-11 items-center justify-center rounded-md text-fg-secondary hover:text-fg focus-visible:outline-offset-[-2px]"
            >
              <MoreIcon size={20} />
            </button>
            {menuOpen && (
              <div
                role="menu"
                aria-label="경로 검색 메뉴"
                onKeyDown={(e) => {
                  if (e.key === "Escape") setMenuOpen(false);
                }}
                className="absolute top-full right-0 z-40 mt-1 w-36 rounded-lg bg-surface py-1 shadow-float"
              >
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setMenuOpen(false);
                    onChange({ origin: null, destination: null });
                    originRef.current?.focus();
                  }}
                  className="flex h-11 w-full items-center px-4 text-left text-sm text-fg hover:bg-surface-muted focus-visible:outline-offset-[-2px]"
                >
                  모두 지우기
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      <div
        id={listboxId}
        role="listbox"
        aria-label={field ? `${FIELD_COPY[field].label} 검색 결과` : undefined}
        hidden={!expanded}
        className="absolute inset-x-0 top-full z-40 mt-1 max-h-[60dvh] overflow-auto rounded-lg border border-border bg-surface py-1 shadow-float"
      >
        {(noResults || searching) && (
          <div
            role="option"
            aria-selected={false}
            aria-disabled="true"
            className="flex h-12 items-center px-4 text-xs text-fg-muted"
          >
            {searching ? "찾는 중이에요" : "검색 결과가 없어요"}
          </div>
        )}
        {resultOptions.map((o, i) => renderOption(o, i))}
        {currentOption && renderOption(currentOption, 0)}
        {recentOptions.length > 0 && (
          <div role="group" aria-labelledby={recentLabelId}>
            <div
              id={recentLabelId}
              role="presentation"
              className="flex h-8 items-end px-4 pb-1 text-xs font-semibold text-fg-muted"
            >
              최근 검색
            </div>
            {recentOptions.map((o, i) => renderOption(o, i + (currentOption ? 1 : 0)))}
          </div>
        )}
      </div>
    </div>
  );
}
