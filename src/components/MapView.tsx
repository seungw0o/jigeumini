"use client";

import { useEffect, useRef, useState } from "react";
import type { LatLng, MapMarker, MapPath, MarkerTone } from "@/utils/types";

export type { MapMarker, MapPath, MarkerTone };

interface MapViewProps {
  paths?: MapPath[];
  markers?: MapMarker[];
  center?: LatLng;
  /** 모바일(<1024px)에서 바텀시트가 가리는 아래쪽 비율. 경로를 이 영역 위로 맞춘다 */
  obscuredBottom?: number;
  /** 상단 검색바 등이 가리는 높이(px) */
  obscuredTop?: number;
  onMarkerClick?: (id: string) => void;
  /** 이 장소 마커에만 이름표를 띄운다 (탭한 장소) */
  selectedId?: string;
  /** 있으면 다른 마커·경로 대신 이 좌표를 가운데 두고 확대한다 (검색·입력한 장소) */
  focus?: LatLng;
  label: string;
}

const KAKAO_KEY = process.env.NEXT_PUBLIC_KAKAO_JS_KEY;
const DEFAULT_CENTER: LatLng = { lat: 36.3622, lng: 127.3712 };
const FONT = "var(--font-sans)";
/** focus 주변으로 맞출 범위(도). 위도 0.0018 ≈ 200m, 경도 0.0022 ≈ 200m */
const FOCUS_SPAN = { lat: 0.0018, lng: 0.0022 };

/** focus 좌표를 가운데 둔 작은 사각형의 두 모서리. 기존 범위 맞춤(가림 영역 여백 포함)을 그대로 쓰려고 점 두 개로 만든다 */
function focusBox(p: LatLng): LatLng[] {
  return [
    { lat: p.lat - FOCUS_SPAN.lat, lng: p.lng - FOCUS_SPAN.lng },
    { lat: p.lat + FOCUS_SPAN.lat, lng: p.lng + FOCUS_SPAN.lng },
  ];
}

export function MapView(props: MapViewProps) {
  return (
    <div role="region" aria-label={props.label} className="absolute inset-0 overflow-hidden bg-map-ground">
      {KAKAO_KEY ? <KakaoMap {...props} appKey={KAKAO_KEY} /> : <PlaceholderMap {...props} />}
    </div>
  );
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

function bubbleHtml(label: string, color: string): string {
  return `<div style="padding-bottom:6px;filter:var(--elevation-marker)"><div style="display:flex;align-items:center;height:22px;padding:0 6px;border:2px solid var(--color-surface);border-radius:var(--radius-sm);background:${color};color:var(--color-fg-inverse);font:700 var(--text-xs)/1 ${FONT};white-space:nowrap">${escapeHtml(
    label,
  )}</div></div>`;
}

function pinHtml(tone: "origin" | "destination"): string {
  const color = tone === "origin" ? "var(--color-map-origin)" : "var(--color-map-destination)";
  const text = tone === "origin" ? "출발" : "도착";
  return `<div style="position:relative;width:30px;height:40px;filter:var(--elevation-pin)"><svg width="30" height="40" viewBox="0 0 30 40" aria-hidden="true" style="display:block"><path d="M15 38.6C15 38.6 2 24.6 2 15a13 13 0 0 1 26 0c0 9.6-13 23.6-13 23.6Z" fill="${color}" stroke="var(--color-surface)" stroke-width="2" stroke-linejoin="round"/></svg><span style="position:absolute;inset:0 0 auto;height:30px;display:flex;align-items:center;justify-content:center;color:var(--color-fg-inverse);font:700 var(--text-2xs)/1 ${FONT};letter-spacing:-0.04em">${text}</span></div>`;
}

function dotHtml(tone: "stop" | "transfer" | "current"): string {
  if (tone === "current") {
    return `<span style="display:flex;align-items:center;justify-content:center;width:36px;height:36px;border-radius:9999px;background:color-mix(in srgb,var(--color-map-current) 18%,transparent)"><span style="display:block;width:14px;height:14px;border-radius:9999px;background:var(--color-map-current);border:3px solid var(--color-surface);box-shadow:var(--shadow-float)"></span></span>`;
  }
  const size = tone === "transfer" ? 12 : 10;
  const border = tone === "transfer" ? "3px solid var(--color-fg)" : "2.5px solid var(--color-fg-secondary)";
  return `<span style="display:block;box-sizing:border-box;width:${size}px;height:${size}px;border-radius:9999px;background:var(--color-surface);border:${border}"></span>`;
}

const PLACE_HTML = `<span style="display:flex;align-items:center;justify-content:center;width:26px;height:26px;border-radius:9999px;background:var(--color-surface);box-shadow:var(--shadow-float)"><span style="display:block;width:10px;height:10px;border-radius:9999px;background:var(--color-brand);box-shadow:0 0 0 2px var(--color-fg)"></span></span>`;

const FAVORITE_HTML = `<span style="display:flex;align-items:center;justify-content:center;box-sizing:border-box;width:28px;height:28px;border-radius:9999px;background:var(--color-brand);border:2px solid var(--color-surface);box-shadow:var(--shadow-float)"><svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z" fill="var(--color-fg)"/></svg></span>`;

function pillHtml(name: string): string {
  return `<span style="position:absolute;left:50%;bottom:calc(100% - 4px);transform:translateX(-50%);max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;padding:4px 10px;border-radius:var(--radius-sm);background:var(--color-surface);color:var(--color-fg);font:600 var(--text-xs)/var(--text-xs--line-height) ${FONT};box-shadow:var(--shadow-float)">${escapeHtml(
    name,
  )}</span>`;
}

function markerHtml(tone: MarkerTone): string {
  if (tone === "origin" || tone === "destination") return pinHtml(tone);
  if (tone === "place") return PLACE_HTML;
  if (tone === "favorite") return FAVORITE_HTML;
  return dotHtml(tone);
}

const MARKER_Z: Record<MarkerTone, number> = {
  stop: 3,
  transfer: 4,
  favorite: 5,
  place: 5,
  current: 6,
  origin: 7,
  destination: 7,
};

function pathMidpoint(points: LatLng[]): LatLng {
  const seg = points.slice(1).map((p, i) => Math.hypot(p.lat - points[i].lat, p.lng - points[i].lng));
  let rest = seg.reduce((a, b) => a + b, 0) / 2;
  for (let i = 0; i < seg.length; i++) {
    if (rest <= seg[i]) {
      const t = seg[i] ? rest / seg[i] : 0;
      const a = points[i];
      const b = points[i + 1];
      return { lat: a.lat + (b.lat - a.lat) * t, lng: a.lng + (b.lng - a.lng) * t };
    }
    rest -= seg[i];
  }
  return points[points.length - 1];
}

const isTappable = (m: MapMarker) => m.tone === "place" || m.tone === "favorite";
// 즐겨찾기는 항상 깔려 있어서, 화면 맞춤에 넣으면 열 때마다 지도가 저장한 곳 전부로 축소된다
const fitPoints = (paths: MapPath[], markers: MapMarker[]) => [
  ...paths.flatMap((p) => p.points),
  ...markers.filter((m) => m.tone !== "favorite").map((m) => m.position),
];

function placeLabel(m: MapMarker): string {
  return m.label ? `${m.label} 정보 보기` : "장소 정보 보기";
}

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
  selectedId,
  focus,
}: MapViewProps) {
  const [ref, size] = useSize<HTMLDivElement>();

  const pts = focus ? focusBox(focus) : fitPoints(paths, markers);
  if (pts.length === 0 && center) pts.push(center);

  let project: ((p: LatLng) => { x: number; y: number }) | null = null;
  if (size && pts.length > 0) {
    const mobile = size.w < 1024;
    const top = obscuredTop + 56;
    const bottom = (mobile ? size.h * obscuredBottom : 0) + 40;
    const side = 56;
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

  const toPoints = (p: MapPath) =>
    p.points
      .map((pt) => {
        const q = project!(pt);
        return `${q.x},${q.y}`;
      })
      .join(" ");
  const walks = paths.filter((p) => p.kind === "walk" && p.points.length > 0);
  const buses = paths.filter((p) => p.kind === "bus" && p.points.length > 0);

  return (
    <div ref={ref} className="absolute inset-0">
      <svg
        className="absolute inset-0 size-full"
        viewBox="0 0 1000 1000"
        preserveAspectRatio="xMidYMid slice"
        aria-hidden="true"
      >
        <path d="M90 120h230l40 160-250 30z" fill="var(--color-map-park)" />
        <path d="M640 560l220-30 30 170-230 20z" fill="var(--color-map-park)" />
        <path d="M380 40l120 10 10 120-140-10z" fill="var(--color-map-park)" />
        <path
          d="M-40 700C120 650 260 760 420 690S700 560 1040 600"
          stroke="var(--color-map-water)"
          strokeWidth="34"
          fill="none"
        />
        <g stroke="var(--color-map-road)" fill="none" strokeLinecap="round">
          <path d="M-20 380L1020 470M420 -20L560 1020M-20 880L1020 820" strokeWidth="16" />
          <path
            d="M-20 180L1020 230M180 -20L240 1020M760 -20L700 1020M-20 600L1020 660M300 300L640 540L980 300"
            strokeWidth="8"
          />
          <path
            d="M-20 90L1020 120M-20 280L1020 330M-20 530L1020 560M-20 760L1020 740M-20 960L1020 930M90 -20L120 1020M320 -20L340 1020M630 -20L620 1020M880 -20L860 1020"
            strokeWidth="3"
            opacity="0.85"
          />
        </g>
      </svg>
      {project && (
        <svg className="absolute inset-0 size-full" aria-hidden="true">
          <g fill="none" strokeLinecap="round" strokeLinejoin="round">
            {walks.map((p, i) => (
              <polyline key={`w${i}`} points={toPoints(p)} stroke={p.color} strokeWidth={4} strokeDasharray="0.1 7" />
            ))}
            {buses.map((p, i) => (
              <polyline key={`c${i}`} points={toPoints(p)} stroke="var(--color-surface)" strokeWidth={10} />
            ))}
            {buses.map((p, i) => (
              <polyline key={`b${i}`} points={toPoints(p)} stroke={p.color} strokeWidth={7} />
            ))}
          </g>
        </svg>
      )}

      {project && (
        <div className="pointer-events-none absolute inset-0">
          {buses.map((p, i) => {
            if (!p.label) return null;
            const q = project!(pathMidpoint(p.points));
            return (
              <div
                key={`l${i}`}
                className="absolute -translate-y-full"
                style={{ left: q.x, top: q.y, zIndex: 2 }}
                dangerouslySetInnerHTML={{ __html: bubbleHtml(p.label, p.color) }}
              />
            );
          })}
          {markers.map((m) => {
            const q = project!(m.position);
            const pin = m.tone === "origin" || m.tone === "destination";
            const selected = m.tone === "place" && m.id === selectedId;
            const style = { left: q.x, top: q.y, zIndex: MARKER_Z[m.tone] + (selected ? 10 : 0) };
            if (isTappable(m)) {
              return (
                <button
                  key={m.id}
                  type="button"
                  disabled={!onMarkerClick}
                  onClick={() => onMarkerClick?.(m.id)}
                  aria-label={placeLabel(m)}
                  aria-pressed={onMarkerClick ? selected : undefined}
                  className="pointer-events-auto absolute flex size-10 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full"
                  style={style}
                >
                  <span
                    className="contents"
                    dangerouslySetInnerHTML={{ __html: markerHtml(m.tone) + (selected && m.label ? pillHtml(m.label) : "") }}
                  />
                </button>
              );
            }
            return (
              <div
                key={m.id}
                className={`absolute -translate-x-1/2 ${pin ? "-translate-y-full" : "-translate-y-1/2"}`}
                style={style}
                dangerouslySetInnerHTML={{ __html: markerHtml(m.tone) }}
              />
            );
          })}
        </div>
      )}

      <p className="absolute bottom-2 left-2 rounded-sm bg-surface/90 px-2 py-0.5 text-2xs text-fg-muted shadow-card lg:bottom-3 lg:left-3">
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
  selectedId,
  focus,
}: MapViewProps & { appKey: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);
  const [kakao, setKakao] = useState<{ maps: KakaoMaps; map: KakaoMapInstance } | null>(null);
  const fitRef = useRef<() => void>(() => {});

  useEffect(() => {
    let disposed = false;
    loadKakao(appKey)
      .then((maps) => {
        const el = ref.current;
        if (disposed || !el) return;
        const map = new maps.Map(el, { center: new maps.LatLng(DEFAULT_CENTER.lat, DEFAULT_CENTER.lng), level: 6 });
        setKakao({ maps, map });
      })
      .catch(() => !disposed && setFailed(true));
    return () => {
      disposed = true;
    };
  }, [appKey]);

  useEffect(() => {
    const el = ref.current;
    if (!kakao || !el) return;
    let width = el.clientWidth;
    const ro = new ResizeObserver(() => {
      kakao.map.relayout();
      if (el.clientWidth === width) return;
      width = el.clientWidth;
      fitRef.current();
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [kakao]);

  useEffect(() => {
    if (!kakao) return;
    const { maps, map } = kakao;
    const items: Array<{ setMap(m: KakaoMapInstance | null): void }> = [];
    const line = (p: MapPath, opts: Record<string, unknown>) =>
      items.push(new maps.Polyline({ map, path: p.points.map((pt) => new maps.LatLng(pt.lat, pt.lng)), ...opts }));
    const overlay = (position: LatLng, content: HTMLElement, opts: Record<string, unknown>) =>
      items.push(new maps.CustomOverlay({ map, position: new maps.LatLng(position.lat, position.lng), content, ...opts }));

    const drawn = paths.filter((p) => p.points.length > 0);
    const buses = drawn.filter((p) => p.kind === "bus");
    for (const p of drawn) {
      if (p.kind !== "walk") continue;
      line(p, { strokeWeight: 4, strokeColor: cssVar("var(--color-walk-fg)"), strokeOpacity: 1, strokeStyle: "shortdot", zIndex: 1 });
    }
    for (const p of buses) {
      line(p, { strokeWeight: 10, strokeColor: cssVar("var(--color-surface)"), strokeOpacity: 1, strokeStyle: "solid", zIndex: 2 });
    }
    for (const p of buses) {
      line(p, { strokeWeight: 7, strokeColor: cssVar(p.color), strokeOpacity: 1, strokeStyle: "solid", zIndex: 3 });
    }
    for (const p of buses) {
      if (!p.label) continue;
      const el = document.createElement("div");
      el.innerHTML = bubbleHtml(p.label, cssVar(p.color));
      overlay(pathMidpoint(p.points), el, { xAnchor: 0, yAnchor: 1, zIndex: 2 });
    }

    for (const m of markers) {
      const selected = m.tone === "place" && m.id === selectedId;
      const zIndex = MARKER_Z[m.tone] + (selected ? 10 : 0);
      if (isTappable(m)) {
        const el = document.createElement(onMarkerClick ? "button" : "span");
        el.style.cssText =
          "position:relative;display:flex;align-items:center;justify-content:center;width:40px;height:40px;padding:0;border:0;border-radius:9999px;background:none";
        el.innerHTML = markerHtml(m.tone) + (selected && m.label ? pillHtml(m.label) : "");
        if (onMarkerClick) {
          el.setAttribute("type", "button");
          el.setAttribute("aria-label", placeLabel(m));
          el.setAttribute("aria-pressed", String(selected));
          el.style.cursor = "pointer";
          el.addEventListener("click", () => onMarkerClick(m.id));
        }
        overlay(m.position, el, { xAnchor: 0.5, yAnchor: 0.5, zIndex, clickable: Boolean(onMarkerClick) });
        continue;
      }
      const el = document.createElement("div");
      el.innerHTML = markerHtml(m.tone);
      const pin = m.tone === "origin" || m.tone === "destination";
      overlay(m.position, el, { xAnchor: 0.5, yAnchor: pin ? 1 : 0.5, zIndex });
    }

    return () => items.forEach((it) => it.setMap(null));
  }, [kakao, paths, markers, selectedId, onMarkerClick]);

  useEffect(() => {
    const el = ref.current;
    if (!kakao || !el) return;
    const { maps, map } = kakao;
    const pts = focus ? focusBox(focus) : fitPoints(paths, markers);
    const fit = () => {
      if (pts.length > 1) {
        const bounds = new maps.LatLngBounds();
        pts.forEach((pt) => bounds.extend(new maps.LatLng(pt.lat, pt.lng)));
        const mobile = el.clientWidth < 1024;
        map.setBounds(bounds, obscuredTop + 56, 56, (mobile ? el.clientHeight * obscuredBottom : 0) + 32, 40);
      } else {
        const c = pts[0] ?? center;
        if (c) map.setCenter(new maps.LatLng(c.lat, c.lng));
      }
    };
    fitRef.current = fit;
    fit();
  }, [kakao, paths, markers, center, obscuredBottom, obscuredTop, focus]);

  if (failed) {
    return (
      <PlaceholderMap
        paths={paths}
        markers={markers}
        center={center}
        obscuredBottom={obscuredBottom}
        obscuredTop={obscuredTop}
        onMarkerClick={onMarkerClick}
        selectedId={selectedId}
        focus={focus}
        label="지도"
      />
    );
  }
  return <div ref={ref} className="absolute inset-0" />;
}
