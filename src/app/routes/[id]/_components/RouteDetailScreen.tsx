"use client";

import { useState } from "react";
import { getRouteById, mockRouteSearch } from "@/app/_mocks/routes";
import { BottomSheet } from "@/components/BottomSheet";
import { MapLayout } from "@/components/MapLayout";
import { MapView, type MapMarker, type MapPath } from "@/components/MapView";
import { StepTimeline } from "@/components/StepTimeline";
import { RideInsightPlaceholder, TransferPanel } from "@/components/TransferPanel";
import { BUS_TYPE_META } from "@/utils/format";
import type { NotifyState, TransitRoute } from "@/utils/types";
import { RouteSummary } from "./RouteSummary";
import { RouteSwitcher } from "./RouteSwitcher";

const SHEET_SNAPS = [0.3, 0.55, 0.92];

function buildMapData(route: TransitRoute): { paths: MapPath[]; markers: MapMarker[] } {
  const paths: MapPath[] = route.legs.map((leg, i) =>
    leg.kind === "bus"
      ? { points: route.path[i], color: BUS_TYPE_META[leg.busType].color }
      : { points: route.path[i], color: "var(--color-line-strong)", dashed: true },
  );

  const stops = new Map<string, MapMarker>();
  for (const leg of route.legs) {
    if (leg.kind !== "bus") continue;
    for (const stop of [leg.boardStop, leg.alightStop]) {
      stops.set(stop.id, { id: stop.id, position: stop.position, label: stop.name, tone: "stop" });
    }
  }

  const lastPath = route.path[route.path.length - 1];
  const markers: MapMarker[] = [
    ...stops.values(),
    { id: "origin", position: route.path[0][0], label: mockRouteSearch.origin.name, tone: "origin" },
    { id: "destination", position: lastPath[lastPath.length - 1], label: mockRouteSearch.destination.name, tone: "destination" },
  ];

  return { paths, markers };
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
