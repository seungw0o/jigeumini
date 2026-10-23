import "server-only";

import { readKey, requestText, type RequestOptions } from "../http.server";
import { daejeonUrl, parseArrivals, parseBusPositions, readServiceResult } from "./parse";
import type { DaejeonArrival, DaejeonBusPosition } from "./types";

/** 정류소 BUS_NODE_ID(7자리)로 도착 예정 버스 목록 */
export function getArrivalsByStopId(busStopId: string, options?: RequestOptions): Promise<DaejeonArrival[]> {
  return fetchArrivals("getArrInfoByStopID", { BusStopID: busStopId }, options);
}

/** 정류소 ARS 번호(5자리)로 도착 예정 버스 목록 */
export function getArrivalsByArs(arsId: string, options?: RequestOptions): Promise<DaejeonArrival[]> {
  return fetchArrivals("getArrInfoByUid", { arsId }, options);
}

/** 노선 ROUTE_CD로 운행 중인 버스 위치. 개발 계정 하루 100회 한도라 자주 부르지 말 것 */
export async function getBusPositions(routeCd: string, options?: RequestOptions): Promise<DaejeonBusPosition[]> {
  const xml = await fetchServiceResult("busposinfo/getBusPosByRtid", { busRouteId: routeCd }, options);
  return parseBusPositions(xml, routeCd);
}

async function fetchArrivals(
  operation: string,
  params: Record<string, string>,
  options?: RequestOptions,
): Promise<DaejeonArrival[]> {
  return parseArrivals(await fetchServiceResult(`arrive/${operation}`, params, options));
}

async function fetchServiceResult(path: string, params: Record<string, string>, options?: RequestOptions) {
  const url = daejeonUrl(path, readKey("DATA_GO_KR_KEY", "daejeon"), params);
  return readServiceResult(path, await requestText("daejeon", url, options));
}
