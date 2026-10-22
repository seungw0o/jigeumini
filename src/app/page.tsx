import { Suspense } from "react";
import { HomeScreen } from "./_components/HomeScreen";

export default function HomePage() {
  return (
    <Suspense fallback={null}>
      <HomeScreen />
    </Suspense>
  );
}
