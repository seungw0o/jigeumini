import "server-only";

import type { LatLng, Place } from "@/utils/types";
import { ApiError } from "../errors";
import { readKey, requestJson, type RequestOptions } from "../http.server";
import type {
  KakaoTransitResult,
  KakaoTransitRoute,
  KakaoTransitStep,
  KakaoWalkRoute,
  PlaceSearchResult,
  TransitStepMode,
} from "./types";

const BASE_URL = "https://dapi.kakao.com";

const STEP_MODES: Record<string, TransitStepMode> = { BUS: "bus", SUBWAY: "subway", WALKING: "walk" };

type Json = Record<string, unknown>;

interface TransitQuery {
  origin: LatLng;
  destination: LatLng;
  originName?: string;
  destinationName?: string;
}

export async function getTransitRoutes(query: TransitQuery, options?: RequestOptions): Promise<KakaoTransitResult> {
  const json = await kakaoGet(
    "/v2/routing/publictraffic",
    {
      ...endpoints(query.origin, query.destination),
      ...(query.originName ? { s_name: query.originName } : {}),
      ...(query.destinationName ? { e_name: query.destinationName } : {}),
    },
    options,
  );
  const counts = record(json.properties);
  return {
    status: str(json.status),
    counts: {
      total: num(counts.total),
      bus: num(counts.bus),
      subway: num(counts.subway),
      busAndSubway: num(counts.busAndSubway),
    },
    routes: list(json.routes).map(toTransitRoute),
  };
}

export async function getWalkRoute(origin: LatLng, destination: LatLng, options?: RequestOptions): Promise<KakaoWalkRoute> {
  const json = await kakaoGet("/v2/routing/walk", endpoints(origin, destination), options);
  const route = record(json.route);
  const properties = record(route.properties);
  if (properties.totalTime === undefined) throw new ApiError("PARSE", "kakao", "walk: no route.properties.totalTime");
  return {
    distanceM: num(properties.totalDistance),
    seconds: num(properties.totalTime),
    path: list(route.legs).flatMap((leg) => list(record(leg).steps).flatMap((step) => toPath(record(step).path))),
  };
}

interface PlaceSearchOptions extends RequestOptions {
  /** 이 좌표 기준 거리순 정렬과 distanceM을 받는다 */
  near?: LatLng;
  /** near 기준 반경(m), 최대 20000 */
  radiusM?: number;
  /** near가 있을 때 정렬. 기본 distance, accuracy면 검색어 정확도 순이고 distanceM은 그대로 온다 */
  sort?: "distance" | "accuracy";
  page?: number;
  size?: number;
}

export async function searchPlaces(query: string, options: PlaceSearchOptions = {}): Promise<PlaceSearchResult> {
  const params: Record<string, string> = { query };
  if (options.near) {
    params.x = String(options.near.lng);
    params.y = String(options.near.lat);
    params.sort = options.sort ?? "distance";
    if (options.radiusM !== undefined) params.radius = String(Math.min(20000, Math.round(options.radiusM)));
  }
  if (options.page !== undefined) params.page = String(options.page);
  if (options.size !== undefined) params.size = String(options.size);

  const json = await kakaoGet("/v2/local/search/keyword.json", params, options);
  const meta = record(json.meta);
  return {
    places: list(json.documents).map(toPlace),
    totalCount: num(meta.total_count),
    isEnd: meta.is_end === true,
  };
}

async function kakaoGet(path: string, params: Record<string, string>, options?: RequestOptions): Promise<Json> {
  const key = readKey("KAKAO_REST_KEY", "kakao");
  const url = new URL(path, BASE_URL);
  for (const [name, value] of Object.entries(params)) url.searchParams.set(name, value);
  const json = await requestJson("kakao", url, { ...options, headers: { Authorization: `KakaoAK ${key}` } });
  if (typeof json !== "object" || json === null || Array.isArray(json)) {
    throw new ApiError("PARSE", "kakao", `${path}: body is not an object`);
  }
  return json as Json;
}

// 카카오 좌표는 x = 경도, y = 위도
function endpoints(origin: LatLng, destination: LatLng): Record<string, string> {
  return {
    start_x: String(origin.lng),
    start_y: String(origin.lat),
    end_x: String(destination.lng),
    end_y: String(destination.lat),
  };
}

function toTransitRoute(raw: unknown): KakaoTransitRoute {
  const route = record(raw);
  const properties = record(route.properties);
  const fare = record(properties.fare);
  return {
    type: str(properties.type),
    totalDistanceM: num(properties.totalDistance),
    totalSeconds: num(properties.totalTime),
    transfers: num(properties.transfers),
    fare: { value: num(fare.value), min: optionalNum(fare.min), max: optionalNum(fare.max) },
    steps: list(route.steps).map(toTransitStep),
  };
}

function toTransitStep(raw: unknown): KakaoTransitStep {
  const step = record(raw);
  const properties = record(step.properties);
  return {
    mode: STEP_MODES[str(properties.type)] ?? "other",
    guidance: str(properties.guidance),
    distanceM: num(properties.distance),
    seconds: num(properties.time),
    stopNames: list(properties.stops).map((stop) => str(record(stop).name)),
    vehicles: list(properties.vehicles).map((vehicle) => ({
      type: str(record(vehicle).type),
      name: str(record(vehicle).name),
    })),
    path: toPath(step.path),
  };
}

function toPath(raw: unknown): LatLng[] {
  return list(record(raw).points).flatMap((point) => {
    if (!Array.isArray(point)) return [];
    const [lng, lat] = point.map(Number);
    return Number.isFinite(lat) && Number.isFinite(lng) ? [{ lat, lng }] : [];
  });
}

function toPlace(raw: unknown): Place {
  const doc = record(raw);
  const lat = Number(doc.y);
  const lng = Number(doc.x);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) throw new ApiError("PARSE", "kakao", "place without coordinates");
  const categoryPath = str(doc.category_name).split(">").map((part) => part.trim()).filter(Boolean);
  const distance = optionalNum(doc.distance);
  return {
    id: str(doc.id),
    name: str(doc.place_name),
    address: str(doc.road_address_name) || str(doc.address_name),
    category: str(doc.category_group_name) || (categoryPath.at(-1) ?? ""),
    position: { lat, lng },
    ...(distance === null ? {} : { distanceM: distance }),
  };
}

function record(value: unknown): Json {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? (value as Json) : {};
}

function list(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function str(value: unknown): string {
  return typeof value === "string" ? value.trim() : typeof value === "number" ? String(value) : "";
}

function num(value: unknown): number {
  return optionalNum(value) ?? 0;
}

function optionalNum(value: unknown): number | null {
  if (value === undefined || value === null || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}
