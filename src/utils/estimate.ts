// 카카오 경로(PlannedRoute) + 대전 실시간 도착 정보 -> 화면용 TransitRoute. 순수 함수(시각은 clock으로 받는다).
// 모든 계산은 절대 시각(ms) 위에서 하고, 마지막에 "HH:MM"(KST)으로 바꾼다.
// 1. W = 첫 버스 전까지 도보(초), MARGIN = pickMarginMinutes(분; 정류장 데이터, 없으면 DEPARTURE_MARGIN_MIN).
// 2. 버스 구간 후보 = 승차 정류장 도착 목록 중 routeNos에 든 노선. 운행 중이면 fetchedAt + ETA,
//    차고지 대기면 예정 출발 시각(차고지 기준이라 근사치), 시각을 모르면 버린다. 빠른 순 정렬.
// 3. arrivals가 없으면 loading. 첫 버스 정류장 정보를 못 받았으면 unavailable,
//    지금 + W + MARGIN 이후에 오는 후보가 없으면 noBus.
// 4. 탈 수 있으면: 출발 = 탑승 − W − MARGIN. 이후 도보는 시간만큼 진행하고,
//    환승 버스는 정류장에 닿은 시각 이후 첫 후보를 탄다(여유 없음). 못 찾으면 대기 0으로 두고 partial.
// 5. live/partial이 아니면 지금부터 대기 없이 이어 붙인다(leaveAt = 지금, 여유 0).

import type { DaejeonArrival } from "@/apis/daejeon/types";
import type { PlannedBusLeg, PlannedRoute, StopArrivals } from "@/apis/live/types";
import type { MarginsResponse } from "@/apis/margins/types";
import { DEPARTURE_MARGIN_MIN } from "./departure";
import { pickMarginMinutes } from "./margin";
import { toClock, toMinutes } from "./ribbon";
import type { BusArrival, BusType, Leg, LegLiveIssue, RealtimeState, TransitRoute } from "./types";

export interface LiveClock {
  /** 도착 정보를 받은 시각(epoch ms). ETA는 이 시각부터 센다 */
  fetchedAtMs: number;
  nowMs: number;
}

const MIN_MS = 60_000;
const DAY_MS = 24 * 60 * MIN_MS;
const KST_OFFSET_MS = 9 * 60 * MIN_MS;
const BUS_TYPES: readonly string[] = ["express", "trunk", "branch", "village", "outer"];

interface Candidate {
  arrival: DaejeonArrival;
  atMs: number;
}

/** null: 정류장 매칭 실패이거나 도착 정보를 못 받음 */
type Candidates = Candidate[] | null;

/** epoch ms -> "HH:MM" (Asia/Seoul) */
export function kstClock(ms: number): string {
  return toClock(Math.floor((ms + KST_OFFSET_MS) / MIN_MS));
}

const stripSpaces = (s: string) => s.replace(/\s/g, "");

// 차고지 출발 예정 "HH:MM"을 fetchedAt에 가장 가까운 날의 시각으로
function depotMs(hhmm: string, fetchedAtMs: number): number {
  const dayStart = Math.floor((fetchedAtMs + KST_OFFSET_MS) / DAY_MS) * DAY_MS - KST_OFFSET_MS;
  const ms = dayStart + toMinutes(hhmm) * MIN_MS;
  if (ms < fetchedAtMs - DAY_MS / 2) return ms + DAY_MS;
  if (ms > fetchedAtMs + DAY_MS / 2) return ms - DAY_MS;
  return ms;
}

function arrivalMs(arrival: DaejeonArrival, fetchedAtMs: number): number | null {
  const { state } = arrival;
  if (state.kind === "approaching") return fetchedAtMs + state.etaSeconds * 1000;
  if (state.kind === "waitingAtDepot" && state.scheduledDeparture) return depotMs(state.scheduledDeparture, fetchedAtMs);
  return null;
}

function candidatesOf(leg: PlannedBusLeg, arrivals: Record<string, StopArrivals>, fetchedAtMs: number): Candidates {
  const entry = leg.board.nodeId === null ? undefined : arrivals[leg.board.nodeId];
  if (!entry?.ok) return null;
  const routeNos = new Set(leg.routeNos.map(stripSpaces));
  return entry.arrivals
    .filter((a) => routeNos.has(stripSpaces(a.routeNo)))
    .flatMap((arrival) => {
      const atMs = arrivalMs(arrival, fetchedAtMs);
      return atMs === null ? [] : [{ arrival, atMs }];
    })
    .sort((a, b) => a.atMs - b.atMs);
}

function busTypeOf(arrival: DaejeonArrival | undefined, fallback: BusType): BusType {
  return arrival && BUS_TYPES.includes(arrival.routeType) ? (arrival.routeType as BusType) : fallback;
}

function toBusArrival(c: Candidate, leg: PlannedBusLeg, nowMs: number): BusArrival {
  const { arrival } = c;
  const status: BusArrival["status"] =
    arrival.state.kind === "waitingAtDepot"
      ? { kind: "garage", departAt: arrival.state.scheduledDeparture ?? "" }
      : {
          kind: "live",
          minutes: Math.max(0, Math.floor((c.atMs - nowMs) / MIN_MS)),
          stopsAway: arrival.state.kind === "approaching" ? arrival.state.stopsAway : 0,
        };
  const runLabel = arrival.runType === "first" || arrival.runType === "last" ? arrival.runType : undefined;
  return { routeNo: arrival.routeNo, busType: busTypeOf(arrival, leg.busType), status, ...(runLabel && { runLabel }) };
}

export function estimateRoute(
  plan: PlannedRoute,
  arrivals: Record<string, StopArrivals> | undefined,
  clock: LiveClock,
  margins?: MarginsResponse,
): TransitRoute {
  const { fetchedAtMs, nowMs } = clock;
  const firstBus = plan.legs.findIndex((l) => l.kind === "bus");
  const walkBeforeS = plan.legs
    .slice(0, firstBus < 0 ? plan.legs.length : firstBus)
    .reduce((sum, l) => sum + l.seconds, 0);
  const firstBusLeg = firstBus >= 0 ? plan.legs[firstBus] : undefined;
  const marginMin =
    firstBusLeg?.kind === "bus"
      ? pickMarginMinutes(firstBusLeg.board.nodeId, walkBeforeS, margins)
      : DEPARTURE_MARGIN_MIN;
  const candidates = plan.legs.map((l) => (l.kind === "bus" && arrivals ? candidatesOf(l, arrivals, fetchedAtMs) : null));

  // 첫 버스: 걸어가서 여유까지 두고 닿을 수 있는 첫 차
  let realtime: RealtimeState = "live";
  let firstChoice: Candidate | undefined;
  if (!arrivals) realtime = "loading";
  else if (firstBus >= 0) {
    const list = candidates[firstBus];
    const earliestMs = nowMs + (walkBeforeS + marginMin * 60) * 1000;
    firstChoice = list?.find((c) => c.atMs >= earliestMs);
    if (!list) realtime = "unavailable";
    else if (!firstChoice) realtime = "noBus";
  }
  const live = realtime === "live";
  const leaveByMs = firstChoice ? firstChoice.atMs - walkBeforeS * 1000 - marginMin * MIN_MS : nowMs;

  let t = leaveByMs;
  let partial = false;
  const legs = plan.legs.map((leg, i): Leg => {
    if (leg.kind === "walk") {
      t += leg.seconds * 1000;
      const minutes = leg.seconds > 0 ? Math.max(1, Math.round(leg.seconds / 60)) : 0;
      return { kind: "walk", minutes, distanceM: leg.distanceM, from: leg.from, to: leg.to };
    }
    const atStopMs = t;
    const list = candidates[i] ?? [];
    let chosen: Candidate | undefined;
    let liveIssue: LegLiveIssue | undefined;
    if (i === firstBus) {
      chosen = firstChoice;
      if (realtime === "unavailable" || realtime === "noBus") liveIssue = realtime;
    } else if (live) {
      chosen = list.find((c) => c.atMs >= atStopMs);
      if (!chosen) liveIssue = candidates[i] ? "noBus" : "unavailable";
      if (liveIssue) partial = true;
    }
    const boardMs = chosen?.atMs ?? atStopMs;
    t = boardMs + leg.seconds * 1000;

    // 최대 3대, 탈 버스는 반드시 포함
    const chosenIndex = chosen ? list.indexOf(chosen) : 0;
    const start = Math.max(0, chosenIndex - 2);
    const shown = list.slice(start, start + 3);
    const stopOf = (s: PlannedBusLeg["board"], end: "board" | "alight") => ({
      id: s.nodeId ?? `${plan.id}-${i}-${end}`,
      name: s.name,
      arsId: s.arsId ?? "",
      position: s.position,
    });
    return {
      kind: "bus",
      routeNo: chosen?.arrival.routeNo ?? leg.routeNos[0],
      busType: busTypeOf((chosen ?? list[0])?.arrival, leg.busType),
      boardStop: stopOf(leg.board, "board"),
      alightStop: stopOf(leg.alight, "alight"),
      stopCount: leg.stopCount,
      rideMinutes: Math.max(1, Math.round(leg.seconds / 60)),
      arrivals: shown.map((c) => toBusArrival(c, leg, nowMs)),
      catchIndex: chosenIndex - start,
      // 첫 버스의 여유(MARGIN)는 대기에 넣지 않는다
      waitMinutes: i === firstBus ? 0 : Math.round((boardMs - atStopMs) / MIN_MS),
      boardAt: kstClock(boardMs),
      alightAt: kstClock(t),
      ...(liveIssue && { liveIssue }),
    };
  });

  return {
    id: plan.id,
    leaveAt: kstClock(leaveByMs),
    leaveInMinutes: Math.floor((leaveByMs - nowMs) / MIN_MS),
    arriveAt: kstClock(Math.ceil(t / MIN_MS) * MIN_MS),
    // 분 단위 시계 차이로 계산해야 화면에 보이는 도착 시각과 맞고, 목록·상세에서 초 차이로 1분씩 어긋나지 않는다
    totalMinutes: Math.ceil(t / MIN_MS) - Math.floor(nowMs / MIN_MS),
    travelMinutes: Math.round(plan.legs.reduce((sum, l) => sum + l.seconds, 0) / 60),
    waitMinutes: legs.reduce((sum, l) => sum + (l.kind === "bus" ? l.waitMinutes : 0), 0),
    marginMinutes: firstChoice ? marginMin : 0,
    fare: plan.fare,
    transferCount: plan.transferCount,
    legs,
    path: plan.legs.map((l) => l.path),
    realtime: live && partial ? "partial" : realtime,
  };
}

/** 실시간(live/partial) 경로를 도착 빠른 순으로 먼저, 나머지는 이동 시간 순으로 */
export function estimateRoutes(
  plans: PlannedRoute[],
  arrivals: Record<string, StopArrivals> | undefined,
  clock: LiveClock,
  margins?: MarginsResponse,
): TransitRoute[] {
  const rank = (r: TransitRoute) => (r.realtime === "live" || r.realtime === "partial" ? 0 : 1);
  return plans
    .map((plan) => estimateRoute(plan, arrivals, clock, margins))
    .sort(
      (a, b) =>
        rank(a) - rank(b) ||
        a.totalMinutes - b.totalMinutes ||
        (rank(a) === 0 ? b.leaveInMinutes - a.leaveInMinutes : 0),
    );
}
