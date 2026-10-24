import { describe, expect, it } from "vitest";
import {
  RECENT_SEARCHES_KEY,
  RECENT_SEARCHES_LIMIT,
  createRecentSearchesStore,
  parseRecentSearches,
} from "@/utils/recentSearches";
import type { Place } from "@/utils/types";

function place(id: string, extra: Partial<Place> = {}): Place {
  return {
    id,
    name: `장소 ${id}`,
    address: `주소 ${id}`,
    category: "카페",
    position: { lat: 37.5, lng: 127.0 },
    ...extra,
  };
}

// 테스트용 가짜 Storage
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

function makeStore(storage: Storage = fakeStorage()) {
  return createRecentSearchesStore(() => storage);
}

const ids = (list: Place[]) => list.map((p) => p.id);

describe("recentSearches store", () => {
  it("최신 검색이 맨 앞에 온다", () => {
    const store = makeStore();
    store.add(place("a"));
    store.add(place("b"));
    expect(ids(store.getSnapshot())).toEqual(["b", "a"]);
    store.add(place("c"), place("d"));
    expect(ids(store.getSnapshot())).toEqual(["c", "d", "b", "a"]);
  });

  it("같은 id를 다시 추가하면 맨 앞으로 옮긴다", () => {
    const store = makeStore();
    store.add(place("a"));
    store.add(place("b"));
    store.add(place("a"));
    expect(ids(store.getSnapshot())).toEqual(["a", "b"]);
  });

  it("최대 8개까지만 보관한다", () => {
    const store = makeStore();
    for (let i = 0; i < 12; i++) store.add(place(String(i)));
    const list = store.getSnapshot();
    expect(list).toHaveLength(RECENT_SEARCHES_LIMIT);
    expect(list[0].id).toBe("11");
  });

  it("id가 current인 항목은 무시한다", () => {
    const store = makeStore();
    store.add(place("current"), place("a"));
    expect(ids(store.getSnapshot())).toEqual(["a"]);
  });

  it("distanceM은 저장하지 않는다", () => {
    const store = makeStore();
    store.add(place("a", { distanceM: 120 }));
    expect(store.getSnapshot()[0]).not.toHaveProperty("distanceM");
  });

  it("깨진 JSON, 배열이 아닌 값, 잘못된 항목을 걸러낸다", () => {
    expect(parseRecentSearches(null)).toEqual([]);
    expect(parseRecentSearches("{oops")).toEqual([]);
    expect(parseRecentSearches('{"id":"a"}')).toEqual([]);
    const raw = JSON.stringify([
      { id: "ok", name: "정상", position: { lat: 1, lng: 2 }, distanceM: 5 },
      { id: "ok", name: "중복", position: { lat: 1, lng: 2 } },
      { name: "id 없음", position: { lat: 1, lng: 2 } },
      { id: "n", position: { lat: 1, lng: 2 } },
      { id: "p", name: "위치 없음" },
      { id: "nan", name: "x", position: { lat: "1", lng: 2 } },
      null,
    ]);
    expect(parseRecentSearches(raw)).toEqual([
      { id: "ok", name: "정상", address: "", category: "", position: { lat: 1, lng: 2 } },
    ]);
  });

  it("항목 하나를 지운다", () => {
    const store = makeStore();
    store.add(place("a"), place("b"));
    store.remove("a");
    expect(ids(store.getSnapshot())).toEqual(["b"]);
  });

  it("clear는 키를 지운다", () => {
    const storage = fakeStorage();
    const store = makeStore(storage);
    store.add(place("a"));
    store.clear();
    expect(storage.getItem(RECENT_SEARCHES_KEY)).toBeNull();
    expect(store.getSnapshot()).toEqual([]);
  });

  it("버전 키로 저장하고 같은 저장소의 다른 스토어도 읽는다", () => {
    const storage = fakeStorage();
    makeStore(storage).add(place("a"));
    expect(storage.getItem(RECENT_SEARCHES_KEY)).not.toBeNull();
    expect(ids(makeStore(storage).getSnapshot())).toEqual(["a"]);
  });

  it("저장값이 같으면 getSnapshot은 같은 참조를 돌려준다", () => {
    const store = makeStore();
    store.add(place("a"));
    expect(store.getSnapshot()).toBe(store.getSnapshot());
    expect(store.getServerSnapshot()).toBe(store.getServerSnapshot());
  });

  it("쓰기가 변경을 구독자에게 알린다", () => {
    const store = makeStore();
    let calls = 0;
    const off = store.subscribe(() => calls++);
    store.add(place("a"));
    off();
    store.add(place("b"));
    expect(calls).toBe(1);
  });

  it("setItem이 던져도 메모리로 계속 동작한다", () => {
    const storage = fakeStorage();
    storage.setItem = () => {
      throw new Error("QuotaExceededError");
    };
    const store = makeStore(storage);
    expect(() => store.add(place("a"))).not.toThrow();
    store.add(place("b"));
    expect(ids(store.getSnapshot())).toEqual(["b", "a"]);
    expect(() => store.clear()).not.toThrow();
    expect(store.getSnapshot()).toEqual([]);
  });

  it("getItem이 던져도 메모리로 계속 동작한다", () => {
    const storage = fakeStorage();
    storage.getItem = () => {
      throw new Error("SecurityError");
    };
    const store = makeStore(storage);
    expect(store.getSnapshot()).toEqual([]);
    expect(() => store.add(place("a"))).not.toThrow();
    expect(ids(store.getSnapshot())).toEqual(["a"]);
  });
});
