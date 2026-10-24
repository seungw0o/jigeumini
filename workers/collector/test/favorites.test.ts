import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT, type JWK, type CryptoKey } from "jose";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { KeySet } from "../src/auth";
import { FAVORITES_LIMIT, handleFavorites, MAX_BODY_BYTES } from "../src/favorites";
import { createTestD1 } from "./d1-sqlite";

const PROJECT = "test-project";
const NOW = new Date("2026-01-01T00:00:00Z");
const NOW_SEC = Math.floor(NOW.getTime() / 1000);
const A = "user-a";
const B = "user-b";
// now는 토큰 검증 시각에도 쓰이므로 토큰 유효 기간(1시간) 안에서만 움직인다
const at = (sec: number) => new Date(NOW.getTime() + sec * 1000);

let privateKey: CryptoKey;
let keys: KeySet;
let tokens: Record<string, string>;
let db: D1Database;

beforeAll(async () => {
  const pair = await generateKeyPair("RS256");
  privateKey = pair.privateKey as CryptoKey;
  const jwk: JWK = { ...(await exportJWK(pair.publicKey)), kid: "k1", alg: "RS256", use: "sig" };
  keys = createLocalJWKSet({ keys: [jwk] });
  tokens = { [A]: await sign(A), [B]: await sign(B) };
});

beforeEach(() => {
  db = createTestD1();
});

afterEach(() => vi.restoreAllMocks());

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

const body = (overrides: Record<string, unknown> = {}) => ({
  name: "대전역",
  address: "대전 동구 중앙로 215",
  category: "station",
  position: { lat: 36.3323, lng: 127.4342 },
  ...overrides,
});

type CallInit = { method?: string; uid?: string; body?: unknown; raw?: string; headers?: Record<string, string>; now?: Date };

function call(path: string, init: CallInit = {}) {
  const headers: Record<string, string> = { ...init.headers };
  if (init.uid) headers.Authorization = `Bearer ${tokens[init.uid]}`;
  const payload = init.raw ?? (init.body === undefined ? undefined : JSON.stringify(init.body));
  if (payload !== undefined) headers["Content-Type"] = "application/json";
  const request = new Request(`https://w.test${path}`, { method: init.method ?? "GET", headers, body: payload });
  return handleFavorites(request, db, [PROJECT], { keys, now: init.now ?? NOW });
}

const put = (uid: string, id: string, b: unknown = body(), now?: Date) => call(`/favorites/${id}`, { method: "PUT", uid, body: b, now });
const list = async (uid: string) => ((await (await call("/favorites", { uid })).json()) as { favorites: { id: string }[] }).favorites;

describe("handleFavorites auth", () => {
  it("no token -> 401 missing + WWW-Authenticate", async () => {
    const res = await call("/favorites");
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "missing" });
    expect(res.headers.get("WWW-Authenticate")).toBe("Bearer");
  });

  it("key fetch failure -> 503 and token never logged", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const failing: KeySet = () => {
      throw new TypeError("fetch failed");
    };
    const request = new Request("https://w.test/favorites", { headers: { Authorization: `Bearer ${tokens[A]}` } });
    const res = await handleFavorites(request, db, [PROJECT], { keys: failing, now: NOW });
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ error: "auth unavailable" });
    expect(JSON.stringify(spy.mock.calls)).not.toContain(tokens[A]);
  });
});

describe("handleFavorites CRUD", () => {
  it("GET empty list", async () => {
    const res = await call("/favorites", { uid: A });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ favorites: [] });
  });

  it("PUT then GET returns the favorite", async () => {
    const res = await put(A, "kakao:123");
    expect(res.status).toBe(200);
    const expected = {
      id: "kakao:123",
      name: "대전역",
      address: "대전 동구 중앙로 215",
      category: "station",
      position: { lat: 36.3323, lng: 127.4342 },
      createdAt: NOW.toISOString(),
    };
    expect(await res.json()).toEqual({ favorite: expected });
    expect(await list(A)).toEqual([expected]);
  });

  it("lists newest first", async () => {
    await put(A, "old", body(), at(1));
    await put(A, "new", body(), at(3));
    await put(A, "mid", body(), at(2));
    expect((await list(A)).map((f) => f.id)).toEqual(["new", "mid", "old"]);
  });

  it("repeated PUT updates fields and keeps createdAt", async () => {
    await put(A, "p1", body(), at(1));
    const res = await put(A, "p1", body({ name: "  새 이름  ", position: { lat: 1, lng: 2 } }), at(60));
    expect(res.status).toBe(200);
    const { favorite } = (await res.json()) as { favorite: Record<string, unknown> };
    expect(favorite).toMatchObject({ name: "새 이름", position: { lat: 1, lng: 2 }, createdAt: at(1).toISOString() });
    expect(await list(A)).toHaveLength(1);
  });

  it("users cannot see or delete each other's favorites", async () => {
    await put(A, "p1");
    expect(await list(B)).toEqual([]);
    const res = await call("/favorites/p1", { method: "DELETE", uid: B });
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "not found" });
    expect((await list(A)).map((f) => f.id)).toEqual(["p1"]);
  });

  it("DELETE own favorite -> 204 then list empty", async () => {
    await put(A, "p1");
    const res = await call("/favorites/p1", { method: "DELETE", uid: A });
    expect(res.status).toBe(204);
    expect(await res.text()).toBe("");
    expect(await list(A)).toEqual([]);
  });

  it("DELETE missing -> 404", async () => {
    const res = await call("/favorites/nope", { method: "DELETE", uid: A });
    expect(res.status).toBe(404);
  });

  it("enforces the per-user limit", async () => {
    for (let i = 0; i < FAVORITES_LIMIT; i++) expect((await put(A, `p${i}`)).status).toBe(200);
    const over = await put(A, "extra");
    expect(over.status).toBe(409);
    expect(await over.json()).toEqual({ error: "favorites limit reached", limit: 50 });
    expect((await put(A, "p7", body({ name: "바뀜" }))).status).toBe(200);
    expect(await list(A)).toHaveLength(FAVORITES_LIMIT);
    // 다른 사용자의 한도에는 영향이 없다
    expect((await put(B, "extra")).status).toBe(200);
  });
});

describe("handleFavorites validation", () => {
  it("bad JSON -> 400", async () => {
    const res = await call("/favorites/p1", { method: "PUT", uid: A, raw: "{nope" });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "invalid json" });
  });

  it.each([
    ["missing name", body({ name: undefined })],
    ["blank name", body({ name: "   " })],
    ["lat 91", body({ position: { lat: 91, lng: 0 } })],
    ["lng string", body({ position: { lat: 0, lng: "1" } })],
    ["array", []],
  ])("invalid body (%s) -> 400", async (_label, b) => {
    const res = await put(A, "p1", b);
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "invalid body" });
  });

  it.each(["bad%20id", "%E0%A4%A", "a".repeat(65), "%2Fx"])("invalid place id %s -> 400", async (id) => {
    const res = await put(A, id);
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "invalid place id" });
  });

  it("extra path segments -> 404", async () => {
    const res = await call("/favorites/a/b", { method: "PUT", uid: A, body: body() });
    expect(res.status).toBe(404);
  });

  it("oversize body -> 413", async () => {
    const res = await put(A, "p1", body({ address: "x".repeat(MAX_BODY_BYTES) }));
    expect(res.status).toBe(413);
    expect(await res.json()).toEqual({ error: "body too large" });
  });

  it("declared Content-Length too large -> 413", async () => {
    const res = await call("/favorites/p1", {
      method: "PUT",
      uid: A,
      raw: JSON.stringify(body()),
      headers: { "Content-Length": String(MAX_BODY_BYTES + 1) },
    });
    expect(res.status).toBe(413);
  });

  it.each([
    ["POST", "/favorites"],
    ["PUT", "/favorites"],
    ["GET", "/favorites/p1"],
  ])("%s %s -> 405 before auth", async (method, path) => {
    const res = await call(path, { method });
    expect(res.status).toBe(405);
    expect(await res.json()).toEqual({ error: "method not allowed" });
  });
});
