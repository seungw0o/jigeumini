import { afterEach, describe, expect, test, vi } from "vitest";
import { parseCoord, parseRoutePair, readFailFlag, readNotifyDeniedFlag, routePairQuery, type RoutePair } from "./routeQuery";

const PAIR: RoutePair = {
  origin: { name: "대덕대학교", position: { lat: 36.39007, lng: 127.362274 } },
  destination: { name: "갤러리아타임월드", position: { lat: 36.35272, lng: 127.37907 } },
};

describe("routeQuery", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  test("round-trips a pair through the query string", () => {
    const params = new URLSearchParams(routePairQuery(PAIR));
    expect(params.get("from")).toBe("36.39007,127.362274");
    expect(parseRoutePair(params)).toEqual(PAIR);
  });

  test("rejects place ids and malformed coordinates", () => {
    expect(parseRoutePair(new URLSearchParams("from=p-daedeok-univ&to=p-galleria"))).toBeNull();
    expect(parseCoord("36.3,")).toBeNull();
    expect(parseCoord("136.3,127.3")).toBeNull();
  });

  test("falls back to generic names when names are missing", () => {
    const pair = parseRoutePair(new URLSearchParams("from=36.39,127.36&to=36.35,127.37"));
    expect(pair?.origin.name).toBe("출발지");
    expect(pair?.destination.name).toBe("도착지");
  });

  test("detects fail flags", () => {
    expect(readFailFlag(new URLSearchParams("fail=arrivals"))).toBe("arrivals");
    expect(readFailFlag(new URLSearchParams("fail=other"))).toBeNull();
    expect(readNotifyDeniedFlag(new URLSearchParams("notify=denied"))).toBe(true);
  });

  test("ignores QA flags in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    expect(readFailFlag(new URLSearchParams("fail=arrivals"))).toBeNull();
    expect(readNotifyDeniedFlag(new URLSearchParams("notify=denied"))).toBe(false);
  });
});
