import "server-only";

import { ApiError, type ApiSource } from "./errors";

export { requestJson, requestText, type RequestOptions } from "./http";

type ApiKeyName = "DATA_GO_KR_KEY" | "KAKAO_REST_KEY";

export function readKey(name: ApiKeyName, source: ApiSource): string {
  const value = process.env[name]?.trim();
  if (!value) throw new ApiError("MISSING_KEY", source, `${name} is not set in .env.local`);
  return value;
}
