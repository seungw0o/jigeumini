import { mockRouteIds } from "@/app/_mocks/routes";

export function generateStaticParams() {
  return mockRouteIds.map((id) => ({ id }));
}

export default async function RouteDetailPage({ params }: PageProps<"/routes/[id]">) {
  const { id } = await params;
  return <main>경로 {id}</main>;
}
