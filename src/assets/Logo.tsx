type Tone = "light" | "dark";

type LogoMarkProps = {
  size?: number;
  tone?: Tone;
  className?: string;
};

export function LogoMark({ size = 24, tone = "light", className }: LogoMarkProps) {
  const frame = tone === "dark" ? "fill-white" : "fill-ink";
  const glass = tone === "dark" ? "stroke-white" : "stroke-ink";

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      aria-hidden="true"
      focusable="false"
      className={className}
    >
      <rect x="7" y="3.5" width="18" height="3" rx="1.5" className={frame} />
      <rect x="7" y="25.5" width="18" height="3" rx="1.5" className={frame} />
      <path d="M12.2 11.5h7.6L16 16.2z" className="fill-brand" />
      <rect x="15" y="15" width="2" height="6.5" className="fill-brand" />
      <path d="M10.4 25.5v-2.2L16 19.2l5.6 4.1v2.2z" className="fill-brand" />
      <path
        d="M9.5 6.5v2.6L14.6 16l-5.1 6.9v2.6M22.5 6.5v2.6L17.4 16l5.1 6.9v2.6"
        strokeWidth={2}
        strokeLinejoin="round"
        className={glass}
      />
    </svg>
  );
}

const SIZES = {
  sm: { mark: 20, text: "text-base", gap: "gap-1.5" },
  md: { mark: 24, text: "text-xl", gap: "gap-1.5" },
  lg: { mark: 32, text: "text-2xl", gap: "gap-2" },
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
      <span
        aria-hidden="true"
        className={`font-bold leading-none tracking-normal ${s.text} ${dark ? "text-white" : "text-ink"}`}
      >
        지
        {dark ? (
          <span className="text-brand">금</span>
        ) : (
          <span className="relative inline-block">
            <span className="absolute inset-x-0 bottom-0 h-[0.45em] rounded-xs bg-brand" />
            <span className="relative">금</span>
          </span>
        )}
        이니?
      </span>
    </span>
  );
}
