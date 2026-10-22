"use client";

import { useState } from "react";
import { getRouteById, getRouteSearchFor, mockRouteSearch, mockTightRouteSearch } from "@/app/_mocks/routes";
import { routeMarkers, routePaths } from "@/utils/mapData";
import type { MapMarker, MapPath, NotifyState, TransitRoute } from "@/utils/types";
import { RouteDetailFrame, RouteDetailSections, RouteFooterBar } from "./RouteDetailParts";
import { RouteSwitcher } from "./RouteSwitcher";

function buildMapData(route: TransitRoute): { paths: MapPath[]; markers: MapMarker[] } {
  return {
    paths: routePaths(route),
    markers: routeMarkers(route, mockRouteSearch.origin, mockRouteSearch.destination),
  };
}

const MAP_DATA = new Map(
  [...mockRouteSearch.routes, ...mockTightRouteSearch.routes].map((route) => [route.id, buildMapData(route)]),
);

function noop() {}

export function RouteDetailScreen({ routeId }: { routeId: string }) {
  const [notifyState, setNotifyState] = useState<NotifyState>("idle");
  const route = getRouteById(routeId);
  const mapData = MAP_DATA.get(routeId);
  const search = getRouteSearchFor(routeId);
  if (!route || !mapData) return null;

  return (
    <RouteDetailFrame
      paths={mapData.paths}
      markers={mapData.markers}
      header={<RouteSwitcher routes={search.routes} currentId={route.id} />}
      footer={<RouteFooterBar route={route} notifyState={notifyState} onNotifyChange={setNotifyState} />}
    >
      <RouteDetailSections
        route={route}
        now={search.baseTime}
        secondsAgo={search.updatedSecondsAgo}
        onRefresh={noop}
        originName={search.origin.name}
        destinationName={search.destination.name}
      />
    </RouteDetailFrame>
  );
}
