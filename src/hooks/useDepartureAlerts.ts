"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState, useSyncExternalStore } from "react";
import type { RoutePlan } from "@/apis/live/types";
import {
  alertRequestBody,
  alertsByRoute,
  createAlert,
  deleteAlert,
  ensureSubscription,
  listAlerts,
  pushConfigured,
  pushSupported,
  putSubscription,
  type Alert,
} from "@/apis/push/client";
import { useAuth } from "@/components/AuthProvider";
import { showToast } from "@/components/Toast";
import { alertErrorMessage } from "@/utils/alertError";
import type { NotifyState } from "@/utils/types";

/**
 * unknown: 서버 렌더·하이드레이션 중 / local: 푸시 설정이 없어 화면 안에서만 켜고 끈다
 * install: 웹 푸시 미지원(홈 화면에 추가 안 한 iOS Safari 등) / 그 밖: 브라우저 알림 권한
 */
type PushEnv = "unknown" | "local" | "install" | NotificationPermission;

function readEnv(): PushEnv {
  if (!pushConfigured()) return "local";
  if (!pushSupported()) return "install";
  return Notification.permission;
}

// 권한 변경 이벤트는 받지 않는다. 렌더마다 다시 읽으므로 권한 요청 뒤 상태 갱신이면 충분하다
const subscribeNoop = () => () => {};
const serverEnv = (): PushEnv => "unknown";

interface DepartureAlerts {
  stateOf: (routeId: string) => NotifyState;
  toggle: (routeId: string, next: NotifyState) => void;
  denied: boolean;
  /** 웹 푸시를 못 쓰는 브라우저에서 마지막으로 누른 경로. 그 자리에 홈 화면 추가 안내를 띄운다 */
  installHintFor: string | null;
}

/** 경로 목록·상세가 같이 쓰는 출발 알림 상태. pairQuery는 routePairQuery(pair) 결과 */
export function useDepartureAlerts(pairQuery: string, plan: RoutePlan | undefined): DepartureAlerts {
  const auth = useAuth();
  const user = auth.user;
  const queryClient = useQueryClient();
  const env = useSyncExternalStore(subscribeNoop, readEnv, serverEnv);
  const usesPush = env === "default" || env === "granted" || env === "denied";
  const queryKey = ["alerts", user?.uid];

  // 새로고침해도 켜 둔 알림이 "켜짐"으로 보이도록 워커의 대기 중 알림을 불러온다
  const query = useQuery({
    queryKey,
    queryFn: () => listAlerts(user!),
    enabled: auth.status === "signedIn" && usesPush,
  });

  // 누른 직후 결과가 나올 때까지의 상태. 푸시를 쓰면 끝나고 지우고, local이면 그대로 둔다
  const [overrides, setOverrides] = useState<Record<string, NotifyState>>({});
  const [installHintFor, setInstallHintFor] = useState<string | null>(null);
  const busy = useRef(new Set<string>());

  const byRoute = alertsByRoute(query.data ?? [], pairQuery);
  const denied = env === "denied";

  function setOverride(routeId: string, state: NotifyState | null) {
    setOverrides((prev) => {
      const next = { ...prev };
      if (state) next[routeId] = state;
      else delete next[routeId];
      return next;
    });
  }

  function updateCache(update: (alerts: Alert[]) => Alert[]) {
    queryClient.setQueryData<Alert[]>(queryKey, (old = []) => update(old));
  }

  async function turnOn(routeId: string) {
    const permission = await Notification.requestPermission();
    // denied면 다음 렌더에서 권한을 다시 읽어 "차단됨"이 되고, 창을 그냥 닫았으면 꺼진 채로 둔다
    if (permission !== "granted") return;
    const planned = plan?.routes.find((r) => r.id === routeId);
    if (!planned || !user) throw new Error("route plan or user unavailable");
    const subscription = await ensureSubscription();
    await putSubscription(user, subscription);
    const alert = await createAlert(user, alertRequestBody(routeId, pairQuery, planned));
    updateCache((alerts) => [...alerts.filter((a) => a.id !== alert.id), alert]);
  }

  async function turnOff(routeId: string) {
    const alert = byRoute[routeId];
    if (!alert || !user) return;
    await deleteAlert(user, alert.id);
    updateCache((alerts) => alerts.filter((a) => a.id !== alert.id));
  }

  function toggle(routeId: string, next: NotifyState) {
    if (env === "unknown") return;
    if (env === "local") {
      setOverride(routeId, next);
      return;
    }
    if (env === "install") {
      setInstallHintFor(routeId);
      return;
    }
    if (next === "denied" || busy.current.has(routeId)) return;
    busy.current.add(routeId);
    setOverride(routeId, next);
    (next === "on" ? turnOn(routeId) : turnOff(routeId))
      .catch((error: unknown) => {
        console.error("departure alert failed:", error instanceof Error ? error.message : error);
        // 권한 거부는 던지지 않고 "차단됨" 상태로 보여 주므로, 여기는 켜기 실패만 알린다
        if (next === "on") showToast(alertErrorMessage(error));
      })
      .finally(() => {
        busy.current.delete(routeId);
        setOverride(routeId, null);
      });
  }

  return {
    stateOf: (routeId) => overrides[routeId] ?? (denied ? "denied" : byRoute[routeId] ? "on" : "idle"),
    toggle,
    denied,
    installHintFor,
  };
}
