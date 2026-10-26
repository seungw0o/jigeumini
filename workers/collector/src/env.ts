import type { AlertMonitor } from "./alert-monitor";
import type { StopMonitor } from "./monitor";

export interface Env {
  DB: D1Database;
  STOP_MONITOR: DurableObjectNamespace<StopMonitor>;
  ALERT_MONITOR: DurableObjectNamespace<AlertMonitor>;
  DATA_GO_KR_KEY?: string;
  ADMIN_TOKEN?: string;
  /** 쉼표로 구분한 Firebase 프로젝트 ID (dev, prod). ID 토큰의 aud, iss 검증에 쓴다 (wrangler [vars]) */
  FIREBASE_PROJECT_IDS: string;
  /** CORS 허용 Origin, 쉼표로 구분 (wrangler [vars]) */
  ALLOWED_ORIGINS?: string;
  /** 웹 푸시 VAPID 키 (base64url). 공개키는 앱 NEXT_PUBLIC_VAPID_PUBLIC_KEY와 같은 값, 비밀키는 wrangler secret / 로컬 .dev.vars */
  VAPID_PUBLIC_KEY?: string;
  VAPID_PRIVATE_KEY?: string;
  /** VAPID sub 클레임: mailto: 또는 https: 연락처 (wrangler [vars]) */
  VAPID_SUBJECT?: string;
}
