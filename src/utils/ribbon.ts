import type { Ribbon, RibbonMark, RibbonSegment, TransitRoute } from "./types";

const DAY = 24 * 60;

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

function toClock(totalMinutes: number): string {
  const m = ((totalMinutes % DAY) + DAY) % DAY;
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

/** "09:58" -> "9:58" (24시간제, 앞자리 0 없음) */
export function formatShortClock(hhmm: string): string {
  const [h, m] = hhmm.split(":");
  return `${Number(h)}:${m}`;
}

export function buildRibbon(route: TransitRoute, now: string): Ribbon {
  const base = toMinutes(now);
  // 지금 기준 부호 있는 분 차이. 자정을 넘는 경로도 가까운 쪽으로 해석한다.
  const offsetOf = (hhmm: string): number => {
    let d = toMinutes(hhmm) - base;
    if (d < -DAY / 2) d += DAY;
    if (d > DAY / 2) d -= DAY;
    return d;
  };
  const clockAt = (offset: number) => toClock(base + offset);

  const segments: RibbonSegment[] = [];
  const marks: RibbonMark[] = [{ kind: "now", time: now, offset: 0 }];
  const push = (from: number, to: number, seg: Omit<RibbonSegment, "start" | "end" | "minutes">) => {
    if (to <= from) return;
    segments.push({ ...seg, start: clockAt(from), end: clockAt(to), minutes: to - from });
  };

  const leave = Math.max(0, offsetOf(route.leaveAt));
  push(0, leave, { kind: "home" });
  marks.push({ kind: "leave", time: route.leaveAt, offset: leave });

  let t = leave;
  let seenBus = false;
  for (const leg of route.legs) {
    if (leg.kind === "walk") {
      push(t, t + leg.minutes, { kind: "walk" });
      t += leg.minutes;
      continue;
    }
    const board = offsetOf(leg.boardAt);
    push(t, board, { kind: seenBus ? "transfer" : "stop", stopName: leg.boardStop.name });
    const from = Math.max(t, board);
    const to = Math.max(from, offsetOf(leg.alightAt));
    push(from, to, { kind: "bus", routeNo: leg.routeNo, busType: leg.busType });
    marks.push({ kind: "board", time: clockAt(from), offset: from, routeNo: leg.routeNo });
    seenBus = true;
    t = to;
  }

  // 마지막 도보는 도착 시각에 딱 끝나야 한다. 모자라면 틈을 마지막 구간에 붙인다.
  const arrive = offsetOf(route.arriveAt);
  const last = segments[segments.length - 1];
  if (last && t < arrive) {
    last.minutes += arrive - t;
    last.end = clockAt(arrive);
    t = arrive;
  }

  const totalMinutes = segments.reduce((sum, s) => sum + s.minutes, 0);
  marks.push({ kind: "arrive", time: route.arriveAt, offset: totalMinutes });

  return { now, segments, marks, totalMinutes };
}
