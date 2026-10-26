import type { ReactNode } from "react";
import { AlertIcon, LocationOffIcon, MapOffIcon } from "@/assets/icons";
import { LogoMark } from "@/assets/Logo";
import { RetryButton } from "./RetryButton";

const pulse = "bg-skeleton animate-pulse motion-reduce:animate-none";
const line = `rounded-sm ${pulse}`;

function SkeletonBoardRow() {
  return (
    <div className="grid grid-cols-[48px_minmax(0,1fr)]">
      <div className={`h-5.5 w-9 ${line}`} />
      <div className="min-w-0">
        <div className="flex h-5.5 items-center">
          <div className={`h-3.5 w-32 ${line}`} />
        </div>
        <div className="flex h-5 items-center">
          <div className={`h-3 w-40 max-w-full ${line}`} />
        </div>
      </div>
    </div>
  );
}

function SkeletonCard({ badge }: { badge: boolean }) {
  return (
    <li aria-hidden="true" className="rounded-lg bg-surface p-4 shadow-card">
      {badge && (
        <div className="mb-2 flex h-4.5 items-center">
          <div className={`h-3 w-16 ${line}`} />
        </div>
      )}
      <div className="flex h-9 items-center justify-between gap-3">
        <div className={`h-8 w-28 ${line}`} />
        <div className={`h-7 w-20 ${line}`} />
      </div>
      <div className="mt-0.5 flex h-5.5 items-center">
        <div className={`h-4 w-36 ${line}`} />
      </div>
      <div className="mt-4">
        <div className={`h-6 w-full rounded-full ${pulse}`} />
        <div className="mt-1.5 flex h-4.5 items-center justify-between">
          <div className={`h-3 w-10 ${line}`} />
          <div className={`h-3 w-10 ${line}`} />
        </div>
      </div>
      <div className="mt-3 flex h-4.5 items-center">
        <div className={`h-3 w-32 ${line}`} />
      </div>
      <div className="mt-3 flex flex-col gap-2 border-t border-divider pt-3">
        <SkeletonBoardRow />
        <div className="grid h-5.5 grid-cols-[48px_minmax(0,1fr)] items-center">
          <div className={`h-3 w-6 ${line}`} />
          <div className={`h-3.5 w-28 ${line}`} />
        </div>
      </div>
      <div className={`mt-4 h-11 w-full rounded-md ${pulse}`} />
    </li>
  );
}

export function RouteListSkeleton({ count = 3 }: { count?: number }) {
  return (
    <ul aria-busy="true" aria-label="경로를 불러오고 있어요" className="flex flex-col gap-3 px-4">
      {Array.from({ length: count }, (_, i) => (
        <SkeletonCard key={i} badge={i === 0} />
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
      className={`inline-flex h-control min-w-40 shrink-0 items-center justify-center rounded-md px-5 text-sm font-semibold ${
        variant === "primary"
          ? "bg-action-primary text-action-primary-fg hover:bg-action-primary-pressed"
          : "bg-action-secondary text-action-secondary-fg hover:bg-action-secondary-pressed"
      }`}
    >
      {children}
    </button>
  );
}

function MessageState({
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
    <section role={role} className="flex flex-col items-center px-gutter py-10 text-center">
      {icon}
      <h2 className="mt-4 text-md font-bold text-balance break-keep text-fg">{title}</h2>
      {message && <p className="mt-1.5 max-w-xs text-sm text-balance break-keep text-fg-muted">{message}</p>}
      {actions && <div className="mt-6 flex justify-center">{actions}</div>}
    </section>
  );
}

function IconWell({ children }: { children: ReactNode }) {
  return (
    <div className="flex size-14 items-center justify-center rounded-full bg-surface-muted text-fg-secondary">
      {children}
    </div>
  );
}

export function ErrorState({
  title = "실시간 정보를 불러오지 못했어요",
  message = "잠시 후 다시 시도해 주세요.",
  onRetry,
}: {
  title?: string;
  message?: string;
  onRetry?: () => unknown;
}) {
  return (
    <MessageState
      role="alert"
      icon={
        <IconWell>
          <AlertIcon size={26} />
        </IconWell>
      }
      title={title}
      message={message}
      actions={onRetry && <RetryButton variant="state" onRetry={onRetry} />}
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
      icon={
        <IconWell>
          <LogoMark size={30} />
        </IconWell>
      }
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
  return (
    <MessageState
      icon={
        <IconWell>
          <LocationOffIcon size={26} />
        </IconWell>
      }
      title="위치 권한이 꺼져 있어요"
      message="현재 위치에서 출발하려면 브라우저 설정에서 위치 접근을 허용해 주세요. 출발지를 직접 검색해도 돼요."
      actions={
        onSearchInstead ? (
          <StateButton onClick={onSearchInstead}>출발지 검색</StateButton>
        ) : (
          onRetry && <RetryButton variant="state" onRetry={onRetry} />
        )
      }
    />
  );
}

export function OutsideServiceAreaState({ onMoveTo }: { onMoveTo?: (region: "daejeon" | "seoul") => void }) {
  return (
    <MessageState
      icon={
        <IconWell>
          <MapOffIcon size={26} />
        </IconWell>
      }
      title="대전·서울에서 쓸 수 있어요"
      message="지금 위치는 서비스 지역 밖이에요. 대전이나 서울 안의 출발지와 도착지를 검색해 주세요."
      actions={
        onMoveTo && (
          <div className="flex flex-wrap justify-center gap-2">
            <StateButton onClick={() => onMoveTo("daejeon")}>대전 지도로 이동</StateButton>
            <StateButton variant="secondary" onClick={() => onMoveTo("seoul")}>
              서울 지도로 이동
            </StateButton>
          </div>
        )
      }
    />
  );
}
