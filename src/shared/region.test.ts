import { describe, expect, test } from "vitest";
import { isStopId, REGION_CENTERS, regionOf, routeNoKey, seoulArsIdOf, seoulStopId, stopRegionOf } from "./region";

describe("regionOf", () => {
  test("Daejeon, Seoul, and outside both", () => {
    expect(regionOf(REGION_CENTERS.daejeon)).toBe("daejeon");
    expect(regionOf({ lat: 36.39007, lng: 127.362274 })).toBe("daejeon");
    expect(regionOf(REGION_CENTERS.seoul)).toBe("seoul");
    expect(regionOf({ lat: 37.4979, lng: 127.0276 })).toBe("seoul");
    expect(regionOf({ lat: 35.1796, lng: 129.0756 })).toBeNull();
  });
});

describe("stop ids", () => {
  test("Daejeon ids stay 7 digits, Seoul ids are seoul:<5-digit ARS>", () => {
    expect(seoulStopId("02004")).toBe("seoul:02004");
    expect(seoulArsIdOf("seoul:02004")).toBe("02004");
    expect(seoulArsIdOf("8001318")).toBeNull();
    expect(stopRegionOf("8001318")).toBe("daejeon");
    expect(stopRegionOf("seoul:02004")).toBe("seoul");
    expect(["8001318", "seoul:02004", "seoul:2004", "800131", "busan:12345"].map(isStopId)).toEqual([true, true, false, false, false]);
  });
});

describe("routeNoKey", () => {
  test("Seoul drops Kakao's parenthesized suffix, Daejeon only drops spaces", () => {
    expect(routeNoKey("N75(심야)", "seoul:02004")).toBe("N75");
    expect(routeNoKey("급행 3", "8001318")).toBe("급행3");
    expect(routeNoKey("3(급행)", "8001318")).toBe("3(급행)");
  });
});
