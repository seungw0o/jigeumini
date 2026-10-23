import { requestText } from "../../../src/apis/http";
import { APPROACH_PHASES, daejeonUrl, parseArrivals, readServiceResult } from "../../../src/apis/daejeon/parse";
import type { ArrivalState, DaejeonArrival } from "../../../src/apis/daejeon/types";

const ARRIVALS_PATH = "arrive/getArrInfoByStopID";
const TIMEOUT_MS = 8000;

export async function fetchStopArrivals(serviceKey: string, nodeId: string): Promise<DaejeonArrival[]> {
  const url = daejeonUrl(ARRIVALS_PATH, serviceKey, { BusStopID: nodeId });
  return parseArrivals(readServiceResult(ARRIVALS_PATH, await requestText("daejeon", url, { timeoutMs: TIMEOUT_MS })));
}

const MSG_TYPE_BY_PHASE = Object.fromEntries(Object.entries(APPROACH_PHASES).map(([code, phase]) => [phase, code]));

/** 관측 행에 남길 원래 MSG_TP */
export function msgTypeOf(state: ArrivalState): string {
  if (state.kind === "approaching") return MSG_TYPE_BY_PHASE[state.phase] ?? "";
  if (state.kind === "waitingAtDepot") return "07";
  return state.msgType;
}
