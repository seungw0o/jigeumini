import { describe, expect, it } from "vitest";
import { nearestRank } from "../src/db";
import { kstIso } from "../src/kst";
import { binIndex, emptyHist, addToHist, foldNewErrors, HIST_LENGTH, histPercentile, parseHist } from "../src/margin-hist";
import { createTestD1 } from "./d1-sqlite";

type DB = ReturnType<typeof createTestD1>;
import { T0 } from "./helpers";

async function seed(db: DB, rows: { node?: string; lead: number; err: number }[]) {
  for (const r of rows) {
    await db
      .prepare(
        "INSERT INTO prediction_errors (node_id, route_no, plate_no, lead_bucket_min, predicted_at, error_sec, hour_kst, weekday) VALUES (?, '3', 'p', ?, ?, ?, 9, 4)",
      )
      .bind(r.node ?? "8001318", r.lead, kstIso(T0), r.err)
      .run();
  }
}

const histRow = (db: DB, node: string, lead: number) =>
  db.prepare("SELECT n, bins FROM margin_hist WHERE node_id = ? AND lead_bucket_min = ?").bind(node, lead).first<{ n: number; bins: string }>();

describe("bins", () => {
  it("puts boundaries in the right bin, overflow at both ends", () => {
    expect(binIndex(-1201)).toBe(0);
    expect(binIndex(-1200)).toBe(1);
    expect(binIndex(-1191)).toBe(1);
    expect(binIndex(-1190)).toBe(2);
    expect(binIndex(0)).toBe(121);
    expect(binIndex(1199)).toBe(HIST_LENGTH - 2);
    expect(binIndex(1200)).toBe(HIST_LENGTH - 1);
  });

  it("histogram P10 is the raw nearest-rank P10 rounded down to its 10-second bin", () => {
    // 고정 시드 LCG로 만든 -300..299초 값 97개
    let seed = 7;
    const values = Array.from({ length: 97 }, () => {
      seed = (seed * 1103515245 + 12345) % 2 ** 31;
      return (seed % 600) - 300;
    });
    const hist = emptyHist();
    for (const v of values) addToHist(hist, v);
    const raw = nearestRank(values, 0.1);
    expect(histPercentile(hist, 0.1)).toBe(Math.floor(raw / 10) * 10);
  });

  it("parseHist rejects a wrong length or negative counts", () => {
    expect(() => parseHist("[1,2]")).toThrow("bad bins");
    expect(() => parseHist(JSON.stringify(emptyHist().map((_, i) => (i === 3 ? -1 : 0))))).toThrow("bad bins");
    expect(parseHist(JSON.stringify(emptyHist()))).toHaveLength(HIST_LENGTH);
  });
});

describe("foldNewErrors", () => {
  it("folds only rows added since the last fold, so nothing is counted twice", async () => {
    const db = createTestD1();
    await seed(db, [
      { lead: 5, err: -30 },
      { lead: 5, err: 10 },
      { lead: 3, err: -5 },
    ]);
    expect(await foldNewErrors(db, T0)).toEqual({ fromId: 0, toId: 3, rows: 3, keys: 2 });

    await seed(db, [
      { lead: 5, err: -90 },
      { node: "8002452", lead: 10, err: 0 },
    ]);
    expect(await foldNewErrors(db, T0)).toEqual({ fromId: 3, toId: 5, rows: 2, keys: 2 });
    expect(await foldNewErrors(db, T0)).toEqual({ fromId: 5, toId: 5, rows: 0, keys: 0 });

    const lead5 = await histRow(db, "8001318", 5);
    expect(lead5?.n).toBe(3);
    expect(histPercentile(parseHist(lead5!.bins), 0.1)).toBe(-90);
    expect((await histRow(db, "8001318", 3))?.n).toBe(1);
    expect((await histRow(db, "8002452", 10))?.n).toBe(1);
  });
});
