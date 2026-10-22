import { notFound } from "next/navigation";
import { getRouteById, mockRouteIds } from "@/app/_mocks/routes";
import { RouteDetailScreen } from "./_components/RouteDetailScreen";

export function generateStaticParams() {
  return mockRouteIds.map((id) => ({ id }));
}

export default async function RouteDetailPage({ params }: PageProps<"/routes/[id]">) {
  const { id } = await params;
  if (!getRouteById(id)) notFound();
  return <RouteDetailScreen routeId={id} />;
}
