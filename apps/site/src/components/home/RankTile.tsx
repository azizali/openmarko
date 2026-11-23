// The hero's tile: the app's Google Maps page for one practice, set in the middle of the first screen. A keyword's
// 7 × 7 grid on the map, the numbers it adds up to, who's ahead, and this week's fix with its Apply button.
import { ArrowUpRight, Check, MapPin, Star } from "lucide-react";
import { useEffect, useState, type PointerEvent } from "react";
import { reducedMotion, useCountUp } from "../../lib/motion";
import { cn } from "../ui";
import { GridLegend, MapGrid } from "./MapGrid";
import { business, competitors, gridRanks, history, mapsKeywords, top3 } from "./mock";

const SIZE = 7;

/** Spots in the top 3, week by week: the first keyword's climb, scaled to the one picked. */
function Trend({ now, run }: { now: number; run: boolean }) {
  const scale = now / history[history.length - 1]!;
  const weeks = history.map((v) => Math.round(v * scale));
  return (
    <div>
      <div className="mb-1.5 flex justify-between text-[12px] text-muted">
        <span className="font-medium">Spots in the top 3</span>
        <span>Last 12 weeks</span>
      </div>
      <div className="flex h-28 items-end gap-1 rounded-lg border border-line px-2.5 pt-2.5 pb-2" aria-hidden>
        {weeks.map((v, i) => (
          <span
            key={i}
            className={cn("flex-1 rounded-sm", run && "bar-in", i === weeks.length - 1 ? "bg-accent" : "bg-accent/25")}
            style={{ height: `${Math.max(10, (v / 21) * 100)}%`, animationDelay: `${i * 40}ms` }}
          />
        ))}
      </div>
    </div>
  );
}

/** Moving onto the map with a mouse runs the check again, spreading out from the spot under the pointer. */
export function RankTile() {
  const [kw, setKw] = useState(0);
  const ranks = gridRanks(SIZE, mapsKeywords[kw]!.seed);
  const found = ranks.filter((r): r is number => r !== null);
  const avg = (found.reduce((a, b) => a + b, 0) / found.length).toFixed(1);
  const [applied, setApplied] = useState(false);
  // Each keyword runs its check as it's shown: dots fill in from the door outwards (about 1.1 s), then the numbers
  // count up and the trend grows. Under reduced motion it's done at once.
  const [checking, setChecking] = useState(() => !reducedMotion());
  // A rerun from the pointer: which run this is (restarts the dots and bars) and the spot it spreads from.
  const [run, setRun] = useState(0);
  const [origin, setOrigin] = useState<number | undefined>();
  useEffect(() => {
    if (reducedMotion()) return;
    setChecking(true);
    const t = setTimeout(() => setChecking(false), 1100);
    return () => clearTimeout(t);
  }, [kw, run]);
  const rerun = (e: PointerEvent<HTMLDivElement>) => {
    if (checking || e.pointerType !== "mouse" || reducedMotion()) return;
    const b = e.currentTarget.getBoundingClientRect();
    // The dots sit inside a 7% inset; clamp so the map's edge counts as its outer row.
    const at = (v: number, size: number) => Math.min(SIZE - 1, Math.max(0, Math.floor(((v / size - 0.07) / 0.86) * SIZE)));
    setOrigin(at(e.clientY - b.top, b.height) * SIZE + at(e.clientX - b.left, b.width));
    setRun((r) => r + 1);
  };
  const top = useCountUp(top3(ranks), !checking, 900);
  const avgUp = useCountUp(Math.round(Number(avg) * 10), !checking, 900);
  const change = useCountUp(mapsKeywords[kw]!.change || 1, !checking, 900);

  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-surface text-left shadow-float">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-line px-4 py-3 sm:px-5">
        <span className="grid size-7 place-items-center rounded-md bg-accent-soft text-accent">
          <MapPin size={15} />
        </span>
        <div className="min-w-0">
          <div className="truncate text-[14px] font-medium">{business.name}</div>
          <div className="truncate text-[12px] text-muted">{business.area}</div>
        </div>
        <nav aria-label="Pages in the app" className="hidden gap-1 text-[13px] md:ml-6 md:flex">
          {["Overview", "Google Maps", "Keywords", "AI answers", "Competitors"].map((t) => (
            <span key={t} className={cn("rounded-md px-2.5 py-1", t === "Google Maps" ? "bg-sunken font-medium text-fg" : "text-muted")}>
              {t}
            </span>
          ))}
        </nav>
        <span className="ml-auto inline-flex items-center gap-1.5 text-[12px] text-muted" aria-live="polite">
          <span className={cn("ping relative size-2 rounded-full", checking ? "bg-accent text-accent" : "bg-good text-good")} />
          {checking ? `Checking ${SIZE * SIZE} spots…` : "Checked just now"}
        </span>
      </div>

      <div className="grid lg:grid-cols-[1.15fr_1fr]">
        <div className="flex flex-col gap-3 border-line p-4 sm:p-5 lg:border-r">
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Keyword">
            {mapsKeywords.slice(0, 3).map((k, i) => (
              <button
                key={k.keyword}
                onClick={() => {
                  setKw(i);
                  setRun(0);
                }}
                aria-pressed={kw === i}
                className={cn(
                  "min-h-8 rounded-full border px-3 text-[13px] transition-colors active:scale-[0.97]",
                  kw === i ? "border-ink bg-ink text-on-ink" : "border-line text-muted hover:border-line-strong hover:text-fg",
                )}
              >
                {k.keyword}
              </button>
            ))}
          </div>
          <div onPointerEnter={rerun}>
            <MapGrid key={`${kw}-${run}`} size={SIZE} ranks={ranks} animate origin={run ? origin : undefined} />
          </div>
          <GridLegend />
        </div>

        <div className="flex flex-col gap-4 p-4 sm:p-5">
          <dl className="grid grid-cols-3 gap-2">
            {[
              { k: "Top 3", v: `${top}/${SIZE * SIZE}`, d: "spots" },
              { k: "Average", v: `#${(avgUp / 10).toFixed(1)}`, d: "position" },
              { k: "30 days", v: `+${change}`, d: "top-3 spots" },
            ].map((s) => (
              <div key={s.k} className="rounded-lg bg-sunken px-3 py-2.5">
                <dt className="text-[11.5px] text-muted">{s.k}</dt>
                <dd className="num font-display text-[24px] leading-tight">{s.v}</dd>
                <dd className="text-[11.5px] text-muted">{s.d}</dd>
              </div>
            ))}
          </dl>

          <div>
            <div className="mb-1.5 text-[12px] font-medium text-muted">Ahead of you to the north-east</div>
            <ul className="divide-y divide-line rounded-lg border border-line">
              {competitors.slice(0, 3).map((c) => (
                <li key={c.name} className="flex items-center gap-2 px-3 py-2 text-[13px]">
                  <span className="truncate">{c.name}</span>
                  <span className="ml-auto inline-flex shrink-0 items-center gap-1 text-muted">
                    <Star size={12} className="fill-warn text-warn" />
                    {c.rating} · {c.reviews} reviews
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <Trend key={`${kw}-${run}`} now={top3(ranks)} run={!checking} />

          <div className="mt-auto rounded-xl border border-line bg-bg p-3.5">
            <div className="flex items-center gap-1.5 text-[12px] font-medium text-accent">
              <ArrowUpRight size={14} />
              What to do next
            </div>
            <p className="mt-1.5 text-[14px] leading-snug">
              Add <b className="font-semibold">Cosmetic dentist</b> to your Google categories.
            </p>
            <p className="mt-1 text-[12.5px] text-muted">All three practices ahead of you list it. Based on this week's check.</p>
            <button
              onClick={() => setApplied(!applied)}
              className={cn(
                "mt-3 inline-flex min-h-9 items-center gap-1.5 rounded-lg px-3 text-[13px] font-medium transition-[background-color,transform] active:scale-[0.97]",
                applied ? "bg-good-soft text-good" : "bg-ink text-on-ink hover:opacity-85",
              )}
            >
              {applied ? (
                <>
                  <Check size={14} /> Sent to Google · Undo
                </>
              ) : (
                "Apply to Google"
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
