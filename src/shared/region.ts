// 서비스 지역(대전, 서울)과 지역이 붙은 정류장 ID. 화면, Route Handler, Worker가 같이 쓴다(상대 경로 import만).
// 정류장 ID: 대전은 BUS_NODE_ID 7자리 그대로(기존 값과 같다), 서울은 "seoul:" + ARS 5자리.

import type { LatLng } from "../utils/types";

export type Region = "daejeon" | "seoul";

interface Bounds {
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
}

// 시 경계를 감싸는 사각형. 경계 바로 밖(서울 옆 경기 일부)도 들어오지만, 그곳 정류장은 매칭이 안 되면 실시간 없이 보여 준다
const BOUNDS: Record<Region, Bounds> = {
  daejeon: { minLat: 36.18, maxLat: 36.5, minLng: 127.24, maxLng: 127.56 },
  seoul: { minLat: 37.42, maxLat: 37.71, minLng: 126.76, maxLng: 127.19 },
};

export const REGION_CENTERS: Record<Region, LatLng> = {
  daejeon: { lat: 36.3622, lng: 127.3712 },
  seoul: { lat: 37.5663, lng: 126.9779 },
};

export function regionOf({ lat, lng }: LatLng): Region | null {
  for (const region of ["daejeon", "seoul"] as const) {
    const b = BOUNDS[region];
    if (lat >= b.minLat && lat <= b.maxLat && lng >= b.minLng && lng <= b.maxLng) return region;
  }
  return null;
}

const DAEJEON_STOP_ID = /^\d{7}$/;
const SEOUL_STOP_ID = /^seoul:(\d{5})$/;

export const seoulStopId = (arsId: string) => `seoul:${arsId}`;

export function seoulArsIdOf(stopId: string): string | null {
  return SEOUL_STOP_ID.exec(stopId)?.[1] ?? null;
}

export function stopRegionOf(stopId: string): Region | null {
  if (DAEJEON_STOP_ID.test(stopId)) return "daejeon";
  if (SEOUL_STOP_ID.test(stopId)) return "seoul";
  return null;
}

export const isStopId = (stopId: string) => stopRegionOf(stopId) !== null;

/**
 * 카카오 노선 번호와 도착 정보 노선 번호를 맞춰 보는 키. 공백은 늘 뺀다.
 * 서울은 카카오가 "N75(심야)"처럼 괄호를 붙이고 서울 API는 "N75"로 줘서 괄호도 뺀다(2026-10-26 실호출).
 */
export function routeNoKey(routeNo: string, stopId: string | null): string {
  const key = routeNo.replace(/\s/g, "");
  return stopId !== null && stopRegionOf(stopId) === "seoul" ? key.replace(/\([^)]*\)/g, "") : key;
}
