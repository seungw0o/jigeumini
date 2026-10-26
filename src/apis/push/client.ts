import type { User } from "firebase/auth";
import type { PlannedRoute } from "@/apis/live/types";

export type AlertStatus = "pending" | "sent" | "cancelled" | "failed";

export interface Alert {
  id: string;
  routeId: string;
  pairQuery: string;
  routeNo: string;
  /** 탈 버스 번호들(환승 순서). 이전 워커는 보내지 않는다 */
  busNos?: string[];
  boardNodeId: string;
  status: AlertStatus;
  leaveByAt: string | null;
  createdAt: string;
}

interface AlertRequestBody {
  routeId: string;
  pairQuery: string;
  plan: PlannedRoute;
}

export class PushError extends Error {
  status: number;
  code: string;

  constructor(status: number, code: string) {
    super(`push ${status}: ${code}`);
    this.name = "PushError";
    this.status = status;
    this.code = code;
  }
}

const baseUrl = () => process.env.NEXT_PUBLIC_COLLECTOR_URL;
const vapidKey = () => process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

// 워커 주소와 VAPID 공개키가 모두 있을 때만 실제 푸시 알림을 쓴다
export function pushConfigured(): boolean {
  return Boolean(baseUrl() && vapidKey());
}

// 브라우저가 웹 푸시를 지원하는지. 홈 화면에 추가하지 않은 iOS Safari는 PushManager가 없다
export function pushSupported(): boolean {
  return "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

/** base64url(패딩 없음) 문자열을 바이트로. VAPID 공개키를 applicationServerKey로 넘길 때 쓴다 */
export function base64UrlToBytes(value: string): Uint8Array<ArrayBuffer> {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  const raw = atob(base64);
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

/** POST /alerts 본문. 요청을 작게 하려고 구간 좌표열(path)은 비우고, 쿼리 앞 "?"는 뗀다 */
export function alertRequestBody(routeId: string, pairQuery: string, plan: PlannedRoute): AlertRequestBody {
  return {
    routeId,
    pairQuery: pairQuery.replace(/^\?/, ""),
    plan: { ...plan, legs: plan.legs.map((leg) => ({ ...leg, path: [] })) },
  };
}

/** 지금 화면(같은 출발/도착 쿼리)의 대기 중 알림을 경로 id별로 */
export function alertsByRoute(alerts: Alert[], pairQuery: string): Record<string, Alert> {
  const byRoute: Record<string, Alert> = {};
  for (const alert of alerts) {
    if (alert.status === "pending" && alert.pairQuery === pairQuery) byRoute[alert.routeId] = alert;
  }
  return byRoute;
}

async function send(user: User, path: string, init: RequestInit, forceRefresh: boolean): Promise<Response> {
  const token = await user.getIdToken(forceRefresh);
  try {
    return await fetch(`${baseUrl()}${path}`, {
      ...init,
      headers: { ...init.headers, Authorization: `Bearer ${token}` },
    });
  } catch {
    throw new PushError(0, "network");
  }
}

// 401이면 토큰을 강제 갱신해 한 번만 재시도한다
async function request(user: User, path: string, init: RequestInit = {}): Promise<Response> {
  let res = await send(user, path, init, false);
  if (res.status === 401) res = await send(user, path, init, true);
  return res;
}

async function failure(res: Response): Promise<PushError> {
  const body = (await res.json().catch(() => null)) as { error?: string } | null;
  return new PushError(res.status, body?.error ?? `http_${res.status}`);
}

const jsonInit = (method: string, body: unknown): RequestInit => ({
  method,
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

export async function putSubscription(user: User, subscription: PushSubscription): Promise<void> {
  const res = await request(user, "/push/subscription", jsonInit("PUT", subscription.toJSON()));
  if (!res.ok) throw await failure(res);
}

export async function listAlerts(user: User): Promise<Alert[]> {
  const res = await request(user, "/alerts");
  if (!res.ok) throw await failure(res);
  const body = (await res.json()) as { alerts: Alert[] };
  return body.alerts;
}

// 같은 대기 중 알림이 이미 있으면 워커가 200으로 그 알림을 돌려준다
export async function createAlert(user: User, body: AlertRequestBody): Promise<Alert> {
  const res = await request(user, "/alerts", jsonInit("POST", body));
  if (!res.ok) throw await failure(res);
  const json = (await res.json()) as { alert: Alert };
  return json.alert;
}

// 404는 이미 지워진 것이므로 성공으로 본다
export async function deleteAlert(user: User, alertId: string): Promise<void> {
  const res = await request(user, `/alerts/${encodeURIComponent(alertId)}`, { method: "DELETE" });
  if (!res.ok && res.status !== 404) throw await failure(res);
}

/** 이미 있는 구독을 꺼내고, 없으면 새로 구독한다. 알림 권한이 허용된 뒤에 부른다 */
export async function ensureSubscription(): Promise<PushSubscription> {
  const registration = await navigator.serviceWorker.ready;
  const existing = await registration.pushManager.getSubscription();
  if (existing) return existing;
  return registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: base64UrlToBytes(vapidKey() ?? ""),
  });
}

export async function currentSubscription(): Promise<PushSubscription | null> {
  const registration = await navigator.serviceWorker.ready;
  return registration.pushManager.getSubscription();
}
