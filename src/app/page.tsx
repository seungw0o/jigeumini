import { MapLayout } from "@/components/MapLayout";
import { MapView } from "@/components/MapView";

export default function HomePage() {
  return <MapLayout map={<MapView label="지도" />} />;
}
