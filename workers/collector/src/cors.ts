export const CORS_ALLOW_METHODS = "GET, POST, PUT, DELETE, OPTIONS";
export const CORS_ALLOW_HEADERS = "Authorization, Content-Type";
export const CORS_MAX_AGE_SECONDS = 86400;

export function parseAllowedOrigins(value: string | undefined): string[] {
  if (!value) return [];
  return value
    .split(",")
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);
}

// 와일드카드와 접두사 매칭은 허용하지 않는다. "null" Origin도 항상 거부한다.
export function allowedOrigin(request: Request, allowed: string[]): string | null {
  const origin = request.headers.get("Origin");
  if (origin === null || origin === "null") return null;
  return allowed.includes(origin) ? origin : null;
}

export function preflightResponse(request: Request, allowed: string[]): Response {
  const headers = new Headers({ Vary: "Origin" });
  const origin = allowedOrigin(request, allowed);
  if (origin !== null) {
    headers.set("Access-Control-Allow-Origin", origin);
    headers.set("Access-Control-Allow-Methods", CORS_ALLOW_METHODS);
    headers.set("Access-Control-Allow-Headers", CORS_ALLOW_HEADERS);
    headers.set("Access-Control-Max-Age", String(CORS_MAX_AGE_SECONDS));
  }
  return new Response(null, { status: 204, headers });
}

export function withCors(response: Response, request: Request, allowed: string[]): Response {
  const out = new Response(response.body, response);
  out.headers.append("Vary", "Origin");
  const origin = allowedOrigin(request, allowed);
  if (origin !== null) out.headers.set("Access-Control-Allow-Origin", origin);
  return out;
}
