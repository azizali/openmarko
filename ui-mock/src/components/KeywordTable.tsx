import { useMemo, useState } from "react";
import { Link } from "react-router";
import { ArrowUpDown, ChevronRight, ExternalLink, MapPin, Star, Wand2 } from "lucide-react";
import { Badge, Button, Card, LineChart, RankDelta, Segmented, Sparkline, cn, fmt, rankTone, shortDate } from "./ui";
import { GridMap, GridLegend, GridThumb } from "./GridMap";
import { business, competitors, gridStats, makeGrid, makeRivalGrid, type Competitor, type GridPoint, type Keyword } from "../data/mock";
import { openTasksFor, useRunState } from "../lib/tasks";

export type RankView = "both" | "organic" | "local";

const seedOf = (k: Keyword) => Number(k.id.split("_")[1]) % 3;
export const scanFor = (k: Keyword, size = 5, past = false) => makeGrid(k.id, size, past ? 2 : 1, past ? seedOf(k) - 1.5 : seedOf(k));
/** 7×7 scan at one of the report's four dates (0 = 90 days ago … 3 = now, same as scanFor(k, 7)). */
export const periodScanFor = (k: Keyword, step: number) => makeGrid(k.id, 7, step === 3 ? 1 : 3 + step, seedOf(k) - 3.5 * (1 - step / 3));

/** Thumbnail of the geo-grid so every row shows its map pack at a glance. */
export function MiniGrid({ k }: { k: Keyword }) {
  const scan = useMemo(() => scanFor(k), [k.id]);
  return <GridThumb scan={scan} />;
}

/**
 * Map pack for one keyword with every competitor beside it. Clicking a
 * business loads its grid into the same map, so you can flip between your
 * coverage and theirs without leaving the row.
 */
function MapPackDetail({ k }: { k: Keyword }) {
  const [size, setSize] = useState<"5" | "7" | "9">("7");
  const [when, setWhen] = useState<"now" | "past">("now");
  const [point, setPoint] = useState<GridPoint | null>(null);
  const [whoId, setWhoId] = useState("you");
  const n = Number(size);
  const who = competitors.find((c) => c.id === whoId)!;
  // Front door = searching from your address. You sit at your tracked rank;
  // competitors fill the other positions in order of how strong they are there.
  const front = useMemo(() => {
    if (k.local === null) return new Map<string, number>();
    const rivals = competitors.filter((x) => !x.isYou).map((x) => {
      const g = makeRivalGrid(k.id, x, 7, 1);
      return { x, at: g.points[24].rank ?? 21 };
    }).sort((a, b) => a.at - b.at || a.x.avgGridRank - b.x.avgGridRank);
    const free = Array.from({ length: 20 }, (_, i) => i + 1).filter((r) => r !== k.local);
    return new Map<string, number>([["you", k.local], ...rivals.map(({ x }, i) => [x.id, free[i]] as [string, number])]);
  }, [k.id, k.local]);
  const frontPack = [...front.entries()].sort((a, b) => a[1] - b[1]).slice(0, 3).filter(([, r]) => r <= 3).map(([id]) => competitors.find((x) => x.id === id)!.name);

  const scan = useMemo(() => {
    const g = makeRivalGrid(k.id, who, n, when === "now" ? 1 : 2);
    if (when === "now") {
      const mid = g.points.find((p) => p.row === (n - 1) / 2 && p.col === (n - 1) / 2)!;
      mid.rank = front.get(who.id) ?? mid.rank;
      mid.top3 = frontPack;
    }
    return g;
  }, [k.id, whoId, n, when, front]);
  const s = gridStats(scan);
  const was = gridStats(makeRivalGrid(k.id, who, n, 2));
  const c = (scan.size - 1) / 2;
  const center = scan.points.find((p) => p.row === c && p.col === c)!;

  // Per-keyword competitor stats come from each business's own grid.
  const board = useMemo(() => competitors.map((x) => ({ c: x, solv: gridStats(makeRivalGrid(k.id, x, 7, 1)).solv, here: front.get(x.id) ?? null }))
    .sort((a, b) => b.solv - a.solv), [k.id, front]);
  const you = competitors.find((x) => x.isYou)!;

  if (k.local === null) {
    return <div className="grid place-items-center rounded-lg border border-dashed border-line p-6 text-center text-[13px] text-muted">Google doesn't show a map pack for this search. People want articles instead.</div>;
  }
  const isYou = !!who.isYou;
  const rank = point ? point.rank : center.rank;
  const pack = point ? point.top3 : center.top3;
  const subject = isYou ? "You're" : `${who.name} is`;
  const pick = (id: string) => { setWhoId(id); setPoint(null); };

  return (
    <div className="space-y-5">
      <div className="grid gap-5 md:grid-cols-[280px_1fr]">
        <div>
          <div className="mb-2 flex items-center justify-between gap-2 text-[12.5px]">
            <span className="truncate"><span className="text-muted">Showing </span><b className={cn("font-medium", isYou && "text-accent")}>{isYou ? "you" : who.name}</b></span>
            {!isYou && <button onClick={() => pick("you")} className="shrink-0 text-muted underline hover:text-fg">Back to you</button>}
          </div>
          <div key={whoId} className="anim-fade">
            <GridMap scan={scan} compact selected={point} onSelect={(p) => setPoint((cur) => (cur && cur.row === p.row && cur.col === p.col ? null : p))} />
          </div>
          <div className="mt-2 flex flex-wrap justify-center gap-1.5">
            <Segmented label="Grid size" value={size} onChange={(v) => { setSize(v); setPoint(null); }} options={[{ id: "5", label: "5×5" }, { id: "7", label: "7×7" }, { id: "9", label: "9×9" }]} />
            <Segmented label="Scan date" value={when} onChange={(v) => { setWhen(v); setPoint(null); }} options={[{ id: "now", label: "Now" }, { id: "past", label: "30d ago" }]} />
          </div>
        </div>
        <div className="min-w-0">
          {point && <div className="mb-1 flex items-center gap-1.5 text-[12.5px] text-muted"><MapPin size={12} /> Searching from row {point.row + 1}, col {point.col + 1} <button onClick={() => setPoint(null)} className="underline">reset</button></div>}
          <div className="font-serif text-[18px] leading-snug">
            {rank === null ? <>{subject} not in the top 20 here.</> : rank <= 3 ? <>{subject} <b className="font-medium">#{rank}</b> in the map pack.</> : <>{subject} <b className="font-medium">#{rank}</b>, {rank - 3} spot{rank - 3 > 1 ? "s" : ""} from the map pack.</>}
          </div>
          {!point && <div className="mt-0.5 text-[12.5px] text-muted">From your front door · top 3 in {s.solv.toFixed(0)}% of the area</div>}
          <ol className="mt-3 space-y-1">
            {pack.map((name, i) => {
              const c2 = competitors.find((x) => x.name === name);
              return (
                <li key={name}>
                  <button onClick={() => c2 && pick(c2.id)} className={cn("flex w-full items-center gap-2.5 rounded-md px-2.5 py-1.5 text-left text-[13px] hover:ring-1 hover:ring-line-strong", name === business.name ? "bg-accent-soft/60 font-medium" : "bg-hover", c2?.id === whoId && "ring-1 ring-ink")}>
                    <span className="num w-3 text-muted">{i + 1}</span><span className="truncate">{name}</span>
                  </button>
                </li>
              );
            })}
          </ol>
          <div className="num mt-3 flex flex-wrap gap-x-5 gap-y-1 text-[12.5px] text-muted">
            <span title="Share of local voice: grid points where this business is in the top 3">Top-3 coverage <b className="font-medium text-fg">{s.solv.toFixed(0)}%</b> <span className="text-subtle">was {was.solv.toFixed(0)}%</span></span>
            <span title="Average rank across all grid points, 21 when not found">Avg. rank <b className="font-medium text-fg">{s.arp.toFixed(1)}</b></span>
            <span title="Average rank where found">Where found <b className="font-medium text-fg">{s.atrp.toFixed(1)}</b></span>
          </div>
          <div className="mt-2"><GridLegend /></div>
          <p className="mt-2 text-[12px] text-subtle">Tap a dot to search from that spot. Tap a business to load its map.</p>
        </div>
      </div>

      <div>
        <div className="mb-2 flex items-baseline justify-between gap-2">
          <h4 className="text-[13px] font-medium">Who you're up against for “{k.term}”</h4>
          <Link to="/competitors" className="text-[12.5px] text-muted hover:text-fg">All competitors →</Link>
        </div>
        <div className="overflow-x-auto rounded-lg border border-line bg-surface">
          <table className="w-full min-w-[760px] text-[13px]">
            <thead className="border-b border-line text-left text-[12px] text-muted">
              <tr>
                <th className="px-3 py-2 font-normal">Business</th>
                <th className="px-3 py-2 text-right font-normal">Rank here</th>
                <th className="px-3 py-2 font-normal">Top-3 coverage</th>
                <th className="px-3 py-2 text-right font-normal">Rating</th>
                <th className="px-3 py-2 text-right font-normal">Reviews</th>
                <th className="px-3 py-2 text-right font-normal">/mo</th>
                <th className="px-3 py-2 text-right font-normal">Photos</th>
                <th className="px-3 py-2 text-right font-normal">Posts 30d</th>
                <th className="px-3 py-2 pr-4 text-right font-normal">Categories</th>
              </tr>
            </thead>
            <tbody>
              {board.map(({ c: x, solv, here }) => {
                const on = x.id === whoId;
                const ahead = (f: (c: Competitor) => number) => !x.isYou && f(x) > f(you);
                return (
                  <tr key={x.id} onClick={() => pick(x.id)} aria-selected={on} className={cn("cursor-pointer border-b border-line last:border-0", on ? "bg-accent-soft/40" : "hover:bg-hover")}>
                    <td className="px-3 py-2">
                      <span className="flex items-center gap-2.5">
                        <GridThumb scan={makeRivalGrid(k.id, x, 5, 1)} gap={5} />
                        <span className="min-w-0">
                          <span className="block truncate font-medium">{x.name} {x.isYou && <Badge tone="accent">You</Badge>}</span>
                          <span className="block text-[11.5px] text-muted">{x.isYou ? "your location" : `${x.distanceMi} mi away`}</span>
                        </span>
                      </span>
                    </td>
                    <td className="num px-3 py-2 text-right">{here === null ? <span className="text-subtle">20+</span> : <Badge tone={rankTone(here)}>#{here}</Badge>}</td>
                    <td className="px-3 py-2">
                      <span className="flex items-center gap-2"><span className="h-1.5 w-16 overflow-hidden rounded-full bg-hover"><span className={cn("block h-full rounded-full", x.isYou ? "bg-accent" : "bg-ink")} style={{ width: `${solv}%` }} /></span><span className="num text-muted">{solv.toFixed(0)}%</span></span>
                    </td>
                    <td className="num px-3 py-2 text-right"><span className={cn("inline-flex items-center gap-1", ahead((c) => c.rating) && "text-bad")}><Star size={10} className="fill-current text-warn" />{x.rating}</span></td>
                    <td className={cn("num px-3 py-2 text-right", ahead((c) => c.reviews) && "text-bad")}>{fmt(x.reviews)}</td>
                    <td className={cn("num px-3 py-2 text-right", ahead((c) => c.reviewVelocity) && "text-bad")}>{x.reviewVelocity}</td>
                    <td className={cn("num px-3 py-2 text-right", ahead((c) => c.photos) && "text-bad")}>{x.photos}</td>
                    <td className={cn("num px-3 py-2 text-right", ahead((c) => c.posts30d) && "text-bad")}>{x.posts30d}</td>
                    <td className={cn("num px-3 py-2 pr-4 text-right", ahead((c) => c.categories.length) && "text-bad")} title={x.categories.join(", ")}>{x.categories.length}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="mt-1.5 text-[12px] text-subtle">Red: that competitor is ahead of you. Click a row to see their map.</p>
      </div>
    </div>
  );
}

function OrganicResults({ k }: { k: Keyword }) {
  const others = [
    { title: "Bright Smile Austin — Dentist in South Austin", url: "brightsmileatx.com" },
    { title: "10 Best Dentists in Austin, TX (2026) — Yelp", url: "yelp.com" },
    { title: "Congress Ave Dental | Family & Cosmetic Dentistry", url: "congressavedental.com" },
    { title: "Austin Dentists — Zocdoc", url: "zocdoc.com" },
    { title: "South Lamar Dental Studio", url: "southlamardental.com" },
  ];
  const list = [...others];
  if (k.organic && k.organic <= 6) list.splice(k.organic - 1, 0, { title: `${business.name} — Dentist in Austin, TX`, url: business.website });
  return (
    <div>
      <div className="mb-2 text-[12.5px] font-medium text-muted">Google results now {k.serpFeatures.length > 0 && <span className="font-normal text-subtle">· {k.serpFeatures.join(", ")}</span>}</div>
      <ol className="space-y-2">
        {list.slice(0, 6).map((r, i) => (
          <li key={r.url} className="flex gap-3">
            <span className="num w-4 shrink-0 text-right text-[12.5px] text-subtle">{i + 1}</span>
            <div className="min-w-0">
              <div className={cn("truncate text-[13px]", r.url === business.website && "font-medium text-accent")}>{r.title}</div>
              <div className="flex items-center gap-1 truncate text-[11.5px] text-muted">{r.url} <ExternalLink size={9} /></div>
            </div>
          </li>
        ))}
      </ol>
      {(!k.organic || k.organic > 6) && <div className="mt-2 text-[12.5px] text-muted">You're <b className="num font-medium text-fg">#{k.organic}</b> with {k.url}</div>}
    </div>
  );
}

function History({ k, view }: { k: Keyword; view: RankView }) {
  return (
    <div className="min-w-0">
      <div className="mb-1 text-[12.5px] font-medium text-muted">Position over 90 days <span className="font-normal text-subtle">(lower is better)</span></div>
      <LineChart invert height={160} yMax={Math.max(20, ...k.history.map((h) => h.organic ?? 0)) + 2} labels={k.history.map((h) => shortDate(h.date))}
        series={[
          ...(view !== "local" ? [{ name: "Google", color: "var(--info)", values: k.history.map((h) => h.organic) }] : []),
          ...(view !== "organic" ? [{ name: "Map pack", color: "var(--accent)", values: k.history.map((h) => h.local) }] : []),
        ]} />
    </div>
  );
}

type SortKey = "term" | "local" | "organic" | "change" | "volume";

export function KeywordTable({ rows, expanded, onToggle, view = "both", onOpenTask }: {
  rows: Keyword[]; expanded: string | null; onToggle: (id: string) => void; view?: RankView; onOpenTask?: (kwId: string) => void;
}) {
  const state = useRunState();
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 } | null>(null);
  const showLocal = view !== "organic", showOrganic = view !== "local";

  const sorted = useMemo(() => {
    if (!sort) return rows;
    const val = (k: Keyword): number | string =>
      sort.key === "term" ? k.term
      : sort.key === "change" ? (view === "local" ? (k.localPrev ?? 0) - (k.local ?? 0) : (k.organicPrev ?? 0) - (k.organic ?? 0))
      : sort.key === "volume" ? k.volume
      : (k[sort.key] ?? 999);
    return [...rows].sort((a, b) => (val(a) > val(b) ? 1 : val(a) < val(b) ? -1 : 0) * sort.dir);
  }, [rows, sort, view]);

  const Th = ({ k, children, right }: { k: SortKey; children: React.ReactNode; right?: boolean }) => (
    <th className={cn("px-3 py-2.5 font-normal", right && "text-right")}>
      <button onClick={() => setSort({ key: k, dir: sort?.key === k ? (-sort.dir as 1 | -1) : k === "term" || k === "local" || k === "organic" ? 1 : -1 })} className="inline-flex items-center gap-1 hover:text-fg">
        {children}<ArrowUpDown size={11} className={sort?.key === k ? "text-fg" : "opacity-40"} />
      </button>
    </th>
  );
  const cols = 6 + (showLocal ? 1 : 0) + (showOrganic ? 2 : 0);

  return (
    <Card pad={false} className="overflow-x-auto">
      <table className="w-full min-w-[900px] text-[13.5px]">
        <thead className="border-b border-line text-left text-[12.5px] text-muted">
          <tr>
            <th className="py-2.5 pl-4 font-normal"><button onClick={() => setSort({ key: "term", dir: sort?.key === "term" ? (-sort.dir as 1 | -1) : 1 })} className="inline-flex items-center gap-1 hover:text-fg">Keyword<ArrowUpDown size={11} className={sort?.key === "term" ? "text-fg" : "opacity-40"} /></button></th>
            {showLocal && <Th k="local">Map pack</Th>}
            {showOrganic && <Th k="organic">Google</Th>}
            <th className="px-3 py-2.5 font-normal">90 days</th>
            <Th k="volume" right>Searches/mo</Th>
            <th className="px-3 py-2.5 text-right font-normal" title="Keyword difficulty, 0–100">Difficulty</th>
            {showOrganic && <th className="px-3 py-2.5 font-normal">Ranking page</th>}
            <th className="px-3 py-2.5 text-right font-normal">Best</th>
            <th className="py-2.5 pr-4 text-right font-normal">To-dos</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((k) => {
            const on = expanded === k.id;
            const n = openTasksFor(state, k.id).length;
            return [
              <tr key={k.id} onClick={() => onToggle(k.id)} aria-expanded={on} className={cn("cursor-pointer border-b border-line last:border-0", on ? "bg-accent-soft/40" : "hover:bg-hover")}>
                <td className="py-2.5 pl-4">
                  <span className="inline-flex items-center gap-1.5 font-medium"><ChevronRight size={13} className={cn("text-subtle transition-transform", on && "rotate-90")} />{k.term}</span>
                  <div className="ml-[19px] flex gap-1.5">{k.tags.map((t) => <span key={t} className="text-[11.5px] text-subtle">#{t}</span>)}</div>
                </td>
                {showLocal && (
                  <td className="px-3 py-2">
                    {k.local ? (
                      <span className="flex items-center gap-2.5">
                        <MiniGrid k={k} />
                        <span>
                          <Badge tone={rankTone(k.local)} className="num">#{k.local}</Badge>
                          <span className="ml-1.5"><RankDelta cur={k.local} prev={k.localPrev} /></span>
                          <span className="num block text-[11.5px] text-subtle">Top 3 in {gridStats(scanFor(k, 7)).solv.toFixed(0)}% of area</span>
                        </span>
                      </span>
                    ) : <span className="text-[12.5px] text-subtle">No map pack</span>}
                  </td>
                )}
                {showOrganic && (
                  <td className="px-3 py-2.5">
                    <span className="num inline-flex items-center gap-2"><span className="w-5 text-right">{k.organic ?? "—"}</span><RankDelta cur={k.organic} prev={k.organicPrev} /></span>
                  </td>
                )}
                <td className="px-3 py-2.5"><Sparkline data={k.history.map((h) => (view === "local" ? h.local : h.organic))} invert /></td>
                <td className="num px-3 py-2.5 text-right text-muted">{fmt(k.volume)}</td>
                <td className="num px-3 py-2.5 text-right text-muted">{k.kd}</td>
                {showOrganic && <td className="max-w-36 truncate px-3 py-2.5 text-muted">{k.url}</td>}
                <td className="num px-3 py-2.5 text-right text-muted">{k.best}</td>
                <td className="py-2.5 pr-4 text-right">{n ? <span className="num rounded bg-accent-soft px-1.5 text-[12px] font-medium text-accent">{n}</span> : <span className="text-subtle">—</span>}</td>
              </tr>,
              on && (
                <tr key={k.id + "-x"} className="border-b border-line bg-bg">
                  <td colSpan={cols} className="px-4 py-5" onClick={(e) => e.stopPropagation()}>
                    <div className="anim-fade space-y-6">
                      {view !== "organic" && <MapPackDetail k={k} />}
                      <div className="grid gap-6 xl:grid-cols-2">
                        <History k={k} view={view} />
                        <div className="min-w-0 space-y-4">
                          {view !== "local" && <OrganicResults k={k} />}
                          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[13px]">
                            {n > 0 && onOpenTask && <Button size="sm" variant="primary" icon={<Wand2 size={12} />} onClick={() => onOpenTask(k.id)}>Do the top to-do ({n})</Button>}
                            <span className="num text-muted">{fmt(k.volume)} searches/mo</span>
                            <Link to={`/todo?kw=${k.id}`} className="text-muted hover:text-fg">All to-dos for this keyword →</Link>
                          </div>
                        </div>
                      </div>
                    </div>
                  </td>
                </tr>
              ),
            ];
          })}
        </tbody>
      </table>
      {!rows.length && <div className="py-10 text-center text-[13px] text-muted">No keywords match.</div>}
    </Card>
  );
}
