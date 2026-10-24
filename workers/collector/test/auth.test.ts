import { beforeAll, describe, expect, test } from "vitest";
import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT, type CryptoKey, type JWK } from "jose";
import { authenticate, AuthError, parseProjectIds, verifyIdToken, type KeySet } from "../src/auth";

const PROJECT = "test-project";
const KID = "trusted-kid";
const NOW = new Date("2026-10-23T00:00:00Z");
const NOW_SEC = Math.floor(NOW.getTime() / 1000);

let privateKey: CryptoKey;
let otherPrivateKey: CryptoKey;
let keys: KeySet;

beforeAll(async () => {
  const pair = await generateKeyPair("RS256", { extractable: true });
  const other = await generateKeyPair("RS256", { extractable: true });
  privateKey = pair.privateKey;
  otherPrivateKey = other.privateKey;
  const jwk: JWK = { ...(await exportJWK(pair.publicKey)), kid: KID, alg: "RS256" };
  keys = createLocalJWKSet({ keys: [jwk] });
});

interface SignOptions {
  key?: CryptoKey | Uint8Array;
  alg?: string;
  kid?: string | null;
  iss?: string;
  aud?: string;
  sub?: string;
  exp?: number;
  iat?: number;
  authTime?: number | null;
}

async function sign(o: SignOptions = {}): Promise<string> {
  const payload: Record<string, unknown> = {};
  if (o.authTime !== null) payload.auth_time = o.authTime ?? NOW_SEC - 60;
  const header: { alg: string; kid?: string } = { alg: o.alg ?? "RS256" };
  if (o.kid !== null) header.kid = o.kid ?? KID;
  return new SignJWT(payload)
    .setProtectedHeader(header)
    .setIssuer(o.iss ?? `https://securetoken.google.com/${PROJECT}`)
    .setAudience(o.aud ?? PROJECT)
    .setSubject(o.sub ?? "user-1")
    .setIssuedAt(o.iat ?? NOW_SEC - 60)
    .setExpirationTime(o.exp ?? NOW_SEC + 3600)
    .sign(o.key ?? privateKey);
}

const verify = (token: string) => verifyIdToken(token, [PROJECT], { keys, now: NOW });
const request = (authorization?: string) =>
  new Request("https://example.com/me", authorization ? { headers: { Authorization: authorization } } : {});

async function reasonOf(promise: Promise<unknown>) {
  const err = await promise.then(
    () => null,
    (e: unknown) => e,
  );
  expect(err).toBeInstanceOf(AuthError);
  return (err as AuthError).reason;
}

describe("verifyIdToken", () => {
  test("valid token returns uid", async () => {
    await expect(verify(await sign())).resolves.toEqual({ uid: "user-1" });
  });

  test("expired token -> expired", async () => {
    expect(await reasonOf(verify(await sign({ exp: NOW_SEC - 3600 })))).toBe("expired");
  });

  test("wrong audience -> invalid", async () => {
    expect(await reasonOf(verify(await sign({ aud: "other-project" })))).toBe("invalid");
  });

  test("wrong issuer -> invalid", async () => {
    expect(await reasonOf(verify(await sign({ iss: "https://securetoken.google.com/other-project" })))).toBe("invalid");
  });

  test("bad signature (other key, trusted kid) -> invalid", async () => {
    expect(await reasonOf(verify(await sign({ key: otherPrivateKey })))).toBe("invalid");
  });

  test("unknown kid -> invalid", async () => {
    expect(await reasonOf(verify(await sign({ kid: "unknown-kid" })))).toBe("invalid");
  });

  test("missing kid -> invalid", async () => {
    expect(await reasonOf(verify(await sign({ kid: null })))).toBe("invalid");
  });

  test("alg not RS256 (HS256) -> invalid", async () => {
    const secret = new TextEncoder().encode("a-shared-secret-of-sufficient-length-0123456789");
    expect(await reasonOf(verify(await sign({ alg: "HS256", key: secret })))).toBe("invalid");
  });

  test("future iat -> invalid", async () => {
    expect(await reasonOf(verify(await sign({ iat: NOW_SEC + 3600 })))).toBe("invalid");
  });

  test("future auth_time -> invalid", async () => {
    expect(await reasonOf(verify(await sign({ authTime: NOW_SEC + 3600 })))).toBe("invalid");
  });

  test("empty sub -> invalid", async () => {
    expect(await reasonOf(verify(await sign({ sub: "" })))).toBe("invalid");
  });

  test("missing auth_time claim -> invalid", async () => {
    expect(await reasonOf(verify(await sign({ authTime: null })))).toBe("invalid");
  });

  test("garbled token string -> invalid", async () => {
    expect(await reasonOf(verify("abc"))).toBe("invalid");
  });
});

describe("verifyIdToken with several projects", () => {
  const PROD = "prod-project";
  const both = [PROJECT, PROD];
  const verifyBoth = (token: string) => verifyIdToken(token, both, { keys, now: NOW });
  const prodToken = () => sign({ aud: PROD, iss: `https://securetoken.google.com/${PROD}`, sub: "prod-user" });

  test("tokens of every listed project pass", async () => {
    await expect(verifyBoth(await sign())).resolves.toEqual({ uid: "user-1" });
    await expect(verifyBoth(await prodToken())).resolves.toEqual({ uid: "prod-user" });
  });

  test("a project outside the list -> invalid", async () => {
    const other = await sign({ aud: "other-project", iss: "https://securetoken.google.com/other-project" });
    expect(await reasonOf(verifyBoth(other))).toBe("invalid");
  });

  test("aud and iss from different listed projects -> invalid", async () => {
    const mixed = await sign({ aud: PROD, iss: `https://securetoken.google.com/${PROJECT}` });
    expect(await reasonOf(verifyBoth(mixed))).toBe("invalid");
  });

  test("a prod token is refused when only dev is listed", async () => {
    expect(await reasonOf(verify(await prodToken()))).toBe("invalid");
  });

  test("empty project list -> invalid", async () => {
    expect(await reasonOf(verifyIdToken(await sign(), [], { keys, now: NOW }))).toBe("invalid");
  });
});

describe("parseProjectIds", () => {
  test("splits on commas and drops blanks", () => {
    expect(parseProjectIds(" dev-1 , prod-2,, ")).toEqual(["dev-1", "prod-2"]);
    expect(parseProjectIds(undefined)).toEqual([]);
  });
});

describe("authenticate", () => {
  test("valid Bearer token -> ok with uid", async () => {
    const token = await sign();
    await expect(authenticate(request(`Bearer ${token}`), [PROJECT], { keys, now: NOW })).resolves.toEqual({
      ok: true,
      uid: "user-1",
    });
  });

  test("expired token -> expired", async () => {
    const token = await sign({ exp: NOW_SEC - 3600 });
    await expect(authenticate(request(`Bearer ${token}`), [PROJECT], { keys, now: NOW })).resolves.toEqual({
      ok: false,
      reason: "expired",
    });
  });

  test("no Authorization header -> missing", async () => {
    await expect(authenticate(request(), [PROJECT], { keys, now: NOW })).resolves.toEqual({
      ok: false,
      reason: "missing",
    });
  });

  test("Basic scheme -> invalid", async () => {
    await expect(authenticate(request("Basic abc"), [PROJECT], { keys, now: NOW })).resolves.toEqual({
      ok: false,
      reason: "invalid",
    });
  });

  test("Bearer without token -> invalid", async () => {
    await expect(authenticate(request("Bearer"), [PROJECT], { keys, now: NOW })).resolves.toEqual({
      ok: false,
      reason: "invalid",
    });
  });

  test("key fetch failure rejects instead of returning a failure", async () => {
    const token = await sign();
    const failing: KeySet = () => {
      throw new TypeError("fetch failed");
    };
    await expect(authenticate(request(`Bearer ${token}`), [PROJECT], { keys: failing, now: NOW })).rejects.toThrow(
      TypeError,
    );
  });
});
