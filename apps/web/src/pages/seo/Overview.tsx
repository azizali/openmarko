// The SEO overview (/seo): where the Location stands this week as four figures, one per check (each opens its page),
// then the first few actions beside what's behind the figures: keywords, assistants, who leads, and what the Google
// profile brings in. The actions are the Action plan's best (actions.tsx), with the site's health in their line; the
// rest, with filters and what was done, are on the Action plan.
import type { ReactNode } from "react";
import { Link } from "react-router";
import { ChevronRight, Settings } from "lucide-react";
import { Badge, Button, Card, cn, fmt } from "../../components/ui";
import { LoadError } from "../../components/Feedback";
import { useLoad } from "../../lib/useLoad";
import { locationApi, type Overview as OverviewData, type Suggestion } from "./api";
import { Change, CheckIcon, EngineName, GridThumb, Meter, Split, Units, type CheckId } from "./parts";
import { ActionList } from "./actions";
import { kindsOf, useAfterCheck } from "./checks";
import { SeoHeader, useSeo, useSeoHref, useSeoNavigate } from "./Seo";

const checkNames = {
  maps: "Google Maps",
  keywords: "Google search",
  ai: "AI answers",
  competitors: "Competitors",
} as const;
/** Which check's colour a competitor channel is drawn in. */
const channelChecks: Record<string, CheckId> = { maps: "maps", google: "keywords", ai: "ai" };
/** A channel in a word, for a legend: "16 Maps · 38 search · 4 AI". */
const channelShort: Record<string, string> = { maps: "Maps", google: "search", ai: "AI" };
const channelNames: Record<string, string> = {
  maps: "Google Maps",
  google: "Google search",
  ai: "AI answers",
};

const diff = (now: number, before: number | null) => (before === null ? null : now - before);

/** A share of the area, as a whole percentage: what "top 3 across 40% of your area" reads. */
const pct = (part: number, whole: number) => (whole ? Math.round((part / whole) * 100) : 0);
/** The header says when its numbers are from, by how often they're checked. */
const sinceWord: Record<string, string> = {
  daily: "today",
  weekly: "this week",
  monthly: "this month",
};

export default function Overview() {
  const { orgId, location, can } = useSeo();
  const overview = useLoad(() => locationApi(orgId, location.id).overview.get(), [orgId, location.id]);
  const suggestions = useLoad(() => locationApi(orgId, location.id).suggestions.get(), [orgId, location.id]);
  // Each kind of check reloads its numbers as it finishes, and the suggestions once the cycle has written them.
  useAfterCheck(kindsOf.overview, () => Promise.all([overview.reload(), suggestions.reload()]));

  const reload = async () => {
    await Promise.all([overview.reload(), suggestions.reload()]);
  };

  return (
    <>
      <SeoHeader
        tab="overview"
        sub={`Where you show up ${sinceWord[location.checkEvery] ?? "now"}, and what to do next.`}
        actions={can("manage") && <SettingsLink />}
      />
      {overview.error ? (
        <LoadError what="where you stand">{overview.error}</LoadError>
      ) : (
        overview.data && (
          <div className="space-y-8">
            <Standing data={overview.data} />
            <div className="grid gap-8 lg:grid-cols-[minmax(0,7fr)_minmax(0,4fr)]">
              <section aria-labelledby="next">
                {suggestions.error ? (
                  <LoadError what="suggestions">{suggestions.error}</LoadError>
                ) : (
                  suggestions.data && <NextSteps open={suggestions.data.open} site={overview.data.site} onChange={reload} />
                )}
              </section>
              <Breakdown data={overview.data} />
            </div>
          </div>
        )
      )}
    </>
  );
}

function SettingsLink() {
  const go = useSeoNavigate();
  return (
    <Button icon={<Settings size={14} />} onClick={() => go("/seo/settings")}>
      Settings
    </Button>
  );
}

// ---------- Where you stand ----------

/**
 * The week in four figures, one per check, side by side so it reads at a glance before the work below. Each opens its
 * check's page. A check with nothing tracked yet says so instead of showing a zero.
 */
function Standing({ data }: { data: OverviewData }) {
  const { maps, keywords, ai, competitors, openSuggestions: open } = data;
  const cells: Cell[] = [
    {
      id: "maps",
      figure: maps.keywords ? `${pct(maps.top3, maps.spots)}%` : null,
      tail: maps.keywords ? "of your area sees you in the top 3" : "No keywords tracked on Maps yet",
      by: maps.top3Before === null ? null : pct(maps.top3, maps.spots) - pct(maps.top3Before, maps.spots),
      unit: "points",
      todo: open.maps,
      picture: maps.keywords > 0 && (
        <Meter check="maps" part={maps.top3} whole={maps.spots} label={`Top 3 at ${maps.top3} of ${maps.spots} spots`} />
      ),
    },
    {
      id: "keywords",
      figure: keywords.total ? (
        <>
          {keywords.firstPage}
          <span className="text-[20px] text-muted"> of {keywords.total}</span>
        </>
      ) : null,
      tail: keywords.total ? "on Google's first page" : "No keywords tracked on search yet",
      by: diff(keywords.firstPage, keywords.firstPageBefore),
      unit: "more",
      todo: open.keywords,
      picture: keywords.total > 0 && (
        <Units
          check="keywords"
          count={keywords.firstPage}
          total={keywords.total}
          label={`${keywords.firstPage} of ${keywords.total} keywords on the first page`}
        />
      ),
    },
    {
      id: "ai",
      figure: ai.total ? (
        <>
          {ai.named}
          <span className="text-[20px] text-muted"> of {ai.total}</span>
        </>
      ) : null,
      tail: ai.total ? "AI answers name you" : "No answers checked yet",
      by: diff(ai.named, ai.namedBefore),
      unit: "more",
      todo: open.ai,
      picture: ai.total > 0 && <Units check="ai" count={ai.named} total={ai.total} label={`${ai.named} of ${ai.total} answers name you`} />,
    },
    {
      id: "competitors",
      figure: competitors.count,
      tail: "businesses and sites compete with you",
      by: null,
      todo: 0,
      picture: (
        <Split
          parts={competitors.channels.map((c) => ({
            check: channelChecks[c.channel] ?? "competitors",
            value: c.count,
            name: channelShort[c.channel] ?? c.channel,
          }))}
          label={competitors.channels.map((c) => `${channelNames[c.channel] ?? c.channel}: ${c.count}`).join(", ")}
        />
      ),
    },
  ];
  // Until a month has passed nothing has a change to show, so that's said once here rather than on every figure.
  const firstMonth = maps.top3Before === null && keywords.firstPageBefore === null && ai.namedBefore === null;

  return (
    <section aria-labelledby="stand">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 id="stand" className="text-[15px] font-medium">
          Where you stand
        </h2>
        {firstMonth && <p className="text-[12.5px] text-muted">Changes show after your first month.</p>}
      </div>
      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-line bg-line shadow-card lg:grid-cols-4">
        {cells.map((c) => (
          <StandingCell key={c.id} {...c} />
        ))}
      </div>
    </section>
  );
}

type Cell = {
  id: keyof typeof checkNames;
  /** The figure's own data drawn small in its check's colour, so the four read apart at a glance. */
  picture?: ReactNode;
  figure: ReactNode;
  tail: string;
  by: number | null;
  unit?: string;
  todo: number;
};

function StandingCell({ id, figure, tail, picture, by, unit = "", todo }: Cell) {
  const { location } = useSeo();
  return (
    <Link
      to={`/seo/${id}?location=${location.id}`}
      className="group flex min-w-0 flex-col bg-surface p-4 transition-colors hover:bg-hover sm:p-5"
    >
      <span className="flex min-h-7 items-center gap-2 text-[13px] text-muted group-hover:text-fg">
        <CheckIcon check={id} size={16} look="duotone" />
        <span className="truncate">{checkNames[id]}</span>
        <ChevronRight size={14} aria-hidden className="-ml-0.5 shrink-0 opacity-0 transition-opacity group-hover:opacity-100" />
      </span>
      <span className="num mt-3 font-serif text-[30px] leading-none tracking-[-0.015em]">
        {figure ?? <span className="text-subtle">–</span>}
      </span>
      <span className="mt-1.5 text-[13px] leading-snug text-muted">{tail}</span>
      {/* Pushed to the cell's foot so the four pictures line up whatever the text above them runs to. */}
      {picture && <span className="mt-auto block pt-4">{picture}</span>}
      {(by !== null || todo > 0) && (
        <span className={cn("flex flex-wrap items-center gap-x-3 gap-y-1 pt-3", !picture && "mt-auto")}>
          {by !== null && <Change by={by} unit={unit} />}
          {todo > 0 && <Badge>{todo} to do</Badge>}
        </span>
      )}
    </Link>
  );
}

// ---------- By keyword, assistant and channel ----------

type Row = { key: string; label: ReactNode; value: ReactNode };

/** What's behind each figure: the first few keywords, each assistant, each channel's leader, then the Google profile. */
function Breakdown({ data }: { data: OverviewData }) {
  const { location, can } = useSeo();
  const { maps, keywords, ai, competitors } = data;
  // Each section says what its rows are and what its numbers count, so a row reads without the page around it.
  const groups: { id: keyof typeof checkNames; title: string; columns: [string, string]; rows: Row[]; more: string }[] = [
    {
      id: "maps",
      title: "Google Maps keywords",
      columns: ["Keyword", "Area in the top 3"],
      rows: maps.rows.map((r) => ({
        key: r.id,
        label: r.term,
        value: (
          <span className="flex items-center gap-2.5">
            {pct(r.top3, r.spots)}%
            <GridThumb size={r.size} ranks={r.grid} gap={5} />
          </span>
        ),
      })),
      more: `All ${maps.keywords}`,
    },
    {
      id: "keywords",
      title: "Google search keywords",
      columns: ["Keyword", "Your position"],
      rows: keywords.rows.map((r) => ({
        key: r.id,
        label: r.term,
        value: r.position === null ? <span className="text-muted">Not found</span> : r.position,
      })),
      more: `All ${keywords.total}`,
    },
    {
      id: "ai",
      title: "AI answers",
      columns: ["Assistant", "Answers naming you"],
      rows: ai.byEngine.map((e) => ({
        key: e.engine,
        label: <EngineName engine={e.engine} size={14} className="text-fg" />,
        value: `${e.named} of ${e.total}`,
      })),
      more: `All ${ai.questions} questions`,
    },
    {
      id: "competitors",
      title: "Competitors",
      columns: ["Where, and how many", "Who leads"],
      rows: competitors.channels.map((c) => ({
        key: c.channel,
        label: (
          <>
            {channelNames[c.channel] ?? c.channel} <span className="num text-subtle">{c.count}</span>
          </>
        ),
        value: c.leader ?? <span className="text-muted">No one ahead</span>,
      })),
      more: "Everyone",
    },
  ];
  const usage = [usageText(data.usage.keywords, "keyword", "keywords"), usageText(data.usage.questions, "question", "questions")].join(
    " · ",
  );

  return (
    <aside aria-labelledby="breakdown" className="min-w-0">
      <h2 id="breakdown" className="mb-3 text-[15px] font-medium">
        Behind the numbers
      </h2>
      <div className="divide-y divide-line rounded-xl border border-line bg-surface shadow-card">
        {groups
          .filter((g) => g.rows.length > 0)
          .map((g) => (
            <section key={g.id} aria-labelledby={`by-${g.id}`} className="px-4 py-3.5">
              <div className="flex items-center justify-between gap-3">
                <h3 id={`by-${g.id}`} className="flex items-center gap-2 text-[13.5px] font-medium">
                  <CheckIcon check={g.id} size={17} look="duotone" />
                  {g.title}
                </h3>
                <Link
                  to={`/seo/${g.id}?location=${location.id}`}
                  className="inline-flex min-h-7 items-center gap-0.5 text-[12.5px] text-muted hover:text-fg"
                >
                  {g.more}
                  <ChevronRight size={13} aria-hidden />
                </Link>
              </div>
              <p className="mt-2.5 flex justify-between gap-3 text-[11.5px] text-subtle" aria-hidden>
                <span>{g.columns[0]}</span>
                <span>{g.columns[1]}</span>
              </p>
              <ul className="mt-1 space-y-2" aria-label={`${g.title}: ${g.columns[0]}, ${g.columns[1]}`}>
                {g.rows.map((r) => (
                  <li key={r.key} className="flex min-h-6 items-center justify-between gap-3 text-[13px]">
                    <span className="min-w-0 truncate">{r.label}</span>
                    <span className="num shrink-0 text-right">{r.value}</span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
      </div>
      {data.profile ? (
        <ResultsCard profile={data.profile} />
      ) : (
        can("manage") &&
        !location.profileLinked && (
          <p className="mt-4 text-[13px] text-muted">
            <Link to={`/seo/settings?location=${location.id}`} className="text-fg underline underline-offset-2">
              Link your Google profile
            </Link>{" "}
            to see calls and clicks from Google.
          </p>
        )
      )}
      <p className="mt-4 text-[12.5px] text-muted">Tracking {usage}</p>
    </aside>
  );
}

function usageText(u: { used: number; limit: number | null }, one: string, many: string) {
  return u.limit === null ? `${u.used} ${u.used === 1 ? one : many}` : `${u.used} of ${u.limit} ${many}`;
}

function ResultsCard({ profile }: { profile: NonNullable<OverviewData["profile"]> }) {
  const stats: { label: string; now: number; before: number | null }[] = [
    {
      label: "Calls",
      now: profile.calls,
      before: profile.before?.calls ?? null,
    },
    {
      label: "Website clicks",
      now: profile.websiteClicks,
      before: profile.before?.websiteClicks ?? null,
    },
    {
      label: "Directions",
      now: profile.directionRequests,
      before: profile.before?.directionRequests ?? null,
    },
    {
      label: "Views",
      now: profile.views,
      before: profile.before?.views ?? null,
    },
  ];
  return (
    <Card className="mt-4" pad={false}>
      <div className="px-4 pt-3.5">
        <h3 className="text-[14px] font-medium">From your Google profile</h3>
        <p className="mt-0.5 text-[12.5px] text-muted">The last 28 days{profile.before ? ", against the 28 before" : ""}.</p>
      </div>
      <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3 px-4 pb-3.5">
        {stats.map((s) => (
          <div key={s.label}>
            <dt className="text-[12.5px] text-muted">{s.label}</dt>
            <dd className="num mt-0.5 font-serif text-[22px] leading-tight tracking-[-0.015em]">{fmt(s.now)}</dd>
            {s.before !== null && (
              <dd className="mt-0.5">
                <Delta now={s.now} before={s.before} />
              </dd>
            )}
          </div>
        ))}
      </dl>
      {profile.topSearches.length > 0 && (
        <div className="border-t border-line px-4 py-3">
          <p className="text-[12.5px] font-medium">Searches that showed your profile</p>
          <ul className="mt-1.5 space-y-1">
            {profile.topSearches.map((s) => (
              <li key={s.term} className="flex justify-between gap-3 text-[13px]">
                <span className="min-w-0 truncate text-muted">{s.term}</span>
                <span className="num shrink-0">{fmt(s.impressions)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  );
}

function Delta({ now, before }: { now: number; before: number }) {
  const by = now - before;
  if (by === 0) return <span className="text-[12px] text-muted">Same as before</span>;
  return (
    <span className={cn("num text-[12px] font-medium", by > 0 ? "text-good" : "text-bad")}>
      {by > 0 ? "+" : "−"}
      {fmt(Math.abs(by))}
    </span>
  );
}
// ---------- What to do next ----------

/** How many actions the overview shows: the rest are on the Action plan. */
const FIRST = 3;

/** The first few actions, best first, with the way to the Action plan and the site's health in a line. */
function NextSteps({ open, site, onChange }: { open: Suggestion[]; site: OverviewData["site"]; onChange: () => Promise<void> }) {
  const href = useSeoHref();
  return (
    <>
      <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="next" className="text-[15px] font-medium">
            What to do next
          </h2>
          <p className="text-[12.5px] text-muted">
            {open.length} {open.length === 1 ? "action" : "actions"}, each with its reason
            {site && (
              <>
                {" · "}
                <Link to={href("/seo/site-audit")} className="text-fg underline-offset-2 hover:underline">
                  Site health {site.health}
                </Link>
                {site.errors > 0 && ` with ${site.errors} ${site.errors === 1 ? "error" : "errors"}`}
              </>
            )}
          </p>
        </div>
        {open.length > FIRST && (
          <Link to={href("/seo/plan")} className="inline-flex items-center gap-0.5 text-[13px] text-muted hover:text-fg">
            All {open.length} actions
            <ChevronRight size={14} aria-hidden />
          </Link>
        )}
      </div>
      <ActionList
        open={open.slice(0, FIRST)}
        onChange={onChange}
        empty={
          <>
            <p className="text-[14px] font-medium">Nothing left to do</p>
            <p className="mt-1 text-[13px] text-muted">More after the next check.</p>
          </>
        }
      />
    </>
  );
}
