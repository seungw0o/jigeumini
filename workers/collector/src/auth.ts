import { createRemoteJWKSet, jwtVerify, errors, type JWTVerifyGetKey } from "jose";

export const GOOGLE_JWKS_URL =
  "https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com";

export type KeySet = JWTVerifyGetKey;
export type AuthFailure = "missing" | "invalid" | "expired";

export class AuthError extends Error {
  readonly reason: "invalid" | "expired";

  constructor(reason: "invalid" | "expired") {
    super(`auth ${reason}`);
    this.name = "AuthError";
    this.reason = reason;
  }
}

export interface VerifyOptions {
  keys?: KeySet;
  now?: Date;
}

export const CLOCK_TOLERANCE_SECONDS = 5;

// isolate 단위로 캐시되는 원격 키 세트
const remoteKeys: KeySet = createRemoteJWKSet(new URL(GOOGLE_JWKS_URL));

/** kid 없는 토큰은 키 조회 전에 거부한다 */
function withKidCheck(keys: KeySet): KeySet {
  return (header, token) => {
    if (typeof header.kid !== "string") throw new AuthError("invalid");
    return keys(header, token);
  };
}

const issuerOf = (projectId: string) => `https://securetoken.google.com/${projectId}`;

export function parseProjectIds(value: string | undefined): string[] {
  return (value ?? "")
    .split(",")
    .map((id) => id.trim())
    .filter((id) => id.length > 0);
}

export async function verifyIdToken(
  token: string,
  projectIds: readonly string[],
  options: VerifyOptions = {},
): Promise<{ uid: string }> {
  if (projectIds.length === 0) throw new AuthError("invalid");
  const now = options.now ?? new Date();
  const nowSec = Math.floor(now.getTime() / 1000);

  let payload;
  try {
    ({ payload } = await jwtVerify(token, withKidCheck(options.keys ?? remoteKeys), {
      issuer: projectIds.map(issuerOf),
      audience: [...projectIds],
      algorithms: ["RS256"],
      requiredClaims: ["exp", "iat", "sub", "auth_time"],
      clockTolerance: CLOCK_TOLERANCE_SECONDS,
      currentDate: now,
    }));
  } catch (err) {
    if (err instanceof AuthError) throw err;
    // JWTExpired는 JWTClaimValidationFailed의 하위 클래스라 먼저 검사한다
    if (err instanceof errors.JWTExpired) throw new AuthError("expired");
    if (
      err instanceof errors.JWSSignatureVerificationFailed ||
      err instanceof errors.JWTClaimValidationFailed ||
      err instanceof errors.JWSInvalid ||
      err instanceof errors.JWTInvalid ||
      err instanceof errors.JWKSNoMatchingKey ||
      err instanceof errors.JOSEAlgNotAllowed ||
      err instanceof errors.JOSENotSupported
    ) {
      throw new AuthError("invalid");
    }
    // JWKS 조회 실패 등은 그대로 던져 호출자가 503으로 답하게 한다
    throw err;
  }

  // 목록을 넣으면 jose는 iss와 aud를 따로 검사한다. 두 값이 같은 프로젝트를 가리키는지 따로 확인한다
  const { aud, iss } = payload;
  if (typeof aud !== "string" || iss !== issuerOf(aud)) throw new AuthError("invalid");

  const limit = nowSec + CLOCK_TOLERANCE_SECONDS;
  const { iat, auth_time: authTime, sub } = payload;
  if (typeof iat !== "number" || iat > limit) throw new AuthError("invalid");
  if (typeof authTime !== "number" || authTime > limit) throw new AuthError("invalid");
  if (typeof sub !== "string" || sub.length === 0 || sub.length > 128) {
    throw new AuthError("invalid");
  }
  return { uid: sub };
}

export type AuthResult = { ok: true; uid: string } | { ok: false; reason: AuthFailure };

export async function authenticate(
  request: Request,
  projectIds: readonly string[],
  options?: VerifyOptions,
): Promise<AuthResult> {
  const header = request.headers.get("Authorization");
  if (header === null) return { ok: false, reason: "missing" };
  const match = /^Bearer +(\S+)$/i.exec(header);
  if (!match) return { ok: false, reason: "invalid" };
  try {
    const { uid } = await verifyIdToken(match[1], projectIds, options);
    return { ok: true, uid };
  } catch (err) {
    if (err instanceof AuthError) return { ok: false, reason: err.reason };
    throw err;
  }
}
