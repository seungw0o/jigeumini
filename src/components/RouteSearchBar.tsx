"use client";

import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { usePlaceSearch } from "@/apis/queries/usePlaceSearch.query";
import { CloseIcon, HistoryIcon, LocateIcon, MoreIcon, PinIcon, SwapIcon } from "@/assets/icons";
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
  currentPosition = null,
  recent,
  onRemoveRecent,
  compact = false,
}: {
  origin: Place | null;
  destination: Place | null;
  onChange: (next: { origin: Place | null; destination: Place | null }) => void;
  onSubmit?: () => void;
  onBack?: () => void;
  /** "현재 위치" 옵션의 좌표. null이면 옵션을 숨긴다 */
  currentPosition?: LatLng | null;
  recent: Place[];
  onRemoveRecent?: (place: Place) => void;
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
  const live = usePlaceSearch(query, { near: currentPosition });
  const [settledQuery, setSettledQuery] = useState(query);
  useEffect(() => {
    const id = setTimeout(() => setSettledQuery(query), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(id);
  }, [query]);

  let options: Option[] = [];
  if (field && query) {
    options = live.places.map((place) => ({
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
        className="flex h-row cursor-pointer items-center gap-3 px-4 hover:bg-surface-muted aria-selected:bg-surface-muted"
      >
        <Icon
          size={18}
          className={`shrink-0 ${o.kind === "current" ? "text-map-current" : "text-fg-muted"}`}
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
        {o.kind === "recent" && onRemoveRecent && (
          <button
            type="button"
            aria-label={`${o.place.name} 최근 검색에서 삭제`}
            onClick={(e) => {
              e.stopPropagation();
              setActiveIndex(-1);
              onRemoveRecent(o.place);
            }}
            className="-mr-2 flex size-9 shrink-0 items-center justify-center rounded-md text-fg-muted hover:bg-surface hover:text-fg"
          >
            <CloseIcon size={16} />
          </button>
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
      <div className="group flex h-control items-center rounded-md bg-surface-muted pr-11 pl-3.5 has-[input:focus-visible]:outline-2 has-[input:focus-visible]:outline-offset-2 has-[input:focus-visible]:outline-focus-ring">
        <span className="flex w-5 shrink-0 justify-start" aria-hidden="true">
          <span
            className={`size-2 rounded-full ${f === "origin" ? "bg-map-origin" : "bg-map-destination"}`}
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
          className="h-full min-w-0 flex-1 bg-transparent pr-2 text-sm font-semibold text-fg placeholder:font-normal placeholder:text-fg-muted focus-visible:outline-none"
        />
        {value !== "" && (
          <button
            type="button"
            aria-label={copy.clear}
            onClick={() => clear(f)}
            className="invisible mr-1 flex size-10 shrink-0 items-center justify-center rounded-md text-fg-muted hover:text-fg group-focus-within:visible group-hover:visible"
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
        className={`flex gap-1 rounded-lg ${
          compact ? "" : "bg-surface p-1.5 shadow-float lg:p-0 lg:shadow-none"
        }`}
      >
        {/* 바꾸기 버튼은 두 입력창 경계 오른쪽 위에 떠 있다 (입력창은 pr-11로 그 자리를 비워 둠) */}
        <div className="relative min-w-0 flex-1 space-y-1">
          {renderRow("origin")}
          {renderRow("destination")}
          <button
            type="button"
            aria-label="출발지와 도착지 바꾸기"
            onClick={swap}
            className="absolute top-1/2 right-1.5 z-10 flex size-10 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-surface text-fg-secondary shadow-float hover:text-fg"
          >
            <SwapIcon size={18} />
          </button>
        </div>
        {onBack && (
          <div className="relative flex w-11 shrink-0 flex-col gap-1">
            <button
              type="button"
              aria-label="뒤로"
              onClick={onBack}
              className="flex h-control items-center justify-center rounded-md text-fg-secondary hover:bg-surface-muted hover:text-fg"
            >
              <CloseIcon size={20} />
            </button>
            <button
              type="button"
              aria-label="더보기"
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((v) => !v)}
              className="flex h-control items-center justify-center rounded-md text-fg-secondary hover:bg-surface-muted hover:text-fg"
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
                className="absolute top-full right-0 z-40 mt-2 w-40 rounded-lg bg-surface py-1.5 shadow-float"
              >
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setMenuOpen(false);
                    onChange({ origin: null, destination: null });
                    originRef.current?.focus();
                  }}
                  className="flex h-control w-full items-center px-4 text-left text-sm font-semibold text-fg hover:bg-surface-muted focus-visible:-outline-offset-2"
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
        className="absolute inset-x-0 top-full z-40 mt-2 max-h-[60dvh] overflow-auto rounded-lg bg-surface py-1.5 shadow-float"
      >
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
