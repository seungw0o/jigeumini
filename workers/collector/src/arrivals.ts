import type { DaejeonArrival } from "../../../src/apis/daejeon/types";
import { fetchSeoulArrivals } from "../../../src/apis/seoul/parse";
import { seoulArsIdOf } from "../../../src/shared/region";
import { fetchStopArrivals } from "./daejeon";

const SEOUL_TIMEOUT_MS = 8000;

/** 출발 알림의 승차 정류장 도착 정보. 정류장 ID로 지역을 골라 대전 BIS나 서울 API를 부른다(키는 같은 DATA_GO_KR_KEY) */
export function fetchBoardArrivals(serviceKey: string, stopId: string): Promise<DaejeonArrival[]> {
  const arsId = seoulArsIdOf(stopId);
  return arsId === null ? fetchStopArrivals(serviceKey, stopId) : fetchSeoulArrivals(serviceKey, arsId, { timeoutMs: SEOUL_TIMEOUT_MS });
}
