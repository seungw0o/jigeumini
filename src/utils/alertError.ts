import { PushError } from "@/apis/push/client";

export const ALERT_LIMIT_MESSAGE = "출발 알림은 최대 5개까지 받을 수 있어요";
export const ALERT_FAILED_MESSAGE = "알림을 켜지 못했어요. 다시 시도해 주세요";

export function alertErrorMessage(error: unknown): string {
  if (error instanceof PushError && error.code === "alerts limit reached") return ALERT_LIMIT_MESSAGE;
  return ALERT_FAILED_MESSAGE;
}
