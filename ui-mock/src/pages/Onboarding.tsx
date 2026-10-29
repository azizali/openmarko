import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router";
import { Check, Search, MapPin, Star, Loader2, Plus, ArrowLeft, ArrowRight, ShieldCheck, Store, BarChart3, SearchCheck } from "lucide-react";
import { Button, Badge, Card, Checkbox, Modal, Segmented, Toggle, cn, fmt } from "../components/ui";
import { GridMap, GridLegend } from "../components/GridMap";
import { business, competitors, keywords, makeGrid } from "../data/mock";
import { estimateGridCost } from "../lib/api";

const steps = ["Your business", "Connect Google", "Keywords", "Competitors", "Rank pack", "Launch"];

const searchResults = [
  { ...business, match: true },
  { name: "Maple Dental Group", address: "8820 Burnet Rd, Austin, TX 78757", rating: 4.4, reviews: 87, category: "Dentist" },
  { name: "Main Street Dentistry", address: "211 Main St, Round Rock, TX 78664", rating: 4.8, reviews: 302, category: "Dentist" },
];

type Integration = "gbp" | "gsc" | "ga4";
const integrations: { id: Integration; name: string; desc: string; icon: typeof Store; required?: boolean; scope: string; pick: string[] }[] = [
  { id: "gbp", name: "Google Business Profile", desc: "Read insights and reviews. Lets Groundwork publish approved changes.", icon: Store, required: true, scope: "business.manage", pick: ["Maple & Main — South Congress", "Maple & Main — Mueller"] },
  { id: "gsc", name: "Google Search Console", desc: "Queries, clicks and impressions, used to seed keywords and measure CTR.", icon: SearchCheck, scope: "webmasters.readonly", pick: ["sc-domain:mapleandmaindental.com", "https://mapleandmaindental.com/"] },
  { id: "ga4", name: "Google Analytics 4", desc: "Organic sessions and conversions (calls, bookings) attributed to SEO.", icon: BarChart3, scope: "analytics.readonly", pick: ["Maple & Main — GA4 (342881920)"] },
];

const gscQueries = [
  { term: "maple and main dental", impressions: 4210, clicks: 1290 },
  { term: "dentist south congress", impressions: 1840, clicks: 96 },
  { term: "emergency dentist austin", impressions: 1620, clicks: 41 },
  { term: "invisalign austin", impressions: 1210, clicks: 28 },
];

export default function Onboarding() {
  const [step, setStep] = useState(0);
  const navigate = useNavigate();
  const [query, setQuery] = useState("Maple & Main Dental");
  const [picked, setPicked] = useState<number | null>(null);
  const [connected, setConnected] = useState<Record<Integration, string | null>>({ gbp: null, gsc: null, ga4: null });
  const [oauth, setOauth] = useState<Integration | null>(null);
  const [selKw, setSelKw] = useState<Set<string>>(new Set(keywords.slice(0, 8).map((k) => k.term)));
  const [custom, setCustom] = useState("");
  const [selComp, setSelComp] = useState<Set<string>>(new Set(competitors.filter((c) => !c.isYou).slice(0, 4).map((c) => c.id)));
  const [size, setSize] = useState<"5" | "7" | "9">("7");
  const [radius, setRadius] = useState(3);
  const [freq, setFreq] = useState<"weekly" | "daily">("weekly");

  const canNext = [picked !== null, !!connected.gbp, selKw.size > 0, true, true, true][step];
  const toggle = <T,>(s: Set<T>, v: T) => { const n = new Set(s); n.has(v) ? n.delete(v) : n.add(v); return n; };

  return (
    <div className="flex min-h-full bg-bg">
      <aside className="hidden w-72 shrink-0 border-r border-line bg-sidebar px-6 py-8 md:block">
        <Link to="/" className="font-serif text-[20px]">Groundwork</Link>
        <p className="mt-1 text-[13px] text-muted">Set up local tracking in about 5 minutes.</p>
        <ol className="mt-10 space-y-1">
          {steps.map((s, i) => (
            <li key={s}>
              <button disabled={i > step} onClick={() => setStep(i)} className={cn("flex w-full items-center gap-3 rounded-md px-2 py-2 text-left text-[13.5px]", i === step ? "bg-active font-medium" : "text-muted enabled:hover:bg-hover")}>
                <span className={cn("grid size-5 place-items-center rounded-full border text-[11px]", i < step ? "border-ink bg-ink text-on-ink" : i === step ? "border-ink text-fg" : "border-line-strong")}>
                  {i < step ? <Check size={11} strokeWidth={3} /> : i + 1}
                </span>
                {s}
              </button>
            </li>
          ))}
        </ol>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex-1 overflow-y-auto">
          <div key={step} className="anim-fade mx-auto w-full max-w-2xl px-4 py-12 sm:px-8">
            <div className="mb-2 text-[12.5px] text-muted md:hidden">Step {step + 1} of {steps.length}</div>

            {step === 0 && (
              <>
                <h1 className="font-serif text-[34px] leading-tight">Find your business</h1>
                <p className="mt-2 text-muted">We'll pull your Google Business Profile, categories and reviews to start.</p>
                <div className="mt-8 flex items-center gap-2 rounded-lg border border-line bg-surface px-3 focus-within:border-line-strong">
                  <Search size={16} className="text-subtle" />
                  <input aria-label="Business name" value={query} onChange={(e) => setQuery(e.target.value)} className="h-11 flex-1 bg-transparent outline-none" placeholder="Business name or Google Maps URL" />
                </div>
                <div className="mt-1.5 text-[12px] text-subtle">Powered by DataForSEO Business Data · Google Maps</div>
                <ul className="mt-6 space-y-2">
                  {searchResults.map((r, i) => (
                    <li key={r.name}>
                      <button onClick={() => setPicked(i)} className={cn("flex w-full items-start gap-3 rounded-lg border bg-surface p-4 text-left transition-colors", picked === i ? "border-ink" : "border-line hover:border-line-strong")}>
                        <MapPin size={18} className="mt-0.5 text-accent" />
                        <div className="flex-1">
                          <div className="font-medium">{r.name}</div>
                          <div className="text-[13px] text-muted">{r.address}</div>
                          <div className="mt-1 flex items-center gap-2 text-[12.5px] text-muted">
                            <Star size={12} className="fill-current text-warn" /> {r.rating} · {r.reviews} reviews · {r.category}
                          </div>
                        </div>
                        {picked === i && <Check size={18} />}
                      </button>
                    </li>
                  ))}
                </ul>
              </>
            )}

            {step === 1 && (
              <>
                <h1 className="font-serif text-[34px] leading-tight">Connect your Google accounts</h1>
                <p className="mt-2 text-muted">Read-only by default. Groundwork only writes to your Business Profile or site after you approve each change.</p>
                <div className="mt-8 space-y-3">
                  {integrations.map((it) => (
                    <Card key={it.id} className="flex items-center gap-4">
                      <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-hover"><it.icon size={18} /></span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 font-medium">{it.name} {it.required && <Badge>Required</Badge>}</div>
                        <div className="text-[13px] text-muted">{connected[it.id] ? <span className="text-good">Connected · {connected[it.id]}</span> : it.desc}</div>
                      </div>
                      {connected[it.id] ? (
                        <Button size="sm" variant="ghost" onClick={() => setConnected({ ...connected, [it.id]: null })}>Disconnect</Button>
                      ) : (
                        <Button size="sm" variant="primary" onClick={() => setOauth(it.id)}>Connect</Button>
                      )}
                    </Card>
                  ))}
                </div>
                <div className="mt-6 flex items-start gap-2 text-[12.5px] text-muted"><ShieldCheck size={14} className="mt-0.5 shrink-0" /> Tokens are encrypted at rest. You can revoke access at any time from Settings or your Google account.</div>
                <OAuthModal integration={integrations.find((i) => i.id === oauth) ?? null} onClose={() => setOauth(null)} onDone={(id, prop) => { setConnected((c) => ({ ...c, [id]: prop })); setOauth(null); }} />
              </>
            )}

            {step === 2 && (
              <>
                <h1 className="font-serif text-[34px] leading-tight">Choose keywords to track</h1>
                <p className="mt-2 text-muted">Suggested from your Search Console queries and DataForSEO search volume for Austin, TX.</p>
                <div className="mt-8 flex items-center justify-between text-[13px]">
                  <span className="text-muted"><b className="num font-medium text-fg">{selKw.size}</b> selected · 25 included in your plan</span>
                  <button className="text-muted underline-offset-2 hover:underline" onClick={() => setSelKw(new Set())}>Clear</button>
                </div>
                {connected.gsc && (
                  <Card pad={false} className="mt-3">
                    <div className="border-b border-line px-4 py-2.5 text-[12.5px] font-medium text-muted">From Search Console · last 28 days</div>
                    {gscQueries.map((q) => (
                      <label key={q.term} className="flex cursor-pointer items-center gap-3 border-b border-line px-4 py-2.5 last:border-0 hover:bg-hover">
                        <Checkbox checked={selKw.has(q.term)} onChange={() => setSelKw(toggle(selKw, q.term))} />
                        <span className="flex-1">{q.term}</span>
                        <span className="num text-[12.5px] text-muted">{fmt(q.impressions)} impr · {fmt(q.clicks)} clicks</span>
                      </label>
                    ))}
                  </Card>
                )}
                <Card pad={false} className="mt-3">
                  <div className="border-b border-line px-4 py-2.5 text-[12.5px] font-medium text-muted">Suggested · monthly volume</div>
                  {keywords.slice(0, 12).map((k) => (
                    <label key={k.id} className="flex cursor-pointer items-center gap-3 border-b border-line px-4 py-2.5 last:border-0 hover:bg-hover">
                      <Checkbox checked={selKw.has(k.term)} onChange={() => setSelKw(toggle(selKw, k.term))} />
                      <span className="flex-1">{k.term}</span>
                      <span className="num text-[12.5px] text-muted">{fmt(k.volume)}/mo</span>
                    </label>
                  ))}
                </Card>
                <form className="mt-3 flex gap-2" onSubmit={(e) => { e.preventDefault(); if (custom.trim()) { setSelKw(new Set([...selKw, custom.trim()])); setCustom(""); } }}>
                  <input aria-label="Add a keyword" value={custom} onChange={(e) => setCustom(e.target.value)} placeholder="Add your own keyword" className="h-9 flex-1 rounded-md border border-line bg-surface px-3 outline-none focus:border-line-strong" />
                  <Button type="submit" icon={<Plus size={14} />}>Add</Button>
                </form>
              </>
            )}

            {step === 3 && (
              <>
                <h1 className="font-serif text-[34px] leading-tight">Who are you up against?</h1>
                <p className="mt-2 text-muted">These businesses appear most often in the map pack for your keywords. We'll benchmark them weekly.</p>
                <div className="mt-8 space-y-2">
                  {competitors.filter((c) => !c.isYou).map((c) => (
                    <Card key={c.id} className="flex items-center gap-4 !py-3.5">
                      <div className="min-w-0 flex-1">
                        <div className="font-medium">{c.name}</div>
                        <div className="text-[12.5px] text-muted">{c.rating} ★ · {c.reviews} reviews · {c.distanceMi} mi away · in pack for {Math.round(c.solv / 7)} of 8 keywords</div>
                      </div>
                      <Toggle label={`Track ${c.name}`} checked={selComp.has(c.id)} onChange={() => setSelComp(toggle(selComp, c.id))} />
                    </Card>
                  ))}
                </div>
                <Button className="mt-3" variant="ghost" icon={<Plus size={14} />}>Add competitor by name</Button>
              </>
            )}

            {step === 4 && (
              <>
                <h1 className="font-serif text-[34px] leading-tight">Set up your rank pack grid</h1>
                <p className="mt-2 text-muted">We search Google Maps from each point around your location to see where you show up in the local pack.</p>
                <div className="mt-8 grid gap-8 sm:grid-cols-[1fr_260px]">
                  <div>
                    <GridMap scan={makeGrid("kw_1", Number(size))} compact />
                    <div className="mt-3"><GridLegend /></div>
                  </div>
                  <div className="space-y-6">
                    <div>
                      <div className="mb-2 text-[13px] font-medium">Grid size</div>
                      <Segmented label="Grid size" value={size} onChange={setSize} options={[{ id: "5", label: "5×5" }, { id: "7", label: "7×7" }, { id: "9", label: "9×9" }]} />
                    </div>
                    <div>
                      <div className="mb-2 flex justify-between text-[13px]"><span className="font-medium">Radius</span><span className="num text-muted">{radius} mi</span></div>
                      <input aria-label="Radius in miles" type="range" min={1} max={10} value={radius} onChange={(e) => setRadius(Number(e.target.value))} className="w-full accent-[var(--ink)]" />
                    </div>
                    <div>
                      <div className="mb-2 text-[13px] font-medium">Frequency</div>
                      <Segmented label="Scan frequency" value={freq} onChange={setFreq} options={[{ id: "weekly", label: "Weekly" }, { id: "daily", label: "Daily" }]} />
                    </div>
                    <div className="rounded-lg bg-hover p-3 text-[12.5px] text-muted">
                      <div className="num">{Number(size) ** 2} points × {selKw.size} keywords = <b className="font-medium text-fg">{fmt(Number(size) ** 2 * selKw.size)}</b> SERP checks</div>
                      <div className="num mt-1">≈ ${(estimateGridCost(Number(size), selKw.size) * (freq === "daily" ? 30 : 4)).toFixed(2)} / month in DataForSEO credits</div>
                    </div>
                  </div>
                </div>
              </>
            )}

            {step === 5 && <Launch kw={selKw.size} comp={selComp.size} onDone={() => navigate("/")} />}
          </div>
        </div>

        {step < 5 && (
          <div className="border-t border-line bg-bg">
            <div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-3 sm:px-8">
              <Button variant="ghost" icon={<ArrowLeft size={14} />} onClick={() => (step ? setStep(step - 1) : navigate("/"))}>{step ? "Back" : "Exit"}</Button>
              <div className="flex items-center gap-2">
                {step === 1 && !connected.gsc && <Button variant="ghost" onClick={() => setStep(2)} disabled={!connected.gbp}>Skip optional</Button>}
                <Button variant="primary" disabled={!canNext} onClick={() => setStep(step + 1)}>
                  {step === 4 ? "Start first scan" : "Continue"} <ArrowRight size={14} />
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function OAuthModal({ integration, onClose, onDone }: { integration: (typeof integrations)[number] | null; onClose: () => void; onDone: (id: Integration, prop: string) => void }) {
  const [phase, setPhase] = useState<"consent" | "loading" | "pick">("consent");
  const [choice, setChoice] = useState(0);
  useEffect(() => { setPhase("consent"); setChoice(0); }, [integration?.id]);
  useEffect(() => {
    if (phase !== "loading") return;
    const t = setTimeout(() => setPhase("pick"), 900);
    return () => clearTimeout(t);
  }, [phase]);
  if (!integration) return null;
  return (
    <Modal
      open
      onClose={onClose}
      title={phase === "pick" ? "Choose a property" : `Connect ${integration.name}`}
      footer={
        phase === "consent" ? (
          <><Button variant="ghost" onClick={onClose}>Cancel</Button><Button variant="primary" onClick={() => setPhase("loading")}>Continue with Google</Button></>
        ) : phase === "pick" ? (
          <Button variant="primary" onClick={() => onDone(integration.id, integration.pick[choice])}>Use this property</Button>
        ) : null
      }
    >
      {phase === "consent" && (
        <div className="space-y-3 text-[13.5px]">
          <p className="text-muted">You'll be redirected to Google to grant access. Groundwork will request:</p>
          <div className="rounded-lg border border-line p-3 font-mono text-[12px] text-muted">https://www.googleapis.com/auth/{integration.scope}</div>
          <p className="text-[12.5px] text-subtle">Mock flow: no data leaves this browser.</p>
        </div>
      )}
      {phase === "loading" && <div className="flex items-center gap-2 py-8 text-muted"><Loader2 size={16} className="animate-spin" /> Waiting for Google…</div>}
      {phase === "pick" && (
        <div className="space-y-2">
          {integration.pick.map((p, i) => (
            <label key={p} className={cn("flex cursor-pointer items-center gap-3 rounded-lg border p-3", choice === i ? "border-ink" : "border-line hover:bg-hover")}>
              <input type="radio" name="prop" checked={choice === i} onChange={() => setChoice(i)} className="accent-[var(--ink)]" />
              <span className="text-[13.5px]">{p}</span>
            </label>
          ))}
        </div>
      )}
    </Modal>
  );
}

const launchTasks = [
  "Importing Business Profile & reviews",
  "Pulling 16 months of Search Console data",
  "Fetching search volume from DataForSEO",
  "Running geo-grid scan",
  "Crawling mapleandmaindental.com",
  "Benchmarking competitors",
  "Building your action plan",
];

function Launch({ kw, comp, onDone }: { kw: number; comp: number; onDone: () => void }) {
  const [done, setDone] = useState(0);
  useEffect(() => {
    if (done >= launchTasks.length) return;
    const t = setTimeout(() => setDone((d) => d + 1), 650);
    return () => clearTimeout(t);
  }, [done]);
  const finished = done >= launchTasks.length;
  return (
    <>
      <h1 className="font-serif text-[34px] leading-tight">{finished ? "You're all set" : "Running your first scan"}</h1>
      <p className="mt-2 text-muted">Tracking {kw} keywords against {comp} competitors. You can leave this page, we'll keep going.</p>
      <ul className="mt-8 space-y-3">
        {launchTasks.map((t, i) => (
          <li key={t} className={cn("flex items-center gap-3 text-[14px] transition-opacity", i > done && "opacity-40")}>
            <span className="grid size-5 place-items-center">
              {i < done ? <Check size={16} className="text-good" /> : i === done ? <Loader2 size={15} className="animate-spin text-muted" /> : <span className="size-1.5 rounded-full bg-line-strong" />}
            </span>
            {t}
          </li>
        ))}
      </ul>
      {finished && (
        <Card className="anim-fade mt-8">
          <div className="text-[13px] text-muted">First look</div>
          <div className="mt-2 font-serif text-[20px]">You show in the top 3 at 31% of grid points. We found 7 improvements, 5 of which Groundwork can apply for you.</div>
          <Button className="mt-5" variant="primary" onClick={onDone}>Open dashboard <ArrowRight size={14} /></Button>
        </Card>
      )}
    </>
  );
}
