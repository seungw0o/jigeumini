"use client";

import { useEffect, useRef, useState } from "react";
import type { LatLng } from "@/utils/types";

export interface MapPath {
  points: LatLng[];
  color: string;
  dashed?: boolean;
}

export type MarkerTone = "origin" | "destination" | "stop" | "current" | "place";

export interface MapMarker {
  id: string;
  position: LatLng;
  label?: string;
  tone: MarkerTone;
}

interface MapViewProps {
  paths?: MapPath[];
  markers?: MapMarker[];
  center?: LatLng;
  /** 모바일(<1024px)에서 바텀시트가 가리는 아래쪽 비율. 경로를 이 영역 위로 맞춘다 */
  obscuredBottom?: number;
  /** 상단 검색바 등이 가리는 높이(px) */
  obscuredTop?: number;
  onMarkerClick?: (id: string) => void;
  label: string;
}

const KAKAO_KEY = process.env.NEXT_PUBLIC_KAKAO_JS_KEY;

export function MapView(props: MapViewProps) {
  return (
    <div role="region" aria-label={props.label} className="absolute inset-0 overflow-hidden bg-map">
      {KAKAO_KEY ? <KakaoMap {...props} appKey={KAKAO_KEY} /> : <PlaceholderMap {...props} />}
    </div>
  );
}

const MARKER_STYLE: Record<MarkerTone, { fill: string; text: string }> = {
  origin: { fill: "var(--color-ink)", text: "출발" },
  destination: { fill: "var(--color-accent)", text: "도착" },
  stop: { fill: "var(--color-surface)", text: "" },
  current: { fill: "#2f6fde", text: "" },
  place: { fill: "var(--color-accent)", text: "" },
};

function useSize<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      setSize({ w: entry.contentRect.width, h: entry.contentRect.height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, size] as const;
}

function PlaceholderMap({
  paths = [],
  markers = [],
  center,
  obscuredBottom = 0,
  obscuredTop = 0,
  onMarkerClick,
}: MapViewProps) {
  const [ref, size] = useSize<HTMLDivElement>();

  const pts = [...paths.flatMap((p) => p.points), ...markers.map((m) => m.position)];
  if (pts.length === 0 && center) pts.push(center);

  let project: ((p: LatLng) => { x: number; y: number }) | null = null;
  if (size && pts.length > 0) {
    const mobile = size.w < 1024;
    const top = obscuredTop + 48;
    const bottom = (mobile ? size.h * obscuredBottom : 0) + 48;
    const side = 48;
    const lats = pts.map((p) => p.lat);
    const lngs = pts.map((p) => p.lng);
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs);
    const maxLng = Math.max(...lngs);
    const spanLat = Math.max(maxLat - minLat, 0.01);
    const spanLng = Math.max(maxLng - minLng, 0.01);
    const availW = Math.max(size.w - side * 2, 1);
    const availH = Math.max(size.h - top - bottom, 1);
    const kx = Math.cos((((minLat + maxLat) / 2) * Math.PI) / 180);
    const scale = Math.min(availW / (spanLng * kx), availH / spanLat);
    const cx = side + availW / 2;
    const cy = top + availH / 2;
    const midLat = (minLat + maxLat) / 2;
    const midLng = (minLng + maxLng) / 2;
    project = (p) => ({
      x: cx + (p.lng - midLng) * kx * scale,
      y: cy - (p.lat - midLat) * scale,
    });
  }

  return (
    <div ref={ref} className="absolute inset-0">
      <svg className="absolute inset-0 size-full" aria-hidden="true">
        <defs>
          <pattern id="map-grid" width="120" height="120" patternUnits="userSpaceOnUse">
            <path d="M0 60H120M60 0V120" stroke="var(--color-map-road)" strokeWidth="3" />
            <path d="M0 20H120M0 100H120M20 0V120M100 0V120" stroke="var(--color-map-road)" strokeWidth="1" opacity="0.7" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#map-grid)" />
        <rect x="8%" y="14%" width="22%" height="16%" fill="var(--color-map-park)" rx="6" />
        <rect x="62%" y="52%" width="26%" height="14%" fill="var(--color-map-park)" rx="6" />
        <path d="M-20 72% C 30% 64%, 45% 82%, 110% 58%" stroke="var(--color-map-water)" strokeWidth="22" fill="none" />
        <path d="M-20 30% L 110% 44%" stroke="var(--color-map-road)" strokeWidth="9" />
        <path d="M38% -20 L 52% 110%" stroke="var(--color-map-road)" strokeWidth="9" />

        {project &&
          paths.map((p, i) => (
            <polyline
              key={i}
              points={p.points.map((pt) => { const q = project!(pt); return `${q.x},${q.y}`; }).join(" ")}
              fill="none"
              stroke={p.color}
              strokeWidth={p.dashed ? 4 : 6}
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeDasharray={p.dashed ? "2 8" : undefined}
            />
          ))}
      </svg>

      {project &&
        markers.map((m) => {
          const q = project!(m.position);
          const s = MARKER_STYLE[m.tone];
          return (
            <div
              key={m.id}
              className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2"
              style={{ left: q.x, top: q.y }}
            >
              {m.tone === "origin" || m.tone === "destination" ? (
                <span
                  className="flex h-6 items-center rounded-sm px-1.5 text-xs font-semibold text-white shadow-float"
                  style={{ backgroundColor: s.fill }}
                >
                  {s.text}
                </span>
              ) : m.tone === "current" ? (
                <span className="block size-4 rounded-full border-[3px] border-white bg-[#2f6fde] shadow-float" />
              ) : m.tone === "place" ? (
                <button
                  type="button"
                  disabled={!onMarkerClick}
                  onClick={() => onMarkerClick?.(m.id)}
                  aria-label={m.label ? `${m.label} 정보 보기` : "장소 정보 보기"}
                  className="pointer-events-auto flex min-h-11 min-w-11 flex-col items-center justify-center"
                >
                  <span className="block size-4 rounded-full border-[3px] border-white bg-accent shadow-float" />
                  {m.label && (
                    <span className="mt-1 max-w-32 truncate rounded-sm bg-surface px-1.5 py-0.5 text-xs font-semibold shadow-float">
                      {m.label}
                    </span>
                  )}
                </button>
              ) : (
                <span className="block size-3 rounded-full border-2 border-ink bg-surface" />
              )}
            </div>
          );
        })}

      <p className="absolute bottom-2 left-2 rounded-sm bg-surface/80 px-1.5 py-0.5 text-[11px] text-muted lg:bottom-3 lg:left-3">
        지도 미리보기 · 카카오맵 키 없음
      </p>
    </div>
  );
}

interface KakaoLatLng { getLat(): number; getLng(): number }
interface KakaoMapInstance {
  setBounds(b: unknown, top?: number, right?: number, bottom?: number, left?: number): void;
  setCenter(p: KakaoLatLng): void;
  relayout(): void;
}
interface KakaoMaps {
  load(cb: () => void): void;
  LatLng: new (lat: number, lng: number) => KakaoLatLng;
  LatLngBounds: new () => { extend(p: KakaoLatLng): void };
  Map: new (el: HTMLElement, opts: { center: KakaoLatLng; level: number }) => KakaoMapInstance;
  Polyline: new (opts: Record<string, unknown>) => { setMap(m: KakaoMapInstance | null): void };
  CustomOverlay: new (opts: Record<string, unknown>) => { setMap(m: KakaoMapInstance | null): void };
}
declare global {
  interface Window { kakao?: { maps: KakaoMaps } }
}

let sdkPromise: Promise<KakaoMaps> | null = null;
function loadKakao(appKey: string): Promise<KakaoMaps> {
  if (sdkPromise) return sdkPromise;
  sdkPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${appKey}&autoload=false`;
    script.async = true;
    script.onload = () => window.kakao!.maps.load(() => resolve(window.kakao!.maps));
    script.onerror = () => {
      sdkPromise = null;
      reject(new Error("카카오맵 SDK를 불러오지 못했습니다"));
    };
    document.head.appendChild(script);
  });
  return sdkPromise;
}

function cssVar(value: string): string {
  const m = value.match(/^var\((--[^)]+)\)$/);
  return m ? getComputedStyle(document.documentElement).getPropertyValue(m[1]).trim() : value;
}

function KakaoMap({
  appKey,
  paths = [],
  markers = [],
  center,
  obscuredBottom = 0,
  obscuredTop = 0,
  onMarkerClick,
}: MapViewProps & { appKey: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let disposed = false;
    const cleanups: Array<() => void> = [];
    loadKakao(appKey)
      .then((maps) => {
        const el = ref.current;
        if (disposed || !el) return;
        const c = center ?? markers[0]?.position ?? paths[0]?.points[0] ?? { lat: 36.3622, lng: 127.3712 };
        const map = new maps.Map(el, { center: new maps.LatLng(c.lat, c.lng), level: 6 });
        for (const p of paths) {
          const line = new maps.Polyline({
            map,
            path: p.points.map((pt) => new maps.LatLng(pt.lat, pt.lng)),
            strokeWeight: p.dashed ? 4 : 6,
            strokeColor: cssVar(p.color),
            strokeOpacity: 0.95,
            strokeStyle: p.dashed ? "shortdot" : "solid",
          });
          cleanups.push(() => line.setMap(null));
        }
        for (const m of markers) {
          const s = MARKER_STYLE[m.tone];
          const content = document.createElement("span");
          content.textContent = s.text || m.label || "";
          content.style.cssText = `display:inline-block;padding:2px 6px;border-radius:4px;font:600 12px/1.4 sans-serif;color:${
            m.tone === "stop" ? "#14171c" : "#fff"
          };background:${cssVar(s.fill)};border:1px solid rgba(20,23,28,.2)`;
          if (m.tone === "place" && onMarkerClick) {
            content.style.cursor = "pointer";
            content.addEventListener("click", () => onMarkerClick(m.id));
          }
          const overlay = new maps.CustomOverlay({ map, position: new maps.LatLng(m.position.lat, m.position.lng), content });
          cleanups.push(() => overlay.setMap(null));
        }
        const pts = [...paths.flatMap((p) => p.points), ...markers.map((m) => m.position)];
        if (pts.length > 1) {
          const bounds = new maps.LatLngBounds();
          pts.forEach((pt) => bounds.extend(new maps.LatLng(pt.lat, pt.lng)));
          const mobile = el.clientWidth < 1024;
          map.setBounds(bounds, obscuredTop + 32, 32, (mobile ? el.clientHeight * obscuredBottom : 0) + 32, 32);
        }
      })
      .catch(() => !disposed && setFailed(true));
    return () => {
      disposed = true;
      cleanups.forEach((fn) => fn());
    };
  }, [appKey, paths, markers, center, obscuredBottom, obscuredTop, onMarkerClick]);

  if (failed) {
    return (
      <PlaceholderMap
        paths={paths}
        markers={markers}
        center={center}
        obscuredBottom={obscuredBottom}
        obscuredTop={obscuredTop}
        onMarkerClick={onMarkerClick}
        label="지도"
      />
    );
  }
  return <div ref={ref} className="absolute inset-0" />;
}
