import "server-only";

import { regionOf, seoulStopId } from "@/shared/region";
import { getTransitRoutes } from "../kakao/kakao.server";
import { matchStop, normalizeSeoulStopName, pickServedCandidate, sameNameCandidates } from "../matching";
import { getSeoulArrivals, getSeoulStationsNear } from "../seoul/seoul.server";
import { findNearbyStops } from "../tago/tago.server";
import { stopKey, toPlannedRoutes } from "./plan";
import type { PlannedStop, RouteEnd, RoutePlan } from "./types";

/** 지역이 붙은 정류장 ID(대전 BUS_NODE_ID, 서울 "seoul:<ARS>")와 ARS */
interface ResolvedStop {
  stopId: string;
  arsId: string | null;
}

// 정류장은 움직이지 않으니 매칭 결과를 프로세스 메모리에 둔다. 서버가 다시 뜨면 비고, 외부 캐시는 없다.
// null은 "주변에 같은 이름 정류장이 확실히 없음"이다. 호출 실패는 저장하지 않아 다음 요청에서 다시 묻는다.
// 서울은 같은 자리 승강장을 노선으로 가르므로 키에 노선 번호를 붙인다.
const stopMemo = new Map<string, ResolvedStop | null>();
const STOP_MEMO_LIMIT = 2000;
const SEOUL_SEARCH_RADIUS_M = 200;

export async function getRoutePlan(origin: RouteEnd, destination: RouteEnd): Promise<RoutePlan> {
  const result = await getTransitRoutes(
    {
      origin: origin.position,
      destination: destination.position,
      originName: origin.name,
      destinationName: destination.name,
    },
    { timeoutMs: 8000 },
  );
  const routes = toPlannedRoutes(result, origin, destination);

  const boards = new Map<string, { stops: PlannedStop[]; routeNos: string[] }>();
  for (const route of routes) {
    for (const leg of route.legs) {
      if (leg.kind !== "bus") continue;
      const key = memoKey(leg.board, leg.routeNos);
      const group = boards.get(key) ?? { stops: [], routeNos: leg.routeNos };
      group.stops.push(leg.board);
      boards.set(key, group);
    }
  }

  await Promise.allSettled(
    [...boards.entries()].map(async ([key, { stops, routeNos }]) => {
      const match = await resolveStop(key, stops[0], routeNos);
      if (!match) return;
      for (const stop of stops) {
        stop.nodeId = match.stopId;
        stop.arsId = match.arsId;
      }
    }),
  );

  return { origin, destination, routes };
}

function memoKey(stop: PlannedStop, routeNos: string[]): string {
  const key = stopKey(stop);
  return regionOf(stop.position) === "seoul" ? `seoul|${key}|${[...routeNos].sort().join(",")}` : key;
}

async function resolveStop(key: string, target: PlannedStop, routeNos: string[]): Promise<ResolvedStop | null> {
  const cached = stopMemo.get(key);
  if (cached !== undefined) return cached;
  const region = regionOf(target.position);
  let match: ResolvedStop | null = null;
  let complete = true;
  if (region === "daejeon") {
    const found = matchStop(target, await findNearbyStops(target.position, { timeoutMs: 4000 }));
    match = found && { stopId: found.daejeonNodeId, arsId: found.arsId };
  } else if (region === "seoul") {
    const stations = await getSeoulStationsNear(target.position, SEOUL_SEARCH_RADIUS_M);
    const candidates = sameNameCandidates(
      target,
      stations.map((s) => ({ stopId: seoulStopId(s.arsId), arsId: s.arsId, name: s.name, position: s.position })),
      normalizeSeoulStopName,
    );
    const picked = await pickServedCandidate(candidates, routeNos, (c) => getSeoulArrivals(c.arsId ?? ""));
    match = picked.candidate && { stopId: picked.candidate.stopId, arsId: picked.candidate.arsId };
    complete = picked.complete;
  }
  if (!complete) return match;
  if (stopMemo.size >= STOP_MEMO_LIMIT) stopMemo.clear();
  stopMemo.set(key, match);
  return match;
}
