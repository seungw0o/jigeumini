"use client";

import { useSyncExternalStore } from "react";

// 화면 너비가 아니라 입력 장치로 본다: 마우스처럼 정밀한 포인터 + 호버가 되면 컴퓨터. 창을 줄인 노트북도 컴퓨터, 태블릿·폰은 아님
const QUERY = "(hover: hover) and (pointer: fine)";

function subscribe(onChange: () => void) {
  const media = window.matchMedia(QUERY);
  media.addEventListener("change", onChange);
  return () => media.removeEventListener("change", onChange);
}

export function useDesktopDevice(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(QUERY).matches,
    () => false,
  );
}
