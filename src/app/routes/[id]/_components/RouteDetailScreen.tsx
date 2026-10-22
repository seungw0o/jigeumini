"use client";

import { useState } from "react";
import { getRouteById, mockRouteSearch } from "@/app/_mocks/routes";
import { BottomSheet } from "@/components/BottomSheet";
import { LeaveBadge } from "@/components/LeaveBadge";
import { MapLayout } from "@/components/MapLayout";
import { MapView } from "@/components/MapView";
import { NotifyButton } from "@/components/NotifyButton";
import { StepTimeline } from "@/components/StepTimeline";
import { RideInsightPlaceholder, TransferPanel } from "@/components/TransferPanel";
import { routeMarkers, routePaths } from "@/utils/mapData";
import { formatShortClock } from "@/utils/ribbon";
import type { MapMarker, MapPath, NotifyState, TransitRoute } from "@/utils/types";
import { RouteSummary } from "./RouteSummary";
import { RouteSwitcher } from "./RouteSwitcher";

const SHEET_SNAPS = [0.32, 0.55, 0.92];

function buildMapData(route: TransitRoute): { paths: MapPath[]; markers: MapMarker[] } {
  return {
    paths: routePaths(route),
    markers: routeMarkers(route, mockRouteSearch.origin, mockRouteSearch.destination),
  };
}

const MAP_DATA = new Map(mockRouteSearch.routes.map((route) => [route.id, buildMapData(route)]));

function noop() {}

function SectionGap() {
  return <div aria-hidden="true" className="h-2 bg-canvas" />;
}

function RouteFooterBar({
  route,
  notifyState,
  onNotifyChange,
}: {
  route: TransitRoute;
  notifyState: NotifyState;
  onNotifyChange: (next: NotifyState) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 bg-surface px-4 py-2.5 pb-[max(0.625rem,env(safe-area-inset-bottom))] shadow-bar">
      <div className="min-w-0">
        <LeaveBadge route={route} size="md" />
        <p className="mt-1 truncate text-xs text-muted tabular">
          {formatShortClock(route.arriveAt)} 도착 · 총 {route.totalMinutes}분
        </p>
      </div>
      <NotifyButton variant="primary" state={notifyState} onChange={onNotifyChange} />
    </div>
  );
}

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
          obscuredBottom={0.5}
          obscuredTop={64}
        />
      }
      header={<RouteSwitcher routes={mockRouteSearch.routes} currentId={route.id} />}
      panel={
        <BottomSheet
          label="경로 상세"
          snaps={SHEET_SNAPS}
          initialSnap={1}
          footer={<RouteFooterBar route={route} notifyState={notifyState} onNotifyChange={setNotifyState} />}
        >
          <RouteSummary
            route={route}
            now={mockRouteSearch.baseTime}
            secondsAgo={mockRouteSearch.updatedSecondsAgo}
            onRefresh={noop}
          />
          <StepTimeline
            route={route}
            now={mockRouteSearch.baseTime}
            originName={mockRouteSearch.origin.name}
            destinationName={mockRouteSearch.destination.name}
          />
          {route.transferCount > 0 && (
            <>
              <SectionGap />
              <TransferPanel route={route} secondsAgo={mockRouteSearch.updatedSecondsAgo} onRefresh={noop} />
            </>
          )}
          <SectionGap />
          <RideInsightPlaceholder />
          <SectionGap />
        </BottomSheet>
      }
    />
  );
}
