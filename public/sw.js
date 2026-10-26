// 지금이니? 서비스 워커: 홈 화면 설치와 푸시 알림만 다룬다. 실시간 데이터 앱이라 오프라인 캐싱은 하지 않는다.

self.addEventListener("push", (event) => {
  if (!event.data) return;
  const data = event.data.json();
  event.waitUntil(
    self.registration.showNotification(data.title ?? "지금이니?", {
      body: data.body,
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      tag: data.tag,
      data: { url: data.url ?? "/", ack: data.ack ?? null },
    }),
  );
});

// 알림을 누르거나 닫으면 그 알림은 끝난 것: 워커에서 지우고, 마지막 알림이었으면 이 기기의 구독도 지운다.
// 워커가 구독을 지웠으면 브라우저 구독도 해지한다. 남겨 두면 앱을 열 때 PushSubscriptionSync가 다시 올린다.
async function acknowledge(ack) {
  if (!ack?.url || !ack.uid || !ack.token) return;
  const subscription = await self.registration.pushManager.getSubscription();
  try {
    const res = await fetch(ack.url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ uid: ack.uid, token: ack.token, endpoint: subscription?.endpoint ?? null }),
    });
    if (!res.ok) throw new Error(`ack ${res.status}`);
    const result = await res.json();
    if (result.subscriptionRemoved && subscription) await subscription.unsubscribe();
    const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const w of windows) w.postMessage({ type: "alert-acked" });
  } catch (error) {
    console.error("alert ack failed:", error instanceof Error ? error.message : error);
  }
}

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = new URL(event.notification.data?.url ?? "/", self.location.origin).href;
  event.waitUntil(
    Promise.all([
      self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((windows) => {
        const open = windows.find((w) => w.url === url);
        return open ? open.focus() : self.clients.openWindow(url);
      }),
      acknowledge(event.notification.data?.ack),
    ]),
  );
});

// 사용자가 알림을 닫을 때만 온다. 지원하지 않는 플랫폼(iOS 등)에서는 누르기만 확인으로 처리된다
self.addEventListener("notificationclose", (event) => {
  event.waitUntil(acknowledge(event.notification.data?.ack));
});
