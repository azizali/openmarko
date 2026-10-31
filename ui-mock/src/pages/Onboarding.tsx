import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router";
import { Check, Search, MapPin, Loader2, Plus, ArrowLeft, ArrowRight, ShieldCheck, Store, BarChart3, SearchCheck, Globe, Sparkles } from "lucide-react";
import { Button, Badge, Card, Checkbox, Modal, Segmented, Toggle, cn, fmt } from "../components/ui";
import { Logo } from "../components/Logo";
import { ExternalUrl } from "../components/Scope";
import { PlatformMark } from "../components/Social";
import { PlatformBadge } from "./SocialScanner";
import { WordList } from "./Brand";
import { business, locations } from "../data/mock";
import { addMembership, shortLocation, websites } from "../data/org";
import { accounts, platformMeta, type SocialPlatform } from "../data/social";
import { brandFacts, voice } from "../data/brand";
import { competitorsFor, keywordsFor, locationData } from "../data/scoped";
import { platformOf as scanPlatform, type PlatformId } from "../data/scanner";
import { useScanner } from "../lib/scanner";
import { estimateGridCost } from "../lib/api";
import { setScope } from "../lib/scope";

// Adding an Organization. Start from its website (or name); OpenMarko reads the
// site and Google to find its Locations, Websites and social Accounts, drafts
// its Brand voice, and suggests what to track. Every suggestion is pre-ticked
// and can be changed later in Settings.
//
// Real build: crawl the site (contact, footer and location pages), match Google
// Business Profiles by name, phone and address, follow social links in the
// footer and on each profile, then have Claude draft the voice from the site
// and reviews and pick keywords from Search Console, the site's service pages
// and nearby search volume.

const steps = ["Start", "What we found", "Connect", "Brand voice", "What to track", "Launch"];

type GoogleTool = "gbp" | "gsc" | "ga4";
const googleTools: { id: GoogleTool; name: string; desc: string; icon: typeof Store; required?: boolean; scope: string; pick: string[] }[] = [
  { id: "gbp", name: "Google Business Profile", desc: "Reviews, calls and posting for each location. Rankings and competitors work without it.", icon: Store, scope: "business.manage", pick: locations.map((l) => l.name) },
  { id: "gsc", name: "Google Search Console", desc: "Searches that already find you, used to pick keywords.", icon: SearchCheck, scope: "webmasters.readonly", pick: websites.map((w) => `sc-domain:${w.domain}`) },
  { id: "ga4", name: "Google Analytics 4", desc: "Calls and bookings that came from search.", icon: BarChart3, scope: "analytics.readonly", pick: ["Maple & Main — GA4 (342881920)", "Mueller — GA4 (418220913)"] },
];

/** The sign-ins that connect social Accounts. One Meta sign-in covers Instagram and Facebook. */
const socialLogins: { id: string; name: string; platforms: SocialPlatform[] }[] = [
  { id: "meta", name: "Meta", platforms: ["instagram", "facebook"] },
  { id: "tiktok", name: "TikTok", platforms: ["tiktok"] },
  { id: "x", name: "X", platforms: ["x"] },
];

const reading = ["Reading the website", "Finding Google profiles for each location", "Following links to social profiles", "Reading 276 reviews to learn how you sound", "Looking up what people search for nearby"];

export default function Onboarding() {
  const navigate = useNavigate();
  const { config } = useScanner();
  const [step, setStep] = useState(0);
  const [query, setQuery] = useState(business.website);
  const [read, setRead] = useState(-1); // -1 not started; reading.length = done
  const [name, setName] = useState(business.name);
  const [category, setCategory] = useState(brandFacts.category);
  const [locSel, setLocSel] = useState(new Set(locations.map((l) => l.id)));
  const [siteFor, setSiteFor] = useState<Record<string, string>>(Object.fromEntries(websites.map((w) => [w.id, w.locationIds[0]])));
  const found = accounts.filter((a) => a.platform !== "google");
  const [acctSel, setAcctSel] = useState(new Set(found.filter((a) => a.connected).map((a) => a.id)));
  const [speaksFor, setSpeaksFor] = useState<Record<string, string>>(Object.fromEntries(found.map((a) => [a.id, a.locationId ?? ""])));
  const [google, setGoogle] = useState<Record<GoogleTool, string | null>>({ gbp: null, gsc: null, ga4: null });
  const [oauth, setOauth] = useState<GoogleTool | null>(null);
  const [social, setSocial] = useState<Record<string, "idle" | "busy" | "done">>({});
  const [summary, setSummary] = useState(voice.summary);
  const [use, setUse] = useState(voice.use);
  const [avoid, setAvoid] = useState(voice.avoid);
  const [services, setServices] = useState(brandFacts.services);
  const [kwSel, setKwSel] = useState<Record<string, Set<string>>>(Object.fromEntries(locations.map((l) => [l.id, new Set(keywordsFor(l.id).slice(0, 8).map((k) => k.id))])));
  const [compSel, setCompSel] = useState<Record<string, Set<string>>>(Object.fromEntries(locations.map((l) => [l.id, new Set(competitorsFor(l.id).filter((c) => !c.isYou).slice(0, 3).map((c) => c.id))])));
  const [size, setSize] = useState<"5" | "7" | "9">("7");
  const [freq, setFreq] = useState<"weekly" | "daily">("weekly");
  const [places, setPlaces] = useState<Record<string, string[]>>(Object.fromEntries(config.sources.map((s) => [s.platform, s.places])));
  const [terms, setTerms] = useState(Object.values(config.terms).flat());
  const [topics, setTopics] = useState(config.trending.topics);

  useEffect(() => {
    if (read < 0 || read >= reading.length) return;
    const t = setTimeout(() => setRead((r) => r + 1), 450);
    return () => clearTimeout(t);
  }, [read]);
  const doneReading = read >= reading.length;

  const toggle = <T,>(s: Set<T>, v: T) => { const n = new Set(s); n.has(v) ? n.delete(v) : n.add(v); return n; };
  const chosenLocs = locations.filter((l) => locSel.has(l.id));
  const kwCount = chosenLocs.reduce((a, l) => a + kwSel[l.id].size, 0);
  const compCount = chosenLocs.reduce((a, l) => a + compSel[l.id].size, 0);
  // Nothing is required beyond a name: someone may only want local rankings, or only social.
  const canNext = [doneReading && !!name.trim(), true, true, true, true, true][step];
  const connectSocial = (id: string) => { setSocial((s) => ({ ...s, [id]: "busy" })); setTimeout(() => setSocial((s) => ({ ...s, [id]: "done" })), 900); };
  const finish = () => {
    // A new Client joins the switcher; the mock keeps showing Maple & Main's data.
    if (name.trim() !== business.name) setScope({ orgId: addMembership(name.trim(), category), locationId: null });
    navigate("/");
  };

  return (
    <div className="flex min-h-full bg-bg">
      <aside className="hidden w-72 shrink-0 border-r border-line bg-sidebar px-6 py-8 md:block">
        <Link to="/" aria-label="OpenMarko home"><Logo size={22} /></Link>
        <p className="mt-1 text-[13px] text-muted">Add an organization in about 5 minutes. We read your website and suggest the rest.</p>
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
                <h1 className="font-serif text-[34px] leading-tight">Add an organization</h1>
                <p className="mt-2 text-muted">Start with the website, or the business name if there isn't one. We'll find the locations, Google profiles and social accounts, and learn how the business sounds.</p>
                <form onSubmit={(e) => { e.preventDefault(); if (query.trim()) setRead(0); }} className="mt-8 flex gap-2">
                  <div className="flex flex-1 items-center gap-2 rounded-lg border border-line bg-surface px-3 focus-within:border-line-strong">
                    <Search size={16} className="text-subtle" />
                    <input aria-label="Website or business name" value={query} onChange={(e) => { setQuery(e.target.value); setRead(-1); }} className="h-11 flex-1 bg-transparent outline-none" placeholder="yourbusiness.com, or a business name" />
                  </div>
                  <Button type="submit" variant="primary" className="h-11" disabled={!query.trim() || (read >= 0 && !doneReading)}>{read < 0 ? "Read it" : doneReading ? "Read again" : "Reading…"}</Button>
                </form>
                {read >= 0 && (
                  <ul className="mt-6 space-y-2.5">
                    {reading.map((r, i) => (
                      <li key={r} className={cn("flex items-center gap-3 text-[14px] transition-opacity", i > read && "opacity-40")}>
                        <span className="grid size-5 place-items-center">{i < read ? <Check size={16} className="text-good" /> : i === read ? <Loader2 size={15} className="animate-spin text-muted" /> : <span className="size-1.5 rounded-full bg-line-strong" />}</span>
                        {r}
                      </li>
                    ))}
                  </ul>
                )}
                {doneReading && (
                  <Card className="anim-fade mt-6 grid gap-4 sm:grid-cols-2">
                    <label className="block text-[13px]"><span className="mb-1 block text-muted">Organization name</span><input value={name} onChange={(e) => setName(e.target.value)} className="h-9 w-full rounded-md border border-line bg-surface px-3 outline-none focus:border-line-strong" /></label>
                    <label className="block text-[13px]"><span className="mb-1 block text-muted">What it is</span><input value={category} onChange={(e) => setCategory(e.target.value)} className="h-9 w-full rounded-md border border-line bg-surface px-3 outline-none focus:border-line-strong" /></label>
                    <p className="m-0 text-[12.5px] text-muted sm:col-span-2">Found {locations.length} locations, {websites.length} websites and {found.length} social profiles. Check them on the next step.</p>
                  </Card>
                )}
              </>
            )}

            {step === 1 && (
              <>
                <h1 className="font-serif text-[34px] leading-tight">Here's what we found</h1>
                <p className="mt-2 text-muted">Untick anything that isn't {name}'s, or that you don't want to use yet. OpenMarko works with any of these on its own: just a location, just a website, or just social accounts. You can add the rest later in Settings.</p>

                <Section title="Locations" sub="Places customers visit. Each has its own Google profile, keywords and map rankings.">
                  {locations.map((l) => (
                    <label key={l.id} className="flex cursor-pointer items-start gap-3 border-b border-line px-4 py-3 last:border-0 hover:bg-hover/50">
                      <Checkbox checked={locSel.has(l.id)} onChange={() => setLocSel(toggle(locSel, l.id))} label={`Include ${shortLocation(l.id)}`} />
                      <MapPin size={16} className="mt-0.5 shrink-0 text-accent" />
                      <span className="min-w-0 flex-1">
                        <span className="block text-[14px] font-medium">{shortLocation(l.id)}</span>
                        <span className="block text-[12.5px] text-muted">{l.address} · Google profile, {locationData[l.id].rating}★ from {locationData[l.id].reviewCount} reviews</span>
                      </span>
                    </label>
                  ))}
                  <button className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-[13px] text-muted hover:bg-hover/50"><Plus size={14} /> Add a location we missed</button>
                </Section>

                <Section title="Websites" sub="Which location each site is for.">
                  {websites.map((w) => (
                    <div key={w.id} className="flex flex-wrap items-center gap-3 border-b border-line px-4 py-3 last:border-0">
                      <Globe size={16} className="shrink-0 text-muted" />
                      <span className="min-w-0 flex-1 text-[14px]"><ExternalUrl domain={w.domain} /></span>
                      <label className="flex items-center gap-2 text-[12.5px] text-muted">Serves
                        <select value={siteFor[w.id]} onChange={(e) => setSiteFor({ ...siteFor, [w.id]: e.target.value })} className="h-8 rounded-md border border-line bg-surface px-2 text-[13px] text-fg outline-none">
                          <option value="all">All locations</option>
                          {chosenLocs.map((l) => <option key={l.id} value={l.id}>{shortLocation(l.id)}</option>)}
                        </select>
                      </label>
                    </div>
                  ))}
                </Section>

                <Section title="Social accounts" sub="Linked from the websites and Google profiles. Each speaks for every location unless you pick one.">
                  {found.map((a) => (
                    <div key={a.id} className="flex flex-wrap items-center gap-3 border-b border-line px-4 py-3 last:border-0">
                      <Checkbox checked={acctSel.has(a.id)} onChange={() => setAcctSel(toggle(acctSel, a.id))} label={`Include ${a.handle}`} />
                      <PlatformMark platform={a.platform} size={22} />
                      <span className="min-w-0 flex-1">
                        <span className="block text-[14px] font-medium">{a.handle}</span>
                        <span className="block text-[12.5px] text-muted">{platformMeta[a.platform].name}{a.followers ? ` · ${fmt(a.followers)} followers` : " · found on your website, not confirmed"}</span>
                      </span>
                      {chosenLocs.length > 1 && (
                        <select aria-label={`${a.handle} speaks for`} value={speaksFor[a.id]} onChange={(e) => setSpeaksFor({ ...speaksFor, [a.id]: e.target.value })} className="h-8 rounded-md border border-line bg-surface px-2 text-[13px] outline-none">
                          <option value="">All locations</option>
                          {chosenLocs.map((l) => <option key={l.id} value={l.id}>{shortLocation(l.id)}</option>)}
                        </select>
                      )}
                    </div>
                  ))}
                  <button className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-[13px] text-muted hover:bg-hover/50"><Plus size={14} /> Add an account we missed</button>
                </Section>
              </>
            )}

            {step === 2 && (
              <>
                <h1 className="font-serif text-[34px] leading-tight">Connect the accounts</h1>
                <p className="mt-2 text-muted">All optional. Connect what you want to use now; pages that need something you skip will say so and connect it in one click. Read-only by default: OpenMarko only posts or changes something after you approve it.</p>
                <div className="mt-8 mb-2 text-[12.5px] font-medium text-muted">Google</div>
                <div className="space-y-3">
                  {googleTools.map((it) => (
                    <Card key={it.id} className="flex items-center gap-4">
                      <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-hover"><it.icon size={18} /></span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 font-medium">{it.name} {it.required && <Badge>Required</Badge>}</div>
                        <div className="text-[13px] text-muted">{google[it.id] ? <span className="text-good">Connected · {google[it.id]}</span> : it.desc}</div>
                      </div>
                      {google[it.id]
                        ? <Button size="sm" variant="ghost" onClick={() => setGoogle({ ...google, [it.id]: null })}>Disconnect</Button>
                        : <Button size="sm" variant="primary" onClick={() => setOauth(it.id)}>Connect</Button>}
                    </Card>
                  ))}
                </div>
                <div className="mt-8 mb-2 text-[12.5px] font-medium text-muted">Social</div>
                <Card pad={false}>
                  {socialLogins.filter((s) => found.some((a) => acctSel.has(a.id) && s.platforms.includes(a.platform))).map((s) => {
                    const mine = found.filter((a) => acctSel.has(a.id) && s.platforms.includes(a.platform));
                    return (
                      <div key={s.id} className="flex items-center gap-4 border-b border-line px-5 py-4 last:border-0">
                        <span className="flex -space-x-1">{s.platforms.map((p) => <PlatformMark key={p} platform={p} size={26} />)}</span>
                        <div className="min-w-0 flex-1">
                          <div className="font-medium">{s.name}</div>
                          <div className="truncate text-[13px] text-muted">{social[s.id] === "done" ? <span className="text-good">Connected · {mine.map((a) => a.handle).join(", ")}</span> : mine.map((a) => a.handle).join(", ")}</div>
                        </div>
                        {social[s.id] === "done" ? <Badge tone="good"><Check size={10} /> Connected</Badge>
                          : <Button size="sm" variant="primary" disabled={social[s.id] === "busy"} onClick={() => connectSocial(s.id)}>{social[s.id] === "busy" ? <Loader2 size={13} className="animate-spin" /> : "Connect"}</Button>}
                      </div>
                    );
                  })}
                </Card>
                <div className="mt-6 flex items-start gap-2 text-[12.5px] text-muted"><ShieldCheck size={14} className="mt-0.5 shrink-0" /> Tokens are encrypted at rest. Revoke access any time from Settings or from each platform.</div>
                <OAuthModal tool={googleTools.find((i) => i.id === oauth) ?? null} onClose={() => setOauth(null)} onDone={(id, prop) => { setGoogle((c) => ({ ...c, [id]: prop })); setOauth(null); }} />
              </>
            )}

            {step === 3 && (
              <>
                <h1 className="font-serif text-[34px] leading-tight">How {name} sounds</h1>
                <p className="mt-2 text-muted">Drafted from the websites and {locations.reduce((a, l) => a + locationData[l.id].reviewCount, 0)} review replies. Every post, reply and article will use it, for every location.</p>
                <Card className="mt-8">
                  <div className="mb-2 flex items-center gap-1.5 text-[12.5px] font-medium text-muted"><Sparkles size={13} className="text-accent" /> The voice in a sentence</div>
                  <textarea aria-label="Voice summary" value={summary} onChange={(e) => setSummary(e.target.value)} rows={3} className="w-full resize-y rounded-lg border border-line bg-surface p-3 text-[14px] leading-[1.55] outline-none focus:border-line-strong" />
                  <div className="mt-4 flex flex-col gap-4">
                    <WordList label="Say" words={use} onChange={setUse} />
                    <WordList label="Never say" words={avoid} onChange={setAvoid} />
                    <WordList label="Services" words={services} onChange={setServices} />
                  </div>
                </Card>
                <p className="mt-3 text-[12.5px] text-subtle">Tone, offers and rules are in Settings → Brand voice once you're set up.</p>
              </>
            )}

            {step === 4 && (
              <>
                <h1 className="font-serif text-[34px] leading-tight">What to track</h1>
                <p className="mt-2 text-muted">Suggested from the websites, Search Console and what people search nearby. Everything is ticked; untick what you don't want.</p>

                {!chosenLocs.length && <Card className="mt-8 text-[13.5px] text-muted">No locations picked, so there are no keywords, map scans or competitors to track. Add a location any time in Settings → Locations.</Card>}
                {chosenLocs.map((l) => {
                  const kws = keywordsFor(l.id);
                  return (
                    <Section key={l.id} title={chosenLocs.length > 1 ? `Keywords · ${shortLocation(l.id)}` : "Keywords"} sub={`${kwSel[l.id].size} of ${kws.length} suggested · measured from around ${shortLocation(l.id)}`}>
                      {kws.slice(0, 10).map((k) => (
                        <label key={k.id} className="flex cursor-pointer items-center gap-3 border-b border-line px-4 py-2.5 last:border-0 hover:bg-hover/50">
                          <Checkbox checked={kwSel[l.id].has(k.id)} onChange={() => setKwSel({ ...kwSel, [l.id]: toggle(kwSel[l.id], k.id) })} label={`Track ${k.term}`} />
                          <span className="flex-1 text-[14px]">{k.term}</span>
                          <span className="num text-[12.5px] text-muted">{fmt(k.volume)}/mo</span>
                        </label>
                      ))}
                    </Section>
                  );
                })}

                {chosenLocs.map((l) => (
                  <Section key={l.id} title={chosenLocs.length > 1 ? `Competitors · ${shortLocation(l.id)}` : "Competitors"} sub="The businesses that show up most in the map pack around this location.">
                    {competitorsFor(l.id).filter((c) => !c.isYou).map((c) => (
                      <div key={c.id} className="flex items-center gap-3 border-b border-line px-4 py-2.5 last:border-0">
                        <span className="min-w-0 flex-1"><span className="block text-[14px]">{c.name}</span><span className="block text-[12.5px] text-muted">{c.rating}★ · {c.reviews} reviews · {c.distanceMi} mi away</span></span>
                        <Toggle label={`Track ${c.name}`} checked={compSel[l.id].has(c.id)} onChange={() => setCompSel({ ...compSel, [l.id]: toggle(compSel[l.id], c.id) })} />
                      </div>
                    ))}
                  </Section>
                ))}

                {chosenLocs.length > 0 && <Section title="Map scans" sub="We check Google Maps from points around each location to see where it shows up.">
                  <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-[13.5px]">
                    <Segmented label="Grid size" value={size} onChange={setSize} options={[{ id: "5", label: "5×5" }, { id: "7", label: "7×7" }, { id: "9", label: "9×9" }]} />
                    <Segmented label="Scan frequency" value={freq} onChange={setFreq} options={[{ id: "weekly", label: "Weekly" }, { id: "daily", label: "Daily" }]} />
                    <span className="num text-[12.5px] text-muted">≈ ${(estimateGridCost(Number(size), kwCount) * (freq === "daily" ? 30 : 4)).toFixed(2)} / month</span>
                  </div>
                </Section>}

                <Section title="Conversations to join" sub="Where the social scanner looks for people asking for a business like yours.">
                  {config.sources.map((s) => (
                    <div key={s.platform} className="flex items-start gap-3 border-b border-line px-4 py-3 last:border-0">
                      <PlatformBadge id={s.platform as PlatformId} size={22} />
                      <div className="min-w-0 flex-1"><WordList label={`${scanPlatform(s.platform).name} · ${scanPlatform(s.platform).places}`} words={places[s.platform] ?? []} onChange={(w) => setPlaces({ ...places, [s.platform]: w })} /></div>
                    </div>
                  ))}
                  <div className="px-4 py-3"><WordList label="Listening for" words={terms} onChange={setTerms} /></div>
                </Section>

                <Section title="Trending" sub="Trends are scored for fit against these topics and the brand voice.">
                  <div className="px-4 py-3"><WordList label="Topics" words={topics} onChange={setTopics} /></div>
                </Section>
              </>
            )}

            {step === 5 && <Launch name={name} locs={chosenLocs.length} kw={kwCount} comp={compCount} accounts={acctSel.size} onDone={finish} />}
          </div>
        </div>

        {step < 5 && (
          <div className="border-t border-line bg-bg">
            <div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-3 sm:px-8">
              <Button variant="ghost" icon={<ArrowLeft size={14} />} onClick={() => (step ? setStep(step - 1) : navigate("/"))}>{step ? "Back" : "Cancel"}</Button>
              <div className="flex items-center gap-2">
                {(step === 1 || step === 2) && <Button variant="ghost" onClick={() => setStep(step + 1)}>Skip for now</Button>}
                <Button variant="primary" disabled={!canNext} onClick={() => setStep(step + 1)}>
                  {step === 4 ? "Finish setup" : "Continue"} <ArrowRight size={14} />
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Section({ title, sub, children }: { title: string; sub?: string; children: React.ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="m-0 text-[15px] font-medium">{title}</h2>
      {sub && <p className="mt-0.5 mb-0 text-[13px] text-muted">{sub}</p>}
      <Card pad={false} className="mt-3">{children}</Card>
    </section>
  );
}

function OAuthModal({ tool, onClose, onDone }: { tool: (typeof googleTools)[number] | null; onClose: () => void; onDone: (id: GoogleTool, prop: string) => void }) {
  const [phase, setPhase] = useState<"consent" | "loading" | "pick">("consent");
  const [choice, setChoice] = useState<Set<number>>(new Set([0]));
  useEffect(() => { setPhase("consent"); setChoice(new Set(tool ? tool.pick.map((_, i) => i) : [0])); }, [tool?.id]);
  useEffect(() => {
    if (phase !== "loading") return;
    const t = setTimeout(() => setPhase("pick"), 900);
    return () => clearTimeout(t);
  }, [phase]);
  if (!tool) return null;
  return (
    <Modal
      open
      onClose={onClose}
      title={phase === "pick" ? "Which ones are this organization's?" : `Connect ${tool.name}`}
      footer={
        phase === "consent" ? (
          <><Button variant="ghost" onClick={onClose}>Cancel</Button><Button variant="primary" onClick={() => setPhase("loading")}>Continue with Google</Button></>
        ) : phase === "pick" ? (
          <Button variant="primary" disabled={!choice.size} onClick={() => onDone(tool.id, tool.pick.filter((_, i) => choice.has(i)).join(", "))}>Use {choice.size} selected</Button>
        ) : null
      }
    >
      {phase === "consent" && (
        <div className="space-y-3 text-[13.5px]">
          <p className="text-muted">You'll be redirected to Google to grant access. OpenMarko will request:</p>
          <div className="rounded-lg border border-line p-3 font-mono text-[12px] text-muted">https://www.googleapis.com/auth/{tool.scope}</div>
          <p className="text-[12.5px] text-subtle">Mock flow: no data leaves this browser.</p>
        </div>
      )}
      {phase === "loading" && <div className="flex items-center gap-2 py-8 text-muted"><Loader2 size={16} className="animate-spin" /> Waiting for Google…</div>}
      {phase === "pick" && (
        <div className="space-y-2">
          {tool.pick.map((p, i) => (
            <label key={p} className={cn("flex cursor-pointer items-center gap-3 rounded-lg border p-3", choice.has(i) ? "border-ink" : "border-line hover:bg-hover")}>
              <Checkbox checked={choice.has(i)} onChange={() => { const n = new Set(choice); n.has(i) ? n.delete(i) : n.add(i); setChoice(n); }} />
              <span className="text-[13.5px]">{p}</span>
            </label>
          ))}
        </div>
      )}
    </Modal>
  );
}

function Launch({ name, locs, kw, comp, accounts: acc, onDone }: { name: string; locs: number; kw: number; comp: number; accounts: number; onDone: () => void }) {
  const tasks = [
    `Importing ${locs} Google profile${locs === 1 ? "" : "s"} and their reviews`,
    `Reading ${websites.length} website${websites.length === 1 ? "" : "s"}`,
    `Connecting ${acc} social account${acc === 1 ? "" : "s"}`,
    `Running map scans for ${kw} keywords`,
    `Benchmarking ${comp} competitors`,
    "Scanning for conversations to join",
    "Finding trends that fit",
    "Writing the first to-dos",
  ];
  const [done, setDone] = useState(0);
  useEffect(() => {
    if (done >= tasks.length) return;
    const t = setTimeout(() => setDone((d) => d + 1), 600);
    return () => clearTimeout(t);
  }, [done]);
  const finished = done >= tasks.length;
  return (
    <>
      <h1 className="font-serif text-[34px] leading-tight">{finished ? `${name} is set up` : "Setting things up"}</h1>
      <p className="mt-2 text-muted">You can leave this page; we'll keep going.</p>
      <ul className="mt-8 space-y-3">
        {tasks.map((t, i) => (
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
          <div className="mt-2 font-serif text-[20px]">South Congress is in the top 3 at 31% of nearby searches, Mueller at 18%. We found 7 changes to make, 3 conversations to join and 5 trends that fit.</div>
          <Button className="mt-5" variant="primary" onClick={onDone}>Open {name} <ArrowRight size={14} /></Button>
        </Card>
      )}
    </>
  );
}
