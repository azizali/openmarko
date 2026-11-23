// One Google Maps keyword (/seo/maps/<keywordId>): everything about it on one page, top to bottom. The map with its
// leaderboard (or a tapped spot's top 3), how your profile compares with the businesses ahead, and the last 90 days.
// `?who=<placeId>` draws another business's map instead of yours. Every business opens its own page (Place.tsx).
import { useMemo, useState, type ReactNode } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { ArrowUp, ChevronRight, Star, X } from "lucide-react";
import { Badge, Button, Card, LineChart, cn, fmt } from "../../components/ui";
import { LoadError, useToast } from "../../components/Feedback";
import { messageOf } from "../../lib/api";
import { useLoad } from "../../lib/useLoad";
import { locationApi, type MapsKeyword as Data } from "./api";
import { GridLegend, GridThumb, Source, rankIn, stack } from "./parts";
import { GridMap } from "./GridMap";
import { kindsOf, useAfterCheck } from "./checks";
import { SeoHeader, useSeo, useSeoHref } from "./Seo";

type Board = Data["board"][number];

const NOT_FOUND = 21;
const sideText = { north: "north", south: "south", east: "east", west: "west" } as Record<string, string>;

export default function MapsKeyword({ keywordId }: { keywordId: string }) {
  const { orgId, location, can } = useSeo();
  const toast = useToast();
  const href = useSeoHref();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const detail = useLoad(() => locationApi(orgId, location.id).results.maps({ keywordId }).get(), [orgId, location.id, keywordId]);
  useAfterCheck(kindsOf.maps, detail.reload);

  if (detail.error)
    return (
      <>
        <SeoHeader tab="maps" title="Keyword" trail={[{ label: "Keyword" }]} sub="" switcher={false} />
        <LoadError what="this keyword's map">{detail.error}</LoadError>
      </>
    );
  const d = detail.data;
  if (!d) return null;

  const term = d.keyword.term;
  const you = d.board.find((b) => b.isYou);
  const mine = you?.top3 ?? 0;
  const ahead = d.board.filter((b) => !b.isYou && b.top3 > mine);
  const leader = d.board.find((b) => !b.isYou);
  const spots = d.scan ? d.scan.size * d.scan.size : 0;
  const who = params.get("who");
  const placeHref = (id: string) => href(`/seo/maps/places/${id}?keyword=${keywordId}`);
  const setWho = (id: string | null) =>
    setParams(
      (p) => {
        if (id) p.set("who", id);
        else p.delete("who");
        return p;
      },
      { replace: true },
    );

  // Stops it on Google Maps only (on Google search it carries on, if tracked there); Undo puts it back.
  const stop = async () => {
    const here = locationApi(orgId, location.id);
    const r = await here.keywords({ keywordId }).delete({ query: { from: "maps" } });
    if (r.error) return toast.error(messageOf(r.error), "Could not stop tracking");
    toast.success(`Stopped tracking “${term}” on Google Maps`, "Its history is kept.", {
      label: "Undo",
      run: () =>
        void here.keywords.post({ terms: [term], maps: true, organic: false }).then((u) => {
          if (u.error) toast.error(messageOf(u.error), "Could not undo");
        }),
    });
    navigate(href("/seo/maps"));
  };

  return (
    <>
      <SeoHeader
        tab="maps"
        title={term}
        trail={[{ label: term }]}
        switcher={false}
        sub={d.scan ? verdict(mine, spots, ahead.length, leader) : "The first scan takes a few minutes."}
        actions={
          can("track") && (
            <Button variant="ghost" onClick={() => void stop()}>
              Stop tracking on Maps
            </Button>
          )
        }
      />
      {d.scan && (
        <div className="space-y-6">
          <Card>
            <MapView d={d} who={who ?? d.youPlaceId} onWho={setWho} placeHref={placeHref} />
          </Card>
          <Card>
            <h2 className="text-[14px] font-medium">How you compare</h2>
            <CompareView board={d.board} ahead={ahead} you={you} placeHref={placeHref} />
          </Card>
          <Card>
            <h2 className="text-[14px] font-medium">Over time</h2>
            <TimeView d={d} />
          </Card>
        </div>
      )}
      <MapsSource />
    </>
  );
}

/** Where the Maps numbers come from, under every Maps page. */
export function MapsSource() {
  return (
    <Source>
      Google Maps searched from every spot of the grid, for each keyword, through DataForSEO. Ratings and reviews come from the same
      results.
    </Source>
  );
}

/** The one line on a keyword's map. Leading means more top-3 spots than anyone, so with none it's not a lead. */
function verdict(mine: number, spots: number, behind: number, leader: Board | undefined): string {
  if (mine === 0)
    return leader && leader.top3 > 0
      ? `${leader.name} leads with ${leader.top3} top-3 spots. You have none yet.`
      : "Nobody holds the top 3 here yet.";
  return behind === 0 || !leader
    ? `You lead: top 3 in ${mine} of ${spots} spots.`
    : `${leader.name} leads, ${leader.top3} spots to your ${mine}.`;
}

const nameOf = (b: Board) => (b.isYou ? "You" : b.name);

function Stars({ rating, reviews }: { rating: number | null; reviews: number | null }) {
  if (rating === null && reviews === null) return <span className="text-subtle">No reviews</span>;
  return (
    <span className="num inline-flex items-center gap-1">
      {rating !== null && (
        <>
          <Star size={11} className="fill-warn text-warn" aria-hidden />
          <span className="text-fg">{rating.toFixed(1)}</span>
        </>
      )}
      {reviews !== null && <span>({fmt(reviews)})</span>}
    </span>
  );
}

function Stat({ label, value, hint }: { label: string; value: ReactNode; hint?: ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="text-[12.5px] text-muted">{label}</p>
      <p className="num mt-0.5 text-[18px] leading-tight font-medium">{value}</p>
      {hint && <div className="mt-0.5 text-[12.5px] text-muted">{hint}</div>}
    </div>
  );
}

/** One business on a leaderboard: its rank, name, rating and reviews, and top-3 spots out of all. Opens its page. */
function BoardRow({ b, spots, showing, to }: { b: Board; spots: number; showing: boolean; to: string }) {
  return (
    <Link
      to={to}
      className={cn(
        "group flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left transition-colors hover:bg-hover",
        b.isYou && "bg-accent-soft/60",
      )}
    >
      <span
        className={cn(
          "num grid size-6 shrink-0 place-items-center rounded-full text-[12px] font-medium",
          b.rank <= 3 ? "bg-ink text-surface" : "bg-hover text-muted",
        )}
        aria-label={`Rank ${b.rank}`}
      >
        {b.rank}
      </span>
      <span className="min-w-0 flex-1">
        <span className={cn("flex items-center gap-1.5 truncate text-[13.5px]", b.isYou && "font-medium")}>
          <span className="truncate">{nameOf(b)}</span>
          {showing && <span className="shrink-0 rounded bg-hover px-1 text-[11px] font-normal text-muted">on map</span>}
        </span>
        <span className="mt-0.5 flex items-center gap-2 text-[12px] text-muted">
          <Stars rating={b.rating} reviews={b.reviews} />
          {b.category && <span className="truncate">· {b.category}</span>}
        </span>
      </span>
      <span className="num shrink-0 text-right">
        <span className="text-[14px] font-medium">{b.top3}</span>
        <span className="text-[12px] text-muted">/{spots}</span>
      </span>
      <ChevronRight size={14} className="shrink-0 text-subtle group-hover:text-fg" aria-hidden />
    </Link>
  );
}

function MapView({
  d,
  who,
  onWho,
  placeHref,
}: {
  d: Data;
  who: string | null;
  onWho: (id: string | null) => void;
  placeHref: (id: string) => string;
}) {
  const [spot, setSpot] = useState<number | null>(null);
  const grid = d.scan;

  const points = useMemo(() => (grid?.points ?? []).toSorted((a, b) => a.idx - b.idx), [grid]);
  const ranks = points.map((p) => rankIn(p.ranking, who));
  if (!grid) return null;
  const size = grid.size;
  const spots = size * size;
  const doorIdx = ((size - 1) / 2) * size + (size - 1) / 2;
  const doorAt = points.findIndex((p) => p.idx === doorIdx);
  const door = doorAt === -1 ? null : (ranks[doorAt] ?? null);
  const top3 = ranks.filter((r) => r !== null && r <= 3).length;
  const avg = ranks.length ? ranks.reduce<number>((n, r) => n + (r ?? NOT_FOUND), 0) / ranks.length : NOT_FOUND;
  const chosen = d.board.find((b) => b.placeId === who);
  const theirs = chosen && !chosen.isYou;
  const label = (id: string) => (id === d.youPlaceId ? "You" : (d.places[id]?.name ?? "A business"));
  const atSpot = spot === null ? null : points[spot];
  const byId = new Map(d.board.map((b) => [b.placeId, b]));
  // The board shows the top 8, and you below them when you're further down.
  const top = d.board.slice(0, 8);
  const youBelow = d.board.find((b) => b.isYou && b.rank > 8);
  const sides = chosen?.bestSide
    ? `${sideText[chosen.bestSide]}${chosen.worstSide && chosen.worstSide !== chosen.bestSide ? ` / ${sideText[chosen.worstSide]}` : ""}`
    : "—";

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <div>
        <div className="mb-2 flex min-h-7 flex-wrap items-center justify-between gap-2">
          <h2 className="truncate text-[14px] font-medium">{theirs ? `${chosen.name}'s map` : "Your map"}</h2>
          {theirs && (
            <button
              type="button"
              onClick={() => {
                onWho(null);
                setSpot(null);
              }}
              className="text-[12.5px] text-muted underline-offset-2 hover:text-fg hover:underline"
            >
              Back to yours
            </button>
          )}
        </div>
        <GridMap size={size} spots={points} radiusM={grid.radiusM} ranks={ranks} selected={spot} onSelect={setSpot} />
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <GridLegend />
          <span className="text-[12.5px] text-muted">Tap a dot for its top 3</span>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3 border-t border-line pt-3 sm:grid-cols-4">
          <Stat label="Top 3" value={top3} hint={`of ${spots} spots`} />
          <Stat label="Avg rank" value={avg.toFixed(1)} />
          <Stat label="At the door" value={door === null ? "20+" : `#${door}`} />
          <Stat label="Strongest / weakest" value={<span className="text-[15px]">{sides}</span>} />
        </div>
      </div>
      <div>
        {atSpot ? (
          <div>
            <div className="flex items-center justify-between gap-2">
              <p className="text-[13px] font-medium">
                This spot: {theirs ? chosen.name : "you"} {ranks[spot!] === null ? "not in top 20" : `#${ranks[spot!]}`}
              </p>
              <button
                type="button"
                onClick={() => setSpot(null)}
                aria-label="Back to the whole area"
                className="rounded p-1 text-muted hover:bg-hover"
              >
                <X size={14} />
              </button>
            </div>
            <ol className="mt-2 space-y-0.5">
              {atSpot.ranking.slice(0, 3).map((id, i) => {
                const b = byId.get(id);
                const row = (
                  <>
                    <span className="num grid size-6 shrink-0 place-items-center rounded-full bg-ink text-[12px] font-medium text-surface">
                      {i + 1}
                    </span>
                    <span className="min-w-0 flex-1 truncate">{label(id)}</span>
                    {b && (
                      <span className="text-[12px] text-muted">
                        <Stars rating={b.rating} reviews={b.reviews} />
                      </span>
                    )}
                  </>
                );
                const cls = cn(
                  "flex w-full items-center gap-3 rounded-lg px-2 py-1.5 text-left text-[13.5px]",
                  id === d.youPlaceId && "font-medium",
                );
                return (
                  <li key={id}>
                    {b ? (
                      <Link to={placeHref(id)} className={cn(cls, "hover:bg-hover")}>
                        {row}
                      </Link>
                    ) : (
                      <div className={cls}>{row}</div>
                    )}
                  </li>
                );
              })}
            </ol>
          </div>
        ) : (
          <div>
            <div className="mb-1 flex items-baseline justify-between gap-2 px-2 text-[12.5px] text-muted">
              <span>Rank · business</span>
              <span>Top-3 spots</span>
            </div>
            {top.map((b) => (
              <BoardRow key={b.placeId} b={b} spots={spots} showing={theirs ? b.placeId === who : false} to={placeHref(b.placeId)} />
            ))}
            {youBelow && (
              <>
                <div className="mx-2 my-1 border-t border-dashed border-line" />
                <BoardRow b={youBelow} spots={spots} showing={false} to={placeHref(youBelow.placeId)} />
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ---------- How you compare ----------

/** The profile numbers compared: higher is better for all of them. */
const facts: { label: string; of: (b: Board) => number | null; show?: (b: Board) => string }[] = [
  { label: "Rating", of: (b) => b.rating, show: (b) => (b.rating === null ? "—" : b.rating.toFixed(1)) },
  { label: "Reviews", of: (b) => b.reviews },
  { label: "New / mo", of: (b) => b.newReviewsPerMonth },
  { label: "Categories", of: (b) => b.categories },
];

const median = (xs: number[]) => {
  if (!xs.length) return null;
  const s = xs.toSorted((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2;
};

type Gap = { label: string; yours: string; theirs: string; behind: boolean };

/** Where your profile stands against the businesses ahead (or the next ones down, when you lead), fact by fact. */
function gapsOf(you: Board, rivals: Board[]): Gap[] {
  const out: Gap[] = [];
  for (const f of facts) {
    const m = median(rivals.map(f.of).filter((v): v is number => v !== null));
    const y = f.of(you);
    if (m === null) continue;
    const show = (v: number | null) => (v === null ? "—" : f.label === "Rating" ? v.toFixed(1) : fmt(Math.round(v)));
    out.push({ label: f.label, yours: show(y), theirs: show(m), behind: y === null || y < m });
  }
  const sites = rivals.filter((r) => r.website).length;
  if (rivals.length)
    out.push({
      label: "Website",
      yours: you.website ? "Yes" : "No",
      theirs: `${sites} of ${rivals.length}`,
      behind: !you.website && sites > rivals.length / 2,
    });
  return out;
}

function CompareView({
  board,
  ahead,
  you,
  placeHref,
}: {
  board: Board[];
  ahead: Board[];
  you: Board | undefined;
  placeHref: (id: string) => string;
}) {
  const rivals = ahead.length ? ahead : board.filter((b) => !b.isYou).slice(0, 3);
  const rows = [...rivals, ...(you ? [you] : [])].toSorted((a, b) => a.rank - b.rank);
  const gaps = you ? gapsOf(you, rivals) : [];
  const leader = rivals[0];
  const otherCategory = you && leader?.category && you.category && leader.category !== you.category;
  const beats = (b: Board, f: (typeof facts)[number]) => {
    if (b.isYou || !you) return false;
    const theirs = f.of(b);
    const yours = f.of(you);
    return theirs !== null && (yours === null || theirs > yours);
  };
  return (
    <div className="mt-3 space-y-5">
      {gaps.length > 0 && (
        <div>
          <p className="mb-2 text-[12.5px] text-muted">You vs {ahead.length ? `the ${ahead.length} ahead` : "the next 3"} (their median)</p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
            {gaps.map((g) => (
              <div key={g.label} className="rounded-lg border border-line px-3 py-2">
                <p className="text-[12px] text-muted">{g.label}</p>
                <p className="num mt-0.5 text-[15px] font-medium">
                  {g.yours} <span className="text-[12.5px] font-normal text-muted">vs {g.theirs}</span>
                </p>
                <Badge tone={g.behind ? "bad" : "good"} className="mt-1">
                  {g.behind ? "Behind" : "Even or ahead"}
                </Badge>
              </div>
            ))}
          </div>
          {otherCategory && (
            <p className="mt-2 text-[13px]">
              <span className="text-muted">Main category:</span> #{leader.rank} uses <b className="font-medium">{leader.category}</b>, you
              use <b className="font-medium">{you.category}</b>.
            </p>
          )}
        </div>
      )}
      <div className="overflow-x-auto">
        <table role="table" className={stack.table}>
          <thead role="rowgroup" className={stack.head}>
            <tr className="border-b border-line text-left text-[12.5px] text-muted">
              <th className="w-8 py-2 font-normal">#</th>
              <th className="py-2 font-normal">Business</th>
              <th className="px-2 py-2 text-right font-normal">Top 3</th>
              <th className="px-2 py-2 text-right font-normal">Avg rank</th>
              {facts.map((f) => (
                <th key={f.label} className="px-2 py-2 text-right font-normal">
                  {f.label}
                </th>
              ))}
              <th className="px-2 py-2 font-normal">Strongest</th>
            </tr>
          </thead>
          <tbody role="rowgroup" className={stack.body}>
            {rows.map((b) => (
              <tr
                key={b.placeId}
                role="row"
                className={cn("border-b border-line last:border-0", stack.row, "max-sm:px-0", b.isYou && "bg-accent-soft/40 font-medium")}
              >
                <td role="cell" className={cn("num py-2.5 text-muted", stack.hide)}>
                  {b.rank}
                </td>
                <td role="cell" className={cn("py-2.5", stack.first)}>
                  <Link to={placeHref(b.placeId)} className="underline-offset-2 hover:underline">
                    <span className="sm:hidden">#{b.rank} </span>
                    {nameOf(b)}
                  </Link>
                  <span className="block text-[12px] font-normal text-muted">
                    {[
                      b.category,
                      !b.isYou && b.distanceMi !== null ? `${b.distanceMi} mi` : null,
                      b.isClaimed === false ? "unclaimed" : null,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                </td>
                <td role="cell" data-label="Top 3" className={cn("num px-2 py-2.5 text-right", stack.cell)}>
                  {b.top3}
                </td>
                <td role="cell" data-label="Avg rank" className={cn("num px-2 py-2.5 text-right font-normal text-muted", stack.cell)}>
                  {b.avg.toFixed(1)}
                </td>
                {facts.map((f) => (
                  <td
                    key={f.label}
                    role="cell"
                    data-label={f.label}
                    className={cn(
                      "num px-2 py-2.5 text-right",
                      stack.cell,
                      beats(b, f) ? "font-medium text-bad" : !b.isYou && "text-muted",
                    )}
                  >
                    {/* Ahead of yours: an arrow and words as well as the colour. */}
                    {beats(b, f) && <ArrowUp size={12} className="mr-0.5 inline align-[-1px]" aria-hidden />}
                    {f.show ? f.show(b) : f.of(b) === null ? "—" : fmt(f.of(b)!)}
                    {beats(b, f) && <span className="sr-only"> (ahead of yours)</span>}
                  </td>
                ))}
                <td role="cell" data-label="Strongest" className={cn("px-2 py-2.5 font-normal whitespace-nowrap text-muted", stack.cell)}>
                  {b.bestSide ? sideText[b.bestSide] : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-[12.5px] text-muted">
        <ArrowUp size={12} className="inline align-[-1px] text-bad" aria-hidden /> beats yours. Open a business for its reviews and
        categories.
      </p>
    </div>
  );
}

// ---------- Over time ----------

const top3Of = (rs: (number | null)[]) => rs.filter((r) => r !== null && r <= 3).length;

function TimeView({ d }: { d: Data }) {
  const values = [...d.history.you, ...(d.history.leader?.values ?? [])].filter((v): v is number => v !== null);
  const now = d.scan;
  const then = d.before;
  const ranksOf = (g: NonNullable<Data["scan"]>) => g.points.toSorted((a, b) => a.idx - b.idx).map((p) => rankIn(p.ranking, d.youPlaceId));
  return (
    <div className="mt-3 grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
      <div className="min-w-0">
        <p className="mb-1 text-[13px] text-muted">Top-3 spots, 90 days</p>
        <LineChart
          height={220}
          yMax={Math.max(4, ...values) + 2}
          labels={d.history.labels}
          series={[
            { name: "You", color: "var(--accent)", values: d.history.you },
            ...(d.history.leader ? [{ name: d.history.leader.name, color: "var(--subtle)", values: d.history.leader.values }] : []),
          ]}
        />
      </div>
      {/* Where on the map you gained or lost: only once a scan is a month old. */}
      <div>
        <p className="mb-2 text-[13px] text-muted">Your map, 30 days apart</p>
        {now && then ? (
          <div className="flex flex-wrap items-end gap-6">
            {[
              { label: "30 days ago", g: then },
              { label: "Now", g: now },
            ].map(({ label, g }) => {
              const rs = ranksOf(g);
              return (
                <figure key={label} className="m-0">
                  <GridThumb size={g.size} ranks={rs} gap={16} />
                  <figcaption className="num mt-1.5 text-[12.5px] text-muted">
                    {label} · <span className="text-fg">{top3Of(rs)}</span> in top 3
                  </figcaption>
                </figure>
              );
            })}
          </div>
        ) : (
          <p className="text-[13px] text-muted">Shows once a scan is a month old.</p>
        )}
      </div>
    </div>
  );
}
