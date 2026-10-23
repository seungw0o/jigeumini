import { describe, expect, it } from "vitest";
import type { Env } from "../src/env";
import worker from "../src/index";

const ORIGIN = "http://localhost:3000";
const env = {
  FIREBASE_PROJECT_ID: "test-project",
  ALLOWED_ORIGINS: ORIGIN,
  DB: {},
  STOP_MONITOR: {},
} as unknown as Env;
const ctx = { waitUntil() {}, passThroughOnException() {} } as never;

const call = (path: string, init?: RequestInit) =>
  worker.fetch!(new Request(`https://w.test${path}`, init) as never, env, ctx);

describe("router CORS + /me", () => {
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

  it("GET /stats with bad stop -> 400 + ACAO", async () => {
    const res = await call("/stats?stop=abc", { headers: { Origin: ORIGIN } });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "stop must be a 7-digit BUS_NODE_ID" });
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe(ORIGIN);
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
});
