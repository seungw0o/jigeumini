import type { StopMonitor } from "./monitor";

export interface Env {
  DB: D1Database;
  STOP_MONITOR: DurableObjectNamespace<StopMonitor>;
  DATA_GO_KR_KEY?: string;
  ADMIN_TOKEN?: string;
}
