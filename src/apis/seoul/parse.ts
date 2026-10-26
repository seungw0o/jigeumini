// 서울 버스 API(ws.bus.go.kr stationinfo). Next 서버와 Cloudflare Worker가 함께 쓴다: server-only, next/*, process.env 금지.
// 2026-10-26 실호출로 확인: https는 응답이 없어 http만 쓴다. resultType=json이면 msgHeader.headerCd / msgBody.itemList로 온다.
// 등록되지 않은 키는 게이트웨이가 HTTP 401 JSON({"error":"Unauthorized",...})으로 막는다.

import type { LatLng } from "../../utils/types";
import { seoulStopId } from "../../shared/region";
import type { ApproachPhase, ArrivalState, BusRouteType, DaejeonArrival } from "../daejeon/types";
import { ApiError, isApiError } from "../errors";
import { requestJson, type RequestOptions } from "../http";

export const SEOUL_BASE_URL = "http://ws.bus.go.kr/api/rest/stationinfo";

export interface SeoulStation {
  arsId: string;
  stationId: string;
  name: string;
  position: LatLng;
}

// routeType 1 공항 2 마을 3 간선 4 지선 5 순환 6 광역 7 인천 8 경기 0 공용. 실호출에서 심야(N번)는 15로 왔다(문서에 없음)
export const SEOUL_ROUTE_TYPES: Record<string, BusRouteType> = {
  "2": "village",
  "3": "trunk",
  "4": "branch",
  "5": "circular",
  "6": "wide",
  "15": "trunk",
};

type Item = Record<string, unknown>;

export function seoulUrl(operation: string, serviceKey: string, params: Record<string, string>): URL {
  const url = new URL(`${SEOUL_BASE_URL}/${operation}`);
  url.searchParams.set("serviceKey", serviceKey);
  url.searchParams.set("resultType", "json");
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  return url;
}

// headerCd 0 정상, 4 결과 없음(빈 목록), 그 밖은 서비스 오류
export function readSeoulItems(operation: string, json: unknown): Item[] {
  const root = asRecord(json);
  const header = asRecord(root?.msgHeader);
  if (!header) throw new ApiError("PARSE", "seoul", `${operation}: no msgHeader`);
  const code = String(header.headerCd ?? "");
  if (code === "4") return [];
  if (code !== "0") throw new ApiError("SERVICE_ERROR", "seoul", `${operation}: headerCd ${code} ${header.headerMsg ?? ""}`.trim());
  const list = asRecord(root?.msgBody)?.itemList;
  if (list === null || list === undefined) return [];
  if (!Array.isArray(list)) throw new ApiError("PARSE", "seoul", `${operation}: itemList is not an array`);
  return list.map((entry) => {
    const record = asRecord(entry);
    if (!record) throw new ApiError("PARSE", "seoul", `${operation}: item is not an object`);
    return record;
  });
}

async function fetchItems(serviceKey: string, operation: string, params: Record<string, string>, options?: RequestOptions) {
  let json: unknown;
  try {
    json = await requestJson("seoul", seoulUrl(operation, serviceKey, params), options);
  } catch (error) {
    if (isApiError(error) && error.code === "HTTP" && error.status === 401) {
      throw new ApiError("SERVICE_KEY_INVALID", "seoul", `${operation}: unauthorized service key`, 401);
    }
    if (isApiError(error) && error.code === "HTTP" && error.status === 429) {
      throw new ApiError("QUOTA_EXCEEDED", "seoul", `${operation}: too many requests`, 429);
    }
    throw error;
  }
  return readSeoulItems(operation, json);
}

export async function fetchSeoulStations(
  serviceKey: string,
  position: LatLng,
  radiusM: number,
  options?: RequestOptions,
): Promise<SeoulStation[]> {
  const items = await fetchItems(
    serviceKey,
    "getStationByPos",
    { tmX: String(position.lng), tmY: String(position.lat), radius: String(radiusM) },
    options,
  );
  return parseSeoulStations(items);
}

/** ARS 번호(5자리) 정류장의 도착 예정 버스. 노선 한 줄에 첫째/둘째 버스가 같이 와서 버스별로 나눈다 */
export async function fetchSeoulArrivals(serviceKey: string, arsId: string, options?: RequestOptions): Promise<DaejeonArrival[]> {
  return parseSeoulArrivals(await fetchItems(serviceKey, "getStationByUid", { arsId }, options), arsId);
}

// arsId가 "0"인 가상 정류장(미정차)은 도착 정보를 물을 수 없어 뺀다
export function parseSeoulStations(items: Item[]): SeoulStation[] {
  return items.flatMap((item) => {
    const arsId = text(item.arsId);
    const lat = Number(item.gpsY);
    const lng = Number(item.gpsX);
    if (!/^\d{5}$/.test(arsId) || !Number.isFinite(lat) || !Number.isFinite(lng)) return [];
    return [{ arsId, stationId: text(item.stationId), name: text(item.stationNm), position: { lat, lng } }];
  });
}

// 첫째 버스는 늘 남긴다(운행종료여도): 이 정류장에 그 노선이 서는지 알 수 있어야 해서다. 둘째는 시각을 알 때만 남긴다.
// plainNo(번호판)는 null로 오고 repTm은 몇 년 전 값이라(실호출 관측) 쓰지 않는다.
export function parseSeoulArrivals(items: Item[], arsId: string): DaejeonArrival[] {
  return items.flatMap((item) =>
    (["1", "2"] as const).flatMap((n): DaejeonArrival[] => {
      const state = seoulArrivalState(text(item[`arrmsg${n}`]), Number(item[`traTime${n}`]), text(item[`isArrive${n}`]));
      if (n === "2" && state.kind === "unknown") return [];
      return [
        {
          routeCd: text(item.busRouteId),
          routeNo: text(item.rtNm),
          routeType: SEOUL_ROUTE_TYPES[text(item.routeType)] ?? "unknown",
          destination: text(item.adirection),
          stopNodeId: seoulStopId(arsId),
          arsId,
          stopName: text(item.stNm),
          plateNo: null,
          lastStopNodeId: null,
          runType: text(item[`isLast${n}`]) === "1" ? "last" : null,
          state,
          infoAt: null,
        },
      ];
    }),
  );
}

// arrmsg 예(실호출): "6분후[3번째 전]", "3분후[0번째 전]", "곧 도착", "출발대기", "운행종료". 시간은 traTime(초)을 쓴다
export function seoulArrivalState(message: string, traTime: number, isArrive: string): ArrivalState {
  const eta = Number.isFinite(traTime) && traTime >= 0 ? traTime : null;
  const stopsAway = Number(/\[(\d+)번째 전\]/.exec(message)?.[1] ?? 0);
  if (message.includes("운행종료")) return { kind: "unknown", msgType: "운행종료" };
  if (message.includes("출발대기")) return { kind: "waitingAtDepot", scheduledDeparture: null };
  const approach = (phase: ApproachPhase, etaSeconds: number): ArrivalState => ({ kind: "approaching", phase, etaSeconds, stopsAway });
  if (isArrive === "1") return approach("arrived", eta ?? 0);
  if (message.includes("곧 도착")) return approach("entering", eta ?? 0);
  if (eta !== null && eta > 0) return approach("minutesAway", eta);
  return { kind: "unknown", msgType: message || "empty" };
}

function text(value: unknown): string {
  return value === undefined || value === null ? "" : String(value).trim();
}

function asRecord(value: unknown): Item | undefined {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? (value as Item) : undefined;
}
