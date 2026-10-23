import { parseAllowedOrigins, preflightResponse, withCors } from "./cors";
import { enabledStopIds, health, stopStats } from "./db";
import type { Env } from "./env";
import { handleFavorites } from "./favorites";
import { json } from "./json";
import { handleMe } from "./me";

export { StopMonitor } from "./monitor";

async function kickAll(env: Env) {
  const stopIds = await enabledStopIds(env.DB);
  return Promise.all(stopIds.map((nodeId) => env.STOP_MONITOR.get(env.STOP_MONITOR.idFromName(nodeId)).start(nodeId)));
}

async function isAdmin(request: Request, env: Env): Promise<boolean> {
  const expected = env.ADMIN_TOKEN;
  const given = request.headers.get("x-admin-token");
  if (!expected || !given) return false;
  const encoder = new TextEncoder();
  const [a, b] = [encoder.encode(given), encoder.encode(expected)];
  return a.byteLength === b.byteLength && crypto.subtle.timingSafeEqual(a, b);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const allowed = parseAllowedOrigins(env.ALLOWED_ORIGINS);

    async function route(): Promise<Response> {
      if (request.method === "GET" && url.pathname === "/health") return json(await health(env.DB));

      if (request.method === "GET" && url.pathname === "/stats") {
        const stop = url.searchParams.get("stop") ?? "";
        if (!/^\d{7}$/.test(stop)) return json({ error: "stop must be a 7-digit BUS_NODE_ID" }, 400);
        return json(await stopStats(env.DB, stop));
      }

      if (url.pathname === "/me") {
        if (request.method !== "GET") return json({ error: "method not allowed" }, 405);
        return handleMe(request, env.FIREBASE_PROJECT_ID);
      }

      if (url.pathname === "/favorites" || url.pathname.startsWith("/favorites/")) {
        return handleFavorites(request, env.DB, env.FIREBASE_PROJECT_ID);
      }

      return json({ error: "not found" }, 404);
    }

    if (url.pathname === "/admin/kick" || url.pathname === "/admin/status") {
      if (request.method !== "POST") return json({ error: "method not allowed" }, 405);
      if (!(await isAdmin(request, env))) return json({ error: "forbidden" }, 403);
      if (url.pathname === "/admin/kick") return json({ started: await kickAll(env) });
      const stopIds = await enabledStopIds(env.DB);
      return json({
        stops: await Promise.all(stopIds.map((nodeId) => env.STOP_MONITOR.get(env.STOP_MONITOR.idFromName(nodeId)).status())),
      });
    }

    // 관리자 경로는 브라우저에서 부르지 않는다: CORS 헤더도 프리플라이트도 없다
    if (url.pathname.startsWith("/admin/")) return json({ error: "not found" }, 404);
    if (request.method === "OPTIONS") return preflightResponse(request, allowed);
    return withCors(await route(), request, allowed);
  },

  async scheduled(_controller, env, ctx) {
    ctx.waitUntil(
      (async () => {
        const started = await kickAll(env);
        console.log("cron: started", started.length, "stops");
      })(),
    );
  },
} satisfies ExportedHandler<Env>;
