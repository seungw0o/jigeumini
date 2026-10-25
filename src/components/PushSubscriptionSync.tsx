"use client";

import { useEffect, useRef } from "react";
import { currentSubscription, pushConfigured, pushSupported, putSubscription } from "@/apis/push/client";
import { useAuth } from "@/components/AuthProvider";

// 앱을 열 때 한 번, 이미 있는 푸시 구독을 워커에 다시 올린다 (브라우저가 구독을 바꿨어도 최신으로 맞춤)
export function PushSubscriptionSync() {
  const auth = useAuth();
  const syncedUid = useRef<string | null>(null);

  useEffect(() => {
    if (auth.status !== "signedIn" || syncedUid.current === auth.user.uid) return;
    if (!pushConfigured() || !pushSupported() || Notification.permission !== "granted") return;
    const user = auth.user;
    syncedUid.current = user.uid;
    currentSubscription()
      .then((subscription) => (subscription ? putSubscription(user, subscription) : undefined))
      .catch((error: unknown) => {
        console.error("push subscription sync failed:", error instanceof Error ? error.message : error);
      });
  }, [auth]);

  return null;
}
