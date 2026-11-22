// Google Maps ranking (/seo/maps): three numbers for every keyword together, the keyword list with each one's grid,
// and for the chosen keyword a sentence on what's going on, then one of Map, Why they're ahead, or Over time.
// `?keyword=` picks the keyword and `?view=why|time` opens a view, so each can be linked to.
import { useMemo, useState, type ReactNode } from "react";
import { Link, useSearchParams } from "react-router";
import { Plus, X } from "lucide-react";
import { Button, Card, LineChart, Segmented, cn, fmt } from "../../components/ui";
import { LoadError } from "../../components/Feedback";
import { useLoad } from "../../lib/useLoad";
import { locationApi, seoApi, type MapsKeyword, type MapsSummary } from "./api";
import { AddKeywords } from "./AddDrawers";
import { Bar, Change, GridLegend, GridMap, GridThumb, Source, rankIn } from "./parts";
import { kindsOf, useAfterCheck, useReloadWhilePending } from "./checks";
import { SeoHeader, useSeo } from "./Seo";

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
        sub={`How often you're in the top 3, from ${location.gridSize * location.gridSize} spots around you.`}
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
              {chosen ? <KeywordDetail key={chosen.id} keywordId={chosen.id} /> : <NoScanYet />}
            </div>
          </>
        )
      )}
      <Source>
        Google Maps searched from every spot of the grid for each keyword, through DataForSEO; every result lists the businesses at that
        spot, so competitors and their ratings come with it.
      </Source>
      <AddKeywords
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
        label="In the top 3"
        value={
          <>
            {share}% <span className="text-muted">of spots</span>
          </>
        }
        hint={<Change by={totals.top3Before === null ? null : totals.top3 - totals.top3Before} unit="more spots" />}
      />
      <Stat
        label="Average position"
        value={totals.avg === null ? "—" : totals.avg.toFixed(1)}
        hint={totals.avgBefore !== null ? `was ${totals.avgBefore.toFixed(1)}` : undefined}
      />
      <Stat
        label="Keywords you lead"
        value={
          <>
            {totals.leading} <span className="text-muted">of {keywords.length}</span>
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
      {keywords.length === 0 && <p className="text-[13px] text-muted">No keywords yet. Add some to see where you show on the map.</p>}
      <ul className="space-y-2">
        {keywords.map((k) =>
          k.pending ? (
            <li key={k.id} className="rounded-xl border border-dashed border-line-strong p-3">
              <span className="block truncate text-[14px] font-medium">{k.term}</span>
              <span className="block text-[12.5px] text-muted">First scan running. The map appears in a few minutes.</span>
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
                    {k.top3} of {k.size * k.size} spots · average {k.avg.toFixed(1)}
                  </span>
                  <span className="block truncate text-[12.5px] text-muted">
                    {k.leader ? `${k.leader.name} leads with ${k.leader.top3}` : "You lead"}
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
      <p className="mt-1 text-[13px] text-muted">The first scan runs a few minutes after a keyword is added.</p>
    </Card>
  );
}

// ---------- One keyword ----------

function KeywordDetail({ keywordId }: { keywordId: string }) {
  const { orgId, location } = useSeo();
  const [params, setParams] = useSearchParams();
  const detail = useLoad(() => locationApi(orgId, location.id).results.maps({ keywordId }).get(), [orgId, location.id, keywordId]);
  useAfterCheck(kindsOf.maps, detail.reload);
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

  return (
    <Card>
      <p className="text-[13px] text-muted">“{d.keyword.term}”</p>
      <p className="mt-1 max-w-2xl font-serif text-[20px] leading-snug">
        {ahead.length === 0 || !leader
          ? "You lead this one. "
          : `${leader.name} leads this one, with ${leader.top3} spots to your ${mine}. `}
        {you?.bestSide
          ? `You do best ${sideText[you.bestSide]} of your door and worst to the ${sideText[you.worstSide ?? ""] ?? ""}.`
          : "You aren't in the top 3 anywhere yet."}
      </p>
      <div className="mt-4">
        <Segmented<View>
          label="What to look at"
          value={view}
          onChange={setView}
          options={[
            { id: "map", label: "Map" },
            { id: "why", label: ahead.length ? `Why ${ahead.length} ${ahead.length === 1 ? "is" : "are"} ahead` : "Profiles compared" },
            { id: "time", label: "Over time" },
          ]}
        />
      </div>
      {view === "map" && <MapView d={d} />}
      {view === "why" && <WhyView board={d.board} ahead={ahead} you={you} />}
      {view === "time" && <TimeView d={d} />}
    </Card>
  );
}

const nameOf = (b: Board) => (b.isYou ? "You" : b.name);

function MapView({ d }: { d: MapsKeyword }) {
  const [who, setWho] = useState<string | null>(d.youPlaceId);
  const [ago, setAgo] = useState(false);
  const [spot, setSpot] = useState<number | null>(null);
  const grid = ago && d.before ? d.before : d.scan;

  const points = useMemo(() => (grid?.points ?? []).toSorted((a, b) => a.idx - b.idx), [grid]);
  const ranks = points.map((p) => rankIn(p.ranking, who));
  if (!grid) return null;
  const size = grid.size;
  const door = ranks[((size - 1) / 2) * size + (size - 1) / 2] ?? null;
  const top3 = ranks.filter((r) => r !== null && r <= 3).length;
  const avg = ranks.length ? ranks.reduce<number>((n, r) => n + (r ?? NOT_FOUND), 0) / ranks.length : NOT_FOUND;
  const chosen = d.board.find((b) => b.placeId === who);
  const label = (id: string) => (id === d.youPlaceId ? "You" : (d.places[id]?.name ?? "A business"));
  const atSpot = spot === null ? null : points[spot];

  return (
    <div className="mt-4 grid gap-6 md:grid-cols-2">
      <div>
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <p className="text-[13px] font-medium">{!chosen || chosen.isYou ? "Your map" : chosen.name}</p>
          <Segmented<"now" | "ago">
            label="When"
            value={ago ? "ago" : "now"}
            disabled={!d.before}
            onChange={(v) => {
              setAgo(v === "ago");
              setSpot(null);
            }}
            options={[
              { id: "now", label: "Now" },
              { id: "ago", label: "30 days ago" },
            ]}
          />
        </div>
        <GridMap size={size} ranks={ranks} selected={spot} onSelect={setSpot} />
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <GridLegend />
          <span className="text-[12.5px] text-muted">{d.before ? "Tap a dot" : "30 days ago shows after a month of checks"}</span>
        </div>
      </div>
      <div>
        <div className="grid grid-cols-3 gap-3">
          <Stat label="Top 3 spots" value={top3} hint={`of ${size * size}`} />
          <Stat label="Average" value={avg.toFixed(1)} hint="all spots" />
          <Stat label="At your door" value={door ?? "20+"} hint="position" />
        </div>
        {atSpot ? (
          <div className="mt-5 border-t border-line pt-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[13px] font-medium">
                Searching from this spot: {chosen ? nameOf(chosen) : "they"}{" "}
                {ranks[spot!] === null ? "not in the top 20" : `at ${ranks[spot!]}`}
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
            <ol className="mt-2 space-y-1">
              {atSpot.ranking.slice(0, 3).map((id, i) => (
                <li key={id} className={cn("flex gap-2 text-[13.5px]", id === d.youPlaceId && "font-medium")}>
                  <span className="num w-4 shrink-0 text-muted">{i + 1}</span>
                  {label(id)}
                </li>
              ))}
            </ol>
          </div>
        ) : (
          <div className="mt-5">
            <p className="text-[13px] font-medium">Who is in the top 3</p>
            <p className="mb-1.5 text-[12.5px] text-muted">of {size * size} spots, now. Pick one to see their map.</p>
            {d.board.slice(0, 8).map((b) => (
              <Bar
                key={b.placeId}
                name={nameOf(b)}
                value={b.top3}
                max={size * size}
                mine={b.isYou}
                active={who === b.placeId}
                onClick={() => {
                  setWho(b.placeId);
                  setSpot(null);
                }}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/** The profile numbers compared: higher is better for all of them. */
const facts: { label: string; of: (b: Board) => number | null; show?: (b: Board) => string }[] = [
  { label: "Rating", of: (b) => b.rating, show: (b) => (b.rating === null ? "—" : b.rating.toFixed(1)) },
  { label: "Reviews", of: (b) => b.reviews },
  { label: "New / mo", of: (b) => b.newReviewsPerMonth },
  { label: "Categories", of: (b) => b.categories },
];

function WhyView({ board, ahead, you }: { board: Board[]; ahead: Board[]; you: Board | undefined }) {
  const rows = [...(you ? [you] : []), ...(ahead.length ? ahead : board.filter((b) => !b.isYou))];
  const beats = (b: Board, f: (typeof facts)[number]) => {
    if (b.isYou || !you) return false;
    const theirs = f.of(b);
    const yours = f.of(you);
    return theirs !== null && (yours === null || theirs > yours);
  };
  return (
    <div className="mt-4">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-[13.5px]">
          <thead>
            <tr className="border-b border-line text-left text-[12.5px] text-muted">
              <th className="py-2 font-normal">Business</th>
              <th className="px-2 py-2 text-right font-normal">Top 3 spots</th>
              <th className="px-2 py-2 font-normal">Strongest</th>
              {facts.map((f) => (
                <th key={f.label} className="px-2 py-2 text-right font-normal">
                  {f.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((b) => (
              <tr key={b.placeId} className={cn("border-b border-line last:border-0", b.isYou && "font-medium")}>
                <td className="py-2.5">
                  {nameOf(b)}
                  {!b.isYou && b.distanceKm !== null && (
                    <span className="block text-[12.5px] font-normal text-muted">{b.distanceKm} km away</span>
                  )}
                </td>
                <td className="num px-2 py-2.5 text-right">{b.top3}</td>
                <td className="px-2 py-2.5 font-normal whitespace-nowrap text-muted">
                  {b.bestSide ? `${sideText[b.bestSide]} of you` : "nowhere yet"}
                </td>
                {facts.map((f) => (
                  <td
                    key={f.label}
                    className={cn("num px-2 py-2.5 text-right", beats(b, f) ? "font-medium text-bad" : !b.isYou && "text-muted")}
                  >
                    {f.show ? f.show(b) : f.of(b) === null ? "—" : fmt(f.of(b)!)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-[12.5px] text-muted">Red: ahead of yours. New reviews a month show after a month of checks.</p>
    </div>
  );
}

function TimeView({ d }: { d: MapsKeyword }) {
  const values = [...d.history.you, ...(d.history.leader?.values ?? [])].filter((v): v is number => v !== null);
  return (
    <div className="mt-4">
      <p className="mb-1 text-[13px] font-medium">Spots in the top 3, last 90 days</p>
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
  );
}
