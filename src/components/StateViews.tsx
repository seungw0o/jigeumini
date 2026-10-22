import type { ReactNode } from "react";
import { LocationOffIcon, MapOffIcon } from "@/assets/icons";
import { LogoMark } from "@/assets/Logo";

const pulse = "rounded-sm bg-canvas animate-pulse motion-reduce:animate-none";

function SkeletonBoardRow() {
  return (
    <div className="grid grid-cols-[44px_minmax(0,1fr)]">
      <div className={`h-[22px] w-8 ${pulse}`} />
      <div className="flex flex-col gap-1.5 pt-0.5">
        <div className={`h-4 w-32 ${pulse}`} />
        <div className={`h-3.5 w-40 ${pulse}`} />
      </div>
    </div>
  );
}

export function RouteListSkeleton({ count = 3 }: { count?: number }) {
  return (
    <ul aria-busy="true" aria-label="경로를 불러오는 중" className="flex flex-col gap-2">
      {Array.from({ length: count }, (_, i) => (
        <li key={i} aria-hidden="true" className="bg-surface px-4 pt-3 pb-3">
          <div className="flex items-center justify-between">
            <div className={`h-7 w-24 ${pulse}`} />
            <div className={`h-7 w-20 ${pulse}`} />
          </div>
          <div className={`mt-1.5 h-3.5 w-44 max-w-full ${pulse}`} />
          <div className={`mt-3 h-5.5 w-full ${pulse}`} />
          <div className="mt-3 flex flex-col gap-2.5 border-t border-line pt-2.5">
            <SkeletonBoardRow />
            <div className="grid grid-cols-[44px_minmax(0,1fr)]">
              <div className={`h-3.5 w-6 ${pulse}`} />
              <div className={`h-4 w-28 ${pulse}`} />
            </div>
          </div>
          <div className={`mt-3 h-9 w-full rounded-md ${pulse}`} />
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
          ? "bg-brand text-ink hover:bg-brand-strong"
          : "border border-line-strong bg-surface text-ink-2 hover:bg-fill"
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
      {icon}
      <h2 className="mt-3 text-base font-bold text-ink">{title}</h2>
      {message && <p className="mt-1 max-w-[36ch] text-13 text-muted">{message}</p>}
      {actions && <div className="mt-4 flex flex-wrap gap-2">{actions}</div>}
    </section>
  );
}

function IconWell({ children }: { children: ReactNode }) {
  return <div className="flex size-10 items-center justify-center rounded-full bg-fill">{children}</div>;
}

const brandMark = <LogoMark size={32} tone="light" />;

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
      icon={brandMark}
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
  return <MessageState icon={brandMark} title={title} message={message} actions={action} />;
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
      icon={
        <IconWell>
          <LocationOffIcon size={20} className="text-ink-2" />
        </IconWell>
      }
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
      icon={
        <IconWell>
          <MapOffIcon size={20} className="text-ink-2" />
        </IconWell>
      }
      title="대전에서만 쓸 수 있어요"
      message="지금 위치는 서비스 지역 밖이에요. 대전 안의 출발지와 도착지를 검색해 주세요."
      actions={onMoveToDaejeon && <StateButton onClick={onMoveToDaejeon}>대전 지도로 이동</StateButton>}
    />
  );
}
