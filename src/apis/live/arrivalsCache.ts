// 정류장별 도착 정보 짧은 캐시(프로세스 메모리). 같은 정류장을 여러 화면이 봐도 ttl 동안 바깥 API는 한 번만 부른다.
// 진행 중인 요청도 같이 기다리게 하고, 실패는 남기지 않는다. 캐시에서 꺼낼 때는 받은 뒤 지난 초만큼 ETA를 줄여
// 응답의 fetchedAt(지금) 기준 계산이 맞게 한다.

import type { DaejeonArrival } from "../daejeon/types";

export interface ArrivalsCacheOptions {
  ttlMs: number;
  load: (stopId: string) => Promise<DaejeonArrival[]>;
  now?: () => number;
  maxEntries?: number;
}

interface Entry {
  startedAt: number;
  result: Promise<{ fetchedAt: number; arrivals: DaejeonArrival[] }>;
}

export function ageArrivals(arrivals: DaejeonArrival[], ageMs: number): DaejeonArrival[] {
  const ageS = Math.floor(ageMs / 1000);
  if (ageS <= 0) return arrivals;
  return arrivals.map((arrival) =>
    arrival.state.kind === "approaching"
      ? { ...arrival, state: { ...arrival.state, etaSeconds: Math.max(0, arrival.state.etaSeconds - ageS) } }
      : arrival,
  );
}

export function createArrivalsCache({ ttlMs, load, now = Date.now, maxEntries = 500 }: ArrivalsCacheOptions) {
  const entries = new Map<string, Entry>();

  function start(stopId: string): Entry {
    if (entries.size >= maxEntries) entries.clear();
    const result = load(stopId).then((arrivals) => ({ fetchedAt: now(), arrivals }));
    const entry: Entry = { startedAt: now(), result };
    entries.set(stopId, entry);
    result.catch(() => {
      if (entries.get(stopId) === entry) entries.delete(stopId);
    });
    return entry;
  }

  return {
    async get(stopId: string): Promise<DaejeonArrival[]> {
      const cached = entries.get(stopId);
      const entry = cached && now() - cached.startedAt < ttlMs ? cached : start(stopId);
      const { fetchedAt, arrivals } = await entry.result;
      return ageArrivals(arrivals, now() - fetchedAt);
    },
  };
}
