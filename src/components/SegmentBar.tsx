import { BusGlyph, WalkGlyph } from "@/assets/icons";
import { BUS_TYPE_META } from "@/utils/format";
import type { Leg } from "@/utils/types";

function legMinutes(leg: Leg): number {
  return leg.kind === "walk" ? leg.minutes : leg.rideMinutes;
}

function describeLeg(leg: Leg): string {
  return leg.kind === "walk" ? `도보 ${leg.minutes}분` : `${leg.routeNo}번 버스 ${leg.rideMinutes}분`;
}

function Minutes({ value }: { value: number }) {
  return (
    <span className="truncate tabular">
      {value}
      <span className="text-[10px]">분</span>
    </span>
  );
}

export function SegmentBar({ legs, showRouteNumbers = false }: { legs: Leg[]; showRouteNumbers?: boolean }) {
  const grow = (leg: Leg) => ({ flexGrow: Math.max(legMinutes(leg), 2) });

  return (
    <div role="img" aria-label={legs.map(describeLeg).join(", ")} className="flex flex-col gap-1">
      <div className="flex h-[18px] rounded-full bg-walk">
        {legs.map((leg, i) => {
          if (leg.kind === "walk") {
            return (
              <div
                key={i}
                className="relative flex min-w-8 basis-0 items-center justify-center text-2xs font-medium text-walk-text"
                style={grow(leg)}
              >
                {i === 0 && (
                  <span className="absolute top-0 left-0 flex size-[18px] items-center justify-center rounded-full border border-line-strong bg-surface text-walk-text">
                    <WalkGlyph size={11} />
                  </span>
                )}
                <span className={i === 0 ? "pl-4" : ""}>
                  <Minutes value={leg.minutes} />
                </span>
              </div>
            );
          }
          const color = BUS_TYPE_META[leg.busType].color;
          return (
            <div
              key={i}
              className="relative flex min-w-11 basis-0 items-center justify-center rounded-full pl-4 text-2xs font-semibold text-white"
              style={{ ...grow(leg), backgroundColor: color }}
            >
              <span
                className="absolute top-0 left-0 flex size-[18px] items-center justify-center rounded-full border-2 bg-surface"
                style={{ borderColor: color, color }}
              >
                <BusGlyph size={10} />
              </span>
              <Minutes value={leg.rideMinutes} />
            </div>
          );
        })}
      </div>
      {showRouteNumbers && (
        <div className="flex h-4">
          {legs.map((leg, i) => (
            <div
              key={i}
              className={`basis-0 truncate text-xs leading-4 font-bold tabular ${leg.kind === "bus" ? "min-w-11" : "min-w-8"}`}
              style={{
                flexGrow: Math.max(legMinutes(leg), 2),
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
