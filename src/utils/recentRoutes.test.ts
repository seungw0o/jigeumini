import { describe, expect, it } from "vitest";
import {
  RECENT_ROUTES_KEY,
  RECENT_ROUTES_LIMIT,
  addRecentRoute,
  createLocalRecentRoutesStore,
  parseRecentRoutes,
  recentRouteId,
  removeRecentRoute,
  type RecentRoute,
} from "@/utils/recentRoutes";
import type { RoutePair } from "@/utils/routeQuery";

function pair(n: number, names: [string, string] = [`출발 ${n}`, `도착 ${n}`]): RoutePair {
  return {
    origin: { name: names[0], position: { lat: 36.3 + n / 1000, lng: 127.3 } },
    destination: { name: names[1], position: { lat: 36.4, lng: 127.4 + n / 1000 } },
  };
}

function fakeStorage(): Storage {
  const data = new Map<string, string>();
  return {
    get length() {
      return data.size;
    },
    clear: () => data.clear(),
    getItem: (k) => data.get(k) ?? null,
    key: (i) => [...data.keys()][i] ?? null,
    removeItem: (k) => void data.delete(k),
    setItem: (k, v) => void data.set(k, v),
  };
}

const names = (list: RecentRoute[]) => list.map((r) => `${r.origin.name}>${r.destination.name}`);

describe("addRecentRoute", () => {
  it("puts the newest pair on top", () => {
    const list = addRecentRoute(addRecentRoute([], pair(1)), pair(2));
    expect(names(list)).toEqual(["출발 2>도착 2", "출발 1>도착 1"]);
  });

  it("moves an existing pair to the top instead of duplicating it, keeping the newest names", () => {
    let list = [pair(1), pair(2), pair(3)].reduce<RecentRoute[]>((acc, p) => addRecentRoute(acc, p), []);
    list = addRecentRoute(list, pair(1, ["새 출발", "새 도착"]));
    expect(names(list)).toEqual(["새 출발>새 도착", "출발 3>도착 3", "출발 2>도착 2"]);
  });

  it("treats the reversed direction as a different pair", () => {
    const p = pair(1);
    const list = addRecentRoute(addRecentRoute([], p), { origin: p.destination, destination: p.origin });
    expect(list).toHaveLength(2);
  });

  it(`keeps at most ${RECENT_ROUTES_LIMIT}`, () => {
    let list: RecentRoute[] = [];
    for (let i = 0; i < RECENT_ROUTES_LIMIT + 3; i++) list = addRecentRoute(list, pair(i));
    expect(list).toHaveLength(RECENT_ROUTES_LIMIT);
    expect(list[0].id).toBe(recentRouteId(pair(RECENT_ROUTES_LIMIT + 2)));
  });
});

describe("removeRecentRoute", () => {
  it("removes only the matching pair", () => {
    const list = addRecentRoute(addRecentRoute([], pair(1)), pair(2));
    expect(names(removeRecentRoute(list, recentRouteId(pair(2))))).toEqual(["출발 1>도착 1"]);
  });
});

describe("parseRecentRoutes", () => {
  it("returns [] for missing or broken data", () => {
    expect(parseRecentRoutes(null)).toEqual([]);
    expect(parseRecentRoutes("{not json")).toEqual([]);
    expect(parseRecentRoutes('{"a":1}')).toEqual([]);
  });

  it("drops malformed items and out-of-range coordinates", () => {
    const good = pair(1);
    const raw = JSON.stringify([
      good,
      { origin: good.origin },
      { origin: { name: "x", position: { lat: 999, lng: 0 } }, destination: good.destination },
      { origin: { name: 1, position: good.origin.position }, destination: good.destination },
      "text",
    ]);
    expect(names(parseRecentRoutes(raw))).toEqual(["출발 1>도착 1"]);
  });
});

describe("createLocalRecentRoutesStore", () => {
  it("saves, persists and notifies", () => {
    const storage = fakeStorage();
    const store = createLocalRecentRoutesStore(() => storage);
    let calls = 0;
    const unsubscribe = store.subscribe(() => calls++);
    store.save(pair(1));
    store.save(pair(2));
    expect(names(store.load())).toEqual(["출발 2>도착 2", "출발 1>도착 1"]);
    expect(calls).toBe(2);
    const reopened = createLocalRecentRoutesStore(() => storage);
    expect(names(reopened.load())).toEqual(["출발 2>도착 2", "출발 1>도착 1"]);
    unsubscribe();
  });

  it("returns the same snapshot reference until the data changes", () => {
    const store = createLocalRecentRoutesStore(fakeStorage);
    store.save(pair(1));
    expect(store.load()).toBe(store.load());
  });

  it("removes one item and clears the key when empty", () => {
    const storage = fakeStorage();
    const store = createLocalRecentRoutesStore(() => storage);
    store.save(pair(1));
    store.save(pair(2));
    store.remove(recentRouteId(pair(2)));
    expect(names(store.load())).toEqual(["출발 1>도착 1"]);
    store.clear();
    expect(store.load()).toEqual([]);
    expect(storage.getItem(RECENT_ROUTES_KEY)).toBeNull();
  });

  it("falls back to memory when storage throws", () => {
    const broken = fakeStorage();
    broken.setItem = () => {
      throw new Error("quota");
    };
    const store = createLocalRecentRoutesStore(() => broken);
    store.save(pair(1));
    expect(names(store.load())).toEqual(["출발 1>도착 1"]);
  });
});
