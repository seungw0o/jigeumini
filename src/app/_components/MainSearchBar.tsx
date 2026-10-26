"use client";

import { useEffect, useId, useState, type KeyboardEvent } from "react";
import { usePlaceSearch } from "@/apis/queries/usePlaceSearch.query";
import { CloseIcon, DirectionsIcon, HistoryIcon, PinIcon, SearchIcon } from "@/assets/icons";
import { LogoMark } from "@/assets/Logo";
import { formatDistance } from "@/utils/format";
import type { LatLng, Place } from "@/utils/types";

// usePlaceSearch의 디바운스와 같은 값: 그 전까지 결과는 이전 검색어의 것이다
const SEARCH_DEBOUNCE_MS = 250;

export function MainSearchBar({
  onSelect,
  onRoute,
  near = null,
  recent,
  onRemoveRecent,
  quietRoute = false,
}: {
  onSelect: (place: Place) => void;
  onRoute: () => void;
  /** 화면에 다른 primary 액션이 있을 때 길찾기 버튼을 보조 스타일로 낮춘다 */
  quietRoute?: boolean;
  near?: LatLng | null;
  recent: Place[];
  onRemoveRecent?: (place: Place) => void;
}) {
  const baseId = useId();
  const listboxId = `${baseId}-listbox`;
  const optionId = (i: number) => `${baseId}-opt-${i}`;

  const [value, setValue] = useState("");
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);

  const query = value.trim();
  const live = usePlaceSearch(query, { near });
  const [settledQuery, setSettledQuery] = useState(query);
  useEffect(() => {
    const id = setTimeout(() => setSettledQuery(query), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(id);
  }, [query]);

  const options = query ? live.places : recent;
  const searching =
    query !== "" &&
    options.length === 0 &&
    (query !== settledQuery || live.isFetching);
  const noResults = query !== "" && options.length === 0 && !searching;
  const expanded = open && (options.length > 0 || noResults || searching);

  function close() {
    setOpen(false);
    setActiveIndex(-1);
  }

  function select(place: Place) {
    onSelect(place);
    setValue("");
    close();
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
        select(target);
      }
    } else if (e.key === "Escape" && expanded) {
      e.preventDefault();
      close();
    }
  }

  return (
    <div className="flex items-start gap-2">
      <div
        className="relative min-w-0 flex-1"
        onBlur={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node | null)) close();
        }}
      >
        <div className="flex h-control items-center rounded-md bg-surface pl-3.5 shadow-float has-[input:focus-visible]:outline-2 has-[input:focus-visible]:outline-offset-2 has-[input:focus-visible]:outline-focus-ring lg:bg-surface-muted lg:pl-4 lg:shadow-none">
          <LogoMark size={26} className="shrink-0 lg:hidden" />
          <SearchIcon size={20} className="hidden shrink-0 text-fg-muted lg:block" />
          <input
            type="text"
            role="combobox"
            aria-label="장소 검색"
            aria-expanded={expanded}
            aria-controls={listboxId}
            aria-autocomplete="list"
            aria-activedescendant={expanded && activeIndex >= 0 ? optionId(activeIndex) : undefined}
            autoComplete="off"
            enterKeyHint="search"
            placeholder="장소 검색"
            value={value}
            onFocus={() => {
              setOpen(true);
              setActiveIndex(-1);
            }}
            onChange={(e) => {
              setValue(e.target.value);
              setOpen(true);
              setActiveIndex(-1);
            }}
            onKeyDown={handleKeyDown}
            className="h-full min-w-0 flex-1 bg-transparent pl-2.5 text-sm text-fg placeholder:text-fg-muted focus-visible:outline-none"
          />
          {value !== "" ? (
            <button
              type="button"
              aria-label="검색어 지우기"
              onClick={() => {
                setValue("");
                setActiveIndex(-1);
              }}
              className="mr-1 flex size-10 shrink-0 items-center justify-center rounded-md text-fg-muted hover:bg-surface-muted hover:text-fg lg:hover:bg-surface"
            >
              <CloseIcon size={18} />
            </button>
          ) : (
            <span className="w-3 shrink-0" />
          )}
        </div>

        <div
          id={listboxId}
          role="listbox"
          aria-label={query ? "장소 검색 결과" : "최근 검색"}
          hidden={!expanded}
          className="absolute inset-x-0 top-full z-40 mt-2 max-h-[60dvh] overflow-auto rounded-lg bg-surface py-1.5 shadow-float"
        >
          {!query && options.length > 0 && (
            <div role="presentation" className="flex h-8 items-end px-4 pb-1 text-xs font-semibold text-fg-muted">
              최근 검색
            </div>
          )}
          {(noResults || searching) && (
            <div
              role="option"
              aria-selected={false}
              aria-disabled="true"
              className="flex h-row items-center px-4 text-xs text-fg-muted"
            >
              {searching ? "찾는 중이에요" : "검색 결과가 없어요"}
            </div>
          )}
          {options.map((place, i) => {
            const Icon = query ? PinIcon : HistoryIcon;
            return (
              <div
                key={place.id}
                id={optionId(i)}
                role="option"
                aria-selected={i === activeIndex}
                tabIndex={-1}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => select(place)}
                className="flex h-row cursor-pointer items-center gap-3 px-4 hover:bg-surface-muted aria-selected:bg-surface-muted"
              >
                <Icon size={18} className="shrink-0 text-fg-muted" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-fg">{place.name}</span>
                  <span className="block truncate text-xs text-fg-muted">{place.address}</span>
                </span>
                {place.distanceM !== undefined && (
                  <span className="shrink-0 text-xs text-fg-muted tabular">
                    {formatDistance(place.distanceM)}
                  </span>
                )}
                {!query && onRemoveRecent && (
                  <button
                    type="button"
                    aria-label={`${place.name} 최근 검색에서 삭제`}
                    onClick={(e) => {
                      e.stopPropagation();
                      setActiveIndex(-1);
                      onRemoveRecent(place);
                    }}
                    className="-mr-2 flex size-9 shrink-0 items-center justify-center rounded-md text-fg-muted hover:bg-surface hover:text-fg"
                  >
                    <CloseIcon size={16} />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <button
        type="button"
        aria-label="길찾기"
        onClick={onRoute}
        className={`flex size-control shrink-0 items-center justify-center rounded-md shadow-float transition-colors lg:shadow-none ${
          quietRoute
            ? "bg-surface text-fg-secondary hover:bg-surface-muted lg:bg-action-secondary lg:text-action-secondary-fg lg:hover:bg-action-secondary-pressed"
            : "bg-action-primary text-action-primary-fg hover:bg-action-primary-pressed"
        }`}
      >
        <DirectionsIcon size={22} />
      </button>
    </div>
  );
}
