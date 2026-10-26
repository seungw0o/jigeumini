// 카카오 대중교통 경로를 우리 RoutePlan 모양으로 바꾸는 순수 함수. 정류장 ID 매칭은 plan.server.ts에서 한다.

import { regionOf } from "@/shared/region";
import type { BusType, LatLng } from "@/utils/types";
import { haversineMeters } from "../geo";
import type { KakaoTransitResult, KakaoTransitRoute, KakaoTransitStep } from "../kakao/types";
import { normalizeStopName } from "../matching";
import type { PlannedBusLeg, PlannedLeg, PlannedRoute, RouteEnd } from "./types";

// 카카오 vehicle type 원문 -> 유형. 실호출에서 본 값은 일반, 마을, 광역
const BUS_TYPES: Record<string, BusType> = {
  마을: "village",
  급행: "express",
  광역: "outer",
  외곽: "outer",
};

// 서울 카카오 vehicle type 원문(2026-10-26 실호출: 간선, 직행). 직행(경기 직행좌석)은 광역과 같은 빨간색으로 본다
const SEOUL_BUS_TYPES: Record<string, BusType> = {
  간선: "trunk",
  지선: "branch",
  마을: "village",
  순환: "circular",
  광역: "wide",
  직행: "wide",
};

export function toPlannedRoutes(result: KakaoTransitResult, origin: RouteEnd, destination: RouteEnd): PlannedRoute[] {
  return result.routes.filter(isBusOnly).map((route, i) => ({
    id: `l${i}`,
    fare: route.fare.value,
    transferCount: route.transfers,
    totalSeconds: route.totalSeconds,
    legs: fillMissingWalks(toLegs(route.steps, origin, destination), route.totalSeconds, origin, destination),
  }));
}

/** 이보다 가까우면(m) 걸을 필요 없는 같은 자리로 본다 */
const MIN_WALK_GAP_M = 30;
/** 카카오 총소요에 남는 시간이 없을 때 쓰는 도보 속도(m/s, 우회 포함 직선 기준) */
const FALLBACK_WALK_M_PER_S = 0.85;

// 카카오 publictraffic은 출발지 -> 첫 정류장, 마지막 정류장 -> 도착지, 붙어 있는 두 BUS 구간 사이 도보를 빼고 주고
// 그 시간은 totalSeconds에만 넣는다(2026-10-22 실호출: 출발지에서 607m 떨어진 정류장인데 WALKING 없음).
// 빈 자리마다 직선 거리 비율로 남는 시간(totalSeconds - 구간 합)을 나눠 도보 구간을 만들고, 남는 시간이 없으면 속도로 어림한다.
function fillMissingWalks(legs: PlannedLeg[], totalSeconds: number, origin: RouteEnd, destination: RouteEnd): PlannedLeg[] {
  type Gap = { index: number; from: { name: string; position: LatLng }; to: { name: string; position: LatLng }; m: number };
  const gaps: Gap[] = [];
  const addGap = (index: number, from: Gap["from"], to: Gap["to"]) => {
    const m = haversineMeters(from.position, to.position);
    if (m >= MIN_WALK_GAP_M) gaps.push({ index, from, to, m });
  };
  legs.forEach((leg, i) => {
    if (leg.kind !== "bus") return;
    const prev = legs[i - 1];
    if (!prev) addGap(i, origin, leg.board);
    else if (prev.kind === "bus") addGap(i, prev.alight, leg.board);
    if (i === legs.length - 1) addGap(i + 1, leg.alight, destination);
  });
  if (gaps.length === 0) return legs;

  const missingS = totalSeconds - legs.reduce((sum, leg) => sum + leg.seconds, 0);
  const gapM = gaps.reduce((sum, gap) => sum + gap.m, 0);
  const result = [...legs];
  for (const gap of [...gaps].reverse()) {
    const seconds = missingS > 0 ? Math.round((missingS * gap.m) / gapM) : Math.round(gap.m / FALLBACK_WALK_M_PER_S);
    result.splice(gap.index, 0, {
      kind: "walk",
      seconds,
      distanceM: Math.round(gap.m / 10) * 10,
      from: gap.from.name,
      to: gap.to.name,
      path: [gap.from.position, gap.to.position],
    });
  }
  return result;
}

/** 정류장 메모 키: 공백 뺀 이름 + 좌표(소수 4자리, 약 10m) */
export function stopKey(target: { name: string; position: LatLng }): string {
  const { lat, lng } = target.position;
  return `${normalizeStopName(target.name)}@${lat.toFixed(4)},${lng.toFixed(4)}`;
}

function isBusOnly(route: KakaoTransitRoute): boolean {
  let hasBus = false;
  for (const step of route.steps) {
    if (step.mode === "bus") {
      if (step.path.length === 0 || routeNosOf(step).length === 0 || !step.stopNames[0]) return false;
      hasBus = true;
    } else if (step.mode !== "walk") {
      return false;
    }
  }
  return hasBus;
}

function toLegs(steps: KakaoTransitStep[], origin: RouteEnd, destination: RouteEnd): PlannedLeg[] {
  const legs: (PlannedLeg | null)[] = steps.map((step) => (step.mode === "bus" ? toBusLeg(step) : null));
  return steps.map((step, i) => {
    const bus = legs[i];
    if (bus) return bus;
    const before = legs.slice(0, i).findLast(isBusLeg);
    const after = legs.slice(i + 1).find(isBusLeg);
    return {
      kind: "walk",
      seconds: step.seconds,
      distanceM: step.distanceM,
      from: before?.alight.name ?? origin.name,
      to: after?.board.name ?? destination.name,
      path: step.path,
    };
  });
}

function toBusLeg(step: KakaoTransitStep): PlannedBusLeg {
  return {
    kind: "bus",
    routeNos: routeNosOf(step),
    busType: (regionOf(step.path[0]) === "seoul" ? SEOUL_BUS_TYPES : BUS_TYPES)[step.vehicles[0]?.type ?? ""] ?? "trunk",
    seconds: step.seconds,
    distanceM: step.distanceM,
    stopCount: Math.max(0, step.stopNames.length - 1),
    board: { name: step.stopNames[0], position: step.path[0], nodeId: null, arsId: null },
    alight: { name: step.stopNames.at(-1) ?? step.stopNames[0], position: step.path.at(-1) ?? step.path[0], nodeId: null, arsId: null },
    path: step.path,
  };
}

function routeNosOf(step: KakaoTransitStep): string[] {
  return [...new Set(step.vehicles.map((vehicle) => vehicle.name).filter(Boolean))];
}

function isBusLeg(leg: PlannedLeg | null): leg is PlannedBusLeg {
  return leg?.kind === "bus";
}
