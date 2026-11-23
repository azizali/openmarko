// Pieces every SEO page shares: the map grid's thumbnail and legend (the map itself is GridMap.tsx), a change over 30 days, the one-line
// "Data source" note, a rank's tone, and a bar in a leaderboard. Then the pieces that make a page read at a glance,
// drawn the way the marketing site pictures these pages: an assistant's mark, three number tiles, a bar a week,
// your profile's facts against a competitor's as paired bars, and your name highlighted in an AI answer. Grids come from the API as the order of businesses
// at each spot, so any business's map can be drawn from the same data.
import type { ReactNode } from "react";
import { ArrowDown, ArrowUp, Info, MapPin, Search, Sparkles, Users, type LucideIcon } from "lucide-react";
import { Card, LineChart, cn } from "../../components/ui";
import { engineNames } from "./api";

// ---------- Each check's mark ----------

export type CheckId = "maps" | "keywords" | "ai" | "competitors";

/** Each check's icon and its own colour (tokens `--check-*` in index.css), written out so Tailwind keeps the classes. */
const checkMarks: Record<CheckId, { icon: LucideIcon; solid: string; ink: string }> = {
  maps: { icon: MapPin, solid: "bg-check-maps", ink: "text-check-maps" },
  keywords: { icon: Search, solid: "bg-check-search", ink: "text-check-search" },
  ai: { icon: Sparkles, solid: "bg-check-ai", ink: "text-check-ai" },
  competitors: { icon: Users, solid: "bg-check-rivals", ink: "text-check-rivals" },
};

/**
 * A check's icon in its colour, so the four checks tell apart at a glance. `solid`: the icon in the page's own colour
 * on a tile of the check's colour, where a check is introduced. `duotone`: the icon alone, its outline in the check's
 * colour and its shape filled faintly with it. `line`: the outline alone, beside a line of text. Decorative: the
 * check's name always sits beside it.
 */
export function CheckIcon({
  check,
  size = 14,
  look = "line",
  className,
}: {
  check: CheckId;
  size?: number;
  look?: "solid" | "duotone" | "line";
  className?: string;
}) {
  const m = checkMarks[check];
  const Icon = m.icon;
  if (look === "solid")
    return (
      <span
        className={cn("grid shrink-0 place-items-center rounded-[9px] text-surface shadow-control", m.solid, className)}
        style={{ width: size + 13, height: size + 13 }}
        aria-hidden
      >
        <Icon size={size} strokeWidth={2.25} />
      </span>
    );
  return (
    <Icon
      size={size}
      aria-hidden
      strokeWidth={look === "duotone" ? 2 : undefined}
      fill={look === "duotone" ? "currentColor" : "none"}
      fillOpacity={look === "duotone" ? 0.18 : undefined}
      className={cn("shrink-0", m.ink, className)}
    />
  );
}

// ---------- A figure's picture: its own data, in its check's colour ----------

/** How much of the whole is the part: a bar filled to the share, for a figure that's a percentage. */
export function Meter({ check, part, whole, label }: { check: CheckId; part: number; whole: number; label: string }) {
  const share = whole ? Math.min(1, part / whole) : 0;
  return (
    <span className="block h-2 overflow-hidden rounded-full bg-hover" role="img" aria-label={label}>
      <span className={cn("block h-full rounded-full", checkMarks[check].solid)} style={{ width: `${share * 100}%` }} />
    </span>
  );
}

/**
 * One square per item, filled for the ones counted, so "7 of 18" is seen as well as read. Past 30 items the squares
 * get too small to count, so it falls back to a `Meter`.
 */
export function Units({ check, count, total, label }: { check: CheckId; count: number; total: number; label: string }) {
  if (total > 30) return <Meter check={check} part={count} whole={total} label={label} />;
  return (
    <span className="flex flex-wrap gap-[3px]" role="img" aria-label={label}>
      {Array.from({ length: total }, (_, i) => (
        <span key={i} className={cn("size-2 rounded-[2px]", i < count ? checkMarks[check].solid : "bg-active")} />
      ))}
    </span>
  );
}

/**
 * One bar split into parts, each in its check's colour, with a legend under it naming each part: where a total comes
 * from (competitors by channel).
 */
export function Split({ parts, label }: { parts: { check: CheckId; value: number; name: string }[]; label: string }) {
  const shown = parts.filter((p) => p.value > 0);
  if (!shown.length) return null;
  return (
    <span className="block">
      <span className="flex h-2 gap-0.5 overflow-hidden rounded-full" role="img" aria-label={label}>
        {shown.map((p) => (
          <span
            key={p.check}
            className={cn("h-full first:rounded-l-full last:rounded-r-full", checkMarks[p.check].solid)}
            style={{ flexGrow: p.value }}
          />
        ))}
      </span>
      <span className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[12px] text-muted" aria-hidden>
        {shown.map((p) => (
          <span key={p.check} className="inline-flex items-center gap-1.5">
            <span className={cn("size-2 rounded-[2px]", checkMarks[p.check].solid)} />
            <span>
              <span className="num text-fg">{p.value}</span> {p.name}
            </span>
          </span>
        ))}
      </span>
    </span>
  );
}

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

/** A grid at a glance, for a row in a list. With no ranks it's the grid's shape alone: `label` then says what it shows. */
export function GridThumb({
  size,
  ranks,
  gap = 6,
  label,
  empty = "var(--border-strong)",
}: {
  size: number;
  ranks: (number | null)[];
  gap?: number;
  label?: string;
  /** The colour of a spot without a rank. */
  empty?: string;
}) {
  const pad = 4;
  const px = pad * 2 + gap * (size - 1);
  const top3 = ranks.filter((r) => r !== null && r <= 3).length;
  return (
    <svg
      width={px}
      height={px}
      className="shrink-0 rounded bg-hover"
      role="img"
      aria-label={label ?? `Top 3 at ${top3} of ${size * size} spots`}
    >
      {ranks.map((r, idx) => (
        <circle
          key={idx}
          cx={pad + (idx % size) * gap}
          cy={pad + Math.floor(idx / size) * gap}
          r={gap / 3}
          fill={r === null ? empty : dot(r)}
        />
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

// ---------- Read at a glance (the marketing site's pictures of these pages, made real) ----------

/** Each AI assistant's real mark. ChatGPT's is black, so it turns white in dark mode. */
const engineIcons: Record<string, { src: string; ink?: boolean }> = {
  chatgpt: { src: "/icons/openai.svg", ink: true },
  google_ai: { src: "/icons/gemini.svg" },
  perplexity: { src: "/icons/perplexity.svg" },
};

/** An assistant's name with its mark beside it. */
export function EngineName({ engine, size = 16, className }: { engine: string; size?: number; className?: string }) {
  const icon = engineIcons[engine];
  return (
    <span className={cn("inline-flex items-center gap-1.5", className)}>
      {icon && (
        <img
          src={icon.src}
          alt=""
          width={size}
          height={size}
          style={{ width: size, height: size }}
          className={cn("shrink-0 object-contain", icon.ink && "dark:invert")}
        />
      )}
      {engineNames[engine] ?? engine}
    </span>
  );
}

export type Tile = { label: string; value: ReactNode; unit?: ReactNode };

/** Three numbers at a glance, each with what it counts under it: "Top 3 · 21/49 · spots". */
export function Tiles({ tiles, className }: { tiles: Tile[]; className?: string }) {
  return (
    <dl className={cn("grid grid-cols-3 gap-2", className)}>
      {tiles.map((t) => (
        <div key={t.label} className="min-w-0 rounded-lg bg-hover px-3 py-2.5">
          <dt className="text-[12px] text-muted">{t.label}</dt>
          <dd className="num truncate font-serif text-[30px] leading-tight tracking-tight">{t.value}</dd>
          {t.unit && <dd className="truncate text-[12px] text-muted">{t.unit}</dd>}
        </div>
      ))}
    </dl>
  );
}

/**
 * A bar a week, the latest one in full colour, so a climb reads before any number does. A week without a reading is
 * a gap, not a zero.
 */
export function WeekBars({
  labels,
  values,
  label,
  empty = "Shows after two weeks of checks.",
}: {
  labels: string[];
  values: (number | null)[];
  /** What the bars count, read out in place of the picture. */
  label: string;
  empty?: string;
}) {
  const known = values.filter((v): v is number => v !== null);
  if (!known.length) return <p className="text-[13px] text-muted">{empty}</p>;
  const max = Math.max(1, ...known);
  const last = values.findLastIndex((v) => v !== null);
  return (
    <div>
      <div className="flex h-24 items-end gap-1" role="img" aria-label={`${label}, week by week: ${known.join(", ")}`}>
        {values.map((v, i) => (
          <div key={labels[i]} className="flex h-full flex-1 flex-col justify-end" title={`Week of ${labels[i]}: ${v ?? "no check"}`}>
            {v === null ? (
              <div className="h-px bg-line" />
            ) : (
              <div
                className={cn("rounded-sm", !v ? "bg-line-strong" : i === last ? "bg-accent" : "bg-accent/25")}
                style={{ height: v ? `${Math.max(6, (v / max) * 100)}%` : 2 }}
              />
            )}
          </div>
        ))}
      </div>
      <div className="num mt-1 flex justify-between text-[11px] text-muted">
        <span>{labels[0]}</span>
        <span>{labels[labels.length - 1]}</span>
      </div>
    </div>
  );
}

export type Versus = {
  label: string;
  yours: number | null;
  theirs: number | null;
  show?: (v: number) => string;
};

/** Your profile beside theirs, a pair of bars per fact, so the gap to close first is the longest. Higher is better. */
export function VersusBars({ rows, them }: { rows: Versus[]; them: string }) {
  return (
    <div className="flex flex-col gap-3 text-[13px]">
      <div className="flex justify-between text-[12px] text-muted">
        <span>You</span>
        <span className="truncate pl-4">{them}</span>
      </div>
      {rows.map((r) => {
        const max = Math.max(r.yours ?? 0, r.theirs ?? 0) || 1;
        const show = (v: number | null) => (v === null ? "—" : r.show ? r.show(v) : String(v));
        const behind = r.theirs !== null && (r.yours === null || r.yours < r.theirs);
        return (
          <div key={r.label} className="flex flex-col gap-1">
            <span className="text-muted">
              {r.label}
              {behind && <span className="text-bad"> · behind</span>}
            </span>
            <div className="flex items-center gap-2">
              <span className="num w-10 shrink-0 text-right">{show(r.yours)}</span>
              <span className="h-2 flex-1 overflow-hidden rounded-full bg-hover">
                <span className="block h-full rounded-full bg-accent" style={{ width: `${((r.yours ?? 0) / max) * 100}%` }} />
              </span>
              <span className="h-2 flex-1 overflow-hidden rounded-full bg-hover">
                <span className="block h-full rounded-full bg-fg/60" style={{ width: `${((r.theirs ?? 0) / max) * 100}%` }} />
              </span>
              <span className="num w-10 shrink-0">{show(r.theirs)}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Text with these names picked out, the way an AI answer reads with your name highlighted. */
export function Marked({ text, names }: { text: string; names: string[] }) {
  const wanted = names.filter((n) => n.trim().length > 1);
  if (!wanted.length) return <>{text}</>;
  const parts = text.split(new RegExp(`(${wanted.map(escape).join("|")})`, "gi"));
  const lower = new Set(wanted.map((n) => n.toLowerCase()));
  return (
    <>
      {parts.map((p, i) =>
        lower.has(p.toLowerCase()) ? (
          <mark key={i} className="rounded-sm bg-accent-soft px-0.5 text-fg">
            {p}
          </mark>
        ) : (
          p
        ),
      )}
    </>
  );
}

/**
 * Wide tables stack on phones (DESIGN.md): each row becomes its first cell as a heading, then a label and value per
 * cell (the label is the cell's `data-label`), so nothing scrolls sideways. The roles keep it a table to a screen reader
 * once the phone layout makes the parts display: block.
 */
export const stack = {
  /** A header or body cell's padding, the same in every section table. */
  pad: "px-3 py-2 font-normal",
  /** The totals row a section table ends with ("All 6 keywords"), in place of stat tiles above it (ADR 0034). */
  total: "border-t border-line-strong bg-hover/50 font-medium",
  table: "w-full text-[13.5px] sm:min-w-160 max-sm:block",
  head: "max-sm:sr-only",
  body: "max-sm:block",
  row: "max-sm:block max-sm:space-y-1 max-sm:px-4 max-sm:py-3",
  first: "max-sm:block max-sm:p-0",
  cell: "max-sm:flex max-sm:items-center max-sm:justify-between max-sm:gap-4 max-sm:p-0 max-sm:text-right max-sm:before:shrink-0 max-sm:before:text-[12.5px] max-sm:before:font-normal max-sm:before:text-muted max-sm:before:content-[attr(data-label)]",
  hide: "max-sm:hidden",
  detail: "max-sm:block",
};
