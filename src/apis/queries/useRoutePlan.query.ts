import type { RoutePlan } from "@/apis/live/types";
import { routePairQuery, type FailFlag, type RoutePair } from "@/utils/routeQuery";
import { useQuery } from "@tanstack/react-query";
import { fetchJson, type LiveFetchError } from "./fetchJson";

export function useRoutePlan(pair: RoutePair | null, options?: { fail?: FailFlag | null; enabled?: boolean }) {
  const pairQuery = pair ? routePairQuery(pair) : "";
  const forceFail = options?.fail === "routes";
  return useQuery<RoutePlan, LiveFetchError>({
    queryKey: ["routePlan", pairQuery, forceFail],
    queryFn: ({ signal }) => fetchJson<RoutePlan>(`/api/routes?${pairQuery}${forceFail ? "&fail=routes" : ""}`, signal),
    enabled: pair !== null && options?.enabled !== false,
    // 카카오 경로 기하는 세션 동안 그대로 쓴다
    staleTime: Infinity,
    gcTime: 30 * 60_000,
  });
}
