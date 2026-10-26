import { describe, expect, it } from "vitest";
import { PushError } from "@/apis/push/client";
import { ALERT_FAILED_MESSAGE, ALERT_LIMIT_MESSAGE, alertErrorMessage } from "@/utils/alertError";

describe("alertErrorMessage", () => {
  it("maps the Worker's pending-alert limit to the limit message", () => {
    expect(alertErrorMessage(new PushError(409, "alerts limit reached"))).toBe(ALERT_LIMIT_MESSAGE);
  });

  it.each([
    ["no subscription", new PushError(409, "no subscription")],
    ["network", new PushError(0, "network")],
    ["server error", new PushError(500, "http_500")],
    ["plain error", new Error("route plan or user unavailable")],
    ["non-error value", "boom"],
  ])("falls back to the retry message for %s", (_label, error) => {
    expect(alertErrorMessage(error)).toBe(ALERT_FAILED_MESSAGE);
  });
});
