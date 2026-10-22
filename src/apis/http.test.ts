import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { fixture, restoreAll, stubFetch, useTestKeys } from "./__fixtures__/fetch-stub";
import { readKey, requestJson, requestText } from "./http.server";

const DATA_URL = new URL("https://apis.data.go.kr/6300000/arrive/getArrInfoByStopID?serviceKey=test-data-key");
const KAKAO_URL = new URL("https://dapi.kakao.com/v2/local/search/keyword.json?query=x");

beforeEach(useTestKeys);
afterEach(restoreAll);

describe("readKey", () => {
  test("MISSING_KEY names the variable, not a value", () => {
    delete process.env.KAKAO_REST_KEY;
    let caught: unknown;
    try {
      readKey("KAKAO_REST_KEY", "kakao");
    } catch (error) {
      caught = error;
    }
    expect(caught).toMatchObject({ code: "MISSING_KEY", source: "kakao", message: "KAKAO_REST_KEY is not set in .env.local" });
  });
});

describe("requestText error codes", () => {
  test("TIMEOUT when the server does not answer within timeoutMs", async () => {
    stubFetch(
      (_url, signal) =>
        new Promise((_resolve, reject) => {
          signal?.addEventListener("abort", () => reject(signal.reason));
        }),
    );
    await expect(requestText("daejeon", DATA_URL, { timeoutMs: 20 })).rejects.toMatchObject({ code: "TIMEOUT" });
  });

  test("NETWORK when fetch itself fails, without leaking the key", async () => {
    stubFetch(() => {
      throw new TypeError("connect ECONNREFUSED");
    });
    const error = await requestText("daejeon", DATA_URL).catch((caught: unknown) => caught);
    expect(error).toMatchObject({ code: "NETWORK" });
    expect(String((error as Error).message)).not.toContain("test-data-key");
  });

  test("HTTP for a non-2xx response with an unknown body", async () => {
    stubFetch(() => ({ body: "<html>bad gateway</html>", status: 502, contentType: "text/html" }));
    await expect(requestText("tago", DATA_URL)).rejects.toMatchObject({ code: "HTTP", status: 502 });
  });

  test("SERVICE_KEY_INVALID from the real data.go.kr XML wrapper (403)", async () => {
    stubFetch(() => ({ body: fixture("daejeon-badkey.xml"), status: 403, contentType: "application/xml" }));
    await expect(requestText("daejeon", DATA_URL)).rejects.toMatchObject({
      code: "SERVICE_KEY_INVALID",
      source: "daejeon",
      status: 403,
    });
  });

  test("SERVICE_KEY_INVALID from the real data.go.kr JSON wrapper (TAGO, 403)", async () => {
    stubFetch(() => ({ body: fixture("tago-badkey.json"), status: 403 }));
    await expect(requestText("tago", DATA_URL)).rejects.toMatchObject({ code: "SERVICE_KEY_INVALID", source: "tago" });
  });

  test("QUOTA_EXCEEDED from the classic wrapper layout (constructed: token in returnAuthMsg, code 22)", async () => {
    const body = `<OpenAPI_ServiceResponse><cmmMsgHeader><errMsg>SERVICE ERROR</errMsg>
      <returnAuthMsg>LIMITED_NUMBER_OF_SERVICE_REQUESTS_EXCEEDS_ERROR</returnAuthMsg>
      <returnReasonCode>22</returnReasonCode></cmmMsgHeader></OpenAPI_ServiceResponse>`;
    stubFetch(() => ({ body, status: 200, contentType: "text/xml" }));
    await expect(requestText("daejeon", DATA_URL)).rejects.toMatchObject({ code: "QUOTA_EXCEEDED" });
  });

  test("KAKAO_AUTH from the real 401 AccessDeniedError", async () => {
    stubFetch(() => ({ body: fixture("kakao-badkey.json"), status: 401 }));
    await expect(requestText("kakao", KAKAO_URL)).rejects.toMatchObject({ code: "KAKAO_AUTH", status: 401 });
  });

  test("KAKAO_SERVICE_DISABLED for 403 disabled OPEN_MAP_AND_LOCAL (constructed from the brief's message)", async () => {
    const body = JSON.stringify({ errorType: "NotAuthorizedError", message: "App(jigeumini) disabled OPEN_MAP_AND_LOCAL service." });
    stubFetch(() => ({ body, status: 403 }));
    await expect(requestText("kakao", KAKAO_URL)).rejects.toMatchObject({ code: "KAKAO_SERVICE_DISABLED" });
  });

  test("KAKAO_ERROR for other Kakao errorTypes", async () => {
    stubFetch(() => ({ body: JSON.stringify({ errorType: "InvalidArgument", message: "start_x is required" }), status: 400 }));
    await expect(requestText("kakao", KAKAO_URL)).rejects.toMatchObject({ code: "KAKAO_ERROR", status: 400 });
  });

  test("PARSE when a JSON endpoint returns something else", async () => {
    stubFetch(() => ({ body: "<html>maintenance</html>", status: 200, contentType: "text/html" }));
    await expect(requestJson("tago", DATA_URL)).rejects.toMatchObject({ code: "PARSE" });
  });
});
