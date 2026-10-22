import { MapView } from "@/components/MapView";
import { RouteListSkeleton } from "@/components/StateViews";
import { RoutesLayout } from "./RoutesLayout";
import { RoutesToolbar } from "./RoutesToolbar";

const line = "rounded-sm bg-skeleton animate-pulse motion-reduce:animate-none";

function SearchFieldSkeleton({ width }: { width: string }) {
  return (
    <div className="flex h-control items-center rounded-md bg-surface-muted pl-3.5">
      <span className="flex w-5 shrink-0">
        <span className="size-2 rounded-full bg-skeleton" />
      </span>
      <div className={`h-4 ${width} ${line}`} />
    </div>
  );
}

export function RoutesFallback() {
  return (
    <RoutesLayout
      header={
        <>
          <div className="px-4 pt-3 pb-1 lg:pt-0" aria-hidden="true">
            <div className="flex gap-1">
              <div className="w-11 shrink-0" />
              <div className="min-w-0 flex-1 space-y-1">
                <SearchFieldSkeleton width="w-28" />
                <SearchFieldSkeleton width="w-36" />
              </div>
              <div className="w-11 shrink-0" />
            </div>
          </div>
          <RoutesToolbar sort="arrival" />
        </>
      }
      map={<MapView label="경로 지도" />}
    >
      <div className="pt-3">
        <RouteListSkeleton count={3} />
      </div>
    </RoutesLayout>
  );
}
