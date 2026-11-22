// Pieces every SEO page shares: the map grid (and its thumbnail and legend), a change over 30 days, the one-line
// "Data source" note, a rank's tone, and a bar in a leaderboard. Grids come from the API as the order of businesses
// at each spot, so any business's map can be drawn from the same data.
import type { ReactNode } from "react";
import { ArrowDown, ArrowUp, Info } from "lucide-react";
import { Card, LineChart, cn } from "../../components/ui";

/** Where a business is in one spot's order (1 is first), or null when it's not in the top 20. */
export const rankIn = (ranking: string[], placeId: string | null) => {
  if (!placeId) return null;
  const i = ranking.indexOf(placeId);
  return i < 0 ? null : i + 1;
};

const fill = (r: number | null) => (r === null ? "var(--subtle)" : r <= 3 ? "var(--good)" : r <= 10 ? "var(--warn)" : "var(--bad)");
const dot = (r: number | null) => (r === null ? "var(--border-strong)" : r <= 3 ? "var(--good)" : r <= 10 ? "var(--warn)" : "var(--bad)");

/** Green top 3, amber the first page of ten, red below, neutral when not found. */
export function rankTone(rank: number | null | undefined): "good" | "warn" | "bad" | "neutral" {
  if (rank === null || rank === undefined) return "neutral";
  return rank <= 3 ? "good" : rank <= 10 ? "warn" : "bad";
}

/** The map grid: a pin at each spot with the business's position there. Tap a pin to see that spot's top 3. */
export function GridMap({
  size,
  ranks,
  selected,
  onSelect,
}: {
  size: number;
  /** Position at each spot, by index (row * size + col). */
  ranks: (number | null)[];
  selected?: number | null;
  onSelect?: (idx: number) => void;
}) {
  const pad = 8;
  const cell = (100 - pad * 2) / Math.max(1, size - 1);
  const c = (size - 1) / 2;
  return (
    <div className="relative aspect-square w-full overflow-hidden rounded-lg border border-line" style={{ background: "var(--map-land)" }}>
      <svg viewBox="0 0 100 100" className="absolute inset-0 h-full w-full" aria-hidden preserveAspectRatio="none">
        <path d="M-5 72 C 20 64, 34 80, 55 70 S 90 58, 105 66 L105 80 C 85 72, 70 86, 52 82 S 18 78, -5 86 Z" fill="var(--map-water)" />
        <rect x="58" y="14" width="18" height="14" rx="2" fill="var(--map-park)" />
        <rect x="12" y="40" width="12" height="16" rx="2" fill="var(--map-park)" />
        {[18, 36, 54, 88].map((y) => (
          <line key={y} x1="0" x2="100" y1={y} y2={y + 4} stroke="var(--map-road)" strokeWidth="1.4" />
        ))}
        {[22, 47, 70].map((x) => (
          <line key={x} y1="0" y2="100" x1={x} x2={x - 6} stroke="var(--map-road)" strokeWidth="1.4" />
        ))}
      </svg>
      {ranks.map((r, idx) => {
        const row = Math.floor(idx / size);
        const col = idx % size;
        const door = row === c && col === c;
        return (
          <button
            key={idx}
            type="button"
            onClick={() => onSelect?.(idx)}
            disabled={!onSelect}
            aria-pressed={selected === idx}
            aria-label={`Row ${row + 1}, column ${col + 1}${door ? " (your door)" : ""}: ${r === null ? "not in the top 20" : `position ${r}`}`}
            className={cn(
              "num absolute grid size-[9.5%] min-h-6 min-w-6 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full text-[11px] font-semibold text-white shadow-sm transition-transform disabled:cursor-default",
              onSelect && "hover:scale-110",
              selected === idx && "ring-2 ring-ink ring-offset-2 ring-offset-[var(--map-land)]",
              door && "outline-2 outline-offset-2 outline-ink",
            )}
            style={{ left: `${pad + col * cell}%`, top: `${pad + row * cell}%`, background: fill(r) }}
          >
            {r ?? "20+"}
          </button>
        );
      })}
    </div>
  );
}

export function GridLegend() {
  return (
    <div className="flex flex-wrap items-center gap-4 text-[12px] text-muted">
      {[
        ["1–3", "var(--good)"],
        ["4–10", "var(--warn)"],
        ["11–20", "var(--bad)"],
        ["20+", "var(--subtle)"],
      ].map(([label, color]) => (
        <span key={label} className="inline-flex items-center gap-1.5">
          <span className="size-2.5 rounded-full" style={{ background: color }} />
          {label}
        </span>
      ))}
    </div>
  );
}

/** A grid at a glance, for a row in a list. */
export function GridThumb({ size, ranks, gap = 6 }: { size: number; ranks: (number | null)[]; gap?: number }) {
  const pad = 4;
  const px = pad * 2 + gap * (size - 1);
  const top3 = ranks.filter((r) => r !== null && r <= 3).length;
  return (
    <svg width={px} height={px} className="shrink-0 rounded bg-hover" role="img" aria-label={`Top 3 at ${top3} of ${size * size} spots`}>
      {ranks.map((r, idx) => (
        <circle key={idx} cx={pad + (idx % size) * gap} cy={pad + Math.floor(idx / size) * gap} r={gap / 3} fill={dot(r)} />
      ))}
    </svg>
  );
}

/** A change over the last 30 days, where up is good (more spots, or a smaller position number). */
export function Change({ by, unit, none = "No change in 30 days" }: { by: number | null | undefined; unit: string; none?: string }) {
  if (by === null || by === undefined) return <span className="text-[12.5px] text-muted">First month: no change yet</span>;
  if (by === 0) return <span className="text-[12.5px] text-muted">{none}</span>;
  const Icon = by > 0 ? ArrowUp : ArrowDown;
  return (
    <span className={cn("inline-flex items-center gap-0.5 text-[12.5px] font-medium", by > 0 ? "text-good" : "text-bad")}>
      <Icon size={13} aria-hidden />
      {Math.abs(by)} {unit} in 30 days
    </span>
  );
}

/** Where a page's numbers come from: one quiet line, opened when wanted. */
export function Source({ children }: { children: ReactNode }) {
  return (
    <details className="mt-8 text-[12.5px] text-muted">
      <summary className="inline-flex cursor-pointer list-none items-center gap-1 hover:text-fg">
        <Info size={13} aria-hidden /> Data source
      </summary>
      <p className="mt-1.5 max-w-3xl leading-normal">{children}</p>
    </details>
  );
}

/** One row of a leaderboard: a name and a bar for its share. */
export function Bar({
  name,
  value,
  max,
  mine,
  active,
  onClick,
}: {
  name: string;
  value: number;
  max: number;
  mine?: boolean;
  active?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      aria-pressed={active}
      className={cn(
        "flex w-full items-center gap-3 rounded-md px-1.5 py-1 text-left text-[13px] enabled:hover:bg-hover",
        active && "bg-active",
      )}
    >
      <span className={cn("w-36 shrink-0 truncate", mine && "font-medium")}>{name}</span>
      <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-hover">
        <span
          className={cn("block h-full rounded-full", mine ? "bg-accent" : "bg-subtle")}
          style={{ width: `${max ? (value / max) * 100 : 0}%` }}
        />
      </span>
      <span className="num w-8 shrink-0 text-right">{value}</span>
    </button>
  );
}

/** A number with a smaller muted tail: "Top 3 in 31 of 75 spots". */
export function Figure({ value, tail }: { value: ReactNode; tail?: ReactNode }) {
  return (
    <span className="num">
      {value}
      {tail && <span className="text-muted"> {tail}</span>}
    </span>
  );
}

/** The one number a check page leads with, its change over 30 days, and the last 90 days beside it. */
export function Headline({
  label,
  value,
  of,
  change,
  unit,
  history,
}: {
  label: string;
  value: number;
  of: number;
  change: number | null;
  unit: string;
  history: { labels: string[]; values: (number | null)[] };
}) {
  return (
    <Card className="grid items-center gap-6 md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
      <div>
        <p className="text-[13px] text-muted">{label}</p>
        <p className="num mt-1.5 font-serif text-[44px] leading-none tracking-tight">
          {value}
          <span className="text-[24px] text-muted"> of {of}</span>
        </p>
        <p className="mt-2">
          <Change by={change} unit={unit} />
        </p>
      </div>
      <LineChart
        height={120}
        labels={history.labels}
        yMax={Math.max(1, of)}
        series={[{ name: label, color: "var(--accent)", values: history.values }]}
        area
      />
    </Card>
  );
}
