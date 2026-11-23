// Pieces every SEO page shares: the map grid's thumbnail and legend (the map itself is GridMap.tsx), a change over 30 days, the one-line
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

const dot = (r: number | null) => (r === null ? "var(--border-strong)" : r <= 3 ? "var(--good)" : r <= 10 ? "var(--warn)" : "var(--bad)");

/** Green top 3, amber the first page of ten, red below, neutral when not found. */
export function rankTone(rank: number | null | undefined): "good" | "warn" | "bad" | "neutral" {
  if (rank === null || rank === undefined) return "neutral";
  return rank <= 3 ? "good" : rank <= 10 ? "warn" : "bad";
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

/**
 * Wide tables stack on phones (DESIGN.md): each row becomes its first cell as a heading, then a label and value per
 * cell (the label is the cell's `data-label`), so nothing scrolls sideways. The roles keep it a table to a screen reader
 * once the phone layout makes the parts display: block.
 */
export const stack = {
  table: "w-full text-[13.5px] sm:min-w-160 max-sm:block",
  head: "max-sm:sr-only",
  body: "max-sm:block",
  row: "max-sm:block max-sm:space-y-1 max-sm:px-4 max-sm:py-3",
  first: "max-sm:block max-sm:p-0",
  cell: "max-sm:flex max-sm:items-center max-sm:justify-between max-sm:gap-4 max-sm:p-0 max-sm:text-right max-sm:before:shrink-0 max-sm:before:text-[12.5px] max-sm:before:font-normal max-sm:before:text-muted max-sm:before:content-[attr(data-label)]",
  hide: "max-sm:hidden",
  detail: "max-sm:block",
};
