"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { MapView } from "@/components/MapView";
import { RouteSearchBar } from "@/components/RouteSearchBar";
import { EmptyState } from "@/components/StateViews";
import { useGeolocation } from "@/hooks/useGeolocation";
import { useRecentSearches } from "@/hooks/useRecentSearches";
import { placeToRouteEnd, routePairQuery } from "@/utils/routeQuery";
import type { Place } from "@/utils/types";
import { RoutesLayout } from "./RoutesLayout";

type Ends = { origin: Place | null; destination: Place | null };

export function RoutesEmptyScreen() {
  const router = useRouter();
  const geo = useGeolocation(true);
  const { recent, addRecent } = useRecentSearches();
  const [places, setPlaces] = useState<Ends>({ origin: null, destination: null });
  // RouteSearchBar는 onChange 직후 같은 이벤트에서 onSubmit을 부르므로 최신 값을 따로 들고 있는다
  const latest = useRef(places);

  function change(next: Ends) {
    const picked = [next.destination, next.origin].filter(
      (p): p is Place => p !== null && p.id !== "current" && p.id !== latest.current.origin?.id && p.id !== latest.current.destination?.id,
    );
    if (picked.length > 0) addRecent(...picked);
    latest.current = next;
    setPlaces(next);
  }

  function submit() {
    const { origin, destination } = latest.current;
    if (!origin || !destination) return;
    router.replace(`/routes?${routePairQuery({ origin: placeToRouteEnd(origin), destination: placeToRouteEnd(destination) })}`);
  }

  return (
    <>
      <h1 className="sr-only">경로 검색</h1>
      <RoutesLayout
        header={
          <div className="border-b border-divider px-4 pt-3 pb-3 lg:pt-0">
            <RouteSearchBar
              compact
              origin={places.origin}
              destination={places.destination}
              onChange={change}
              onSubmit={submit}
              onBack={() => router.push("/")}
              currentPosition={geo.position}
              recent={recent}
            />
          </div>
        }
        map={<MapView label="경로 지도" center={geo.position ?? undefined} />}
      >
        <div className="pt-3">
          <div className="mx-4 overflow-hidden rounded-lg bg-surface shadow-card">
            <EmptyState title="출발지와 도착지를 검색해 주세요" message="대전·서울 시내버스 경로를 실시간 도착 정보로 찾아 드려요." />
          </div>
        </div>
      </RoutesLayout>
    </>
  );
}
