import { BUS_TYPE_META } from "./format";
import type { MapMarker, MapPath, Place, TransitRoute } from "./types";

export function routePaths(route: TransitRoute): MapPath[] {
  return route.legs.map((leg, i) =>
    leg.kind === "bus"
      ? { points: route.path[i], color: BUS_TYPE_META[leg.busType].color, kind: "bus", label: leg.routeNo }
      : { points: route.path[i], color: "var(--color-walk-fg)", kind: "walk" },
  );
}

export function routeMarkers(route: TransitRoute, origin: Place, destination: Place): MapMarker[] {
  const stops = new Map<string, MapMarker>();
  route.legs.forEach((leg, i) => {
    if (leg.kind !== "bus") return;
    const transfer = route.legs.slice(i + 1).some((l) => l.kind === "bus");
    stops.set(leg.boardStop.id, { id: leg.boardStop.id, position: leg.boardStop.position, label: leg.boardStop.name, tone: "stop" });
    stops.set(leg.alightStop.id, {
      id: leg.alightStop.id,
      position: leg.alightStop.position,
      label: leg.alightStop.name,
      tone: transfer ? "transfer" : "stop",
    });
  });
  const last = route.path[route.path.length - 1];
  return [
    ...stops.values(),
    { id: "origin", position: route.path[0][0], label: origin.name, tone: "origin" },
    { id: "destination", position: last[last.length - 1], label: destination.name, tone: "destination" },
  ];
}
