import Link from "next/link";
import type { ReactNode } from "react";
import { Logo } from "@/assets/Logo";

export function RoutesLayout({ header, children, map }: { header: ReactNode; children: ReactNode; map: ReactNode }) {
  return (
    <div className="min-h-dvh bg-bg lg:grid lg:h-dvh lg:grid-cols-[390px_minmax(0,1fr)] lg:overflow-hidden">
      <div className="min-h-dvh bg-bg lg:h-dvh lg:min-h-0 lg:overflow-y-auto lg:border-r lg:border-border">
        <div className="bg-surface">
          <div className="hidden h-row items-center px-4 lg:flex">
            <Link href="/" aria-label="지도 홈으로" className="rounded-md">
              <Logo size="md" />
            </Link>
          </div>
          {header}
        </div>
        <div className="pb-[calc(env(safe-area-inset-bottom)+--spacing(6))]">{children}</div>
      </div>
      <div className="relative hidden lg:block lg:h-dvh">{map}</div>
    </div>
  );
}
