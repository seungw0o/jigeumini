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
  it("first day or unknown rows -> 60", () => {
    expect(dailyStopCount(null, 4)).toBe(MAX_DAILY_STOPS);
    expect(dailyStopCount({ stopCount: 30, rowsWritten: null }, 4)).toBe(60);
  });

  it("over 80% of the 100k rows limit shrinks to 70% of the limit", () => {
    // 60곳이 90,000행 -> 곳당 1,500행 -> 70,000 / 1,500 = 46곳
    expect(dailyStopCount({ stopCount: 60, rowsWritten: 90_000 }, 4)).toBe(46);
  });

  it("recovers by 8 a day and never exceeds 60", () => {
    expect(dailyStopCount({ stopCount: 46, rowsWritten: 50_000 }, 4)).toBe(54);
    expect(dailyStopCount({ stopCount: 58, rowsWritten: 50_000 }, 4)).toBe(60);
    expect(dailyStopCount({ stopCount: 60, rowsWritten: 80_000 }, 4)).toBe(60);
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
  it("day 1 enables 4 pinned + 56 stops from 유성구 and records the day", async () => {
    const db = createTestD1();
    await seedCatalog(db, { 유성구: 70, 서구: 10 });
    const res = await chooseDailyStops(db, T0);

    expect(res).toMatchObject({ day: "2026-10-23", district: "유성구", stopCount: 60, pinned: PINNED, reused: false, rowsWrittenPrev: null });
    expect(res.rotating).toHaveLength(56);
    const on = await enabled(db);
    expect(on).toHaveLength(60);
    expect(on).toEqual(expect.arrayContaining(PINNED));
    expect(await districtOf(db, res.rotating)).toEqual({ 유성구: 56 });
    const day = await db.prepare("SELECT district, stop_count, rotating_count FROM rotation_days WHERE day = ?").bind("2026-10-23").first();
    expect(day).toEqual({ district: "유성구", stop_count: 60, rotating_count: 56 });
  });

  it("a second call on the same KST day keeps the same stops", async () => {
    const db = createTestD1();
    await seedCatalog(db, { 유성구: 70 });
    const first = await chooseDailyStops(db, T0);
    const again = await chooseDailyStops(db, T0 + 60 * 60 * 1000);
    expect(again.reused).toBe(true);
    expect(again.rotating).toEqual(first.rotating);
    expect(await enabled(db)).toHaveLength(60);
  });

  it("day 2 moves to 서구, fills the shortfall from later districts, and disables yesterday's stops", async () => {
    const db = createTestD1();
    await seedCatalog(db, { 유성구: 70, 서구: 10, 중구: 20 });
    const day1 = await chooseDailyStops(db, T0);
    const day2 = await chooseDailyStops(db, T0 + DAY);

    expect(day2.district).toBe("서구");
    // 서구 10 + 중구 20 + 대덕구·동구 0 + 유성구는 안 잰 14곳 먼저, 나머지 12곳은 가장 오래전에 잰 곳
    expect(await districtOf(db, day2.rotating)).toEqual({ 서구: 10, 중구: 20, 유성구: 26 });
    const reused = day2.rotating.filter((id) => day1.rotating.includes(id));
    expect(reused).toHaveLength(12);
    const on = await enabled(db);
    expect(on).toHaveLength(60);
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
    // 곳당 85,000 / 60 행 -> 70,000 / 1,416.7 = 49곳
    expect(day2.stopCount).toBe(49);
    expect(await enabled(db)).toHaveLength(49);
  });
});

describe("runMorningCron", () => {
  it("folds errors, picks 60 stops and starts a monitor for each enabled stop", async () => {
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
    expect(started).toHaveLength(60);
    expect(await db.prepare("SELECT node_id, lead_bucket_min, n FROM margin_hist").all()).toMatchObject({
      results: [{ node_id: "8001318", lead_bucket_min: 5, n: 1 }],
    });
  });
});
