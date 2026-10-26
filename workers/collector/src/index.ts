import { ACK_PATH_RE, handleAlertAck } from "./alert-ack";
import { alertScheduler } from "./alert-monitor";
import { handleAlerts, handlePushSubscription } from "./alerts";
import { parseAllowedOrigins, preflightResponse, withCors } from "./cors";
import { enabledStopIds, health, stopStats } from "./db";
import type { Env } from "./env";
import { parseProjectIds } from "./auth";
import { handleFavorites } from "./favorites";
import { json } from "./json";
import { foldNewErrors } from "./margin-hist";
import { stopMargins } from "./margins";
import { handleMe } from "./me";
import { chooseDailyStops } from "./rotation";

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

/**
 * 05:20 KST Cron (수집 창 23:30 마감 뒤): 어제 쌓인 오차를 히스토그램에 접고, 오늘 잴 정류소 60곳을 고른 뒤 모니터를 켠다.
 * 접기가 실패해도 오늘 수집은 해야 하므로 순환과 시작은 이어간다. 순환이 실패하면 어제 켜 둔 정류소로 시작한다.
 */
export async function runMorningCron(env: Env, nowMs: number): Promise<void> {
  try {
    const fold = await foldNewErrors(env.DB, nowMs);
    console.log("cron: folded", fold.rows, "errors into", fold.keys, "histograms");
  } catch (error) {
    console.error("cron: fold failed", error instanceof Error ? error.message : String(error));
  }
  try {
    const day = await chooseDailyStops(env.DB, nowMs);
    console.log("cron: rotation", day.day, day.district, day.stopCount, "stops", day.reused ? "(reused)" : "");
  } catch (error) {
    console.error("cron: rotation failed", error instanceof Error ? error.message : String(error));
  }
  const started = await kickAll(env);
  console.log("cron: started", started.length, "stops");
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

  async scheduled(controller, env, ctx) {
    ctx.waitUntil(runMorningCron(env, controller.scheduledTime));
  },
} satisfies ExportedHandler<Env>;
