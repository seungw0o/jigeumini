import { DurableObject } from "cloudflare:workers";
import { runTick, POLL_INTERVAL_MS, type TickResult } from "./collector";
import { fetchStopArrivals } from "./daejeon";
import { D1Sink } from "./db";
import type { Env } from "./env";
import { isCollecting, kstIso, nextCollectionStart } from "./kst";
import type { Tracks } from "./tracker";
import { ApiError } from "../../../src/apis/errors";

const DEFAULT_OBSERVATION_EVERY = 5;

/** 정류소(BUS_NODE_ID) 하나를 맡는다. 알람이 60초마다 도착 정보를 읽고 도착과 예측 오차를 D1에 쓴다 */
export class StopMonitor extends DurableObject<Env> {
  /** 루프를 (다시) 켠다. 이미 돌고 있으면 알람을 앞당기기만 한다. 알람은 객체당 하나라 루프가 겹치지 않는다 */
  async start(nodeId: string): Promise<{ nodeId: string; nextAlarmAt: string }> {
    const storage = this.ctx.storage;
    await storage.put({ nodeId, stopReason: null });
    const startAt = nextCollectionStart(Date.now());
    const current = await storage.getAlarm();
    if (current === null || current > startAt) await storage.setAlarm(startAt);
    return { nodeId, nextAlarmAt: kstIso((await storage.getAlarm()) ?? startAt) };
  }

  async status(): Promise<{ nodeId: string | null; nextAlarmAt: string | null; stopReason: string | null; tick: number }> {
    const storage = this.ctx.storage;
    const alarm = await storage.getAlarm();
    return {
      nodeId: (await storage.get<string>("nodeId")) ?? null,
      nextAlarmAt: alarm === null ? null : kstIso(alarm),
      stopReason: (await storage.get<string | null>("stopReason")) ?? null,
      tick: (await storage.get<number>("tick")) ?? 0,
    };
  }

  async alarm(): Promise<void> {
    const storage = this.ctx.storage;
    const nodeId = await storage.get<string>("nodeId");
    if (!nodeId) return;
    const watched = await this.env.DB.prepare("SELECT 1 FROM watched_stops WHERE node_id = ? AND enabled = 1").bind(nodeId).first();
    if (!watched) {
      await storage.put({ stopReason: "disabled" });
      return;
    }
    const now = Date.now();
    const tracks = (await storage.get<Tracks>("tracks")) ?? {};
    const tick = (await storage.get<number>("tick")) ?? 0;
    const serviceKey = this.env.DATA_GO_KR_KEY?.trim();
    const observationEvery = Number(this.env.OBSERVATION_EVERY_N_TICKS) || DEFAULT_OBSERVATION_EVERY;

    let result: TickResult;
    try {
      result = await runTick({
        nodeId,
        now,
        tick,
        observationEvery,
        tracks,
        sink: new D1Sink(this.env.DB),
        fetchArrivals: (id) => {
          if (!serviceKey) throw new ApiError("MISSING_KEY", "daejeon", "DATA_GO_KR_KEY secret is not set");
          return fetchStopArrivals(serviceKey, id);
        },
      });
    } catch (error) {
      // D1 쓰기 실패 같은 예상 밖 오류: 이번 틱만 버리고 루프는 이어간다
      console.error("stop-monitor tick failed", nodeId, error instanceof Error ? error.message : String(error));
      result = { tracks, nextAlarmAt: isCollecting(now) ? now + POLL_INTERVAL_MS : null, stopReason: null };
    }

    await storage.put({ tracks: result.tracks, tick: tick + 1, stopReason: result.stopReason });
    if (result.nextAlarmAt !== null) await storage.setAlarm(result.nextAlarmAt);
  }
}
