// Setting up SEO for a business (/seo/setup): find it on Google, confirm what we found, optionally connect its Google
// profile, pick what to track, and launch the first check. The draft Location and the step are in the address
// (?location=…&step=…), so a reload or the round trip through Google's sign-in carries on where it was.
import { useCallback, useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { Link, Navigate, useNavigate, useSearchParams } from "react-router";
import { ArrowLeft, ArrowRight, Bot, Check, CircleAlert, Loader2, MapPin, Plus, Search, Store } from "lucide-react";
import { Badge, Button, Card, Checkbox, Field, Input, Progress, cn, fmt } from "../../components/ui";
import { Feedback, LoadError, useFeedback, useToast } from "../../components/Feedback";
import { messageOf } from "../../lib/api";
import { useLoad } from "../../lib/useLoad";
import { useOrg, useSession } from "../../lib/session";
import { Logo } from "../../components/Logo";
import { locationApi, seoApi, type Details, type Ideas, type Place } from "./api";
import {
  ChecksFields,
  GRID_SIZE,
  GRID_SPOTS,
  ServicesField,
  checkSummary,
  connectGoogle,
  engines,
  gridCoverage,
  nearestReach,
  useOAuthError,
  type Checks,
  type Every,
} from "./fields";

type Step = "start" | "found" | "connect" | "track" | "launch";
const steps: { id: Step; name: string }[] = [
  { id: "start", name: "Start" },
  { id: "found", name: "What we found" },
  { id: "connect", name: "Connect" },
  { id: "track", name: "What to track" },
  { id: "launch", name: "Launch" },
];

/**
 * The business's full profile costs a request, and ideas cost a request or two: each is asked once per draft while this
 * page is open, shared by the steps that use them. A failed request isn't kept. Ideas are asked for the categories and
 * cities the person picked, so picking different ones asks again (as does changing the services: questions are built
 * from them).
 */
type Asked<T> = Promise<{ data: T | null; error: unknown }>;
const detailsCache = new Map<string, Asked<Details>>();
const detailsFor = (orgId: string, locationId: string) => {
  if (!detailsCache.has(locationId))
    detailsCache.set(
      locationId,
      locationApi(orgId, locationId)
        .details.get()
        .then((r) => {
          if (r.error) detailsCache.delete(locationId);
          return r;
        }),
    );
  return detailsCache.get(locationId)!;
};

/** The categories and cities to track, per draft: the business's own first three categories and its city, until the person changes them. */
type Focus = { categories: string[]; cities: string[] };
const focusOf = new Map<string, Focus>();

const ideasCache = new Map<string, Asked<Ideas>>();
const ideasFor = (orgId: string, locationId: string) => {
  if (!ideasCache.has(locationId))
    ideasCache.set(
      locationId,
      detailsFor(orgId, locationId).then(async (d) => {
        if (!focusOf.has(locationId) && d.data)
          focusOf.set(locationId, { categories: d.data.categories.slice(0, 3), cities: d.data.cities.slice(0, 1) });
        const focus = focusOf.get(locationId);
        const r = await locationApi(orgId, locationId).ideas.get({
          query: { categories: (focus?.categories ?? []).join("|"), cities: (focus?.cities ?? []).join("|") },
        });
        if (r.error) ideasCache.delete(locationId);
        return r;
      }),
    );
  return ideasCache.get(locationId)!;
};

export default function Setup() {
  const { can, caller, features, loading, me, org } = useSession();
  const [params, setParams] = useSearchParams();
  const locationId = params.get("location");
  const asked = params.get("step");
  const step: Step = steps.some((s) => s.id === asked) ? (asked as Step) : locationId ? "found" : "start";
  const at = steps.findIndex((s) => s.id === step);
  const go = (next: Step, extra: Record<string, string> = {}) =>
    setParams(Object.fromEntries(Object.entries({ location: locationId ?? "", ...extra, step: next }).filter(([, v]) => v)));

  // This page sits outside the app layout (no menu), so it does the layout's sign-in checks itself.
  if (loading) return null;
  if (!me) return <Navigate replace to="/sign-in" state={{ from: "/seo/setup" }} />;
  if (!org) return <Navigate replace to="/onboarding" />;
  // Permissions load after the Organization is chosen: wait for them rather than refuse on a stale answer.
  if (!caller) return null;
  if (features.seo && !features.seo.on) return <Navigate replace to="/" />;
  if (!can("seo", "manage"))
    return (
      <SetupFrame>
        <Card className="mx-auto max-w-xl">
          <p className="text-[14px] font-medium">Only people who manage SEO can set it up</p>
          <p className="mt-1 text-[13.5px] text-muted">
            Ask an admin of this organization. <Link to="/">Back home</Link>
          </p>
        </Card>
      </SetupFrame>
    );

  return (
    <SetupFrame action={step !== "launch" ? <CancelSetup locationId={locationId} /> : <LeaveSetup locationId={locationId} />}>
      <div className="grid gap-8 md:grid-cols-[180px_minmax(0,1fr)]">
        <nav aria-label="Setup steps" className="hidden md:block">
          <ol className="sticky top-6 space-y-1">
            {steps.map((s, i) => (
              <li
                key={s.id}
                aria-current={i === at ? "step" : undefined}
                className={cn("flex items-center gap-2.5 px-1 py-1.5 text-[13px]", i === at ? "font-medium" : "text-muted")}
              >
                <span
                  className={cn(
                    "grid size-5 shrink-0 place-items-center rounded-full border text-[11px]",
                    i < at ? "border-ink bg-ink text-on-ink" : i === at ? "border-ink" : "border-line-strong",
                  )}
                >
                  {i < at ? <Check size={11} strokeWidth={3} aria-hidden /> : i + 1}
                </span>
                {s.name}
              </li>
            ))}
          </ol>
        </nav>
        <div className="mx-auto w-full max-w-2xl">
          <p className="mb-2 text-[12.5px] text-muted">
            Step {at + 1} of {steps.length}
          </p>
          {step === "start" || !locationId ? (
            <StartStep onMade={(id) => go("found", { location: id })} />
          ) : step === "found" ? (
            <FoundStep locationId={locationId} onNext={() => go("connect")} onRestart={() => setParams({})} />
          ) : step === "connect" ? (
            <ConnectStep locationId={locationId} onBack={() => go("found")} onNext={() => go("track")} />
          ) : step === "track" ? (
            <TrackStep locationId={locationId} onBack={() => go("connect")} onLaunched={(run) => go("launch", { run })} />
          ) : (
            <LaunchStep locationId={locationId} runId={params.get("run")} />
          )}
        </div>
      </div>
    </SetupFrame>
  );
}

/** Setup's own full screen: just the brand and a way out, no app menu, so the person stays on the steps. */
function SetupFrame({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="min-h-full">
      <header className="flex items-center justify-between gap-3 px-4 py-4 sm:px-8">
        <Link to="/" aria-label="Home">
          <Logo size={22} />
        </Link>
        {/* Once launched, the Location is real: it's paused or removed from Settings, not cancelled. */}
        {action}
      </header>
      <main className="mx-auto w-full max-w-[1000px] px-4 pb-16 pt-6 sm:px-8">{children}</main>
    </div>
  );
}

/** Once launched the checks run on our side: the person can go to SEO (or anywhere) and come back to results. */
function LeaveSetup({ locationId }: { locationId: string | null }) {
  const navigate = useNavigate();
  return (
    <Button variant="ghost" size="sm" onClick={() => navigate(locationId ? `/seo?location=${locationId}` : "/seo")}>
      Leave, we'll keep going
    </Button>
  );
}

/** Leaves setup for good: a draft is removed (nothing was launched or charged), and the person goes home. */
function CancelSetup({ locationId }: { locationId: string | null }) {
  const org = useOrg();
  const navigate = useNavigate();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const cancel = async () => {
    setBusy(true);
    if (locationId) {
      const r = await locationApi(org.id, locationId).status.post({ status: "archived" });
      if (r.error) {
        setBusy(false);
        return toast.error(messageOf(r.error), "Could not cancel setup");
      }
    }
    ideasCache.delete(locationId ?? "");
    detailsCache.delete(locationId ?? "");
    focusOf.delete(locationId ?? "");
    navigate("/", { replace: true });
  };
  return (
    <Button variant="ghost" size="sm" disabled={busy} onClick={() => void cancel()}>
      {busy ? "Cancelling…" : "Cancel setup"}
    </Button>
  );
}

function Title({ children, sub }: { children: ReactNode; sub?: ReactNode }) {
  return (
    <div className="mb-8">
      <h1 className="font-serif text-[34px] leading-[1.1] tracking-[-0.02em]">{children}</h1>
      {sub && <p className="mt-2 text-[14px] text-muted">{sub}</p>}
    </div>
  );
}

/** The row of controls at the foot of a step, with its message beside them. */
function Actions({ fb, children }: { fb: ReturnType<typeof useFeedback>; children: ReactNode }) {
  return (
    <div className="mt-10 flex flex-wrap items-center gap-3 border-t border-line pt-5">
      <Feedback {...fb.props} />
      <div className="ml-auto flex flex-wrap gap-2">{children}</div>
    </div>
  );
}

// ---------- Start ----------

function StartStep({ onMade }: { onMade: (id: string) => void }) {
  const org = useOrg();
  const navigate = useNavigate();
  const toast = useToast();
  const [query, setQuery] = useState("");
  const [found, setFound] = useState<Place[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const fb = useFeedback();

  const search = async (e: FormEvent) => {
    e.preventDefault();
    setBusy("search");
    fb.clear();
    const r = await seoApi(org.id).find.post({ query });
    setBusy(null);
    if (r.error) return fb.fail(messageOf(r.error), "Could not search");
    setFound(r.data);
  };
  const pick = async (p: Place) => {
    setBusy(p.placeId);
    const r = await seoApi(org.id).locations.post({ place: p, name: p.name, lat: p.lat, lng: p.lng });
    setBusy(null);
    if (r.error) {
      // Already set up: carry on with its draft, or open it.
      const existing = (r.error.value as { details?: { locationId?: string; status?: string } } | undefined)?.details;
      if ((r.error as { status: number }).status === 409 && existing?.locationId) {
        if (existing.status === "draft") return onMade(existing.locationId);
        toast.success(`${p.name} is already set up`, "Here's where it stands.");
        return navigate(`/seo/overview?location=${existing.locationId}`);
      }
      return fb.fail(messageOf(r.error), "Could not add it");
    }
    onMade(r.data.id);
  };

  return (
    <>
      <Title sub="We look it up on Google, then suggest what to track. About two minutes.">Set up SEO</Title>
      <form onSubmit={search} className="flex gap-2">
        <Input
          size="lg"
          icon={<Search size={16} />}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="mapleandmaindental.com or Maple & Main Dental"
          aria-label="Website or business name"
          autoFocus
        />
        <Button type="submit" variant="primary" disabled={busy === "search" || query.trim().length < 2}>
          {busy === "search" ? "Looking…" : "Find it"}
        </Button>
      </form>
      {found && (
        <div className="mt-6">
          <p className="mb-2 text-[13px] font-medium">{found.length ? "Which one is it?" : "Nothing found. Try its address or website."}</p>
          <ul className="divide-y divide-line rounded-xl border border-line bg-surface">
            {found.map((p) => (
              <li key={p.placeId}>
                <button
                  type="button"
                  disabled={!!busy}
                  onClick={() => void pick(p)}
                  className="flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-hover disabled:opacity-60"
                >
                  <Store size={16} className="mt-0.5 shrink-0 text-muted" aria-hidden />
                  <span className="min-w-0 flex-1">
                    <span className="block text-[14px] font-medium">{p.name}</span>
                    <span className="block truncate text-[12.5px] text-muted">{[p.category, p.address].filter(Boolean).join(" · ")}</span>
                  </span>
                  {p.rating !== null && (
                    <span className="num shrink-0 text-[12.5px] text-muted">
                      {p.rating.toFixed(1)}★ ({fmt(p.reviewCount ?? 0)})
                    </span>
                  )}
                  {busy === p.placeId && <Loader2 size={15} className="shrink-0 animate-spin text-muted" aria-hidden />}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
      <Actions fb={fb}>
        <Button variant="ghost" icon={<ArrowLeft size={14} />} onClick={() => navigate("/")}>
          Cancel
        </Button>
      </Actions>
    </>
  );
}

// ---------- What we found ----------

function FoundStep({ locationId, onNext, onRestart }: { locationId: string; onNext: () => void; onRestart: () => void }) {
  const org = useOrg();
  const navigate = useNavigate();
  const loc = useLoad(() => locationApi(org.id, locationId).get(), [org.id, locationId]);
  const ideas = useLoad(() => ideasFor(org.id, locationId), [org.id, locationId]);
  const details = useLoad(() => detailsFor(org.id, locationId), [org.id, locationId]);
  const lookupCategories = useCallback(
    async (q: string) => {
      const r = await seoApi(org.id).categories.get({ query: { q } });
      return r.data?.ready ? r.data.categories : null;
    },
    [org.id],
  );
  const lookupCities = useCallback(
    async (q: string) => {
      const r = await locationApi(org.id, locationId).cities.get({ query: { q } });
      return r.data?.ready ? r.data.cities : null;
    },
    [org.id, locationId],
  );
  const [form, setForm] = useState<{ name: string; website: string; services: string[]; categories: string[]; cities: string[] } | null>(
    null,
  );
  const [busy, setBusy] = useState(false);
  const fb = useFeedback();
  // Said once beside the form: why the business's categories or Google's list weren't read (a missing or failing connection).
  useEffect(() => {
    if (details.data?.problem) fb.fail(details.data.problem, "Categories are limited");
    // `fb` changes with every message it holds: depending on it would say the message again and again.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [details.data?.problem]);

  useEffect(() => {
    if (loc.data && loc.data.status !== "draft") navigate(`/seo/overview?location=${loc.data.id}`, { replace: true });
  }, [loc.data, navigate]);
  useEffect(() => {
    if (form || !loc.data || ideas.loading) return;
    const services = loc.data.services.length ? loc.data.services : (ideas.data?.services ?? []);
    const focus = focusOf.get(locationId);
    setForm({
      name: loc.data.name,
      website: loc.data.website ?? "",
      services,
      categories: focus?.categories ?? [],
      cities: focus?.cities ?? [],
    });
  }, [form, loc.data, ideas.loading, ideas.data, locationId]);

  if (loc.error) return <LoadError what="the business">{loc.error}</LoadError>;
  if (!loc.data || !form) return <Loader2 size={18} className="animate-spin text-muted" aria-label="Loading" />;

  const save = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const r = await locationApi(org.id, locationId).patch({
      name: form.name,
      website: form.website.trim() || null,
      services: form.services,
    });
    setBusy(false);
    if (r.error) return fb.fail(messageOf(r.error));
    const before = focusOf.get(locationId);
    const changed =
      form.categories.join("|") !== (before?.categories ?? []).join("|") || form.cities.join("|") !== (before?.cities ?? []).join("|");
    focusOf.set(locationId, { categories: form.categories, cities: form.cities });
    if (changed || form.services.join("|") !== (ideas.data?.services ?? loc.data?.services ?? []).join("|")) ideasCache.delete(locationId);
    onNext();
  };
  // Not this business: the draft goes, and setup starts again.
  const restart = async () => {
    await locationApi(org.id, locationId).status.post({ status: "archived" });
    onRestart();
  };

  return (
    <form onSubmit={save}>
      <Title sub="Change anything that isn't right. Your checks start from these.">Here's what we found</Title>
      <div className="space-y-5">
        <Field label="Business name">
          <Input required maxLength={200} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </Field>
        <Field label="Address">
          <p className="text-[14px]">
            {loc.data.address ?? "—"}{" "}
            <button
              type="button"
              onClick={() => void restart()}
              className="ml-1 text-[13px] text-muted underline underline-offset-2 hover:text-fg"
            >
              Not this business?
            </button>
          </p>
        </Field>
        <Field label="Website" hint="Google search positions are read for this site.">
          <Input value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} placeholder="example.com" />
        </Field>
        <Field
          label="Categories to track"
          hint="Google lists a business under a fixed set of categories; type to find one. Keywords are searched for each one you keep here."
        >
          <ServicesField
            noun="category"
            nouns="categories"
            value={form.categories}
            onChange={(categories) => setForm({ ...form, categories })}
            suggestions={[...(details.data?.categories ?? []), ...(details.data?.related ?? [])]}
            lookup={lookupCategories}
          />
        </Field>
        <Field
          label="Cities to track"
          hint="Pick from Google's places, such as Springfield, IL: a name used in several states is told apart by its state. Each category is searched in each place."
        >
          <ServicesField
            noun="city"
            nouns="cities and towns"
            value={form.cities}
            onChange={(cities) => setForm({ ...form, cities })}
            suggestions={details.data?.cities}
            lookup={lookupCities}
          />
        </Field>
        <Field label="Services" hint="Keyword and question ideas, and suggestions, come from these.">
          <ServicesField value={form.services} onChange={(services) => setForm({ ...form, services })} suggestions={details.data?.topics} />
        </Field>
      </div>
      <Actions fb={fb}>
        <Button type="submit" variant="primary" disabled={busy}>
          Continue <ArrowRight size={14} aria-hidden />
        </Button>
      </Actions>
    </form>
  );
}

// ---------- Connect ----------

function ConnectStep({ locationId, onBack, onNext }: { locationId: string; onBack: () => void; onNext: () => void }) {
  const org = useOrg();
  const profile = useLoad(() => seoApi(org.id).profile.locations.get(), [org.id]);
  const [busy, setBusy] = useState(false);
  const fb = useFeedback();
  const connected = !!profile.data?.connected;
  useOAuthError((text) => fb.fail(text, "Could not connect"));

  const connect = async () => {
    setBusy(true);
    const error = await connectGoogle(org.id, `/seo/setup?location=${locationId}&step=connect`);
    setBusy(false);
    if (error) fb.fail(error, "Could not connect");
  };

  return (
    <>
      <Title sub="Optional. Nothing is changed on your profile until you apply a suggestion.">Connect your Google profile</Title>
      <Card className="mb-4 bg-hover text-[13px] text-muted shadow-none">
        SEO reads public results, so every check works without connecting anything. Connect your Google Business Profile to apply
        suggestions (categories, description, posts) with one click instead of doing them yourself, and to see calls and clicks from Google.
      </Card>
      <Card className="flex items-center gap-4">
        <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-hover">
          <Store size={18} aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-medium">Google Business Profile</p>
          <p className="text-[13px] text-muted">
            {connected ? "Connected" : "Apply suggestions to your profile: categories, description and posts."}
          </p>
        </div>
        {connected ? (
          <Badge tone="good">Connected</Badge>
        ) : (
          <Button size="sm" variant="primary" disabled={busy || profile.loading} onClick={() => void connect()}>
            Connect
          </Button>
        )}
      </Card>
      <Actions fb={fb}>
        <Button variant="ghost" icon={<ArrowLeft size={14} />} onClick={onBack}>
          Back
        </Button>
        <Button variant={connected ? "primary" : "secondary"} onClick={onNext}>
          {connected ? "Continue" : "Skip for now"} <ArrowRight size={14} aria-hidden />
        </Button>
      </Actions>
    </>
  );
}

// ---------- What to track ----------

/** A checklist with its count against the Plan, and a row to add your own. */
/** One list to pick from: what it is, how it's searched, and what the picks use up (of the Plan, or in searches). */
function Checklist({
  icon,
  title,
  sub,
  items,
  selected,
  onToggle,
  onAdd,
  usage,
  over = false,
  placeholder,
}: {
  icon?: ReactNode;
  title: string;
  sub: ReactNode;
  items: { text: string; note?: string }[];
  selected: Set<string>;
  onToggle: (text: string) => void;
  onAdd: (text: string) => void;
  usage: ReactNode;
  /** Past what the Plan allows: the usage turns red. */
  over?: boolean;
  placeholder: string;
}) {
  const [draft, setDraft] = useState("");
  const add = () => {
    if (draft.trim()) onAdd(draft.trim());
    setDraft("");
  };
  return (
    <section className="mt-8">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h2 className="inline-flex items-center gap-2 text-[15px] font-medium">
          {icon}
          {title}
        </h2>
        <span className={cn("num text-[12.5px]", over ? "text-bad" : "text-muted")}>{usage}</span>
      </div>
      <p className="mt-0.5 text-[13px] text-muted">{sub}</p>
      <ul className="mt-3 divide-y divide-line rounded-xl border border-line bg-surface">
        {items.map((i) => (
          <li key={i.text}>
            <label className="flex cursor-pointer items-center gap-3 px-4 py-2.5 text-[14px]">
              <Checkbox checked={selected.has(i.text)} onChange={() => onToggle(i.text)} label={`Track ${i.text}`} />
              <span className="min-w-0 flex-1">{i.text}</span>
              {i.note && <span className="num shrink-0 text-[12.5px] text-muted">{i.note}</span>}
            </label>
          </li>
        ))}
        <li className="flex gap-2 px-4 py-2.5">
          <Input
            size="sm"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                add();
              }
            }}
            placeholder={placeholder}
            aria-label={placeholder}
          />
          <Button type="button" size="sm" icon={<Plus size={14} />} onClick={add} disabled={!draft.trim()}>
            Add
          </Button>
        </li>
      </ul>
    </section>
  );
}

const toggle = (set: Set<string>, v: string) => {
  const next = new Set(set);
  if (next.has(v)) next.delete(v);
  else next.add(v);
  return next;
};

const ideaItem = (k: { term: string; monthlySearches: number | null }) => ({
  text: k.term,
  note: k.monthlySearches ? `${fmt(k.monthlySearches)}/mo` : undefined,
});
const addTo = (items: { text: string; note?: string }[], text: string) =>
  items.some((k) => k.text === text) ? items : [...items, { text }];

/**
 * What to track, in the three ways it's checked, because each is searched differently: Google Maps (short terms,
 * searched from every spot of the grid), Google search (with the place, or a full question), and the AI assistants
 * (questions). Everything is built from what was picked on the step before; the most searched are ticked.
 */
function TrackStep({ locationId, onBack, onLaunched }: { locationId: string; onBack: () => void; onLaunched: (runId: string) => void }) {
  const org = useOrg();
  const loc = useLoad(() => locationApi(org.id, locationId).get(), [org.id, locationId]);
  const ideas = useLoad(() => ideasFor(org.id, locationId), [org.id, locationId]);
  const details = useLoad(() => detailsFor(org.id, locationId), [org.id, locationId]);
  const limits = useLoad(() => seoApi(org.id).limits.get(), [org.id]);
  const [mapsItems, setMapsItems] = useState<{ text: string; note?: string }[]>([]);
  const [organicItems, setOrganicItems] = useState<{ text: string; note?: string }[]>([]);
  const [questions, setQuestions] = useState<string[]>([]);
  const [mapsSel, setMapsSel] = useState(new Set<string>());
  const [organicSel, setOrganicSel] = useState(new Set<string>());
  const [qSel, setQSel] = useState(new Set<string>());
  const [checks, setChecks] = useState<Checks | null>(null);
  const [busy, setBusy] = useState(false);
  const fb = useFeedback();

  // Once everything has loaded: the ideas, the most searched pre-ticked within the Plan, and checks the Plan allows.
  useEffect(() => {
    if (checks || !loc.data || !ideas.data || !limits.data || details.loading) return;
    const l = limits.data;
    const i = ideas.data;
    setMapsItems(i.maps.map(ideaItem));
    setOrganicItems(i.organic.map(ideaItem));
    // The questions people ask about this kind of business come after the ones built from the services.
    setQuestions([...new Set([...i.questions, ...(details.data?.questions ?? [])])]);
    // One keyword limit covers both lists (a term on both counts once). Maps costs 49 searches a keyword, so fewer.
    const room = l.keywords ?? Infinity;
    const maps = i.maps.slice(0, Math.min(6, room)).map((k) => k.term);
    const organic: string[] = [];
    for (const k of i.organic) {
      if (organic.length >= 12 || maps.length + organic.length >= room) break;
      if (!maps.includes(k.term)) organic.push(k.term);
    }
    setMapsSel(new Set(maps));
    setOrganicSel(new Set(organic));
    setQSel(new Set(i.questions.slice(0, Math.min(8, l.questions ?? 8))));
    const every: Every = l.checksPerMonth === null || l.checksPerMonth >= 4 ? "weekly" : "monthly";
    setChecks({ gridSize: GRID_SIZE, gridRadiusM: nearestReach(loc.data.gridRadiusM), checkEvery: every, engines: [...engines] });
  }, [checks, loc.data, ideas.data, limits.data, details.loading, details.data]);

  const keywordCount = useMemo(() => new Set([...mapsSel, ...organicSel]).size, [mapsSel, organicSel]);
  const error = loc.error ?? ideas.error ?? limits.error;
  const over =
    (limits.data?.keywords != null && keywordCount > limits.data.keywords) ||
    (limits.data?.questions != null && qSel.size > limits.data.questions);
  if (error) return <LoadError what="ideas for what to track">{error}</LoadError>;
  if (!checks || !limits.data)
    return (
      <p className="flex items-center gap-2 text-[13.5px] text-muted">
        <Loader2 size={16} className="animate-spin" aria-hidden /> Building ideas from your categories, services and places…
      </p>
    );

  const keywordUsage = (
    <>
      {keywordCount}
      {limits.data.keywords !== null && ` of ${limits.data.keywords}`} keywords on your plan, Maps and search together
    </>
  );

  const launch = async () => {
    if (!checks.engines.length && qSel.size) return fb.fail("Pick at least one assistant to ask.", "Could not launch");
    setBusy(true);
    fb.clear();
    const here = locationApi(org.id, locationId);
    const both = [...mapsSel].filter((t) => organicSel.has(t));
    const mapsOnly = [...mapsSel].filter((t) => !organicSel.has(t));
    const organicOnly = [...organicSel].filter((t) => !mapsSel.has(t));
    const saves = [
      () =>
        here.patch({
          gridSize: checks.gridSize,
          gridRadiusM: checks.gridRadiusM,
          checkEvery: checks.checkEvery,
          engines: checks.engines.length ? checks.engines : [...engines],
        }),
      () => (both.length ? here.keywords.post({ terms: both, source: "onboarding" }) : null),
      () => (mapsOnly.length ? here.keywords.post({ terms: mapsOnly, source: "onboarding", maps: true, organic: false }) : null),
      () => (organicOnly.length ? here.keywords.post({ terms: organicOnly, source: "onboarding", maps: false, organic: true }) : null),
      () => (qSel.size ? here.questions.post({ texts: [...qSel], source: "onboarding" }) : null),
    ];
    for (const save of saves) {
      const r = await save();
      if (r?.error) {
        setBusy(false);
        return fb.fail(messageOf(r.error), "Could not launch");
      }
    }
    const r = await here.launch.post();
    setBusy(false);
    if (r.error) return fb.fail(messageOf(r.error), "Could not launch");
    onLaunched(r.data.runId);
  };

  return (
    <>
      <Title sub="Built from the categories, services and places you picked. Each is searched differently, so each has its own list. Change any of it later.">
        What to track
      </Title>
      <p className="text-[13.5px]">{checkSummary(checks, { maps: mapsSel.size, organic: organicSel.size, questions: qSel.size })}</p>
      {ideas.data?.problem && <p className="mt-2 text-[12.5px] text-muted">{ideas.data.problem}</p>}
      <Checklist
        icon={<MapPin size={15} aria-hidden />}
        title="Google Maps"
        sub={
          <>
            Short searches, the way people type on a map; Maps already knows where they are. Each keyword is searched from all {GRID_SPOTS}{" "}
            spots of the 7 × 7 grid. {gridCoverage(checks.gridRadiusM)}
          </>
        }
        items={mapsItems}
        selected={mapsSel}
        onToggle={(t) => setMapsSel(toggle(mapsSel, t))}
        onAdd={(t) => {
          const term = t.toLowerCase();
          setMapsItems(addTo(mapsItems, term));
          setMapsSel(new Set([...mapsSel, term]));
        }}
        usage={
          <>
            {mapsSel.size} × {GRID_SPOTS} spots = {fmt(mapsSel.size * GRID_SPOTS)} searches a check
          </>
        }
        placeholder="Add a Maps keyword, like emergency plumber"
      />
      <Checklist
        icon={<Search size={15} aria-hidden />}
        title="Google search"
        sub="The regular results. People name the place here, or ask in full. Each is searched once, from the business; we read the first 100 results."
        items={organicItems}
        selected={organicSel}
        onToggle={(t) => setOrganicSel(toggle(organicSel, t))}
        onAdd={(t) => {
          const term = t.toLowerCase();
          setOrganicItems(addTo(organicItems, term));
          setOrganicSel(new Set([...organicSel, term]));
        }}
        usage={keywordUsage}
        over={limits.data.keywords !== null && keywordCount > limits.data.keywords}
        placeholder="Add a search, like emergency plumber austin"
      />
      <Checklist
        icon={<Bot size={15} aria-hidden />}
        title="AI assistants"
        sub="Whole questions, asked the way a customer would, of ChatGPT, Google's AI and Perplexity. Built from your services and places."
        items={questions.map((text) => ({ text }))}
        selected={qSel}
        onToggle={(t) => setQSel(toggle(qSel, t))}
        onAdd={(t) => {
          if (!questions.includes(t)) setQuestions([...questions, t]);
          setQSel(new Set([...qSel, t]));
        }}
        usage={
          <>
            {qSel.size}
            {limits.data.questions !== null && ` of ${limits.data.questions}`} questions on your plan
          </>
        }
        over={limits.data.questions !== null && qSel.size > limits.data.questions}
        placeholder="Add your own question"
      />
      <section className="mt-8">
        <h2 className="text-[15px] font-medium">Competitors</h2>
        <p className="mt-0.5 text-[13px] text-muted">
          Nothing to pick: everyone who shows up for your keywords and questions is compared with you. Add one later if we missed it.
        </p>
      </section>
      <section className="mt-8">
        <h2 className="mb-3 text-[15px] font-medium">How it's checked</h2>
        <ChecksFields value={checks} onChange={setChecks} limits={limits.data} mapsKeywords={mapsSel.size} />
      </section>
      <Actions fb={fb}>
        <Button variant="ghost" icon={<ArrowLeft size={14} />} onClick={onBack}>
          Back
        </Button>
        <Button variant="primary" disabled={busy || over || (!keywordCount && !qSel.size)} onClick={() => void launch()}>
          {busy ? "Starting…" : "Finish setup"} <ArrowRight size={14} aria-hidden />
        </Button>
      </Actions>
    </>
  );
}

// ---------- Launch ----------

type RunProgress = { finished: boolean; checks: { kind: string; status: string; calls: number; received: number }[] };

function LaunchStep({ locationId, runId }: { locationId: string; runId: string | null }) {
  const org = useOrg();
  const navigate = useNavigate();
  const loc = useLoad(() => locationApi(org.id, locationId).get(), [org.id, locationId]);
  const [progress, setProgress] = useState<RunProgress | null>(null);
  const [pollError, setPollError] = useState<string | null>(null);
  const finished = !!progress?.finished;
  const overview = useLoad(
    () => (finished ? locationApi(org.id, locationId).overview.get() : Promise.resolve({ data: null, error: null })),
    [org.id, locationId, finished],
  );

  useEffect(() => {
    if (!runId || finished) return;
    let live = true;
    const poll = async () => {
      const r = await locationApi(org.id, locationId).runs({ runId }).get();
      if (!live) return;
      if (r.error) {
        // A run that isn't this Location's, or one that can't be read: stop asking.
        clearInterval(t);
        setPollError(messageOf(r.error));
      } else setProgress(r.data);
    };
    void poll();
    const t = setInterval(() => void poll(), 2000);
    return () => {
      live = false;
      clearInterval(t);
    };
  }, [org.id, locationId, runId, finished]);

  const open = () => navigate(`/seo/overview?location=${locationId}`);
  if (pollError) return <LoadError what="the first check">{pollError}</LoadError>;
  if (!runId) {
    return (
      <>
        <Title>Your checks are running</Title>
        <Button variant="primary" onClick={open}>
          Open SEO <ArrowRight size={14} aria-hidden />
        </Button>
      </>
    );
  }

  const spots = (loc.data?.gridSize ?? 7) ** 2;
  const assistants = loc.data?.engines.length || 1;
  const line = (kind: string, calls: number) =>
    kind === "maps"
      ? `Searching Google Maps from ${spots} spots for ${plural(Math.round(calls / spots), "keyword")}`
      : kind === "organic"
        ? `Checking Google search for ${plural(calls, "keyword")}`
        : `Asking ${plural(assistants, "assistant")} ${plural(Math.round(calls / assistants), "question")}`;
  const order = ["maps", "organic", "ai"];
  const rows = (progress?.checks ?? []).toSorted((a, b) => order.indexOf(a.kind) - order.indexOf(b.kind));
  const o = overview.data;
  const suggestions = o ? o.openSuggestions.maps + o.openSuggestions.keywords + o.openSuggestions.ai : 0;

  return (
    <>
      <Title sub="You can leave this page; we'll keep going.">
        {finished ? `${loc.data?.name ?? "Your business"} is set up` : "Setting things up"}
      </Title>
      <ul className="space-y-4">
        {rows.map((c) => (
          <li key={c.kind}>
            <div className="flex items-center gap-3 text-[14px]">
              <StatusIcon status={c.status} />
              <span className="flex-1">{line(c.kind, c.calls)}</span>
              <span className="num text-[12.5px] text-muted">
                {c.received} of {c.calls}
              </span>
            </div>
            <Progress
              value={c.calls ? (c.received / c.calls) * 100 : c.status === "running" ? 0 : 100}
              tone={c.status === "failed" ? "bad" : "ink"}
              className="mt-2 ml-8"
            />
          </li>
        ))}
        <li className={cn("flex items-center gap-3 text-[14px]", !rows.length && "opacity-40")}>
          <StatusIcon
            status={
              finished ? "done" : rows.length && rows.every((c) => c.status === "done" || c.status === "failed") ? "running" : "waiting"
            }
          />
          Writing your first suggestions
        </li>
      </ul>
      {finished && o && (
        <Card className="mt-8">
          <p className="text-[13px] text-muted">First look</p>
          <p className="mt-2 font-serif text-[20px] leading-snug">
            You're in the map's top 3 at {o.maps.spots ? Math.round((o.maps.top3 / o.maps.spots) * 100) : 0}% of nearby spots, on Google's
            first page for {o.keywords.firstPage} of {plural(o.keywords.total, "keyword")}, and named in {o.ai.named} of{" "}
            {plural(o.ai.total, "AI answer")}.{" "}
            {suggestions ? `We have ${plural(suggestions, "suggestion")} to start with.` : "No suggestions yet; more after the next check."}
          </p>
          <Button className="mt-5" variant="primary" onClick={open}>
            See your suggestions <ArrowRight size={14} aria-hidden />
          </Button>
        </Card>
      )}
      {overview.error && <LoadError what="the first look">{overview.error}</LoadError>}
    </>
  );
}

const plural = (n: number, word: string) => `${n} ${n === 1 ? word : `${word}s`}`;

function StatusIcon({ status }: { status: string }) {
  return (
    <span className="grid size-5 shrink-0 place-items-center">
      {status === "done" ? (
        <Check size={16} className="text-good" aria-label="Done" />
      ) : status === "failed" ? (
        <CircleAlert size={16} className="text-bad" aria-label="Failed" />
      ) : status === "waiting" ? (
        <span className="size-1.5 rounded-full bg-line-strong" aria-hidden />
      ) : (
        <Loader2 size={15} className="animate-spin text-muted" aria-label="Running" />
      )}
    </span>
  );
}
