"use client";

import { useCallback, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { flushSync } from "react-dom";
import { useRouter, useSearchParams } from "next/navigation";
import { BottomSheet } from "@/components/BottomSheet";
import { DefaultMapControls, MapLayout } from "@/components/MapLayout";
import { MapView, type MapMarker } from "@/components/MapView";
import { PlaceList } from "@/components/PlaceList";
import { PlaceSummary } from "@/components/PlaceSummary";
import { RouteSearchBar } from "@/components/RouteSearchBar";
import { LocationDeniedState, OutsideServiceAreaState } from "@/components/StateViews";
import {
  getPlaceById,
  mockCurrentPosition,
  mockPlaces,
  mockRecentSearches,
  searchPlaces,
} from "@/app/_mocks/places";
import type { Place } from "@/utils/types";
import { BottomTabBar, type TabKey } from "./BottomTabBar";
import { CategoryChips, type ChipKey } from "./CategoryChips";
import { MainSearchBar } from "./MainSearchBar";

const CURRENT_PLACE: Place = {
  id: "current",
  name: "현재 위치",
  address: "",
  category: "현재 위치",
  position: mockCurrentPosition,
};

const SHEET_SNAPS = [0.2, 0.45, 0.85];
const TAB_BAR_PX = 56;
const TAB_BAR_RATIO = 0.07;
const HEADER_HEIGHT_PX = 104;

const INITIAL_FAVORITES: Place[] = [mockPlaces[0], mockPlaces[1], mockPlaces[4]];
const SUBWAY_PLACES = mockPlaces.filter((p) => p.category === "지하철역");

const PLACE_MARKERS: MapMarker[] = mockPlaces.map((p) => ({
  id: p.id,
  position: p.position,
  label: p.name,
  tone: "place",
}));

const MARKERS_WITH_CURRENT: MapMarker[] = [
  { id: "current", position: mockCurrentPosition, tone: "current" },
  ...PLACE_MARKERS,
];

type DemoState = "denied" | "outside" | null;
type SheetView = ChipKey | "alerts" | null;

function readDemoState(value: string | null): DemoState {
  return value === "denied" || value === "outside" ? value : null;
}

function SheetSection({
  title,
  count,
  action,
  children,
}: {
  title: string;
  count?: number;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section aria-label={title} className="pb-2">
      <div className="flex h-11 items-center justify-between pr-2 pl-4">
        <h2 className="text-15 font-bold text-ink">
          {title}
          {count !== undefined && (
            <span className="ml-1 font-semibold text-muted tabular">{count}</span>
          )}
        </h2>
        {action}
      </div>
      {children}
    </section>
  );
}

export function HomeScreen() {
  const router = useRouter();
  const params = useSearchParams();
  const demoState = readDemoState(params.get("state"));
  const locationAvailable = demoState === null;

  const [origin, setOrigin] = useState<Place | null>(() =>
    demoState === "denied" ? null : CURRENT_PLACE,
  );
  const [destination, setDestination] = useState<Place | null>(null);
  const [selected, setSelected] = useState<Place | null | undefined>(undefined);
  const [routeMode, setRouteMode] = useState(false);
  const [view, setView] = useState<SheetView>(null);
  const [favorites, setFavorites] = useState<Place[]>(INITIAL_FAVORITES);
  const [recent, setRecent] = useState<Place[]>(mockRecentSearches);
  const [editingRecent, setEditingRecent] = useState(false);
  const [layersOn, setLayersOn] = useState(false);
  const [mapKey, setMapKey] = useState(0);
  const headerRef = useRef<HTMLDivElement>(null);

  const placeParam = params.get("place");
  const selectedPlace =
    selected === undefined ? (placeParam ? (getPlaceById(placeParam) ?? null) : null) : selected;

  function update(next: { origin: Place | null; destination: Place | null }) {
    setOrigin(next.origin);
    setDestination(next.destination);
    if (next.origin && next.destination) {
      const from = encodeURIComponent(next.origin.id);
      const to = encodeURIComponent(next.destination.id);
      router.push(`/routes?from=${from}&to=${to}`);
    }
  }

  const selectById = useCallback((id: string) => {
    const place = getPlaceById(id);
    if (place) setSelected(place);
  }, []);

  function selectFromSearch(place: Place) {
    setSelected(place);
    setRecent((list) => [place, ...list.filter((p) => p.id !== place.id)].slice(0, 8));
  }

  function toggleView(key: Exclude<SheetView, null>) {
    setSelected(null);
    setEditingRecent(false);
    setView((v) => (v === key ? null : key));
  }

  function toggleFavorite(place: Place) {
    setFavorites((list) =>
      list.some((p) => p.id === place.id)
        ? list.filter((p) => p.id !== place.id)
        : [...list, place],
    );
  }

  function focusOriginInput() {
    flushSync(() => setRouteMode(true));
    headerRef.current?.querySelector<HTMLInputElement>('input[aria-label="출발지"]')?.focus();
  }

  function selectTab(key: TabKey) {
    if (key === "route") {
      setRouteMode(true);
      return;
    }
    setRouteMode(false);
    if (key === "map") {
      setView(null);
      setEditingRecent(false);
    } else if (key === "favorites") {
      toggleView("favorites");
    } else {
      setSelected(null);
      setView("alerts");
    }
  }

  const activeChip: ChipKey | null = view === "alerts" ? null : view;
  const activeTab: TabKey = routeMode
    ? "route"
    : view === "favorites"
      ? "favorites"
      : view === "alerts"
        ? "alerts"
        : "map";

  let sheetContent: ReactNode;
  if (selectedPlace) {
    sheetContent = (
      <PlaceSummary
        place={selectedPlace}
        favorite={favorites.some((p) => p.id === selectedPlace.id)}
        onToggleFavorite={toggleFavorite}
        onSetOrigin={(p) => {
          setSelected(null);
          update({ origin: p, destination: destination?.id === p.id ? null : destination });
        }}
        onSetDestination={(p) => {
          setSelected(null);
          update({ origin: origin?.id === p.id ? null : origin, destination: p });
        }}
        onClose={() => setSelected(null)}
      />
    );
  } else if (demoState === "denied") {
    sheetContent = (
      <LocationDeniedState
        onSearchInstead={focusOriginInput}
        onRetry={() => router.replace("/")}
      />
    );
  } else if (demoState === "outside") {
    sheetContent = <OutsideServiceAreaState />;
  } else if (view === "favorites") {
    sheetContent = (
      <SheetSection title="즐겨찾기" count={favorites.length}>
        <PlaceList
          places={favorites}
          onSelect={setSelected}
          icon="star"
          emptyText="장소 카드의 별을 눌러 즐겨찾기에 추가해 보세요"
        />
      </SheetSection>
    );
  } else if (view === "subway") {
    sheetContent = (
      <SheetSection title="지하철역">
        <PlaceList places={SUBWAY_PLACES} onSelect={setSelected} icon="subway" />
      </SheetSection>
    );
  } else if (view === "stops") {
    sheetContent = (
      <SheetSection title="정류장">
        <PlaceList places={[]} onSelect={setSelected} emptyText="주변 정류장을 찾는 중이에요" />
      </SheetSection>
    );
  } else if (view === "recentRoutes") {
    sheetContent = (
      <SheetSection title="최근 경로">
        <PlaceList
          places={mockRecentSearches}
          onSelect={setSelected}
          icon="history"
          emptyText="최근에 찾은 경로가 없어요"
        />
      </SheetSection>
    );
  } else if (view === "home") {
    sheetContent = (
      <SheetSection title="집">
        <PlaceList places={[]} onSelect={setSelected} emptyText="집을 등록해 보세요" />
      </SheetSection>
    );
  } else if (view === "alerts") {
    sheetContent = (
      <SheetSection title="알림">
        <PlaceList
          places={[]}
          onSelect={setSelected}
          emptyText="켜 둔 출발 알림이 없어요. 경로 상세에서 출발 알림을 받을 수 있어요."
        />
      </SheetSection>
    );
  } else {
    sheetContent = (
      <SheetSection
        title="최근 검색"
        action={
          recent.length > 0 && (
            <button
              type="button"
              onClick={() => setEditingRecent((v) => !v)}
              className="h-10 rounded-md px-2 text-13 text-muted hover:text-ink"
            >
              {editingRecent ? "완료" : "편집"}
            </button>
          )
        }
      >
        <PlaceList
          places={recent}
          onSelect={setSelected}
          onRemove={
            editingRecent
              ? (p) => setRecent((list) => list.filter((x) => x.id !== p.id))
              : undefined
          }
          icon="history"
          emptyText="최근 검색한 장소가 없어요"
        />
      </SheetSection>
    );
  }

  const expandedSheet = Boolean(selectedPlace) || demoState !== null;
  const initialSnap = expandedSheet ? 1 : 0;
  const sheetKey = selectedPlace ? `place-${selectedPlace.id}` : demoState ? "demo" : "idle";

  return (
    <div style={{ "--controls-top": "7.25rem" } as CSSProperties}>
      <MapLayout
        map={
          <MapView
            key={mapKey}
            label="대전 지도"
            center={mockCurrentPosition}
            markers={locationAvailable ? MARKERS_WITH_CURRENT : PLACE_MARKERS}
            obscuredTop={HEADER_HEIGHT_PX}
            obscuredBottom={SHEET_SNAPS[initialSnap] + TAB_BAR_RATIO}
            onMarkerClick={selectById}
            selectedId={selectedPlace?.id}
          />
        }
        controls={
          <DefaultMapControls
            layersOn={layersOn}
            onLayers={() => setLayersOn((v) => !v)}
            favoritesOn={view === "favorites"}
            onFavorites={() => toggleView("favorites")}
            onLocate={() => setMapKey((k) => k + 1)}
          />
        }
        header={
          <div ref={headerRef}>
            <h1 className="sr-only">지금이니? 대전 버스 길찾기</h1>
            {routeMode ? (
              <RouteSearchBar
                origin={origin}
                destination={destination}
                onChange={update}
                onBack={() => setRouteMode(false)}
                search={searchPlaces}
                recent={recent}
              />
            ) : (
              <>
                <MainSearchBar
                  onSelect={selectFromSearch}
                  onRoute={() => setRouteMode(true)}
                  search={searchPlaces}
                  recent={recent}
                />
                <div className="mt-1">
                  <CategoryChips active={activeChip} onToggle={toggleView} />
                </div>
              </>
            )}
          </div>
        }
        panel={
          <BottomSheet
            key={sheetKey}
            label="장소"
            snaps={SHEET_SNAPS}
            initialSnap={initialSnap}
            bottomOffset={TAB_BAR_PX}
          >
            {sheetContent}
          </BottomSheet>
        }
      />
      <BottomTabBar active={activeTab} onSelect={selectTab} />
    </div>
  );
}
