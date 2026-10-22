import type { LatLng } from "@/utils/types";
import type { BusRouteType } from "../daejeon/types";

export const DAEJEON_CITY_CODE = 25;

export interface TagoStop {
  /** TAGO nodeid, 예: "DJB8001318". 대전 BUS_NODE_ID는 toDaejeonNodeId로 */
  nodeId: string;
  name: string;
  /** nodeno (ARS 5자리). 응답에 없는 정류장도 있다 */
  arsId: string | null;
  position: LatLng;
  cityCode: number | null;
}

export interface TagoRoute {
  /** TAGO routeid, 예: "DJB30300062". 대전 ROUTE_CD는 toDaejeonRouteCd로 */
  routeId: string;
  routeNo: string;
  routeType: BusRouteType;
  /** routetp 원문, 예: "간선버스" */
  routeTypeLabel: string;
  startStopName: string;
  endStopName: string;
}
