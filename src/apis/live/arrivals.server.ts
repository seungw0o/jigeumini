import "server-only";

import { isStopId, seoulArsIdOf } from "@/shared/region";
import { getArrivalsByStopId } from "../daejeon/daejeon.server";
import type { DaejeonArrival } from "../daejeon/types";
import { isApiError } from "../errors";
import { getSeoulArrivals } from "../seoul/seoul.server";
import type { ArrivalsResponse, StopArrivals } from "./types";

const MAX_STOPS = 20;

/** 정류장 ID(대전 BUS_NODE_ID 7자리, 서울 "seoul:" + ARS 5자리)만 남기고 중복 제거, 최대 20개 */
export function validStopIds(stopIds: string[]): string[] {
  return [...new Set(stopIds.map((id) => id.trim()).filter(isStopId))].slice(0, MAX_STOPS);
}

function arrivalsOf(stopId: string): Promise<DaejeonArrival[]> {
  const arsId = seoulArsIdOf(stopId);
  return arsId === null ? getArrivalsByStopId(stopId, { timeoutMs: 4000 }) : getSeoulArrivals(arsId);
}

export async function getArrivalsForStops(
  stopIds: string[],
  options: { forceFail?: boolean } = {},
): Promise<ArrivalsResponse> {
  const ids = validStopIds(stopIds);
  const fetchedAt = new Date().toISOString();

  if (options.forceFail) {
    const failed: StopArrivals = { ok: false, error: { code: "FORCED", message: "forced failure (?fail=arrivals)" } };
    return { fetchedAt, stops: Object.fromEntries(ids.map((id) => [id, failed])) };
  }

  const settled = await Promise.allSettled(ids.map(arrivalsOf));
  const stops: Record<string, StopArrivals> = {};
  settled.forEach((outcome, i) => {
    const source = seoulArsIdOf(ids[i]) === null ? "daejeon" : "seoul";
    stops[ids[i]] =
      outcome.status === "fulfilled"
        ? { ok: true, arrivals: outcome.value }
        : {
            ok: false,
            error: isApiError(outcome.reason)
              ? { code: outcome.reason.code, message: `${source} arrivals failed (${outcome.reason.code})` }
              : { code: "NETWORK", message: `${source} arrivals failed` },
          };
  });
  return { fetchedAt, stops };
}
