import { beforeEach, describe, expect, it, vi } from "vitest";
import { ackToken, handleAlertAck } from "../src/alert-ack";
import type { AlertScheduler } from "../src/alerts";
import { createTestD1 } from "./d1-sqlite";

const SECRET = "test-vapid-private-key";
const A = "user-a";
const B = "user-b";
const ID1 = "11111111-1111-4111-8111-111111111111";
const ID2 = "22222222-2222-4222-8222-222222222222";
const EP_A = "https://push.test/a";
const EP_A2 = "https://push.test/a2";
const AT = "2026-01-01T00:00:00.000Z";

let db: D1Database;
let scheduler: AlertScheduler & { cancel: ReturnType<typeof vi.fn> };

async function insertAlert(id: string, uid: string, status: string) {
  await db
    .prepare(
      `INSERT INTO alerts (id, uid, route_id, pair_query, board_node_id, route_no, walk_before_sec, plan_json, notify_before_min, status, created_at, updated_at)
       VALUES (?, ?, 'l0', 'from=1,2&to=3,4', '8001318', '318', 0, '{}', 2, ?, ?, ?)`,
    )
    .bind(id, uid, status, AT, AT)
    .run();
}

async function insertSubscription(endpoint: string, uid: string) {
  await db
    .prepare("INSERT INTO push_subscriptions (endpoint, uid, p256dh, auth, created_at, updated_at) VALUES (?, ?, 'p', 'a', ?, ?)")
    .bind(endpoint, uid, AT, AT)
    .run();
}

const count = async (sql: string, ...values: unknown[]) =>
  (await db.prepare(sql).bind(...values).first<{ n: number }>())!.n;

const ack = (id: string, body: unknown, method = "POST", secret = SECRET) =>
  handleAlertAck(
    new Request(`https://w.test/alerts/${id}/ack`, {
      method,
      headers: { "Content-Type": "application/json" },
      body: method === "POST" ? JSON.stringify(body) : undefined,
    }),
    db,
    scheduler,
    secret,
  );

beforeEach(async () => {
  db = createTestD1();
  scheduler = { schedule: vi.fn(async () => {}), cancel: vi.fn(async () => {}) };
  await insertSubscription(EP_A, A);
  await insertSubscription(EP_A2, A);
  await insertSubscription("https://push.test/b", B);
});

describe("POST /alerts/:id/ack", () => {
  it("rejects a bad token, a token for another uid, and another alert's token with 403", async () => {
    await insertAlert(ID1, A, "sent");
    const forB = await ackToken(SECRET, ID1, B);
    const forOther = await ackToken(SECRET, ID2, A);
    const wrongKey = await ackToken("other-secret", ID1, A);
    for (const token of ["x".repeat(43), forB, forOther, wrongKey]) {
      expect((await ack(ID1, { uid: A, token, endpoint: EP_A })).status).toBe(403);
    }
    expect((await ack(ID1, { uid: B, token: forB, endpoint: EP_A })).status).toBe(200);
    expect(await count("SELECT COUNT(*) AS n FROM alerts WHERE id = ?", ID1)).toBe(1);
    expect(await count("SELECT COUNT(*) AS n FROM push_subscriptions WHERE uid = ?", A)).toBe(2);
  });

  it("deletes the acked alert row whatever its status", async () => {
    await insertAlert(ID1, A, "sent");
    await insertAlert(ID2, A, "pending");
    const res = await ack(ID1, { uid: A, token: await ackToken(SECRET, ID1, A), endpoint: null });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ deleted: true, subscriptionRemoved: false });
    expect(await count("SELECT COUNT(*) AS n FROM alerts WHERE id = ?", ID1)).toBe(0);
    expect(scheduler.cancel).not.toHaveBeenCalled();

    const pendingAck = await ack(ID2, { uid: A, token: await ackToken(SECRET, ID2, A), endpoint: null });
    expect(await pendingAck.json()).toEqual({ deleted: true, subscriptionRemoved: false });
    expect(scheduler.cancel).toHaveBeenCalledWith(ID2);
  });

  it("removes only this device's subscription when the last alert is acked", async () => {
    await insertAlert(ID1, A, "sent");
    const token = await ackToken(SECRET, ID1, A);
    const res = await ack(ID1, { uid: A, token, endpoint: EP_A });
    expect(await res.json()).toEqual({ deleted: true, subscriptionRemoved: true });
    const rows = (await db.prepare("SELECT endpoint FROM push_subscriptions ORDER BY endpoint").all<{ endpoint: string }>()).results;
    expect(rows.map((r) => r.endpoint)).toEqual([EP_A2, "https://push.test/b"]);

    const again = await ack(ID1, { uid: A, token, endpoint: EP_A });
    expect(await again.json()).toEqual({ deleted: false, subscriptionRemoved: false });
  });

  it("keeps the subscription while the uid has other pending alerts", async () => {
    await insertAlert(ID1, A, "sent");
    await insertAlert(ID2, A, "pending");
    const res = await ack(ID1, { uid: A, token: await ackToken(SECRET, ID1, A), endpoint: EP_A });
    expect(await res.json()).toEqual({ deleted: true, subscriptionRemoved: false });
    expect(await count("SELECT COUNT(*) AS n FROM push_subscriptions WHERE endpoint = ?", EP_A)).toBe(1);
  });

  it("rejects malformed bodies, wrong methods, and a missing secret", async () => {
    await insertAlert(ID1, A, "sent");
    const token = await ackToken(SECRET, ID1, A);
    expect((await ack(ID1, { uid: A, token, endpoint: "http://push.test/a" })).status).toBe(400);
    expect((await ack(ID1, { token })).status).toBe(400);
    expect((await ack(ID1, undefined, "GET")).status).toBe(405);
    expect((await ack(ID1, { uid: A, token, endpoint: null }, "POST", "")).status).toBe(503);
    expect(await count("SELECT COUNT(*) AS n FROM alerts WHERE id = ?", ID1)).toBe(1);
  });
});
