import type { LatLng, Place } from "@/utils/types";

export type TransitStepMode = "bus" | "subway" | "walk" | "other";

export interface TransitVehicle {
  /** 카카오 원문, 예: "일반", "마을" */
  type: string;
  /** 노선 번호, 예: "318" */
  name: string;
}

export interface KakaoTransitStep {
  mode: TransitStepMode;
  guidance: string;
  distanceM: number;
  seconds: number;
  /** 정류장 이름만 온다 (ID 없음). 대전 정류장 ID는 matchStop으로 찾는다 */
  stopNames: string[];
  vehicles: TransitVehicle[];
  path: LatLng[];
}

export interface KakaoTransitRoute {
  /** 카카오 원문, 예: "BUS" */
  type: string;
  totalDistanceM: number;
  totalSeconds: number;
  transfers: number;
  fare: { value: number; min: number | null; max: number | null };
  steps: KakaoTransitStep[];
}

export interface KakaoTransitResult {
  status: string;
  counts: { total: number; bus: number; subway: number; busAndSubway: number };
  routes: KakaoTransitRoute[];
}

export interface KakaoWalkRoute {
  distanceM: number;
  seconds: number;
  path: LatLng[];
}

export interface PlaceSearchResult {
  places: Place[];
  totalCount: number;
  isEnd: boolean;
}
