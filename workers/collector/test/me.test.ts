import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT, type JWK, type CryptoKey } from "jose";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import type { KeySet } from "../src/auth";
import { handleMe } from "../src/me";

const PROJECT = "test-project";
const NOW = new Date("2026-01-01T00:00:00Z");
const NOW_SEC = Math.floor(NOW.getTime() / 1000);

let privateKey: CryptoKey;
let keys: KeySet;

beforeAll(async () => {
  const pair = await generateKeyPair("RS256");
  privateKey = pair.privateKey as CryptoKey;
  const jwk: JWK = { ...(await exportJWK(pair.publicKey)), kid: "k1", alg: "RS256", use: "sig" };
  keys = createLocalJWKSet({ keys: [jwk] });
});

afterEach(() => vi.restoreAllMocks());

function sign(exp = NOW_SEC + 3600): Promise<string> {
  return new SignJWT({ auth_time: NOW_SEC - 10 })
    .setProtectedHeader({ alg: "RS256", kid: "k1" })
    .setIssuer(`https://securetoken.google.com/${PROJECT}`)
    .setAudience(PROJECT)
    .setSubject("user-1")
    .setIssuedAt(NOW_SEC - 10)
    .setExpirationTime(exp)
    .sign(privateKey);
}

const req = (token?: string) =>
  new Request("https://w.test/me", { headers: token ? { Authorization: `Bearer ${token}` } : {} });

describe("handleMe", () => {
  it("valid token -> 200 {uid}", async () => {
    const res = await handleMe(req(await sign()), PROJECT, { keys, now: NOW });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ uid: "user-1" });
  });

  it("no header -> 401 missing + WWW-Authenticate", async () => {
    const res = await handleMe(req(), PROJECT, { keys, now: NOW });
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "missing" });
    expect(res.headers.get("WWW-Authenticate")).toBe("Bearer");
  });

  it("expired token -> 401 expired", async () => {
    const res = await handleMe(req(await sign(NOW_SEC - 3600)), PROJECT, { keys, now: NOW });
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "expired" });
  });

  it("tampered signature -> 401 invalid", async () => {
    const token = await sign();
    // 마지막 글자는 패딩 비트라 바꿔도 같은 바이트가 될 수 있어 서명 중간 글자를 바꾼다
    const at = token.lastIndexOf(".") + 10;
    const tampered = token.slice(0, at) + (token[at] === "A" ? "B" : "A") + token.slice(at + 1);
    const res = await handleMe(req(tampered), PROJECT, { keys, now: NOW });
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "invalid" });
  });

  it("key fetch failure -> 503 and token never logged", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const token = await sign();
    const failing: KeySet = () => {
      throw new TypeError("fetch failed");
    };
    const res = await handleMe(req(token), PROJECT, { keys: failing, now: NOW });
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ error: "auth unavailable" });
    expect(spy).toHaveBeenCalled();
    expect(JSON.stringify(spy.mock.calls)).not.toContain(token);
  });
});
