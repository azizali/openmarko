// Google Maps ranking (/seo/maps): three numbers for every keyword together, the keyword list with each one's grid,
// and for the chosen keyword one line on where things stand, then Map, Compare profiles, or Over time. Every business
// on a leaderboard opens its drawer (PlaceDrawer). `?keyword=` picks the keyword and `?view=why|time` opens a view.
import { useMemo, useState, type ReactNode } from "react";
import { Link, useSearchParams } from "react-router";
import { ArrowUp, ChevronRight, Plus, Star, X } from "lucide-react";
import { Badge, Button, Card, LineChart, Segmented, cn, fmt } from "../../components/ui";
import { LoadError, useToast } from "../../components/Feedback";
import { messageOf } from "../../lib/api";
import { useLoad } from "../../lib/useLoad";
import { locationApi, seoApi, type MapsKeyword, type MapsSummary } from "./api";
import { AddKeywords } from "./AddDrawers";
import { Change, GridLegend, GridThumb, Source, rankIn, stack } from "./parts";
import { GridMap } from "./GridMap";
import { PlaceDrawer } from "./PlaceDrawer";
import { kindsOf, useAfterCheck, useReloadWhilePending } from "./checks";
import { SeoHeader, useSeo } from "./Seo";
import { miles } from "./distance";

type View = "map" | "why" | "time";
type Board = MapsKeyword["board"][number];
type Ready = Extract<MapsSummary["keywords"][number], { pending: false }>;

const NOT_FOUND = 21;
const sideText = { north: "north", south: "south", east: "east", west: "west" } as Record<string, string>;

export default function Maps() {
  const { orgId, location, can } = useSeo();
  const [params, setParams] = useSearchParams();
  const summary = useLoad(() => locationApi(orgId, location.id).results.maps.get(), [orgId, location.id]);
  const limits = useLoad(() => seoApi(orgId).limits.get(), [orgId]);
  const [adding, setAdding] = useState(false);
  useReloadWhilePending(!!summary.data?.keywords.some((k) => k.pending), summary.reload);
  useAfterCheck(kindsOf.maps, summary.reload);

  const ready = (summary.data?.keywords ?? []).filter((k): k is Ready => !k.pending);
  const asked = params.get("keyword");
  const chosen = ready.find((k) => k.id === asked) ?? ready[0] ?? null;
  const pick = (id: string) =>
    setParams(
      (p) => {
        p.set("keyword", id);
        return p;
      },
      { replace: true },
    );

  return (
    <>
      <SeoHeader
        tab="maps"
        sub={`Your Google Maps rank from ${location.gridSize * location.gridSize} spots within ${miles(location.gridRadiusM)}.`}
        actions={
          <>
            {can("track") && (
              <Button icon={<Plus size={14} />} onClick={() => setAdding(true)}>
                Add keywords
              </Button>
            )}
            <Link
              to={`/seo/overview?location=${location.id}&filter=maps`}
              className="text-[13px] text-muted underline-offset-2 hover:text-fg hover:underline"
            >
              Suggestions for Maps
            </Link>
          </>
        }
      />
      {summary.error ? (
        <LoadError what="your map rankings">{summary.error}</LoadError>
      ) : (
        summary.data && (
          <>
            <Totals data={summary.data} />
            <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,4fr)_minmax(0,8fr)]">
              <KeywordList keywords={summary.data.keywords} chosen={chosen?.id ?? null} onPick={pick} />
              {chosen ? <KeywordDetail key={chosen.id} keywordId={chosen.id} onStopped={() => void summary.reload()} /> : <NoScanYet />}
            </div>
          </>
        )
      )}
      <Source>
        Google Maps searched from every spot of the grid, for each keyword, through DataForSEO. Ratings and reviews come from the same
        results.
      </Source>
      <AddKeywords
        on="maps"
        open={adding}
        onClose={() => setAdding(false)}
        tracked={(summary.data?.keywords ?? []).map((k) => k.term)}
        limit={limits.data?.keywords ?? null}
        onAdded={() => void summary.reload()}
      />
    </>
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

function Totals({ data }: { data: MapsSummary }) {
  const { totals, keywords } = data;
  const share = totals.spots ? Math.round((totals.top3 / totals.spots) * 100) : 0;
  return (
    <div className="grid gap-5 rounded-xl border border-line bg-surface p-4 shadow-card sm:grid-cols-3">
      <Stat
        label="Top 3 share"
        value={
          <>
            {share}% <span className="text-muted">of spots</span>
          </>
        }
        hint={totals.top3Before === null ? undefined : <Change by={totals.top3 - totals.top3Before} unit="spots" />}
      />
      <Stat
        label="Average rank"
        value={totals.avg === null ? "—" : totals.avg.toFixed(1)}
        hint={totals.avgBefore !== null ? `was ${totals.avgBefore.toFixed(1)}` : undefined}
      />
      <Stat
        label="Keywords you lead"
        value={
          <>
            {totals.leading} <span className="text-muted">of {keywords.filter((k) => !k.pending).length}</span>
          </>
        }
      />
    </div>
  );
}

function KeywordList({
  keywords,
  chosen,
  onPick,
}: {
  keywords: MapsSummary["keywords"];
  chosen: string | null;
  onPick: (id: string) => void;
}) {
  return (
    <div>
      <h2 className="mb-2 text-[13px] font-medium text-muted">Keywords</h2>
      {keywords.length === 0 && <p className="text-[13px] text-muted">No keywords yet.</p>}
      <ul className="space-y-2">
        {keywords.map((k) =>
          k.pending ? (
            <li key={k.id} className="rounded-xl border border-dashed border-line-strong p-3">
              <span className="block truncate text-[14px] font-medium">{k.term}</span>
              <span className="block text-[12.5px] text-muted">First scan running…</span>
            </li>
          ) : (
            <li key={k.id}>
              <button
                type="button"
                onClick={() => onPick(k.id)}
                aria-pressed={chosen === k.id}
                className={cn(
                  "flex w-full items-center gap-3 rounded-xl border bg-surface p-3 text-left transition-colors",
                  chosen === k.id ? "border-ink" : "border-line hover:border-line-strong",
                )}
              >
                <GridThumb size={k.size} ranks={k.grid} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[14px] font-medium">{k.term}</span>
                  <span className="num block text-[12.5px] text-muted">
                    Top 3: {Math.round((k.top3 / (k.size * k.size)) * 100)}% · avg {k.avg.toFixed(1)}
                  </span>
                  <span className="block truncate text-[12.5px] text-muted">
                    {k.leader ? `#1 ${k.leader.name}` : <span className="text-good">You're #1</span>}
                  </span>
                </span>
              </button>
            </li>
          ),
        )}
      </ul>
    </div>
  );
}

function NoScanYet() {
  return (
    <Card>
      <p className="text-[14px] font-medium">No map yet</p>
      <p className="mt-1 text-[13px] text-muted">The first scan takes a few minutes.</p>
    </Card>
  );
}

// ---------- One keyword ----------

function KeywordDetail({ keywordId, onStopped }: { keywordId: string; onStopped: () => void }) {
  const { orgId, location, can } = useSeo();
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const detail = useLoad(() => locationApi(orgId, location.id).results.maps({ keywordId }).get(), [orgId, location.id, keywordId]);
  useAfterCheck(kindsOf.maps, detail.reload);
  // Whose map is drawn, and whose drawer is open: both start on nobody (the map then shows yours).
  const [who, setWho] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const asked = params.get("view");
  const view: View = asked === "why" || asked === "time" ? asked : "map";
  const setView = (v: View) =>
    setParams(
      (p) => {
        if (v === "map") p.delete("view");
        else p.set("view", v);
        return p;
      },
      { replace: true },
    );

  if (detail.error) return <LoadError what="this keyword's map">{detail.error}</LoadError>;
  const d = detail.data;
  if (!d)
    return (
      <Card className="min-h-80">
        <span className="sr-only">Loading the map</span>
      </Card>
    );
  const you = d.board.find((b) => b.isYou);
  const mine = you?.top3 ?? 0;
  const ahead = d.board.filter((b) => !b.isYou && b.top3 > mine);
  const leader = d.board.find((b) => !b.isYou);
  const spots = d.scan ? d.scan.size * d.scan.size : 0;
  const term = d.keyword.term;

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
          onStopped();
        }),
    });
    onStopped();
  };

  return (
    <Card>
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-[13px] text-muted">“{term}”</p>
        {can("track") && (
          <button
            type="button"
            onClick={() => void stop()}
            className="text-[12.5px] text-muted underline-offset-2 hover:text-fg hover:underline"
          >
            Stop tracking on Maps
          </button>
        )}
      </div>
      <p className="mt-1 max-w-2xl font-serif text-[22px] leading-snug tracking-[-0.015em]">
        {verdict(mine, spots, ahead.length, leader, you)}
      </p>
      <div className="mt-4">
        <Segmented<View>
          label="What to look at"
          value={view}
          onChange={setView}
          options={[
            { id: "map", label: "Map" },
            { id: "why", label: "Compare profiles" },
            { id: "time", label: "Over time" },
          ]}
        />
      </div>
      {view === "map" && <MapView d={d} who={who ?? d.youPlaceId} onWho={setWho} onOpen={setOpen} />}
      {view === "why" && <CompareView board={d.board} ahead={ahead} you={you} onOpen={setOpen} />}
      {view === "time" && <TimeView d={d} />}
      <PlaceDrawer
        placeId={open}
        onClose={() => setOpen(null)}
        onShowMap={(id) => {
          setWho(id);
          setView("map");
        }}
      />
    </Card>
  );
}

const nameOf = (b: Board) => (b.isYou ? "You" : b.name);

/** The one line on a keyword's map. Leading means more top-3 spots than anyone, so with none it's not a lead. */
function verdict(mine: number, spots: number, behind: number, leader: Board | undefined, you: Board | undefined): string {
  const lead =
    mine === 0
      ? leader && leader.top3 > 0
        ? `${leader.name} leads with ${leader.top3} top-3 spots. You have none yet.`
        : "Nobody holds the top 3 here yet."
      : behind === 0 || !leader
        ? `You lead: top 3 in ${mine} of ${spots} spots.`
        : `${leader.name} leads, ${leader.top3} spots to your ${mine}.`;
  if (mine === 0 || !you?.bestSide) return lead;
  const best = sideText[you.bestSide];
  const worst = you.worstSide ? sideText[you.worstSide] : null;
  return `${lead} Strongest ${best}${worst && worst !== best ? `, weakest ${worst}` : ""}.`;
}

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

/** One business on a leaderboard: its rank, name, rating and reviews, and top-3 spots out of all. Opens its drawer. */
function BoardRow({ b, spots, showing, onOpen }: { b: Board; spots: number; showing: boolean; onOpen: (id: string) => void }) {
  return (
    <button
      type="button"
      onClick={() => onOpen(b.placeId)}
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
    </button>
  );
}

function MapView({
  d,
  who,
  onWho,
  onOpen,
}: {
  d: MapsKeyword;
  who: string | null;
  onWho: (id: string | null) => void;
  onOpen: (id: string) => void;
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

  return (
    <div className="mt-4 grid gap-6 md:grid-cols-2">
      <div>
        <div className="mb-2 flex min-h-7 flex-wrap items-center justify-between gap-2">
          <p className="truncate text-[13px] font-medium">{theirs ? `${chosen.name}'s map` : "Your map"}</p>
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
        <div className="mt-4 grid grid-cols-3 gap-3 border-t border-line pt-3">
          <Stat label="Top 3" value={top3} hint={`of ${spots} spots`} />
          <Stat label="Avg rank" value={avg.toFixed(1)} />
          <Stat label="At your door" value={door === null ? "20+" : `#${door}`} />
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
                return (
                  <li key={id}>
                    <button
                      type="button"
                      disabled={!b}
                      onClick={() => b && onOpen(id)}
                      className={cn(
                        "flex w-full items-center gap-3 rounded-lg px-2 py-1.5 text-left text-[13.5px] enabled:hover:bg-hover",
                        id === d.youPlaceId && "font-medium",
                      )}
                    >
                      <span className="num grid size-6 shrink-0 place-items-center rounded-full bg-ink text-[12px] font-medium text-surface">
                        {i + 1}
                      </span>
                      <span className="min-w-0 flex-1 truncate">{label(id)}</span>
                      {b && (
                        <span className="text-[12px] text-muted">
                          <Stars rating={b.rating} reviews={b.reviews} />
                        </span>
                      )}
                    </button>
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
              <BoardRow key={b.placeId} b={b} spots={spots} showing={theirs ? b.placeId === who : false} onOpen={onOpen} />
            ))}
            {youBelow && (
              <>
                <div className="mx-2 my-1 border-t border-dashed border-line" />
                <BoardRow b={youBelow} spots={spots} showing={false} onOpen={onOpen} />
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ---------- Compare profiles ----------

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
  onOpen,
}: {
  board: Board[];
  ahead: Board[];
  you: Board | undefined;
  onOpen: (id: string) => void;
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
    <div className="mt-4 space-y-5">
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
                  <button type="button" onClick={() => onOpen(b.placeId)} className="text-left underline-offset-2 hover:underline">
                    <span className="sm:hidden">#{b.rank} </span>
                    {nameOf(b)}
                  </button>
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

function TimeView({ d }: { d: MapsKeyword }) {
  const values = [...d.history.you, ...(d.history.leader?.values ?? [])].filter((v): v is number => v !== null);
  const now = d.scan;
  const then = d.before;
  const ranksOf = (g: NonNullable<MapsKeyword["scan"]>) =>
    g.points.toSorted((a, b) => a.idx - b.idx).map((p) => rankIn(p.ranking, d.youPlaceId));
  return (
    <div className="mt-4 space-y-6">
      <div>
        <p className="mb-1 text-[13px] font-medium">Top-3 spots, 90 days</p>
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
      {now && then && (
        <div>
          <p className="mb-2 text-[13px] font-medium">Your map, 30 days apart</p>
          <div className="flex flex-wrap items-end gap-6">
            {[
              { label: "30 days ago", g: then },
              { label: "Now", g: now },
            ].map(({ label, g }) => {
              const rs = ranksOf(g);
              return (
                <figure key={label}>
                  <GridThumb size={g.size} ranks={rs} gap={16} />
                  <figcaption className="num mt-1.5 text-[12.5px] text-muted">
                    {label} · <span className="text-fg">{top3Of(rs)}</span> in top 3
                  </figcaption>
                </figure>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
