import type { PlacesResponse } from "@/apis/live/types";
import type { LatLng, Place } from "@/utils/types";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { fetchJson } from "./fetchJson";

const DEBOUNCE_MS = 250;
const round3 = (n: number) => Number(n.toFixed(3));

export function usePlaceSearch(
  query: string,
  options?: { near?: LatLng | null; enabled?: boolean },
): { places: Place[]; isFetching: boolean; isError: boolean } {
  const trimmed = query.trim();
  const [debounced, setDebounced] = useState(trimmed);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(trimmed), DEBOUNCE_MS);
    return () => clearTimeout(id);
  }, [trimmed]);

  const near = options?.near ? { lat: round3(options.near.lat), lng: round3(options.near.lng) } : null;
  const result = useQuery({
    queryKey: ["places", debounced, near],
    queryFn: ({ signal }) => {
      const params = new URLSearchParams({ q: debounced });
      if (near) {
        params.set("lat", String(near.lat));
        params.set("lng", String(near.lng));
      }
      return fetchJson<PlacesResponse>(`/api/places?${params}`, signal);
    },
    enabled: debounced !== "" && options?.enabled !== false,
    staleTime: 5 * 60_000,
    placeholderData: keepPreviousData,
  });

  return {
    places: trimmed === "" ? [] : (result.data?.places ?? []),
    isFetching: result.isFetching,
    isError: result.isError,
  };
}
