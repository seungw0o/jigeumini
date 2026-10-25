// 출발 알림이 쓰는 출발 시각 계산. 화면과 같은 공유 함수(src/shared/estimate)를 그대로 부른다.
import type { DaejeonArrival } from "../../../src/apis/daejeon/types";
import type { PlannedRoute } from "../../../src/apis/live/types";
import type { MarginsResponse } from "../../../src/apis/margins/types";
import { toMinutes } from "../../../src/shared/clock";
import { estimateRoute } from "../../../src/shared/estimate";

const MIN_MS = 60_000;
const DAY_MIN = 24 * 60;
const KST_OFFSET_MIN = 9 * 60;

export interface Departure {
  /** 화면에 보이는 출발 시각("HH:MM")이 시작하는 순간(epoch ms) */
  leaveByMs: number;
  leaveAt: string;
  routeNo: string;
  boardStopName: string;
  /** 탈 버스가 승차 정류장에 오기까지 남은 분. 차고지 대기면 null */
  busInMinutes: number | null;
  boardAt: string;
}

export function firstBoardNodeId(plan: PlannedRoute): string | null {
  const leg = plan.legs.find((l) => l.kind === "bus");
  return leg?.kind === "bus" ? leg.board.nodeId : null;
}

// "HH:MM"(KST)을 nowMs에 가장 가까운 날의 그 분 시작 시각으로
function clockToMs(hhmm: string, nowMs: number): number {
  const nowMin = Math.floor(nowMs / MIN_MS);
  let offset = toMinutes(hhmm) - ((((nowMin + KST_OFFSET_MIN) % DAY_MIN) + DAY_MIN) % DAY_MIN);
  if (offset < -DAY_MIN / 2) offset += DAY_MIN;
  if (offset > DAY_MIN / 2) offset -= DAY_MIN;
  return (nowMin + offset) * MIN_MS;
}

/** 첫 버스 승차 정류장 도착 정보로 화면과 같은 출발 시각을 낸다. 탈 수 있는 버스가 없으면 null */
export function departureOf(
  plan: PlannedRoute,
  boardArrivals: DaejeonArrival[],
  clock: { fetchedAtMs: number; nowMs: number },
  margins: MarginsResponse | undefined,
): Departure | null {
  const nodeId = firstBoardNodeId(plan);
  if (nodeId === null) return null;
  const route = estimateRoute(plan, { [nodeId]: { ok: true, arrivals: boardArrivals } }, clock, margins);
  if (route.realtime !== "live" && route.realtime !== "partial") return null;
  const leg = route.legs.find((l) => l.kind === "bus");
  if (leg?.kind !== "bus") return null;
  const status = leg.arrivals[leg.catchIndex]?.status;
  return {
    leaveByMs: clockToMs(route.leaveAt, clock.nowMs),
    leaveAt: route.leaveAt,
    routeNo: leg.routeNo,
    boardStopName: leg.boardStop.name,
    busInMinutes: status?.kind === "live" ? status.minutes : null,
    boardAt: leg.boardAt,
  };
}
