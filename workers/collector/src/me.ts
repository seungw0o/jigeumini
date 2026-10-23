import { authenticate, type VerifyOptions } from "./auth";
import { json } from "./json";

export async function handleMe(request: Request, projectId: string, options?: VerifyOptions): Promise<Response> {
  let result;
  try {
    result = await authenticate(request, projectId, options);
  } catch (err) {
    // 토큰이나 헤더가 섞이지 않도록 메시지만 기록한다
    console.error("auth key fetch failed:", err instanceof Error ? err.message : "unknown");
    return json({ error: "auth unavailable" }, 503);
  }
  if (!result.ok) {
    const res = json({ error: result.reason }, 401);
    res.headers.set("WWW-Authenticate", "Bearer");
    return res;
  }
  return json({ uid: result.uid });
}
