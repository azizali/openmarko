import { useId, useState, type ReactNode } from "react";
import { BarChart3, Check, Eye, ListChecks, MapPin, MessageSquare, RotateCcw, Sparkles, Star, Wrench, Globe, Phone, Mail, Flame } from "lucide-react";
import { cn } from "./ui";
import { LogoMark } from "./Logo";

// ---------- Geo-grid ----------

/** Deterministic grid of map-pack ranks. Higher strength = more points in the top 3. */
export function rankGrid(strength: number, size = 7, seed = 1): number[] {
  const mid = (size - 1) / 2;
  return Array.from({ length: size * size }, (_, i) => {
    const r = Math.floor(i / size), c = i % size;
    const d = Math.hypot(r - mid, c - mid) / Math.hypot(mid, mid);
    const noise = (Math.sin((i + 1) * 12.9898 * seed) * 43758.5453) % 1;
    const weak = Math.pow(1 - strength, 1.5);
    const rank = 1 + d * 22 * weak + Math.abs(noise) * 3 * (1 - strength);
    return Math.max(1, Math.round(rank));
  });
}

const rankColor = (r: number) => (r <= 3 ? "var(--rank-1)" : r <= 6 ? "var(--rank-2)" : r <= 10 ? "var(--rank-3)" : r <= 15 ? "var(--rank-4)" : "var(--rank-5)");

function MapBackdrop() {
  return (
    <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 h-full w-full" aria-hidden>
      <rect width="100" height="100" fill="var(--map-land)" />
      <path d="M-5 72 C 20 64, 34 80, 58 70 S 92 58, 105 64 L105 76 C 90 70, 70 84, 56 82 S 20 76, -5 84Z" fill="var(--map-water)" />
      <rect x="62" y="12" width="20" height="16" rx="3" fill="var(--map-park)" />
      <rect x="8" y="30" width="14" height="12" rx="3" fill="var(--map-park)" />
      <g stroke="var(--map-road)" strokeWidth="2.4" fill="none">
        <path d="M0 22 H100" /><path d="M0 50 H100" /><path d="M30 0 V100" /><path d="M70 0 V100" />
        <path d="M0 95 L100 5" strokeWidth="3.2" />
      </g>
    </svg>
  );
}

export function GeoGrid({ strength, size = 7, seed = 1, className, label }: { strength: number; size?: number; seed?: number; className?: string; label?: string }) {
  const ranks = rankGrid(strength, size, seed);
  const top3 = ranks.filter((r) => r <= 3).length;
  return (
    <figure className={cn("relative aspect-square w-full overflow-hidden rounded-xl border border-line", className)} role="img" aria-label={`${label ?? "Map grid"}: top 3 at ${top3} of ${ranks.length} points`}>
      <MapBackdrop />
      <div className="absolute inset-[6%] grid" style={{ gridTemplateColumns: `repeat(${size}, 1fr)` }}>
        {ranks.map((r, i) => (
          <div key={i} className="grid place-items-center">
            <span className="rise num grid aspect-square w-[78%] max-w-9 place-items-center rounded-full text-[clamp(8px,1.6vw,12px)] font-semibold text-white shadow-sm ring-2 ring-white/70 dark:ring-black/40"
              style={{ background: rankColor(r), animationDelay: `${(i % size + Math.floor(i / size)) * 35}ms` }}>
              {r > 20 ? "20+" : r}
            </span>
          </div>
        ))}
      </div>
      <span className="absolute top-1/2 left-1/2 grid size-[9%] -translate-x-1/2 -translate-y-[85%] place-items-center rounded-full bg-surface shadow-md">
        <LogoMark size={16} />
      </span>
      {label && <figcaption className="absolute bottom-2 left-2 rounded-md bg-surface/90 px-2 py-1 text-[11.5px] font-medium backdrop-blur">{label}</figcaption>}
    </figure>
  );
}

export function GridLegend() {
  const items = [["1–3", 1], ["4–6", 5], ["7–10", 8], ["11–15", 12], ["16+", 18]] as const;
  return (
    <div className="flex flex-wrap gap-x-3 gap-y-1 text-[12px] text-muted">
      {items.map(([l, r]) => <span key={l} className="inline-flex items-center gap-1"><span className="size-2.5 rounded-full" style={{ background: rankColor(r) }} />{l}</span>)}
    </div>
  );
}

// ---------- Frames ----------

export function AppFrame({ children, url = "app.openmarko.com", className }: { children: ReactNode; url?: string; className?: string }) {
  return (
    <div className={cn("overflow-hidden rounded-2xl border border-line bg-surface shadow-float", className)}>
      <div className="flex items-center gap-2 border-b border-line bg-sunken px-4 py-2.5">
        <span className="flex gap-1.5" aria-hidden>{[0, 1, 2].map((i) => <span key={i} className="size-2.5 rounded-full bg-line-strong" />)}</span>
        <span className="mx-auto rounded-md bg-surface px-3 py-0.5 font-mono text-[11.5px] text-muted">{url}</span>
        <span className="w-[42px]" />
      </div>
      {children}
    </div>
  );
}

/** Tilted callout stuck onto a visual. */
export function Sticker({ label, value, icon, className, tone = "accent" }: { label: string; value: string; icon?: ReactNode; className?: string; tone?: "accent" | "good" }) {
  return (
    <div className={cn("sticker flex items-center gap-2.5 rounded-lg border-2 border-ink bg-surface px-3 py-2", className)}>
      <span className={cn("grid size-7 place-items-center rounded-md", tone === "good" ? "bg-good-soft text-good" : "bg-accent-soft text-accent")}>{icon}</span>
      <span className="leading-tight"><span className="block font-mono text-[10.5px] tracking-wider text-muted uppercase">{label}</span><span className="text-[14px] font-semibold">{value}</span></span>
    </div>
  );
}

// ---------- Panels (shared by hero tabs, service pages and steps) ----------

const competitors = [
  { name: "Lone Star Plumbing", avg: 2.1 },
  { name: "Capitol Drain Co.", avg: 3.4 },
  { name: "Carter Plumbing & Drain", avg: 3.7, you: true },
  { name: "Eastside Rooter", avg: 7.9 },
];

export function MapPanel({ strength = 0.7 }: { strength?: number }) {
  const ranks = rankGrid(strength);
  const before = rankGrid(0.25);
  const top3 = ranks.filter((r) => r <= 3).length;
  const top3Before = before.filter((r) => r <= 3).length;
  const avg = (g: number[]) => g.reduce((a, r) => a + Math.min(r, 21), 0) / g.length;
  return (
    <div className="grid gap-5 p-5 md:grid-cols-[1.1fr_1fr]">
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2 text-[12.5px]">
          <span className="rounded-full border border-line px-2.5 py-0.5 font-medium">plumber</span>
          <span className="text-muted">7×7 grid · 3 mi · scanned today</span>
        </div>
        <GeoGrid strength={strength} />
        <GridLegend />
      </div>
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-3">
          <Kpi label="Top 3 coverage" value={`${top3}/49`} delta={top3 > top3Before ? `up from ${top3Before}` : "first scan"} />
          <Kpi label="Average rank" value={avg(ranks).toFixed(1)} delta={top3 > top3Before ? `was ${avg(before).toFixed(1)}` : "8 weeks of history"} />
        </div>
        <div className="rounded-xl border border-line">
          <div className="border-b border-line px-4 py-2.5 text-[12.5px] font-medium text-muted">Who ranks across this grid</div>
          {competitors.map((c, i) => (
            <div key={c.name} className={cn("flex items-center gap-3 px-4 py-2.5 text-[13.5px]", i > 0 && "border-t border-line", c.you && "bg-accent-soft/50")}>
              <span className="num w-4 text-muted">{i + 1}</span>
              <span className={cn("flex-1 truncate", c.you && "font-medium")}>{c.name}{c.you && <span className="ml-1.5 text-[11.5px] text-accent">You</span>}</span>
              <span className="num text-muted">avg #{c.avg}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Kpi({ label, value, delta }: { label: string; value: string; delta: string }) {
  return (
    <div className="rounded-xl border border-line p-3.5">
      <div className="text-[12px] text-muted">{label}</div>
      <div className="num mt-1 font-serif text-[28px] leading-none">{value}</div>
      <div className="mt-1.5 text-[12px] font-medium text-good">{delta}</div>
    </div>
  );
}

const tasks = [
  { title: "Add 4 secondary categories", why: "All top 3 use “Drainage service”", area: "Profile", mins: "2 min", impact: "High" },
  { title: "Add LocalBusiness schema", why: "Missing on 4 of 4 key pages", area: "Website", mins: "1 min", impact: "High" },
  { title: "Reply to 3 new reviews", why: "Drafts ready in your voice", area: "Reviews", mins: "1 min", impact: "Medium" },
  { title: "Rewrite homepage title tag", why: "“plumber” missing from title", area: "Website", mins: "1 min", impact: "Medium" },
  { title: "Publish weekly post", why: "Last post was 34 days ago", area: "Profile", mins: "1 min", impact: "Low" },
];

export function TodoPanel() {
  const [done, setDone] = useState<Set<number>>(new Set([0]));
  return (
    <div className="p-5">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <div className="text-[15px] font-medium">Up next for “plumber”</div>
          <div className="text-[12.5px] text-muted">Ranked by how much each fix closes the gap to the top 3</div>
        </div>
        <span className="num rounded-full bg-good-soft px-2.5 py-1 text-[12px] font-medium text-good">{done.size} of {tasks.length} done</span>
      </div>
      <ul className="divide-y divide-line rounded-xl border border-line">
        {tasks.map((t, i) => {
          const on = done.has(i);
          return (
            <li key={t.title} className="flex items-center gap-3 px-4 py-3">
              <span className={cn("grid size-5 shrink-0 place-items-center rounded-full border transition-colors", on ? "border-good bg-good text-white" : "border-line-strong")}>{on && <Check size={12} strokeWidth={3} />}</span>
              <div className="min-w-0 flex-1">
                <div className={cn("truncate text-[14px] font-medium", on && "text-muted line-through")}>{t.title}</div>
                <div className="truncate text-[12.5px] text-muted">{t.why} · {t.area} · {t.mins}</div>
              </div>
              <span className={cn("hidden rounded-full px-2 py-0.5 text-[11.5px] font-medium sm:inline", t.impact === "High" ? "bg-accent-soft text-accent" : t.impact === "Medium" ? "bg-warn-soft text-warn" : "bg-hover text-muted")}>{t.impact}</span>
              <button
                onClick={() => setDone((s) => { const n = new Set(s); n.has(i) ? n.delete(i) : n.add(i); return n; })}
                className={cn("h-8 shrink-0 rounded-md px-3 text-[13px] font-medium transition-colors", on ? "border border-line text-muted hover:bg-hover" : "bg-ink text-on-ink hover:opacity-85")}
                aria-pressed={on}
              >{on ? "Undo" : "Apply"}</button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function FixPanel() {
  const lines: [string, string][] = [
    [" ", `<script type="application/ld+json">`],
    ["+", `  "@type": "Plumber",`],
    ["+", `  "name": "Carter Plumbing & Drain",`],
    ["+", `  "areaServed": ["Austin", "Round Rock"],`],
    ["+", `  "aggregateRating": { "ratingValue": 4.7 },`],
    [" ", `</script>`],
    ["-", `<title>Home | Carter</title>`],
    ["+", `<title>Plumber in Austin, TX | Carter Plumbing</title>`],
  ];
  return (
    <div className="flex flex-col gap-4 p-5">
      <div className="flex flex-wrap items-center gap-3">
        <span className="grid size-9 place-items-center rounded-lg bg-accent-soft text-accent"><Wrench size={17} /></span>
        <div className="min-w-0 flex-1">
          <div className="text-[15px] font-medium">Add LocalBusiness schema and fix the title</div>
          <div className="text-[12.5px] text-muted">carterplumbing.com · homepage · affects 4 tracked keywords</div>
        </div>
        <span className="inline-flex items-center gap-1 rounded-full bg-good-soft px-2.5 py-1 text-[12px] font-medium text-good"><Check size={13} /> Applied</span>
      </div>
      <pre className="overflow-x-auto rounded-xl border border-line bg-sunken p-4 font-mono text-[12.5px] leading-6">
        {lines.map(([k, l], i) => (
          <div key={i} className={cn("-mx-4 px-4", k === "+" && "bg-good-soft text-good", k === "-" && "bg-bad-soft text-bad")}>
            <span className="mr-3 inline-block w-3 select-none opacity-60">{k}</span>{l}
          </div>
        ))}
      </pre>
      <div className="flex items-center gap-2 text-[12.5px] text-muted"><RotateCcw size={13} /> Revision saved in WordPress. Roll back any time.</div>
    </div>
  );
}

export function ReviewsPanel() {
  const [sent, setSent] = useState(false);
  return (
    <div className="flex flex-col gap-3 p-5">
      <div className="rounded-xl border border-line p-4">
        <div className="flex items-center gap-3">
          <span className="grid size-9 place-items-center rounded-full bg-info-soft text-[13px] font-semibold text-info">JM</span>
          <div className="flex-1">
            <div className="text-[14px] font-medium">Jordan M.</div>
            <div className="flex items-center gap-0.5 text-warn" aria-label="5 stars">{Array.from({ length: 5 }, (_, i) => <Star key={i} size={12} fill="currentColor" />)}<span className="ml-1.5 text-[12px] text-muted">12 minutes ago</span></div>
          </div>
        </div>
        <p className="mt-3 text-[14px]">Luis showed up within the hour on a Sunday and had our water heater working again by lunch. Fair price, cleaned up after himself.</p>
      </div>
      <div className="ml-6 rounded-xl border border-accent/30 bg-accent-soft/40 p-4">
        <div className="mb-2 flex items-center gap-1.5 text-[12.5px] font-medium text-accent"><Sparkles size={13} /> Draft reply, in your voice</div>
        <p className="text-[14px]">Thanks Jordan! A Sunday water-heater emergency is no fun, so we're glad Luis got you sorted before lunch. We'll pass your kind words on to him.</p>
        <div className="mt-3 flex gap-2">
          <button onClick={() => setSent(true)} className={cn("h-8 rounded-md px-3 text-[13px] font-medium", sent ? "bg-good-soft text-good" : "bg-ink text-on-ink hover:opacity-85")}>{sent ? "Posted to Google" : "Approve & post"}</button>
          {!sent && <button className="h-8 rounded-md border border-line px-3 text-[13px] text-muted hover:bg-hover">Edit</button>}
        </div>
      </div>
    </div>
  );
}

export function ReportPanel() {
  const weeks = [21, 24, 19, 23, 22, 26, 31, 34, 33, 38, 41, 44];
  const max = Math.max(...weeks);
  return (
    <div className="flex flex-col gap-4 p-5">
      <div className="grid grid-cols-3 gap-3">
        <Kpi label="Calls from Google" value="184" delta="+41%" />
        <Kpi label="Direction requests" value="312" delta="+18%" />
        <Kpi label="Website clicks" value="421" delta="+9%" />
      </div>
      <div className="rounded-xl border border-line p-4">
        <div className="mb-3 flex items-center justify-between text-[12.5px] text-muted"><span>Calls per week</span><span className="inline-flex items-center gap-1.5"><span className="size-2 rounded-full bg-accent" /> Started OpenMarko</span></div>
        <div className="flex h-36 items-end gap-1.5" role="img" aria-label="Calls per week rising from 21 to 44 over 12 weeks">
          {weeks.map((w, i) => (
            <div key={i} className="relative flex-1">
              {i === 5 && <span className="absolute -top-5 left-1/2 h-[calc(100%+20px)] w-px -translate-x-1/2 bg-accent/50" />}
              <div className={cn("rounded-t-sm", i >= 5 ? "bg-accent" : "bg-line-strong")} style={{ height: `${(w / max) * 136}px` }} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function ProfilePanel() {
  const rows = [
    { f: "Categories", you: 1, lead: 5 },
    { f: "Photos", you: 12, lead: 86 },
    { f: "Reviews (last 90 days)", you: 9, lead: 41 },
    { f: "Posts (last 30 days)", you: 0, lead: 4 },
    { f: "Services listed", you: 3, lead: 14 },
  ];
  return (
    <div className="flex flex-col gap-3 p-5">
      <div className="flex items-center justify-between text-[12.5px] text-muted"><span>You vs the top 3 average</span><span className="inline-flex items-center gap-3"><span className="inline-flex items-center gap-1"><span className="size-2 rounded-full bg-accent" />You</span><span className="inline-flex items-center gap-1"><span className="size-2 rounded-full bg-line-strong" />Top 3</span></span></div>
      {rows.map((r) => (
        <div key={r.f} className="grid grid-cols-[1fr_2fr] items-center gap-3 text-[13.5px]">
          <span>{r.f}</span>
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2"><div className="h-2 rounded-full bg-accent" style={{ width: `${Math.max(3, (r.you / r.lead) * 100)}%` }} /><span className="num text-[12px] text-muted">{r.you}</span></div>
            <div className="flex items-center gap-2"><div className="h-2 w-full rounded-full bg-line-strong" /><span className="num text-[12px] text-muted">{r.lead}</span></div>
          </div>
        </div>
      ))}
      <div className="mt-1 flex items-center gap-2 rounded-lg bg-accent-soft/50 px-3 py-2 text-[13px]"><Sparkles size={14} className="text-accent" /> 4 categories and 11 services are ready to add from your To-do.</div>
    </div>
  );
}

const engines = [
  { name: "Google AI Overviews", status: "#2 recommended", ok: true },
  { name: "ChatGPT", status: "#3 recommended", ok: true },
  { name: "Gemini", status: "Not mentioned", ok: false },
  { name: "Perplexity", status: "#1 recommended", ok: true },
];

export function AiPanel() {
  return (
    <div className="flex flex-col gap-3 p-5">
      <div className="rounded-xl border border-line bg-sunken px-4 py-3 text-[14px]"><span className="text-muted">Asked:</span> “Who's the best emergency plumber near Hyde Park, Austin?”</div>
      <ul className="divide-y divide-line rounded-xl border border-line">
        {engines.map((e) => (
          <li key={e.name} className="flex items-center gap-3 px-4 py-2.5 text-[13.5px]">
            <span className={cn("size-2 rounded-full", e.ok ? "bg-good" : "bg-bad")} />
            <span className="flex-1">{e.name}</span>
            <span className={cn("font-medium", e.ok ? "text-good" : "text-bad")}>{e.status}</span>
          </li>
        ))}
      </ul>
      <div className="text-[12.5px] text-muted">Gemini cited instead: <span className="rounded border border-line px-1.5">yelp.com</span> <span className="rounded border border-line px-1.5">angi.com</span> <span className="rounded border border-line px-1.5">lonestarplumbing.com</span></div>
    </div>
  );
}

const prospects = [
  { name: "Northside Heating & Air", rank: 7, rating: 4.8, score: 91, contact: "Owner email + mobile" },
  { name: "Hill Country HVAC", rank: 5, rating: 4.6, score: 86, contact: "Owner email" },
  { name: "Mueller Comfort Co.", rank: 11, rating: 4.4, score: 74, contact: "Office line" },
  { name: "ATX Air Pros", rank: 2, rating: 4.9, score: 38, contact: "Owner email" },
];

export function ProspectPanel() {
  return (
    <div className="p-5">
      <div className="mb-3 flex flex-wrap items-center gap-2 text-[12.5px]">
        <span className="rounded-full border border-line px-2.5 py-0.5 font-medium">HVAC</span>
        <span className="rounded-full border border-line px-2.5 py-0.5 font-medium">within 15 mi of Austin</span>
        <span className="text-muted">48 found · 9 hot</span>
      </div>
      <div className="overflow-x-auto rounded-xl border border-line">
        <table className="w-full min-w-[480px] text-[13.5px]">
          <thead className="border-b border-line text-left text-[12px] text-muted">
            <tr><th className="px-4 py-2 font-normal">Business</th><th className="px-2 py-2 font-normal">Map rank</th><th className="px-2 py-2 font-normal">Ease of sale</th><th className="px-4 py-2 font-normal">Contact</th></tr>
          </thead>
          <tbody>
            {prospects.map((p) => (
              <tr key={p.name} className="border-b border-line last:border-0">
                <td className="px-4 py-2.5"><div className="font-medium">{p.name}</div><div className="text-[12px] text-muted">{p.rating}★</div></td>
                <td className="num px-2 py-2.5">#{p.rank}</td>
                <td className="px-2 py-2.5"><span className={cn("num inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[12px] font-medium", p.score >= 80 ? "bg-accent-soft text-accent" : p.score >= 60 ? "bg-warn-soft text-warn" : "bg-hover text-muted")}>{p.score >= 80 && <Flame size={11} />}{p.score}</span></td>
                <td className="px-4 py-2.5 text-[12.5px] text-muted">{p.contact}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function AuditViewedToast({ className }: { className?: string }) {
  return (
    <div className={cn("flex w-72 items-start gap-3 rounded-xl border border-line bg-surface p-3.5 shadow-float", className)}>
      <span className="relative grid size-8 shrink-0 place-items-center rounded-full bg-good-soft text-good"><Eye size={15} /><span className="ping absolute inset-0 text-good/30" /></span>
      <div className="text-[13px]">
        <div><b className="font-medium">Northside Heating & Air</b> opened your audit</div>
        <div className="text-muted">3rd view · scrolled to “Missed revenue”</div>
        <div className="mt-2 flex gap-1.5"><span className="inline-flex items-center gap-1 rounded-md bg-ink px-2 py-1 text-[12px] text-on-ink"><Phone size={11} />Call now</span><span className="inline-flex items-center gap-1 rounded-md border border-line px-2 py-1 text-[12px]"><Mail size={11} />Follow up</span></div>
      </div>
    </div>
  );
}

export function PostPanel() {
  return (
    <div className="flex flex-col gap-3 p-5">
      <div className="overflow-hidden rounded-xl border border-line">
        <div className="grid h-28 place-items-center bg-gradient-to-br from-accent-soft to-info-soft"><Globe size={28} className="text-accent" /></div>
        <div className="p-4">
          <div className="text-[12px] text-muted">Google post · scheduled Tue 9:00</div>
          <p className="mt-1 text-[14px]">Freezing nights are coming. Book a $79 heating tune-up this week and we'll check your carbon monoxide detectors for free.</p>
        </div>
      </div>
      <div className="flex items-center gap-2 text-[12.5px] text-good"><Check size={14} /> Last 6 posts went live. We check each one.</div>
    </div>
  );
}

// ---------- Hero product window with Chatwoot-style tabs ----------

const heroTabs = [
  { id: "map", label: "Map grid", icon: MapPin, panel: () => <MapPanel /> },
  { id: "todo", label: "To-do", icon: ListChecks, panel: () => <TodoPanel /> },
  { id: "fix", label: "Site fixes", icon: Wrench, panel: () => <FixPanel /> },
  { id: "reviews", label: "Reviews", icon: MessageSquare, panel: () => <ReviewsPanel /> },
  { id: "report", label: "Results", icon: BarChart3, panel: () => <ReportPanel /> },
] as const;

export function HeroProduct() {
  const [tab, setTab] = useState<(typeof heroTabs)[number]["id"]>("map");
  const id = useId();
  const cur = heroTabs.find((t) => t.id === tab)!;
  return (
    <div className="relative">
      <div role="tablist" aria-label="Product views" className="mb-3 grid grid-cols-5 gap-1 rounded-xl border border-line bg-surface p-1 shadow-card">
        {heroTabs.map((t) => (
          <button key={t.id} role="tab" id={`${id}-${t.id}`} aria-selected={tab === t.id} aria-controls={`${id}-panel`} onClick={() => setTab(t.id)}
            className={cn("flex items-center justify-center gap-2 rounded-lg px-2 py-2.5 text-[13px] font-medium transition-colors sm:text-[14px]",
              tab === t.id ? "bg-ink text-on-ink" : "text-muted hover:bg-hover hover:text-fg")}>
            <t.icon size={16} className="shrink-0" /><span className="hidden sm:inline">{t.label}</span>
          </button>
        ))}
      </div>
      <AppFrame url={`app.openmarko.com/${tab}`}>
        <div role="tabpanel" id={`${id}-panel`} aria-labelledby={`${id}-${tab}`} className="min-h-[420px]" key={tab}>
          <div className="rise">{cur.panel()}</div>
        </div>
      </AppFrame>
      <Sticker label="Map pack" value="#9 → #3" icon={<MapPin size={15} />} tone="good" className="absolute top-24 -right-6 hidden rotate-3 lg:flex" />
      <Sticker label="Ready to apply" value="6 fixes" icon={<Sparkles size={15} />} className="absolute -bottom-5 -left-4 hidden -rotate-2 lg:flex" />
    </div>
  );
}

export const panelFor = { grid: MapPanel, fixes: FixPanel, profile: ProfilePanel, reviews: ReviewsPanel, ai: AiPanel, prospects: ProspectPanel } as const;
