import "server-only";

import { getTransitRoutes } from "../kakao/kakao.server";
import { matchStop, type StopMatch } from "../matching";
import { findNearbyStops } from "../tago/tago.server";
import { stopKey, toPlannedRoutes } from "./plan";
import type { PlannedStop, RouteEnd, RoutePlan } from "./types";

// 정류장은 움직이지 않으니 stopKey -> 매칭 결과를 프로세스 메모리에 둔다. 서버가 다시 뜨면 비고, 외부 캐시는 없다.
// null은 "주변에 같은 이름 정류장이 확실히 없음"이다. TAGO 호출 실패는 저장하지 않아 다음 요청에서 다시 묻는다.
const stopMemo = new Map<string, StopMatch | null>();
const STOP_MEMO_LIMIT = 2000;

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

  const boards = new Map<string, PlannedStop[]>();
  for (const route of routes) {
    for (const leg of route.legs) {
      if (leg.kind !== "bus") continue;
      const key = stopKey(leg.board);
      boards.set(key, [...(boards.get(key) ?? []), leg.board]);
    }
  }

  await Promise.allSettled(
    [...boards.values()].map(async (stops) => {
      const match = await resolveStop(stops[0]);
      if (!match) return;
      for (const stop of stops) {
        stop.nodeId = match.daejeonNodeId;
        stop.arsId = match.arsId;
      }
    }),
  );

  return { origin, destination, routes };
}

async function resolveStop(target: PlannedStop): Promise<StopMatch | null> {
  const key = stopKey(target);
  const cached = stopMemo.get(key);
  if (cached !== undefined) return cached;
  const match = matchStop(target, await findNearbyStops(target.position, { timeoutMs: 4000 }));
  if (stopMemo.size >= STOP_MEMO_LIMIT) stopMemo.clear();
  stopMemo.set(key, match);
  return match;
}
