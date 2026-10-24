import { toClock, toMinutes } from "./ribbon";
import type { TransitRoute } from "./types";

// 화면 표시용 임시 계산. 실제 출발 시각 계산은 owner 코드로 바뀐다.

/** 버스가 예상보다 일찍 올 수 있어 출발 시각에서 미리 빼 두는 여유(분). 나중에 데이터 기반 값으로 바꾼다 */
export const DEPARTURE_MARGIN_MIN = 2;

/** 첫 버스 탑승 시각 − 정류장까지 도보 − 여유. 이 시각 전에 나서면 된다. leaveInMinutes가 1 미만이면 빠듯함 */
export function leaveByOf(
  route: Pick<TransitRoute, "legs">,
  now: string,
): Pick<TransitRoute, "leaveAt" | "leaveInMinutes" | "marginMinutes"> {
  const firstBus = route.legs.findIndex((leg) => leg.kind === "bus");
  const leg = route.legs[firstBus];
  if (!leg || leg.kind !== "bus") return { leaveAt: now, leaveInMinutes: 0, marginMinutes: 0 };
  const walk = route.legs.slice(0, firstBus).reduce((sum, l) => sum + (l.kind === "walk" ? l.minutes : 0), 0);
  const leave = toMinutes(leg.boardAt) - walk - DEPARTURE_MARGIN_MIN;
  let inMinutes = leave - toMinutes(now);
  if (inMinutes < -720) inMinutes += 1440;
  if (inMinutes > 720) inMinutes -= 1440;
  return { leaveAt: toClock(leave), leaveInMinutes: inMinutes, marginMinutes: DEPARTURE_MARGIN_MIN };
}
