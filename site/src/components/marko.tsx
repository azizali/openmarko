import { useEffect, useRef, useState, type ReactNode } from "react";
import { ArrowRight, ArrowUp, BarChart3, Check, FileSearch, FileText, Globe, Link2, MapPin, MessageSquare, Mic, Play, RotateCcw, Search, Sparkles, Star, Store, Swords, Wrench, X as XIcon } from "lucide-react";
import { Link } from "react-router";
import { cn } from "./ui";
import { Mine, usePersona } from "./persona";
import { versus, type Channel, type Job, type Presence } from "../data/antiAgency";

// ---------- Scroll helpers ----------

/** True once the element has scrolled into view. Starts true when IntersectionObserver is missing. */
export function useInView<T extends Element>(margin = "0px 0px -15% 0px") {
  const ref = useRef<T>(null);
  const [inView, setInView] = useState(typeof IntersectionObserver === "undefined");
  useEffect(() => {
    const el = ref.current;
    if (!el || inView) return;
    const io = new IntersectionObserver(([e]) => e.isIntersecting && setInView(true), { rootMargin: margin });
    io.observe(el);
    return () => io.disconnect();
  }, [inView, margin]);
  return [ref, inView] as const;
}

/** Index of the step nearest the middle of the viewport, for sticky scroll stories. */
export function useActiveStep(count: number) {
  const refs = useRef<(HTMLElement | null)[]>([]);
  const [active, setActive] = useState(0);
  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => e.isIntersecting && setActive(Number((e.target as HTMLElement).dataset.step))),
      { rootMargin: "-45% 0px -45% 0px" },
    );
    refs.current.slice(0, count).forEach((el) => el && io.observe(el));
    return () => io.disconnect();
  }, [count]);
  const bind = (i: number) => ({ "data-step": i, ref: (el: HTMLElement | null) => { refs.current[i] = el; } });
  return [active, bind] as const;
}

/** The page's one motion idea: a brand-pink line drawn through what an agency sells. */
export function Strike({ children, on, delay = 0, className }: { children: ReactNode; on: boolean; delay?: number; className?: string }) {
  return <span className={cn("strike", className)} data-on={on || undefined} style={delay ? { ["--strike-delay" as string]: `${delay}ms` } : undefined}>{children}</span>;
}

export function MarkoAvatar({ size = 28 }: { size?: number }) {
  return (
    <span className="grid shrink-0 place-items-center rounded-full bg-accent-soft text-accent" style={{ width: size, height: size }} aria-hidden>
      <Sparkles size={size * 0.5} />
    </span>
  );
}

export const jobIcons: Record<Job["id"], typeof MapPin> = { competitors: Swords, reviews: MessageSquare, profile: Store, audit: Wrench, pages: FileSearch, links: Link2, ai: Sparkles, citations: Globe, report: BarChart3 };

// ---------- Search results mock: AI answer, map pack, organic results for one keyword ----------


function YouTag({ n }: { n?: number }) {
  return <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-accent px-1.5 py-px text-[10.5px] font-semibold text-white">{n && <span className="num">{n}</span>}You</span>;
}

function Stars({ r }: { r: number }) {
  return <span className="inline-flex items-center gap-0.5 text-warn"><span className="num text-[11.5px] text-muted">{r}</span><Star size={10} fill="currentColor" /></span>;
}

/** Where the business appears for one search. With `labels`, numbered tags mark the three places. */
export function SerpMock({ p, focus, labels = false, className }: { p: Presence; focus?: Channel | "all"; labels?: boolean; className?: string }) {
  const me = usePersona().p;
  const { you, rivals } = me;
  const dim = (c: Channel) => (focus && focus !== "all" && focus !== c ? "opacity-35" : "");
  const pack = p.maps <= 3 ? [...rivals.slice(0, p.maps - 1), you, ...rivals.slice(p.maps - 1)].slice(0, 3) : rivals;
  const organicTop = p.google <= 3 ? [...rivals.slice(0, p.google - 1), you, ...rivals.slice(p.google - 1)].slice(0, 3) : rivals.slice(0, 2);
  const block = "transition-opacity duration-500";
  return (
    <div className={cn("overflow-hidden rounded-2xl border border-line bg-surface shadow-float", className)}>
      <div className="flex items-center gap-2 border-b border-line px-4 py-3">
        <div className="flex h-9 flex-1 items-center gap-2 rounded-full border border-line bg-bg px-3.5 text-[13.5px]">
          <Search size={14} className="shrink-0 text-muted" /><span className="flex-1 truncate"><Mine>{me.keyword}</Mine></span><Mic size={14} className="shrink-0 text-muted" />
        </div>
      </div>
      <div className="flex gap-4 border-b border-line px-5 text-[12px] text-muted">
        {["All", "Maps", "Images", "News"].map((t, i) => <span key={t} className={cn("py-2", i === 0 && "border-b-2 border-fg font-medium text-fg")}>{t}</span>)}
      </div>

      <div className="flex flex-col gap-3 p-4">
        {/* AI answer */}
        <div className={cn(block, dim("ai"), "rounded-xl bg-sunken p-3.5")}>
          <div className="mb-1.5 flex items-center justify-between">
            <span className="inline-flex items-center gap-1.5 text-[12px] font-medium"><Sparkles size={13} className="text-info" />AI Overview</span>
            {labels && p.ai && <YouTag n={1} />}
          </div>
          <p className="text-[12.5px] leading-relaxed">
            {p.ai
              ? <>Top-rated {me.trade.plural} in <Mine>{me.city}</Mine> include <mark className="rounded bg-accent-soft px-0.5 font-semibold text-fg">{you.name}</mark> (4.8★, {me.isSample ? "24/7 emergency service" : "212 reviews"}), {rivals[0].name} and {rivals[1].name.replace(/\.$/, "")}.</>
              : <>Top-rated {me.trade.plural} in <Mine>{me.city}</Mine> include {rivals[0].name} (4.6★), {rivals[1].name} and {rivals[2].name}, according to Yelp and Angi.</>}
          </p>
          <div className="mt-2 flex flex-wrap gap-1">
            {(p.ai ? [you.domain, "yelp.com", "bbb.org"] : ["yelp.com", "angi.com", rivals[0].domain]).map((d) => (
              <span key={d} className={cn("rounded-md border px-1.5 py-px text-[10.5px]", d === you.domain ? "border-accent/40 bg-accent-soft/60 text-fg" : "border-line bg-surface text-muted")}>{d}</span>
            ))}
          </div>
        </div>

        {/* Map pack */}
        <div className={cn(block, dim("maps"), "overflow-hidden rounded-xl border border-line")}>
          <div className="relative h-20 bg-[var(--map-land)]" aria-hidden>
            <svg viewBox="0 0 300 80" preserveAspectRatio="none" className="absolute inset-0 h-full w-full">
              <path d="M0 58 C 60 48, 110 70, 170 56 S 260 40, 300 50 L300 64 C 250 56, 200 74, 160 70 S 60 64, 0 72Z" fill="var(--map-water)" />
              <g stroke="var(--map-road)" strokeWidth="4" fill="none"><path d="M0 26 H300" /><path d="M110 0 V80" /><path d="M215 0 V80" /><path d="M0 80 L300 0" strokeWidth="5" /></g>
            </svg>
            {pack.map((b, i) => (
              <span key={b.name} className={cn("absolute grid size-5 -translate-x-1/2 -translate-y-full place-items-center rounded-full rounded-br-none rotate-45 text-[10px] font-semibold text-white shadow", b === you ? "bg-accent" : "bg-bad")}
                style={{ left: `${[30, 58, 80][i]}%`, top: `${[62, 38, 70][i]}%` }}><span className="-rotate-45">{i + 1}</span></span>
            ))}
          </div>
          <ul className="divide-y divide-line">
            {pack.map((b, i) => (
              <li key={b.name} className={cn("flex items-center gap-2.5 px-3 py-2", b === you && "bg-accent-soft/50")}>
                <span className="num w-3 text-[11.5px] text-muted">{i + 1}</span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[12.5px] font-medium">{b.name}</div>
                  <div className="flex items-center gap-1.5 text-[11.5px] text-muted"><Stars r={b.rating} /><span className="num">({b.reviews})</span>· {me.trade.category} · {me.trade.hours}</div>
                </div>
                {b === you && <YouTag n={labels ? 2 : undefined} />}
              </li>
            ))}
            {p.maps > 3 && <li className="px-3 py-2 text-[11.5px] text-muted">You're <span className="num font-medium text-bad">#{p.maps}</span> on the map. Not shown here.</li>}
          </ul>
        </div>

        {/* Organic results */}
        <div className={cn(block, dim("google"), "flex flex-col gap-2.5 px-1")}>
          {organicTop.map((b) => (
            <div key={b.domain} className={cn("rounded-lg", b === you && "-mx-2 bg-accent-soft/50 px-2 py-1.5")}>
              <div className="flex items-center gap-1.5 text-[11px] text-muted"><Globe size={11} />{b.domain}{b === you && <span className="ml-auto"><YouTag n={labels ? 3 : undefined} /></span>}</div>
              <div className="truncate text-[13.5px] text-info">{b.title}</div>
              <div className="line-clamp-1 text-[11.5px] text-muted">{b.snippet}</div>
            </div>
          ))}
          {p.google > 3 && <div className="text-[11.5px] text-muted">{you.domain} is <span className={cn("num font-medium", p.google <= 10 ? "text-warn" : "text-bad")}>#{p.google}</span>, on page {Math.ceil(p.google / 10)}.</div>}
        </div>
      </div>
    </div>
  );
}

/** Mobile stand-in for the sticky search mock: three results pinned under the header. */
export function PresenceStrip({ p }: { p: Presence }) {
  const cells = [
    { icon: Sparkles, label: "AI", value: p.ai ? "Named" : "No", good: p.ai },
    { icon: MapPin, label: "Maps", value: `#${p.maps}`, good: p.maps <= 3 },
    { icon: Search, label: "Google", value: `#${p.google}`, good: p.google <= 3 },
  ];
  return (
    <div className="grid grid-cols-3 divide-x divide-line rounded-xl border border-line bg-surface/95 shadow-card backdrop-blur">
      {cells.map((c) => (
        <div key={c.label} className="flex items-center justify-center gap-1.5 py-2 text-[12.5px]">
          <c.icon size={13} className="text-muted" /><span className="text-muted">{c.label}</span>
          <span className={cn("num font-semibold transition-colors duration-500", c.good ? "text-good" : "text-bad")}>{c.value}</span>
        </div>
      ))}
    </div>
  );
}

// ---------- Panels for the jobs ----------

function PanelHead({ title, sub, right }: { title: string; sub: string; right?: ReactNode }) {
  return <div className="mb-3 flex items-start justify-between gap-3"><div><div className="text-[15px] font-medium">{title}</div><div className="text-[12.5px] text-muted">{sub}</div></div>{right}</div>;
}

const compareRows: { f: string; you: string; them: string[]; gap?: boolean }[] = [
  { f: "Reviews, last 90 days", you: "9", them: ["41", "28"], gap: true },
  { f: "Google categories", you: "1", them: ["5", "4"], gap: true },
  { f: "Local service pages", you: "3", them: ["22", "14"], gap: true },
  { f: "Local backlinks", you: "4", them: ["37", "19"], gap: true },
  { f: "Named by AI", you: "0 of 4", them: ["3 of 4", "2 of 4"], gap: true },
  { f: "Posts, last 30 days", you: "0", them: ["4", "1"] },
];

export function CompetitorPanel() {
  const me = usePersona().p;
  return (
    <div className="p-5">
      <PanelHead title="You vs the two businesses above you" sub={`“${me.keyword}” · updated weekly`} />
      <div className="overflow-x-auto rounded-xl border border-line">
        <table className="w-full min-w-[440px] text-[13px]">
          <thead className="border-b border-line text-left text-[12px] text-muted">
            <tr><th className="px-4 py-2 font-normal" /><th className="px-2 py-2 font-medium text-accent">You</th><th className="px-2 py-2 font-normal">{me.rivals[0].short}</th><th className="px-4 py-2 font-normal">{me.rivals[1].short}</th></tr>
          </thead>
          <tbody>
            {compareRows.map((r) => (
              <tr key={r.f} className="border-b border-line last:border-0">
                <td className="px-4 py-2">{r.f}</td>
                <td className={cn("num px-2 py-2 font-medium", r.gap && "text-bad")}>{r.you}</td>
                {r.them.map((t, i) => <td key={i} className={cn("num py-2 text-muted", i ? "px-4" : "px-2")}>{t}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-3 flex items-start gap-2.5 rounded-xl border border-accent/30 bg-accent-soft/40 p-3 text-[13px]">
        <MarkoAvatar size={24} />
        <div className="flex-1"><b className="font-medium">New this week:</b> {me.rivalMove}, and gained 6 map points. I've drafted both for you, done better.
          <div className="mt-2 flex gap-2"><span className="rounded-md bg-ink px-2.5 py-1 text-[12px] font-medium text-on-ink">Review drafts</span><span className="rounded-md border border-line px-2.5 py-1 text-[12px] text-muted">See their changes</span></div>
        </div>
      </div>
    </div>
  );
}

const auditIssues = [
  { issue: "LocalBusiness schema missing", where: "4 pages", status: "fixed" },
  { issue: "Mobile page load 4.1s", where: "Homepage", status: "fixed" },
  { issue: "12 broken links", where: "Blog, Services", status: "fixed" },
  { issue: "Duplicate title tags", where: "6 pages", status: "fixed" },
  { issue: "Old phone number in footer", where: "Every page", status: "fixed" },
  { issue: "Images without alt text", where: "31 images", status: "ready" },
] as const;

export function SiteAuditPanel() {
  const me = usePersona().p;
  return (
    <div className="p-5">
      <PanelHead title="Site audit" sub={`${me.domain} · 48 pages crawled this week`}
        right={<span className="flex items-baseline gap-1.5"><span className="num text-[12px] text-subtle line-through">54</span><span className="num font-serif text-[30px] leading-none text-good">91</span><span className="text-[12px] text-muted">/100</span></span>} />
      <ul className="divide-y divide-line rounded-xl border border-line">
        {auditIssues.map((a) => (
          <li key={a.issue} className="flex items-center gap-3 px-4 py-2.5 text-[13px]">
            <div className="min-w-0 flex-1"><div className="truncate font-medium">{a.issue}</div><div className="text-[12px] text-muted">{a.where}</div></div>
            {a.status === "fixed"
              ? <span className="inline-flex items-center gap-1 rounded-full bg-good-soft px-2 py-0.5 text-[12px] font-medium text-good"><Check size={12} />Fixed</span>
              : <span className="rounded-md bg-ink px-2.5 py-1 text-[12px] font-medium text-on-ink">Fix all</span>}
          </li>
        ))}
      </ul>
      <div className="mt-3 flex items-center gap-2 text-[12.5px] text-muted"><RotateCcw size={13} /> Every fix saved as a WordPress revision.</div>
    </div>
  );
}

// live, draft or missing for each service × town, row by row.
const pageState = ["llld", "lldm", "ldmm", "dmmm"];

export function ServiceAreaPanel() {
  const { trade: { services, category }, towns, pageTitle } = usePersona().p;
  const cell = { l: ["bg-good-soft text-good", "Live"], d: ["bg-accent-soft text-accent", "Draft"], m: ["border border-dashed border-line-strong text-subtle", "Missing"] } as const;
  return (
    <div className="p-5">
      <PanelHead title="Local service pages" sub="One page per service, per town you serve" right={<span className="rounded-full bg-accent-soft px-2.5 py-1 text-[12px] font-medium text-accent">4 drafts ready</span>} />
      <div className="overflow-x-auto">
        <table className="w-full min-w-[440px] border-separate border-spacing-1 text-[12px]">
          <thead><tr><th />{towns.map((t) => <th key={t} className="pb-1 text-left font-normal text-muted">{t}</th>)}</tr></thead>
          <tbody>
            {services.map((s, r) => (
              <tr key={s}>
                <td className="pr-2 text-[12.5px] font-medium whitespace-nowrap">{s}</td>
                {towns.map((t, c) => { const k = pageState[r][c] as keyof typeof cell; return <td key={t} className={cn("rounded-md px-2 py-1.5 font-medium", cell[k][0])}>{cell[k][1]}</td>; })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-3 rounded-xl border border-line p-3 text-[12.5px]">
        <div className="font-medium">{pageTitle}</div>
        <div className="mt-0.5 text-muted">880 searches/mo · 1,100 words · 3 local reviews · FAQ and {category} schema · links from 4 pages</div>
      </div>
    </div>
  );
}


export function BacklinksPanel() {
  const linkOps = usePersona().p.links;
  return (
    <div className="p-5">
      <PanelHead title="Local backlinks" sub="Links your competitors have and you don't" right={<span className="flex items-baseline gap-1"><span className="num font-serif text-[26px] leading-none">4</span><ArrowRight size={13} className="text-muted" /><span className="num font-serif text-[26px] leading-none text-good">19</span></span>} />
      <ul className="divide-y divide-line rounded-xl border border-line">
        {linkOps.map((l) => (
          <li key={l.site} className="flex items-center gap-3 px-4 py-2.5 text-[13px]">
            <Link2 size={14} className="shrink-0 text-muted" />
            <div className="min-w-0 flex-1"><div className="truncate font-medium">{l.site}</div><div className="truncate text-[12px] text-muted">{l.why}{l.has && <> · {l.has} {l.has.includes(",") ? "have" : "has"} it</>}</div></div>
            <span className={cn("rounded-full px-2 py-0.5 text-[12px] font-medium whitespace-nowrap", l.state === "Sent" ? "bg-good-soft text-good" : l.state === "Idea" ? "bg-hover text-muted" : "bg-accent-soft text-accent")}>{l.state}</span>
          </li>
        ))}
      </ul>
      <div className="mt-3 text-[12.5px] text-muted">No paid links, no link farms. Real local sites only.</div>
    </div>
  );
}

const listings = [
  { site: "Yelp", issue: "Old phone number", state: "fixed" },
  { site: "Angi", issue: "Missing Sunday hours", state: "fixed" },
  { site: "BBB", issue: "Name doesn't match", state: "fixed" },
  { site: "Apple Maps", issue: "Not listed", state: "add" },
  { site: "Bing Places", issue: "Not listed", state: "add" },
  { site: "Nextdoor", issue: "Matches", state: "ok" },
] as const;

export function CitationsPanel() {
  return (
    <div className="p-5">
      <PanelHead title="Citations" sub="Name, address, phone and hours on 42 sites" right={<span className="rounded-full bg-good-soft px-2.5 py-1 text-[12px] font-medium text-good">38 consistent</span>} />
      <ul className="divide-y divide-line rounded-xl border border-line">
        {listings.map((l) => (
          <li key={l.site} className="flex items-center gap-3 px-4 py-2.5 text-[13px]">
            <span className="w-24 shrink-0 font-medium">{l.site}</span>
            <span className={cn("flex-1", l.state === "ok" && "text-muted")}>{l.issue}</span>
            {l.state === "ok" ? <span className="text-[12px] text-muted">OK</span>
              : l.state === "fixed" ? <span className="inline-flex items-center gap-1 rounded-full bg-good-soft px-2 py-0.5 text-[12px] font-medium text-good"><Check size={12} />Fixed</span>
              : <span className="rounded-md bg-ink px-2 py-1 text-[12px] font-medium text-on-ink">Add listing</span>}
          </li>
        ))}
      </ul>
      <div className="mt-3 flex items-center gap-2 text-[12.5px] text-muted"><ArrowUp size={13} className="text-good" /> Gemini started naming you 9 days after the Yelp fix.</div>
    </div>
  );
}

// ---------- Problem: the agency's monthly report ----------

export function AgencyReport({ className }: { className?: string }) {
  const metrics = [["Impressions", "+3.2%"], ["Engagement rate", "0.8%"], ["Domain authority", "21 → 22"], ["Posts published", "2"]];
  return (
    <figure aria-label="A typical agency monthly report" className={cn("relative w-full max-w-[340px] rotate-[-2deg] rounded-lg border border-line bg-surface p-5 shadow-float", className)}>
      <div className="flex items-center justify-between border-b border-line pb-3">
        <span className="inline-flex items-center gap-2 text-[13px] font-medium"><FileText size={15} className="text-muted" />Monthly Marketing Report</span>
        <span className="num text-[11.5px] text-muted">p. 1 of 14</span>
      </div>
      <div className="mt-3 text-[12px] text-muted">September · prepared by your account team</div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        {metrics.map(([l, v]) => (
          <div key={l} className="rounded-md bg-sunken px-3 py-2"><div className="text-[11.5px] text-muted">{l}</div><div className="num text-[16px] font-medium">{v}</div></div>
        ))}
      </div>
      <div className="mt-3 text-[12.5px] text-muted"><b className="font-medium text-fg">Next steps:</b> continue optimizing, revisit strategy on our call.</div>
      <div className="mt-3 flex items-center justify-between rounded-md border border-dashed border-line-strong px-3 py-2 text-[12.5px]">
        <span className="text-muted">Calls from Google</span><span className="font-medium text-muted">not tracked</span>
      </div>
      <figcaption className="sr-only">A report of vanity metrics with no calls or bookings in it.</figcaption>
    </figure>
  );
}

// ---------- Control: what Marko may do alone ----------

const autopilot = [
  { label: "Reply to 4 and 5-star reviews", note: "Lower ratings always wait for you", on: true },
  { label: "Publish weekly Google posts", note: "Posts at 9am, checked after", on: true },
  { label: "Change your website", note: "Shows the diff first, keeps a revision", on: false },
  { label: "Fix directory listings", note: "Yelp, Angi, BBB and others", on: false },
];

export function AutopilotPanel() {
  const [state, setState] = useState(autopilot.map((a) => a.on));
  return (
    <div className="p-5">
      <div className="mb-3"><div className="text-[15px] font-medium">What Marko may do without asking</div><div className="text-[12.5px] text-muted">Everything else waits for your approval</div></div>
      <ul className="divide-y divide-line rounded-xl border border-line">
        {autopilot.map((a, i) => (
          <li key={a.label} className="flex items-center gap-3 px-4 py-3">
            <div className="min-w-0 flex-1"><div className="text-[14px] font-medium">{a.label}</div><div className="text-[12.5px] text-muted">{a.note}</div></div>
            <button
              role="switch" aria-checked={state[i]} aria-label={a.label}
              onClick={() => setState((s) => s.map((v, j) => (j === i ? !v : v)))}
              className={cn("relative h-6 w-10 shrink-0 rounded-full transition-colors duration-200", state[i] ? "bg-accent" : "bg-line-strong")}
            >
              <span className={cn("absolute top-0.5 left-0.5 size-5 rounded-full bg-white shadow-sm transition-transform duration-200 ease-out", state[i] && "translate-x-4")} />
            </button>
          </li>
        ))}
      </ul>
      <div className="mt-3 flex items-center gap-2 text-[12.5px] text-muted"><RotateCcw size={13} /> Every change is logged. Undo any of it.</div>
    </div>
  );
}

// ---------- Agency vs Marko ----------

export function Versus() {
  const [ref, inView] = useInView<HTMLDivElement>();
  return (
    <div ref={ref} className="overflow-hidden rounded-2xl border border-line bg-surface">
      <div className="grid grid-cols-[1fr_1fr] border-b border-line text-[13px] sm:grid-cols-[0.8fr_1fr_1fr]">
        <span className="hidden px-5 py-3.5 text-muted sm:block" />
        <span className="px-5 py-3.5 font-medium text-muted">Your agency</span>
        <span className="inline-flex items-center gap-2 bg-accent-soft/40 px-5 py-3.5 font-medium"><MarkoAvatar size={20} />Marko</span>
      </div>
      {versus.map((v, i) => (
        <div key={v.row} className="grid grid-cols-[1fr_1fr] border-b border-line last:border-0 sm:grid-cols-[0.8fr_1fr_1fr]">
          <span className="col-span-2 px-5 pt-3.5 text-[13px] text-muted sm:col-span-1 sm:py-3.5 sm:text-[14px] sm:text-fg">{v.row}</span>
          <span className="flex items-start gap-2 px-5 py-3 text-[14px] text-muted sm:py-3.5">
            <XIcon size={15} className="mt-0.5 shrink-0 text-bad" />
            <Strike on={inView} delay={200 + i * 120}>{v.agency}</Strike>
          </span>
          <span className="flex items-start gap-2 bg-accent-soft/40 px-5 py-3 text-[14px] font-medium sm:py-3.5"><Check size={15} className="mt-0.5 shrink-0 text-good" />{v.marko}</span>
        </div>
      ))}
    </div>
  );
}

// ---------- Proof: before/after map packs and video testimonials ----------

function MiniPack({ names, you, youRank, label }: { names: string[]; you: string; youRank: number; label: string }) {
  const rows = youRank <= 3 ? [...names.slice(0, youRank - 1), you, ...names.slice(youRank - 1)].slice(0, 3) : names.slice(0, 3);
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <span className="text-[11.5px] font-medium text-muted">{label}</span>
      <ol className="divide-y divide-line overflow-hidden rounded-lg border border-line bg-surface">
        {rows.map((n, i) => (
          <li key={n} className={cn("flex items-center gap-1.5 px-2 py-1.5 text-[11.5px]", n === you && "bg-accent-soft/60 font-medium")}>
            <span className={cn("grid size-4 shrink-0 place-items-center rounded-full text-[9.5px] font-semibold text-white", n === you ? "bg-accent" : "bg-line-strong")}>{i + 1}</span>
            <span className="truncate">{n}</span>
          </li>
        ))}
      </ol>
      <span className={cn("text-[11.5px]", youRank <= 3 ? "text-good" : "text-bad")}>{youRank <= 3 ? `In the pack at #${youRank}` : `You: #${youRank}, not shown`}</span>
    </div>
  );
}

export function PackBeforeAfter({ business: name, keyword: kw, niche, city, rivals, rankBefore, rankAfter, metric, badge }: { business: string; keyword: string; niche: string; city: string; rivals: string[]; rankBefore: number; rankAfter: number; metric: { value: string; label: string }; badge?: ReactNode }) {
  return (
    <div className="flex flex-col gap-4 p-5">
      <div className="flex flex-wrap items-center gap-2 text-[12.5px] text-muted"><span className="font-medium text-fg">{name}</span>· {niche} · {city}{badge}</div>
      <div className="flex items-center gap-2 rounded-full border border-line bg-bg px-3 py-1.5 text-[12.5px]"><Search size={12} className="text-muted" />{kw}</div>
      <div className="grid grid-cols-2 gap-3">
        <MiniPack names={rivals} you={name} youRank={rankBefore} label="Before" />
        <MiniPack names={rivals} you={name} youRank={rankAfter} label="After" />
      </div>
      <div className="flex items-baseline gap-2 border-t border-line pt-3"><span className="num font-display text-[26px] leading-none">{metric.value}</span><span className="text-[13px] text-muted">{metric.label}</span></div>
    </div>
  );
}

/** A video testimonial card. Until real videos exist, play opens the transcript instead. */
export function VideoCard({ v, badge }: { v: { name: string; role: string; business: string; length: string; quote: string; transcript: string }; badge?: ReactNode }) {
  const [open, setOpen] = useState(false);
  const initials = v.name.replace("Dr. ", "").split(" ").map((p) => p[0]).join("");
  return (
    <figure className="flex flex-col overflow-hidden rounded-2xl border border-line bg-surface">
      <div className="relative aspect-video bg-ink text-on-ink">
        <div aria-hidden className="absolute inset-0 opacity-70 [background-image:radial-gradient(ellipse_70%_90%_at_80%_10%,rgba(254,123,205,.45),transparent_60%)]" />
        {open ? (
          <div className="rise absolute inset-0 overflow-y-auto p-4 text-[13px] leading-relaxed"><span className="mb-1 block text-[11px] tracking-wide uppercase opacity-60">Transcript</span>{v.transcript}</div>
        ) : (
          <>
            <span aria-hidden className="absolute bottom-3 left-4 font-display text-[56px] leading-none opacity-25">{initials}</span>
            <span className="num absolute right-3 bottom-3 rounded bg-black/50 px-1.5 py-0.5 text-[11.5px]">{v.length}</span>
          </>
        )}
        <button onClick={() => setOpen((o) => !o)} aria-label={open ? "Close transcript" : `Play ${v.name}'s story`}
          className={cn("absolute grid place-items-center rounded-full bg-white text-black shadow-lg transition-transform hover:scale-105", open ? "top-2 right-2 size-7" : "top-1/2 left-1/2 size-12 -translate-x-1/2 -translate-y-1/2")}>
          {open ? <XIcon size={14} /> : <Play size={18} fill="currentColor" className="ml-0.5" />}
        </button>
      </div>
      <figcaption className="flex flex-1 flex-col gap-3 p-5">
        <blockquote className="font-serif text-[19px] leading-snug">“{v.quote}”</blockquote>
        <div className="mt-auto flex flex-wrap items-center gap-2 text-[13px]"><span className="font-medium">{v.name}</span><span className="text-muted">{v.role}, {v.business}</span>{badge}</div>
      </figcaption>
    </figure>
  );
}

// ---------- Social proof strip under the hero ----------


/** Traction, a rotating "just joined" line, product news and a used-by row. Numbers come from site.ts. */
const wordmarkIcons = [Wrench, Sparkles, Store, MapPin, Globe, MessageSquare];

/** A rotating "just fired their agency" line. Quiet by design: it sits in the owners strip, away from the audit form. */
export function LiveJoin({ joins }: { joins: { who: string; ago: string }[] }) {
  const [i, setI] = useState(0);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const id = setInterval(() => setI((v) => (v + 1) % joins.length), 5000);
    return () => clearInterval(id);
  }, [joins.length]);
  const join = joins[i];
  return (
    <span className="inline-flex min-w-0 items-center gap-2 text-[13px] text-muted" aria-live="polite">
      <Check size={13} className="shrink-0 text-good" />
      <span key={i} className="rise truncate"><span className="text-fg">{join.who}</span> fired their agency · {join.ago}</span>
    </span>
  );
}

/** A green dot with a visible ping ring, for "live" counts. */
export function LiveDot() {
  return (
    <span className="relative flex size-2.5 shrink-0" aria-hidden>
      <span className="absolute inline-flex size-full animate-ping rounded-full bg-good opacity-75" />
      <span className="relative inline-flex size-2.5 rounded-full bg-good" />
    </span>
  );
}

/** A full-width row of owner wordmarks, for the bottom of the hero. */
export function OwnersStrip({ usedBy, badge, live }: { usedBy: string[]; badge?: ReactNode; live?: ReactNode }) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
        <span className="inline-flex items-center gap-2 text-[12px] tracking-[0.08em] text-subtle uppercase">Owners using Marko<span className="tracking-normal normal-case">{badge}</span></span>
        {live}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 lg:flex-nowrap">
        {usedBy.map((n, k) => {
          const Icon = wordmarkIcons[k % wordmarkIcons.length];
          return <span key={n} className={cn("inline-flex items-center gap-1.5 whitespace-nowrap text-muted", k % 2 ? "font-display text-[17px]" : "text-[15px] font-semibold tracking-tight")}><Icon size={15} />{n}</span>;
        })}
      </div>
    </div>
  );
}
