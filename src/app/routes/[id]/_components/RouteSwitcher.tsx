"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { BackIcon } from "@/assets/icons";
import { Logo } from "@/assets/Logo";
import { formatShortClock } from "@/utils/ribbon";
import type { TransitRoute } from "@/utils/types";
import { BusSequence } from "./RouteSummary";

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
    <div>
      <div className="mb-3 hidden lg:flex">
        <Logo size="sm" />
      </div>
      <nav aria-label="경로 선택" className="flex items-center gap-2">
        <Link
          href="/routes"
          aria-label="경로 목록으로"
          className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-surface text-ink shadow-float hover:bg-fill lg:border lg:border-line lg:shadow-none"
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
                  href={`/routes/${route.id}`}
                  aria-current={active ? "page" : undefined}
                  className={`relative flex h-10 items-center gap-2 rounded-md border bg-surface pr-3 pl-2.5 text-13 whitespace-nowrap tabular shadow-float lg:shadow-none ${
                    active
                      ? "border-brand-ink text-ink ring-1 ring-brand-ink ring-inset"
                      : "border-line text-ink-2 hover:bg-fill"
                  }`}
                >
                  <span
                    aria-hidden="true"
                    className={`h-4 w-1 shrink-0 rounded-xs ${active ? "bg-brand" : "bg-line-strong"}`}
                  />
                  <BusSequence route={route} size="sm" />
                  <span>
                    <span className={active ? "font-bold" : "font-semibold"}>{formatShortClock(route.arriveAt)}</span>{" "}
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
