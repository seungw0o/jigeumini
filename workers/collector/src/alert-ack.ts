import type { AlertScheduler } from "./alerts";
import { json } from "./json";

/**
 * 알림 확인(ack): 서비스 워커가 알림을 누르거나 닫으면 그 알림을 지운다.
 * 서비스 워커는 Firebase ID 토큰을 쓸 수 없어서, 푸시 본문에 알림별 토큰(HMAC)을 넣어 보낸다.
 * 키는 이미 있는 VAPID 비밀키를 쓴다: 이 키가 없으면 푸시도 못 보내니 토큰이 필요한 곳엔 항상 있다.
 */
const ACK_LABEL = "alert-ack:v1";
const ACK_MAX_BODY_BYTES = 2048;
export const ACK_PATH_RE = /^\/alerts\/([0-9a-f-]{36})\/ack$/;

const encoder = new TextEncoder();

function toBase64Url(bytes: ArrayBuffer): string {
  let raw = "";
  for (const b of new Uint8Array(bytes)) raw += String.fromCharCode(b);
  return btoa(raw).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(value: string): Uint8Array<ArrayBuffer> | null {
  if (!/^[A-Za-z0-9_-]{43}$/.test(value)) return null;
  const raw = atob(value.replace(/-/g, "+").replace(/_/g, "/") + "=");
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

const hmacKey = (secret: string, usage: "sign" | "verify") =>
  crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, [usage]);

const ackMessage = (alertId: string, uid: string) => encoder.encode(`${ACK_LABEL}:${alertId}:${uid}`);

export async function ackToken(secret: string, alertId: string, uid: string): Promise<string> {
  return toBase64Url(await crypto.subtle.sign("HMAC", await hmacKey(secret, "sign"), ackMessage(alertId, uid)));
}

// crypto.subtle.verify는 상수 시간 비교를 한다
async function verifyAckToken(secret: string, alertId: string, uid: string, token: string): Promise<boolean> {
  const signature = fromBase64Url(token);
  if (signature === null) return false;
  return crypto.subtle.verify("HMAC", await hmacKey(secret, "verify"), signature, ackMessage(alertId, uid));
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

function parseEndpoint(value: unknown): string | null {
  if (typeof value !== "string" || value.length > 1024) return null;
  try {
    return new URL(value).protocol === "https:" ? value : null;
  } catch {
    return null;
  }
}

type AckBody = { uid: string; token: string; endpoint: string | null };

function parseAckBody(value: unknown): AckBody | null {
  if (!isRecord(value)) return null;
  const { uid, token, endpoint } = value;
  if (typeof uid !== "string" || uid.length === 0 || uid.length > 128) return null;
  if (typeof token !== "string" || token.length > 64) return null;
  if (endpoint !== null && endpoint !== undefined && parseEndpoint(endpoint) === null) return null;
  return { uid, token, endpoint: endpoint == null ? null : (endpoint as string) };
}

/**
 * POST /alerts/:id/ack { uid, token, endpoint }
 * 알림 행을 상태와 관계없이 지우고, 그 uid에 대기 중 알림이 더 없으면 이 기기(endpoint)의 구독도 지운다.
 * 두 번 와도 같은 결과다(이미 지운 알림이면 deleted: false).
 */
export async function handleAlertAck(
  request: Request,
  db: D1Database,
  scheduler: AlertScheduler,
  secret: string | undefined,
): Promise<Response> {
  const match = new URL(request.url).pathname.match(ACK_PATH_RE);
  if (match === null) return json({ error: "not found" }, 404);
  if (request.method !== "POST") return json({ error: "method not allowed" }, 405);
  if (!secret) return json({ error: "ack unavailable" }, 503);
  const alertId = match[1];

  const length = request.headers.get("Content-Length");
  if (length !== null && Number(length) > ACK_MAX_BODY_BYTES) return json({ error: "body too large" }, 413);
  const text = await request.text();
  if (encoder.encode(text).byteLength > ACK_MAX_BODY_BYTES) return json({ error: "body too large" }, 413);
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return json({ error: "invalid json" }, 400);
  }
  const body = parseAckBody(raw);
  if (body === null) return json({ error: "invalid body" }, 400);
  if (!(await verifyAckToken(secret, alertId, body.uid, body.token))) return json({ error: "forbidden" }, 403);

  const row = await db.prepare("SELECT status FROM alerts WHERE id = ? AND uid = ?").bind(alertId, body.uid).first<{ status: string }>();
  let deleted = false;
  if (row !== null) {
    await db.prepare("DELETE FROM alerts WHERE id = ? AND uid = ?").bind(alertId, body.uid).run();
    deleted = true;
    if (row.status === "pending") await scheduler.cancel(alertId);
  }

  let subscriptionRemoved = false;
  if (body.endpoint !== null) {
    const pending = await db.prepare("SELECT 1 FROM alerts WHERE uid = ? AND status = 'pending' LIMIT 1").bind(body.uid).first();
    if (pending === null) {
      const result = await db.prepare("DELETE FROM push_subscriptions WHERE uid = ? AND endpoint = ?").bind(body.uid, body.endpoint).run();
      subscriptionRemoved = result.meta.changes > 0;
    }
  }
  return json({ deleted, subscriptionRemoved });
}
