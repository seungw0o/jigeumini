"use client";

import {
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { flushSync } from "react-dom";
import { useRouter } from "next/navigation";
import { Logo } from "@/assets/Logo";
import { BottomSheet } from "@/components/BottomSheet";
import { DefaultMapControls, MapLayout } from "@/components/MapLayout";
import { MapView, type MapMarker } from "@/components/MapView";
import { PlaceList } from "@/components/PlaceList";
import { PlaceSummary } from "@/components/PlaceSummary";
import { RouteSearchBar } from "@/components/RouteSearchBar";
import { LocationDeniedState, OutsideServiceAreaState } from "@/components/StateViews";
import { useFavorites } from "@/apis/queries/useFavorites.query";
import { useGeolocation } from "@/hooks/useGeolocation";
import { useRecentRoutes } from "@/hooks/useRecentRoutes";
import { useRecentSearches } from "@/hooks/useRecentSearches";
import { REGION_CENTERS, regionOf, type Region } from "@/shared/region";
import { placeToRouteEnd, routePairQuery } from "@/utils/routeQuery";
import type { LatLng, Place } from "@/utils/types";
import { AlertsList } from "./AlertsList";
import { BottomTabBar, type TabKey } from "./BottomTabBar";
import { CategoryChips, type ChipKey } from "./CategoryChips";
import { MainSearchBar } from "./MainSearchBar";


function currentPlace(position: LatLng): Place {
  return { id: "current", name: "현재 위치", address: "", category: "현재 위치", position };
}

const SHEET_SNAPS = [0.2, 0.45, 0.85];
const TAB_BAR_PX = 56;
const TAB_BAR_RATIO = 0.07;
const HEADER_HEIGHT_PX = 104;

type LocationState = "denied" | "outside" | null;
type SheetView = ChipKey | null;

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
    <section aria-label={title} className="pb-3">
      <div className="flex h-12 items-center justify-between px-gutter pt-1">
        <h2 className="text-md font-bold text-fg">
          {title}
          {count !== undefined && (
            <span className="ml-1.5 font-semibold text-fg-muted tabular">{count}</span>
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
  const geo = useGeolocation(true);
  const livePosition = geo.position;
  // 서비스 지역(대전, 서울) 밖에서 "대전/서울 지도로 이동"을 누르면 그 도시로 지도를 옮기고 안내를 닫는다
  const [cityFocus, setCityFocus] = useState<LatLng | null>(null);
  const locationState: LocationState =
    geo.status === "denied"
      ? "denied"
      : livePosition && regionOf(livePosition) === null && !cityFocus
        ? "outside"
        : null;

  // undefined = 아직 고르지 않음: 위치를 알면 "현재 위치"가 기본 출발지다
  const [originChoice, setOrigin] = useState<Place | null | undefined>(undefined);
  const defaultOrigin = livePosition ? currentPlace(livePosition) : null;
  const origin = originChoice === undefined ? defaultOrigin : originChoice;
  const [destination, setDestination] = useState<Place | null>(null);
  // 길찾기에서 마지막으로 고른 출발지/목적지. 하나만 골랐을 때 지도를 그 장소로 옮긴다
  const [routeFocus, setRouteFocus] = useState<Place | null>(null);
  const [selectedPlace, setSelected] = useState<Place | null>(null);
  // 카드를 닫아도 마지막 장소 핀은 남겨, 핀을 누르면 카드를 다시 연다
  const [lastPlace, setLastPlace] = useState<Place | null>(null);
  // 같은 장소를 다시 열 때도 시트를 펼친 높이로 되돌리려고 열 때마다 올린다
  const [placeOpenCount, setPlaceOpenCount] = useState(0);
  const pinnedPlace = selectedPlace ?? lastPlace;
  const [routeMode, setRouteMode] = useState(false);
  const [view, setView] = useState<SheetView>(null);
  // 즐겨찾기는 서버(D1), 최근 검색은 localStorage에 유지
  const { favorites, isFavorite, toggleFavorite } = useFavorites();
  const { recent, addRecent, removeRecent, clearRecent } = useRecentSearches();
  const { recentRoutes, removeRecentRoute, clearRecentRoutes } = useRecentRoutes();
  const recentRouteItems = useMemo<Place[]>(
    () =>
      recentRoutes.map((r) => ({
        id: r.id,
        name: `${r.origin.name} → ${r.destination.name}`,
        address: "",
        category: "",
        position: r.destination.position,
      })),
    [recentRoutes],
  );
  const [mapKey, setMapKey] = useState(0);
  const headerRef = useRef<HTMLDivElement>(null);

  const baseMarkers = useMemo<MapMarker[]>(() => {
    const list: MapMarker[] = [];
    if (livePosition) list.push({ id: "current", position: livePosition, tone: "current" });
    for (const fav of favorites) {
      if (fav.id === pinnedPlace?.id) continue;
      list.push({ id: `fav-${fav.id}`, position: fav.position, label: fav.name, tone: "favorite" });
    }
    if (pinnedPlace) {
      list.push({
        id: pinnedPlace.id,
        position: pinnedPlace.position,
        label: pinnedPlace.name,
        tone: "place",
      });
    }
    return list;
  }, [livePosition, pinnedPlace, favorites]);

  // 길찾기 중 고른 출발지(현재 위치 제외)·목적지 핀. originChoice는 state라 렌더마다 새 객체가 아니다
  const markers = useMemo<MapMarker[]>(() => {
    if (!routeMode) return baseMarkers;
    const pins: MapMarker[] = [];
    if (originChoice && originChoice.id !== "current") {
      pins.push({ id: `origin-${originChoice.id}`, position: originChoice.position, label: originChoice.name, tone: "origin" });
    }
    if (destination) {
      pins.push({
        id: `destination-${destination.id}`,
        position: destination.position,
        label: destination.name,
        tone: "destination",
      });
    }
    return [...baseMarkers, ...pins];
  }, [baseMarkers, routeMode, originChoice, destination]);

  const routeFocusPlace =
    [destination, originChoice].find((p) => p && p.id !== "current" && p.id === routeFocus?.id) ?? null;
  const focus = routeMode ? routeFocusPlace?.position : (selectedPlace?.position ?? cityFocus ?? undefined);

  function update(next: { origin: Place | null; destination: Place | null }) {
    const picked = [next.origin, next.destination].filter(
      (p): p is Place =>
        p !== null && p.id !== "current" && p.id !== origin?.id && p.id !== destination?.id,
    );
    if (picked.length > 0) addRecent(...picked);
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
      const query = routePairQuery({
        origin: placeToRouteEnd(next.origin),
        destination: placeToRouteEnd(next.destination),
      });
      router.push(`/routes?${query}`);
    }
  }

  function openPlace(place: Place) {
    setSelected(place);
    setLastPlace(place);
    setPlaceOpenCount((n) => n + 1);
  }

  function selectFromSearch(place: Place) {
    openPlace(place);
    addRecent(place);
  }

  function openMarker(id: string) {
    const fav = favorites.find((p) => `fav-${p.id}` === id);
    const pinned = [
      fav,
      pinnedPlace?.id === id ? pinnedPlace : undefined,
      originChoice && `origin-${originChoice.id}` === id ? originChoice : undefined,
      destination && `destination-${destination.id}` === id ? destination : undefined,
    ].find((p) => p !== undefined);
    if (pinned) openPlace(pinned);
  }

  function toggleView(key: Exclude<SheetView, null>) {
    setSelected(null);
    setView((v) => (v === key ? null : key));
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
    } else if (key === "favorites") {
      toggleView("favorites");
    } else {
      setSelected(null);
      setView("alerts");
    }
  }

  const activeChip: ChipKey | null = view;
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
        favorite={isFavorite(selectedPlace.id)}
        onToggleFavorite={toggleFavorite}
        onSetOrigin={(p) => {
          setSelected(null);
          setLastPlace(null);
          update({ origin: p, destination: destination?.id === p.id ? null : destination });
        }}
        onSetDestination={(p) => {
          setSelected(null);
          setLastPlace(null);
          update({ origin: origin?.id === p.id ? null : origin, destination: p });
        }}
        onClose={() => setSelected(null)}
      />
    );
  } else if (locationState === "denied") {
    sheetContent = (
      <LocationDeniedState
        onSearchInstead={focusOriginInput}
        onRetry={geo.retry}
      />
    );
  } else if (locationState === "outside") {
    sheetContent = <OutsideServiceAreaState onMoveTo={(region: Region) => setCityFocus(REGION_CENTERS[region])} />;
  } else if (view === "favorites") {
    sheetContent = (
      <SheetSection title="즐겨찾기" count={favorites.length}>
        <PlaceList
          places={favorites}
          onSelect={openPlace}
          icon="star"
          emptyText="장소 카드의 별을 눌러 즐겨찾기에 추가해 보세요"
        />
      </SheetSection>
    );
  } else if (view === "recentRoutes") {
    sheetContent = (
      <SheetSection
        title="최근 경로"
        action={
          recentRoutes.length > 0 && (
            <button
              type="button"
              onClick={clearRecentRoutes}
              className="-mr-3 h-11 rounded-md px-3 text-xs font-semibold text-fg-secondary hover:bg-surface-muted hover:text-fg"
            >
              전체 삭제
            </button>
          )
        }
      >
        <PlaceList
          places={recentRouteItems}
          onSelect={(item) => {
            const route = recentRoutes.find((r) => r.id === item.id);
            if (route) router.push(`/routes?${routePairQuery(route)}`);
          }}
          onRemove={(item) => removeRecentRoute(item.id)}
          icon="history"
          emptyText="최근에 찾은 경로가 없어요"
        />
      </SheetSection>
    );
  } else if (view === "alerts") {
    sheetContent = (
      <SheetSection title="출발 알림">
        <AlertsList onOpen={(href) => router.push(href)} />
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
              onClick={clearRecent}
              className="-mr-3 h-11 rounded-md px-3 text-xs font-semibold text-fg-secondary hover:bg-surface-muted hover:text-fg"
            >
              전체 삭제
            </button>
          )
        }
      >
        <PlaceList
          places={recent}
          onSelect={openPlace}
          onRemove={(p) => removeRecent(p.id)}
          icon="history"
          emptyText="최근 검색한 장소가 없어요"
        />
      </SheetSection>
    );
  }

  const expandedSheet = Boolean(selectedPlace) || locationState !== null;
  const initialSnap = expandedSheet ? 1 : 0;
  const sheetKey = selectedPlace ? `place-${selectedPlace.id}-${placeOpenCount}` : locationState ? "location" : "idle";

  return (
    <div style={{ "--controls-top": routeMode ? "8.5rem" : "7.25rem" } as CSSProperties}>
      <MapLayout
        map={
          <MapView
            key={mapKey}
            label="지도"
            center={livePosition ?? REGION_CENTERS.daejeon}
            markers={markers}
            obscuredTop={HEADER_HEIGHT_PX}
            obscuredBottom={SHEET_SNAPS[initialSnap] + TAB_BAR_RATIO}
            selectedId={selectedPlace?.id}
            focus={focus}
            onMarkerClick={openMarker}
          />
        }
        controls={
          <DefaultMapControls
            onLocate={() => {
              geo.retry();
              setMapKey((k) => k + 1);
            }}
          />
        }
        header={
          <div ref={headerRef}>
            <h1 className="sr-only">지금이니? 버스 길찾기</h1>
            <div className="mb-4 hidden h-8 items-center lg:flex">
              <button
                type="button"
                aria-label="지도 홈으로"
                onClick={() => {
                  setSelected(null);
                  setLastPlace(null);
                  selectTab("map");
                }}
                className="cursor-pointer rounded-md"
              >
                <Logo size="md" />
              </button>
            </div>
            {routeMode ? (
              <RouteSearchBar
                origin={origin}
                destination={destination}
                onChange={update}
                onBack={() => setRouteMode(false)}
                currentPosition={livePosition}
                recent={recent}
              />
            ) : (
              <>
                <MainSearchBar
                  onSelect={selectFromSearch}
                  onRoute={() => setRouteMode(true)}
                  quietRoute={Boolean(selectedPlace) || locationState !== null}
                  near={cityFocus ?? livePosition}
                  recent={recent}
                />
                <div className="mt-1 lg:mt-3">
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
