import { parseArrivals } from "../../../src/apis/daejeon/parse";

/** 2026-10-23 09:00:00 KST */
export const T0 = Date.UTC(2026, 9, 23, 0, 0, 0);
export const MIN = 60 * 1000;

interface ItemSpec {
  route: string;
  plate: string;
  msg: string;
  sec?: number;
  pos?: number;
}

function itemXml({ route, plate, msg, sec = 0, pos = 1 }: ItemSpec): string {
  return (
    `<itemList><ROUTE_NO>${route}</ROUTE_NO><ROUTE_CD>RC${route}</ROUTE_CD><CAR_REG_NO>${plate}</CAR_REG_NO>` +
    `<MSG_TP>${msg}</MSG_TP><EXTIME_SEC>${sec}</EXTIME_SEC><STATUS_POS>${pos}</STATUS_POS><BUS_NODE_ID>8001318</BUS_NODE_ID></itemList>`
  );
}

export function serviceResult(...items: ItemSpec[]): string {
  return `<?xml version="1.0"?><ServiceResult><msgHeader><headerCd>0</headerCd></msgHeader><msgBody>${items.map(itemXml).join("")}</msgBody></ServiceResult>`;
}

export const arrivalsOf = (...items: ItemSpec[]) => parseArrivals(serviceResult(...items));
