import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { sendToUser, type PushPayload } from "../src/push";
import { createTestD1 } from "./d1-sqlite";

const b64url = (bytes: ArrayBuffer | Uint8Array) => Buffer.from(bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes)).toString("base64url");
const payload: PushPayload = { title: "t", body: "b", tag: "alert-1", url: "/routes/l0?from=1,2&to=3,4" };

let vapid: { subject: string; publicKey: string; privateKey: string };
let clientKey: string;
let db: D1Database;

async function p256() {
  const pair = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]);
  return { raw: b64url(await crypto.subtle.exportKey("raw", pair.publicKey)), d: (await crypto.subtle.exportKey("jwk", pair.privateKey)).d! };
}

beforeAll(async () => {
  const server = await p256();
  vapid = { subject: "https://jigeumini.test", publicKey: server.raw, privateKey: server.d };
  clientKey = (await p256()).raw;
});

beforeEach(() => {
  db = createTestD1();
});

async function addSubscription(uid: string, endpoint: string) {
  const auth = b64url(crypto.getRandomValues(new Uint8Array(16)));
  await db
    .prepare("INSERT INTO push_subscriptions (endpoint, uid, p256dh, auth, created_at, updated_at) VALUES (?, ?, ?, ?, 'x', 'x')")
    .bind(endpoint, uid, clientKey, auth)
    .run();
}

const endpoints = async () =>
  (await db.prepare("SELECT uid, endpoint FROM push_subscriptions ORDER BY endpoint").all<{ uid: string; endpoint: string }>()).results;

describe("sendToUser", () => {
  it("sends an encrypted VAPID request to each of the user's subscriptions", async () => {
    await addSubscription("a", "https://push.test/a1");
    await addSubscription("b", "https://push.test/b1");
    const fetchMock = vi.fn(async () => new Response(null, { status: 201 }));
    const result = await sendToUser(db, "a", payload, vapid, fetchMock as unknown as typeof fetch);
    expect(result).toEqual({ sent: 1, removed: 0, failed: 0 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, { headers: Record<string, string>; method: string }];
    expect(url).toBe("https://push.test/a1");
    expect(init.method).toBe("post");
    expect(init.headers["content-encoding"]).toBe("aes128gcm");
    expect(init.headers.authorization).toMatch(/^vapid t=.+, k=/);
  });

  it.each([404, 410])("deletes only the gone subscription on %i", async (status) => {
    await addSubscription("a", "https://push.test/a1");
    await addSubscription("a", "https://push.test/a2");
    await addSubscription("b", "https://push.test/b1");
    const fetchMock = vi.fn(async (url: string) => new Response(null, { status: url.endsWith("a1") ? status : 201 }));
    const result = await sendToUser(db, "a", payload, vapid, fetchMock as unknown as typeof fetch);
    expect(result).toEqual({ sent: 1, removed: 1, failed: 0 });
    expect(await endpoints()).toEqual([
      { uid: "a", endpoint: "https://push.test/a2" },
      { uid: "b", endpoint: "https://push.test/b1" },
    ]);
  });

  it("keeps the subscription on other push service errors", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    await addSubscription("a", "https://push.test/a1");
    const fetchMock = vi.fn(async () => new Response(null, { status: 500 }));
    expect(await sendToUser(db, "a", payload, vapid, fetchMock as unknown as typeof fetch)).toEqual({ sent: 0, removed: 0, failed: 1 });
    expect(await endpoints()).toHaveLength(1);
  });
});
