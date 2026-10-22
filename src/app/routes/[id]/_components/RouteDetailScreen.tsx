"use client";

import { useState } from "react";
import { getRouteById, mockRouteSearch } from "@/app/_mocks/routes";
import { BottomSheet } from "@/components/BottomSheet";
import { MapLayout } from "@/components/MapLayout";
import { MapView } from "@/components/MapView";
import { StepTimeline } from "@/components/StepTimeline";
import { RideInsightPlaceholder, TransferPanel } from "@/components/TransferPanel";
import { routeMarkers, routePaths } from "@/utils/mapData";
import type { MapMarker, MapPath, NotifyState, TransitRoute } from "@/utils/types";
import { RouteSummary } from "./RouteSummary";
import { RouteSwitcher } from "./RouteSwitcher";

const SHEET_SNAPS = [0.3, 0.55, 0.92];

function buildMapData(route: TransitRoute): { paths: MapPath[]; markers: MapMarker[] } {
  return {
    paths: routePaths(route),
    markers: routeMarkers(route, mockRouteSearch.origin, mockRouteSearch.destination),
  };
}

const MAP_DATA = new Map(mockRouteSearch.routes.map((route) => [route.id, buildMapData(route)]));

function noop() {}

export function RouteDetailScreen({ routeId }: { routeId: string }) {
  const [notifyState, setNotifyState] = useState<NotifyState>("idle");
  const route = getRouteById(routeId);
  const mapData = MAP_DATA.get(routeId);
  if (!route || !mapData) return null;

  return (
    <MapLayout
      map={
        <MapView
          label="경로 지도"
          paths={mapData.paths}
          markers={mapData.markers}
          obscuredBottom={0.55}
          obscuredTop={72}
        />
      }
      header={<RouteSwitcher routes={mockRouteSearch.routes} currentId={route.id} />}
      panel={
        <BottomSheet label="경로 상세" snaps={SHEET_SNAPS} initialSnap={1}>
          <RouteSummary
            route={route}
            secondsAgo={mockRouteSearch.updatedSecondsAgo}
            onRefresh={noop}
            notifyState={notifyState}
            onNotifyChange={setNotifyState}
          />
          <div className="border-t border-line px-4 py-4">
            <StepTimeline
              route={route}
              originName={mockRouteSearch.origin.name}
              destinationName={mockRouteSearch.destination.name}
            />
          </div>
          <div className="px-4 pb-6 [&>section:not(:last-child)]:border-b-0">
            <TransferPanel route={route} secondsAgo={mockRouteSearch.updatedSecondsAgo} onRefresh={noop} />
            <RideInsightPlaceholder />
          </div>
        </BottomSheet>
      }
    />
  );
}
