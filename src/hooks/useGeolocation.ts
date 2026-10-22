import { useEffect, useState, useSyncExternalStore } from "react";
import type { LatLng } from "@/utils/types";

export type GeolocationStatus = "idle" | "pending" | "granted" | "denied" | "unavailable";

type Result = { attempt: number; status: "granted" | "denied" | "unavailable" };

const noopSubscribe = () => () => {};
const hasGeolocationApi = () => "geolocation" in navigator;
// 서버에서는 지원 여부를 알 수 없으니 지원한다고 보고, 클라이언트에서 다시 확인한다
const assumeSupported = () => true;

export function useGeolocation(enabled: boolean): {
  status: GeolocationStatus;
  position: LatLng | null;
  retry: () => void;
} {
  const supported = useSyncExternalStore(noopSubscribe, hasGeolocationApi, assumeSupported);
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<Result | null>(null);
  const [position, setPosition] = useState<LatLng | null>(null);

  useEffect(() => {
    if (!enabled || !supported) return;
    let cancelled = false;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        if (cancelled) return;
        setPosition({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setResult({ attempt, status: "granted" });
      },
      (error) => {
        if (cancelled) return;
        setResult({
          attempt,
          status: error.code === error.PERMISSION_DENIED ? "denied" : "unavailable",
        });
      },
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 60_000 },
    );
    return () => {
      cancelled = true;
    };
  }, [enabled, supported, attempt]);

  let status: GeolocationStatus;
  if (!enabled) status = "idle";
  else if (!supported) status = "unavailable";
  else status = result?.attempt === attempt ? result.status : "pending";

  return { status, position: enabled ? position : null, retry: () => setAttempt((a) => a + 1) };
}
