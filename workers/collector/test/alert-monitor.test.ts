import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { AlertMonitor, failurePayload } from "../src/alert-monitor";
import { MAX_LIFETIME_MS, MAX_MISSES } from "../src/alert-schedule";
import type { Env } from "../src/env";
import { createTestD1 } from "./d1-sqlite";
import { MIN, serviceResult } from "./helpers";

const b64url = (bytes: ArrayBuffer | Uint8Array) => Buffer.from(bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes)).toString("base64url");
const ALERT_ID = "00000000-0000-4000-8000-000000000001";
const UID = "user-a";
const PAIR = "from=1,2&to=3,4";
const ENDPOINT = "https://push.test/a1";
const POS = { lat: 36.35, lng: 127.38 };
const plan = {
  id: "l0",
  fare: 1500,
  transferCount: 0,
  totalSeconds: 1800,
  legs: [
    { kind: "walk", seconds: 300, distanceM: 300, from: "출발", to: "둔산경찰서", path: [] },
    {
      kind: "bus",
      routeNos: ["318"],
      busType: "branch",
      seconds: 1200,
      distanceM: 6000,
      stopCount: 8,
      board: { name: "둔산경찰서", position: POS, nodeId: "8001318", arsId: "12345" },
      alight: { name: "대전역", position: POS, nodeId: "8001999", arsId: "54321" },
      path: [],
    },
  ],
};

let vapid: { VAPID_SUBJECT: string; VAPID_PUBLIC_KEY: string; VAPID_PRIVATE_KEY: string };
let clientKey: string;
let db: D1Database;
let pushCalls: number;
let pushStatus: number;
let arrivalsXml: string;
let arrivalsStatus: number;

async function p256() {
  const pair = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]);
  return { raw: b64url(await crypto.subtle.exportKey("raw", pair.publicKey)), d: (await crypto.subtle.exportKey("jwk", pair.privateKey)).d! };
}

beforeAll(async () => {
  const server = await p256();
  vapid = { VAPID_SUBJECT: "https://jigeumini.test", VAPID_PUBLIC_KEY: server.raw, VAPID_PRIVATE_KEY: server.d };
  clientKey = (await p256()).raw;
});

beforeEach(async () => {
  db = createTestD1();
  pushCalls = 0;
  pushStatus = 201;
  arrivalsXml = serviceResult();
  arrivalsStatus = 200;
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input instanceof Request ? input.url : input);
      if (url.startsWith("https://push.test/")) {
        pushCalls += 1;
        return new Response(null, { status: pushStatus });
      }
      return new Response(arrivalsXml, { status: arrivalsStatus });
    }),
  );
  await db
    .prepare("INSERT INTO push_subscriptions (endpoint, uid, p256dh, auth, created_at, updated_at) VALUES (?, ?, ?, ?, 'x', 'x')")
    .bind(ENDPOINT, UID, clientKey, b64url(crypto.getRandomValues(new Uint8Array(16))))
    .run();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

async function insertAlert(createdAtMs: number, status = "pending", failReason: string | null = null) {
  const at = new Date(createdAtMs).toISOString();
  await db
    .prepare(
      `INSERT INTO alerts (id, uid, route_id, pair_query, board_node_id, route_no, walk_before_sec, plan_json, notify_before_min, status, fail_reason, created_at, updated_at)
       VALUES (?, ?, 'l0', ?, '8001318', '318', 300, ?, 2, ?, ?, ?, ?)`,
    )
    .bind(ALERT_ID, UID, PAIR, JSON.stringify(plan), status, failReason, at, at)
    .run();
}

function fakeStorage(initial: Record<string, unknown>) {
  const data = new Map(Object.entries(initial));
  return {
    get: async (key: string) => data.get(key),
    put: async (key: string | Record<string, unknown>, value?: unknown) => {
      if (typeof key === "string") data.set(key, value);
      else for (const [k, v] of Object.entries(key)) data.set(k, v);
    },
    deleteAll: async () => data.clear(),
    setAlarm: async () => {},
    deleteAlarm: async () => {},
  };
}

function monitor(storage: ReturnType<typeof fakeStorage>) {
  const env = { DB: db, DATA_GO_KR_KEY: "key", ...vapid } as unknown as Env;
  return new AlertMonitor({ storage } as unknown as DurableObjectState, env);
}

const alertRow = () => db.prepare("SELECT status, fail_reason FROM alerts WHERE id = ?").bind(ALERT_ID).first<{ status: string; fail_reason: string | null }>();

describe("AlertMonitor failure push", () => {
  it("sends one failure push when no bus is found MAX_MISSES times in a row", async () => {
    await insertAlert(Date.now());
    await monitor(fakeStorage({ alertId: ALERT_ID, misses: MAX_MISSES - 1 })).alarm();
    expect(await alertRow()).toEqual({ status: "failed", fail_reason: "no_bus" });
    expect(pushCalls).toBe(1);
  });

  it("sends one failure push when the alert outlives MAX_LIFETIME_MS", async () => {
    await insertAlert(Date.now() - MAX_LIFETIME_MS - MIN);
    await monitor(fakeStorage({ alertId: ALERT_ID, misses: 0 })).alarm();
    expect(await alertRow()).toEqual({ status: "failed", fail_reason: "expired" });
    expect(pushCalls).toBe(1);
  });

  it("does not retry with a failure push when the departure push itself failed", async () => {
    pushStatus = 500;
    // 걷기 5분 + 기본 여유 2분 + 알림 2분 전: 9분 뒤 버스면 지금 보낼 시각이다
    arrivalsXml = serviceResult({ route: "318", plate: "P1", msg: "03", sec: 9 * 60, pos: 3 });
    await insertAlert(Date.now());
    await monitor(fakeStorage({ alertId: ALERT_ID, misses: 0 })).alarm();
    expect(await alertRow()).toEqual({ status: "failed", fail_reason: "push" });
    expect(pushCalls).toBe(1);
  });

  it("sends nothing for an alert that already failed at scheduling", async () => {
    await insertAlert(Date.now(), "failed", "schedule");
    await monitor(fakeStorage({ alertId: ALERT_ID, misses: MAX_MISSES - 1 })).alarm();
    expect(await alertRow()).toEqual({ status: "failed", fail_reason: "schedule" });
    expect(pushCalls).toBe(0);
  });

  it("sends one push when the DO wakes twice for the same failure", async () => {
    await insertAlert(Date.now());
    const storage = fakeStorage({ alertId: ALERT_ID, misses: MAX_MISSES - 1 });
    await Promise.all([monitor(storage).alarm(), monitor(storage).alarm()]);
    await monitor(storage).alarm();
    expect(await alertRow()).toEqual({ status: "failed", fail_reason: "no_bus" });
    expect(pushCalls).toBe(1);
  });

  it("fails as api_error when every miss was an arrivals API failure", async () => {
    arrivalsStatus = 500;
    await insertAlert(Date.now());
    await monitor(fakeStorage({ alertId: ALERT_ID, misses: MAX_MISSES - 1, apiMisses: MAX_MISSES - 1 })).alarm();
    expect(await alertRow()).toEqual({ status: "failed", fail_reason: "api_error" });
    expect(pushCalls).toBe(1);
  });

  it("stays no_bus when at least one miss had working arrivals", async () => {
    arrivalsStatus = 500;
    await insertAlert(Date.now());
    await monitor(fakeStorage({ alertId: ALERT_ID, misses: MAX_MISSES - 1, apiMisses: MAX_MISSES - 2 })).alarm();
    expect(await alertRow()).toEqual({ status: "failed", fail_reason: "no_bus" });
    expect(pushCalls).toBe(1);
  });

  it("counts arrivals API failures across wakes", async () => {
    arrivalsStatus = 500;
    await insertAlert(Date.now());
    const storage = fakeStorage({ alertId: ALERT_ID, misses: 0 });
    for (let i = 0; i < MAX_MISSES - 1; i++) await monitor(storage).alarm();
    expect(await storage.get("apiMisses")).toBe(MAX_MISSES - 1);
    await monitor(storage).alarm();
    expect(await alertRow()).toEqual({ status: "failed", fail_reason: "api_error" });
  });

  it("keeps the original reason when the failure push fails", async () => {
    pushStatus = 500;
    await insertAlert(Date.now());
    await monitor(fakeStorage({ alertId: ALERT_ID, misses: MAX_MISSES - 1 })).alarm();
    expect(await alertRow()).toEqual({ status: "failed", fail_reason: "no_bus" });
    expect(pushCalls).toBe(1);
  });
});

describe("failurePayload", () => {
  it("opens the route detail like a success push and carries no ack", () => {
    expect(failurePayload("a1", "l0", PAIR, "318", "no_bus")).toEqual({
      title: "출발 알림을 보내지 못했어요",
      body: "318번 버스 도착 정보를 찾지 못했어요. 경로를 다시 확인해 주세요.",
      tag: "alert-failed-a1",
      url: "/routes/l0?from=1,2&to=3,4",
    });
    expect(failurePayload("a1", "l0", PAIR, "318", "expired").body).toBe(
      "알림을 켠 지 3시간이 지나 318번 출발 알림을 끝냈어요. 필요하면 다시 켜 주세요.",
    );
    expect(failurePayload("a1", "l0", PAIR, "318", "api_error").body).toBe(
      "실시간 도착 정보를 받지 못해 318번 출발 알림을 끝냈어요. 잠시 후 다시 켜 주세요.",
    );
  });
});
