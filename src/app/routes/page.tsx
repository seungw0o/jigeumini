import { Suspense } from "react";
import { RoutesFallback } from "./_components/RoutesFallback";
import { RoutesScreen } from "./_components/RoutesScreen";

export default function RoutesPage() {
  return (
    <main>
      <Suspense fallback={<RoutesFallback />}>
        <RoutesScreen />
      </Suspense>
    </main>
  );
}
