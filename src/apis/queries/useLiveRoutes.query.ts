import type { LiveError, RouteEnd, RoutePlan, StopArrivals } from "@/apis/live/types";
import { useNow } from "@/hooks/useNow";
import { estimateRoutes, kstClock } from "@/utils/estimate";
import type { FailFlag, RoutePair } from "@/utils/routeQuery";
import type { TransitRoute } from "@/utils/types";
import { useMemo } from "react";
import { useArrivals } from "./useArrivals.query";
import { useRoutePlan } from "./useRoutePlan.query";

export interface LiveRoutesResult {
  status: "idle" | "loading" | "error" | "ready";
  error: LiveError | null;
  origin: RouteEnd | null;
  destination: RouteEnd | null;
  plan: RoutePlan | undefined;
  routes: TransitRoute[];
  /** 현재 시각 "HH:MM" (KST) */
  baseTime: string;
  /** 도착 정보를 받은 뒤 지난 초 */
  secondsAgo: number;
  refresh: () => void;
  isRefreshing: boolean;
}

function nodeIdsOf(plan: RoutePlan | undefined): string[] {
  if (!plan) return [];
  const ids = new Set<string>();
  for (const route of plan.routes) {
    for (const leg of route.legs) {
      if (leg.kind === "bus" && leg.board.nodeId !== null) ids.add(leg.board.nodeId);
    }
  }
  return [...ids];
}

export function useLiveRoutes(
  pair: RoutePair | null,
  options?: { fail?: FailFlag | null; enabled?: boolean },
): LiveRoutesResult {
  const enabled = pair !== null && options?.enabled !== false;
  const planQuery = useRoutePlan(pair, options);
  const plan = planQuery.data;
  const nodeIds = useMemo(() => nodeIdsOf(plan), [plan]);
  const arrivalsQuery = useArrivals(nodeIds, options);

  const arrivals = arrivalsQuery.data;
  const dataUpdatedAt = arrivalsQuery.dataUpdatedAt;
  // ETA는 서버 시계 대신 클라이언트가 응답을 받은 시각에 맞춘다
  const nowMs = Math.max(useNow(10_000), dataUpdatedAt);
  const arrivalsFailed = arrivalsQuery.isError && !arrivals;

  const routes = useMemo(() => {
    if (!plan) return [];
    let record: Record<string, StopArrivals> | undefined;
    if (arrivals) record = arrivals.stops;
    else if (nodeIds.length === 0) record = {};
    else if (arrivalsFailed) {
      const error: LiveError = { code: "NETWORK", message: "실시간 도착 정보를 불러오지 못했어요" };
      record = Object.fromEntries(nodeIds.map((id) => [id, { ok: false, error }]));
    }
    return estimateRoutes(plan.routes, record, { fetchedAtMs: dataUpdatedAt || nowMs, nowMs });
  }, [plan, arrivals, arrivalsFailed, nodeIds, dataUpdatedAt, nowMs]);

  let status: LiveRoutesResult["status"] = "ready";
  if (!enabled) status = "idle";
  else if (planQuery.isError) status = "error";
  else if (!plan) status = "loading";

  const { refetch: refetchArrivals } = arrivalsQuery;
  const { refetch: refetchPlan } = planQuery;
  const planFailed = planQuery.isError;
  return {
    status,
    error: planQuery.error ? { code: planQuery.error.code, message: planQuery.error.message } : null,
    origin: plan?.origin ?? pair?.origin ?? null,
    destination: plan?.destination ?? pair?.destination ?? null,
    plan,
    routes,
    baseTime: kstClock(nowMs),
    secondsAgo: dataUpdatedAt ? Math.max(0, Math.floor((nowMs - dataUpdatedAt) / 1000)) : 0,
    refresh: () => {
      void refetchArrivals();
      if (planFailed) void refetchPlan();
    },
    isRefreshing: arrivalsQuery.isFetching || planQuery.isFetching,
  };
}
