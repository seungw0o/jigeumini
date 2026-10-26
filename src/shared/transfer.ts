import type { LeadBucketMin, MarginBucket, MarginsResponse, StopMargin } from "../apis/margins/types";
import { MARGIN_BUCKET_MIN_N, MARGIN_MIN_GATE_N } from "./margin";

const LEAD_BUCKETS: LeadBucketMin[] = [3, 5, 10, 15, 20];
const EARLY_RATE_LEN = 11;

// earlyRate[i]는 슬랙 30i초에서의 놓침 확률. 0초 값이 있어야 0~30초 구간을 추측 없이 보간한다.
// (슬랙 0이면 버스가 조금이라도 일찍 오기만 해도 놓치므로 earlyRate[0]이 가장 크다.)
// 임계값은 30초 배수에서만 측정되므로 선형 보간은 측정점 사이에서만 일어난다.
// 편향: 수집 도착시각은 60초 폴링으로 추정되어 최대 약 1분 늦게 기록될 수 있다.
// 그래서 일찍 온 비율이 조금 과소추정되고, 환승 성공 확률은 살짝 낙관적이다.

function pickLeadBucket(leadMin: number): LeadBucketMin {
  let best = LEAD_BUCKETS[0];
  for (const lead of LEAD_BUCKETS) {
    const d = Math.abs(lead - leadMin);
    const bestD = Math.abs(best - leadMin);
    if (d < bestD || (d === bestD && lead > best)) best = lead;
  }
  return best;
}

function pickEarlyRate(stop: StopMargin, leadSec: number): number[] | undefined {
  const lead = pickLeadBucket(leadSec / 60);
  const bucket: MarginBucket | undefined = stop.byLead.find((b) => b.leadMin === lead);
  if (bucket && bucket.n >= MARGIN_BUCKET_MIN_N) return bucket.earlyRate;
  if (stop.n >= MARGIN_MIN_GATE_N) return stop.earlyRate;
  return undefined;
}

function missRate(earlyRate: number[], slackSec: number): number {
  if (slackSec >= 300) return earlyRate[10];
  const i = Math.floor(slackSec / 30);
  const t = (slackSec - 30 * i) / 30;
  return earlyRate[i] + (earlyRate[i + 1] - earlyRate[i]) * t;
}

export function catchChance(input: {
  nodeId: string;
  slackSec: number;
  leadSec: number;
  margins: MarginsResponse | undefined;
}): number | undefined {
  const { nodeId, slackSec, leadSec, margins } = input;
  if (!Number.isFinite(slackSec) || slackSec < 0) return undefined;
  if (!margins) return undefined;
  const stop = margins.stops.find((s) => s.nodeId === nodeId);
  if (!stop) return undefined;

  const earlyRate = pickEarlyRate(stop, leadSec);
  if (!earlyRate || earlyRate.length !== EARLY_RATE_LEN) return undefined;

  const chance = 1 - missRate(earlyRate, slackSec);
  return Math.min(1, Math.max(0, chance));
}
