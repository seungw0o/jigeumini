const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

/** 수집 시간대 05:30 이상 23:30 미만 (KST, 하루 중 분) */
export const COLLECTION_START_MIN = 5 * 60 + 30;
export const COLLECTION_END_MIN = 23 * 60 + 30;

export interface KstParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
  /** 0 = 일요일 */
  weekday: number;
}

export function kstParts(epochMs: number): KstParts {
  const shifted = new Date(epochMs + KST_OFFSET_MS);
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
    hour: shifted.getUTCHours(),
    minute: shifted.getUTCMinutes(),
    second: shifted.getUTCSeconds(),
    weekday: shifted.getUTCDay(),
  };
}

const pad = (value: number) => String(value).padStart(2, "0");

/** "2026-10-23T05:30:00+09:00" */
export function kstIso(epochMs: number): string {
  const p = kstParts(epochMs);
  return `${p.year}-${pad(p.month)}-${pad(p.day)}T${pad(p.hour)}:${pad(p.minute)}:${pad(p.second)}+09:00`;
}

export function isCollecting(epochMs: number): boolean {
  const { hour, minute } = kstParts(epochMs);
  const minuteOfDay = hour * 60 + minute;
  return minuteOfDay >= COLLECTION_START_MIN && minuteOfDay < COLLECTION_END_MIN;
}

/** 지금 수집 시간대면 지금, 아니면 다음 05:30 KST */
export function nextCollectionStart(epochMs: number): number {
  if (isCollecting(epochMs)) return epochMs;
  const { year, month, day } = kstParts(epochMs);
  const todayStart = Date.UTC(year, month - 1, day) - KST_OFFSET_MS + COLLECTION_START_MIN * 60 * 1000;
  return epochMs < todayStart ? todayStart : todayStart + DAY_MS;
}
