import { useSyncExternalStore } from "react";
import { createRecentSearchesStore } from "@/utils/recentSearches";
import type { Place } from "@/utils/types";

// localStorage 접근 자체가 던질 수 있어 getter도 감싼다
const store = createRecentSearchesStore(() => {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
});

export function useRecentSearches(): {
  recent: Place[];
  addRecent: (...places: Place[]) => void;
  removeRecent: (placeId: string) => void;
  clearRecent: () => void;
} {
  const recent = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getServerSnapshot);
  return {
    recent,
    addRecent: store.add,
    removeRecent: store.remove,
    clearRecent: store.clear,
  };
}
