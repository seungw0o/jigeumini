"use client";

import { useId, useRef, useState, type KeyboardEvent } from "react";
import { BackIcon, CloseIcon, HistoryIcon, LocateIcon, PinIcon, SwapIcon } from "@/assets/icons";
import { mockCurrentPosition } from "@/app/_mocks/places";
import { formatDistance } from "@/utils/format";
import type { Place } from "@/utils/types";

type Field = "origin" | "destination";

type Option = { key: string; kind: "current" | "recent" | "result"; place: Place };

const CURRENT_PLACE: Place = {
  id: "current",
  name: "현재 위치",
  address: "",
  category: "현재 위치",
  position: mockCurrentPosition,
};

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
  recent,
  compact = false,
}: {
  origin: Place | null;
  destination: Place | null;
  onChange: (next: { origin: Place | null; destination: Place | null }) => void;
  onSubmit?: () => void;
  onBack?: () => void;
  search: (q: string) => Place[];
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

  const values: Record<Field, Place | null> = { origin, destination };
  const query = field && draft !== null ? draft.trim() : "";

  let options: Option[] = [];
  if (field && query) {
    options = search(query).map((place) => ({ key: `r-${place.id}`, kind: "result", place }));
  } else if (field) {
    options = [
      ...(field === "origin"
        ? [{ key: "current", kind: "current" as const, place: CURRENT_PLACE }]
        : []),
      ...recent.map((place) => ({ key: `h-${place.id}`, kind: "recent" as const, place })),
    ];
  }
  const noResults = query !== "" && options.length === 0;
  const expanded = open && field !== null && (options.length > 0 || noResults);
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
        className="flex h-14 cursor-pointer items-center gap-3 px-4 hover:bg-canvas aria-selected:bg-canvas"
      >
        <Icon
          size={20}
          className={`shrink-0 ${o.kind === "current" ? "text-accent" : "text-muted"}`}
        />
        <span className="min-w-0 flex-1">
          <span className="block truncate font-semibold text-ink">{o.place.name}</span>
          {o.place.address && (
            <span className="block truncate text-sm text-muted">{o.place.address}</span>
          )}
        </span>
        {o.kind === "result" && o.place.distanceM !== undefined && (
          <span className="shrink-0 text-sm text-muted tabular">
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
        <span className="flex w-9 shrink-0 justify-center" aria-hidden="true">
          {f === "origin" ? (
            <span className="size-2 rounded-full bg-ink" />
          ) : (
            <span className="size-2 bg-accent" />
          )}
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
          className="h-full min-w-0 flex-1 rounded-md bg-transparent text-base text-ink placeholder:text-muted focus-visible:outline-offset-[-2px]"
        />
        {value !== "" && (
          <button
            type="button"
            aria-label={copy.clear}
            onClick={() => clear(f)}
            className="invisible flex size-11 shrink-0 items-center justify-center rounded-md text-muted hover:text-ink group-focus-within:visible group-hover:visible focus-visible:outline-offset-[-2px]"
          >
            <CloseIcon size={18} />
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
          reset();
        }
      }}
    >
      <div className="flex rounded-lg border border-line bg-surface shadow-float lg:shadow-none">
        {onBack && (
          <button
            type="button"
            aria-label="뒤로"
            onClick={onBack}
            className="flex w-11 shrink-0 items-center justify-center rounded-md text-ink-2 hover:text-ink focus-visible:outline-offset-[-2px]"
          >
            <BackIcon size={22} />
          </button>
        )}
        <div className="min-w-0 flex-1 divide-y divide-line">
          {renderRow("origin")}
          {renderRow("destination")}
        </div>
        <button
          type="button"
          aria-label="출발지와 도착지 바꾸기"
          onClick={swap}
          className="flex w-11 shrink-0 items-center justify-center rounded-md text-ink-2 hover:text-ink focus-visible:outline-offset-[-2px]"
        >
          <SwapIcon size={20} />
        </button>
      </div>

      <div
        id={listboxId}
        role="listbox"
        aria-label={field ? `${FIELD_COPY[field].label} 검색 결과` : undefined}
        hidden={!expanded}
        className="absolute inset-x-0 top-full z-40 mt-1 max-h-[60dvh] overflow-auto rounded-lg border border-line bg-surface py-1 shadow-float"
      >
        {noResults && (
          <div
            role="option"
            aria-selected={false}
            aria-disabled="true"
            className="flex h-14 items-center px-4 text-sm text-muted"
          >
            검색 결과가 없어요
          </div>
        )}
        {resultOptions.map((o, i) => renderOption(o, i))}
        {currentOption && renderOption(currentOption, 0)}
        {recentOptions.length > 0 && (
          <div role="group" aria-labelledby={recentLabelId}>
            <div
              id={recentLabelId}
              role="presentation"
              className="flex h-9 items-end px-4 pb-1 text-sm font-semibold text-muted"
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
