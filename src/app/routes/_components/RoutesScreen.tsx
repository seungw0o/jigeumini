"use client";

import { useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getPlaceById, mockRecentSearches, searchPlaces } from "@/app/_mocks/places";
import { mockEmptyRouteSearch, mockRouteSearch, mockTightRouteSearch } from "@/app/_mocks/routes";
import { useLiveRoutes } from "@/apis/queries/useLiveRoutes.query";
import type { RouteEnd } from "@/apis/live/types";
import { MapView } from "@/components/MapView";
import { NotifyDeniedHint } from "@/components/NotifyButton";
import { RouteCard } from "@/components/RouteCard";
import { RouteSearchBar } from "@/components/RouteSearchBar";
import { EmptyState, ErrorState, RouteListSkeleton } from "@/components/StateViews";
import { ESTIMATE_NOTE, isLiveTimed } from "@/utils/format";
import { routeMarkers, routePaths } from "@/utils/mapData";
import {
  DEFAULT_ROUTE_PAIR,
  isMockMode,
  parseRoutePair,
  placeToRouteEnd,
  readFailFlag,
  routePairQuery,
  type FailFlag,
  type RoutePair,
} from "@/utils/routeQuery";
import type { MapMarker, MapPath, NotifyState, Place, RouteSortKey, TransitRoute } from "@/utils/types";
import { RoutesLayout } from "./RoutesLayout";
import { RoutesToolbar } from "./RoutesToolbar";

type DemoState = "ready" | "tight" | "empty" | "error" | "loading";

const { origin: ORIGIN, destination: DESTINATION } = mockRouteSearch;

const BASE_MARKERS: MapMarker[] = [
  { id: "origin", position: ORIGIN.position, label: ORIGIN.name, tone: "origin" },
  { id: "destination", position: DESTINATION.position, label: DESTINATION.name, tone: "destination" },
];

const DEFAULT_NOTIFY: Record<string, NotifyState> = { a: "idle", b: "on" };

const ALL_ROUTES = [...mockRouteSearch.routes, ...mockTightRouteSearch.routes];
const PATHS_BY_ROUTE = new Map(ALL_ROUTES.map((r) => [r.id, routePaths(r)]));
const MARKERS_BY_ROUTE = new Map(ALL_ROUTES.map((r) => [r.id, routeMarkers(r, ORIGIN, DESTINATION)]));
const NO_PATHS: MapPath[] = [];

const BADGE: Record<RouteSortKey, string> = {
  arrival: "가장 빨리 도착",
  walk: "도보 가장 짧음",
  transfer: "환승 가장 적음",
};

function toDemoState(value: string | null): DemoState {
  return value === "tight" || value === "empty" || value === "error" || value === "loading" ? value : "ready";
}

const walkMinutes = (r: TransitRoute) => r.legs.reduce((sum, l) => sum + (l.kind === "walk" ? l.minutes : 0), 0);

const COMPARE: Record<RouteSortKey, (a: TransitRoute, b: TransitRoute) => number> = {
  arrival: (a, b) => a.totalMinutes - b.totalMinutes,
  walk: (a, b) => walkMinutes(a) - walkMinutes(b) || a.totalMinutes - b.totalMinutes,
  transfer: (a, b) => a.transferCount - b.transferCount || a.totalMinutes - b.totalMinutes,
};

// 실시간 경로는 이미 도착 예상 순으로 와서, 대기까지 계산한 경로를 앞에 두기만 한다(안정 정렬)
const LIVE_COMPARE: Record<RouteSortKey, (a: TransitRoute, b: TransitRoute) => number> = {
  ...COMPARE,
  arrival: (a, b) => Number(isLiveTimed(b)) - Number(isLiveTimed(a)),
};

const noop = () => {};

const STATE_CARD = "mx-4 overflow-hidden rounded-lg bg-surface shadow-card";
const NOTICE = "mx-4 mb-3 rounded-lg bg-surface px-4 py-3 shadow-card";
const NOTE = "px-5 pb-3 text-xs text-fg-muted";
const LIST = "flex flex-col gap-3 px-4";

export function RoutesScreen() {
  const params = useSearchParams();
  if (isMockMode(params)) return <MockRoutesScreen />;
  const pair = parseRoutePair(params) ?? DEFAULT_ROUTE_PAIR;
  const pairQuery = routePairQuery(pair);
  return <LiveRoutesScreen key={pairQuery} pair={pair} pairQuery={pairQuery} fail={readFailFlag(params)} />;
}

function MockRoutesScreen() {
  const router = useRouter();
  const params = useSearchParams();
  const demo = toDemoState(params.get("state"));
  const notifyDenied = params.get("notify") === "denied";
  const search = demo === "empty" ? mockEmptyRouteSearch : demo === "tight" ? mockTightRouteSearch : mockRouteSearch;
  const ready = demo === "ready" || demo === "tight";
  const routes = ready ? search.routes : [];

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
    router.replace(
      `/routes?mock=1&from=${encodeURIComponent(origin.id)}&to=${encodeURIComponent(destination.id)}`,
    );
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
        <section aria-label="검색된 경로" className="pt-3">
          {demo === "loading" && <RouteListSkeleton count={3} />}
          {demo === "error" && (
            <div className={STATE_CARD}>
              <ErrorState onRetry={() => router.replace("/routes?mock=1")} />
            </div>
          )}
          {demo === "empty" && (
            <div className={STATE_CARD}>
              <EmptyState
                title="경로가 없습니다"
                message="출발지나 도착지를 바꿔 보세요. 대전 시내버스 경로만 찾을 수 있어요."
              />
            </div>
          )}
          {ready && visible.length > 0 && (
            <>
              {notifyDenied && (
                <div className={NOTICE}>
                  <NotifyDeniedHint />
                </div>
              )}
              <p className={NOTE}>{ESTIMATE_NOTE}</p>
              <ul className={LIST}>
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

type Ends = { origin: Place; destination: Place };
type MapData = { key: string; paths: MapPath[]; markers: MapMarker[] };

function endPlace(end: RouteEnd, id: string): Place {
  return { id, name: end.name, address: "", category: "", position: end.position };
}

function baseMapData({ origin, destination }: Ends): MapData {
  return {
    key: "",
    paths: NO_PATHS,
    markers: [
      { id: "origin", position: origin.position, label: origin.name, tone: "origin" },
      { id: "destination", position: destination.position, label: destination.name, tone: "destination" },
    ],
  };
}

// 실시간 경로 객체는 매 틱 새로 만들어지므로 지도 데이터는 이 문자열이 바뀔 때만 다시 만든다
function mapKeyOf(route: TransitRoute): string {
  return `${route.id}|${route.legs.map((l) => (l.kind === "bus" ? `${l.busType}:${l.routeNo}` : "w")).join(",")}`;
}

function LiveRoutesScreen({ pair, pairQuery, fail }: { pair: RoutePair; pairQuery: string; fail: FailFlag | null }) {
  const router = useRouter();
  const params = useSearchParams();
  const notifyDenied = params.get("notify") === "denied";
  const failQuery = fail ? `&fail=${fail}` : "";
  const live = useLiveRoutes(pair, { fail });

  const [ends] = useState<Ends>(() => ({
    origin: endPlace(pair.origin, "live-origin"),
    destination: endPlace(pair.destination, "live-destination"),
  }));
  const [places, setPlaces] = useState<{ origin: Place | null; destination: Place | null }>(ends);
  // RouteSearchBar는 onChange 직후 같은 이벤트에서 onSubmit을 부르므로 최신 값을 따로 들고 있는다
  const latest = useRef(places);
  const [notify, setNotify] = useState<Record<string, NotifyState>>({});
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [sort, setSort] = useState<RouteSortKey>("arrival");
  const [mapData, setMapData] = useState<MapData>(() => baseMapData(ends));

  const visible = live.status === "ready" ? [...live.routes].sort(LIVE_COMPARE[sort]) : [];
  const selected = visible.find((r) => r.id === selectedId) ?? visible[0];
  const mapKey = selected ? mapKeyOf(selected) : "";
  let map = mapData;
  if (mapData.key !== mapKey) {
    map = selected
      ? { key: mapKey, paths: routePaths(selected), markers: routeMarkers(selected, ends.origin, ends.destination) }
      : baseMapData(ends);
    setMapData(map);
  }

  const realtimeFailed =
    visible.length > 0 && visible.every((r) => !isLiveTimed(r) && r.realtime !== "loading");

  function changePlaces(next: { origin: Place | null; destination: Place | null }) {
    latest.current = next;
    setPlaces(next);
  }

  function submit() {
    const { origin, destination } = latest.current;
    if (!origin || !destination) return;
    const next: RoutePair = { origin: placeToRouteEnd(origin), destination: placeToRouteEnd(destination) };
    router.replace(`/routes?${routePairQuery(next)}${failQuery}`);
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
                onChange={changePlaces}
                onSubmit={submit}
                onBack={() => router.push("/")}
                recent={mockRecentSearches}
              />
            </div>
            <RoutesToolbar
              baseTime={live.baseTime}
              secondsAgo={live.secondsAgo}
              onRefresh={live.refresh}
              sort={sort}
              onSortChange={setSort}
            />
          </>
        }
        map={<MapView label="경로 지도" paths={map.paths} markers={map.markers} obscuredTop={0} obscuredBottom={0} />}
      >
        <section aria-label="검색된 경로" className="pt-3">
          {(live.status === "loading" || live.status === "idle") && <RouteListSkeleton count={3} />}
          {live.status === "error" && (
            <div className={STATE_CARD}>
              <ErrorState title="경로를 불러오지 못했어요" message="잠시 후 다시 시도해 주세요." onRetry={live.refresh} />
            </div>
          )}
          {live.status === "ready" && visible.length === 0 && (
            <div className={STATE_CARD}>
              <EmptyState
                title="경로가 없습니다"
                message="출발지나 도착지를 바꿔 보세요. 대전 시내버스 경로만 찾을 수 있어요."
              />
            </div>
          )}
          {visible.length > 0 && (
            <>
              {realtimeFailed && (
                <div role="status" className={`${NOTICE} flex items-center gap-3`}>
                  <p className="min-w-0 flex-1 text-sm text-fg-secondary">실시간 정보를 못 받았어요. 이동 시간만 보여 드려요</p>
                  <button
                    type="button"
                    onClick={live.refresh}
                    className="h-11 shrink-0 rounded-md bg-action-secondary px-4 text-sm font-semibold text-action-secondary-fg hover:bg-action-secondary-pressed"
                  >
                    다시 시도
                  </button>
                </div>
              )}
              {notifyDenied && (
                <div className={NOTICE}>
                  <NotifyDeniedHint />
                </div>
              )}
              {!realtimeFailed && <p className={NOTE}>{ESTIMATE_NOTE}</p>}
              <ul className={LIST}>
                {visible.map((route, i) => (
                  <li
                    key={route.id}
                    onMouseEnter={() => setSelectedId(route.id)}
                    onFocus={() => setSelectedId(route.id)}
                  >
                    <RouteCard
                      route={route}
                      href={`/routes/${route.id}?${pairQuery}${failQuery}`}
                      now={live.baseTime}
                      badge={i === 0 && isLiveTimed(route) ? BADGE[sort] : undefined}
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
