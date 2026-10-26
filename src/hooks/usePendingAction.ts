"use client";

import { useState } from "react";

// 응답이 빨라도 눌렀다는 게 보이도록 이만큼은 진행 중으로 둔다
const MIN_PENDING_MS = 600;

/** action이 돌려준 Promise가 끝날 때까지(최소 MIN_PENDING_MS) pending. 진행 중에 다시 부르면 무시한다 */
export function usePendingAction(action: (() => unknown) | undefined): { pending: boolean; run: () => void } {
  const [pending, setPending] = useState(false);
  return {
    pending,
    run: () => {
      if (pending || !action) return;
      setPending(true);
      const minWait = new Promise((resolve) => setTimeout(resolve, MIN_PENDING_MS));
      void Promise.allSettled([Promise.resolve().then(action), minWait]).then(() => setPending(false));
    },
  };
}
