import type { LeadBucketMin, MarginBucket, MarginsResponse } from "../apis/margins/types";
import { DEPARTURE_MARGIN_MIN } from "./departure";

const MARGIN_MIN_GATE_N = 100;
const MARGIN_BUCKET_MIN_N = 30;
const MARGIN_CLAMP_MIN = 1;
const MARGIN_CLAMP_MAX = 5;

const LEAD_BUCKETS: LeadBucketMin[] = [3, 5, 10];

function pickLead(walkMin: number): LeadBucketMin {
  let best = LEAD_BUCKETS[0];
  for (const lead of LEAD_BUCKETS) {
    const d = Math.abs(lead - walkMin);
    const bestD = Math.abs(best - walkMin);
    if (d < bestD || (d === bestD && lead > best)) best = lead;
  }
  return best;
}

export function pickMarginMinutes(
  boardNodeId: string | null,
  walkBeforeSec: number,
  margins: MarginsResponse | undefined,
): number {
  if (!margins || boardNodeId === null) return DEPARTURE_MARGIN_MIN;
  const stop = margins.stops.find((s) => s.nodeId === boardNodeId);
  if (!stop || stop.n < MARGIN_MIN_GATE_N) return DEPARTURE_MARGIN_MIN;

  const lead = pickLead(walkBeforeSec / 60);
  const bucket: MarginBucket | undefined = stop.byLead.find((b) => b.leadMin === lead);
  const p10Sec = bucket && bucket.n >= MARGIN_BUCKET_MIN_N ? bucket.p10Sec : stop.p10Sec;

  const raw = Math.ceil(Math.max(0, -p10Sec) / 60);
  return Math.min(MARGIN_CLAMP_MAX, Math.max(MARGIN_CLAMP_MIN, raw));
}
