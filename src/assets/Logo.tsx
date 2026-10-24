import { WORDMARK_QUESTION_PATH, WORDMARK_TEXT_PATH, WORDMARK_VIEWBOX } from "./wordmark";

type Tone = "light" | "dark";

type LogoMarkProps = {
  size?: number;
  tone?: Tone;
  className?: string;
};

// 앱 아이콘(public/icon.svg)의 정류장 핀 + 시계 마크를 배경 없이 쓴다. viewBox는 아이콘 1024 좌표에서 핀 주변만 잘라낸 것
// 브랜드 색을 써서 일반 위치 아이콘과 구분되게 한다. 어두운 배경에서도 같은 색을 쓴다
export function LogoMark({ size = 24, className }: LogoMarkProps) {
  const pin = "fill-brand";
  const face = "fill-surface";
  const hand = "fill-fg stroke-fg";

  return (
    <svg
      width={size}
      height={size}
      viewBox="208 220 608 608"
      fill="none"
      aria-hidden="true"
      focusable="false"
      className={className}
    >
      <path d="M512 812C512 812 300 600 300 448A212 212 0 1 1 724 448C724 600 512 812 512 812Z" className={pin} />
      <circle cx="512" cy="448" r="128" className={face} />
      <path d="M512 448L568 388" strokeWidth={36} strokeLinecap="round" className={hand} />
      <circle cx="512" cy="448" r="24" className={hand} />
    </svg>
  );
}

const SIZES = {
  sm: { mark: 20, text: "text-[16px]", gap: "gap-1.5" },
  md: { mark: 24, text: "text-[20px]", gap: "gap-1.5" },
  lg: { mark: 32, text: "text-[24px]", gap: "gap-2" },
} as const;

type LogoProps = {
  size?: keyof typeof SIZES;
  tone?: Tone;
  className?: string;
};

export function Logo({ size = "md", tone = "light", className }: LogoProps) {
  const s = SIZES[size];
  const dark = tone === "dark";

  return (
    <span
      className={`inline-flex items-center whitespace-nowrap ${s.gap} ${className ?? ""}`}
    >
      <span className="sr-only">지금이니?</span>
      <LogoMark size={s.mark} tone={tone} />
      <svg
        viewBox={WORDMARK_VIEWBOX}
        aria-hidden="true"
        focusable="false"
        className={`h-[0.91em] w-auto shrink-0 ${s.text}`}
      >
        <path d={WORDMARK_TEXT_PATH} className={dark ? "fill-fg-inverse" : "fill-fg"} />
        <path d={WORDMARK_QUESTION_PATH} className="fill-brand" />
      </svg>
    </span>
  );
}
