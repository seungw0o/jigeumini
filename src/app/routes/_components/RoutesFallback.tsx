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
          <div className="px-4 pt-3" aria-hidden="true">
            <div className={`h-[88px] rounded-lg ${pulse}`} />
          </div>
          <div aria-hidden="true" className="flex h-14 items-center gap-2 border-b border-line px-4">
            <div className={`h-9 w-[88px] rounded-full ${pulse}`} />
            <div className={`h-9 w-[72px] rounded-full ${pulse}`} />
          </div>
          <div aria-hidden="true" className="flex h-12 items-center gap-5 border-b border-line px-4">
            {[44, 44, 52, 84].map((w, i) => (
              <div key={i} className={`h-4 rounded-sm ${pulse}`} style={{ width: w }} />
            ))}
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
