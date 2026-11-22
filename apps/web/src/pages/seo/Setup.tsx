// Setting up SEO for a business (/seo/setup): find it on Google, confirm what we found, optionally connect its Google
// profile, pick what to track, and launch the first check. The draft Location and the step are in the address
// (?location=…&step=…), so a reload or the round trip through Google's sign-in carries on where it was.
import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { Link, Navigate, useNavigate, useSearchParams } from "react-router";
import { ArrowLeft, ArrowRight, Check, CircleAlert, Loader2, Plus, Search, Store } from "lucide-react";
import { Badge, Button, Card, Checkbox, Field, Input, Progress, cn, fmt } from "../../components/ui";
import { Feedback, LoadError, useFeedback, useToast } from "../../components/Feedback";
import { messageOf } from "../../lib/api";
import { useLoad } from "../../lib/useLoad";
import { useOrg, useSession } from "../../lib/session";
import { locationApi, seoApi, type Ideas, type Place } from "./api";
import { ChecksFields, ServicesField, checkSummary, connectGoogle, engines, useOAuthError, type Checks, type Every } from "./fields";

type Step = "start" | "found" | "connect" | "track" | "launch";
const steps: { id: Step; name: string }[] = [
  { id: "start", name: "Start" },
  { id: "found", name: "What we found" },
  { id: "connect", name: "Connect" },
  { id: "track", name: "What to track" },
  { id: "launch", name: "Launch" },
];

/**
 * Ideas cost a request: asked once per draft while this page is open, shared by the steps that use them. A failed
 * request isn't kept, and changing the services asks again (questions are built from them).
 */
const ideasCache = new Map<string, Promise<{ data: Ideas | null; error: unknown }>>();
const ideasFor = (orgId: string, locationId: string) => {
  if (!ideasCache.has(locationId))
    ideasCache.set(
      locationId,
      locationApi(orgId, locationId)
        .ideas.get()
        .then((r) => {
          if (r.error) ideasCache.delete(locationId);
          return r;
        }),
    );
  return ideasCache.get(locationId)!;
};

export default function Setup() {
  const { can, caller, features } = useSession();
  const [params, setParams] = useSearchParams();
  const locationId = params.get("location");
  const asked = params.get("step");
  const step: Step = steps.some((s) => s.id === asked) ? (asked as Step) : locationId ? "found" : "start";
  const at = steps.findIndex((s) => s.id === step);
  const go = (next: Step, extra: Record<string, string> = {}) =>
    setParams(Object.fromEntries(Object.entries({ location: locationId ?? "", ...extra, step: next }).filter(([, v]) => v)));

  // Permissions load after the Organization is chosen: wait for them rather than refuse on a stale answer.
  if (!caller) return null;
  if (features.seo && !features.seo.on) return <Navigate replace to="/" />;
  if (!can("seo", "manage"))
    return (
      <Card className="max-w-xl">
        <p className="text-[14px] font-medium">Only people who manage SEO can set it up</p>
        <p className="mt-1 text-[13.5px] text-muted">
          Ask an admin of this organization. <Link to="/">Back home</Link>
        </p>
      </Card>
    );

  return (
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
  const [form, setForm] = useState<{ name: string; website: string; services: string[] } | null>(null);
  const [busy, setBusy] = useState(false);
  const fb = useFeedback();

  useEffect(() => {
    if (loc.data && loc.data.status !== "draft") navigate(`/seo/overview?location=${loc.data.id}`, { replace: true });
  }, [loc.data, navigate]);
  useEffect(() => {
    if (form || !loc.data || ideas.loading) return;
    const services = loc.data.services.length ? loc.data.services : (ideas.data?.services ?? []);
    setForm({ name: loc.data.name, website: loc.data.website ?? "", services });
  }, [form, loc.data, ideas.loading, ideas.data]);

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
    if (form.services.join("|") !== (ideas.data?.services ?? loc.data?.services ?? []).join("|")) ideasCache.delete(locationId);
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
        <Field label="Services" hint="Keyword and question ideas, and suggestions, come from these.">
          <ServicesField value={form.services} onChange={(services) => setForm({ ...form, services })} />
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
function Checklist({
  title,
  sub,
  items,
  selected,
  onToggle,
  onAdd,
  limit,
  placeholder,
}: {
  title: string;
  sub: string;
  items: { text: string; note?: string }[];
  selected: Set<string>;
  onToggle: (text: string) => void;
  onAdd: (text: string) => void;
  limit: number | null;
  placeholder: string;
}) {
  const [draft, setDraft] = useState("");
  const add = () => {
    if (draft.trim()) onAdd(draft.trim());
    setDraft("");
  };
  const over = limit !== null && selected.size > limit;
  return (
    <section className="mt-8">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-[15px] font-medium">{title}</h2>
        <span className={cn("num text-[12.5px]", over ? "text-bad" : "text-muted")}>
          {selected.size}
          {limit !== null && ` of ${limit}`} on your plan
        </span>
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

function TrackStep({ locationId, onBack, onLaunched }: { locationId: string; onBack: () => void; onLaunched: (runId: string) => void }) {
  const org = useOrg();
  const loc = useLoad(() => locationApi(org.id, locationId).get(), [org.id, locationId]);
  const ideas = useLoad(() => ideasFor(org.id, locationId), [org.id, locationId]);
  const limits = useLoad(() => seoApi(org.id).limits.get(), [org.id]);
  const [keywords, setKeywords] = useState<{ text: string; note?: string }[]>([]);
  const [questions, setQuestions] = useState<string[]>([]);
  const [kwSel, setKwSel] = useState(new Set<string>());
  const [qSel, setQSel] = useState(new Set<string>());
  const [checks, setChecks] = useState<Checks | null>(null);
  const [busy, setBusy] = useState(false);
  const fb = useFeedback();

  // Once everything has loaded: the ideas, pre-ticked within the Plan, and checks the Plan allows.
  useEffect(() => {
    if (checks || !loc.data || !ideas.data || !limits.data) return;
    const l = limits.data;
    setKeywords(ideas.data.keywords.map((k) => ({ text: k.term, note: k.monthlySearches ? `${fmt(k.monthlySearches)}/mo` : undefined })));
    setQuestions(ideas.data.questions);
    setKwSel(new Set(ideas.data.keywords.slice(0, Math.min(8, l.keywords ?? 8)).map((k) => k.term)));
    setQSel(new Set(ideas.data.questions.slice(0, l.questions ?? undefined)));
    const every: Every = l.checksPerMonth === null || l.checksPerMonth >= 4 ? "weekly" : "monthly";
    // The largest grid allowed: the API takes 5, 7 or 9.
    const gridSize = [9, 7, 5].find((n) => n <= Math.min(loc.data!.gridSize, l.gridSize ?? 9)) ?? 5;
    setChecks({ gridSize, checkEvery: every, engines: [...engines] });
  }, [checks, loc.data, ideas.data, limits.data]);

  const error = loc.error ?? ideas.error ?? limits.error;
  const over = useMemo(
    () =>
      (limits.data?.keywords != null && kwSel.size > limits.data.keywords) ||
      (limits.data?.questions != null && qSel.size > limits.data.questions),
    [limits.data, kwSel, qSel],
  );
  if (error) return <LoadError what="ideas for what to track">{error}</LoadError>;
  if (!checks || !limits.data) return <Loader2 size={18} className="animate-spin text-muted" aria-label="Loading ideas" />;

  const launch = async () => {
    if (!checks.engines.length && qSel.size) return fb.fail("Pick at least one assistant to ask.", "Could not launch");
    setBusy(true);
    fb.clear();
    const here = locationApi(org.id, locationId);
    const saves = [
      () =>
        here.patch({
          gridSize: checks.gridSize,
          checkEvery: checks.checkEvery,
          engines: checks.engines.length ? checks.engines : [...engines],
        }),
      () => (kwSel.size ? here.keywords.post({ terms: [...kwSel], source: "onboarding" }) : null),
      () => (qSel.size ? here.questions.post({ texts: [...qSel], source: "onboarding" }) : null),
    ];
    for (const s of saves) {
      const r = await s();
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
      <Title sub="Pre-ticked from your website and nearby searches. Change any of it later.">What to track</Title>
      <p className="text-[13.5px]">{checkSummary(checks, kwSel.size, qSel.size)}</p>
      <Checklist
        title="Keywords"
        sub="Searched on Google Maps from every spot of the grid, and on Google search."
        items={keywords}
        selected={kwSel}
        onToggle={(t) => setKwSel(toggle(kwSel, t))}
        onAdd={(t) => {
          const term = t.toLowerCase();
          if (!keywords.some((k) => k.text === term)) setKeywords([...keywords, { text: term }]);
          setKwSel(new Set([...kwSel, term]));
        }}
        limit={limits.data.keywords}
        placeholder="Add your own keyword"
      />
      <Checklist
        title="Questions for AI assistants"
        sub="Asked the way a customer would. Suggested from your services."
        items={questions.map((text) => ({ text }))}
        selected={qSel}
        onToggle={(t) => setQSel(toggle(qSel, t))}
        onAdd={(t) => {
          if (!questions.includes(t)) setQuestions([...questions, t]);
          setQSel(new Set([...qSel, t]));
        }}
        limit={limits.data.questions}
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
        <ChecksFields value={checks} onChange={setChecks} limits={limits.data} />
      </section>
      <Actions fb={fb}>
        <Button variant="ghost" icon={<ArrowLeft size={14} />} onClick={onBack}>
          Back
        </Button>
        <Button variant="primary" disabled={busy || over || (!kwSel.size && !qSel.size)} onClick={() => void launch()}>
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
