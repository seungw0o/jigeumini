import { describe, expect, it } from "vitest";
import {
  CORS_ALLOW_HEADERS,
  CORS_ALLOW_METHODS,
  CORS_MAX_AGE_SECONDS,
  allowedOrigin,
  parseAllowedOrigins,
  preflightResponse,
  withCors,
} from "../src/cors";

const ALLOWED = ["http://localhost:3000", "https://a.example"];
const ACAO = "Access-Control-Allow-Origin";

function req(origin?: string): Request {
  const headers: Record<string, string> = {};
  if (origin !== undefined) headers.Origin = origin;
  return new Request("https://collector.example/me", { headers });
}

describe("parseAllowedOrigins", () => {
  it("splits on comma, trims, and drops empty entries", () => {
    expect(parseAllowedOrigins("http://localhost:3000, https://a.example ,")).toEqual([
      "http://localhost:3000",
      "https://a.example",
    ]);
  });

  it("returns an empty list for undefined", () => {
    expect(parseAllowedOrigins(undefined)).toEqual([]);
  });
});

describe("allowedOrigin", () => {
  it("echoes an exact match", () => {
    expect(allowedOrigin(req("https://a.example"), ALLOWED)).toBe("https://a.example");
  });

  it("rejects a prefix trick", () => {
    expect(allowedOrigin(req("http://localhost:3000.evil.example"), ALLOWED)).toBeNull();
  });

  it("rejects the null origin even if listed", () => {
    expect(allowedOrigin(req("null"), [...ALLOWED, "null"])).toBeNull();
  });

  it("returns null when Origin is missing", () => {
    expect(allowedOrigin(req(), ALLOWED)).toBeNull();
  });
});

describe("preflightResponse", () => {
  it("returns 204 with all CORS headers and Vary for an allowed origin", () => {
    const res = preflightResponse(req("http://localhost:3000"), ALLOWED);
    expect(res.status).toBe(204);
    expect(res.headers.get(ACAO)).toBe("http://localhost:3000");
    expect(res.headers.get("Access-Control-Allow-Methods")).toBe(CORS_ALLOW_METHODS);
    expect(res.headers.get("Access-Control-Allow-Headers")).toBe(CORS_ALLOW_HEADERS);
    expect(res.headers.get("Access-Control-Max-Age")).toBe(String(CORS_MAX_AGE_SECONDS));
    expect(res.headers.get("Vary")).toBe("Origin");
    expect(res.headers.get("Access-Control-Allow-Credentials")).toBeNull();
  });

  it("omits every Access-Control-* header for a disallowed origin but keeps Vary", () => {
    const res = preflightResponse(req("https://evil.example"), ALLOWED);
    expect(res.status).toBe(204);
    expect(res.headers.get("Vary")).toBe("Origin");
    for (const name of [...res.headers.keys()]) {
      expect(name.startsWith("access-control-")).toBe(false);
    }
  });

  it("omits every Access-Control-* header when Origin is missing", () => {
    const res = preflightResponse(req(), ALLOWED);
    expect(res.headers.get(ACAO)).toBeNull();
    expect(res.headers.get("Vary")).toBe("Origin");
    for (const name of [...res.headers.keys()]) {
      expect(name.startsWith("access-control-")).toBe(false);
    }
  });
});

describe("withCors", () => {
  it("echoes the origin and keeps status, body, and content-type on an allowed request", async () => {
    const original = new Response('{"ok":true}', {
      status: 201,
      headers: { "Content-Type": "application/json" },
    });
    const res = withCors(original, req("https://a.example"), ALLOWED);
    expect(res.status).toBe(201);
    expect(res.headers.get("Content-Type")).toBe("application/json");
    expect(res.headers.get(ACAO)).toBe("https://a.example");
    expect(res.headers.get("Vary")).toBe("Origin");
    expect(await res.text()).toBe('{"ok":true}');
  });

  it("appends Origin to an existing Vary value instead of replacing it", () => {
    const original = new Response(null, { headers: { Vary: "Accept-Encoding" } });
    const res = withCors(original, req("https://a.example"), ALLOWED);
    expect(res.headers.get("Vary")).toBe("Accept-Encoding, Origin");
  });

  it("adds no Access-Control-Allow-Origin for a disallowed origin", () => {
    const res = withCors(new Response("x"), req("https://evil.example"), ALLOWED);
    expect(res.headers.get(ACAO)).toBeNull();
    expect(res.headers.get("Vary")).toBe("Origin");
  });

  it("returns a new Response and does not mutate the original", () => {
    const original = new Response("x");
    const res = withCors(original, req("https://a.example"), ALLOWED);
    expect(res).not.toBe(original);
    expect(original.headers.get(ACAO)).toBeNull();
  });
});
