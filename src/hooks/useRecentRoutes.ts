import { useSyncExternalStore } from "react";
import { createLocalRecentRoutesStore, type RecentRoute } from "@/utils/recentRoutes";
import type { RoutePair } from "@/utils/routeQuery";

// localStorage 접근 자체가 던질 수 있어 getter도 감싼다
const store = createLocalRecentRoutesStore(() => {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
});

export function useRecentRoutes(): {
  recentRoutes: RecentRoute[];
  saveRecentRoute: (pair: RoutePair) => void;
  removeRecentRoute: (id: string) => void;
  clearRecentRoutes: () => void;
} {
  const recentRoutes = useSyncExternalStore(store.subscribe, store.load, store.getServerSnapshot);
  return {
    recentRoutes,
    saveRecentRoute: store.save,
    removeRecentRoute: store.remove,
    clearRecentRoutes: store.clear,
  };
}
