// 출발 알림 스케줄 결정. 순수 함수라 시각은 인자로 받는다.

const MIN_MS = 60_000;

/** 출발 시각 몇 분 전에 울릴지 (오너 결정: 2분 고정) */
export const NOTIFY_BEFORE_MIN = 2;
/** 울릴 시각까지 이만큼 남으면 1분마다 다시 계산한다 */
const NEAR_WINDOW_MS = 15 * MIN_MS;
export const NEAR_POLL_MS = MIN_MS;
/** 멀리 있을 때는 이 간격보다 드물게 보지 않는다 */
export const FAR_POLL_MAX_MS = 5 * MIN_MS;
/** 알림 하나가 살아 있는 최대 시간. 넘으면 실패로 끝낸다 */
export const MAX_LIFETIME_MS = 3 * 60 * MIN_MS;
/** 탈 버스를 연속 이만큼 못 찾으면(노선이 사라짐, 도착 정보 실패) 실패로 끝낸다 */
export const MAX_MISSES = 5;

type AlertDecision =
  | { kind: "send" }
  | { kind: "wait"; atMs: number }
  | { kind: "fail"; reason: "expired" | "no_bus" | "api_error" };

interface DecisionInput {
  nowMs: number;
  createdAtMs: number;
  /** 이번에 다시 계산한 출발 시각. 탈 버스가 없으면 null */
  leaveByMs: number | null;
  /** 이번 계산까지 포함한 연속 실패 수 */
  misses: number;
  /** 그중 도착 정보를 받지 못해서(API 실패) 생긴 수. 전부 API 실패면 no_bus 대신 api_error */
  apiMisses?: number;
}

export const notifyAtOf = (leaveByMs: number) => leaveByMs - NOTIFY_BEFORE_MIN * MIN_MS;

export function decideAlert({ nowMs, createdAtMs, leaveByMs, misses, apiMisses = 0 }: DecisionInput): AlertDecision {
  if (nowMs - createdAtMs > MAX_LIFETIME_MS) return { kind: "fail", reason: "expired" };
  if (leaveByMs === null) {
    if (misses < MAX_MISSES) return { kind: "wait", atMs: nowMs + NEAR_POLL_MS };
    return { kind: "fail", reason: apiMisses >= misses ? "api_error" : "no_bus" };
  }
  const notifyAt = notifyAtOf(leaveByMs);
  if (nowMs >= notifyAt) return { kind: "send" };
  const remaining = notifyAt - nowMs;
  if (remaining <= NEAR_WINDOW_MS) return { kind: "wait", atMs: Math.min(nowMs + NEAR_POLL_MS, notifyAt) };
  return { kind: "wait", atMs: nowMs + Math.max(NEAR_POLL_MS, Math.min(remaining - NEAR_WINDOW_MS, FAR_POLL_MAX_MS)) };
}
