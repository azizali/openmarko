import type { GridPoint, GridScan } from "../data/mock";
import { cn } from "./ui";

const rankFill = (r: number | null) =>
  r === null ? "var(--subtle)" : r <= 3 ? "var(--good)" : r <= 10 ? "var(--warn)" : "var(--bad)";

/** Stylised map with a rank pin at each grid point. Real build: swap the SVG backdrop for Mapbox/MapLibre tiles. */
export function GridMap({ scan, selected, onSelect, compact = false }: { scan: GridScan; selected?: GridPoint | null; onSelect?: (p: GridPoint) => void; compact?: boolean }) {
  const n = scan.size;
  const pad = 8;
  const cell = (100 - pad * 2) / (n - 1);
  const c = (n - 1) / 2;
  return (
    <div className={cn("relative aspect-square w-full overflow-hidden rounded-lg border border-line")} style={{ background: "var(--map-land)" }}>
      <svg viewBox="0 0 100 100" className="absolute inset-0 h-full w-full" aria-hidden preserveAspectRatio="none">
        <path d="M-5 72 C 20 64, 34 80, 55 70 S 90 58, 105 66 L105 80 C 85 72, 70 86, 52 82 S 18 78, -5 86 Z" fill="var(--map-water)" />
        <rect x="58" y="14" width="18" height="14" rx="2" fill="var(--map-park)" />
        <rect x="12" y="40" width="12" height="16" rx="2" fill="var(--map-park)" />
        {[18, 36, 54, 88].map((y) => <line key={y} x1="0" x2="100" y1={y} y2={y + 4} stroke="var(--map-road)" strokeWidth="1.4" />)}
        {[22, 47, 70].map((x) => <line key={x} y1="0" y2="100" x1={x} x2={x - 6} stroke="var(--map-road)" strokeWidth="1.4" />)}
        <line x1="0" y1="100" x2="100" y2="0" stroke="var(--map-road)" strokeWidth="2.4" />
      </svg>
      {scan.points.map((p) => {
        const isCenter = p.row === c && p.col === c;
        const sel = selected && selected.row === p.row && selected.col === p.col;
        return (
          <button
            key={`${p.row}-${p.col}`}
            onClick={() => onSelect?.(p)}
            disabled={!onSelect}
            aria-label={`Grid point row ${p.row + 1}, column ${p.col + 1}: ${p.rank === null ? "not ranking in top 20" : "rank " + p.rank}`}
            className={cn(
              "num absolute grid -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full font-semibold text-white shadow-sm transition-transform disabled:cursor-default",
              compact ? "size-[9%] text-[10px]" : "size-[9.5%] min-h-6 min-w-6 text-[12px]",
              onSelect && "hover:scale-110",
              sel && "ring-2 ring-ink ring-offset-2 ring-offset-[var(--map-land)]",
              isCenter && "outline-2 outline-offset-2 outline-ink",
            )}
            style={{ left: `${pad + p.col * cell}%`, top: `${pad + p.row * cell}%`, background: rankFill(p.rank) }}
          >
            {p.rank ?? "20+"}
          </button>
        );
      })}
    </div>
  );
}

export function GridLegend() {
  return (
    <div className="flex flex-wrap items-center gap-4 text-[12px] text-muted">
      {[["1–3", "var(--good)"], ["4–10", "var(--warn)"], ["11–20", "var(--bad)"], ["20+", "var(--subtle)"]].map(([l, c]) => (
        <span key={l} className="inline-flex items-center gap-1.5"><span className="size-2.5 rounded-full" style={{ background: c }} />{l}</span>
      ))}
    </div>
  );
}
