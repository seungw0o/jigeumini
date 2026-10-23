import { Suspense } from "react";
import { notFound } from "next/navigation";
import { LiveRouteDetailFallback, LiveRouteDetailScreen } from "./_components/LiveRouteDetailScreen";

const LIVE_ROUTE_ID = /^l\d+$/;

// params는 Suspense 안에서 읽는다. 밖에서 await하면 Next 16이 "URL data accessed outside <Suspense>" 오류를 낸다
async function RouteDetailContent({ params }: { params: PageProps<"/routes/[id]">["params"] }) {
  const { id } = await params;
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
