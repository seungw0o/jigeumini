"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { BackIcon } from "@/assets/icons";
import type { BusLeg, TransitRoute } from "@/utils/types";

function chipLabel(route: TransitRoute): string {
  const routeNos = route.legs
    .filter((leg): leg is BusLeg => leg.kind === "bus")
    .map((leg) => leg.routeNo)
    .join("→");
  return `${route.arriveAt} 도착 · ${routeNos}`;
}

export function RouteSwitcher({ routes, currentId }: { routes: TransitRoute[]; currentId: string }) {
  const scrollerRef = useRef<HTMLUListElement>(null);
  const activeRef = useRef<HTMLAnchorElement>(null);

  useEffect(() => {
    const scroller = scrollerRef.current;
    const active = activeRef.current;
    if (!scroller || !active) return;
    const overflowRight = active.offsetLeft + active.offsetWidth - (scroller.scrollLeft + scroller.clientWidth);
    if (overflowRight > 0) scroller.scrollLeft += overflowRight + 8;
  }, [currentId]);

  return (
    <nav
      aria-label="경로 선택"
      className="flex items-center gap-1 rounded-lg bg-surface/95 p-1 shadow-float lg:rounded-none lg:bg-transparent lg:p-0 lg:shadow-none"
    >
      <Link
        href="/routes"
        aria-label="경로 목록으로"
        className="flex size-11 shrink-0 items-center justify-center rounded-md text-ink hover:bg-canvas"
      >
        <BackIcon />
      </Link>
      <ul
        ref={scrollerRef}
        className="flex min-w-0 flex-1 gap-1.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {routes.map((route) => {
          const active = route.id === currentId;
          return (
            <li key={route.id} className="shrink-0">
              <Link
                ref={active ? activeRef : undefined}
                href={`/routes/${route.id}`}
                aria-current={active ? "page" : undefined}
                className="group flex min-h-11 items-center rounded-md"
              >
                <span
                  className={`inline-flex h-10 items-center rounded-md border px-3 text-sm font-semibold whitespace-nowrap tabular ${
                    active ? "border-ink bg-ink text-white" : "border-line bg-surface text-ink-2 group-hover:bg-canvas"
                  }`}
                >
                  {chipLabel(route)}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
