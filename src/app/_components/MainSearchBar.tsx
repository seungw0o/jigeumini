"use client";

import { useId, useState, type KeyboardEvent } from "react";
import { CloseIcon, DirectionsIcon, HistoryIcon, PinIcon, SearchIcon } from "@/assets/icons";
import { LogoMark } from "@/assets/Logo";
import { formatDistance } from "@/utils/format";
import type { Place } from "@/utils/types";

export function MainSearchBar({
  onSelect,
  onRoute,
  search,
  recent,
}: {
  onSelect: (place: Place) => void;
  onRoute: () => void;
  search: (q: string) => Place[];
  recent: Place[];
}) {
  const baseId = useId();
  const listboxId = `${baseId}-listbox`;
  const optionId = (i: number) => `${baseId}-opt-${i}`;

  const [value, setValue] = useState("");
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);

  const query = value.trim();
  const options = query ? search(query) : recent;
  const noResults = query !== "" && options.length === 0;
  const expanded = open && (options.length > 0 || noResults);

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
        <div className="flex h-12 items-center rounded-lg bg-surface pl-3.5 shadow-pill focus-within:outline-2 focus-within:outline-brand-ink lg:border lg:border-line-strong lg:pl-4 lg:shadow-none">
          <LogoMark size={22} className="shrink-0 lg:hidden" />
          <SearchIcon size={20} className="hidden shrink-0 text-muted lg:block" />
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
            placeholder="정류장, 장소 검색"
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
            className="h-full min-w-0 flex-1 bg-transparent pl-2.5 text-15 text-ink placeholder:text-subtle focus-visible:outline-none"
          />
          {value !== "" ? (
            <button
              type="button"
              aria-label="검색어 지우기"
              onClick={() => {
                setValue("");
                setActiveIndex(-1);
              }}
              className="mr-1 flex size-10 shrink-0 items-center justify-center rounded-md text-muted hover:text-ink"
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
          className="absolute inset-x-0 top-full z-40 mt-1.5 max-h-[60dvh] overflow-auto rounded-lg bg-surface py-1 shadow-float"
        >
          {!query && options.length > 0 && (
            <div role="presentation" className="flex h-8 items-end px-4 pb-1 text-xs font-semibold text-muted">
              최근 검색
            </div>
          )}
          {noResults && (
            <div
              role="option"
              aria-selected={false}
              aria-disabled="true"
              className="flex h-12 items-center px-4 text-13 text-muted"
            >
              검색 결과가 없어요
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
                className="flex h-12 cursor-pointer items-center gap-3 px-4 hover:bg-fill aria-selected:bg-fill"
              >
                <Icon size={18} className="shrink-0 text-muted" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-15 font-semibold text-ink">{place.name}</span>
                  <span className="block truncate text-xs text-muted">{place.address}</span>
                </span>
                {place.distanceM !== undefined && (
                  <span className="shrink-0 text-xs text-muted tabular">
                    {formatDistance(place.distanceM)}
                  </span>
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
        className="flex size-12 shrink-0 items-center justify-center rounded-lg bg-brand text-ink shadow-pill hover:bg-brand-strong lg:shadow-none"
      >
        <DirectionsIcon size={22} />
      </button>
    </div>
  );
}
