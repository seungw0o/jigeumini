import { WalkIcon } from "@/assets/icons";
import { BUS_TYPE_META } from "@/utils/format";
import type { Leg } from "@/utils/types";

function legMinutes(leg: Leg): number {
  return leg.kind === "walk" ? leg.minutes : leg.rideMinutes;
}

function describeLeg(leg: Leg): string {
  return leg.kind === "walk" ? `도보 ${leg.minutes}분` : `${leg.routeNo}번 버스 ${leg.rideMinutes}분`;
}

export function SegmentBar({ legs, showRouteNumbers = false }: { legs: Leg[]; showRouteNumbers?: boolean }) {
  return (
    <div role="img" aria-label={legs.map(describeLeg).join(", ")} className="flex flex-col gap-1">
      <div className="flex h-6 gap-px overflow-hidden rounded-sm">
        {legs.map((leg, i) => {
          const grow = { flexGrow: Math.max(legMinutes(leg), 1) };
          if (leg.kind === "walk") {
            return (
              <div
                key={i}
                className="@container flex min-w-9 basis-0 items-center justify-center gap-0.5 bg-walk px-0.5 text-xs text-ink-2 tabular"
                style={grow}
              >
                <WalkIcon size={12} className="shrink-0 @max-[3rem]:hidden" />
                <span className="truncate">{leg.minutes}분</span>
              </div>
            );
          }
          return (
            <div
              key={i}
              className="flex min-w-9 basis-0 items-center justify-center px-0.5 text-xs font-semibold text-white tabular"
              style={{ ...grow, backgroundColor: BUS_TYPE_META[leg.busType].color }}
            >
              <span className="truncate">{leg.rideMinutes}분</span>
            </div>
          );
        })}
      </div>
      {showRouteNumbers && (
        <div className="flex h-4 gap-px">
          {legs.map((leg, i) => (
            <div
              key={i}
              className="min-w-9 basis-0 truncate px-0.5 text-center text-xs leading-4 font-semibold tabular"
              style={{
                flexGrow: Math.max(legMinutes(leg), 1),
                color: leg.kind === "bus" ? BUS_TYPE_META[leg.busType].color : undefined,
              }}
            >
              {leg.kind === "bus" ? leg.routeNo : null}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
