import { useEffect, useId, useMemo, useState, type FormEvent } from "react";
import { Link } from "react-router";
import { ArrowRight, Check, Globe, Mail, Minus, Plus, ShieldCheck, Gift, Wrench, Receipt, Handshake, Quote, CircleHelp, X as XIcon, MapPin, ListChecks, BarChart3, Search } from "lucide-react";
import { Button, Heading, SampleBadge, Tag, cn } from "./ui";
import { GeoGrid, MapPanel, ProfilePanel, ReportPanel, TodoPanel, AppFrame, ReviewsPanel, PostPanel, AiPanel } from "./visuals";
import { industries, offer, plans, faqs as defaultFaqs } from "../data/site";
import { caseStudies, testimonials, type CaseStudy } from "../data/stories";
import { capabilities, competitors, openmarko, AS_OF, type Cell } from "../data/competitors";
import { services } from "../data/services";
import { serviceIcons } from "./Layout";
import { usePersona } from "./persona";

// ---------- Free audit form (the lead magnet) ----------

/** Two-step capture: business first, then where to send it. There's no backend yet, so it confirms locally. */
export function AuditForm({ dark = false }: { dark?: boolean }) {
  const { input } = usePersona();
  const [biz, setBiz] = useState(input.name);
  const [email, setEmail] = useState("");
  const [step, setStep] = useState<"biz" | "email" | "done">("biz");
  const id = useId();
  // A business entered to personalise the page carries straight into the audit.
  useEffect(() => { if (input.name.trim()) setBiz(input.name.trim()); }, [input.name]);
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (step === "biz" && biz.trim()) setStep("email");
    else if (step === "email" && /\S+@\S+\.\S+/.test(email)) setStep("done");
  };
  if (step === "done") {
    return (
      <div role="status" className="rise mx-auto flex w-full max-w-xl items-start gap-3 rounded-xl border border-line bg-surface p-4 text-left shadow-card">
        <span className="grid size-8 shrink-0 place-items-center rounded-full bg-good-soft text-good"><Check size={16} /></span>
        <div className="text-[15px] text-fg"><b className="font-medium">Your audit for {biz} is on its way.</b><br /><span className="text-muted">We'll email {email} a link to your map grid, the competitors above you and your top fixes.</span></div>
      </div>
    );
  }
  return (
    <form onSubmit={submit} className="mx-auto w-full max-w-xl">
      <div className={cn("flex items-center gap-2 rounded-xl border p-1.5 shadow-card", dark ? "border-white/15 bg-white/5" : "border-line bg-surface")}>
        {step === "biz" ? <Globe size={18} className="ml-2.5 shrink-0 text-subtle" /> : <Mail size={18} className="ml-2.5 shrink-0 text-subtle" />}
        <label htmlFor={`${id}-in`} className="sr-only">{step === "biz" ? "Your business name or website" : "Your email"}</label>
        <input
          id={`${id}-in`}
          key={step}
          autoFocus={step === "email"}
          type={step === "biz" ? "text" : "email"}
          value={step === "biz" ? biz : email}
          onChange={(e) => (step === "biz" ? setBiz(e.target.value) : setEmail(e.target.value))}
          placeholder={step === "biz" ? "Business name or website" : "Where should we send it?"}
          autoComplete={step === "biz" ? "organization" : "email"}
          className={cn("h-11 min-w-0 flex-1 bg-transparent text-[16px] outline-none placeholder:text-subtle", dark ? "text-white" : "text-fg")}
        />
        <button type="submit" className={cn("group inline-flex h-11 shrink-0 items-center gap-1.5 rounded-lg px-4 text-[15px] font-medium", dark ? "bg-white text-black" : "bg-ink text-on-ink", "hover:opacity-85")}>
          {step === "biz" ? <><span className="hidden sm:inline">Get my free audit</span><span className="sm:hidden">Audit me</span></> : "Send it"}<ArrowRight size={16} className="transition-transform group-hover:translate-x-0.5" />
        </button>
      </div>
    </form>
  );
}

// ---------- Industries marquee ----------

export function IndustriesMarquee() {
  const row = [...industries, ...industries];
  return (
    <div className="flex flex-col gap-4">
      <p className="text-center text-[14px] text-muted">Built for businesses that live or die by the map pack</p>
      <div className="relative overflow-hidden [mask-image:linear-gradient(90deg,transparent,black_12%,black_88%,transparent)]">
        <div className="marquee flex w-max gap-3">
          {row.map((n, i) => (
            <span key={i} aria-hidden={i >= industries.length} className="inline-flex items-center gap-2 rounded-full border border-line bg-surface px-4 py-2 text-[15px] whitespace-nowrap">
              <MapPin size={14} className="text-accent" />{n}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

// ---------- How it works: numbered steps beside a switching visual ----------

const steps = [
  { title: "Scan the map around you", body: "We search Google Maps from 49 points around your business, for every keyword that brings customers.", icon: MapPin, visual: () => <MapPanel strength={0.32} /> },
  { title: "See why they outrank you", body: "Categories, reviews, photos, posts and pages: you against the top 3, side by side.", icon: Search, visual: () => <ProfilePanel /> },
  { title: "Approve the fixes", body: "Every gap becomes a To-do, ranked by impact. Click Apply, or let autopilot handle the safe ones.", icon: ListChecks, visual: () => <TodoPanel /> },
  { title: "Watch the calls come in", body: "Weekly grids and a monthly report with calls, directions and clicks from Google.", icon: BarChart3, visual: () => <ReportPanel /> },
];

export function HowItWorks() {
  const [i, setI] = useState(0);
  const [auto, setAuto] = useState(true);
  useEffect(() => {
    if (!auto || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const t = setTimeout(() => setI((v) => (v + 1) % steps.length), 6000);
    return () => clearTimeout(t);
  }, [i, auto]);
  const Cur = steps[i].visual;
  return (
    <div className="grid overflow-hidden rounded-2xl border border-line bg-surface lg:grid-cols-[0.9fr_1.1fr]">
      <ol className="flex flex-col">
        {steps.map((s, n) => (
          <li key={s.title} className={cn(n > 0 && "border-t border-line")}>
            <button onClick={() => { setI(n); setAuto(false); }} aria-current={i === n ? "step" : undefined} className="relative flex w-full gap-4 px-6 py-6 text-left">
              <span className={cn("num font-mono text-[14px]", i === n ? "text-accent" : "text-subtle")}>{String(n + 1).padStart(2, "0")}</span>
              <span className="flex-1">
                <span className={cn("block text-[19px] font-medium", i !== n && "text-muted")}>{s.title}</span>
                {i === n && <span className="rise mt-1.5 block text-[15px] text-muted">{s.body}</span>}
              </span>
              {i === n && <span className="absolute bottom-0 left-0 h-0.5 bg-accent" style={{ width: "100%", animation: auto ? "grow 6s linear both" : undefined }} />}
            </button>
          </li>
        ))}
      </ol>
      <div className="grid-fine relative border-t border-line bg-sunken p-4 sm:p-8 lg:border-t-0 lg:border-l">
        <style>{`@keyframes grow { from { width: 0 } to { width: 100% } }`}</style>
        <AppFrame url="app.openmarko.com" className="relative">
          <div key={i} className="rise min-h-[380px]"><Cur /></div>
        </AppFrame>
      </div>
    </div>
  );
}

// ---------- Feature trio (Chatwoot cards: mini UI on top, words below) ----------

export function FeatureTrio() {
  const cards = [
    { label: "Reviews", title: "Same-day replies, in your voice", body: "Drafts for every review within minutes. Approve from your phone or let the good ones post themselves.", to: "/services/reviews", visual: <ReviewsPanel /> },
    { label: "Profile", title: "A profile that never goes stale", body: "Weekly posts, fresh photos and the categories the leaders use, checked to make sure they went live.", to: "/services/business-profile", visual: <PostPanel /> },
    { label: "AI search", title: "Recommended by AI, not just ranked", body: "See whether ChatGPT, Gemini and Google's AI answers name you, and which sources they trust instead.", to: "/services/ai-visibility", visual: <AiPanel /> },
  ];
  return (
    <div className="grid gap-5 lg:grid-cols-3">
      {cards.map((c) => (
        <Link key={c.label} to={c.to} className="group flex flex-col overflow-hidden rounded-2xl border border-line bg-surface transition-shadow hover:shadow-float">
          <div className="flex items-center justify-between border-b border-line px-5 py-3 font-mono text-[12px] tracking-wider uppercase">{c.label}<ArrowRight size={14} className="text-muted transition-transform group-hover:translate-x-0.5" /></div>
          <div className="grid-fine pointer-events-none max-h-[300px] overflow-hidden bg-sunken [mask-image:linear-gradient(black_75%,transparent)]" aria-hidden>{c.visual}</div>
          <div className="flex flex-col gap-2 p-6"><h3 className="font-display text-[24px] leading-tight">{c.title}</h3><p className="text-[15px] text-muted">{c.body}</p></div>
        </Link>
      ))}
    </div>
  );
}

// ---------- Services grid ----------

export function ServicesGrid({ exclude }: { exclude?: string }) {
  return (
    <div className="grid gap-px overflow-hidden rounded-2xl border border-line bg-line sm:grid-cols-2 lg:grid-cols-3">
      {services.filter((s) => s.slug !== exclude).map((s) => {
        const Icon = serviceIcons[s.slug];
        return (
          <Link key={s.slug} to={`/services/${s.slug}`} className="group flex flex-col gap-3 bg-surface p-6 transition-colors hover:bg-hover">
            <span className="grid size-10 place-items-center rounded-lg bg-accent-soft text-accent"><Icon size={19} /></span>
            <span className="text-[18px] font-medium">{s.name}</span>
            <span className="text-[15px] text-muted">{s.short}</span>
            <span className="mt-auto inline-flex items-center gap-1 pt-2 text-[14px] font-medium">Learn more <ArrowRight size={14} className="transition-transform group-hover:translate-x-0.5" /></span>
          </Link>
        );
      })}
    </div>
  );
}

// ---------- ROI calculator (same model as the product's audit) ----------

/** Share of searches a listing captures at each map-pack position. Mirrors packShare() in the app. */
const packShare = (rank: number) => (rank === 1 ? 0.22 : rank === 2 ? 0.15 : rank === 3 ? 0.11 : rank <= 10 ? 0.02 : 0.005);
const LEAD_RATE = 0.08;
const CLOSE_RATE = 0.35;
const money = (n: number) => n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

function Slider({ id, label, value, min, max, step, onChange, format }: { id: string; label: string; value: number; min: number; max: number; step: number; onChange: (n: number) => void; format: (n: number) => string }) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between gap-3"><label htmlFor={id} className="text-[15px]">{label}</label><span className="num font-display text-[22px]">{format(value)}</span></div>
      <input id={id} type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} className="w-full accent-[var(--accent)]" />
    </div>
  );
}

export function RoiCalculator() {
  const id = useId();
  const [searches, setSearches] = useState(1300);
  const [rank, setRank] = useState(8);
  const [job, setJob] = useState(450);
  const r = useMemo(() => {
    const target = Math.min(3, rank);
    const leads = searches * Math.max(0, packShare(target) - packShare(rank)) * LEAD_RATE * 12;
    const jobs = leads * CLOSE_RATE;
    const revenue = jobs * job;
    const cost = plans[0].price * 12;
    return { leads, jobs, revenue, multiple: revenue / cost, cost };
  }, [searches, rank, job]);
  return (
    <div className="grid overflow-hidden rounded-2xl border border-line bg-surface lg:grid-cols-2">
      <div className="flex flex-col gap-7 p-6 sm:p-8">
        <Slider id={`${id}-s`} label="Monthly searches for your main service" value={searches} min={200} max={6000} step={100} onChange={setSearches} format={(n) => n.toLocaleString()} />
        <Slider id={`${id}-r`} label="Where you rank in the map pack today" value={rank} min={4} max={20} step={1} onChange={setRank} format={(n) => `#${n}`} />
        <Slider id={`${id}-j`} label="Average value of a job" value={job} min={100} max={5000} step={50} onChange={setJob} format={money} />
        <p className="text-[13px] text-subtle">Estimate only. It assumes you reach #3, that {LEAD_RATE * 100}% of the searchers who see you call or book, and that you win {CLOSE_RATE * 100}% of those. These are the same assumptions our audits use. Your market will differ.</p>
      </div>
      <div className="grid-fine flex flex-col justify-center gap-6 border-t border-line bg-sunken p-6 sm:p-8 lg:border-t-0 lg:border-l">
        <div>
          <div className="text-[14px] text-muted">Extra revenue a year from reaching #3</div>
          <div className="num font-display text-[56px] leading-none sm:text-[72px]">{money(r.revenue)}</div>
        </div>
        <div className="grid grid-cols-3 gap-px overflow-hidden rounded-xl border border-line bg-line">
          {[["Extra calls / yr", Math.round(r.leads).toLocaleString()], ["Extra jobs / yr", Math.round(r.jobs).toLocaleString()], ["Return on $99/mo", r.multiple >= 1 ? `${r.multiple.toFixed(r.multiple >= 10 ? 0 : 1)}×` : "<1×"]].map(([l, v]) => (
            <div key={l} className="bg-surface p-4"><div className="num text-[22px] font-medium">{v}</div><div className="text-[12.5px] text-muted">{l}</div></div>
          ))}
        </div>
        <Button to="/#audit" arrow className="self-start">See your real numbers in a free audit</Button>
      </div>
    </div>
  );
}

// ---------- Case studies ----------

export function CaseStudyCard({ s }: { s: CaseStudy }) {
  return (
    <Link to={`/customers/${s.slug}`} className="group flex flex-col overflow-hidden rounded-2xl border border-line bg-surface transition-shadow hover:shadow-float">
      <div className="grid grid-cols-2 gap-2 border-b border-line bg-sunken p-4">
        <GeoGrid strength={s.strengthBefore} size={5} seed={2} label={`Before · #${s.rankBefore}`} />
        <GeoGrid strength={s.strengthAfter} size={5} seed={2} label={`After · #${s.rankAfter}`} />
      </div>
      <div className="flex flex-1 flex-col gap-3 p-6">
        <div className="flex flex-wrap items-center gap-2 text-[13px] text-muted"><span className="font-medium text-fg">{s.business}</span>· {s.niche} · {s.city}<SampleBadge /></div>
        <h3 className="font-display text-[24px] leading-tight">{s.headline}</h3>
        <div className="mt-auto flex items-end justify-between gap-3 pt-3">
          <div><div className="num font-display text-[30px] leading-none">{s.metrics[0].value}</div><div className="text-[13px] text-muted">{s.metrics[0].label}</div></div>
          <span className="inline-flex items-center gap-1 text-[14px] font-medium">Read story <ArrowRight size={14} className="transition-transform group-hover:translate-x-0.5" /></span>
        </div>
      </div>
    </Link>
  );
}

export function CaseStudyGrid({ limit, exclude }: { limit?: number; exclude?: string }) {
  const list = caseStudies.filter((s) => s.slug !== exclude).slice(0, limit);
  return <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">{list.map((s) => <CaseStudyCard key={s.slug} s={s} />)}</div>;
}

// ---------- Testimonials ----------

export function TestimonialWall({ items = testimonials }: { items?: typeof testimonials }) {
  return (
    <div className="columns-1 gap-5 sm:columns-2 lg:columns-3">
      {items.map((t, i) => {
        const body = (
          <figure className={cn("mb-5 flex break-inside-avoid flex-col gap-4 rounded-2xl border p-6", i === 1 ? "border-ink bg-ink text-on-ink" : "border-line bg-surface")}>
            <Quote size={20} className={i === 1 ? "text-ring" : "text-accent"} />
            <blockquote className={cn("font-serif leading-snug", i % 3 === 1 ? "text-[24px]" : "text-[20px]")}>“{t.text}”</blockquote>
            <figcaption className="flex items-center gap-3">
              <span className={cn("grid size-9 place-items-center rounded-full text-[13px] font-semibold", i === 1 ? "bg-white/10" : "bg-accent-soft text-accent")}>{t.name.split(" ").map((p) => p[0]).slice(-2).join("")}</span>
              <span className="text-[14px]"><span className="block font-medium">{t.name}</span><span className={i === 1 ? "opacity-70" : "text-muted"}>{t.role}, {t.business}</span></span>
              <SampleBadge className="ml-auto" />
            </figcaption>
          </figure>
        );
        return t.story ? <Link key={t.name} to={`/customers/${t.story}`} className="block transition-transform hover:-translate-y-0.5">{body}</Link> : <div key={t.name}>{body}</div>;
      })}
    </div>
  );
}

// ---------- Comparison ----------

export function CellMark({ v }: { v: Cell }) {
  if (v === "yes") return <span className="inline-grid size-6 place-items-center rounded-full bg-good-soft text-good" aria-label="Yes"><Check size={14} strokeWidth={2.5} /></span>;
  if (v === "partial") return <span className="inline-grid size-6 place-items-center rounded-full bg-warn-soft text-warn" aria-label="Partly"><Minus size={14} strokeWidth={2.5} /></span>;
  if (v === "no") return <span className="inline-grid size-6 place-items-center rounded-full bg-hover text-subtle" aria-label="No"><XIcon size={13} strokeWidth={2.5} /></span>;
  return <span className="inline-grid size-6 place-items-center rounded-full text-subtle" aria-label="Not confirmed"><CircleHelp size={15} /></span>;
}

export function CompareMatrix({ only }: { only?: string }) {
  const list = only ? competitors.filter((c) => c.slug === only) : competitors;
  return (
    <div className="overflow-x-auto rounded-2xl border border-line bg-surface">
      <table className="w-full min-w-[640px] text-[14px]">
        <thead>
          <tr className="border-b border-line">
            <th className="sticky left-0 bg-surface px-5 py-4 text-left font-normal text-muted">As of {AS_OF}</th>
            <th className="bg-accent-soft/40 px-3 py-4 text-center font-medium">OpenMarko</th>
            {list.map((c) => <th key={c.slug} className="px-3 py-4 text-center font-medium"><Link to={`/compare/${c.slug}`} className="hover:underline">{c.name}</Link></th>)}
          </tr>
        </thead>
        <tbody>
          {capabilities.map((cap, i) => (
            <tr key={cap} className="border-b border-line last:border-0">
              <td className="sticky left-0 bg-surface px-5 py-3">{cap}</td>
              <td className="bg-accent-soft/40 px-3 py-3 text-center"><CellMark v={openmarko[i]} /></td>
              {list.map((c) => <td key={c.slug} className="px-3 py-3 text-center"><CellMark v={c.cells[i]} /></td>)}
            </tr>
          ))}
        </tbody>
      </table>
      <div className="flex flex-wrap gap-x-5 gap-y-2 border-t border-line px-5 py-3 text-[12.5px] text-muted">
        <span className="inline-flex items-center gap-1.5"><CellMark v="yes" /> Yes</span>
        <span className="inline-flex items-center gap-1.5"><CellMark v="partial" /> Partly</span>
        <span className="inline-flex items-center gap-1.5"><CellMark v="no" /> No</span>
        <span className="inline-flex items-center gap-1.5"><CellMark v="?" /> Not confirmed by the vendor's pages</span>
      </div>
    </div>
  );
}

// ---------- Offer ----------

const offerIcons = [Gift, Wrench, ShieldCheck, Handshake, Receipt];

export function OfferBlock() {
  return (
    <div className="relative overflow-hidden rounded-3xl bg-ink text-on-ink">
      <div aria-hidden className="absolute inset-0 opacity-60 [background-image:radial-gradient(ellipse_60%_80%_at_85%_0%,rgba(254,123,205,.35),transparent_60%)]" />
      <div className="relative grid gap-10 p-6 sm:p-10 lg:grid-cols-[1fr_1.1fr] lg:p-14">
        <div className="flex flex-col gap-5">
          <span className="tag inline-flex w-fit items-center gap-1.5 bg-[var(--ring)] py-1 pl-2.5 text-[13px] font-medium text-black"><ShieldCheck size={14} />{offer.name}</span>
          <h2 className="font-display text-[36px] leading-[1.05] sm:text-[48px]">{offer.headline}</h2>
          <p className="max-w-[44ch] text-[17px] opacity-75">{offer.sub}</p>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <Link to="/#audit" className="group inline-flex h-12 items-center gap-2 rounded-lg bg-white px-5 text-[16px] font-medium text-black hover:opacity-90">Claim my free audit <ArrowRight size={16} className="transition-transform group-hover:translate-x-0.5" /></Link>
            <Link to="/pricing" className="inline-flex h-12 items-center px-3 text-[15px] opacity-80 hover:opacity-100">See pricing</Link>
          </div>
        </div>
        <ul className="flex flex-col divide-y divide-white/10 rounded-2xl border border-white/10 bg-white/[0.03]">
          {offer.items.map((it, i) => {
            const Icon = offerIcons[i];
            return (
              <li key={it.title} className="flex gap-4 p-5">
                <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-white/10 text-[var(--ring)]"><Icon size={17} /></span>
                <span><span className="block text-[16px] font-medium">{it.title}</span><span className="block text-[14.5px] opacity-70">{it.body}</span></span>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

// ---------- Pricing ----------

export function PricingCards() {
  return (
    <div className="grid gap-5 lg:grid-cols-3">
      {plans.map((p) => (
        <div key={p.id} className={cn("relative flex flex-col gap-5 rounded-2xl border bg-surface p-7", p.featured ? "border-ink shadow-float" : "border-line")}>
          {p.featured && <span className="absolute -top-3 left-7 rounded-full bg-ink px-3 py-1 text-[12px] font-medium text-on-ink">Most popular</span>}
          <div><div className="text-[18px] font-medium">{p.name}</div><div className="mt-1 text-[14.5px] text-muted">{p.for}</div></div>
          <div className="flex items-baseline gap-1"><span className="num font-display text-[52px] leading-none">${p.price}</span><span className="text-muted">{p.cadence}</span></div>
          <Button to={p.id === "agency-max" ? "/pricing#contact" : "/#audit"} variant={p.featured ? "primary" : "secondary"} arrow>{p.cta}</Button>
          <ul className="flex flex-col gap-2.5 border-t border-line pt-5">
            {p.features.map((f) => <li key={f} className="flex gap-2.5 text-[14.5px]"><Check size={17} className="mt-0.5 shrink-0 text-good" />{f}</li>)}
          </ul>
        </div>
      ))}
    </div>
  );
}

// ---------- FAQ ----------

export function Faq({ items = defaultFaqs }: { items?: { q: string; a: string }[] }) {
  const [open, setOpen] = useState<number | null>(0);
  const id = useId();
  return (
    <div className="divide-y divide-line rounded-2xl border border-line bg-surface">
      {items.map((f, i) => (
        <div key={f.q}>
          <h3>
            <button id={`${id}-q${i}`} aria-expanded={open === i} aria-controls={`${id}-a${i}`} onClick={() => setOpen(open === i ? null : i)} className="flex w-full items-center justify-between gap-4 px-6 py-5 text-left text-[17px] font-medium">
              {f.q}<Plus size={18} className={cn("shrink-0 text-muted transition-transform", open === i && "rotate-45")} />
            </button>
          </h3>
          {open === i && <div id={`${id}-a${i}`} role="region" aria-labelledby={`${id}-q${i}`} className="rise -mt-1 px-6 pb-6 text-[15.5px] text-muted">{f.a}</div>}
        </div>
      ))}
    </div>
  );
}

// ---------- Closing call to action ----------

export function FinalCta() {
  return (
    <section className="relative overflow-hidden border-t border-line">
      <div aria-hidden className="grid-backdrop absolute inset-0" />
      <div className="relative mx-auto flex max-w-[1200px] flex-col items-center gap-8 px-4 py-24 text-center sm:px-6">
        <Heading center tag={<Tag tone="accent" icon={<MapPin size={13} />}>Free audit</Tag>} title={<>See who's taking <span className="ink-sheen">your calls</span></>} sub="Enter your business. In a few minutes you'll see your map grid, the competitors above you and the fixes that close the gap." />
        <AuditForm />
      </div>
    </section>
  );
}

