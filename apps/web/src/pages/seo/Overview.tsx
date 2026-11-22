// The SEO overview (/seo): where the Location stands this week, one card per check (each opens its page), the results
// its Google profile brings in, and what to do next. Each suggestion says which check it should move and what it was
// based on, and is applied with one button; applied ones move to Done, where they can be undone.
import { useEffect, useState, type ReactNode } from "react";
import { Link, useSearchParams } from "react-router";
import { Check, ChevronRight, MapPin, RefreshCw, Search, Settings, Sparkles, Users } from "lucide-react";
import { Badge, Button, Card, Segmented, Textarea, cn, fmt } from "../../components/ui";
import { Feedback, LoadError, useFeedback, useToast } from "../../components/Feedback";
import { fmtDate, messageOf } from "../../lib/api";
import { useLoad } from "../../lib/useLoad";
import { engineNames, locationApi, seoApi, type Overview as OverviewData, type Suggestion } from "./api";
import { Change, GridThumb } from "./parts";
import { SeoHeader, useSeo, useSeoNavigate } from "./Seo";

type Helps = "maps" | "keywords" | "ai";
type Filter = "all" | Helps;
const filters = new Set<string>(["all", "maps", "keywords", "ai"]);

const checkNames = { maps: "Google Maps ranking", keywords: "Keywords", ai: "AI answers", competitors: "Competitors" } as const;
const checkIcons = { maps: MapPin, keywords: Search, ai: Sparkles, competitors: Users } as const;
const channelNames: Record<string, string> = { maps: "Google Maps", google: "Google search", ai: "AI answers" };

/** What each kind of suggestion is called, its button, and what it says once done. */
const kinds: Record<string, { label: string; action: string; done: string; needs: "track" | "publish" }> = {
  track_keyword: { label: "Track a keyword", action: "Track it", done: "Tracking. First result in a few minutes.", needs: "track" },
  track_question: { label: "Track an AI question", action: "Track it", done: "Tracking. First answers in a few minutes.", needs: "track" },
  profile_change: {
    label: "Change your Google profile",
    action: "Apply to Google",
    done: "Sent to Google. Changes can take a day to show.",
    needs: "publish",
  },
  post: { label: "Post on your Google profile", action: "Publish", done: "Published on your Google profile.", needs: "publish" },
  listing: { label: "Get listed", action: "Mark as done", done: "Marked as done.", needs: "track" },
};
const kindOf = (s: Suggestion) => kinds[s.kind] ?? kinds.listing!;

const diff = (now: number, before: number | null) => (before === null ? null : now - before);

export default function Overview() {
  const { orgId, location, can } = useSeo();
  const toast = useToast();
  const overview = useLoad(() => locationApi(orgId, location.id).overview.get(), [orgId, location.id]);
  const suggestions = useLoad(() => locationApi(orgId, location.id).suggestions.get(), [orgId, location.id]);
  const checking = !!overview.data?.checking;
  const [starting, setStarting] = useState(false);

  // While a check runs, look again every 10 seconds; the suggestions arrive when it finishes.
  useEffect(() => {
    if (!checking) return;
    const t = setInterval(() => void overview.reload(), 10_000);
    return () => {
      clearInterval(t);
      void suggestions.reload();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [checking]);

  const checkNow = async () => {
    setStarting(true);
    const r = await locationApi(orgId, location.id).check.post();
    setStarting(false);
    if (r.error) return toast.error(messageOf(r.error), "Could not start the check");
    toast.success("Checking now", "Results come in over the next few minutes.");
    await overview.reload();
  };
  const reload = async () => {
    await Promise.all([overview.reload(), suggestions.reload()]);
  };

  return (
    <>
      <SeoHeader
        tab="overview"
        sub="Where you show up this week, and what to do next."
        actions={
          can("manage") && (
            <>
              <SettingsLink />
              <Button icon={<RefreshCw size={14} />} onClick={() => void checkNow()} disabled={checking || starting}>
                {checking ? "Checking…" : "Check now"}
              </Button>
            </>
          )
        }
      />
      {overview.error ? (
        <LoadError what="where you stand">{overview.error}</LoadError>
      ) : (
        overview.data && (
          <div className="grid gap-8 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
            <Standing data={overview.data} />
            <section aria-labelledby="next">
              {suggestions.error ? (
                <LoadError what="suggestions">{suggestions.error}</LoadError>
              ) : (
                suggestions.data && <NextSteps open={suggestions.data.open} done={suggestions.data.done} onChange={reload} />
              )}
            </section>
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

type Row = { key: string; label: ReactNode; value: ReactNode };

function Standing({ data }: { data: OverviewData }) {
  const { location, can } = useSeo();
  const { maps, keywords, ai, competitors, openSuggestions: open } = data;
  const cards: { id: keyof typeof checkNames; value: ReactNode; change?: ReactNode; rows: Row[]; more: string; todo: number }[] = [
    {
      id: "maps",
      value: (
        <>
          Top 3 in {maps.top3} <span className="text-muted">of {maps.spots} spots</span>
        </>
      ),
      change: <Change by={diff(maps.top3, maps.top3Before)} unit="more" />,
      rows: maps.rows.map((r) => ({
        key: r.id,
        label: r.term,
        value: (
          <span className="flex items-center gap-2">
            {r.top3} of {r.spots}
            <GridThumb size={r.size} ranks={r.grid} gap={4} />
          </span>
        ),
      })),
      more: `All ${maps.keywords} keywords`,
      todo: open.maps,
    },
    {
      id: "keywords",
      value: (
        <>
          {keywords.firstPage} <span className="text-muted">of {keywords.total} on Google's first page</span>
        </>
      ),
      change: <Change by={diff(keywords.firstPage, keywords.firstPageBefore)} unit="more" />,
      rows: keywords.rows.map((r) => ({ key: r.id, label: r.term, value: r.position === null ? "Not found" : `Position ${r.position}` })),
      more: `All ${keywords.total} keywords`,
      todo: open.keywords,
    },
    {
      id: "ai",
      value: (
        <>
          Named in {ai.named} <span className="text-muted">of {ai.total} answers</span>
        </>
      ),
      change: <Change by={diff(ai.named, ai.namedBefore)} unit="more" />,
      rows: ai.byEngine.map((e) => ({ key: e.engine, label: engineNames[e.engine] ?? e.engine, value: `${e.named} of ${e.total}` })),
      more: `All ${ai.questions} questions`,
      todo: open.ai,
    },
    {
      id: "competitors",
      value: (
        <>
          {competitors.count} <span className="text-muted">businesses and sites compete with you</span>
        </>
      ),
      rows: competitors.channels.map((c) => ({
        key: c.channel,
        label: `${channelNames[c.channel] ?? c.channel}: ${c.count}`,
        value: c.leader ? `${c.leader} leads` : "No one ahead",
      })),
      more: "Everyone",
      todo: 0,
    },
  ];
  const usage = [usageText(data.usage.keywords, "keyword", "keywords"), usageText(data.usage.questions, "question", "questions")].join(
    " · ",
  );

  return (
    <section aria-labelledby="stand">
      <h2 id="stand" className="text-[15px] font-medium">
        Where you stand
      </h2>
      <p className="mb-3 text-[12.5px] text-muted">
        {data.checking ? "Checking now…" : data.lastCheckedAt ? `Checked ${fmtDate(data.lastCheckedAt)}` : "Not checked yet"}
      </p>
      <div className="space-y-3">
        {cards.map((c) => (
          <CheckCard key={c.id} {...c} />
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
      <p className="mt-4 text-[12.5px] text-muted">{usage}</p>
    </section>
  );
}

function usageText(u: { used: number; limit: number | null }, one: string, many: string) {
  return u.limit === null ? `${u.used} ${u.used === 1 ? one : many}` : `${u.used} of ${u.limit} ${many}`;
}

function CheckCard({
  id,
  value,
  change,
  rows,
  more,
  todo,
}: {
  id: keyof typeof checkNames;
  value: ReactNode;
  change?: ReactNode;
  rows: Row[];
  more: string;
  todo: number;
}) {
  const { location } = useSeo();
  const Icon = checkIcons[id];
  return (
    <Link
      to={`/seo/${id}?location=${location.id}`}
      className="group block rounded-xl border border-line bg-surface p-4 shadow-card transition-colors hover:border-line-strong"
    >
      <p className="flex items-center gap-1.5 text-[13px] text-muted">
        <Icon size={14} aria-hidden />
        {checkNames[id]}
        {todo > 0 && (
          <Badge tone="accent" className="ml-1">
            {todo} to do
          </Badge>
        )}
      </p>
      <p className="num mt-1.5 text-[20px] leading-tight font-medium">{value}</p>
      {change && <p className="mt-1">{change}</p>}
      {rows.length > 0 && (
        <ul className="mt-3 space-y-1.5 border-t border-line pt-3">
          {rows.map((r) => (
            <li key={r.key} className="flex items-center justify-between gap-3 text-[13px]">
              <span className="min-w-0 truncate text-muted">{r.label}</span>
              <span className="num shrink-0">{r.value}</span>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-3 flex items-center gap-1 text-[13px] text-muted group-hover:text-fg">
        {more}
        <ChevronRight size={14} aria-hidden />
      </p>
    </Link>
  );
}

function ResultsCard({ profile }: { profile: NonNullable<OverviewData["profile"]> }) {
  const stats: { label: string; now: number; before: number | null }[] = [
    { label: "Calls", now: profile.calls, before: profile.before?.calls ?? null },
    { label: "Website clicks", now: profile.websiteClicks, before: profile.before?.websiteClicks ?? null },
    { label: "Directions", now: profile.directionRequests, before: profile.before?.directionRequests ?? null },
    { label: "Views", now: profile.views, before: profile.before?.views ?? null },
  ];
  return (
    <Card className="mt-3">
      <h3 className="text-[14px] font-medium">From your Google profile</h3>
      <p className="mt-0.5 text-[12.5px] text-muted">The last 28 days{profile.before ? ", against the 28 before" : ""}.</p>
      <dl className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label}>
            <dt className="text-[12.5px] text-muted">{s.label}</dt>
            <dd className="num mt-0.5 text-[18px] font-medium">{fmt(s.now)}</dd>
            {s.before !== null && (
              <dd className="mt-0.5">
                <Delta now={s.now} before={s.before} />
              </dd>
            )}
          </div>
        ))}
      </dl>
      {profile.topSearches.length > 0 && (
        <div className="mt-4 border-t border-line pt-3">
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
  const [expanded, setExpanded] = useState<string | null>(open[0]?.id ?? null);
  const shown = open.filter((s) => filter === "all" || s.helps === filter);

  return (
    <>
      <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="next" className="text-[15px] font-medium">
            What to do next
          </h2>
          <p className="text-[12.5px] text-muted">
            {open.length} {open.length === 1 ? "suggestion" : "suggestions"}
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
        {shown.map((s) => (
          <SuggestionCard
            key={s.id}
            s={s}
            open={expanded === s.id}
            onToggle={() => setExpanded(expanded === s.id ? null : s.id)}
            onChange={onChange}
          />
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
      {done.length > 0 && <DoneList done={done} onChange={onChange} />}
    </>
  );
}

function HelpsIcon({ helps }: { helps: string }) {
  const Icon = checkIcons[helps in checkIcons ? (helps as Helps) : "maps"];
  return <Icon size={11} aria-hidden />;
}

function SuggestionCard({
  s,
  open,
  onToggle,
  onChange,
}: {
  s: Suggestion;
  open: boolean;
  onToggle: () => void;
  onChange: () => Promise<void>;
}) {
  const { orgId, location, can } = useSeo();
  const go = useSeoNavigate();
  const toast = useToast();
  const fb = useFeedback();
  const k = kindOf(s);
  const draft = s.kind === "post" ? String((s.payload as { text?: string }).text ?? "") : null;
  const [text, setText] = useState(draft ?? "");
  const [busy, setBusy] = useState(false);
  const allowed = can(k.needs);
  const blocked = s.needsProfile && !location.profileLinked;

  const act = async (what: "apply" | "dismiss") => {
    setBusy(true);
    fb.clear();
    const one = seoApi(orgId).suggestions({ suggestionId: s.id });
    const r = what === "apply" ? await one.apply.post(draft !== null && text !== draft ? { text } : {}) : await one.dismiss.post();
    setBusy(false);
    if (r.error) {
      const needsProfile = (r.error.value as { details?: { needs?: string } } | undefined)?.details?.needs === "profile.manage";
      return fb.fail(
        needsProfile ? "Link this location's Google profile in SEO settings first." : messageOf(r.error),
        what === "apply" ? "Could not apply" : "Could not dismiss",
      );
    }
    if (what === "apply") toast.success(s.title, k.done);
    await onChange();
  };

  return (
    <Card pad={false}>
      <button type="button" onClick={onToggle} aria-expanded={open} className="flex w-full items-start gap-3 p-4 text-left">
        <div className="min-w-0 flex-1">
          <p className="text-[15px] font-medium">{s.title}</p>
          <p className="mt-1.5 flex flex-wrap items-center gap-1.5">
            <Badge>{k.label}</Badge>
            <Badge tone="accent">
              <HelpsIcon helps={s.helps} /> {checkNames[s.helps as Helps] ?? s.helps}
            </Badge>
          </p>
        </div>
        <ChevronRight size={16} aria-hidden className={cn("mt-1 shrink-0 text-subtle transition-transform", open && "rotate-90")} />
      </button>
      {open && (
        <div className="anim-fade border-t border-line p-4">
          <p className="text-[13.5px]">{s.why}</p>
          <p className="mt-3 text-[12.5px] font-medium">Based on</p>
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
          {allowed && (
            <div className="mt-4 flex flex-wrap items-center gap-2">
              {blocked ? (
                <>
                  <span className="text-[13px] text-muted">Needs your Google profile linked.</span>
                  {can("manage") && (
                    <Button size="sm" onClick={() => go("/seo/settings")}>
                      Link it
                    </Button>
                  )}
                </>
              ) : (
                <Button variant="primary" onClick={() => void act("apply")} disabled={busy || (draft !== null && text.trim().length < 20)}>
                  {k.action}
                </Button>
              )}
              <Button variant="ghost" onClick={() => void act("dismiss")} disabled={busy}>
                Not now
              </Button>
              <Feedback {...fb.props} />
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

type ProfileChange = { field: "categories"; before: string[]; after: string[] } | { field: "description"; before: string; after: string };

const shown = (v: string | string[]) => (Array.isArray(v) ? v.join(", ") : v) || "Nothing yet";

function BeforeAfter({ payload }: { payload: ProfileChange }) {
  const label = payload.field === "categories" ? "Categories" : "Description";
  return (
    <div className="mt-4 grid gap-2 sm:grid-cols-2">
      <div className="rounded-lg border border-line p-3">
        <p className="text-[12.5px] text-muted">{label} now</p>
        <p className="mt-1 text-[13.5px]">{shown(payload.before)}</p>
      </div>
      <div className="rounded-lg border border-good/40 p-3">
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
