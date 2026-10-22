import { mockRouteSearch } from "@/app/_mocks/routes";
import { BottomSheet } from "@/components/BottomSheet";
import { MapLayout } from "@/components/MapLayout";
import { MapView } from "@/components/MapView";
import { RouteListSkeleton } from "@/components/StateViews";
import { RoutesToolbar } from "./RoutesToolbar";

export function RoutesFallback() {
  return (
    <MapLayout
      header={<div aria-hidden="true" className="h-[90px] rounded-lg border border-line bg-surface shadow-float lg:shadow-none" />}
      map={<MapView label="경로 지도" />}
      panel={
        <BottomSheet label="경로 목록" snaps={[0.3, 0.62, 0.9]} initialSnap={1}>
          <div className="mx-auto w-full max-w-xl">
            <RoutesToolbar baseTime={mockRouteSearch.baseTime} secondsAgo={mockRouteSearch.updatedSecondsAgo} />
            <RouteListSkeleton count={3} />
          </div>
        </BottomSheet>
      }
    />
  );
}
