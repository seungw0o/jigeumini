"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getPlaceById, mockRecentSearches, searchPlaces } from "@/app/_mocks/places";
import { mockEmptyRouteSearch, mockRouteSearch } from "@/app/_mocks/routes";
import { MapView } from "@/components/MapView";
import { NotifyDeniedHint } from "@/components/NotifyButton";
import { RouteCard } from "@/components/RouteCard";
import { RouteSearchBar } from "@/components/RouteSearchBar";
import { EmptyState, ErrorState, RouteListSkeleton } from "@/components/StateViews";
import { routeMarkers, routePaths } from "@/utils/mapData";
import type { MapMarker, MapPath, NotifyState, Place, RouteSortKey, TransitRoute } from "@/utils/types";
import { RoutesLayout } from "./RoutesLayout";
import { RoutesToolbar } from "./RoutesToolbar";

type DemoState = "ready" | "empty" | "error" | "loading";

const { origin: ORIGIN, destination: DESTINATION } = mockRouteSearch;

const BASE_MARKERS: MapMarker[] = [
  { id: "origin", position: ORIGIN.position, label: ORIGIN.name, tone: "origin" },
  { id: "destination", position: DESTINATION.position, label: DESTINATION.name, tone: "destination" },
];

const DEFAULT_NOTIFY: Record<string, NotifyState> = { a: "idle", b: "on" };

const PATHS_BY_ROUTE = new Map(mockRouteSearch.routes.map((r) => [r.id, routePaths(r)]));
const MARKERS_BY_ROUTE = new Map(mockRouteSearch.routes.map((r) => [r.id, routeMarkers(r, ORIGIN, DESTINATION)]));
const NO_PATHS: MapPath[] = [];

const BADGE: Record<RouteSortKey, string> = {
  arrival: "가장 빨리 도착",
  walk: "도보 가장 짧음",
  transfer: "환승 가장 적음",
};

function toDemoState(value: string | null): DemoState {
  return value === "empty" || value === "error" || value === "loading" ? value : "ready";
}

const walkMinutes = (r: TransitRoute) => r.legs.reduce((sum, l) => sum + (l.kind === "walk" ? l.minutes : 0), 0);

const COMPARE: Record<RouteSortKey, (a: TransitRoute, b: TransitRoute) => number> = {
  arrival: (a, b) => a.totalMinutes - b.totalMinutes,
  walk: (a, b) => walkMinutes(a) - walkMinutes(b) || a.totalMinutes - b.totalMinutes,
  transfer: (a, b) => a.transferCount - b.transferCount || a.totalMinutes - b.totalMinutes,
};

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
      origin: (from && getPlaceById(from)) || ORIGIN,
      destination: (to && getPlaceById(to)) || DESTINATION,
    };
  });
  const [notify, setNotify] = useState<Record<string, NotifyState>>(DEFAULT_NOTIFY);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [sort, setSort] = useState<RouteSortKey>("arrival");

  const visible = [...routes].sort(COMPARE[sort]);

  const selected = visible.find((r) => r.id === selectedId) ?? visible[0];
  const paths = (selected && PATHS_BY_ROUTE.get(selected.id)) || NO_PATHS;
  const markers = (selected && MARKERS_BY_ROUTE.get(selected.id)) || BASE_MARKERS;

  function submit() {
    const { origin, destination } = places;
    if (!origin || !destination) return;
    router.replace(`/routes?from=${encodeURIComponent(origin.id)}&to=${encodeURIComponent(destination.id)}`);
  }

  return (
    <>
      <h1 className="sr-only">경로 목록</h1>
      <RoutesLayout
        header={
          <>
            <div className="px-4 pt-3 pb-1 lg:pt-0">
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
            </div>
            <RoutesToolbar
              baseTime={search.baseTime}
              secondsAgo={search.updatedSecondsAgo}
              onRefresh={noop}
              sort={sort}
              onSortChange={setSort}
            />
          </>
        }
        map={<MapView label="경로 지도" paths={paths} markers={markers} obscuredTop={0} obscuredBottom={0} />}
      >
        <section aria-label="검색된 경로" className="pt-2">
          {demo === "loading" && <RouteListSkeleton count={3} />}
          {demo === "error" && (
            <div className="bg-surface">
              <ErrorState onRetry={() => router.replace("/routes")} />
            </div>
          )}
          {demo === "empty" && (
            <div className="bg-surface">
              <EmptyState
                title="경로가 없습니다"
                message="출발지나 도착지를 바꿔 보세요. 대전 시내버스 경로만 찾을 수 있어요."
              />
            </div>
          )}
          {demo === "ready" && visible.length > 0 && (
            <>
              {notifyDenied && (
                <div className="mb-2 bg-surface px-4 py-2.5">
                  <NotifyDeniedHint />
                </div>
              )}
              <ul className="flex flex-col gap-2">
                {visible.map((route, i) => (
                  <li
                    key={route.id}
                    onMouseEnter={() => setSelectedId(route.id)}
                    onFocus={() => setSelectedId(route.id)}
                  >
                    <RouteCard
                      route={route}
                      href={`/routes/${route.id}`}
                      now={search.baseTime}
                      badge={i === 0 ? BADGE[sort] : undefined}
                      notifyState={notifyDenied ? "denied" : (notify[route.id] ?? "idle")}
                      onNotifyChange={(next) => setNotify((prev) => ({ ...prev, [route.id]: next }))}
                    />
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>
      </RoutesLayout>
    </>
  );
}
