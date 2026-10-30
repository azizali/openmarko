import { useId, type ReactNode } from "react";
import { Link } from "react-router";
import { ArrowDown, ArrowRight, ArrowUp, Activity, MapPin, MousePointerClick, Navigation, Phone, Sparkles, Star, TrendingUp, Eye } from "lucide-react";
import { cn, fmt } from "./ui";
import { scanFor } from "./KeywordTable";
import { auditIssues, auditSummary, business, competitors, gbpInsights, gbpWeekly, gridStats, keywords, reviews, visibilitySeries } from "../data/mock";
import { aiVisibility } from "../data/ai";

// The top of the Command Center, in two layouts (Story and Ledger). Both read
// the same numbers from pulseData() and include the local presence scorecard.

export type TopVariant = "story" | "ledger";
export const topVariants: { id: TopVariant; label: string }[] = [
  { id: "story", label: "Story" },
  { id: "ledger", label: "Ledger" },
];

// ---------- Data ----------

export function pulseData(state: Record<string, string>) {
  const local = keywords.filter((k) => k.local);
  const solv = local.reduce((a, k) => a + gridStats(scanFor(k, 7)).solv, 0) / local.length;
  const raw = visibilitySeries.map((v) => v.value);
  const visTrend = raw.map((v) => (v * solv) / raw[raw.length - 1]);
  const best = [...local].sort((a, b) => gridStats(scanFor(b, 7)).solv - gridStats(scanFor(a, 7)).solv)[0];

  const pos = (k: (typeof keywords)[number]) => k.organic ?? 99;
  const buckets = [
    { label: "Top 3", n: keywords.filter((k) => pos(k) <= 3).length, c: "var(--good)" },
    { label: "4–10", n: keywords.filter((k) => pos(k) > 3 && pos(k) <= 10).length, c: "var(--info)" },
    { label: "11–20", n: keywords.filter((k) => pos(k) > 10 && pos(k) <= 20).length, c: "var(--warn)" },
    { label: "20+", n: keywords.filter((k) => pos(k) > 20).length, c: "var(--border-strong)" },
  ];
  const page1 = buckets[0].n + buckets[1].n;
  // Average Google position per history point (lower is better).
  const posTrend = keywords[0].history.map((_, i) => keywords.reduce((a, k) => a + (k.history[i]?.organic ?? 30), 0) / keywords.length);

  const fixed = auditIssues.filter((i) => state[i.id] === "done").length;
  const health = Math.min(100, auditSummary.score + fixed * 3);
  const critical = auditIssues.filter((i) => i.severity === "critical" && state[i.id] !== "done").length;
  const warnings = auditIssues.filter((i) => i.severity === "warning" && state[i.id] !== "done").length;

  const you = competitors.find((c) => c.isYou)!;
  const leader = competitors.filter((c) => !c.isYou).sort((a, b) => b.reviewVelocity - a.reviewVelocity)[0];
  const unreplied = reviews.filter((r) => !r.replied && state[r.id] !== "done").length;

  const metric = (key: "calls" | "directions" | "websiteClicks" | "views", label: string, icon: typeof Phone, plain: string) => {
    const cur = gbpInsights[key], prev = gbpInsights[`${key}Prev` as const];
    return { key, label, icon, plain, cur, prev, pct: ((cur - prev) / prev) * 100, weeks: gbpWeekly[key] };
  };
  const outcomes = [
    metric("calls", "Calls", Phone, "people called you"),
    metric("directions", "Directions", Navigation, "asked for directions"),
    metric("websiteClicks", "Website clicks", MousePointerClick, "visited your site"),
    metric("views", "Profile views", Eye, "saw your profile"),
  ];
  const actions = outcomes.slice(0, 3);
  const actionsCur = actions.reduce((a, m) => a + m.cur, 0), actionsPrev = actions.reduce((a, m) => a + m.prev, 0);
  const actionsWeeks = actions[0].weeks.map((_, i) => actions.reduce((a, m) => a + m.weeks[i], 0));

  const ai = aiVisibility();
  const scores = [
    { key: "maps", label: "Map pack", value: Math.min(100, Math.round((solv / 40) * 100)), href: "#keywords" },
    { key: "google", label: "Google search", value: Math.round((page1 / keywords.length) * 100), href: "#keywords" },
    { key: "site", label: "Website", value: health, href: "#health" },
    { key: "reviews", label: "Reviews", value: Math.round((business.rating / 5) * 70 + Math.min(1, you.reviewVelocity / leader.reviewVelocity) * 30), href: "#/profile" },
    { key: "ai", label: "AI answers", value: Math.round(ai.pct), href: "#/ai" },
  ];
  const overall = Math.round(scores.reduce((a, s) => a + s.value, 0) / scores.length);

  return {
    solv, solvDelta: solv - visTrend[visTrend.length - 5], visTrend, best, localCount: local.length,
    buckets, page1, total: keywords.length, inPack: keywords.filter((k) => (k.local ?? 99) <= 3).length,
    up: keywords.filter((k) => k.organic !== null && k.organicPrev !== null && k.organicPrev > k.organic).length,
    down: keywords.filter((k) => k.organic !== null && k.organicPrev !== null && k.organicPrev < k.organic).length,
    posTrend,
    health, healthDelta: health - auditSummary.prevScore, critical, warnings, lcp: auditSummary.lcp,
    rating: business.rating, reviewCount: business.reviews, velocity: you.reviewVelocity, leader, unreplied,
    outcomes, actionsCur, actionsPrev, actionsPct: ((actionsCur - actionsPrev) / actionsPrev) * 100, actionsWeeks,
    ai, aiDelta: ai.pct - ai.prevPct,
    scores, overall,
  };
}
type P = ReturnType<typeof pulseData>;

// ---------- Small parts ----------

function Delta({ v, suffix = "%", digits = 0, className }: { v: number; suffix?: string; digits?: number; className?: string }) {
  const up = v >= 0;
  return (
    <span className={cn("num inline-flex items-center gap-0.5 rounded-full px-1.5 py-px text-[11.5px] font-medium whitespace-nowrap", up ? "bg-good-soft text-good" : "bg-bad-soft text-bad", className)}>
      {up ? <ArrowUp size={10} strokeWidth={2.75} /> : <ArrowDown size={10} strokeWidth={2.75} />}{Math.abs(v).toFixed(digits)}{suffix}
    </span>
  );
}

/** Responsive area chart: stretches to its container. */
function Area({ values, color = "var(--accent)", h = 64, invert = false, className, dot = true }: { values: number[]; color?: string; h?: number; invert?: boolean; className?: string; dot?: boolean }) {
  const id = useId();
  const min = Math.min(...values), max = Math.max(...values), span = max - min || 1;
  const W = 300;
  const y = (v: number) => (invert ? 4 + ((v - min) / span) * (h - 10) : h - 4 - ((v - min) / span) * (h - 10));
  const pts = values.map((v, i) => [(i / (values.length - 1)) * W, y(v)] as const);
  // Catmull-Rom → cubic Bézier, so weekly data reads as a trend rather than a zigzag.
  const f = (p: readonly [number, number]) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`;
  const d = pts.map((p, i) => {
    if (!i) return `M${f(p)}`;
    const p0 = pts[i - 2] ?? pts[i - 1], p1 = pts[i - 1], p3 = pts[i + 1] ?? p;
    const c1 = [p1[0] + (p[0] - p0[0]) / 6, p1[1] + (p[1] - p0[1]) / 6] as const;
    const c2 = [p[0] - (p3[0] - p1[0]) / 6, p[1] - (p3[1] - p1[1]) / 6] as const;
    return `C${f(c1)} ${f(c2)} ${f(p)}`;
  }).join(" ");
  const last = pts[pts.length - 1];
  return (
    <svg viewBox={`0 0 ${W} ${h}`} preserveAspectRatio="none" className={cn("block w-full overflow-visible", className)} style={{ height: h }} aria-hidden>
      <defs>
        <linearGradient id={id} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.22" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={`${d} L${W},${h} L0,${h} Z`} fill={`url(#${id})`} />
      <path d={d} fill="none" stroke={color} strokeWidth={2} vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeLinecap="round" />
      {dot && <circle cx={last[0]} cy={last[1]} r={3.5} fill="var(--surface)" stroke={color} strokeWidth={2} vectorEffect="non-scaling-stroke" />}
    </svg>
  );
}

function Stars({ value, size = 13 }: { value: number; size?: number }) {
  return (
    <span className="relative inline-flex text-line-strong" aria-label={`${value} out of 5 stars`}>
      {[0, 1, 2, 3, 4].map((i) => <Star key={i} size={size} className="fill-current" />)}
      <span className="absolute inset-0 inline-flex overflow-hidden text-warn" style={{ width: `${(value / 5) * 100}%` }}>
        {[0, 1, 2, 3, 4].map((i) => <Star key={i} size={size} className="shrink-0 fill-current" />)}
      </span>
    </span>
  );
}

const go = (href: string) => (e: React.MouseEvent) => {
  if (href.startsWith("#/")) return;
  e.preventDefault();
  document.querySelector(href)?.scrollIntoView({ behavior: "smooth", block: "start" });
};

function Tile({ href, className, children }: { href: string; className?: string; children: ReactNode }) {
  return (
    <a href={href} onClick={go(href)} className={cn("group relative block rounded-2xl border border-line bg-surface p-5 transition-[border-color,box-shadow] hover:border-line-strong hover:shadow-[0_8px_30px_-12px_rgba(0,0,0,0.15)]", className)}>
      {children}
    </a>
  );
}

function Label({ icon: Icon, children, right }: { icon: typeof Phone; children: ReactNode; right?: ReactNode }) {
  return (
    <div className="flex items-center gap-2 text-[12.5px] font-medium text-muted">
      <span className="grid size-6 place-items-center rounded-md bg-hover text-fg"><Icon size={13} /></span>
      <span className="flex-1">{children}</span>
      {right}
    </div>
  );
}

// ---------- Scorecard parts (shared by both layouts) ----------

const sheen = "linear-gradient(90deg, var(--sheen-a), var(--sheen-b), var(--sheen-c))";
const scoreOf = (d: P, key: string) => d.scores.find((s) => s.key === key)!.value;

function ScoreBar({ value, className }: { value: number; className?: string }) {
  return (
    <span className={cn("flex items-center gap-2", className)} title={`Score ${value} of 100`}>
      <span className="block h-1 flex-1 overflow-hidden rounded-full bg-hover"><span className="block h-full rounded-full" style={{ width: `${Math.max(3, value)}%`, background: sheen }} /></span>
      <span className="num w-6 text-right text-[11px] font-medium text-muted">{value}</span>
    </span>
  );
}

function ScoreSummary({ d, size = 72 }: { d: P; size?: number }) {
  return (
    <div className="flex items-center gap-4">
      <Ring value={d.overall} size={size} stroke={Math.round(size / 11)} gradient />
      <div>
        <div className="text-[12px] font-medium tracking-wide text-muted uppercase">Local presence score</div>
        <div className="mt-0.5 text-[13px] text-muted">Map pack, Google, website, reviews and AI answers in one number, out of 100.</div>
      </div>
    </div>
  );
}

function IssuesBar({ d }: { d: P }) {
  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-line bg-bg/50 px-6 py-3 text-[12.5px] text-muted">
      <span className="inline-flex items-center gap-1.5"><span className="size-1.5 rounded-full bg-bad" />{d.critical} critical site issues</span>
      <span className="inline-flex items-center gap-1.5"><span className="size-1.5 rounded-full bg-warn" />{d.unreplied} reviews to reply to</span>
      <span className="inline-flex items-center gap-1.5"><span className="size-1.5 rounded-full bg-good" />{d.up} keywords moved up this week</span>
      <Link to="/todo" className="ml-auto inline-flex items-center gap-1 font-medium text-fg hover:opacity-80">Fix these <ArrowRight size={13} /></Link>
    </div>
  );
}

// ---------- Story ----------

function Story({ d }: { d: P }) {
  const calls = d.outcomes[0];
  const rows: { href: string; icon: typeof Phone; label: string; score: string; value: ReactNode; sub: string; delta: ReactNode; spark: ReactNode }[] = [
    { href: "#keywords", icon: MapPin, label: "Map pack", score: "maps", value: `${d.solv.toFixed(0)}%`, sub: "of nearby searches, top 3", delta: <Delta v={d.solvDelta} suffix=" pts" digits={1} />, spark: <Area values={d.visTrend} h={26} dot={false} /> },
    { href: "#keywords", icon: TrendingUp, label: "Google search", score: "google", value: `${d.page1}/${d.total}`, sub: "keywords on page 1", delta: <span className="num text-[11.5px] font-medium"><span className="text-good">▲{d.up}</span> <span className="text-bad">▼{d.down}</span></span>, spark: <Area values={d.posTrend} h={26} invert color="var(--info)" dot={false} /> },
    { href: "#/ai", icon: Sparkles, label: "AI answers", score: "ai", value: `${d.ai.pct.toFixed(0)}%`, sub: "of answers name you", delta: <Delta v={d.aiDelta} suffix=" pts" />, spark: <Area values={d.ai.weekly} h={26} color="var(--sheen-c)" dot={false} /> },
    { href: "#health", icon: Activity, label: "Website", score: "site", value: String(d.health), sub: `${d.critical} critical to fix`, delta: <Delta v={d.healthDelta} suffix=" pts" />, spark: <Meter value={d.health} /> },
    { href: "#/profile", icon: Star, label: "Reviews", score: "reviews", value: `${d.rating}★`, sub: d.unreplied ? `${d.unreplied} waiting for a reply` : "all replied", delta: <span className="num text-[11.5px] text-muted">{d.velocity}/mo</span>, spark: <Meter value={(d.velocity / d.leader.reviewVelocity) * 100} tone="warn" /> },
  ];
  return (
    <section className="mb-6 overflow-hidden rounded-2xl border border-line bg-surface">
      <div className="grid lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
        <div className="relative p-6 sm:p-7">
          <div className="text-[12px] font-medium tracking-wide text-muted uppercase">Last 28 days</div>
          <p className="mt-2 max-w-xl font-serif text-[27px] leading-[1.2] tracking-tight">
            <span className="num">{fmt(calls.cur)}</span> people called you from Google, <span className={calls.pct >= 0 ? "text-good" : "text-bad"}>{calls.pct >= 0 ? "up" : "down"} {Math.abs(calls.pct).toFixed(0)}%</span>.
            <span className="text-muted"> You're in the top 3 for {d.solv.toFixed(0)}% of nearby searches, and AI assistants name you in {d.ai.pct.toFixed(0)}% of answers.</span>
          </p>
          <div className="mt-6">
            <div className="mb-1 flex items-baseline justify-between text-[12px] text-muted"><span>Customer actions per week · calls, directions, website</span><span className="num">{fmt(d.actionsCur)} total <Delta v={d.actionsPct} className="ml-1" /></span></div>
            <Area values={d.actionsWeeks} h={96} />
            <div className="mt-1 flex justify-between text-[11px] text-subtle"><span>8 weeks ago</span><span>This week</span></div>
          </div>
          <div className="mt-5 grid grid-cols-3 gap-4 border-t border-line pt-4">
            {d.outcomes.slice(1).map((m) => (
              <Link key={m.key} to="/profile" className="group">
                <div className="flex items-center gap-1.5 text-[12px] text-muted"><m.icon size={12} /> {m.label}</div>
                <div className="mt-0.5 flex items-baseline gap-1.5"><span className="num text-[20px] font-semibold tracking-tight">{fmt(m.cur)}</span><Delta v={m.pct} /></div>
              </Link>
            ))}
          </div>
        </div>
        <div className="border-t border-line bg-bg/60 lg:border-t-0 lg:border-l">
          <div className="border-b border-line px-6 py-5"><ScoreSummary d={d} /></div>
          <ul>
            {rows.map((r) => (
              <li key={r.label}>
                <a href={r.href} onClick={go(r.href)} className="grid grid-cols-[1fr_auto_88px] items-center gap-4 px-6 py-3 transition-colors hover:bg-hover/70">
                  <span className="flex min-w-0 items-center gap-2.5">
                    <span className="grid size-7 shrink-0 place-items-center rounded-lg border border-line bg-surface"><r.icon size={14} /></span>
                    <span className="min-w-0 flex-1"><span className="block text-[13.5px] font-medium">{r.label}</span><span className="block truncate text-[12px] text-muted">{r.sub}</span><ScoreBar value={scoreOf(d, r.score)} className="mt-1.5 max-w-[140px]" /></span>
                  </span>
                  <span className="text-right"><span className="num block text-[18px] leading-tight font-semibold tracking-tight">{r.value}</span>{r.delta}</span>
                  <span className="w-[88px]">{r.spark}</span>
                </a>
              </li>
            ))}
          </ul>
        </div>
      </div>
      <IssuesBar d={d} />
    </section>
  );
}

function Meter({ value, tone }: { value: number; tone?: "warn" }) {
  const v = Math.max(0, Math.min(100, value));
  const c = tone ?? (v >= 80 ? "good" : v >= 60 ? "warn" : "bad");
  return <span className="block h-1.5 overflow-hidden rounded-full bg-hover"><span className={cn("block h-full rounded-full", { good: "bg-good", warn: "bg-warn", bad: "bg-bad" }[c])} style={{ width: `${v}%` }} /></span>;
}

function Ring({ value, size = 64, stroke = 6, gradient = false }: { value: number; size?: number; stroke?: number; gradient?: boolean }) {
  const id = useId();
  const r = (size - stroke) / 2, c = 2 * Math.PI * r;
  const color = value >= 80 ? "var(--good)" : value >= 60 ? "var(--warn)" : "var(--bad)";
  return (
    <span className="relative inline-grid shrink-0 place-items-center" style={{ width: size, height: size }} role="img" aria-label={`Score ${value} of 100`}>
      <svg width={size} height={size} className="-rotate-90">
        {gradient && <defs><linearGradient id={id} x1="0" x2="1" y1="0" y2="1"><stop offset="0%" stopColor="var(--sheen-a)" /><stop offset="55%" stopColor="var(--sheen-b)" /><stop offset="100%" stopColor="var(--sheen-c)" /></linearGradient></defs>}
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--hover)" strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={gradient ? `url(#${id})` : color} strokeWidth={stroke} strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - value / 100)} />
      </svg>
      <span className="num absolute font-semibold tracking-tight" style={{ fontSize: size * 0.3 }}>{value}</span>
    </span>
  );
}

// ---------- Ledger ----------

function Ledger({ d }: { d: P }) {
  const top: { href: string; label: string; score: string; value: ReactNode; delta: ReactNode; note: string; spark: ReactNode }[] = [
    { href: "#keywords", label: "Map pack visibility", score: "maps", value: <>{d.solv.toFixed(0)}<small>%</small></>, delta: <Delta v={d.solvDelta} suffix=" pts" digits={1} />, note: "top 3, nearby searches", spark: <Area values={d.visTrend} h={34} dot={false} /> },
    { href: "#keywords", label: "Keywords on page 1", score: "google", value: <>{d.page1}<small>/{d.total}</small></>, delta: <span className="num text-[11.5px] font-medium"><span className="text-good">▲{d.up}</span> <span className="text-bad">▼{d.down}</span></span>, note: `${d.inPack} in the map pack`, spark: <Area values={d.posTrend} h={34} invert color="var(--info)" dot={false} /> },
    { href: "#/ai", label: "AI answers", score: "ai", value: <>{d.ai.pct.toFixed(0)}<small>%</small></>, delta: <Delta v={d.aiDelta} suffix=" pts" />, note: "of answers name you", spark: <Area values={d.ai.weekly} h={34} color="var(--sheen-c)" dot={false} /> },
    { href: "#health", label: "Website health", score: "site", value: d.health, delta: <Delta v={d.healthDelta} suffix=" pts" />, note: `${d.critical} critical · LCP ${d.lcp}s`, spark: <div className="flex h-[34px] flex-col justify-end"><Meter value={d.health} /></div> },
    { href: "#/profile", label: "Rating", score: "reviews", value: <>{d.rating}<small>★</small></>, delta: <span className="num text-[11.5px] text-muted">{fmt(d.reviewCount)} reviews</span>, note: d.unreplied ? `${d.unreplied} waiting for a reply` : "all replied", spark: <div className="flex h-[34px] items-end"><Stars value={d.rating} size={15} /></div> },
  ];
  return (
    <section className="mb-6 overflow-hidden rounded-2xl border border-line bg-surface [&_small]:ml-0.5 [&_small]:text-[0.5em] [&_small]:font-normal [&_small]:text-muted">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-line px-5 py-4">
        <ScoreSummary d={d} size={60} />
        <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-[12.5px] text-muted">
          <span className="inline-flex items-center gap-1.5"><span className="size-1.5 rounded-full bg-bad" />{d.critical} critical site issues</span>
          <span className="inline-flex items-center gap-1.5"><span className="size-1.5 rounded-full bg-warn" />{d.unreplied} reviews to reply to</span>
          <Link to="/todo" className="inline-flex items-center gap-1 font-medium text-fg hover:opacity-80">Fix these <ArrowRight size={13} /></Link>
        </div>
      </div>
      <div className="grid grid-cols-2 divide-line max-lg:[&>*:nth-child(n+3)]:border-t sm:grid-cols-3 lg:grid-cols-5 lg:divide-x">
        {top.map((c) => (
          <a key={c.label} href={c.href} onClick={go(c.href)} className="group block border-line p-5 transition-colors hover:bg-hover/50 max-lg:border-r">
            <div className="text-[12px] text-muted">{c.label}</div>
            <div className="num mt-2 font-serif text-[40px] leading-none tracking-tight">{c.value}</div>
            <div className="mt-2 flex items-center gap-2">{c.delta}</div>
            <div className="mt-4">{c.spark}</div>
            <div className="mt-1.5 truncate text-[11.5px] text-subtle">{c.note}</div>
            <div className="mt-3 flex items-center gap-2 border-t border-dashed border-line pt-3 text-[11px] text-subtle">Score <ScoreBar value={scoreOf(d, c.score)} className="flex-1" /></div>
          </a>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-x-8 gap-y-3 border-t border-line bg-bg/60 px-5 py-3.5">
        <span className="text-[12px] font-medium tracking-wide text-muted uppercase">From Google · 28 days</span>
        {d.outcomes.map((m) => (
          <Link key={m.key} to="/profile" className="inline-flex items-baseline gap-2 hover:opacity-80">
            <span className="text-[12.5px] text-muted">{m.label}</span>
            <span className="num text-[16px] font-semibold">{fmt(m.cur)}</span>
            <Delta v={m.pct} />
          </Link>
        ))}
      </div>
    </section>
  );
}

// ---------- Entry ----------

export function CommandTop({ variant, state }: { variant: TopVariant; state: Record<string, string> }) {
  const d = pulseData(state);
  return (
    <div key={variant} className="anim-fade">
      {variant === "story" && <Story d={d} />}
      {variant === "ledger" && <Ledger d={d} />}
    </div>
  );
}
