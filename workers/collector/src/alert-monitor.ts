import { DurableObject } from "cloudflare:workers";
import { ackToken } from "./alert-ack";
import type { PlannedRoute } from "../../../src/apis/live/types";
import type { MarginsResponse } from "../../../src/apis/margins/types";
import { decideAlert, notifyAtOf } from "./alert-schedule";
import { routeDetailUrl, type AlertScheduler } from "./alerts";
import { fetchBoardArrivals } from "./arrivals";
import type { Env } from "./env";
import { departureOf, type Departure } from "./leave-by";
import { stopMargins } from "./margins";
import { sendToUser, vapidKeysOf, type PushPayload } from "./push";

/** /margins 응답 캐시(10분)와 같은 주기로만 여유 통계를 다시 읽는다 */
const MARGINS_TTL_MS = 10 * 60_000;

type PendingRow = {
  uid: string;
  route_id: string;
  pair_query: string;
  plan_json: string;
  board_node_id: string;
  status: string;
  created_at: string;
};

export function alertPayload(
  alertId: string,
  routeId: string,
  pairQuery: string,
  departure: Departure,
  ack?: PushPayload["ack"],
): PushPayload {
  const when = departure.busInMinutes === null ? `${departure.boardAt} 도착` : `${departure.busInMinutes}분 뒤`;
  return {
    title: "지금 나가세요",
    body: `지금 나가면 ${departure.routeNo}번 탈 수 있어요 · ${departure.boardStopName} ${when}`,
    tag: `alert-${alertId}`,
    url: routeDetailUrl(routeId, pairQuery),
    ...(ack ? { ack } : {}),
  };
}

export function alertScheduler(ns: DurableObjectNamespace<AlertMonitor>): AlertScheduler {
  const stub = (id: string) => ns.get(ns.idFromName(id));
  return {
    schedule: (id, ackBase) => stub(id).schedule(id, ackBase),
    cancel: (id) => stub(id).cancel(),
  };
}

/** 출발 알림 하나를 맡는다. 알람마다 도착 정보로 출발 시각을 다시 계산하고, 출발 2분 전에 푸시를 보낸다 */
export class AlertMonitor extends DurableObject<Env> {
  async schedule(alertId: string, ackBase: string): Promise<void> {
    await this.ctx.storage.put({ alertId, misses: 0, ackBase });
    await this.ctx.storage.setAlarm(Date.now());
  }

  async cancel(): Promise<void> {
    await this.ctx.storage.deleteAlarm();
    await this.ctx.storage.deleteAll();
  }

  private async margins(now: number): Promise<MarginsResponse | undefined> {
    const storage = this.ctx.storage;
    const cached = await storage.get<{ at: number; value: MarginsResponse }>("margins");
    if (cached && now - cached.at < MARGINS_TTL_MS) return cached.value;
    try {
      const value = await stopMargins(this.env.DB, now);
      await storage.put("margins", { at: now, value });
      return value;
    } catch (error) {
      // 화면도 /margins를 못 받으면 기본 여유를 쓴다
      console.error("alert margins failed:", error instanceof Error ? error.message : String(error));
      return cached?.value;
    }
  }

  private async finish(alertId: string, status: "sent" | "failed", reason: string | null, now: number, leaveByMs?: number): Promise<void> {
    const at = new Date(now).toISOString();
    await this.env.DB.prepare(
      "UPDATE alerts SET status = ?, fail_reason = ?, sent_at = ?, leave_by_at = COALESCE(?, leave_by_at), updated_at = ? WHERE id = ? AND status = 'pending'",
    )
      .bind(status, reason, status === "sent" ? at : null, leaveByMs === undefined ? null : new Date(leaveByMs).toISOString(), at, alertId)
      .run();
    await this.ctx.storage.deleteAll();
  }

  async alarm(): Promise<void> {
    const storage = this.ctx.storage;
    const alertId = await storage.get<string>("alertId");
    if (!alertId) return;
    const row = await this.env.DB.prepare(
      "SELECT uid, route_id, pair_query, plan_json, board_node_id, status, created_at FROM alerts WHERE id = ?",
    )
      .bind(alertId)
      .first<PendingRow>();
    if (row === null || row.status !== "pending") {
      await storage.deleteAll();
      return;
    }

    const now = Date.now();
    let departure: Departure | null = null;
    try {
      const serviceKey = this.env.DATA_GO_KR_KEY?.trim();
      if (!serviceKey) throw new Error("DATA_GO_KR_KEY secret is not set");
      const arrivals = await fetchBoardArrivals(serviceKey, row.board_node_id);
      const plan = JSON.parse(row.plan_json) as PlannedRoute;
      departure = departureOf(plan, arrivals, { fetchedAtMs: now, nowMs: now }, await this.margins(now));
    } catch (error) {
      console.error("alert recompute failed", alertId, error instanceof Error ? error.message : String(error));
    }

    const misses = departure ? 0 : ((await storage.get<number>("misses")) ?? 0) + 1;
    const decision = decideAlert({ nowMs: now, createdAtMs: Date.parse(row.created_at), leaveByMs: departure?.leaveByMs ?? null, misses });
    console.log(
      "alert",
      alertId,
      decision.kind,
      departure ? `leaveAt=${departure.leaveAt} notifyAt=${new Date(notifyAtOf(departure.leaveByMs)).toISOString()}` : `misses=${misses}`,
      decision.kind === "wait" ? `next=${new Date(decision.atMs).toISOString()}` : "",
    );

    if (decision.kind === "fail") {
      await this.finish(alertId, "failed", decision.reason, now);
      return;
    }
    if (decision.kind === "wait") {
      if (departure) {
        await this.env.DB.prepare("UPDATE alerts SET leave_by_at = ?, updated_at = ? WHERE id = ? AND status = 'pending'")
          .bind(new Date(departure.leaveByMs).toISOString(), new Date(now).toISOString(), alertId)
          .run();
      }
      await storage.put("misses", misses);
      await storage.setAlarm(decision.atMs);
      return;
    }

    if (departure === null) throw new Error("send decision without a departure");
    // 이 변경 전에 예약된 알림은 ackBase가 없어 확인 없이 보낸다
    const ackBase = await storage.get<string>("ackBase");
    const secret = this.env.VAPID_PRIVATE_KEY;
    const ack =
      ackBase && secret
        ? { url: `${ackBase}/alerts/${alertId}/ack`, uid: row.uid, token: await ackToken(secret, alertId, row.uid) }
        : undefined;
    const payload = alertPayload(alertId, row.route_id, row.pair_query, departure, ack);
    const result = await sendToUser(this.env.DB, row.uid, payload, vapidKeysOf(this.env));
    console.log("alert push", alertId, JSON.stringify(result));
    await this.finish(alertId, result.sent > 0 ? "sent" : "failed", result.sent > 0 ? null : "push", now, departure.leaveByMs);
  }
}
