import { fetchMargins } from "@/apis/margins/client";
import type { MarginsResponse } from "@/apis/margins/types";
import { useQuery } from "@tanstack/react-query";

const MARGINS_STALE_MS = 10 * 60_000;

export function useMargins(): MarginsResponse | undefined {
  const { data } = useQuery<MarginsResponse>({
    queryKey: ["margins"],
    queryFn: ({ signal }) => fetchMargins(signal),
    enabled: Boolean(process.env.NEXT_PUBLIC_COLLECTOR_URL),
    staleTime: MARGINS_STALE_MS,
    gcTime: MARGINS_STALE_MS,
    retry: 1,
    refetchOnWindowFocus: false,
  });
  return data;
}
