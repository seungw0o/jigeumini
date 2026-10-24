import { isApiError } from "../../../src/apis/errors";
import type { DaejeonArrival } from "../../../src/apis/daejeon/types";
import { isCollecting, kstIso, kstParts } from "./kst";
import { computeErrors } from "./prediction-errors";
import { trackArrivals, type DetectedArrival, type Tracks } from "./tracker";

export const POLL_INTERVAL_MS = 60 * 1000;

/** 이 에러면 다음 날 Cron까지 루프를 멈춘다 (계속 불러도 한도만 깎인다) */
const STOPPING_CODES = new Set(["QUOTA_EXCEEDED", "SERVICE_KEY_INVALID", "MISSING_KEY"]);

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
  save(rows: { arrivals: ArrivalRow[] }): Promise<void>;
  logError(row: CollectorErrorRow): Promise<void>;
}

export interface TickInput {
  nodeId: string;
  now: number;
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
  await sink.save({ arrivals: detected.map((arrival) => toArrivalRow(nodeId, arrival)) });
  return { tracks, nextAlarmAt: now + POLL_INTERVAL_MS, stopReason: null };
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
