"use client";

import {
  useCallback,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { flushSync } from "react-dom";
import { useRouter, useSearchParams } from "next/navigation";
import { Logo } from "@/assets/Logo";
import { BottomSheet } from "@/components/BottomSheet";
import { DefaultMapControls, MapLayout } from "@/components/MapLayout";
import { MapView, type MapMarker } from "@/components/MapView";
import { PlaceList } from "@/components/PlaceList";
import { PlaceSummary } from "@/components/PlaceSummary";
import { RouteSearchBar } from "@/components/RouteSearchBar";
import { LocationDeniedState, OutsideServiceAreaState } from "@/components/StateViews";
import { useGeolocation } from "@/hooks/useGeolocation";
import {
  DAEJEON_CENTER,
  getPlaceById,
  mockCurrentPosition,
  mockPlaces,
  mockRecentSearches,
  searchPlaces,
} from "@/app/_mocks/places";
import { isMockMode, placeToRouteEnd, routePairQuery } from "@/utils/routeQuery";
import type { LatLng, Place } from "@/utils/types";
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

function inDaejeon({ lat, lng }: LatLng): boolean {
  return lat >= 36.18 && lat <= 36.5 && lng >= 127.24 && lng <= 127.56;
}

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
  const mock = isMockMode(params);
  const demoState = mock ? readDemoState(params.get("state")) : null;
  const locationAvailable = demoState === null;
  const geo = useGeolocation(!mock);
  const livePosition = geo.position;
  const locationState: DemoState = mock
    ? demoState
    : geo.status === "denied"
      ? "denied"
      : livePosition && !inDaejeon(livePosition)
        ? "outside"
        : null;

  // undefined = 아직 고르지 않음: 위치를 알면 "현재 위치"가 기본 출발지다
  const [originChoice, setOrigin] = useState<Place | null | undefined>(undefined);
  const defaultOrigin = mock
    ? demoState === "denied"
      ? null
      : CURRENT_PLACE
    : livePosition
      ? { ...CURRENT_PLACE, position: livePosition }
      : null;
  const origin = originChoice === undefined ? defaultOrigin : originChoice;
  const [destination, setDestination] = useState<Place | null>(null);
  // 길찾기에서 마지막으로 고른 출발지/목적지. 하나만 골랐을 때 지도를 그 장소로 옮긴다
  const [routeFocus, setRouteFocus] = useState<Place | null>(null);
  const [selected, setSelected] = useState<Place | null | undefined>(undefined);
  const [routeMode, setRouteMode] = useState(false);
  const [view, setView] = useState<SheetView>(null);
  const [favorites, setFavorites] = useState<Place[]>(() => (mock ? INITIAL_FAVORITES : []));
  const [recent, setRecent] = useState<Place[]>(() => (mock ? mockRecentSearches : []));
  const [editingRecent, setEditingRecent] = useState(false);
  const [layersOn, setLayersOn] = useState(false);
  const [mapKey, setMapKey] = useState(0);
  const headerRef = useRef<HTMLDivElement>(null);

  const placeParam = params.get("place");
  const selectedPlace =
    selected === undefined ? (placeParam ? (getPlaceById(placeParam) ?? null) : null) : selected;

  const baseMarkers = useMemo<MapMarker[]>(() => {
    if (mock) return locationAvailable ? MARKERS_WITH_CURRENT : PLACE_MARKERS;
    const list: MapMarker[] = [];
    if (livePosition) list.push({ id: "current", position: livePosition, tone: "current" });
    if (selectedPlace) {
      list.push({
        id: selectedPlace.id,
        position: selectedPlace.position,
        label: selectedPlace.name,
        tone: "place",
      });
    }
    return list;
  }, [mock, locationAvailable, livePosition, selectedPlace]);

  // 길찾기 중 고른 출발지(현재 위치 제외)·목적지 핀. originChoice는 state라 렌더마다 새 객체가 아니다
  const markers = useMemo<MapMarker[]>(() => {
    if (!routeMode) return baseMarkers;
    const pins: MapMarker[] = [];
    if (originChoice && originChoice.id !== "current") {
      pins.push({ id: `origin-${originChoice.id}`, position: originChoice.position, tone: "origin" });
    }
    if (destination) {
      pins.push({ id: `destination-${destination.id}`, position: destination.position, tone: "destination" });
    }
    return [...baseMarkers, ...pins];
  }, [baseMarkers, routeMode, originChoice, destination]);

  const routeFocusPlace =
    [destination, originChoice].find((p) => p && p.id !== "current" && p.id === routeFocus?.id) ?? null;
  const focus = routeMode ? routeFocusPlace?.position : selectedPlace?.position;

  function update(next: { origin: Place | null; destination: Place | null }) {
    if (!mock) {
      const picked = [next.origin, next.destination].filter(
        (p): p is Place =>
          p !== null && p.id !== "current" && p.id !== origin?.id && p.id !== destination?.id,
      );
      if (picked.length > 0) {
        setRecent((list) =>
          [...picked, ...list.filter((p) => !picked.some((x) => x.id === p.id))].slice(0, 8),
        );
      }
    }
    const newest = [next.destination, next.origin].find(
      (p) =>
        p !== null &&
        p.id !== "current" &&
        p.id !== (p === next.destination ? destination?.id : origin?.id),
    );
    if (newest) setRouteFocus(newest);
    setOrigin(next.origin);
    setDestination(next.destination);
    if (next.origin && next.destination) {
      if (mock) {
        const from = encodeURIComponent(next.origin.id);
        const to = encodeURIComponent(next.destination.id);
        router.push(`/routes?mock=1&from=${from}&to=${to}`);
      } else {
        const query = routePairQuery({
          origin: placeToRouteEnd(next.origin),
          destination: placeToRouteEnd(next.destination),
        });
        router.push(`/routes?${query}`);
      }
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
  } else if (locationState === "denied") {
    sheetContent = (
      <LocationDeniedState
        onSearchInstead={focusOriginInput}
        onRetry={mock ? () => router.replace("/?mock=1") : geo.retry}
      />
    );
  } else if (locationState === "outside") {
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
          places={mock ? mockRecentSearches : []}
          onSelect={setSelected}
          icon="history"
          emptyText="최근에 찾은 경로가 없어요"
        />
      </SheetSection>
    );
  } else if (view === "frequent") {
    sheetContent = (
      <SheetSection title="자주 가는 곳">
        <PlaceList places={[]} onSelect={setSelected} emptyText="자주 가는 곳을 등록해 보세요" />
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

  const expandedSheet = Boolean(selectedPlace) || locationState !== null;
  const initialSnap = expandedSheet ? 1 : 0;
  const sheetKey = selectedPlace ? `place-${selectedPlace.id}` : locationState ? "demo" : "idle";

  return (
    <div style={{ "--controls-top": "7.25rem" } as CSSProperties}>
      <MapLayout
        map={
          <MapView
            key={mapKey}
            label="대전 지도"
            center={mock ? mockCurrentPosition : (livePosition ?? DAEJEON_CENTER)}
            markers={markers}
            obscuredTop={HEADER_HEIGHT_PX}
            obscuredBottom={SHEET_SNAPS[initialSnap] + TAB_BAR_RATIO}
            onMarkerClick={selectById}
            selectedId={selectedPlace?.id}
            focus={focus}
          />
        }
        controls={
          <DefaultMapControls
            layersOn={layersOn}
            onLayers={() => setLayersOn((v) => !v)}
            favoritesOn={view === "favorites"}
            onFavorites={() => toggleView("favorites")}
            onLocate={() => {
              if (!mock) geo.retry();
              setMapKey((k) => k + 1);
            }}
          />
        }
        header={
          <div ref={headerRef}>
            <h1 className="sr-only">지금이니? 대전 버스 길찾기</h1>
            <div aria-hidden="true" className="mb-3 hidden h-8 items-center lg:flex">
              <Logo size="md" />
            </div>
            {routeMode ? (
              <RouteSearchBar
                origin={origin}
                destination={destination}
                onChange={update}
                onBack={() => setRouteMode(false)}
                search={mock ? searchPlaces : undefined}
                currentPosition={mock ? undefined : livePosition}
                recent={recent}
              />
            ) : (
              <>
                <MainSearchBar
                  onSelect={selectFromSearch}
                  onRoute={() => setRouteMode(true)}
                  search={mock ? searchPlaces : undefined}
                  near={mock ? undefined : livePosition}
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
