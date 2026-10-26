import type { Place } from "@/utils/types";

export const RECENT_SEARCHES_KEY = "jigeumini:recent-searches:v1";
export const RECENT_SEARCHES_LIMIT = 8;

const CURRENT_ID = "current";
// 서버 스냅샷은 항상 같은 참조여야 한다
const SERVER_SNAPSHOT: Place[] = [];

// distanceM은 옛 위치 기준이라 저장하지 않는다
function strip(place: Place): Place {
  return {
    id: place.id,
    name: place.name,
    address: place.address,
    category: place.category,
    position: { lat: place.position.lat, lng: place.position.lng },
  };
}

function dedupeAndCap(places: Place[]): Place[] {
  const seen = new Set<string>();
  const out: Place[] = [];
  for (const place of places) {
    if (seen.has(place.id)) continue;
    seen.add(place.id);
    out.push(place);
    if (out.length >= RECENT_SEARCHES_LIMIT) break;
  }
  return out;
}

function toPlace(value: unknown): Place | null {
  if (typeof value !== "object" || value === null) return null;
  const v = value as Record<string, unknown>;
  const pos = v.position as Record<string, unknown> | null | undefined;
  if (typeof v.id !== "string" || typeof v.name !== "string") return null;
  if (typeof pos !== "object" || pos === null) return null;
  if (typeof pos.lat !== "number" || !Number.isFinite(pos.lat)) return null;
  if (typeof pos.lng !== "number" || !Number.isFinite(pos.lng)) return null;
  return {
    id: v.id,
    name: v.name,
    address: typeof v.address === "string" ? v.address : "",
    category: typeof v.category === "string" ? v.category : "",
    position: { lat: pos.lat, lng: pos.lng },
  };
}

export function parseRecentSearches(raw: string | null): Place[] {
  if (raw === null) return [];
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(data)) return [];
  const places: Place[] = [];
  for (const item of data) {
    const place = toPlace(item);
    if (place) places.push(place);
  }
  return dedupeAndCap(places);
}

// picked[0]이 가장 최근 검색
function addRecentSearches(list: Place[], picked: Place[]): Place[] {
  const fresh = picked.filter((p) => p.id !== CURRENT_ID).map(strip);
  const ids = new Set(fresh.map((p) => p.id));
  const rest = list.filter((p) => !ids.has(p.id));
  return dedupeAndCap([...fresh, ...rest]);
}

function removeRecentSearch(list: Place[], placeId: string): Place[] {
  return list.filter((p) => p.id !== placeId);
}

export function createRecentSearchesStore(getStorage: () => Storage | null) {
  const listeners = new Set<() => void>();
  let cachedRaw: string | null | undefined;
  let cachedList: Place[] = [];
  // 저장소가 한 번이라도 실패하면 이 탭에서는 메모리 목록이 기준이다
  let degraded = false;
  let memory: Place[] = [];

  function safeStorage(): Storage | null {
    try {
      return getStorage();
    } catch {
      return null;
    }
  }

  function getSnapshot(): Place[] {
    if (degraded) return memory;
    const storage = safeStorage();
    if (!storage) return memory;
    let raw: string | null;
    try {
      raw = storage.getItem(RECENT_SEARCHES_KEY);
    } catch {
      degraded = true;
      memory = cachedList;
      return memory;
    }
    if (raw !== cachedRaw) {
      cachedRaw = raw;
      cachedList = parseRecentSearches(raw);
    }
    return cachedList;
  }

  function notify(): void {
    listeners.forEach((listener) => listener());
  }

  function commit(next: Place[]): void {
    const current = getSnapshot();
    if (next === current) return;
    const storage = degraded ? null : safeStorage();
    if (storage) {
      try {
        if (next.length === 0) storage.removeItem(RECENT_SEARCHES_KEY);
        else storage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(next));
        notify();
        return;
      } catch {
        degraded = true;
      }
    }
    memory = next;
    notify();
  }

  function subscribe(listener: () => void): () => void {
    listeners.add(listener);
    const onStorage = (e: StorageEvent) => {
      if (e.key === RECENT_SEARCHES_KEY || e.key === null) listener();
    };
    if (typeof window !== "undefined") window.addEventListener("storage", onStorage);
    return () => {
      listeners.delete(listener);
      if (typeof window !== "undefined") window.removeEventListener("storage", onStorage);
    };
  }

  return {
    subscribe,
    getSnapshot,
    getServerSnapshot: (): Place[] => SERVER_SNAPSHOT,
    add(...places: Place[]): void {
      commit(addRecentSearches(getSnapshot(), places));
    },
    remove(placeId: string): void {
      commit(removeRecentSearch(getSnapshot(), placeId));
    },
    clear(): void {
      const storage = degraded ? null : safeStorage();
      if (storage) {
        try {
          storage.removeItem(RECENT_SEARCHES_KEY);
          notify();
          return;
        } catch {
          degraded = true;
        }
      }
      memory = [];
      notify();
    },
  };
}
