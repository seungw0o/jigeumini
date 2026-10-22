import { describe, expect, test } from "vitest";
import { DEFAULT_ROUTE_PAIR, isMockMode, parseCoord, parseRoutePair, readFailFlag, routePairQuery } from "./routeQuery";

describe("routeQuery", () => {
  test("round-trips a pair through the query string", () => {
    const params = new URLSearchParams(routePairQuery(DEFAULT_ROUTE_PAIR));
    expect(params.get("from")).toBe("36.39007,127.362274");
    expect(parseRoutePair(params)).toEqual(DEFAULT_ROUTE_PAIR);
  });

  test("rejects mock place ids and malformed coordinates", () => {
    expect(parseRoutePair(new URLSearchParams("from=p-daedeok-univ&to=p-galleria"))).toBeNull();
    expect(parseCoord("36.3,")).toBeNull();
    expect(parseCoord("136.3,127.3")).toBeNull();
  });

  test("falls back to generic names when names are missing", () => {
    const pair = parseRoutePair(new URLSearchParams("from=36.39,127.36&to=36.35,127.37"));
    expect(pair?.origin.name).toBe("출발지");
    expect(pair?.destination.name).toBe("도착지");
  });

  test("detects mock mode and fail flags", () => {
    expect(isMockMode(new URLSearchParams("mock=1"))).toBe(true);
    expect(isMockMode(new URLSearchParams("state=empty"))).toBe(true);
    expect(isMockMode(new URLSearchParams(""))).toBe(false);
    expect(readFailFlag(new URLSearchParams("fail=arrivals"))).toBe("arrivals");
    expect(readFailFlag(new URLSearchParams("fail=other"))).toBeNull();
  });
});
