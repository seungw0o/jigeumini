import { buildPushPayload, type PushSubscription, type VapidKeys } from "@block65/webcrypto-web-push";

/** public/sw.js의 push 핸들러가 읽는 모양 */
export interface PushPayload {
  title: string;
  body: string;
  tag: string;
  url: string;
  /** 알림을 누르거나 닫으면 서비스 워커가 이 주소로 uid와 token을 보낸다 (alert-ack.ts) */
  ack?: { url: string; uid: string; token: string };
}

interface PushResult {
  sent: number;
  removed: number;
  failed: number;
}

/** 출발 시각이 지나면 쓸모없는 알림이라 오래 들고 있지 않게 한다 */
const PUSH_TTL_SEC = 300;

type SubscriptionRow = { endpoint: string; p256dh: string; auth: string };

export function vapidKeysOf(env: { VAPID_PUBLIC_KEY?: string; VAPID_PRIVATE_KEY?: string; VAPID_SUBJECT?: string }): VapidKeys {
  return { subject: env.VAPID_SUBJECT, publicKey: env.VAPID_PUBLIC_KEY, privateKey: env.VAPID_PRIVATE_KEY };
}

/** uid의 모든 구독에 보낸다. 푸시 서비스가 404/410이면 끝난 구독이라 지운다 */
export async function sendToUser(
  db: D1Database,
  uid: string,
  payload: PushPayload,
  vapid: VapidKeys,
  fetchImpl: typeof fetch = fetch,
): Promise<PushResult> {
  const { results } = await db
    .prepare("SELECT endpoint, p256dh, auth FROM push_subscriptions WHERE uid = ?")
    .bind(uid)
    .all<SubscriptionRow>();
  const result: PushResult = { sent: 0, removed: 0, failed: 0 };
  for (const row of results) {
    const subscription: PushSubscription = {
      endpoint: row.endpoint,
      expirationTime: null,
      keys: { p256dh: row.p256dh, auth: row.auth },
    };
    let status: number;
    try {
      const request = await buildPushPayload({ data: { ...payload }, options: { ttl: PUSH_TTL_SEC, urgency: "high" } }, subscription, vapid);
      status = (await fetchImpl(row.endpoint, request)).status;
    } catch (error) {
      // 구독 주소와 키는 기록하지 않는다
      console.error("push send failed:", error instanceof Error ? error.message : "unknown");
      result.failed += 1;
      continue;
    }
    if (status === 404 || status === 410) {
      await db.prepare("DELETE FROM push_subscriptions WHERE uid = ? AND endpoint = ?").bind(uid, row.endpoint).run();
      result.removed += 1;
    } else if (status >= 200 && status < 300) {
      result.sent += 1;
    } else {
      console.error("push service responded", status);
      result.failed += 1;
    }
  }
  return result;
}
