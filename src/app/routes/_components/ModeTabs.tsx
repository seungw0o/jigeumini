import { BusGlyph, WalkGlyph } from "@/assets/icons";

export function ModeTabs({ busMinutes }: { busMinutes?: number }) {
  return (
    <div role="tablist" aria-label="이동 수단" className="flex h-12 items-center gap-2 border-b border-line px-4">
      <button
        type="button"
        role="tab"
        aria-selected="true"
        aria-label={busMinutes !== undefined ? `대중교통 ${busMinutes}분` : "대중교통"}
        className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full bg-accent px-4 text-15 font-semibold text-white tabular"
      >
        <BusGlyph size={18} />
        {busMinutes !== undefined ? `${busMinutes}분` : "버스"}
      </button>
      <span
        role="tab"
        aria-selected="false"
        aria-disabled="true"
        className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full px-4 text-15 text-muted"
      >
        <WalkGlyph size={18} />
        도보
      </span>
    </div>
  );
}
