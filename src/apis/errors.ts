// API 클라이언트가 던지는 유일한 에러. UI는 code로 상태를 고른다 (server-only가 아니라 클라이언트에서도 import 가능).

export type ApiSource = "daejeon" | "tago" | "kakao" | "seoul";

export type ApiErrorCode =
  /** .env.local에 키가 없음 */
  | "MISSING_KEY"
  /** 제한 시간 안에 응답 없음 */
  | "TIMEOUT"
  /** DNS, 연결 끊김 등 응답 자체를 못 받음 */
  | "NETWORK"
  /** 알 수 없는 본문의 2xx 아닌 응답 */
  | "HTTP"
  /** data.go.kr: 등록되지 않았거나 만료된 서비스키 */
  | "SERVICE_KEY_INVALID"
  /** data.go.kr 일일 호출 한도 초과, 카카오 429 */
  | "QUOTA_EXCEEDED"
  /** data.go.kr 그 밖의 서비스 오류 (TAGO resultCode 99 세션 부족 등) */
  | "SERVICE_ERROR"
  /** 카카오: 잘못된 REST 키 (401) */
  | "KAKAO_AUTH"
  /** 카카오: 앱에서 지도/로컬 서비스가 꺼져 있음 (403 disabled OPEN_MAP_AND_LOCAL service) */
  | "KAKAO_SERVICE_DISABLED"
  /** 카카오: 그 밖의 errorType */
  | "KAKAO_ERROR"
  /** 응답 형식을 읽지 못함 */
  | "PARSE";

export class ApiError extends Error {
  readonly code: ApiErrorCode;
  readonly source: ApiSource;
  /** HTTP 상태 코드, 응답을 받은 경우만 */
  readonly status?: number;

  constructor(code: ApiErrorCode, source: ApiSource, message: string, status?: number) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.source = source;
    this.status = status;
  }
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}
