import type { PlannedLeg, PlannedRoute, PlannedStop } from "../../../src/apis/live/types";
import { NOTIFY_BEFORE_MIN } from "./alert-schedule";
import { authenticate, type VerifyOptions } from "./auth";
import { json } from "./json";
import { isStopId } from "../../../src/shared/region";

export const ALERTS_PENDING_LIMIT = 5;
export const SUBSCRIPTION_MAX_BODY_BYTES = 2048;
export const ALERT_MAX_BODY_BYTES = 16384;

/** 알림 하나를 맡는 Durable Object 조작. 테스트에서는 대역을 넣는다 */
export interface AlertScheduler {
  schedule(alertId: string): Promise<void>;
  cancel(alertId: string): Promise<void>;
}

export type AlertStatus = "pending" | "sent" | "cancelled" | "failed";

export interface Alert {
  id: string;
  routeId: string;
  pairQuery: string;
  routeNo: string;
  boardNodeId: string;
  status: AlertStatus;
  leaveByAt: string | null;
  createdAt: string;
}

type AlertRow = {
  id: string;
  route_id: string;
  pair_query: string;
  route_no: string;
  board_node_id: string;
  status: AlertStatus;
  leave_by_at: string | null;
  created_at: string;
};

const ALERT_COLUMNS = "id, route_id, pair_query, route_no, board_node_id, status, leave_by_at, created_at";

const toAlert = (row: AlertRow): Alert => ({
  id: row.id,
  routeId: row.route_id,
  pairQuery: row.pair_query,
  routeNo: row.route_no,
  boardNodeId: row.board_node_id,
  status: row.status,
  leaveByAt: row.leave_by_at,
  createdAt: row.created_at,
});

type Body = { ok: true; value: unknown } | { ok: false; response: Response };

async function readJson(request: Request, maxBytes: number): Promise<Body> {
  const tooLarge = (): Body => ({ ok: false, response: json({ error: "body too large" }, 413) });
  const length = request.headers.get("Content-Length");
  if (length !== null && Number(length) > maxBytes) return tooLarge();
  const text = await request.text();
  if (new TextEncoder().encode(text).byteLength > maxBytes) return tooLarge();
  try {
    return { ok: true, value: JSON.parse(text) };
  } catch {
    return { ok: false, response: json({ error: "invalid json" }, 400) };
  }
}

type Auth = { ok: true; uid: string } | { ok: false; response: Response };

async function requireUid(request: Request, projectIds: readonly string[], options?: VerifyOptions): Promise<Auth> {
  let auth;
  try {
    auth = await authenticate(request, projectIds, options);
  } catch (err) {
    // 토큰이나 헤더가 섞이지 않도록 메시지만 기록한다
    console.error("auth key fetch failed:", err instanceof Error ? err.message : "unknown");
    return { ok: false, response: json({ error: "auth unavailable" }, 503) };
  }
  if (auth.ok) return { ok: true, uid: auth.uid };
  const res = json({ error: auth.reason }, 401);
  res.headers.set("WWW-Authenticate", "Bearer");
  return { ok: false, response: res };
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const isText = (value: unknown, max: number): value is string => typeof value === "string" && value.length <= max;
const isNumberIn = (value: unknown, min: number, max: number): value is number =>
  typeof value === "number" && Number.isFinite(value) && value >= min && value <= max;
const BASE64URL_RE = /^[A-Za-z0-9_-]+={0,2}$/;

function parseEndpoint(value: unknown): string | null {
  if (!isText(value, 1024)) return null;
  try {
    return new URL(value).protocol === "https:" ? value : null;
  } catch {
    return null;
  }
}

function parseSubscription(body: unknown): { endpoint: string; p256dh: string; auth: string } | null {
  if (!isRecord(body) || !isRecord(body.keys)) return null;
  const endpoint = parseEndpoint(body.endpoint);
  const { p256dh, auth } = body.keys;
  if (endpoint === null) return null;
  if (!isText(p256dh, 200) || p256dh.length < 40 || !BASE64URL_RE.test(p256dh)) return null;
  if (!isText(auth, 64) || auth.length < 8 || !BASE64URL_RE.test(auth)) return null;
  return { endpoint, p256dh, auth };
}

export async function handlePushSubscription(
  request: Request,
  db: D1Database,
  projectIds: readonly string[],
  options?: VerifyOptions,
): Promise<Response> {
  if (request.method !== "PUT" && request.method !== "DELETE") return json({ error: "method not allowed" }, 405);
  const auth = await requireUid(request, projectIds, options);
  if (!auth.ok) return auth.response;
  const body = await readJson(request, SUBSCRIPTION_MAX_BODY_BYTES);
  if (!body.ok) return body.response;

  if (request.method === "DELETE") {
    const endpoint = isRecord(body.value) ? parseEndpoint(body.value.endpoint) : null;
    if (endpoint === null) return json({ error: "invalid body" }, 400);
    const result = await db.prepare("DELETE FROM push_subscriptions WHERE uid = ? AND endpoint = ?").bind(auth.uid, endpoint).run();
    if (result.meta.changes === 0) return json({ error: "not found" }, 404);
    return new Response(null, { status: 204 });
  }

  const sub = parseSubscription(body.value);
  if (sub === null) return json({ error: "invalid body" }, 400);
  const now = (options?.now ?? new Date()).toISOString();
  // 같은 브라우저 구독이 다른 uid로 다시 오면(로그인 바뀜) 마지막 uid가 가져간다
  await db
    .prepare(
      `INSERT INTO push_subscriptions (endpoint, uid, p256dh, auth, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(endpoint) DO UPDATE SET uid = excluded.uid, p256dh = excluded.p256dh, auth = excluded.auth, updated_at = excluded.updated_at`,
    )
    .bind(sub.endpoint, auth.uid, sub.p256dh, sub.auth, now, now)
    .run();
  return json({ ok: true });
}

const ROUTE_ID_RE = /^[A-Za-z0-9_-]{1,32}$/;
const BUS_TYPES = ["express", "trunk", "branch", "village", "outer", "wide", "circular"];
const MAX_LEGS = 12;

function parseLatLng(value: unknown): { lat: number; lng: number } | null {
  if (!isRecord(value) || !isNumberIn(value.lat, -90, 90) || !isNumberIn(value.lng, -180, 180)) return null;
  return { lat: value.lat, lng: value.lng };
}

function parseStop(value: unknown): PlannedStop | null {
  if (!isRecord(value) || !isText(value.name, 100)) return null;
  const position = parseLatLng(value.position);
  const { nodeId, arsId } = value;
  if (position === null) return null;
  if (nodeId !== null && !(typeof nodeId === "string" && isStopId(nodeId))) return null;
  if (arsId !== null && !isText(arsId, 16)) return null;
  return { name: value.name, position, nodeId, arsId };
}

// 지도 좌표열(path)은 다시 계산에 필요 없어 버린다
function parseLeg(value: unknown): PlannedLeg | null {
  if (!isRecord(value) || !isNumberIn(value.seconds, 0, 6 * 3600) || !isNumberIn(value.distanceM, 0, 200_000)) return null;
  if (value.kind === "walk") {
    if (!isText(value.from, 100) || !isText(value.to, 100)) return null;
    return { kind: "walk", seconds: value.seconds, distanceM: value.distanceM, from: value.from, to: value.to, path: [] };
  }
  if (value.kind !== "bus") return null;
  const { routeNos, busType, stopCount } = value;
  if (!Array.isArray(routeNos) || routeNos.length === 0 || routeNos.length > 10) return null;
  if (!routeNos.every((no) => isText(no, 16) && no.length > 0)) return null;
  if (typeof busType !== "string" || !BUS_TYPES.includes(busType)) return null;
  if (!Number.isInteger(stopCount) || !isNumberIn(stopCount, 0, 200)) return null;
  const board = parseStop(value.board);
  const alight = parseStop(value.alight);
  if (board === null || alight === null) return null;
  return {
    kind: "bus",
    routeNos: routeNos as string[],
    busType: busType as Extract<PlannedLeg, { kind: "bus" }>["busType"],
    seconds: value.seconds,
    distanceM: value.distanceM,
    stopCount: stopCount as number,
    board,
    alight,
    path: [],
  };
}

function parsePlan(value: unknown): PlannedRoute | null {
  if (!isRecord(value) || typeof value.id !== "string" || !ROUTE_ID_RE.test(value.id)) return null;
  const { fare, transferCount, totalSeconds, legs } = value;
  if (!isNumberIn(fare, 0, 100_000) || !Number.isInteger(transferCount) || !isNumberIn(transferCount, 0, 10)) return null;
  if (!isNumberIn(totalSeconds, 0, 12 * 3600)) return null;
  if (!Array.isArray(legs) || legs.length === 0 || legs.length > MAX_LEGS) return null;
  const parsed = legs.map(parseLeg);
  if (parsed.some((leg) => leg === null)) return null;
  return { id: value.id, fare, transferCount: transferCount as number, totalSeconds, legs: parsed as PlannedLeg[] };
}

export interface AlertInput {
  routeId: string;
  pairQuery: string;
  plan: PlannedRoute;
}

export type AlertInputError = "invalid body" | "no live stop";

export function parseAlertInput(body: unknown): AlertInput | AlertInputError {
  if (!isRecord(body)) return "invalid body";
  const { routeId, pairQuery } = body;
  if (typeof routeId !== "string" || !ROUTE_ID_RE.test(routeId)) return "invalid body";
  if (!isText(pairQuery, 600) || pairQuery.startsWith("?")) return "invalid body";
  const params = new URLSearchParams(pairQuery);
  if (!params.get("from") || !params.get("to")) return "invalid body";
  const plan = parsePlan(body.plan);
  if (plan === null || plan.id !== routeId) return "invalid body";
  const firstBus = plan.legs.find((leg) => leg.kind === "bus");
  if (firstBus?.kind !== "bus" || firstBus.board.nodeId === null) return "no live stop";
  return { routeId, pairQuery, plan };
}

export const routeDetailUrl = (routeId: string, pairQuery: string) => `/routes/${encodeURIComponent(routeId)}?${pairQuery}`;

async function listAlerts(db: D1Database, uid: string): Promise<Response> {
  const { results } = await db
    .prepare(`SELECT ${ALERT_COLUMNS} FROM alerts WHERE uid = ? AND status = 'pending' ORDER BY created_at DESC, id ASC`)
    .bind(uid)
    .all<AlertRow>();
  return json({ alerts: results.map(toAlert) });
}

async function createAlert(request: Request, db: D1Database, scheduler: AlertScheduler, uid: string, now: Date): Promise<Response> {
  const body = await readJson(request, ALERT_MAX_BODY_BYTES);
  if (!body.ok) return body.response;
  const input = parseAlertInput(body.value);
  if (typeof input === "string") return json({ error: input }, 400);

  const existing = await db
    .prepare(`SELECT ${ALERT_COLUMNS} FROM alerts WHERE uid = ? AND route_id = ? AND pair_query = ? AND status = 'pending'`)
    .bind(uid, input.routeId, input.pairQuery)
    .first<AlertRow>();
  if (existing !== null) return json({ alert: toAlert(existing) });

  const hasSubscription = await db.prepare("SELECT 1 FROM push_subscriptions WHERE uid = ? LIMIT 1").bind(uid).first();
  if (hasSubscription === null) return json({ error: "no subscription" }, 409);

  const legs = input.plan.legs;
  const firstBus = legs.findIndex((leg) => leg.kind === "bus");
  const busLeg = legs[firstBus];
  if (busLeg.kind !== "bus" || busLeg.board.nodeId === null) return json({ error: "no live stop" }, 400);
  const walkBeforeSec = legs.slice(0, firstBus).reduce((sum, leg) => sum + leg.seconds, 0);
  const id = crypto.randomUUID();
  const at = now.toISOString();

  // 한도 검사와 삽입을 한 문장으로 해 동시 요청에도 한도를 넘지 않는다
  const inserted = await db
    .prepare(
      `INSERT INTO alerts (id, uid, route_id, pair_query, board_node_id, route_no, walk_before_sec, plan_json, notify_before_min, status, created_at, updated_at)
       SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?
       WHERE (SELECT COUNT(*) FROM alerts WHERE uid = ? AND status = 'pending') < ?`,
    )
    .bind(
      id,
      uid,
      input.routeId,
      input.pairQuery,
      busLeg.board.nodeId,
      busLeg.routeNos[0],
      Math.round(walkBeforeSec),
      JSON.stringify(input.plan),
      NOTIFY_BEFORE_MIN,
      at,
      at,
      uid,
      ALERTS_PENDING_LIMIT,
    )
    .run();
  if (inserted.meta.changes === 0) return json({ error: "alerts limit reached", limit: ALERTS_PENDING_LIMIT }, 409);

  try {
    await scheduler.schedule(id);
  } catch (err) {
    console.error("alert schedule failed:", err instanceof Error ? err.message : "unknown");
    await db
      .prepare("UPDATE alerts SET status = 'failed', fail_reason = 'schedule', updated_at = ? WHERE id = ? AND uid = ?")
      .bind(at, id, uid)
      .run();
    return json({ error: "scheduler unavailable" }, 503);
  }

  const row = await db.prepare(`SELECT ${ALERT_COLUMNS} FROM alerts WHERE id = ? AND uid = ?`).bind(id, uid).first<AlertRow>();
  if (row === null) throw new Error("alert missing after insert");
  return json({ alert: toAlert(row) }, 201);
}

async function cancelAlert(db: D1Database, scheduler: AlertScheduler, uid: string, id: string, now: Date): Promise<Response> {
  const result = await db
    .prepare("UPDATE alerts SET status = 'cancelled', updated_at = ? WHERE id = ? AND uid = ? AND status = 'pending'")
    .bind(now.toISOString(), id, uid)
    .run();
  if (result.meta.changes === 0) return json({ error: "not found" }, 404);
  await scheduler.cancel(id);
  return new Response(null, { status: 204 });
}

const ALERT_ID_RE = /^[0-9a-f-]{36}$/;

export async function handleAlerts(
  request: Request,
  db: D1Database,
  scheduler: AlertScheduler,
  projectIds: readonly string[],
  options?: VerifyOptions,
): Promise<Response> {
  const { pathname } = new URL(request.url);
  const isCollection = pathname === "/alerts";
  const segment = isCollection ? "" : pathname.slice("/alerts/".length);
  if (!isCollection && (!pathname.startsWith("/alerts/") || segment.includes("/"))) return json({ error: "not found" }, 404);

  const allowed = isCollection ? ["GET", "POST"] : ["DELETE"];
  if (!allowed.includes(request.method)) return json({ error: "method not allowed" }, 405);

  const auth = await requireUid(request, projectIds, options);
  if (!auth.ok) return auth.response;
  const now = options?.now ?? new Date();

  if (isCollection) {
    return request.method === "GET" ? listAlerts(db, auth.uid) : createAlert(request, db, scheduler, auth.uid, now);
  }
  if (!ALERT_ID_RE.test(segment)) return json({ error: "invalid alert id" }, 400);
  return cancelAlert(db, scheduler, auth.uid, segment, now);
}
