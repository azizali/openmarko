// Google Maps ranking, in the small Local SEO section (#/local/maps). Same detail as the full Rankings page
// (average position, each spot's top 3, competitors' profiles, history), but one question at a time:
// three numbers for everything, a keyword list, and for the chosen keyword a sentence that says what is going
// on, then Map / Why they're ahead / Over time. Only one of the three is on screen.

import { useState } from "react";
import { useSearchParams } from "react-router";
import { X } from "lucide-react";
import { Card, cn, fmt, LineChart, Segmented } from "../components/ui";
import { GridLegend, GridMap, GridThumb } from "../components/GridMap";
import { estimateGridCost } from "../lib/api";
import { business, type Competitor, type GridPoint } from "../mock/mock";
import { Bar, Change, Source } from "./LocalDetail";
import {
  avgPosition,
  baseKeywords,
  businesses,
  doorPosition,
  GRID_SPOTS,
  gridFor,
  profileFacts,
  reach,
  sources,
  spotsHistory,
  top3Spots,
  weekLabels,
  you,
  type TrackedKeyword,
} from "../mock/local";

type View = "map" | "why" | "time";

const nameOf = (b: Competitor) => (b.isYou ? "You" : b.name);
function Stat({
  label,
  value,
  hint,
}: {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
}) {
  return (
    <div className="min-w-0">
      <p className="text-[12.5px] text-muted">{label}</p>
      <p className="num mt-0.5 text-[18px] leading-tight font-medium">
        {value}
      </p>
      {hint && <p className="mt-0.5 text-[12.5px] text-muted">{hint}</p>}
    </div>
  );
}

export function MapsPage({ pending = [] }: { pending?: TrackedKeyword[] }) {
  const [kw, setKw] = useState(baseKeywords[0]!.id);
  // ?view=why or ?view=time opens that view, so each one can be linked to.
  const [params] = useSearchParams();
  const asked = params.get("view");
  const [view, setView] = useState<View>(
    asked === "why" || asked === "time" ? asked : "map",
  );
  const [who, setWho] = useState<Competitor>(you);
  const [ago, setAgo] = useState(false);
  const [spot, setSpot] = useState<GridPoint | null>(null);

  const pick = (id: string) => {
    setKw(id);
    setWho(you);
    setSpot(null);
  };

  // Everything, across keywords.
  const total = GRID_SPOTS * baseKeywords.length;
  const spots = baseKeywords.reduce((n, k) => n + top3Spots(k.id), 0);
  const spotsBefore = baseKeywords.reduce(
    (n, k) => n + top3Spots(k.id, you, true),
    0,
  );
  const mean = (ago_: boolean) =>
    baseKeywords.reduce((n, k) => n + avgPosition(k.id, you, ago_), 0) /
    baseKeywords.length;
  const leaderOf = (id: string) =>
    businesses
      .map((b) => ({ b, spots: top3Spots(id, b) }))
      .sort((a, b) => b.spots - a.spots)[0]!;
  const leading = baseKeywords.filter(
    (k) => top3Spots(k.id) >= leaderOf(k.id).spots,
  ).length;

  // The chosen keyword.
  const term = baseKeywords.find((k) => k.id === kw)!.term;
  const mine = top3Spots(kw);
  const lead = leaderOf(kw);
  const board = [you, ...businesses]
    .map((b) => ({ b, spots: top3Spots(kw, b) }))
    .sort((a, b) => b.spots - a.spots);
  const aheadOfYou = board.filter((r) => !r.b.isYou && r.spots > mine);
  const myReach = reach(kw);
  const leadReach = reach(kw, lead.b);
  const scan = gridFor(kw, who, ago);

  return (
    <>
      <p className="max-w-2xl text-[13.5px] text-muted">
        Google shows different results depending on where the person stands. For
        each keyword we search from {GRID_SPOTS} spots around you and note who
        is in the top 3 at each one.
      </p>

      <div className="mt-6 grid gap-5 rounded-xl border border-line bg-surface p-4 shadow-card sm:grid-cols-3">
        <Stat
          label="In the top 3"
          value={
            <>
              {Math.round((spots / total) * 100)}%{" "}
              <span className="text-muted">of spots</span>
            </>
          }
          hint={<Change by={spots - spotsBefore} unit="more spots" />}
        />
        <Stat
          label="Average position"
          value={mean(false).toFixed(1)}
          hint={`Was ${mean(true).toFixed(1)} 30 days ago. Lower is better.`}
        />
        <Stat
          label="Keywords you lead"
          value={
            <>
              {leading}{" "}
              <span className="text-muted">of {baseKeywords.length}</span>
            </>
          }
          hint="Where nobody holds more spots than you."
        />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,4fr)_minmax(0,8fr)]">
        <div>
          <h2 className="mb-2 text-[13px] font-medium text-muted">Keywords</h2>
          <ul className="space-y-2">
            {baseKeywords.map((k) => {
              const n = top3Spots(k.id);
              const l = leaderOf(k.id);
              return (
                <li key={k.id}>
                  <button
                    onClick={() => pick(k.id)}
                    aria-pressed={kw === k.id}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-xl border bg-surface p-3 text-left transition-colors",
                      kw === k.id
                        ? "border-ink"
                        : "border-line hover:border-line-strong",
                    )}
                  >
                    <GridThumb scan={gridFor(k.id)} gap={6} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[14px] font-medium">
                        {k.term}
                      </span>
                      <span className="num block text-[12.5px] text-muted">
                        {n} of {GRID_SPOTS} spots · average{" "}
                        {avgPosition(k.id).toFixed(1)}
                      </span>
                      <span className="block truncate text-[12.5px] text-muted">
                        {l.spots > n
                          ? `${l.b.name} leads with ${l.spots}`
                          : "You lead"}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
            {pending.map((k) => (
              <li
                key={k.id}
                className="rounded-xl border border-dashed border-line-strong p-3"
              >
                <span className="block truncate text-[14px] font-medium">
                  {k.term}
                </span>
                <span className="block text-[12.5px] text-muted">
                  First scan running. The map appears in a few minutes.
                </span>
              </li>
            ))}
          </ul>
        </div>

        <Card>
          <p className="text-[13px] text-muted">“{term}”</p>
          <p className="mt-1 max-w-2xl font-serif text-[20px] leading-snug">
            {aheadOfYou.length === 0
              ? "You lead this one. "
              : `${lead.b.name} leads this one, with ${lead.spots} spots to your ${mine}. `}
            {myReach
              ? `You do best ${myReach.best} of your door and worst to the ${myReach.worst}.`
              : "You aren't in the top 3 anywhere yet."}
          </p>

          <div className="mt-4">
            <Segmented<View>
              label="What to look at"
              value={view}
              onChange={setView}
              options={[
                { id: "map", label: "Map" },
                {
                  id: "why",
                  label: aheadOfYou.length
                    ? `Why ${aheadOfYou.length} are ahead`
                    : "Profiles compared",
                },
                { id: "time", label: "Over time" },
              ]}
            />
          </div>

          {view === "map" && (
            <div className="mt-4 grid gap-6 md:grid-cols-2">
              <div>
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <p className="text-[13px] font-medium">
                    {who.isYou ? "Your map" : who.name}
                  </p>
                  <Segmented<"now" | "ago">
                    label="When"
                    value={ago ? "ago" : "now"}
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
                <GridMap
                  scan={scan}
                  compact
                  selected={spot}
                  onSelect={setSpot}
                />
                <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                  <GridLegend />
                  <span className="text-[12.5px] text-muted">Tap a dot</span>
                </div>
              </div>

              <div>
                <div className="grid grid-cols-3 gap-3">
                  <Stat
                    label="Top 3 spots"
                    value={`${top3Spots(kw, who, ago)}`}
                    hint={`of ${GRID_SPOTS}`}
                  />
                  <Stat
                    label="Average"
                    value={avgPosition(kw, who, ago).toFixed(1)}
                    hint="all spots"
                  />
                  <Stat
                    label="At your door"
                    value={doorPosition(kw, who) ?? "20+"}
                    hint="position"
                  />
                </div>

                {spot ? (
                  <div className="mt-5 rounded-lg border border-line p-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-[13px] font-medium">
                        Searching from this spot: {nameOf(who)}{" "}
                        {spot.rank === null
                          ? "not in the top 20"
                          : `at ${spot.rank}`}
                      </p>
                      <button
                        onClick={() => setSpot(null)}
                        aria-label="Back to the whole area"
                        className="rounded p-1 text-muted hover:bg-hover"
                      >
                        <X size={14} />
                      </button>
                    </div>
                    <ol className="mt-2 space-y-1">
                      {spot.top3.map((name, i) => (
                        <li
                          key={name}
                          className={cn(
                            "flex gap-2 text-[13.5px]",
                            name === business.name && "font-medium",
                          )}
                        >
                          <span className="num w-4 shrink-0 text-muted">
                            {i + 1}
                          </span>
                          {name === business.name ? "You" : name}
                        </li>
                      ))}
                    </ol>
                  </div>
                ) : (
                  <div className="mt-5">
                    <p className="text-[13px] font-medium">
                      Who is in the top 3
                    </p>
                    <p className="mb-1.5 text-[12.5px] text-muted">
                      Spots out of {GRID_SPOTS}. Pick one to see their map.
                    </p>
                    {board.map(({ b, spots: n }) => (
                      <Bar
                        key={b.id}
                        name={nameOf(b)}
                        value={n}
                        max={GRID_SPOTS}
                        mine={b.isYou}
                        active={who.id === b.id}
                        onClick={() => setWho(b)}
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {view === "why" && (
            <div className="mt-4">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[680px] text-[13.5px]">
                  <thead>
                    <tr className="border-b border-line text-left text-[12.5px] text-muted">
                      <th className="py-2 font-normal">Business</th>
                      <th className="px-2 py-2 text-right font-normal">
                        Top 3 spots
                      </th>
                      <th className="px-2 py-2 font-normal">Strongest</th>
                      {profileFacts.map((f) => (
                        <th
                          key={f.label}
                          className="px-2 py-2 text-right font-normal"
                        >
                          {f.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      you,
                      ...(aheadOfYou.length
                        ? aheadOfYou.map((r) => r.b)
                        : businesses),
                    ].map((b) => (
                      <tr
                        key={b.id}
                        className={cn(
                          "border-b border-line last:border-0",
                          b.isYou && "font-medium",
                        )}
                      >
                        <td className="py-2.5">
                          {nameOf(b)}
                          {!b.isYou && (
                            <span className="block text-[12.5px] font-normal text-muted">
                              {b.distanceMi} mi away
                            </span>
                          )}
                        </td>
                        <td className="num px-2 py-2.5 text-right">
                          {top3Spots(kw, b)}
                        </td>
                        <td className="px-2 py-2.5 font-normal whitespace-nowrap text-muted">
                          {reach(kw, b)
                            ? `${reach(kw, b)!.best} of you`
                            : "nowhere yet"}
                        </td>
                        {profileFacts.map((f) => (
                          <td key={f.label} className="px-2 py-2.5 text-right">
                            <span
                              className={cn(
                                "num inline-block min-w-7 rounded px-1.5 py-0.5 text-center",
                                !b.isYou && f.of(b) > f.of(you)
                                  ? "bg-bad-soft text-bad"
                                  : !b.isYou && "text-muted",
                              )}
                            >
                              {(f.show ?? ((c) => fmt(f.of(c))))(b)}
                            </span>
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="mt-2 text-[12.5px] text-muted">
                Shaded: their Google profile is ahead of yours on that point.{" "}
                {aheadOfYou.length > 0 &&
                  board.length - 1 - aheadOfYou.length > 0 &&
                  `${board.length - 1 - aheadOfYou.length} others hold fewer spots than you and are left out.`}
              </p>
            </div>
          )}

          {view === "time" && (
            <div className="mt-4">
              <p className="mb-1 text-[13px] font-medium">
                Spots in the top 3, last 90 days
              </p>
              <LineChart
                height={220}
                yMax={
                  Math.max(...spotsHistory(kw), ...spotsHistory(kw, lead.b)) + 4
                }
                labels={weekLabels}
                series={[
                  {
                    name: "You",
                    color: "var(--accent)",
                    values: spotsHistory(kw),
                  },
                  {
                    name: lead.b.name,
                    color: "var(--subtle)",
                    values: spotsHistory(kw, lead.b),
                  },
                ]}
              />
              <p className="mt-2 text-[12.5px] text-muted">
                Your best week was {Math.max(...spotsHistory(kw))} spots.{" "}
                {leadReach &&
                  aheadOfYou.length > 0 &&
                  `${lead.b.name} is strongest ${leadReach.best} of you.`}
              </p>
            </div>
          )}
        </Card>
      </div>

      <Source>
        {sources.maps} A 7 × 7 grid for {baseKeywords.length} keywords is{" "}
        {total} requests, about $
        {estimateGridCost(7, baseKeywords.length).toFixed(2)} a scan. The
        profile numbers come from DataForSEO Business Data.
      </Source>
    </>
  );
}
