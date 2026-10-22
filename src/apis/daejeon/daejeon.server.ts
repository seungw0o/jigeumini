import "server-only";

import { ApiError } from "../errors";
import { readKey, requestText, type RequestOptions } from "../http.server";
import { readXmlItems, readXmlTag } from "../xml";
import type {
  ApproachPhase,
  ArrivalState,
  BusRouteType,
  DaejeonArrival,
  DaejeonBusPosition,
  RunType,
} from "./types";

const BASE_URL = "https://apis.data.go.kr/6300000";

const ROUTE_TYPES: Record<string, BusRouteType> = {
  "1": "express",
  "2": "trunk",
  "3": "branch",
  "4": "outer",
  "5": "village",
  "6": "advanced",
};

const APPROACH_PHASES: Record<string, ApproachPhase> = {
  "01": "arrived",
  "02": "departed",
  "03": "minutesAway",
  "04": "passingIntersection",
  "06": "entering",
};

const RUN_TYPES: Record<string, RunType> = { "1": "first", "2": "last", "3": "normal" };

const EVENTS: Record<string, DaejeonBusPosition["event"]> = { "1": "periodic", "2": "stop" };

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
  return readXmlItems(xml, "itemList").map((item) => ({
    routeCd: item.ROUTE_CD ?? routeCd,
    plateNo: item.PLATE_NO ?? "",
    nodeId: item.BUS_NODE_ID ?? "",
    arsId: item.BUS_STOP_ID ?? "",
    position: { lat: requireNumber(item.GPS_LATI, "GPS_LATI"), lng: requireNumber(item.GPS_LONG, "GPS_LONG") },
    direction: toNumber(item.DIR),
    event: EVENTS[item.EVT_CD ?? ""] ?? "unknown",
    passedAt: compactToIso(item.ARR_TIME),
    storedAt: compactToIso(item.STRE_DT),
    totalDistanceM: toNumber(item.TOTAL_DIST),
  }));
}

async function fetchArrivals(
  operation: string,
  params: Record<string, string>,
  options?: RequestOptions,
): Promise<DaejeonArrival[]> {
  const xml = await fetchServiceResult(`arrive/${operation}`, params, options);
  return readXmlItems(xml, "itemList").map(toArrival);
}

// headerCd 0 정상, 4 결과 없음(빈 목록으로 돌려준다), 그 밖은 서비스 오류
async function fetchServiceResult(path: string, params: Record<string, string>, options?: RequestOptions) {
  const url = new URL(`${BASE_URL}/${path}`);
  url.searchParams.set("serviceKey", readKey("DATA_GO_KR_KEY", "daejeon"));
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);

  const xml = await requestText("daejeon", url, options);
  const headerCd = readXmlTag(xml, "headerCd");
  if (headerCd === "0") return xml;
  if (headerCd === "4") return "";
  if (headerCd === undefined) throw new ApiError("PARSE", "daejeon", `${path}: no headerCd in response`);
  throw new ApiError("SERVICE_ERROR", "daejeon", `${path}: headerCd ${headerCd} ${readXmlTag(xml, "headerMsg") ?? ""}`.trim());
}

function toArrival(item: Record<string, string>): DaejeonArrival {
  return {
    routeCd: item.ROUTE_CD ?? "",
    routeNo: item.ROUTE_NO ?? "",
    routeType: ROUTE_TYPES[item.ROUTE_TP ?? ""] ?? "unknown",
    destination: item.DESTINATION ?? "",
    stopNodeId: item.BUS_NODE_ID ?? "",
    arsId: item.BUS_STOP_ID ?? "",
    stopName: item.STOP_NAME ?? "",
    plateNo: item.CAR_REG_NO || null,
    lastStopNodeId: item.LAST_STOP_ID || null,
    runType: RUN_TYPES[item.LAST_CAT ?? ""] ?? null,
    state: toArrivalState(item),
    infoAt: dashedToIso(item.INFO_OFFER_TM),
  };
}

function toArrivalState(item: Record<string, string>): ArrivalState {
  const msgType = item.MSG_TP ?? "";
  // 관측(문서에 없음, 2026-10-22): MSG_TP 07일 때 EXTIME_SEC는 초가 아니라 차고지 출발 예정 시각 HHMM이다.
  // 예) 905 = 09:05, 1457 = 14:57. 같은 응답의 INFO_OFFER_TM이 그 시각보다 앞선다. 이때 EXTIME_MIN은 1, STATUS_POS는 0으로 왔다.
  if (msgType === "07") return { kind: "waitingAtDepot", scheduledDeparture: hhmmToClock(item.EXTIME_SEC) };

  const phase = APPROACH_PHASES[msgType];
  const etaSeconds = toNumber(item.EXTIME_SEC);
  const stopsAway = toNumber(item.STATUS_POS);
  if (!phase || etaSeconds === null || stopsAway === null) return { kind: "unknown", msgType };
  return { kind: "approaching", phase, etaSeconds, stopsAway };
}

function hhmmToClock(raw: string | undefined): string | null {
  if (!raw || !/^\d{1,4}$/.test(raw)) return null;
  const value = Number(raw);
  const hours = Math.floor(value / 100);
  const minutes = value % 100;
  if (hours > 23 || minutes > 59) return null;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

function toNumber(raw: string | undefined): number | null {
  if (raw === undefined || raw === "") return null;
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
}

function requireNumber(raw: string | undefined, field: string): number {
  const value = toNumber(raw);
  if (value === null) throw new ApiError("PARSE", "daejeon", `${field} is not a number`);
  return value;
}

/** "2026-10-22 14:47:42" -> "2026-10-22T14:47:42+09:00" */
function dashedToIso(raw: string | undefined): string | null {
  const match = raw?.match(/^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}:\d{2})$/);
  return match ? `${match[1]}T${match[2]}+09:00` : null;
}

/** "20261022144816" -> "2026-10-22T14:48:16+09:00" */
function compactToIso(raw: string | undefined): string | null {
  const match = raw?.match(/^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})$/);
  return match ? `${match[1]}-${match[2]}-${match[3]}T${match[4]}:${match[5]}:${match[6]}+09:00` : null;
}
