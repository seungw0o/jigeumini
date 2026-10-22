import { mockRouteSearch } from "@/app/_mocks/routes";
import { MapView } from "@/components/MapView";
import { RouteListSkeleton } from "@/components/StateViews";
import { RoutesLayout } from "./RoutesLayout";
import { RoutesToolbar } from "./RoutesToolbar";

const pulse = "bg-canvas animate-pulse motion-reduce:animate-none";

export function RoutesFallback() {
  return (
    <RoutesLayout
      header={
        <>
          <div className="px-4 pt-3 pb-1 lg:pt-0" aria-hidden="true">
            <div className={`h-[90px] rounded-lg ${pulse}`} />
          </div>
          <RoutesToolbar
            baseTime={mockRouteSearch.baseTime}
            secondsAgo={mockRouteSearch.updatedSecondsAgo}
            sort="arrival"
          />
        </>
      }
      map={<MapView label="경로 지도" />}
    >
      <div className="pt-2">
        <RouteListSkeleton count={3} />
      </div>
    </RoutesLayout>
  );
}
