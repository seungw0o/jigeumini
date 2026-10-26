import type { DaejeonArrival } from "../../../src/apis/daejeon/types";

/** 사라진 버스를 도착으로 볼 마지막 예측 상한 */
const VANISH_ARRIVAL_MAX_ETA_SEC = 120;
/** 마지막으로 본 뒤 이보다 오래 지났으면(루프가 멈췄던 경우) 사라짐을 도착으로 보지 않는다 */
const VANISH_MAX_GAP_MS = 3 * 60 * 1000;
/** 오차 계산에 쓰는 가장 먼 리드(20분 + 허용치 3분)보다 넉넉하게 */
const PREDICTION_KEEP_MS = 25 * 60 * 1000;

export interface Prediction {
  observedAt: number;
  etaSeconds: number;
}

export interface VehicleTrack {
  routeNo: string;
  routeCd: string;
  plateNo: string;
  lastSeenAt: number;
  lastEtaSeconds: number | null;
  predictions: Prediction[];
  /** 도착(01/02)을 이미 기록했으면 그 시각. 목록에 남아 있는 동안 두 번 세지 않으려고 둔다 */
  arrivedAt: number | null;
}

/** 키: ROUTE_CD|CAR_REG_NO (정류소는 Durable Object 하나가 하나씩 맡는다) */
export type Tracks = Record<string, VehicleTrack>;

export interface DetectedArrival {
  routeNo: string;
  routeCd: string;
  plateNo: string;
  arrivedAt: number;
  inferred: boolean;
  predictions: Prediction[];
}

export function trackArrivals(
  previous: Tracks,
  arrivals: DaejeonArrival[],
  now: number,
): { tracks: Tracks; detected: DetectedArrival[] } {
  const tracks: Tracks = {};
  const detected: DetectedArrival[] = [];

  for (const arrival of arrivals) {
    // 차고지 대기(07)와 알 수 없는 MSG_TP는 오차 계산에서 뺀다 (관측 행은 따로 저장된다)
    if (!arrival.plateNo || arrival.state.kind !== "approaching") continue;
    const key = `${arrival.routeCd}|${arrival.plateNo}`;
    if (tracks[key]) continue;
    const prior = previous[key];
    const base = { routeNo: arrival.routeNo, routeCd: arrival.routeCd, plateNo: arrival.plateNo, lastSeenAt: now };
    const { phase, etaSeconds } = arrival.state;

    if (phase === "arrived" || phase === "departed") {
      if (prior?.arrivedAt != null) {
        tracks[key] = { ...prior, lastSeenAt: now };
        continue;
      }
      const { routeNo, routeCd, plateNo } = base;
      detected.push({ routeNo, routeCd, plateNo, arrivedAt: now, inferred: false, predictions: prior?.predictions ?? [] });
      tracks[key] = { ...base, lastEtaSeconds: null, predictions: [], arrivedAt: now };
      continue;
    }

    const keep = prior && prior.arrivedAt === null ? prior.predictions.filter((p) => now - p.observedAt <= PREDICTION_KEEP_MS) : [];
    tracks[key] = { ...base, lastEtaSeconds: etaSeconds, predictions: [...keep, { observedAt: now, etaSeconds }], arrivedAt: null };
  }

  for (const [key, prior] of Object.entries(previous)) {
    if (tracks[key] || prior.arrivedAt !== null || prior.lastEtaSeconds === null) continue;
    if (prior.lastEtaSeconds <= VANISH_ARRIVAL_MAX_ETA_SEC && now - prior.lastSeenAt <= VANISH_MAX_GAP_MS) {
      const { routeNo, routeCd, plateNo, predictions } = prior;
      detected.push({ routeNo, routeCd, plateNo, arrivedAt: now, inferred: true, predictions });
    }
  }

  return { tracks, detected };
}
