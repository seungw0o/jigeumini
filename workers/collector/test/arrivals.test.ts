import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchBoardArrivals } from "../src/arrivals";

const seoulFixture = readFileSync(new URL("../../../src/apis/__fixtures__/seoul-arrivals-02004.json", import.meta.url), "utf8");

afterEach(() => vi.unstubAllGlobals());

describe("fetchBoardArrivals", () => {
  it("asks the Seoul API over http for seoul:<ARS> stops", async () => {
    const fetchMock = vi.fn<typeof fetch>(async () => new Response(seoulFixture, { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const arrivals = await fetchBoardArrivals("k", "seoul:02004");
    const url = new URL(String(fetchMock.mock.calls[0][0]));
    expect(url.origin + url.pathname).toBe("http://ws.bus.go.kr/api/rest/stationinfo/getStationByUid");
    expect(url.searchParams.get("arsId")).toBe("02004");
    expect(arrivals.find((a) => a.routeNo === "421")).toMatchObject({ stopNodeId: "seoul:02004", state: { kind: "approaching", etaSeconds: 22 } });
  });

  it("keeps the Daejeon BIS endpoint for 7-digit stops", async () => {
    const fetchMock = vi.fn<typeof fetch>(async () =>
      new Response("<ServiceResult><msgHeader><headerCd>4</headerCd></msgHeader></ServiceResult>", { status: 200 }),
    );
    vi.stubGlobal("fetch", fetchMock);
    await expect(fetchBoardArrivals("k", "8001318")).resolves.toEqual([]);
    expect(new URL(String(fetchMock.mock.calls[0][0])).pathname).toBe("/6300000/arrive/getArrInfoByStopID");
  });
});
