"use client";

import { useCallback, useRef, useState, type CSSProperties } from "react";
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

const CURRENT_PLACE: Place = {
  id: "current",
  name: "현재 위치",
  address: "",
  category: "현재 위치",
  position: mockCurrentPosition,
};

const SHEET_SNAPS = [0.24, 0.5, 0.88];
const SHEET_RATIO = SHEET_SNAPS[1];
const HEADER_HEIGHT_PX = 104;

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

function readDemoState(value: string | null): DemoState {
  return value === "denied" || value === "outside" ? value : null;
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

  function focusOriginInput() {
    headerRef.current?.querySelector<HTMLInputElement>('input[aria-label="출발지"]')?.focus();
  }

  let sheetContent;
  if (selectedPlace) {
    sheetContent = (
      <PlaceSummary
        place={selectedPlace}
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
  } else {
    sheetContent = (
      <section aria-labelledby="home-recent-heading">
        <h2 id="home-recent-heading" className="px-4 pt-2 text-sm font-semibold text-muted">
          최근 검색
        </h2>
        <PlaceList
          places={mockRecentSearches}
          onSelect={setSelected}
          icon="history"
          emptyText="최근 검색한 장소가 없어요"
        />
      </section>
    );
  }

  return (
    <div style={{ "--controls-top": "7.5rem" } as CSSProperties}>
      <MapLayout
        map={
          <MapView
            key={mapKey}
            label="대전 지도"
            center={mockCurrentPosition}
            markers={locationAvailable ? MARKERS_WITH_CURRENT : PLACE_MARKERS}
            obscuredTop={HEADER_HEIGHT_PX}
            obscuredBottom={SHEET_RATIO}
            onMarkerClick={selectById}
          />
        }
        controls={
          <DefaultMapControls
            layersOn={layersOn}
            onLayers={() => setLayersOn((v) => !v)}
            onLocate={() => setMapKey((k) => k + 1)}
          />
        }
        header={
          <div ref={headerRef}>
            <h1 className="sr-only">지금이니? 대전 버스 길찾기</h1>
            <RouteSearchBar
              origin={origin}
              destination={destination}
              onChange={update}
              search={searchPlaces}
              recent={mockRecentSearches}
            />
          </div>
        }
        panel={
          <BottomSheet label="장소" snaps={SHEET_SNAPS} initialSnap={1}>
            {sheetContent}
          </BottomSheet>
        }
      />
    </div>
  );
}
