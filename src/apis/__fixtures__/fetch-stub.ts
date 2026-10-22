import { readFileSync } from "node:fs";

export function fixture(name: string): string {
  return readFileSync(new URL(`./${name}`, import.meta.url), "utf8");
}

export interface StubResponse {
  body: string;
  status?: number;
  contentType?: string;
}

export interface RecordedCall {
  url: URL;
  headers: Headers;
}

const originalFetch = globalThis.fetch;
const TEST_KEYS = { DATA_GO_KR_KEY: "test-data-key", KAKAO_REST_KEY: "test-kakao-key" } as const;
const savedKeys: Partial<Record<keyof typeof TEST_KEYS, string | undefined>> = {};

export function useTestKeys(): void {
  for (const name of Object.keys(TEST_KEYS) as (keyof typeof TEST_KEYS)[]) {
    savedKeys[name] = process.env[name];
    process.env[name] = TEST_KEYS[name];
  }
}

export function stubFetch(respond: (url: URL, signal: AbortSignal | undefined) => StubResponse | Promise<StubResponse>) {
  const calls: RecordedCall[] = [];
  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    calls.push({ url, headers: new Headers(init?.headers) });
    const response = await respond(url, init?.signal ?? undefined);
    return new Response(response.body, {
      status: response.status ?? 200,
      headers: { "content-type": response.contentType ?? "application/json" },
    });
  }) as typeof fetch;
  return calls;
}

export function restoreAll(): void {
  globalThis.fetch = originalFetch;
  for (const [name, value] of Object.entries(savedKeys)) {
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  }
}
