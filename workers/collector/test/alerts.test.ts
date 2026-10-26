import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT, type CryptoKey, type JWK } from "jose";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { ALERTS_PENDING_LIMIT, handleAlerts, handlePushSubscription, type AlertScheduler } from "../src/alerts";
import type { KeySet } from "../src/auth";
import { createTestD1 } from "./d1-sqlite";

const PROJECT = "test-project";
const NOW = new Date("2026-01-01T00:00:00Z");
const NOW_SEC = Math.floor(NOW.getTime() / 1000);
const A = "user-a";
const B = "user-b";
const PAIR = "from=36.39007,127.362274&fromName=a&to=36.35272,127.37907&toName=b";
const POS = { lat: 36.35, lng: 127.38 };
const P256DH = "B".repeat(87);
const AUTH = "abcdefghijklmnopqrstuv";

let privateKey: CryptoKey;
let keys: KeySet;
let tokens: Record<string, string>;
let db: D1Database;
let scheduler: AlertScheduler & { schedule: ReturnType<typeof vi.fn>; cancel: ReturnType<typeof vi.fn> };

beforeAll(async () => {
  const pair = await generateKeyPair("RS256");
  privateKey = pair.privateKey as CryptoKey;
  const jwk: JWK = { ...(await exportJWK(pair.publicKey)), kid: "k1", alg: "RS256", use: "sig" };
  keys = createLocalJWKSet({ keys: [jwk] });
  tokens = { [A]: await sign(A), [B]: await sign(B) };
});

beforeEach(() => {
  db = createTestD1();
  scheduler = { schedule: vi.fn(async () => {}), cancel: vi.fn(async () => {}) };
});

function sign(uid: string): Promise<string> {
  return new SignJWT({ auth_time: NOW_SEC - 10 })
    .setProtectedHeader({ alg: "RS256", kid: "k1" })
    .setIssuer(`https://securetoken.google.com/${PROJECT}`)
    .setAudience(PROJECT)
    .setSubject(uid)
    .setIssuedAt(NOW_SEC - 10)
    .setExpirationTime(NOW_SEC + 3600)
    .sign(privateKey);
}

function request(path: string, method: string, uid?: string, body?: unknown) {
  const headers: Record<string, string> = {};
  if (uid) headers.Authorization = `Bearer ${tokens[uid]}`;
  if (body !== undefined) headers["Content-Type"] = "application/json";
  return new Request(`https://w.test${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
}

const sub = (uid: string, method: string, body: unknown) =>
  handlePushSubscription(request("/push/subscription", method, uid, body), db, [PROJECT], { keys, now: NOW });
const alerts = (path: string, method: string, uid?: string, body?: unknown) =>
  handleAlerts(request(path, method, uid, body), db, scheduler, [PROJECT], { keys, now: NOW });

const subscription = (endpoint = "https://fcm.googleapis.com/fcm/send/abc") => ({ endpoint, expirationTime: null, keys: { p256dh: P256DH, auth: AUTH } });

const plan = (id = "l0", boardNodeId: string | null = "8001318") => ({
  id,
  fare: 1500,
  transferCount: 0,
  totalSeconds: 1500,
  legs: [
    { kind: "walk", seconds: 300, distanceM: 300, from: "출발", to: "둔산경찰서", path: [POS, POS] },
    {
      kind: "bus",
      routeNos: ["318"],
      busType: "branch",
      seconds: 1200,
      distanceM: 6000,
      stopCount: 8,
      board: { name: "둔산경찰서", position: POS, nodeId: boardNodeId, arsId: "12345" },
      alight: { name: "대전역", position: POS, nodeId: null, arsId: null },
      path: [],
    },
  ],
});
const alertBody = (id = "l0", overrides: Record<string, unknown> = {}) => ({ routeId: id, pairQuery: PAIR, plan: plan(id), ...overrides });

async function createFor(uid: string, id = "l0") {
  const res = await alerts("/alerts", "POST", uid, alertBody(id));
  return { res, alert: ((await res.json()) as { alert: { id: string } }).alert };
}

describe("PUT/DELETE /push/subscription", () => {
  it("requires a token", async () => {
    const res = await handlePushSubscription(request("/push/subscription", "PUT", undefined, subscription()), db, [PROJECT], { keys, now: NOW });
    expect(res.status).toBe(401);
  });

  it.each([
    ["http endpoint", { ...subscription("http://push.test/x") }],
    ["missing keys", { endpoint: "https://push.test/x" }],
    ["bad p256dh", { endpoint: "https://push.test/x", keys: { p256dh: "short", auth: AUTH } }],
    ["array", []],
  ])("rejects %s with 400", async (_name, body) => {
    expect((await sub(A, "PUT", body)).status).toBe(400);
  });

  it("upserts by endpoint and moves it to the latest uid", async () => {
    expect((await sub(A, "PUT", subscription())).status).toBe(200);
    expect((await sub(A, "PUT", subscription())).status).toBe(200);
    expect((await sub(B, "PUT", subscription())).status).toBe(200);
    const rows = (await db.prepare("SELECT uid FROM push_subscriptions").all<{ uid: string }>()).results;
    expect(rows).toEqual([{ uid: B }]);
  });

  it("DELETE is scoped to the caller", async () => {
    await sub(A, "PUT", subscription());
    expect((await sub(B, "DELETE", { endpoint: subscription().endpoint })).status).toBe(404);
    expect((await sub(A, "DELETE", { endpoint: subscription().endpoint })).status).toBe(204);
  });
});

describe("/alerts", () => {
  beforeEach(async () => {
    await sub(A, "PUT", subscription("https://push.test/a"));
    await sub(B, "PUT", subscription("https://push.test/b"));
  });

  it("POST creates a pending alert, strips map paths, and schedules it", async () => {
    const { res, alert } = await createFor(A);
    expect(res.status).toBe(201);
    expect(alert).toMatchObject({ routeId: "l0", pairQuery: PAIR, routeNo: "318", busNos: ["318"], boardNodeId: "8001318", status: "pending", leaveByAt: null });
    expect(scheduler.schedule).toHaveBeenCalledWith(alert.id, "https://w.test");
    const row = await db.prepare("SELECT uid, walk_before_sec, notify_before_min, plan_json FROM alerts").first<Record<string, string | number>>();
    expect(row).toMatchObject({ uid: A, walk_before_sec: 300, notify_before_min: 2 });
    expect(JSON.parse(row!.plan_json as string).legs[0].path).toEqual([]);
  });

  it("POST is idempotent for the same route and pair", async () => {
    const first = await createFor(A);
    const second = await createFor(A);
    expect(second.res.status).toBe(200);
    expect(second.alert.id).toBe(first.alert.id);
    expect(scheduler.schedule).toHaveBeenCalledTimes(1);
  });

  it.each([
    ["routeId mismatch", alertBody("l0", { routeId: "l1" })],
    ["pairQuery without from/to", alertBody("l0", { pairQuery: "x=1" })],
    ["leading ?", alertBody("l0", { pairQuery: `?${PAIR}` })],
    ["bad leg kind", alertBody("l0", { plan: { ...plan(), legs: [{ kind: "taxi", seconds: 1, distanceM: 1 }] } })],
    ["not an object", "nope"],
  ])("POST rejects %s with 400 invalid body", async (_name, body) => {
    const res = await alerts("/alerts", "POST", A, body);
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "invalid body" });
  });

  it("POST accepts a Seoul board stop id (seoul:<ARS>)", async () => {
    const res = await alerts("/alerts", "POST", A, alertBody("l0", { plan: plan("l0", "seoul:02004") }));
    expect(res.status).toBe(201);
    expect(((await res.json()) as { alert: { boardNodeId: string } }).alert.boardNodeId).toBe("seoul:02004");
  });

  it("POST rejects an unknown board stop id format", async () => {
    const res = await alerts("/alerts", "POST", A, alertBody("l0", { plan: plan("l0", "busan:12345") }));
    expect(await res.json()).toEqual({ error: "invalid body" });
  });

  it("POST rejects a route whose first stop has no live id", async () => {
    const res = await alerts("/alerts", "POST", A, alertBody("l0", { plan: plan("l0", null) }));
    expect(await res.json()).toEqual({ error: "no live stop" });
  });

  it("POST without a push subscription -> 409", async () => {
    await sub(A, "DELETE", { endpoint: "https://push.test/a" });
    const res = await alerts("/alerts", "POST", A, alertBody());
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: "no subscription" });
  });

  it("POST beyond the pending limit -> 409", async () => {
    for (let i = 0; i < ALERTS_PENDING_LIMIT; i++) expect((await createFor(A, `l${i}`)).res.status).toBe(201);
    const res = await alerts("/alerts", "POST", A, alertBody("l9"));
    expect(res.status).toBe(409);
  });

  it("GET lists only the caller's pending alerts", async () => {
    const a = await createFor(A, "l0");
    await createFor(B, "l1");
    const res = await alerts("/alerts", "GET", A);
    const body = (await res.json()) as { alerts: { id: string }[] };
    expect(body.alerts.map((x) => x.id)).toEqual([a.alert.id]);
  });

  it("DELETE by another uid -> 404 and the alert stays scheduled", async () => {
    const { alert } = await createFor(A);
    expect((await alerts(`/alerts/${alert.id}`, "DELETE", B)).status).toBe(404);
    expect(scheduler.cancel).not.toHaveBeenCalled();
    expect((await alerts(`/alerts/${alert.id}`, "DELETE", A)).status).toBe(204);
    expect(scheduler.cancel).toHaveBeenCalledWith(alert.id);
    const list = (await (await alerts("/alerts", "GET", A)).json()) as { alerts: unknown[] };
    expect(list.alerts).toEqual([]);
  });

  it("rejects malformed ids and wrong methods", async () => {
    expect((await alerts("/alerts/not-an-id", "DELETE", A)).status).toBe(400);
    expect((await alerts("/alerts", "DELETE", A)).status).toBe(405);
    expect((await alerts("/alerts/x/y", "DELETE", A)).status).toBe(404);
  });
});
