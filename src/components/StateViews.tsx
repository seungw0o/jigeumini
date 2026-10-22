import type { ReactNode } from "react";
import { AlertIcon, LocationOffIcon, MapOffIcon } from "@/assets/icons";

const pulse = "rounded-sm bg-canvas animate-pulse motion-reduce:animate-none";

export function RouteListSkeleton({ count = 3 }: { count?: number }) {
  return (
    <ul aria-busy="true" aria-label="경로를 불러오는 중">
      {Array.from({ length: count }, (_, i) => (
        <li key={i} aria-hidden="true" className="border-b border-line px-4 py-5">
          <div className={`h-4 w-24 ${pulse}`} />
          <div className="mt-3 flex h-8 items-stretch gap-3">
            <div className={`w-28 ${pulse}`} />
            <div className={`w-24 ${pulse}`} />
          </div>
          <div className={`mt-3 h-4 w-3/4 ${pulse}`} />
          <div className={`mt-4 h-6 w-full ${pulse}`} />
          <div className="mt-4 flex flex-col gap-2">
            <div className={`h-7 w-2/3 ${pulse}`} />
            <div className={`h-7 w-1/2 ${pulse}`} />
          </div>
        </li>
      ))}
    </ul>
  );
}

export function StateButton({
  children,
  onClick,
  variant = "primary",
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: "primary" | "secondary";
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex h-11 shrink-0 items-center justify-center rounded-md px-4 text-sm font-semibold ${
        variant === "primary"
          ? "bg-ink text-white hover:bg-ink-2"
          : "border border-line-strong bg-surface text-ink-2 hover:bg-canvas"
      }`}
    >
      {children}
    </button>
  );
}

export function MessageState({
  icon,
  title,
  message,
  actions,
  role,
}: {
  icon: ReactNode;
  title: string;
  message?: string;
  actions?: ReactNode;
  role?: "alert" | "status";
}) {
  return (
    <section role={role} className="px-4 py-8">
      <div className="flex size-10 items-center justify-center rounded-lg bg-canvas">{icon}</div>
      <h2 className="mt-4 text-lg font-semibold text-ink">{title}</h2>
      {message && <p className="mt-1.5 max-w-[34ch] text-sm text-muted">{message}</p>}
      {actions && <div className="mt-5 flex flex-wrap gap-2">{actions}</div>}
    </section>
  );
}

export function ErrorState({
  title = "실시간 정보를 불러오지 못했어요",
  message = "잠시 후 다시 시도해 주세요.",
  onRetry,
}: {
  title?: string;
  message?: string;
  onRetry?: () => void;
}) {
  return (
    <MessageState
      role="alert"
      icon={<AlertIcon size={20} className="text-danger" />}
      title={title}
      message={message}
      actions={onRetry && <StateButton onClick={onRetry}>다시 시도</StateButton>}
    />
  );
}

export function EmptyState({
  title,
  message,
  action,
}: {
  title: string;
  message?: string;
  action?: ReactNode;
}) {
  return (
    <MessageState
      icon={<SearchOffIcon />}
      title={title}
      message={message}
      actions={action}
    />
  );
}

export function LocationDeniedState({
  onRetry,
  onSearchInstead,
}: {
  onRetry?: () => void;
  onSearchInstead?: () => void;
}) {
  const hasActions = onRetry || onSearchInstead;
  return (
    <MessageState
      icon={<LocationOffIcon size={20} className="text-ink-2" />}
      title="위치 권한이 꺼져 있어요"
      message="현재 위치를 출발지로 쓰려면 브라우저 설정에서 위치 접근을 허용해 주세요. 출발지를 직접 검색해도 돼요."
      actions={
        hasActions && (
          <>
            {onSearchInstead && <StateButton onClick={onSearchInstead}>출발지 검색</StateButton>}
            {onRetry && (
              <StateButton onClick={onRetry} variant={onSearchInstead ? "secondary" : "primary"}>
                다시 시도
              </StateButton>
            )}
          </>
        )
      }
    />
  );
}

export function OutsideServiceAreaState({ onMoveToDaejeon }: { onMoveToDaejeon?: () => void }) {
  return (
    <MessageState
      icon={<MapOffIcon size={20} className="text-ink-2" />}
      title="대전에서만 쓸 수 있어요"
      message="지금 위치는 서비스 지역 밖이에요. 대전 안의 출발지와 도착지를 검색해 주세요."
      actions={onMoveToDaejeon && <StateButton onClick={onMoveToDaejeon}>대전 지도로 이동</StateButton>}
    />
  );
}

function SearchOffIcon() {
  return (
    <svg
      width={20}
      height={20}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      className="text-ink-2"
    >
      <circle cx="11" cy="11" r="6.5" />
      <path d="m16 16 4 4M8.5 11h5" />
    </svg>
  );
}
