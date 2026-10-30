import { useMemo, useState, type ReactNode } from "react";
import { Link } from "react-router";
import { Wrench, Loader2, Undo2, ArrowRight, ArrowUp, ArrowDown, X, Search, Star, Sparkles, Plus, Newspaper, Store, Crosshair, MapPin, TrendingUp, Activity, Phone, Navigation, MousePointerClick, Eye, PartyPopper } from "lucide-react";
import { Badge, Button, Card, ScoreRing, cn, fmt, useToast } from "../components/ui";
import { KeywordTable, scanFor } from "../components/KeywordTable";
import { TaskDrawer, UpNext } from "../components/Todo";
import {
  auditIssues, auditKeywordLinks, auditSummary, blogPosts, business, competitors, gbpInsights, gbpPosts, gbpWeekly, gridStats, keywords, reviews, visibilitySeries,
  type ContentItem, type ContentStatus, type Keyword,
} from "../data/mock";
import { openTasksFor, runTasks, undoTask, useRunState, type Task } from "../lib/tasks";
import { lastDone, timeAgo, useRuns } from "../lib/runs";

// ---------- Page ----------

export default function CommandCenter() {
  const state = useRunState();
  const [focus, setFocus] = useState<string | null>(null);
  const focusKw = keywords.find((k) => k.id === focus) ?? null;
  const [open, setOpen] = useState<Task | null>(null);
  const { toast, node } = useToast();

  return (
    <>
      <div className="mb-6">
        <h1 className="font-serif text-[32px] leading-tight tracking-[-0.01em]">Command Center</h1>
        <p className="mt-1.5 max-w-2xl text-[14px] text-muted">Everything about how Maple & Main Dental shows up on Google, on one page.</p>
      </div>

      <PulseBar state={state} />

      <ProfileResults />

      {focusKw && (
        <div className="anim-fade sticky top-12 z-10 mb-6 flex flex-wrap items-center gap-3 rounded-lg border border-line bg-surface/95 px-4 py-2.5 shadow-sm backdrop-blur lg:top-3">
          <Crosshair size={15} className="text-accent" />
          <span className="text-[13.5px]">Focused on <b className="font-medium">{focusKw.term}</b></span>
          <span className="text-[12.5px] text-muted">Up next, site fixes and content show only what affects this keyword.</span>
          <button onClick={() => setFocus(null)} className="ml-auto inline-flex items-center gap-1 rounded px-2 py-1 text-[12.5px] text-muted hover:bg-hover hover:text-fg"><X size={13} /> Clear</button>
        </div>
      )}

      <UpNext focus={focusKw} onOpen={setOpen} />

      <KeywordsSection focus={focus} onFocus={(id) => setFocus((f) => (f === id ? null : id))} onOpenTask={(kid) => setOpen(openTasksFor(state, kid)[0] ?? null)} />

      <HealthSection focus={focusKw} state={state} onRun={(id) => runTasks([id])} onUndo={undoTask} />

      <ContentPanel focus={focusKw} onFocus={(id) => setFocus(id)} toast={toast} />

      <TaskDrawer task={open} onClose={() => setOpen(null)} />
      {node}
    </>
  );
}

function KeywordsSection({ focus, onFocus, onOpenTask }: { focus: string | null; onFocus: (id: string) => void; onOpenTask: (kwId: string) => void }) {
  const [q, setQ] = useState("");
  const rows = keywords.filter((k) => !q || k.term.includes(q.toLowerCase()));
  return (
    <section className="mt-10">
      <SectionTitle
        id="keywords"
        title="Keywords & map pack"
        sub="Where you rank on Google and in the map for every keyword. Open a row for the map, every competitor beside you, and history."
        right={
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex h-8 items-center gap-2 rounded-md border border-line bg-surface px-2.5">
              <Search size={13} className="text-subtle" />
              <input aria-label="Search keywords" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search" className="w-28 bg-transparent text-[13px] outline-none" />
            </div>
            <Link to="/rankings" className="text-[13px] text-muted hover:text-fg">Filters & history →</Link>
          </div>
        }
      />
      <KeywordTable rows={rows} expanded={focus} onToggle={onFocus} onOpenTask={onOpenTask} />
    </section>
  );
}

// ---------- Pulse ----------

type Tone = "good" | "warn" | "bad";
const toneBg: Record<Tone, string> = { good: "from-good-soft", warn: "from-warn-soft", bad: "from-bad-soft" };
const toneText: Record<Tone, string> = { good: "text-good", warn: "text-warn", bad: "text-bad" };
const toneVar: Record<Tone, string> = { good: "var(--good)", warn: "var(--warn)", bad: "var(--bad)" };

function PulseBar({ state }: { state: Record<string, string> }) {
  const local = keywords.filter((k) => k.local);
  const solv = useMemo(() => local.reduce((a, k) => a + gridStats(scanFor(k, 7)).solv, 0) / local.length, []);
  // Weekly history, scaled so it ends on today's grid-based number.
  const raw = visibilitySeries.map((v) => v.value);
  const trend = raw.map((v) => (v * solv) / raw[raw.length - 1]);
  const solvPrev = trend[trend.length - 5];
  const solvDelta = solv - solvPrev;

  const buckets = [
    { label: "Top 3", n: keywords.filter((k) => (k.organic ?? 99) <= 3).length, c: "var(--good)" },
    { label: "4–10", n: keywords.filter((k) => (k.organic ?? 99) > 3 && (k.organic ?? 99) <= 10).length, c: "var(--info)" },
    { label: "11–20", n: keywords.filter((k) => (k.organic ?? 99) > 10 && (k.organic ?? 99) <= 20).length, c: "var(--warn)" },
    { label: "20+", n: keywords.filter((k) => (k.organic ?? 99) > 20).length, c: "var(--border-strong)" },
  ];
  const page1 = buckets[0].n + buckets[1].n;
  const inPack = keywords.filter((k) => (k.local ?? 99) <= 3).length;
  const up = keywords.filter((k) => k.organic !== null && k.organicPrev !== null && k.organicPrev > k.organic).length;
  const down = keywords.filter((k) => k.organic !== null && k.organicPrev !== null && k.organicPrev < k.organic).length;

  const fixed = auditIssues.filter((i) => state[i.id] === "done").length;
  const health = Math.min(100, auditSummary.score + fixed * 3);
  const critical = auditIssues.filter((i) => i.severity === "critical" && state[i.id] !== "done").length;
  const warnings = auditIssues.filter((i) => i.severity === "warning" && state[i.id] !== "done").length;

  const leader = competitors.filter((c) => !c.isYou).sort((a, b) => b.reviewVelocity - a.reviewVelocity)[0];
  const unreplied = reviews.filter((r) => !r.replied && state[r.id] !== "done").length;

  const visTone: Tone = solv >= 50 ? "good" : solv >= 30 ? "warn" : "bad";
  const kwTone: Tone = page1 / keywords.length >= 0.7 ? "good" : page1 / keywords.length >= 0.4 ? "warn" : "bad";
  const healthTone: Tone = health >= 80 ? "good" : health >= 60 ? "warn" : "bad";
  const revTone: Tone = unreplied ? "warn" : "good";

  return (
    <div className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <PulseCard href="#keywords" tone={visTone} label="Local visibility" icon={<MapPin size={14} />}>
        <div className="flex items-end justify-between gap-3">
          <div>
            <div className="num font-serif text-[44px] leading-none tracking-tight">{solv.toFixed(0)}<span className="text-[26px] text-muted">%</span></div>
            <DeltaChip v={solvDelta} suffix=" pts" note="vs 4 wks" />
          </div>
          <AreaSpark values={trend} color={toneVar[visTone]} />
        </div>
        <p className="mt-2 text-[12.5px] text-muted">of nearby searches show you in the top 3 · {local.length} map keywords</p>
      </PulseCard>

      <PulseCard href="#keywords" tone={kwTone} label="Keywords on page 1" icon={<TrendingUp size={14} />}>
        <div className="flex items-baseline gap-2">
          <span className="num font-serif text-[44px] leading-none tracking-tight">{page1}</span>
          <span className="num text-[18px] text-muted">/ {keywords.length}</span>
          <span className="ml-auto flex gap-1.5 text-[12px]">
            <span className="num inline-flex items-center gap-0.5 font-medium text-good"><ArrowUp size={12} strokeWidth={2.5} />{up}</span>
            <span className="num inline-flex items-center gap-0.5 font-medium text-bad"><ArrowDown size={12} strokeWidth={2.5} />{down}</span>
          </span>
        </div>
        <div className="mt-3 flex h-2.5 overflow-hidden rounded-full bg-hover" role="img" aria-label={buckets.map((b) => `${b.label}: ${b.n}`).join(", ")}>
          {buckets.map((b) => b.n > 0 && <span key={b.label} style={{ width: `${(b.n / keywords.length) * 100}%`, background: b.c }} className="h-full border-r-2 border-surface last:border-0" />)}
        </div>
        <div className="mt-2 flex flex-wrap gap-x-3 gap-y-0.5 text-[11.5px] text-muted">
          {buckets.map((b) => <span key={b.label} className="inline-flex items-center gap-1"><span className="size-2 rounded-full" style={{ background: b.c }} />{b.label} <b className="num font-medium text-fg">{b.n}</b></span>)}
        </div>
        <p className="mt-1.5 text-[12.5px] text-muted">{inPack} in the map pack top 3</p>
      </PulseCard>

      <PulseCard href="#health" tone={healthTone} label="Site health" icon={<Activity size={14} />}>
        <div className="flex items-center gap-4">
          <ScoreRing score={health} size={76} stroke={7} label="Site health" />
          <div className="min-w-0">
            <DeltaChip v={health - auditSummary.prevScore} suffix=" pts" note="this week" />
            <div className="mt-2 flex flex-wrap gap-1.5">
              <Badge tone={critical ? "bad" : "good"}>{critical} critical</Badge>
              <Badge tone={warnings ? "warn" : "good"}>{warnings} warnings</Badge>
            </div>
          </div>
        </div>
        <p className="mt-2 text-[12.5px] text-muted">Mobile load {auditSummary.lcp}s <span className={auditSummary.lcp <= 2.5 ? "text-good" : "text-warn"}>({auditSummary.lcp <= 2.5 ? "good" : "slow"})</span> · {auditSummary.pages} pages</p>
      </PulseCard>

      <PulseCard href="#/todo" tone={revTone} label="Reviews" icon={<Star size={14} />}>
        <div className="flex items-end gap-3">
          <span className="num font-serif text-[44px] leading-none tracking-tight">{business.rating}</span>
          <div className="pb-1">
            <Stars value={business.rating} />
            <div className="num mt-0.5 text-[12px] text-muted">{fmt(business.reviews)} reviews</div>
          </div>
        </div>
        <div className="mt-3 space-y-1 text-[11.5px]">
          {[["You", competitors.find((c) => c.isYou)!.reviewVelocity, "var(--accent)"], [leader.name, leader.reviewVelocity, "var(--border-strong)"]].map(([n, v, c]) => (
            <div key={n as string} className="flex items-center gap-2">
              <span className="w-20 truncate text-muted">{n}</span>
              <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-hover"><span className="block h-full rounded-full" style={{ width: `${((v as number) / leader.reviewVelocity) * 100}%`, background: c as string }} /></span>
              <span className="num w-10 text-right text-muted">{v}/mo</span>
            </div>
          ))}
        </div>
        <p className={cn("mt-1.5 text-[12.5px]", unreplied ? "font-medium text-warn" : "text-muted")}>{unreplied ? `${unreplied} waiting for your reply` : "All reviews replied"}</p>
      </PulseCard>
    </div>
  );
}

// ---------- Business Profile results ----------

const profileMetrics = [
  { key: "calls", label: "Calls", icon: Phone, cur: gbpInsights.calls, prev: gbpInsights.callsPrev, weeks: gbpWeekly.calls, plain: () => "people called you from Google", win: (d: number) => `${d} more people called you` },
  { key: "directions", label: "Directions", icon: Navigation, cur: gbpInsights.directions, prev: gbpInsights.directionsPrev, weeks: gbpWeekly.directions, plain: () => "asked for directions to you", win: (d: number) => `${d} more people asked for directions` },
  { key: "websiteClicks", label: "Website clicks", icon: MousePointerClick, cur: gbpInsights.websiteClicks, prev: gbpInsights.websiteClicksPrev, weeks: gbpWeekly.websiteClicks, plain: () => "visited your website", win: (d: number) => `${d} more people visited your website` },
  { key: "views", label: "Profile views", icon: Eye, cur: gbpInsights.views, prev: gbpInsights.viewsPrev, weeks: gbpWeekly.views, plain: () => "saw your profile on Search & Maps", win: (d: number) => `${fmt(d)} more people saw your profile` },
] as const;

/** What the Business Profile brought in: the "is this working?" numbers, in plain words. */
function ProfileResults() {
  const runs = useRuns();
  const synced = lastDone(runs, "profile");
  const pct = (m: (typeof profileMetrics)[number]) => ((m.cur - m.prev) / m.prev) * 100;
  const actions = profileMetrics.filter((m) => m.key !== "views");
  const total = actions.reduce((a, m) => a + m.cur, 0), totalPrev = actions.reduce((a, m) => a + m.prev, 0);
  const best = [...actions].sort((a, b) => pct(b) - pct(a))[0];

  return (
    <section className="mb-6">
      <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="font-serif text-[22px] leading-tight">From your Google profile</h2>
          <p className="mt-0.5 text-[13px] text-muted">Last 28 days compared with the 28 days before{synced ? ` · synced ${timeAgo(synced.started + (synced.durationSec ?? 0) * 1000)}` : ""}</p>
        </div>
        <Link to="/profile" className="text-[13px] text-muted hover:text-fg">Business Profile →</Link>
      </div>

      {pct(best) > 0 && (
        <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border border-good/25 bg-good-soft px-5 py-3.5">
          <span className="grid size-9 shrink-0 place-items-center rounded-full bg-good text-white"><PartyPopper size={17} /></span>
          <div className="min-w-0 flex-1">
            <div className="text-[15px] font-medium text-good">Good news: {best.win(best.cur - best.prev)} this month</div>
            <div className="text-[13px] text-muted">
              {fmt(total)} customers called, asked for directions or clicked through to your site, <b className="num font-medium text-good">{((total - totalPrev) / totalPrev * 100).toFixed(0)}% more</b> than last month.
            </div>
          </div>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {profileMetrics.map((m) => {
          const p = pct(m), up = p >= 0;
          const max = Math.max(...m.weeks);
          return (
            <Link key={m.key} to="/profile" className="group rounded-xl border border-line bg-surface p-4 transition-shadow hover:shadow-md">
              <div className="flex items-center gap-2.5">
                <span className={cn("grid size-8 place-items-center rounded-full", up ? "bg-good-soft text-good" : "bg-bad-soft text-bad")}><m.icon size={15} /></span>
                <span className="text-[13px] font-medium">{m.label}</span>
                <span className={cn("num ml-auto inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[11.5px] font-medium", up ? "bg-good-soft text-good" : "bg-bad-soft text-bad")}>
                  {up ? <ArrowUp size={11} strokeWidth={2.5} /> : <ArrowDown size={11} strokeWidth={2.5} />}{Math.abs(p).toFixed(0)}%
                </span>
              </div>
              <div className="mt-3 flex items-end justify-between gap-3">
                <div>
                  <div className="num font-serif text-[32px] leading-none tracking-tight">{fmt(m.cur)}</div>
                  <div className="num mt-1 text-[12px] text-subtle">was {fmt(m.prev)}</div>
                </div>
                <div className="flex h-10 items-end gap-[3px]" role="img" aria-label={`${m.label} by week, last 8 weeks`}>
                  {m.weeks.map((v, i) => (
                    <span key={i} title={`${fmt(v)} that week`} className={cn("w-[7px] rounded-sm", i >= 4 ? (up ? "bg-good" : "bg-bad") : "bg-line-strong")} style={{ height: `${Math.max(12, (v / max) * 100)}%` }} />
                  ))}
                </div>
              </div>
              <p className="mt-2 text-[12.5px] text-muted">{fmt(m.cur)} {m.plain()}</p>
              {!up && m.key === "websiteClicks" && <p className="mt-1 text-[12px] text-bad">Slow mobile load ({auditSummary.lcp}s) may be costing clicks.</p>}
            </Link>
          );
        })}
      </div>
    </section>
  );
}

function PulseCard({ href, tone, label, icon, children }: { href: string; tone: Tone; label: string; icon: ReactNode; children: ReactNode }) {
  return (
    <a
      href={href}
      onClick={(e) => { if (href.startsWith("#/")) return; e.preventDefault(); document.querySelector(href)?.scrollIntoView({ behavior: "smooth", block: "start" }); }}
      className={cn("group relative block overflow-hidden rounded-xl border border-line bg-gradient-to-b to-surface to-60% p-5 transition-shadow hover:shadow-md", toneBg[tone])}
    >
      <span className="absolute inset-x-0 top-0 h-1" style={{ background: toneVar[tone] }} aria-hidden />
      <div className="mb-3 flex items-center justify-between text-[12.5px] font-medium text-muted">
        <span className="inline-flex items-center gap-1.5"><span className={toneText[tone]}>{icon}</span>{label}</span>
        <ArrowRight size={13} className="opacity-0 transition-opacity group-hover:opacity-100" />
      </div>
      {children}
    </a>
  );
}

function DeltaChip({ v, suffix, note }: { v: number; suffix: string; note: string }) {
  const good = v >= 0;
  return (
    <span className={cn("num mt-1.5 inline-flex items-center gap-0.5 rounded-full whitespace-nowrap px-1.5 py-0.5 text-[11.5px] font-medium", good ? "bg-good-soft text-good" : "bg-bad-soft text-bad")}>
      {good ? <ArrowUp size={11} strokeWidth={2.5} /> : <ArrowDown size={11} strokeWidth={2.5} />}{Math.abs(v) < 10 ? Math.abs(v).toFixed(1) : Math.abs(v).toFixed(0)}{suffix}<span className="ml-1 font-normal opacity-75">{note}</span>
    </span>
  );
}

function AreaSpark({ values, color, w = 110, h = 44 }: { values: number[]; color: string; w?: number; h?: number }) {
  const min = Math.min(...values), max = Math.max(...values), span = max - min || 1;
  const pts = values.map((v, i) => [(i / (values.length - 1)) * w, h - 3 - ((v - min) / span) * (h - 8)] as const);
  const d = pts.map((p, i) => `${i ? "L" : "M"}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" ");
  const last = pts[pts.length - 1];
  return (
    <svg width={w} height={h} aria-hidden className="shrink-0 overflow-visible">
      <path d={`${d} L${w},${h} L0,${h} Z`} fill={color} opacity={0.14} />
      <path d={d} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={last[0]} cy={last[1]} r={3} fill="var(--surface)" stroke={color} strokeWidth={2} />
    </svg>
  );
}

function Stars({ value }: { value: number }) {
  return (
    <span className="relative inline-flex text-hover" aria-label={`${value} out of 5 stars`}>
      {[0, 1, 2, 3, 4].map((i) => <Star key={i} size={15} className="fill-current" />)}
      <span className="absolute inset-0 inline-flex overflow-hidden text-warn" style={{ width: `${(value / 5) * 100}%` }}>
        {[0, 1, 2, 3, 4].map((i) => <Star key={i} size={15} className="shrink-0 fill-current" />)}
      </span>
    </span>
  );
}

function SectionTitle({ id, title, sub, right }: { id: string; title: string; sub?: ReactNode; right?: ReactNode }) {
  return (
    <div id={id} className="mb-3 flex scroll-mt-20 flex-wrap items-end justify-between gap-3">
      <div>
        <h2 className="font-serif text-[22px] leading-tight">{title}</h2>
        {sub && <p className="mt-0.5 text-[13px] text-muted">{sub}</p>}
      </div>
      {right}
    </div>
  );
}


// ---------- Site health ----------

const sevTone = { critical: "bad", warning: "warn", notice: "info" } as const;
const sevRank = { critical: 0, warning: 1, notice: 2 } as const;
const auditCats = ["All", "Technical", "On-page", "Local", "Performance", "Content"] as const;

function HealthSection({ focus, state, onRun, onUndo }: { focus: Keyword | null; state: Record<string, string>; onRun: (id: string) => void; onUndo: (id: string) => void }) {
  const [cat, setCat] = useState<(typeof auditCats)[number]>("All");
  const [showAll, setShowAll] = useState(false);
  const issues = auditIssues
    .filter((i) => (!focus || (auditKeywordLinks[i.id] ?? []).includes(focus.id)) && (cat === "All" || i.category === cat))
    .sort((a, b) => sevRank[a.severity] - sevRank[b.severity]);
  const visible = showAll ? issues : issues.slice(0, 6);
  const fixed = auditIssues.filter((i) => state[i.id] === "done").length;
  const count = (s: keyof typeof sevRank) => auditIssues.filter((i) => i.severity === s && state[i.id] !== "done").length;
  const vitals = [
    { label: "Loading (LCP)", value: `${auditSummary.lcp}s`, ok: auditSummary.lcp <= 2.5, target: "≤ 2.5s" },
    { label: "Responsiveness (INP)", value: `${auditSummary.inp}ms`, ok: auditSummary.inp <= 200, target: "≤ 200ms" },
    { label: "Visual stability (CLS)", value: auditSummary.cls.toFixed(2), ok: auditSummary.cls <= 0.1, target: "≤ 0.1" },
  ];

  return (
    <section className="mt-10">
      <SectionTitle
        id="health"
        title="Site health"
        sub={`mapleandmaindental.com · ${auditSummary.pages} pages checked ${auditSummary.crawled.split(" ")[0]}`}
        right={
          <div className="flex flex-wrap items-center gap-1.5">
            {auditCats.map((c) => (
              <button key={c} onClick={() => setCat(c)} className={cn("h-7 rounded-full border px-2.5 text-[12.5px] transition-colors", cat === c ? "border-ink bg-ink text-on-ink" : "border-line text-muted hover:bg-hover")}>{c}</button>
            ))}
            <Link to="/audit" className="ml-1 text-[13px] text-muted hover:text-fg">Full audit →</Link>
          </div>
        }
      />
      <Card pad={false}>
        <div className="grid gap-px border-b border-line bg-line sm:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
          <div className="flex items-center gap-5 bg-surface p-5">
            <ScoreRing score={Math.min(100, auditSummary.score + fixed * 3)} size={72} stroke={6} label="Site health" />
            <div className="text-[13px]">
              <div className="text-[14px] font-medium">{auditSummary.score >= 80 ? "Your site is healthy" : "A few fixes will help"}</div>
              <div className="text-muted">Up {auditSummary.score - auditSummary.prevScore} points since last week{fixed ? ` · ${fixed} fixed today` : ""}</div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                <Badge tone="bad">{count("critical")} critical</Badge>
                <Badge tone="warn">{count("warning")} warnings</Badge>
                <Badge tone="info">{count("notice")} notices</Badge>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4 bg-surface p-5">
            {vitals.map((v) => (
              <div key={v.label}>
                <div className="text-[12px] text-muted">{v.label}</div>
                <div className={cn("num mt-1 font-serif text-[22px] leading-none", v.ok ? "text-good" : "text-warn")}>{v.value} <span className="font-sans text-[12px] font-medium">{v.ok ? "Good" : "Slow"}</span></div>
                <div className="mt-1 text-[11.5px] text-subtle">Target {v.target} on phones</div>
              </div>
            ))}
          </div>
        </div>
        {visible.map((i) => {
          const st = state[i.id];
          return (
            <div key={i.id} className={cn("flex items-center gap-4 border-b border-line px-5 py-3 last:border-0", st === "done" && "bg-good-soft/30")}>
              <Badge tone={sevTone[i.severity]} className="w-[68px] shrink-0 justify-center capitalize">{i.severity}</Badge>
              <Link to={`/audit/${i.id}`} className="min-w-0 flex-1">
                <div className={cn("truncate text-[13.5px] font-medium hover:underline", st === "done" && "text-muted line-through decoration-1")}>{i.title}</div>
                <div className="truncate text-[12.5px] text-muted">{i.fix}</div>
                <div className="truncate text-[11.5px] text-subtle">{i.category} · {i.pages.join(", ")}</div>
              </Link>
              {i.autoFix && <span className="hidden text-[12px] text-subtle md:block">via {i.autoFix.executor}</span>}
              <div className="shrink-0">
                {st === "done" ? (
                  <button onClick={() => onUndo(i.id)} className="inline-flex items-center gap-1 rounded px-2 py-1 text-[12.5px] text-muted hover:bg-hover"><Undo2 size={12} /> Undo</button>
                ) : st === "running" ? (
                  <Button size="sm" disabled><Loader2 size={13} className="animate-spin" /></Button>
                ) : i.autoFix ? (
                  <Button size="sm" icon={<Wrench size={12} />} onClick={() => onRun(i.id)}>Fix</Button>
                ) : (
                  <Link to={`/audit/${i.id}`}><Button size="sm" variant="ghost">How to fix</Button></Link>
                )}
              </div>
            </div>
          );
        })}
        {!visible.length && <div className="px-5 py-10 text-center text-[13px] text-muted">No site issues affect this keyword.</div>}
        {issues.length > 6 && (
          <button onClick={() => setShowAll(!showAll)} className="w-full border-t border-line px-4 py-2.5 text-[13px] text-muted hover:bg-hover hover:text-fg">
            {showAll ? "Show fewer" : `Show ${issues.length - 6} more`}
          </button>
        )}
      </Card>
    </section>
  );
}

// ---------- Content ----------

const statusTone: Record<ContentStatus, "neutral" | "info" | "warn" | "good"> = { idea: "neutral", draft: "warn", scheduled: "info", published: "good" };

function ContentPanel({ focus, onFocus, toast }: { focus: Keyword | null; onFocus: (id: string) => void; toast: (m: string) => void }) {
  const [blogs, setBlogs] = useState(blogPosts);
  const [posts, setPosts] = useState(gbpPosts);
  const [busy, setBusy] = useState<string | null>(null);

  const advance = (list: "blog" | "post", item: ContentItem) => {
    setBusy(item.id);
    setTimeout(() => {
      const next: ContentStatus = item.status === "idea" ? "draft" : "published";
      const upd = (xs: ContentItem[]) => xs.map((x) => (x.id === item.id ? { ...x, status: next, date: next === "draft" ? "Just now" : "Today" } : x));
      list === "blog" ? setBlogs(upd) : setPosts(upd);
      setBusy(null);
      toast(next === "draft" ? "Draft written. Review it in WordPress" : "Published");
    }, 900);
  };
  const add = (list: "blog" | "post") => {
    const kw = focus ?? keywords[2];
    const item: ContentItem = list === "blog"
      ? { id: `b${Date.now()}`, title: `${kw.term.replace(/\b\w/g, (c) => c.toUpperCase())}: what to know`, status: "idea", keywordId: kw.id, date: "Suggested", words: 1200 }
      : { id: `p${Date.now()}`, title: `Update about ${kw.term.replace(" austin", "")}`, status: "draft", keywordId: kw.id, date: "Ready to publish" };
    list === "blog" ? setBlogs((b) => [item, ...b]) : setPosts((p) => [item, ...p]);
  };

  const List = ({ list, items }: { list: "blog" | "post"; items: ContentItem[] }) => {
    const shown = items.filter((i) => !focus || i.keywordId === focus.id);
    return (
      <>
        {shown.map((i) => {
          const kw = keywords.find((k) => k.id === i.keywordId);
          const act = i.status === "idea" ? "Write" : i.status === "draft" ? "Publish" : null;
          return (
            <div key={i.id} className="flex items-start gap-3 border-b border-line px-4 py-3 last:border-0">
              <div className="min-w-0 flex-1">
                <div className="text-[13.5px] leading-snug font-medium">{i.title}</div>
                <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[12px] text-muted">
                  <Badge tone={statusTone[i.status]} className="capitalize">{i.status}</Badge>
                  {kw && <button onClick={() => onFocus(kw.id)} className="text-subtle hover:text-fg">#{kw.term}</button>}
                  <span>· {i.date}</span>
                  {i.words && <span className="num">· {fmt(i.words)} words</span>}
                  {i.metric && <span className="num">· {i.metric}</span>}
                </div>
              </div>
              {act && (
                <Button size="sm" onClick={() => advance(list, i)} disabled={busy === i.id} icon={busy === i.id ? <Loader2 size={12} className="animate-spin" /> : act === "Write" ? <Sparkles size={12} /> : undefined}>{act}</Button>
              )}
            </div>
          );
        })}
        {!shown.length && <div className="px-4 py-8 text-center text-[13px] text-muted">Nothing for this keyword yet.</div>}
      </>
    );
  };

  return (
    <section className="mt-10">
      <SectionTitle id="content" title="Content" sub="Articles on your website and posts on your Google profile, each aimed at a keyword." />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card pad={false}>
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <span className="flex items-center gap-2 text-[14px] font-medium"><Newspaper size={15} /> Blog articles</span>
            <Button size="sm" variant="ghost" icon={<Sparkles size={12} />} onClick={() => add("blog")}>Suggest</Button>
          </div>
          <List list="blog" items={blogs} />
        </Card>
        <Card pad={false}>
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <span className="flex items-center gap-2 text-[14px] font-medium"><Store size={15} /> Business Profile posts</span>
            <Button size="sm" variant="ghost" icon={<Plus size={12} />} onClick={() => add("post")}>New post</Button>
          </div>
          <List list="post" items={posts} />
        </Card>
      </div>
      <Link to="/profile" className="mt-3 inline-flex items-center gap-1 text-[12.5px] text-muted hover:text-fg">Reviews, posts and profile settings <ArrowRight size={12} /></Link>
    </section>
  );
}
