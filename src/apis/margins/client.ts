import type { MarginsResponse } from "./types";

export async function fetchMargins(signal?: AbortSignal): Promise<MarginsResponse> {
  const base = process.env.NEXT_PUBLIC_COLLECTOR_URL;
  if (!base) throw new Error("NEXT_PUBLIC_COLLECTOR_URL is not set");

  const res = await fetch(`${base}/margins`, { signal });
  if (!res.ok) throw new Error(`margins ${res.status}`);

  const body = (await res.json()) as Partial<MarginsResponse> | null;
  if (!body || typeof body !== "object" || !Array.isArray(body.stops)) {
    throw new Error("margins: unexpected shape");
  }
  return body as MarginsResponse;
}
