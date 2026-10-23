import { enabledStopIds, health, stopStats } from "./db";
import type { Env } from "./env";

export { StopMonitor } from "./monitor";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json; charset=utf-8" } });

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

    if (request.method === "GET" && url.pathname === "/health") return json(await health(env.DB));

    if (request.method === "GET" && url.pathname === "/stats") {
      const stop = url.searchParams.get("stop") ?? "";
      if (!/^\d{7}$/.test(stop)) return json({ error: "stop must be a 7-digit BUS_NODE_ID" }, 400);
      return json(await stopStats(env.DB, stop));
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

    return json({ error: "not found" }, 404);
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
