"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { BackIcon, BusGlyph } from "@/assets/icons";
import { BUS_TYPE_META } from "@/utils/format";
import type { BusLeg, TransitRoute } from "@/utils/types";

function firstBus(route: TransitRoute): BusLeg | undefined {
  return route.legs.find((leg): leg is BusLeg => leg.kind === "bus");
}

function ChipLabel({ route, best }: { route: TransitRoute; best: boolean }) {
  if (best) return <span className="font-semibold">최적</span>;
  const bus = firstBus(route);
  return (
    <span className="inline-flex items-center gap-1 font-semibold">
      {bus && <BusGlyph size={16} className="shrink-0" style={{ color: BUS_TYPE_META[bus.busType].color }} />}
      <span>
        {bus ? `${bus.routeNo}번` : "도보"}
        {route.transferCount > 0 && `+환승${route.transferCount}회`}
      </span>
    </span>
  );
}

export function RouteSwitcher({ routes, currentId }: { routes: TransitRoute[]; currentId: string }) {
  const scrollerRef = useRef<HTMLUListElement>(null);
  const activeRef = useRef<HTMLAnchorElement>(null);

  useEffect(() => {
    const scroller = scrollerRef.current;
    const active = activeRef.current?.parentElement;
    if (!scroller || !active) return;
    const start = active.offsetLeft;
    const end = start + active.offsetWidth;
    const viewEnd = scroller.scrollLeft + scroller.clientWidth;
    if (end > viewEnd) scroller.scrollLeft += end - viewEnd + 12;
    else if (start < scroller.scrollLeft) scroller.scrollLeft = start;
  }, [currentId]);

  return (
    <nav aria-label="경로 선택" className="flex items-center gap-2">
      <Link
        href="/routes"
        aria-label="경로 목록으로"
        className="flex size-11 shrink-0 items-center justify-center rounded-full bg-surface text-ink shadow-float hover:bg-fill lg:size-10 lg:border lg:border-line lg:shadow-none"
      >
        <BackIcon />
      </Link>
      <ul
        ref={scrollerRef}
        className="no-scrollbar relative -my-2 -mr-3 flex min-w-0 flex-1 gap-1.5 overflow-x-auto py-2 pr-3 lg:mr-0 lg:pr-0"
      >
        {routes.map((route, index) => {
          const active = route.id === currentId;
          return (
            <li key={route.id} className="shrink-0">
              <Link
                ref={active ? activeRef : undefined}
                href={`/routes/${route.id}`}
                aria-current={active ? "page" : undefined}
                className={`flex h-10 items-center gap-2 rounded-full px-4 text-sm whitespace-nowrap tabular shadow-float lg:border lg:shadow-none ${
                  active ? "bg-ink text-white lg:border-ink" : "bg-surface text-ink hover:bg-fill lg:border-line"
                }`}
              >
                <ChipLabel route={route} best={index === 0} />
                <span aria-hidden="true" className={`h-3 w-px ${active ? "bg-white/35" : "bg-line-strong"}`} />
                <span>{route.totalMinutes}분</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
