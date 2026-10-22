import type { ArrivalsResponse } from "@/apis/live/types";
import type { FailFlag } from "@/utils/routeQuery";
import { useQuery } from "@tanstack/react-query";
import { fetchJson } from "./fetchJson";

export const ARRIVALS_REFRESH_MS = 25_000;

export function useArrivals(nodeIds: string[], options?: { fail?: FailFlag | null; enabled?: boolean }) {
  const ids = [...new Set(nodeIds)].sort();
  const forceFail = options?.fail === "arrivals";
  return useQuery<ArrivalsResponse>({
    queryKey: ["arrivals", ids.join(","), forceFail],
    queryFn: ({ signal }) =>
      fetchJson<ArrivalsResponse>(`/api/arrivals?stops=${ids.join(",")}${forceFail ? "&fail=arrivals" : ""}`, signal),
    enabled: ids.length > 0 && options?.enabled !== false,
    refetchInterval: ARRIVALS_REFRESH_MS,
    refetchIntervalInBackground: false,
    staleTime: 20_000,
  });
}
