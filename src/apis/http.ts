// Next 서버와 Cloudflare Worker가 함께 쓴다: server-only, next/*, process.env 금지 (eslint.config.mjs가 막는다).

import { ApiError, type ApiSource } from "./errors";
import { readXmlTag } from "./xml";

const DEFAULT_TIMEOUT_MS = 5000;

export interface RequestOptions {
  headers?: Record<string, string>;
  timeoutMs?: number;
}

/** 응답 본문 텍스트. 키가 들어간 URL은 에러 메시지에 절대 넣지 않는다 */
export async function requestText(source: ApiSource, url: URL, options: RequestOptions = {}): Promise<string> {
  let response: Response;
  try {
    response = await fetch(url, {
      headers: options.headers,
      signal: AbortSignal.timeout(options.timeoutMs ?? DEFAULT_TIMEOUT_MS),
    });
  } catch (error) {
    if (error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError")) {
      throw new ApiError("TIMEOUT", source, `${url.pathname} timed out`);
    }
    throw new ApiError("NETWORK", source, `${url.pathname} request failed`);
  }

  let body: string;
  try {
    body = await response.text();
  } catch {
    throw new ApiError("NETWORK", source, `${url.pathname} body could not be read`, response.status);
  }

  if (body.includes("OpenAPI_ServiceResponse")) throw dataGoKrServiceError(source, body, response.status);
  if (source === "kakao" && !response.ok) throw kakaoError(body, response.status);
  if (!response.ok) throw new ApiError("HTTP", source, `${url.pathname} responded ${response.status}`, response.status);
  return body;
}

export async function requestJson(source: ApiSource, url: URL, options?: RequestOptions): Promise<unknown> {
  const body = await requestText(source, url, options);
  try {
    return JSON.parse(body);
  } catch {
    throw new ApiError("PARSE", source, `${url.pathname} returned non-JSON body`);
  }
}

// data.go.kr 게이트웨이 공통 에러. XML(대전)이나 JSON(TAGO, _type=json)으로 오고, 실제로는 HTTP 403과 함께 왔다.
// 에러 토큰이 errMsg에 오기도(2026-10-22 관측) returnAuthMsg에 오기도 해서 둘 다 본다.
function dataGoKrServiceError(source: ApiSource, body: string, status: number): ApiError {
  let fields: { errMsg?: string; returnAuthMsg?: string; returnReasonCode?: string };
  if (body.trimStart().startsWith("{")) {
    try {
      fields = JSON.parse(body).OpenAPI_ServiceResponse?.cmmMsgHeader ?? {};
    } catch {
      return new ApiError("PARSE", source, "unreadable OpenAPI_ServiceResponse", status);
    }
  } else {
    fields = {
      errMsg: readXmlTag(body, "errMsg"),
      returnAuthMsg: readXmlTag(body, "returnAuthMsg"),
      returnReasonCode: readXmlTag(body, "returnReasonCode"),
    };
  }
  const text = `${fields.errMsg ?? ""} ${fields.returnAuthMsg ?? ""}`;
  const reason = String(fields.returnReasonCode ?? "").trim();
  const message = `${(fields.errMsg ?? "SERVICE ERROR").trim()} (${reason || "no reason code"})`;

  if (/SERVICE_KEY_IS_NOT_REGISTERED|DEADLINE_HAS_EXPIRED/.test(text) || reason === "30" || reason === "31") {
    return new ApiError("SERVICE_KEY_INVALID", source, message, status);
  }
  if (/LIMITED_NUMBER_OF_SERVICE_REQUESTS_EXCEEDS/.test(text) || reason === "22") {
    return new ApiError("QUOTA_EXCEEDED", source, message, status);
  }
  return new ApiError("SERVICE_ERROR", source, message, status);
}

function kakaoError(body: string, status: number): ApiError {
  let errorType = "";
  let message = `kakao responded ${status}`;
  try {
    const parsed = JSON.parse(body) as { errorType?: unknown; message?: unknown };
    if (typeof parsed.errorType === "string") errorType = parsed.errorType;
    if (typeof parsed.message === "string") message = `${errorType}: ${parsed.message}`;
  } catch {
    return new ApiError("HTTP", "kakao", message, status);
  }
  if (status === 403 && /disabled/i.test(message)) return new ApiError("KAKAO_SERVICE_DISABLED", "kakao", message, status);
  if (status === 401) return new ApiError("KAKAO_AUTH", "kakao", message, status);
  if (status === 429) return new ApiError("QUOTA_EXCEEDED", "kakao", message, status);
  return new ApiError("KAKAO_ERROR", "kakao", message, status);
}
