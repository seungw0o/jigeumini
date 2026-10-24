// 워커 GET /margins 응답. 정류장별 버스 도착 예측 오차(초, 실제 − 예측; 음수 = 일찍 옴)의 P10.
// workers/collector/src/margins.ts가 같은 모양을 만든다.

export type LeadBucketMin = 3 | 5 | 10;

export interface MarginBucket {
  leadMin: LeadBucketMin;
  n: number;
  /** nearest-rank 10번째 백분위(초) */
  p10Sec: number;
}

export interface StopMargin {
  nodeId: string;
  /** 최근 windowDays일 동안 이 정류장에서 기록된 오차 수(모든 버킷) */
  n: number;
  /** 모든 버킷을 합친 P10(초) */
  p10Sec: number;
  /** 값이 있는 버킷만, leadMin 오름차순 */
  byLead: MarginBucket[];
}

export interface MarginsResponse {
  windowDays: number;
  generatedAt: string;
  stops: StopMargin[];
}
