import { timingSafeEqual } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Env } from "../src/env";
import worker from "../src/index";

const ORIGIN = "http://localhost:3000";
const env = {
  FIREBASE_PROJECT_IDS: "test-project",
  ALLOWED_ORIGINS: ORIGIN,
  DB: {},
  STOP_MONITOR: {},
} as unknown as Env;
const ctx = { waitUntil() {}, passThroughOnException() {} } as never;

const call = (path: string, init?: RequestInit) =>
  worker.fetch!(new Request(`https://w.test${path}`, init) as never, env, ctx);

// /health, /stats용: D1 batch만 빈 결과로 흉내 낸다
const ADMIN_TOKEN = "test-admin-token";
const emptyStatement = { bind: () => emptyStatement };
const adminEnv = {
  ...env,
  ADMIN_TOKEN,
  DB: {
    prepare: () => emptyStatement,
    batch: async () => [{ results: [] }, { results: [] }],
  },
} as unknown as Env;
const callAdmin = (path: string, init?: RequestInit) =>
  worker.fetch!(new Request(`https://w.test${path}`, init) as never, adminEnv, ctx);

describe("router CORS + /me", () => {
  // crypto.subtle.timingSafeEqual은 Workers 전용 확장이라 Node에서는 node:crypto 구현을 붙인다
  const subtle = crypto.subtle as SubtleCrypto & { timingSafeEqual?: (a: Uint8Array, b: Uint8Array) => boolean };
  beforeAll(() => {
    subtle.timingSafeEqual = (a, b) => timingSafeEqual(a, b);
  });
  afterAll(() => {
    delete subtle.timingSafeEqual;
  });

  it("preflight from allowed origin -> 204 with CORS headers", async () => {
    const res = await call("/me", {
      method: "OPTIONS",
      headers: {
        Origin: ORIGIN,
        "Access-Control-Request-Method": "GET",
        "Access-Control-Request-Headers": "authorization",
      },
    });
    expect(res.status).toBe(204);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe(ORIGIN);
    expect(res.headers.get("Access-Control-Allow-Headers")).toContain("Authorization");
    expect(res.headers.get("Vary")).toContain("Origin");
  });

  it("preflight from disallowed origin -> no ACAO", async () => {
    const res = await call("/me", {
      method: "OPTIONS",
      headers: { Origin: "https://evil.example", "Access-Control-Request-Method": "GET" },
    });
    expect(res.headers.get("Access-Control-Allow-Origin")).toBeNull();
  });

  it("GET /me without auth from allowed origin -> 401 + ACAO", async () => {
    const res = await call("/me", { headers: { Origin: ORIGIN } });
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "missing" });
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe(ORIGIN);
  });

  it("GET /me from disallowed origin -> 401 without ACAO", async () => {
    const res = await call("/me", { headers: { Origin: "https://evil.example" } });
    expect(res.status).toBe(401);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBeNull();
  });

  it("POST /me -> 405", async () => {
    const res = await call("/me", { method: "POST" });
    expect(res.status).toBe(405);
  });

  it("GET /stats without admin token -> 403 + ACAO", async () => {
    const res = await call("/stats?stop=8001234", { headers: { Origin: ORIGIN } });
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: "forbidden" });
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe(ORIGIN);
  });

  it("GET /stats with a wrong admin token -> 403", async () => {
    const res = await callAdmin("/stats?stop=8001234", { headers: { "x-admin-token": "wrong" } });
    expect(res.status).toBe(403);
  });

  it("GET /stats with admin token and bad stop -> 400", async () => {
    const res = await callAdmin("/stats?stop=abc", { headers: { "x-admin-token": ADMIN_TOKEN } });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "stop must be a 7-digit BUS_NODE_ID" });
  });

  it("GET /stats with admin token -> 200", async () => {
    const res = await callAdmin("/stats?stop=8001234", { headers: { "x-admin-token": ADMIN_TOKEN } });
    expect(res.status).toBe(200);
  });

  it("GET /health stays public -> 200 without a token", async () => {
    const res = await callAdmin("/health");
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ ok: true });
  });

  it("GET /nope -> 404", async () => {
    const res = await call("/nope");
    expect(res.status).toBe(404);
  });

  it("OPTIONS /admin/kick -> 405 without ACAO", async () => {
    const res = await call("/admin/kick", { method: "OPTIONS", headers: { Origin: ORIGIN } });
    expect(res.status).toBe(405);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBeNull();
  });

  it("POST /admin/status without token -> 403 without ACAO", async () => {
    const res = await call("/admin/status", { method: "POST", headers: { Origin: ORIGIN } });
    expect(res.status).toBe(403);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBeNull();
  });

  it("unknown /admin/* path -> 404 without ACAO, like before", async () => {
    for (const method of ["GET", "POST", "OPTIONS"]) {
      const res = await call("/admin/other", { method, headers: { Origin: ORIGIN } });
      expect(res.status).toBe(404);
      expect(res.headers.get("Access-Control-Allow-Origin")).toBeNull();
    }
  });

  it.each(["PUT", "DELETE"])("preflight %s /favorites/123 from allowed origin -> 204 with CORS headers", async (method) => {
    const res = await call("/favorites/123", {
      method: "OPTIONS",
      headers: {
        Origin: ORIGIN,
        "Access-Control-Request-Method": method,
        "Access-Control-Request-Headers": "authorization, content-type",
      },
    });
    expect(res.status).toBe(204);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe(ORIGIN);
    expect(res.headers.get("Access-Control-Allow-Methods")).toContain("PUT");
    expect(res.headers.get("Access-Control-Allow-Methods")).toContain("DELETE");
    expect(res.headers.get("Access-Control-Allow-Headers")).toContain("Authorization");
    expect(res.headers.get("Access-Control-Allow-Headers")).toContain("Content-Type");
  });

  it("preflight /favorites/123 from disallowed origin -> no ACAO", async () => {
    const res = await call("/favorites/123", {
      method: "OPTIONS",
      headers: { Origin: "https://evil.example", "Access-Control-Request-Method": "PUT" },
    });
    expect(res.headers.get("Access-Control-Allow-Origin")).toBeNull();
  });

  it("GET /favorites without auth from allowed origin -> 401 + ACAO", async () => {
    const res = await call("/favorites", { headers: { Origin: ORIGIN } });
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "missing" });
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe(ORIGIN);
  });
});
