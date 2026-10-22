import type { LiveError, LiveErrorResponse } from "@/apis/live/types";

export class LiveFetchError extends Error {
  readonly code: LiveError["code"];

  constructor(code: LiveError["code"], message: string) {
    super(message);
    this.name = "LiveFetchError";
    this.code = code;
  }
}

export async function fetchJson<T>(url: string, signal?: AbortSignal): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, { signal });
  } catch (cause) {
    if (signal?.aborted) throw cause;
    throw new LiveFetchError("NETWORK", cause instanceof Error ? cause.message : "네트워크 오류");
  }
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as Partial<LiveErrorResponse> | null;
    throw new LiveFetchError(body?.error?.code ?? "NETWORK", body?.error?.message ?? `HTTP ${res.status}`);
  }
  return (await res.json()) as T;
}
