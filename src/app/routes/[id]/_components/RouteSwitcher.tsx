"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { BackIcon } from "@/assets/icons";
import { Logo } from "@/assets/Logo";
import { formatShortClock } from "@/utils/ribbon";
import type { TransitRoute } from "@/utils/types";
import { BusSequence } from "./RouteSummary";

export function RouteSwitcher({
  routes,
  currentId,
  query,
}: {
  routes: TransitRoute[];
  currentId: string;
  query?: string;
}) {
  const suffix = query ? `?${query}` : "";
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
    <div>
      <div className="mb-3 hidden lg:flex">
        <Logo size="sm" />
      </div>
      <nav aria-label="경로 선택" className="flex items-center gap-2">
        <Link
          href={`/routes${suffix}`}
          aria-label="경로 목록으로"
          className="flex size-11 shrink-0 items-center justify-center rounded-full bg-surface text-fg shadow-float hover:bg-surface-muted lg:bg-action-secondary lg:shadow-none lg:hover:bg-action-secondary-pressed"
        >
          <BackIcon />
        </Link>
        <ul
          ref={scrollerRef}
          className="no-scrollbar relative -my-2 -mr-3 flex min-w-0 flex-1 gap-1.5 overflow-x-auto py-2 pr-3 lg:mr-0 lg:pr-0"
        >
          {routes.map((route) => {
            const active = route.id === currentId;
            return (
              <li key={route.id} className="shrink-0">
                <Link
                  ref={active ? activeRef : undefined}
                  href={`/routes/${route.id}${suffix}`}
                  aria-current={active ? "page" : undefined}
                  className={`flex h-11 items-center gap-2 rounded-full border px-3.5 text-xs whitespace-nowrap tabular shadow-float lg:shadow-none ${
                    active
                      ? "border-surface-inverse bg-surface-inverse text-fg-inverse"
                      : "border-border bg-surface text-fg-secondary hover:bg-surface-muted"
                  }`}
                >
                  <BusSequence route={route} size="sm" />
                  <span>
                    약 <span className={active ? "font-bold" : "font-semibold"}>{formatShortClock(route.arriveAt)}</span>{" "}
                    도착
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}
