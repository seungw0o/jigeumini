import { isApiError } from "../../../src/apis/errors";
import type { DaejeonArrival } from "../../../src/apis/daejeon/types";
import { msgTypeOf } from "./daejeon";
import { isCollecting, kstIso, kstParts } from "./kst";
import { computeErrors } from "./prediction-errors";
import { trackArrivals, type DetectedArrival, type Tracks } from "./tracker";

export const POLL_INTERVAL_MS = 60 * 1000;

/** 이 에러면 다음 날 Cron까지 루프를 멈춘다 (계속 불러도 한도만 깎인다) */
const STOPPING_CODES = new Set(["QUOTA_EXCEEDED", "SERVICE_KEY_INVALID", "MISSING_KEY"]);

export interface ObservationRow {
  nodeId: string;
  routeNo: string;
  routeCd: string;
  plateNo: string | null;
  observedAt: string;
  infoAt: string | null;
  msgTp: string;
  etaSeconds: number | null;
  stopsAway: number | null;
}

export interface ArrivalRow {
  nodeId: string;
  routeNo: string;
  plateNo: string;
  arrivedAt: string;
  inferred: boolean;
  errors: { leadBucketMin: number; predictedAt: string; errorSec: number; hourKst: number; weekday: number }[];
}

export interface CollectorErrorRow {
  nodeId: string;
  at: string;
  code: string;
  message: string;
}

export interface Sink {
  save(rows: { observations: ObservationRow[]; arrivals: ArrivalRow[] }): Promise<void>;
  logError(row: CollectorErrorRow): Promise<void>;
}

export interface TickInput {
  nodeId: string;
  now: number;
  /** 지금까지 돈 틱 수. observationEvery번에 한 번만 관측 행을 쓴다 */
  tick: number;
  observationEvery: number;
  tracks: Tracks;
  fetchArrivals: (nodeId: string) => Promise<DaejeonArrival[]>;
  sink: Sink;
}

export interface TickResult {
  tracks: Tracks;
  /** null이면 루프를 멈춘다 */
  nextAlarmAt: number | null;
  stopReason: string | null;
}

export async function runTick(input: TickInput): Promise<TickResult> {
  const { nodeId, now, sink } = input;
  if (!isCollecting(now)) return { tracks: {}, nextAlarmAt: null, stopReason: "OUTSIDE_WINDOW" };

  let arrivals: DaejeonArrival[];
  try {
    arrivals = await input.fetchArrivals(nodeId);
  } catch (error) {
    const code = isApiError(error) ? error.code : "UNEXPECTED";
    const message = error instanceof Error ? error.message : String(error);
    await sink.logError({ nodeId, at: kstIso(now), code, message });
    if (STOPPING_CODES.has(code)) return { tracks: input.tracks, nextAlarmAt: null, stopReason: code };
    return { tracks: input.tracks, nextAlarmAt: now + POLL_INTERVAL_MS, stopReason: null };
  }

  const { tracks, detected } = trackArrivals(input.tracks, arrivals, now);
  const observedAt = kstIso(now);
  const observations =
    input.tick % input.observationEvery === 0 ? arrivals.map((arrival) => toObservationRow(nodeId, observedAt, arrival)) : [];
  await sink.save({ observations, arrivals: detected.map((arrival) => toArrivalRow(nodeId, arrival)) });
  return { tracks, nextAlarmAt: now + POLL_INTERVAL_MS, stopReason: null };
}

function toObservationRow(nodeId: string, observedAt: string, arrival: DaejeonArrival): ObservationRow {
  const approaching = arrival.state.kind === "approaching" ? arrival.state : null;
  return {
    nodeId,
    routeNo: arrival.routeNo,
    routeCd: arrival.routeCd,
    plateNo: arrival.plateNo,
    observedAt,
    infoAt: arrival.infoAt,
    msgTp: msgTypeOf(arrival.state),
    etaSeconds: approaching?.etaSeconds ?? null,
    stopsAway: approaching?.stopsAway ?? null,
  };
}

function toArrivalRow(nodeId: string, arrival: DetectedArrival): ArrivalRow {
  return {
    nodeId,
    routeNo: arrival.routeNo,
    plateNo: arrival.plateNo,
    arrivedAt: kstIso(arrival.arrivedAt),
    inferred: arrival.inferred,
    errors: computeErrors(arrival.arrivedAt, arrival.predictions).map((error) => {
      const { hour, weekday } = kstParts(error.predictedAt);
      return {
        leadBucketMin: error.leadBucketMin,
        predictedAt: kstIso(error.predictedAt),
        errorSec: error.errorSec,
        hourKst: hour,
        weekday,
      };
    }),
  };
}
