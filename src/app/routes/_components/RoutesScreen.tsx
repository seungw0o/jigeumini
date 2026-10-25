"use client";

import { useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useLiveRoutes } from "@/apis/queries/useLiveRoutes.query";
import type { RouteEnd } from "@/apis/live/types";
import { MapView } from "@/components/MapView";
import { NotifyDeniedHint } from "@/components/NotifyButton";
import { RouteCard } from "@/components/RouteCard";
import { RouteSearchBar } from "@/components/RouteSearchBar";
import { useDepartureAlerts } from "@/hooks/useDepartureAlerts";
import { useRecentSearches } from "@/hooks/useRecentSearches";
import { EmptyState, ErrorState, RouteListSkeleton } from "@/components/StateViews";
import { isLiveTimed } from "@/utils/format";
import { routeMarkers, routePaths } from "@/utils/mapData";
import {
  DEFAULT_ROUTE_PAIR,
  parseRoutePair,
  placeToRouteEnd,
  readFailFlag,
  routePairQuery,
  type FailFlag,
  type RoutePair,
} from "@/utils/routeQuery";
import type { MapMarker, MapPath, Place, RouteSortKey, TransitRoute } from "@/utils/types";
import { RoutesLayout } from "./RoutesLayout";
import { StaleBadge } from "@/components/StatusChips";
import { RoutesToolbar } from "./RoutesToolbar";

const NO_PATHS: MapPath[] = [];

// 경로 화면 안에서만 쓰는 임시 장소 id (최근 검색에 넣지 않는다)
const SYNTHETIC_IDS = ["live-origin", "live-destination", "current"];

const BADGE: Record<RouteSortKey, string> = {
  arrival: "가장 빨리 도착",
  walk: "도보 가장 짧음",
  transfer: "환승 가장 적음",
};

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

const STATE_CARD = "mx-4 overflow-hidden rounded-lg bg-surface shadow-card";
const NOTICE = "mx-4 mb-3 rounded-lg bg-surface px-4 py-3 shadow-card";
/** 목록 맨 위: 예상 안내 + 정보 시각·새로고침 (툴바가 붐벼서 여기로 내림). 한 줄에 들어가도록 짧은 안내를 쓴다 */
const LIST_NOTE = "교통 상황에 따라 달라질 수 있어요";
function ListHeader({ secondsAgo, onRefresh, note }: { secondsAgo: number; onRefresh: () => void; note: string | null }) {
  return (
    <div className="flex items-center justify-between gap-3 px-5 pb-3">
      <p className="min-w-0 truncate text-xs text-fg-muted">{note}</p>
      <span className="shrink-0">
        <StaleBadge secondsAgo={secondsAgo} onRefresh={onRefresh} />
      </span>
    </div>
  );
}
const LIST = "flex flex-col gap-3 px-4";

export function RoutesScreen() {
  const params = useSearchParams();
  const pair = parseRoutePair(params) ?? DEFAULT_ROUTE_PAIR;
  const pairQuery = routePairQuery(pair);
  return <LiveRoutesScreen key={pairQuery} pair={pair} pairQuery={pairQuery} fail={readFailFlag(params)} />;
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
  const { recent, addRecent } = useRecentSearches();
  const alerts = useDepartureAlerts(pairQuery, live.plan);

  const [ends] = useState<Ends>(() => ({
    origin: endPlace(pair.origin, "live-origin"),
    destination: endPlace(pair.destination, "live-destination"),
  }));
  const [places, setPlaces] = useState<{ origin: Place | null; destination: Place | null }>(ends);
  // RouteSearchBar는 onChange 직후 같은 이벤트에서 onSubmit을 부르므로 최신 값을 따로 들고 있는다
  const latest = useRef(places);
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
    // 이번에 새로 고른 장소만 최근 검색에 넣는다 (도착지를 먼저 = 최신)
    const picked: Place[] = [];
    for (const slot of ["destination", "origin"] as const) {
      const place = next[slot];
      if (place && !SYNTHETIC_IDS.includes(place.id) && place.id !== latest.current[slot]?.id) picked.push(place);
    }
    if (picked.length > 0) addRecent(...picked);
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
                recent={recent}
              />
            </div>
            <RoutesToolbar
              baseTime={live.baseTime}
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
              {(notifyDenied || alerts.denied) && (
                <div className={NOTICE}>
                  <NotifyDeniedHint />
                </div>
              )}
              <ListHeader secondsAgo={live.secondsAgo} onRefresh={live.refresh} note={realtimeFailed ? null : LIST_NOTE} />
              <ul className={LIST}>
                {visible.map((route, i) => (
                  <li key={route.id}>
                    <RouteCard
                      route={route}
                      href={`/routes/${route.id}?${pairQuery}${failQuery}`}
                      now={live.baseTime}
                      badge={i === 0 && isLiveTimed(route) ? BADGE[sort] : undefined}
                      notifyState={notifyDenied ? "denied" : alerts.stateOf(route.id)}
                      onNotifyChange={(next) => alerts.toggle(route.id, next)}
                      showInstallHint={alerts.installHintFor === route.id}
                      selected={route.id === selected?.id}
                      onSelect={() => setSelectedId(route.id)}
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
