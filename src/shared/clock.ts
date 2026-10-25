// "HH:MM" <-> 하루 중 분. 앱과 Cloudflare Worker가 같이 쓴다.

const DAY = 24 * 60;

export function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

export function toClock(totalMinutes: number): string {
  const m = ((totalMinutes % DAY) + DAY) % DAY;
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}
