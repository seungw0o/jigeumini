"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useLiveRoutes } from "@/apis/queries/useLiveRoutes.query";
import { EmptyState, ErrorState, RouteListSkeleton, StateButton } from "@/components/StateViews";
import { isLiveTimed } from "@/utils/format";
import { routeMarkers, routePaths } from "@/utils/mapData";
import { DEFAULT_ROUTE_PAIR, parseRoutePair, readFailFlag, routePairQuery, type RoutePair } from "@/utils/routeQuery";
import type { MapMarker, MapPath, NotifyState, Place, TransitRoute } from "@/utils/types";
import { RouteDetailFrame, RouteDetailSections, RouteFooterBar } from "./RouteDetailParts";
import { RouteSwitcher } from "./RouteSwitcher";

type MapData = { paths: MapPath[]; markers: MapMarker[] };

const NO_PATHS: MapPath[] = [];

function endPlace(id: "origin" | "destination", end: RoutePair["origin"]): Place {
  return { id, name: end.name, address: "", category: "", position: end.position };
}

function buildMapData(pair: RoutePair, route: TransitRoute | undefined): MapData {
  const origin = endPlace("origin", pair.origin);
  const destination = endPlace("destination", pair.destination);
  if (!route) {
    return {
      paths: NO_PATHS,
      markers: [
        { id: "origin", position: origin.position, label: origin.name, tone: "origin" },
        { id: "destination", position: destination.position, label: destination.name, tone: "destination" },
      ],
    };
  }
  return { paths: routePaths(route), markers: routeMarkers(route, origin, destination) };
}

/** 라이브 경로 객체는 매 틱마다 새로 만들어지므로, 지도 데이터는 key 문자열이 바뀔 때만 다시 만든다 */
function useKeyedValue<T>(key: string, compute: () => T): T {
  const [cache, setCache] = useState(() => ({ key, value: compute() }));
  if (cache.key === key) return cache.value;
  const next = { key, value: compute() };
  setCache(next);
  return next.value;
}

function mapKeyOf(query: string, route: TransitRoute | undefined): string {
  if (!route) return query;
  const legs = route.legs.map((leg) => (leg.kind === "bus" ? `${leg.routeNo}:${leg.busType}` : "walk")).join(",");
  return `${query}|${route.id}|${legs}`;
}

export function LiveRouteDetailFallback() {
  return (
    <RouteDetailFrame header={<RouteSwitcher routes={[]} currentId="" />}>
      <RouteListSkeleton count={1} />
    </RouteDetailFrame>
  );
}

export function LiveRouteDetailScreen({ routeId }: { routeId: string }) {
  const router = useRouter();
  const params = useSearchParams();
  const pair = parseRoutePair(params) ?? DEFAULT_ROUTE_PAIR;
  const live = useLiveRoutes(pair, { fail: readFailFlag(params) });
  const [notifyState, setNotifyState] = useState<NotifyState>("idle");

  const query = routePairQuery(pair);
  const route = live.routes.find((r) => r.id === routeId);
  const mapData = useKeyedValue(mapKeyOf(query, route), () => buildMapData(pair, route));
  const header = <RouteSwitcher routes={live.routes} currentId={routeId} query={query} />;

  if (live.status === "error") {
    return (
      <RouteDetailFrame paths={mapData.paths} markers={mapData.markers} header={header}>
        <ErrorState title="경로를 불러오지 못했어요" onRetry={live.refresh} />
      </RouteDetailFrame>
    );
  }

  if (live.status !== "ready") {
    return (
      <RouteDetailFrame paths={mapData.paths} markers={mapData.markers} header={header}>
        <RouteListSkeleton count={1} />
      </RouteDetailFrame>
    );
  }

  if (!route) {
    return (
      <RouteDetailFrame paths={mapData.paths} markers={mapData.markers} header={header}>
        <EmptyState
          title="이 경로를 찾을 수 없어요"
          message="경로 목록이 바뀌었을 수 있어요. 목록에서 다시 골라 주세요."
          action={<StateButton onClick={() => router.push(`/routes?${query}`)}>경로 목록 보기</StateButton>}
        />
      </RouteDetailFrame>
    );
  }

  return (
    <RouteDetailFrame
      paths={mapData.paths}
      markers={mapData.markers}
      header={header}
      footer={
        <RouteFooterBar
          route={route}
          notifyState={notifyState}
          onNotifyChange={setNotifyState}
          showNotify={isLiveTimed(route)}
        />
      }
    >
      <RouteDetailSections
        route={route}
        now={live.baseTime}
        secondsAgo={live.secondsAgo}
        onRefresh={live.refresh}
        originName={live.origin?.name ?? pair.origin.name}
        destinationName={live.destination?.name ?? pair.destination.name}
      />
    </RouteDetailFrame>
  );
}
