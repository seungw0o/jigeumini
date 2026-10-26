import type { RouteEnd } from "@/apis/live/types";
import { formatCoord, parseCoord, type RoutePair } from "./routeQuery";

export const RECENT_ROUTES_KEY = "jigeumini:recent-routes:v1";
export const RECENT_ROUTES_LIMIT = 8;

export interface RecentRoute extends RoutePair {
  id: string;
}

/**
 * 최근 경로 저장소. 지금은 기기별 localStorage지만, 나중에 계정(D1)으로 옮길 때 이 모양만 맞추면 된다.
 * load는 현재 목록, save는 한 쌍을 맨 위에 기록(같은 쌍은 위로 올림), remove/clear는 삭제
 */
export interface RecentRoutesStore {
  load(): RecentRoute[];
  save(pair: RoutePair): void;
  remove(id: string): void;
  clear(): void;
  subscribe(listener: () => void): () => void;
}

// 서버 스냅샷은 항상 같은 참조여야 한다
const SERVER_SNAPSHOT: RecentRoute[] = [];

export function recentRouteId(pair: RoutePair): string {
  return `${formatCoord(pair.origin.position)}>${formatCoord(pair.destination.position)}`;
}

function toEnd(value: unknown): RouteEnd | null {
  if (typeof value !== "object" || value === null) return null;
  const v = value as Record<string, unknown>;
  const pos = v.position as Record<string, unknown> | null | undefined;
  if (typeof v.name !== "string" || typeof pos !== "object" || pos === null) return null;
  if (typeof pos.lat !== "number" || typeof pos.lng !== "number") return null;
  const position = parseCoord(`${pos.lat},${pos.lng}`);
  return position ? { name: v.name, position } : null;
}

function toRecentRoute(pair: RoutePair): RecentRoute {
  const origin = { name: pair.origin.name, position: { ...pair.origin.position } };
  const destination = { name: pair.destination.name, position: { ...pair.destination.position } };
  return { id: recentRouteId({ origin, destination }), origin, destination };
}

function dedupeAndCap(list: RecentRoute[]): RecentRoute[] {
  const seen = new Set<string>();
  const out: RecentRoute[] = [];
  for (const route of list) {
    if (seen.has(route.id)) continue;
    seen.add(route.id);
    out.push(route);
    if (out.length >= RECENT_ROUTES_LIMIT) break;
  }
  return out;
}

export function parseRecentRoutes(raw: string | null): RecentRoute[] {
  if (raw === null) return [];
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(data)) return [];
  const list: RecentRoute[] = [];
  for (const item of data) {
    if (typeof item !== "object" || item === null) continue;
    const origin = toEnd((item as Record<string, unknown>).origin);
    const destination = toEnd((item as Record<string, unknown>).destination);
    if (origin && destination) list.push(toRecentRoute({ origin, destination }));
  }
  return dedupeAndCap(list);
}

export function addRecentRoute(list: RecentRoute[], pair: RoutePair): RecentRoute[] {
  const fresh = toRecentRoute(pair);
  return dedupeAndCap([fresh, ...list.filter((r) => r.id !== fresh.id)]);
}

export function removeRecentRoute(list: RecentRoute[], id: string): RecentRoute[] {
  return list.filter((r) => r.id !== id);
}

export function createLocalRecentRoutesStore(
  getStorage: () => Storage | null,
): RecentRoutesStore & { getServerSnapshot: () => RecentRoute[] } {
  const listeners = new Set<() => void>();
  let cachedRaw: string | null | undefined;
  let cachedList: RecentRoute[] = [];
  // 저장소가 한 번이라도 실패하면 이 탭에서는 메모리 목록이 기준이다
  let degraded = false;
  let memory: RecentRoute[] = [];

  function storage(): Storage | null {
    if (degraded) return null;
    try {
      return getStorage();
    } catch {
      return null;
    }
  }

  function load(): RecentRoute[] {
    if (degraded) return memory;
    const s = storage();
    if (!s) return memory;
    let raw: string | null;
    try {
      raw = s.getItem(RECENT_ROUTES_KEY);
    } catch {
      degraded = true;
      memory = cachedList;
      return memory;
    }
    if (raw !== cachedRaw) {
      cachedRaw = raw;
      cachedList = parseRecentRoutes(raw);
    }
    return cachedList;
  }

  function commit(next: RecentRoute[]): void {
    const s = storage();
    if (s) {
      try {
        if (next.length === 0) s.removeItem(RECENT_ROUTES_KEY);
        else s.setItem(RECENT_ROUTES_KEY, JSON.stringify(next));
        listeners.forEach((l) => l());
        return;
      } catch {
        degraded = true;
      }
    }
    memory = next;
    listeners.forEach((l) => l());
  }

  return {
    load,
    save: (pair) => commit(addRecentRoute(load(), pair)),
    remove: (id) => commit(removeRecentRoute(load(), id)),
    clear: () => commit([]),
    subscribe(listener) {
      listeners.add(listener);
      const onStorage = (e: StorageEvent) => {
        if (e.key === RECENT_ROUTES_KEY || e.key === null) listener();
      };
      if (typeof window !== "undefined") window.addEventListener("storage", onStorage);
      return () => {
        listeners.delete(listener);
        if (typeof window !== "undefined") window.removeEventListener("storage", onStorage);
      };
    },
    getServerSnapshot: () => SERVER_SNAPSHOT,
  };
}
