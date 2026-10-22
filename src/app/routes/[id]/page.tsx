import { Suspense } from "react";
import { notFound } from "next/navigation";
import { getRouteById, mockRouteIds } from "@/app/_mocks/routes";
import { LiveRouteDetailFallback, LiveRouteDetailScreen } from "./_components/LiveRouteDetailScreen";
import { RouteDetailScreen } from "./_components/RouteDetailScreen";

const LIVE_ROUTE_ID = /^l\d+$/;

export function generateStaticParams() {
  return mockRouteIds.map((id) => ({ id }));
}

export default async function RouteDetailPage({ params }: PageProps<"/routes/[id]">) {
  const { id } = await params;
  if (getRouteById(id)) return <RouteDetailScreen routeId={id} />;
  if (!LIVE_ROUTE_ID.test(id)) notFound();
  return (
    <Suspense fallback={<LiveRouteDetailFallback />}>
      <LiveRouteDetailScreen routeId={id} />
    </Suspense>
  );
}
