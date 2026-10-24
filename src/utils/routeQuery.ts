import type { RouteEnd } from "@/apis/live/types";
import type { LatLng, Place } from "./types";

export interface RoutePair {
  origin: RouteEnd;
  destination: RouteEnd;
}

/** /routes를 출발/도착 없이 열면 이 구간을 실시간으로 보여 준다 */
export const DEFAULT_ROUTE_PAIR: RoutePair = {
  origin: { name: "대덕대학교", position: { lat: 36.39007, lng: 127.362274 } },
  destination: { name: "갤러리아타임월드", position: { lat: 36.35272, lng: 127.37907 } },
};

export type FailFlag = "routes" | "arrivals";

type ParamReader = { get(name: string): string | null };

const COORD = /^(-?\d{1,3}(?:\.\d+)?),(-?\d{1,3}(?:\.\d+)?)$/;

export function formatCoord(position: LatLng): string {
  return `${Number(position.lat.toFixed(6))},${Number(position.lng.toFixed(6))}`;
}

export function parseCoord(raw: string | null): LatLng | null {
  const match = raw?.trim().match(COORD);
  if (!match) return null;
  const lat = Number(match[1]);
  const lng = Number(match[2]);
  return Math.abs(lat) <= 90 && Math.abs(lng) <= 180 ? { lat, lng } : null;
}

export function placeToRouteEnd(place: Pick<Place, "name" | "position">): RouteEnd {
  return { name: place.name, position: place.position };
}

/** /routes 와 /routes/[id] 뒤에 붙는 쿼리: from=lat,lng&fromName=..&to=lat,lng&toName=.. */
export function routePairQuery(pair: RoutePair): string {
  return new URLSearchParams({
    from: formatCoord(pair.origin.position),
    fromName: pair.origin.name,
    to: formatCoord(pair.destination.position),
    toName: pair.destination.name,
  }).toString();
}

export function parseRoutePair(params: ParamReader): RoutePair | null {
  const from = parseCoord(params.get("from"));
  const to = parseCoord(params.get("to"));
  if (!from || !to) return null;
  return {
    origin: { name: params.get("fromName")?.trim() || "출발지", position: from },
    destination: { name: params.get("toName")?.trim() || "도착지", position: to },
  };
}

/** QA용 강제 실패: ?fail=routes(카카오 경로 실패) / ?fail=arrivals(실시간 도착 실패) */
export function readFailFlag(params: ParamReader): FailFlag | null {
  const value = params.get("fail");
  return value === "routes" || value === "arrivals" ? value : null;
}
