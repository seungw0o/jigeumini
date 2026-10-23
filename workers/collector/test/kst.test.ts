import { describe, expect, test } from "vitest";
import { isCollecting, kstIso, kstParts, nextCollectionStart } from "../src/kst";

/** KST 벽시계 시각 -> epoch ms */
const kst = (day: number, hour: number, minute: number) => Date.UTC(2026, 9, day, hour - 9, minute);

describe("KST collection window 05:30-23:30", () => {
  test("boundaries", () => {
    expect(isCollecting(kst(23, 5, 29))).toBe(false);
    expect(isCollecting(kst(23, 5, 30))).toBe(true);
    expect(isCollecting(kst(23, 23, 29))).toBe(true);
    expect(isCollecting(kst(23, 23, 30))).toBe(false);
    expect(isCollecting(kst(24, 0, 10))).toBe(false);
  });

  test("next start: now inside the window, today 05:30 before it (Cron 05:20), tomorrow 05:30 after it", () => {
    expect(nextCollectionStart(kst(23, 12, 0))).toBe(kst(23, 12, 0));
    expect(nextCollectionStart(kst(23, 5, 20))).toBe(kst(23, 5, 30));
    expect(nextCollectionStart(kst(23, 23, 45))).toBe(kst(24, 5, 30));
    expect(nextCollectionStart(kst(24, 0, 30))).toBe(kst(24, 5, 30));
  });

  test("ISO +09:00 string and weekday across the UTC date line", () => {
    expect(kstIso(kst(24, 5, 30))).toBe("2026-10-24T05:30:00+09:00");
    expect(kstParts(kst(24, 5, 30))).toMatchObject({ day: 24, hour: 5, weekday: 6 });
  });
});
