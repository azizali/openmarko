// The SEO overview (/seo): where the Location stands this week as four figures, one per check (each opens its page),
// then what to do next beside what's behind the figures: keywords, assistants, who leads, and what the Google profile
// brings in. Each suggestion says which check it should move and what it was based on, and is applied with its button
// right on the card; an applied one stays in place saying so, with Undo, and is listed under Done from the next visit.
import { useState, type ReactNode } from "react";
import { Link, useSearchParams } from "react-router";
import { Check, ChevronRight, MapPin, Search, Settings, Sparkles, Users } from "lucide-react";
import { Badge, Button, Card, Segmented, Textarea, cn, fmt } from "../../components/ui";
import { Feedback, LoadError, useFeedback, useToast } from "../../components/Feedback";
import { fmtDate, messageOf } from "../../lib/api";
import { useLoad } from "../../lib/useLoad";
import { locationApi, seoApi, type Overview as OverviewData, type Suggestion } from "./api";
import { Change, EngineName, GridThumb } from "./parts";
import { kindsOf, useAfterCheck } from "./checks";
import { SeoHeader, useSeo, useSeoNavigate } from "./Seo";

type Helps = "maps" | "keywords" | "ai";
type Filter = "all" | Helps;
const filters = new Set<string>(["all", "maps", "keywords", "ai"]);

const checkNames = {
  maps: "Google Maps",
  keywords: "Keywords",
  ai: "AI answers",
  competitors: "Competitors",
} as const;
const checkIcons = {
  maps: MapPin,
  keywords: Search,
  ai: Sparkles,
  competitors: Users,
} as const;
/** Where a suggestion should move you, as its card says it: "Track a keyword · for Google search". */
const helpsNames = { maps: "Google Maps", keywords: "Google search", ai: "AI answers" } as const;
const channelNames: Record<string, string> = {
  maps: "Google Maps",
  google: "Google search",
  ai: "AI answers",
};

/** What each kind of suggestion is called, its button, and what it says once done. */
const kinds: Record<string, { label: string; action: string; done: string; needs: "track" | "publish" }> = {
  track_keyword: {
    label: "Track a keyword",
    action: "Track it",
    done: "Tracking. First result in a few minutes.",
    needs: "track",
  },
  track_question: {
    label: "Track an AI question",
    action: "Track it",
    done: "Tracking. First answers in a few minutes.",
    needs: "track",
  },
  profile_change: {
    label: "Change your Google profile",
    action: "Apply to Google",
    done: "Sent to Google. Changes can take a day to show.",
    needs: "publish",
  },
  post: {
    label: "Post on your Google profile",
    action: "Publish",
    done: "Published on your Google profile.",
    needs: "publish",
  },
  listing: {
    label: "Get listed",
    action: "Mark as done",
    done: "Marked as done.",
    needs: "track",
  },
};
const kindOf = (s: Suggestion) => kinds[s.kind] ?? kinds.listing!;

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
                  suggestions.data && <NextSteps open={suggestions.data.open} done={suggestions.data.done} onChange={reload} />
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
    },
    {
      id: "competitors",
      figure: competitors.count,
      tail: "businesses and sites compete with you",
      by: null,
      todo: 0,
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
  figure: ReactNode;
  tail: string;
  by: number | null;
  unit?: string;
  todo: number;
};

function StandingCell({ id, figure, tail, by, unit = "", todo }: Cell) {
  const { location } = useSeo();
  const Icon = checkIcons[id];
  return (
    <Link
      to={`/seo/${id}?location=${location.id}`}
      className="group flex min-w-0 flex-col bg-surface p-4 transition-colors hover:bg-hover sm:p-5"
    >
      <span className="flex min-h-5 items-center gap-1.5 text-[13px] text-muted group-hover:text-fg">
        <Icon size={14} aria-hidden className="shrink-0" />
        <span className="truncate">{checkNames[id]}</span>
        <ChevronRight size={14} aria-hidden className="-ml-0.5 shrink-0 opacity-0 transition-opacity group-hover:opacity-100" />
      </span>
      <span className="num mt-3 font-serif text-[30px] leading-none tracking-[-0.015em]">
        {figure ?? <span className="text-subtle">–</span>}
      </span>
      <span className="mt-1.5 text-[13px] leading-snug text-muted">{tail}</span>
      {(by !== null || todo > 0) && (
        <span className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-1 pt-3">
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
  const groups: { id: keyof typeof checkNames; title: string; rows: Row[]; more: string }[] = [
    {
      id: "maps",
      title: "On Google Maps",
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
      title: "On Google search",
      rows: keywords.rows.map((r) => ({
        key: r.id,
        label: r.term,
        value: r.position === null ? <span className="text-muted">Not found</span> : `Position ${r.position}`,
      })),
      more: `All ${keywords.total}`,
    },
    {
      id: "ai",
      title: "In AI answers",
      rows: ai.byEngine.map((e) => ({
        key: e.engine,
        label: <EngineName engine={e.engine} size={14} className="text-fg" />,
        value: `${e.named} of ${e.total}`,
      })),
      more: `All ${ai.questions} questions`,
    },
    {
      id: "competitors",
      title: "Who leads",
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
                <h3 id={`by-${g.id}`} className="text-[12.5px] font-medium text-muted">
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
              <ul className="mt-1.5 space-y-2">
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

function NextSteps({ open, done, onChange }: { open: Suggestion[]; done: Suggestion[]; onChange: () => Promise<void> }) {
  const [params] = useSearchParams();
  const asked = params.get("filter") as Filter | null;
  const [filter, setFilter] = useState<Filter>(asked && filters.has(asked) ? asked : "all");
  // Applied on this visit: they stay where they were, saying what happened with an Undo, instead of jumping to Done.
  const [settled, setSettled] = useState<Record<string, { s: Suggestion; at: number }>>({});
  const matches = (s: Suggestion) => filter === "all" || s.helps === filter;
  const shown: { s: Suggestion; applied: boolean }[] = open.filter((s) => matches(s) && !settled[s.id]).map((s) => ({ s, applied: false }));
  for (const { s, at } of Object.values(settled).toSorted((a, b) => a.at - b.at))
    if (matches(s)) shown.splice(Math.min(at, shown.length), 0, { s, applied: true });
  const waiting = open.filter((s) => !settled[s.id]).length;

  const applied = async (s: Suggestion) => {
    setSettled((m) => ({
      ...m,
      [s.id]: { s, at: shown.findIndex((x) => x.s.id === s.id) },
    }));
    await onChange();
  };
  const undone = async (s: Suggestion) => {
    setSettled((m) => Object.fromEntries(Object.entries(m).filter(([id]) => id !== s.id)));
    await onChange();
  };

  return (
    <>
      <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="next" className="text-[15px] font-medium">
            What to do next
          </h2>
          <p className="text-[12.5px] text-muted">
            {waiting} {waiting === 1 ? "fix" : "fixes"}, each with its reason
          </p>
        </div>
        <Segmented<Filter>
          label="Show suggestions for"
          value={filter}
          onChange={setFilter}
          options={[
            { id: "all", label: "All" },
            { id: "maps", label: "Maps" },
            { id: "keywords", label: "Keywords" },
            { id: "ai", label: "AI" },
          ]}
        />
      </div>
      <div className="space-y-3">
        {shown.map(({ s, applied: isApplied }) => (
          <SuggestionCard key={s.id} s={s} applied={isApplied} onApplied={applied} onUndone={undone} onChange={onChange} />
        ))}
        {shown.length === 0 && (
          <Card className="text-center">
            <p className="text-[14px] font-medium">Nothing left here</p>
            <p className="mt-1 text-[13px] text-muted">
              More after the next check.{" "}
              {filter !== "all" && (
                <button type="button" onClick={() => setFilter("all")} className="text-fg underline underline-offset-2">
                  Show all
                </button>
              )}
            </p>
          </Card>
        )}
      </div>
      {done.some((s) => !settled[s.id]) && <DoneList done={done.filter((s) => !settled[s.id])} onChange={onChange} />}
    </>
  );
}

/**
 * One fix, ready to apply: what kind it is, what to do, why, and its button. What it was based on (and a post's text,
 * to edit before it goes out) opens under Details. Once applied it says so in place, with Undo.
 */
function SuggestionCard({
  s,
  applied,
  onApplied,
  onUndone,
  onChange,
}: {
  s: Suggestion;
  applied: boolean;
  onApplied: (s: Suggestion) => Promise<void>;
  onUndone: (s: Suggestion) => Promise<void>;
  onChange: () => Promise<void>;
}) {
  const { orgId, location, can } = useSeo();
  const go = useSeoNavigate();
  const toast = useToast();
  const fb = useFeedback();
  const k = kindOf(s);
  const draft = s.kind === "post" ? String((s.payload as { text?: string }).text ?? "") : null;
  const [text, setText] = useState(draft ?? "");
  const [details, setDetails] = useState(false);
  const [busy, setBusy] = useState(false);
  const allowed = can(k.needs);
  const blocked = s.needsProfile && !location.profileLinked;
  const one = seoApi(orgId).suggestions({ suggestionId: s.id });

  const act = async (what: "apply" | "dismiss") => {
    setBusy(true);
    fb.clear();
    const r = what === "apply" ? await one.apply.post(draft !== null && text !== draft ? { text } : {}) : await one.dismiss.post();
    setBusy(false);
    if (r.error) {
      const needsProfile = (r.error.value as { details?: { needs?: string } } | undefined)?.details?.needs === "profile.manage";
      return fb.fail(
        needsProfile ? "Link this location's Google profile in SEO settings first." : messageOf(r.error),
        what === "apply" ? "Could not apply" : "Could not dismiss",
      );
    }
    setDetails(false);
    if (what === "apply") await onApplied(s);
    else await onChange();
  };
  const undo = async () => {
    setBusy(true);
    const r = await one.undo.post();
    setBusy(false);
    if (r.error) return toast.error(messageOf(r.error), "Could not undo");
    await onUndone(s);
  };

  // A post goes out under the business's name, so its text is read before Publish.
  const mustReview = draft !== null && !details;
  return (
    <Card pad={false} className="p-4 sm:p-5">
      <h3 className="text-[15px] leading-snug font-medium text-balance">{s.title}</h3>
      <p className="mt-1 max-w-[68ch] text-[13px] text-muted">{s.why}</p>
      <p className="mt-2 flex items-center gap-1.5 text-[12.5px] text-muted">
        <HelpsIcon helps={s.helps} />
        {k.label}
        <span aria-hidden>·</span>
        <span>for {helpsNames[s.helps as Helps] ?? s.helps}</span>
      </p>
      {details && !applied && (
        <div className="anim-fade mt-3 border-t border-line pt-3">
          <p className="text-[12.5px] font-medium">Based on</p>
          <ul className="mt-1.5 space-y-1 text-[13.5px] text-muted">
            {s.evidence.map((e) => (
              <li key={e} className="flex gap-2">
                <span className="mt-[9px] size-1 shrink-0 rounded-full bg-subtle" />
                {e}
              </li>
            ))}
          </ul>
          {s.kind === "profile_change" && <BeforeAfter payload={s.payload as ProfileChange} />}
          {draft !== null && (
            <label className="mt-4 block">
              <span className="text-[12.5px] font-medium">The post (edit it if you like)</span>
              <Textarea
                className="mt-1.5 w-full"
                rows={4}
                value={text}
                onChange={(e) => setText(e.target.value)}
                disabled={!allowed || blocked}
              />
            </label>
          )}
        </div>
      )}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {applied ? (
          <>
            <Badge tone="good" className="min-h-7 px-2.5 text-[13px]">
              <Check size={14} aria-hidden /> {k.done}
            </Badge>
            {can(k.needs) && (
              <Button variant="ghost" size="sm" onClick={() => void undo()} disabled={busy}>
                Undo
              </Button>
            )}
          </>
        ) : (
          <>
            {allowed && blocked && (
              <>
                <span className="text-[13px] text-muted">Needs your Google profile linked.</span>
                {can("manage") && (
                  <Button size="sm" onClick={() => go("/seo/settings")}>
                    Link it
                  </Button>
                )}
              </>
            )}
            {allowed && !blocked && (
              <Button
                variant="primary"
                onClick={() => (mustReview ? setDetails(true) : void act("apply"))}
                disabled={busy || (draft !== null && details && text.trim().length < 20)}
              >
                {mustReview ? "Review the post" : k.action}
              </Button>
            )}
            {can("track") && (
              <Button variant="ghost" onClick={() => void act("dismiss")} disabled={busy}>
                Not now
              </Button>
            )}
            <button
              type="button"
              onClick={() => setDetails(!details)}
              aria-expanded={details}
              className="ml-auto inline-flex min-h-9 items-center gap-1 text-[13px] text-muted hover:text-fg"
            >
              {details ? "Hide details" : "Details"}
              <ChevronRight size={14} aria-hidden className={cn("transition-transform", details && "rotate-90")} />
            </button>
            <Feedback {...fb.props} />
          </>
        )}
      </div>
    </Card>
  );
}

function HelpsIcon({ helps }: { helps: string }) {
  const Icon = checkIcons[helps in checkIcons ? (helps as Helps) : "maps"];
  return <Icon size={13} aria-hidden />;
}

type ProfileChange = { field: "categories"; before: string[]; after: string[] } | { field: "description"; before: string; after: string };

const shown = (v: string | string[]) => (Array.isArray(v) ? v.join(", ") : v) || "Nothing yet";

function BeforeAfter({ payload }: { payload: ProfileChange }) {
  const label = payload.field === "categories" ? "Categories" : "Description";
  return (
    <div className="mt-4 grid gap-3 border-t border-line pt-3 sm:grid-cols-2">
      <div>
        <p className="text-[12.5px] text-muted">{label} now</p>
        <p className="mt-1 text-[13.5px]">{shown(payload.before)}</p>
      </div>
      <div>
        <p className="text-[12.5px] text-good">{label} after</p>
        <p className="mt-1 text-[13.5px]">{shown(payload.after)}</p>
      </div>
    </div>
  );
}

function DoneList({ done, onChange }: { done: Suggestion[]; onChange: () => Promise<void> }) {
  const { orgId, can } = useSeo();
  const toast = useToast();
  const [busy, setBusy] = useState<string | null>(null);
  const undo = async (s: Suggestion) => {
    setBusy(s.id);
    const r = await seoApi(orgId).suggestions({ suggestionId: s.id }).undo.post();
    setBusy(null);
    if (r.error) return toast.error(messageOf(r.error), "Could not undo");
    toast.success("Undone", s.title);
    await onChange();
  };
  return (
    <div className="mt-6">
      <h3 className="mb-2 text-[13px] font-medium text-muted">Done ({done.length})</h3>
      <ul className="divide-y divide-line rounded-xl border border-line bg-surface">
        {done.map((s) => (
          <li key={s.id} className="flex items-start gap-3 px-4 py-3">
            <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full border border-good/40 text-good">
              <Check size={13} aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[13.5px]">{s.title}</p>
              <p className="text-[12.5px] text-muted">
                {kindOf(s).done} {s.decidedAt && `· ${fmtDate(s.decidedAt)}`}
              </p>
            </div>
            {can(kindOf(s).needs) && (
              <Button variant="ghost" size="sm" onClick={() => void undo(s)} disabled={busy === s.id}>
                Undo
              </Button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
