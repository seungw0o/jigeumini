import { requestText } from "../../../src/apis/http";
import { daejeonUrl, parseArrivals, readServiceResult } from "../../../src/apis/daejeon/parse";
import type { DaejeonArrival } from "../../../src/apis/daejeon/types";

const ARRIVALS_PATH = "arrive/getArrInfoByStopID";
const TIMEOUT_MS = 8000;

export async function fetchStopArrivals(serviceKey: string, nodeId: string): Promise<DaejeonArrival[]> {
  const url = daejeonUrl(ARRIVALS_PATH, serviceKey, { BusStopID: nodeId });
  return parseArrivals(readServiceResult(ARRIVALS_PATH, await requestText("daejeon", url, { timeoutMs: TIMEOUT_MS })));
}
