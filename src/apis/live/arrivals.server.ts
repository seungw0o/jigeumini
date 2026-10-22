import "server-only";

import { getArrivalsByStopId } from "../daejeon/daejeon.server";
import { isApiError } from "../errors";
import type { ArrivalsResponse, StopArrivals } from "./types";

const NODE_ID = /^\d{7}$/;
const MAX_STOPS = 20;

/** 대전 BUS_NODE_ID(7자리)만 남기고 중복 제거, 최대 20개 */
export function validStopIds(nodeIds: string[]): string[] {
  return [...new Set(nodeIds.map((id) => id.trim()).filter((id) => NODE_ID.test(id)))].slice(0, MAX_STOPS);
}

export async function getArrivalsForStops(
  nodeIds: string[],
  options: { forceFail?: boolean } = {},
): Promise<ArrivalsResponse> {
  const ids = validStopIds(nodeIds);
  const fetchedAt = new Date().toISOString();

  if (options.forceFail) {
    const failed: StopArrivals = { ok: false, error: { code: "FORCED", message: "forced failure (?fail=arrivals)" } };
    return { fetchedAt, stops: Object.fromEntries(ids.map((id) => [id, failed])) };
  }

  const settled = await Promise.allSettled(ids.map((id) => getArrivalsByStopId(id, { timeoutMs: 4000 })));
  const stops: Record<string, StopArrivals> = {};
  settled.forEach((outcome, i) => {
    stops[ids[i]] =
      outcome.status === "fulfilled"
        ? { ok: true, arrivals: outcome.value }
        : {
            ok: false,
            error: isApiError(outcome.reason)
              ? { code: outcome.reason.code, message: `daejeon arrivals failed (${outcome.reason.code})` }
              : { code: "NETWORK", message: "daejeon arrivals failed" },
          };
  });
  return { fetchedAt, stops };
}
