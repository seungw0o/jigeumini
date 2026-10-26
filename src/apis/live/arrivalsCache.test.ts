import { describe, expect, test, vi } from "vitest";
import type { DaejeonArrival } from "../daejeon/types";
import { createArrivalsCache } from "./arrivalsCache";

const bus = (etaSeconds: number): DaejeonArrival => ({
  routeCd: "1",
  routeNo: "402",
  routeType: "trunk",
  destination: "",
  stopNodeId: "seoul:02005",
  arsId: "02005",
  stopName: "서울역버스환승센터",
  plateNo: null,
  lastStopNodeId: null,
  runType: null,
  state: { kind: "approaching", phase: "minutesAway", etaSeconds, stopsAway: 3 },
  infoAt: null,
});

function setup() {
  let now = 1_000_000;
  const load = vi.fn<(stopId: string) => Promise<DaejeonArrival[]>>(async () => [bus(300)]);
  const cache = createArrivalsCache({ ttlMs: 25_000, load, now: () => now });
  return { cache, load, advance: (ms: number) => (now += ms) };
}

describe("createArrivalsCache", () => {
  test("concurrent and repeated reads inside the ttl share one upstream call", async () => {
    const { cache, load, advance } = setup();
    await Promise.all([cache.get("02005"), cache.get("02005")]);
    advance(10_000);
    await cache.get("02005");
    expect(load).toHaveBeenCalledTimes(1);
  });

  test("a cached read lowers the ETA by the seconds since it was fetched", async () => {
    const { cache, advance } = setup();
    await cache.get("02005");
    advance(12_400);
    const [arrival] = await cache.get("02005");
    expect(arrival.state).toMatchObject({ etaSeconds: 288 });
  });

  test("reloads after the ttl and keeps stops apart", async () => {
    const { cache, load, advance } = setup();
    await cache.get("02005");
    await cache.get("02004");
    advance(25_000);
    await cache.get("02005");
    expect(load.mock.calls.map(([id]) => id)).toEqual(["02005", "02004", "02005"]);
  });

  test("a failed load is not cached", async () => {
    const { cache, load } = setup();
    load.mockRejectedValueOnce(new Error("timeout"));
    await expect(cache.get("02005")).rejects.toThrow("timeout");
    await expect(cache.get("02005")).resolves.toHaveLength(1);
    expect(load).toHaveBeenCalledTimes(2);
  });
});
