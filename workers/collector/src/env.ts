import type { StopMonitor } from "./monitor";

export interface Env {
  DB: D1Database;
  STOP_MONITOR: DurableObjectNamespace<StopMonitor>;
  DATA_GO_KR_KEY?: string;
  ADMIN_TOKEN?: string;
  /** Firebase 프로젝트 ID. ID 토큰의 aud, iss 검증에 쓴다 (wrangler [vars]) */
  FIREBASE_PROJECT_ID: string;
  /** CORS 허용 Origin, 쉼표로 구분 (wrangler [vars]) */
  ALLOWED_ORIGINS?: string;
}
