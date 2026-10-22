import type { ReactNode } from "react";

export function RoutesLayout({ header, children, map }: { header: ReactNode; children: ReactNode; map: ReactNode }) {
  return (
    <div className="min-h-dvh bg-canvas lg:grid lg:h-dvh lg:grid-cols-[390px_minmax(0,1fr)] lg:overflow-hidden">
      <div className="min-h-dvh bg-canvas lg:h-dvh lg:min-h-0 lg:overflow-y-auto lg:border-r lg:border-line">
        <div className="bg-surface">{header}</div>
        <div className="pb-[env(safe-area-inset-bottom)]">{children}</div>
      </div>
      <div className="relative hidden lg:block lg:h-dvh">{map}</div>
    </div>
  );
}
