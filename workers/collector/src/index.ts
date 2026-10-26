import { ACK_PATH_RE, handleAlertAck } from "./alert-ack";
import { alertScheduler } from "./alert-monitor";
import { handleAlerts, handlePushSubscription } from "./alerts";
import { parseAllowedOrigins, preflightResponse, withCors } from "./cors";
import { enabledStopIds, health, stopStats } from "./db";
import type { Env } from "./env";
import { parseProjectIds } from "./auth";
import { handleFavorites } from "./favorites";
import { json } from "./json";
import { stopMargins } from "./margins";
import { handleMe } from "./me";

export { StopMonitor } from "./monitor";
export { AlertMonitor } from "./alert-monitor";

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
        // 정류장별 수집 통계는 운영자용이다
        if (!(await isAdmin(request, env))) return json({ error: "forbidden" }, 403);
        const stop = url.searchParams.get("stop") ?? "";
        if (!/^\d{7}$/.test(stop)) return json({ error: "stop must be a 7-digit BUS_NODE_ID" }, 400);
        return json(await stopStats(env.DB, stop));
      }

      if (request.method === "GET" && url.pathname === "/margins") {
        const res = json(await stopMargins(env.DB, Date.now()));
        res.headers.set("Cache-Control", "public, max-age=600");
        return res;
      }

      if (url.pathname === "/me") {
        if (request.method !== "GET") return json({ error: "method not allowed" }, 405);
        return handleMe(request, parseProjectIds(env.FIREBASE_PROJECT_IDS));
      }

      if (url.pathname === "/favorites" || url.pathname.startsWith("/favorites/")) {
        return handleFavorites(request, env.DB, parseProjectIds(env.FIREBASE_PROJECT_IDS));
      }

      if (url.pathname === "/push/subscription") {
        return handlePushSubscription(request, env.DB, parseProjectIds(env.FIREBASE_PROJECT_IDS));
      }

      if (ACK_PATH_RE.test(url.pathname)) {
        return handleAlertAck(request, env.DB, alertScheduler(env.ALERT_MONITOR), env.VAPID_PRIVATE_KEY);
      }

      if (url.pathname === "/alerts" || url.pathname.startsWith("/alerts/")) {
        return handleAlerts(request, env.DB, alertScheduler(env.ALERT_MONITOR), parseProjectIds(env.FIREBASE_PROJECT_IDS));
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
