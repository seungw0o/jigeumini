import "server-only";

import type { LatLng } from "@/utils/types";
import type { BusRouteType } from "../daejeon/types";
import { ApiError } from "../errors";
import { readKey, requestJson, type RequestOptions } from "../http.server";
import { DAEJEON_CITY_CODE, type TagoRoute, type TagoStop } from "./types";

const BASE_URL = "https://apis.data.go.kr/1613000/BusSttnInfoInqireService";
const MAX_ROWS = "100";

// 실호출에서 본 라벨은 간선버스, 마을버스뿐이다. 나머지는 대전 노선 유형 이름에서 추정
const ROUTE_TYPE_LABELS: Record<string, BusRouteType> = {
  급행: "express",
  간선: "trunk",
  지선: "branch",
  외곽: "outer",
  마을: "village",
  첨단: "advanced",
};

/** 좌표 반경 500m 안의 정류장 */
export async function findNearbyStops(position: LatLng, options?: RequestOptions): Promise<TagoStop[]> {
  const items = await fetchItems(
    "getCrdntPrxmtSttnList",
    { gpsLati: String(position.lat), gpsLong: String(position.lng) },
    options,
  );
  return items.map(toStop);
}

/** 정류장 이름으로 검색 (부분 일치) */
export async function searchStopsByName(
  name: string,
  cityCode: number = DAEJEON_CITY_CODE,
  options?: RequestOptions,
): Promise<TagoStop[]> {
  const items = await fetchItems("getSttnNoList", { cityCode: String(cityCode), nodeNm: name }, options);
  return items.map(toStop);
}

export async function getRoutesThroughStop(
  tagoNodeId: string,
  cityCode: number = DAEJEON_CITY_CODE,
  options?: RequestOptions,
): Promise<TagoRoute[]> {
  const items = await fetchItems("getSttnThrghRouteList", { cityCode: String(cityCode), nodeid: tagoNodeId }, options);
  return items.map(toRoute);
}

type RawItem = Record<string, unknown>;

// 결과가 하나면 item이 배열이 아니라 객체로, 없으면 items가 ""로 온다
async function fetchItems(operation: string, params: Record<string, string>, options?: RequestOptions) {
  const url = new URL(`${BASE_URL}/${operation}`);
  url.searchParams.set("serviceKey", readKey("DATA_GO_KR_KEY", "tago"));
  url.searchParams.set("_type", "json");
  url.searchParams.set("numOfRows", MAX_ROWS);
  url.searchParams.set("pageNo", "1");
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);

  const json = await requestJson("tago", url, options);
  const response = asRecord(asRecord(json)?.response);
  const header = asRecord(response?.header);
  if (!header) throw new ApiError("PARSE", "tago", `${operation}: no response.header`);
  if (String(header.resultCode) !== "00") {
    throw new ApiError("SERVICE_ERROR", "tago", `${operation}: resultCode ${header.resultCode} ${header.resultMsg ?? ""}`.trim());
  }

  const item = asRecord(asRecord(response?.body)?.items)?.item;
  if (item === undefined || item === null) return [];
  const list = Array.isArray(item) ? item : [item];
  return list.map((entry) => {
    const record = asRecord(entry);
    if (!record) throw new ApiError("PARSE", "tago", `${operation}: item is not an object`);
    return record;
  });
}

function toStop(item: RawItem): TagoStop {
  const lat = Number(item.gpslati);
  const lng = Number(item.gpslong);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) throw new ApiError("PARSE", "tago", "stop without coordinates");
  const cityCode = Number(item.citycode);
  return {
    nodeId: text(item.nodeid),
    name: text(item.nodenm),
    arsId: text(item.nodeno) || null,
    position: { lat, lng },
    cityCode: Number.isFinite(cityCode) && item.citycode !== undefined ? cityCode : null,
  };
}

function toRoute(item: RawItem): TagoRoute {
  const label = text(item.routetp);
  return {
    routeId: text(item.routeid),
    routeNo: text(item.routeno),
    routeType: ROUTE_TYPE_LABELS[label.replace(/버스$/, "")] ?? "unknown",
    routeTypeLabel: label,
    startStopName: text(item.startnodenm),
    endStopName: text(item.endnodenm),
  };
}

function text(value: unknown): string {
  return value === undefined || value === null ? "" : String(value).trim();
}

function asRecord(value: unknown): RawItem | undefined {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? (value as RawItem) : undefined;
}
