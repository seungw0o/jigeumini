import type { ReactNode } from "react";
import { BottomSheet } from "@/components/BottomSheet";
import { LeaveBadge } from "@/components/LeaveBadge";
import { MapLayout } from "@/components/MapLayout";
import { MapView } from "@/components/MapView";
import { NotifyButton } from "@/components/NotifyButton";
import { StepTimeline } from "@/components/StepTimeline";
import { RideInsightPlaceholder, TransferPanel } from "@/components/TransferPanel";
import { totalLabel } from "@/utils/format";
import { formatShortClock } from "@/utils/ribbon";
import type { MapMarker, MapPath, NotifyState, TransitRoute } from "@/utils/types";
import { RouteSummary } from "./RouteSummary";

const SHEET_SNAPS = [0.32, 0.55, 0.92];

function SectionGap() {
  return <div aria-hidden="true" className="h-2 bg-bg" />;
}

export function RouteDetailFrame({
  paths,
  markers,
  header,
  footer,
  children,
}: {
  paths?: MapPath[];
  markers?: MapMarker[];
  header: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
}) {
  return (
    <MapLayout
      map={<MapView label="경로 지도" paths={paths} markers={markers} obscuredBottom={0.5} obscuredTop={64} />}
      header={header}
      panel={
        <BottomSheet label="경로 상세" snaps={SHEET_SNAPS} initialSnap={1} footer={footer}>
          {children}
        </BottomSheet>
      }
    />
  );
}

export function RouteFooterBar({
  route,
  notifyState,
  onNotifyChange,
  showNotify = true,
}: {
  route: TransitRoute;
  notifyState: NotifyState;
  onNotifyChange: (next: NotifyState) => void;
  showNotify?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3 bg-surface px-4 py-2.5 pb-[max(0.625rem,env(safe-area-inset-bottom))] shadow-bar">
      <div className="min-w-0">
        <LeaveBadge route={route} size="md" />
        <p className="mt-1 truncate text-xs text-fg-muted tabular">
          도착 예상 {formatShortClock(route.arriveAt)} · {totalLabel(route)}
        </p>
      </div>
      {showNotify && <NotifyButton variant="primary" state={notifyState} onChange={onNotifyChange} />}
    </div>
  );
}

export function RouteDetailSections({
  route,
  now,
  secondsAgo,
  onRefresh,
  originName,
  destinationName,
}: {
  route: TransitRoute;
  now: string;
  secondsAgo: number;
  onRefresh: () => void;
  originName: string;
  destinationName: string;
}) {
  return (
    <>
      <RouteSummary route={route} now={now} secondsAgo={secondsAgo} onRefresh={onRefresh} />
      <StepTimeline route={route} now={now} originName={originName} destinationName={destinationName} />
      {route.transferCount > 0 && (
        <>
          <SectionGap />
          <TransferPanel route={route} secondsAgo={secondsAgo} onRefresh={onRefresh} />
        </>
      )}
      <SectionGap />
      <RideInsightPlaceholder />
      <SectionGap />
    </>
  );
}
