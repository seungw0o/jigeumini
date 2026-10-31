import { describe, expect, it } from "vitest";
import type { Env } from "../src/env";
import { runMorningCron } from "../src/index";
import { kstIso } from "../src/kst";
import { chooseDailyStops, dailyStopCount, MAX_DAILY_STOPS, nextDistrict } from "../src/rotation";
import { createTestD1 } from "./d1-sqlite";

type DB = ReturnType<typeof createTestD1>;
import { T0 } from "./helpers";

const DAY = 24 * 60 * 60 * 1000;
const PINNED = ["8001318", "8001568", "8002452", "8007244"];

async function seedCatalog(db: DB, counts: Record<string, number>) {
  for (const id of PINNED) await db.prepare("INSERT INTO pinned_stops (node_id, name) VALUES (?, ?)").bind(id, `고정 ${id}`).run();
  let next = 9000000;
  for (const [district, count] of Object.entries(counts)) {
    for (let i = 0; i < count; i++) {
      await db
        .prepare("INSERT INTO stop_catalog (node_id, ars, name, lat, lng, district) VALUES (?, ?, ?, 36.3, 127.4, ?)")
        .bind(String(next++), null, `${district} 정류소 ${i}`, district)
        .run();
    }
  }
}

async function enabled(db: DB): Promise<string[]> {
  const { results } = await db.prepare("SELECT node_id FROM watched_stops WHERE enabled = 1 ORDER BY node_id").all<{ node_id: string }>();
  return results.map((r) => r.node_id);
}

async function districtOf(db: DB, ids: string[]): Promise<Record<string, number>> {
  const out: Record<string, number> = {};
  for (const id of ids) {
    const row = await db.prepare("SELECT district FROM stop_catalog WHERE node_id = ?").bind(id).first<{ district: string }>();
    out[row!.district] = (out[row!.district] ?? 0) + 1;
  }
  return out;
}

describe("dailyStopCount", () => {
  it("first day or unknown rows -> 12", () => {
    expect(dailyStopCount(null, 4)).toBe(MAX_DAILY_STOPS);
    expect(dailyStopCount({ stopCount: 30, rowsWritten: null }, 4)).toBe(12);
  });

  it("over 80% of the 100k rows limit shrinks to 70% of the limit", () => {
    // 12곳이 90,000행 -> 곳당 7,500행 -> 70,000 / 7,500 = 9곳
    expect(dailyStopCount({ stopCount: 12, rowsWritten: 90_000 }, 4)).toBe(9);
  });

  it("never exceeds 12 even when yesterday ran 60 stops", () => {
    // 60곳이 90,000행 -> 밸브 목표 46곳이지만 한도 12곳에서 멈춘다
    expect(dailyStopCount({ stopCount: 60, rowsWritten: 90_000 }, 4)).toBe(12);
    expect(dailyStopCount({ stopCount: 60, rowsWritten: 50_000 }, 4)).toBe(12);
  });

  it("recovers by 8 a day and never exceeds 12", () => {
    expect(dailyStopCount({ stopCount: 3, rowsWritten: 5_000 }, 4)).toBe(11);
    expect(dailyStopCount({ stopCount: 9, rowsWritten: 10_000 }, 4)).toBe(12);
    expect(dailyStopCount({ stopCount: 12, rowsWritten: 80_000 }, 4)).toBe(12);
  });

  it("never drops below the pinned stops", () => {
    expect(dailyStopCount({ stopCount: 5, rowsWritten: 99_000 }, 4)).toBe(4);
  });
});

describe("nextDistrict", () => {
  it("cycles 유성구 -> 서구 -> 중구 -> 대덕구 -> 동구 -> 유성구", () => {
    expect(nextDistrict(null)).toBe("유성구");
    expect(nextDistrict("유성구")).toBe("서구");
    expect(nextDistrict("동구")).toBe("유성구");
    expect(nextDistrict("세종특별자치시")).toBe("유성구");
  });
});

describe("chooseDailyStops", () => {
  it("day 1 enables 4 pinned + 8 stops from 유성구 and records the day", async () => {
    const db = createTestD1();
    await seedCatalog(db, { 유성구: 70, 서구: 10 });
    const res = await chooseDailyStops(db, T0);

    expect(res).toMatchObject({ day: "2026-10-23", district: "유성구", stopCount: 12, pinned: PINNED, reused: false, rowsWrittenPrev: null });
    expect(res.rotating).toHaveLength(8);
    const on = await enabled(db);
    expect(on).toHaveLength(12);
    expect(on).toEqual(expect.arrayContaining(PINNED));
    expect(await districtOf(db, res.rotating)).toEqual({ 유성구: 8 });
    const day = await db.prepare("SELECT district, stop_count, rotating_count FROM rotation_days WHERE day = ?").bind("2026-10-23").first();
    expect(day).toEqual({ district: "유성구", stop_count: 12, rotating_count: 8 });
  });

  it("a second call on the same KST day keeps the same stops", async () => {
    const db = createTestD1();
    await seedCatalog(db, { 유성구: 70 });
    const first = await chooseDailyStops(db, T0);
    const again = await chooseDailyStops(db, T0 + 60 * 60 * 1000);
    expect(again.reused).toBe(true);
    expect(again.rotating).toEqual(first.rotating);
    expect(await enabled(db)).toHaveLength(12);
  });

  it("day 2 moves to 서구, fills the shortfall from later districts, and disables yesterday's stops", async () => {
    const db = createTestD1();
    await seedCatalog(db, { 유성구: 9, 서구: 3, 중구: 2 });
    const day1 = await chooseDailyStops(db, T0);
    const day2 = await chooseDailyStops(db, T0 + DAY);

    expect(day2.district).toBe("서구");
    // 서구 3 + 중구 2 + 대덕구·동구 0 + 유성구는 안 잰 1곳 먼저, 나머지 2곳은 가장 오래전에 잰 곳
    expect(await districtOf(db, day2.rotating)).toEqual({ 서구: 3, 중구: 2, 유성구: 3 });
    const reused = day2.rotating.filter((id) => day1.rotating.includes(id));
    expect(reused).toHaveLength(2);
    const on = await enabled(db);
    expect(on).toHaveLength(12);
    for (const id of day1.rotating.filter((id) => !day2.rotating.includes(id))) expect(on).not.toContain(id);
  });

  it("counts rows written since yesterday's snapshot and shrinks when it is too many", async () => {
    const db = createTestD1();
    await seedCatalog(db, { 유성구: 200 });
    await chooseDailyStops(db, T0);
    // 하루 동안 85,000행이 쓰인 것처럼 prediction_errors id를 띄운다
    await db
      .prepare(
        "INSERT INTO prediction_errors (id, node_id, route_no, plate_no, lead_bucket_min, predicted_at, error_sec, hour_kst, weekday) VALUES (85000, '8001318', '3', 'p', 5, ?, 0, 9, 4)",
      )
      .bind(kstIso(T0))
      .run();
    const day2 = await chooseDailyStops(db, T0 + DAY);
    expect(day2.rowsWrittenPrev).toBe(85_000);
    // 곳당 85,000 / 12 행 -> 70,000 / 7,083.3 = 9곳
    expect(day2.stopCount).toBe(9);
    expect(await enabled(db)).toHaveLength(9);
  });
});

describe("runMorningCron", () => {
  it("folds errors, picks 12 stops and starts a monitor for each enabled stop", async () => {
    const db = createTestD1();
    await seedCatalog(db, { 유성구: 70 });
    await db
      .prepare(
        "INSERT INTO prediction_errors (node_id, route_no, plate_no, lead_bucket_min, predicted_at, error_sec, hour_kst, weekday) VALUES ('8001318', '3', 'p', 5, ?, -42, 9, 4)",
      )
      .bind(kstIso(T0 - DAY))
      .run();
    const started: string[] = [];
    const env = {
      DB: db,
      STOP_MONITOR: {
        idFromName: (name: string) => name,
        get: () => ({ start: async (nodeId: string) => (started.push(nodeId), { nodeId, nextAlarmAt: "" }) }),
      },
    } as unknown as Env;

    await runMorningCron(env, T0);

    expect(started.sort()).toEqual(await enabled(db));
    expect(started).toHaveLength(12);
    expect(await db.prepare("SELECT node_id, lead_bucket_min, n FROM margin_hist").all()).toMatchObject({
      results: [{ node_id: "8001318", lead_bucket_min: 5, n: 1 }],
    });
  });
});
