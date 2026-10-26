"use client";

import { useEffect, useRef, useState, type CSSProperties, type ReactNode, type PointerEvent } from "react";

interface BottomSheetProps {
  children: ReactNode;
  /** 화면 높이 대비 보이는 비율, 작은 것부터. 예: [0.22, 0.5, 0.88] */
  snaps?: number[];
  initialSnap?: number;
  label: string;
  className?: string;
  /** 시트 아래에 고정되는 영역 (lg에서는 좌측 패널 맨 아래) */
  footer?: ReactNode;
  /** 모바일에서 화면 바닥과 시트 사이 간격(px). 하단 탭 바 높이 */
  bottomOffset?: number;
}

/**
 * 모바일: 화면 아래 고정, 핸들을 끌거나 눌러 높이를 바꾼다.
 * lg 이상: 좌측 패널 안에서 남은 높이를 채우는 일반 스크롤 영역이 된다.
 */
export function BottomSheet({
  children,
  snaps = [0.22, 0.5, 0.88],
  initialSnap = 1,
  label,
  className = "",
  footer,
  bottomOffset = 0,
}: BottomSheetProps) {
  const [snap, setSnap] = useState(initialSnap);
  const [dragHeight, setDragHeight] = useState<number | null>(null);
  const drag = useRef<{ startY: number; startH: number; moved: boolean } | null>(null);
  const sheetRef = useRef<HTMLElement>(null);

  const height = dragHeight !== null ? `${dragHeight}px` : `${snaps[snap] * 100}dvh`;
  const dragging = dragHeight !== null;

  // 지도 컨트롤(현재 위치 버튼)이 시트 바로 위에 뜨도록 높이를 문서 루트 변수로 알린다 (MapLayout이 읽음).
  // 끌는 동안에는 버튼이 뒤처지지 않게 애니메이션을 끈다.
  useEffect(() => {
    const root = document.documentElement.style;
    root.setProperty("--map-sheet-h", height);
    root.setProperty("--map-sheet-offset", `${bottomOffset}px`);
    root.setProperty("--map-sheet-motion", dragging ? "0ms" : "var(--motion-sheet)");
  }, [height, bottomOffset, dragging]);

  useEffect(
    () => () => {
      const root = document.documentElement.style;
      root.removeProperty("--map-sheet-h");
      root.removeProperty("--map-sheet-offset");
      root.removeProperty("--map-sheet-motion");
    },
    [],
  );

  function onPointerDown(e: PointerEvent<HTMLButtonElement>) {
    const el = sheetRef.current;
    if (!el) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { startY: e.clientY, startH: el.getBoundingClientRect().height, moved: false };
  }

  function onPointerMove(e: PointerEvent<HTMLButtonElement>) {
    const d = drag.current;
    if (!d) return;
    const dy = d.startY - e.clientY;
    if (Math.abs(dy) > 4) d.moved = true;
    if (!d.moved) return;
    const vh = window.innerHeight;
    setDragHeight(Math.min(Math.max(d.startH + dy, vh * snaps[0] * 0.6), vh * snaps[snaps.length - 1]));
  }

  function onPointerUp() {
    const d = drag.current;
    drag.current = null;
    if (!d) return;
    if (!d.moved) {
      setSnap((s) => (s + 1) % snaps.length);
      return;
    }
    const vh = window.innerHeight;
    const ratio = (dragHeight ?? d.startH) / vh;
    let nearest = 0;
    snaps.forEach((s, i) => {
      if (Math.abs(s - ratio) < Math.abs(snaps[nearest] - ratio)) nearest = i;
    });
    setSnap(nearest);
    setDragHeight(null);
  }

  const safeArea = bottomOffset === 0 ? "pb-[env(safe-area-inset-bottom)] lg:pb-0" : "";

  return (
    <section
      ref={sheetRef}
      aria-label={label}
      style={{ "--sheet-h": height, "--sheet-offset": `${bottomOffset}px` } as CSSProperties}
      className={`fixed inset-x-0 bottom-(--sheet-offset) z-30 flex h-(--sheet-h) flex-col overflow-hidden rounded-t-lg bg-surface shadow-sheet ${
        dragHeight === null ? "transition-[height] duration-(--motion-sheet) ease-sheet" : ""
      } lg:static lg:z-auto lg:h-auto lg:min-h-0 lg:flex-1 lg:overflow-visible lg:rounded-none lg:shadow-none ${className}`}
    >
      <button
        type="button"
        aria-label={`${label} 크기 조절`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        className="relative z-10 -mb-4 flex h-8 w-full shrink-0 touch-none cursor-grab items-start justify-center pt-2 active:cursor-grabbing focus-visible:-outline-offset-2 lg:hidden"
      >
        <span className="h-1 w-9 rounded-full bg-border-strong" />
      </button>
      <div className={`min-h-0 flex-1 overflow-y-auto overscroll-contain ${footer ? "" : safeArea}`}>{children}</div>
      {footer && <div className={`shrink-0 bg-surface shadow-bar ${safeArea}`}>{footer}</div>}
    </section>
  );
}
