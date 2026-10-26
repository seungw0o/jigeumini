"use client";

import { useEffect, useSyncExternalStore } from "react";

const TOAST_MS = 3000;

type Toast = { id: number; message: string } | null;

let current: Toast = null;
let nextId = 1;
const listeners = new Set<() => void>();

function setToast(toast: Toast) {
  current = toast;
  listeners.forEach((l) => l());
}

export function showToast(message: string): void {
  setToast({ id: nextId++, message });
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

const getSnapshot = () => current;
const getServerSnapshot = (): Toast => null;

export function Toaster() {
  const toast = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => {
      if (current?.id === toast.id) setToast(null);
    }, TOAST_MS);
    return () => clearTimeout(timer);
  }, [toast]);

  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 bottom-[calc(72px+env(safe-area-inset-bottom))] z-50 flex justify-center px-4 lg:bottom-8"
    >
      {toast && (
        <p
          key={toast.id}
          className="max-w-sm rounded-lg bg-surface-inverse px-4 py-3 text-center text-sm font-semibold text-fg-inverse shadow-float"
        >
          {toast.message}
        </p>
      )}
    </div>
  );
}
