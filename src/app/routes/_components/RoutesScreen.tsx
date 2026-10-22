"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getPlaceById, mockRecentSearches, searchPlaces } from "@/app/_mocks/places";
import { mockEmptyRouteSearch, mockRouteSearch } from "@/app/_mocks/routes";
import { BottomSheet } from "@/components/BottomSheet";
import { MapLayout } from "@/components/MapLayout";
import { MapView, type MapMarker, type MapPath } from "@/components/MapView";
import { NotifyDeniedHint } from "@/components/NotifyButton";
import { RouteCard } from "@/components/RouteCard";
import { RouteSearchBar } from "@/components/RouteSearchBar";
import { EmptyState, ErrorState, RouteListSkeleton } from "@/components/StateViews";
import { BUS_TYPE_META } from "@/utils/format";
import type { NotifyState, Place, TransitRoute } from "@/utils/types";
import { RoutesToolbar } from "./RoutesToolbar";

type DemoState = "ready" | "empty" | "error" | "loading";

const MARKERS: MapMarker[] = [
  { id: "origin", position: mockRouteSearch.origin.position, label: mockRouteSearch.origin.name, tone: "origin" },
  {
    id: "destination",
    position: mockRouteSearch.destination.position,
    label: mockRouteSearch.destination.name,
    tone: "destination",
  },
];

const DEFAULT_NOTIFY: Record<string, NotifyState> = { a: "idle", b: "on" };

function toDemoState(value: string | null): DemoState {
  return value === "empty" || value === "error" || value === "loading" ? value : "ready";
}

function routePaths(route: TransitRoute): MapPath[] {
  return route.legs.map((leg, i) =>
    leg.kind === "bus"
      ? { points: route.path[i], color: BUS_TYPE_META[leg.busType].color }
      : { points: route.path[i], color: "var(--color-line-strong)", dashed: true },
  );
}

const PATHS_BY_ROUTE = new Map(mockRouteSearch.routes.map((r) => [r.id, routePaths(r)]));
const NO_PATHS: MapPath[] = [];

const noop = () => {};

export function RoutesScreen() {
  const router = useRouter();
  const params = useSearchParams();
  const demo = toDemoState(params.get("state"));
  const notifyDenied = params.get("notify") === "denied";
  const search = demo === "empty" ? mockEmptyRouteSearch : mockRouteSearch;
  const routes = demo === "ready" ? search.routes : [];

  const [places, setPlaces] = useState<{ origin: Place | null; destination: Place | null }>(() => {
    const from = params.get("from");
    const to = params.get("to");
    return {
      origin: (from && getPlaceById(from)) || mockRouteSearch.origin,
      destination: (to && getPlaceById(to)) || mockRouteSearch.destination,
    };
  });
  const [notify, setNotify] = useState<Record<string, NotifyState>>(DEFAULT_NOTIFY);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const selected = routes.find((r) => r.id === selectedId) ?? routes[0];
  const paths = (selected && PATHS_BY_ROUTE.get(selected.id)) || NO_PATHS;

  function submit() {
    const { origin, destination } = places;
    if (!origin || !destination) return;
    router.replace(`/routes?from=${encodeURIComponent(origin.id)}&to=${encodeURIComponent(destination.id)}`);
  }

  return (
    <>
      <h1 className="sr-only">경로 목록</h1>
      <MapLayout
        header={
          <RouteSearchBar
            compact
            origin={places.origin}
            destination={places.destination}
            onChange={setPlaces}
            onSubmit={submit}
            onBack={() => router.push("/")}
            search={searchPlaces}
            recent={mockRecentSearches}
          />
        }
        map={
          <MapView
            label="경로 지도"
            paths={paths}
            markers={MARKERS}
            obscuredBottom={0.62}
            obscuredTop={104}
          />
        }
        panel={
          <BottomSheet label="경로 목록" snaps={[0.3, 0.62, 0.9]} initialSnap={1}>
            <div className="mx-auto w-full max-w-xl">
              <RoutesToolbar
                baseTime={search.baseTime}
                secondsAgo={search.updatedSecondsAgo}
                onRefresh={noop}
              />
              {demo === "loading" && <RouteListSkeleton count={3} />}
              {demo === "error" && <ErrorState onRetry={() => router.replace("/routes")} />}
              {demo === "empty" && (
                <EmptyState
                  title="경로가 없습니다"
                  message="출발지나 도착지를 바꿔 보세요. 대전 시내버스 경로만 찾을 수 있어요."
                />
              )}
              {demo === "ready" && (
                <>
                  {notifyDenied && (
                    <div className="border-b border-line px-4 py-2.5">
                      <NotifyDeniedHint />
                    </div>
                  )}
                  <ul className="divide-y divide-line border-b border-line">
                    {routes.map((route, i) => (
                      <li
                        key={route.id}
                        onMouseEnter={() => setSelectedId(route.id)}
                        onFocus={() => setSelectedId(route.id)}
                      >
                        <RouteCard
                          route={route}
                          href={`/routes/${route.id}`}
                          rank={i}
                          notifyState={notifyDenied ? "denied" : (notify[route.id] ?? "idle")}
                          onNotifyChange={(next) => setNotify((prev) => ({ ...prev, [route.id]: next }))}
                        />
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </div>
          </BottomSheet>
        }
      />
    </>
  );
}
