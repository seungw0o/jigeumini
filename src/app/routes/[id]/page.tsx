import { Suspense } from "react";
import { notFound } from "next/navigation";
import { getRouteById, mockRouteIds } from "@/app/_mocks/routes";
import { LiveRouteDetailFallback, LiveRouteDetailScreen } from "./_components/LiveRouteDetailScreen";
import { RouteDetailScreen } from "./_components/RouteDetailScreen";

const LIVE_ROUTE_ID = /^l\d+$/;

export function generateStaticParams() {
  return mockRouteIds.map((id) => ({ id }));
}

// params는 Suspense 안에서 읽는다. 밖에서 await하면 Next 16이 "URL data accessed outside <Suspense>" 오류를 낸다
async function RouteDetailContent({ params }: { params: PageProps<"/routes/[id]">["params"] }) {
  const { id } = await params;
  if (getRouteById(id)) return <RouteDetailScreen routeId={id} />;
  if (!LIVE_ROUTE_ID.test(id)) notFound();
  return <LiveRouteDetailScreen routeId={id} />;
}

export default function RouteDetailPage({ params }: PageProps<"/routes/[id]">) {
  return (
    <Suspense fallback={<LiveRouteDetailFallback />}>
      <RouteDetailContent params={params} />
    </Suspense>
  );
}
