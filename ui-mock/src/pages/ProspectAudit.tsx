import { useMemo, type ReactNode } from "react";
import { Link, useParams, useSearchParams } from "react-router";
import { Copy, Printer, Star, Check, X, Zap, TrendingUp, UserPlus, Globe } from "lucide-react";
import { Badge, Button, Card, CardHeader, PageHeader, ScoreRing, cn, fmt, useToast } from "../components/ui";
import { ProspectMap } from "../components/ProspectMap";
import { ContactCard } from "../components/ProspectContact";
import { ShareAuditButton } from "../components/ShareAudit";
import { prospectAi } from "../data/ai";
import { ExternalUrl } from "../components/Scope";
import { findProspect, leadersOf, opportunity, profileScore, searchMarket, specFromParams, specToQuery, visibilityScore, type Market, type Prospect } from "../data/prospects";

const impactTone = { high: "good", medium: "info", low: "neutral" } as const;

export default function ProspectAudit() {
  const { id = "" } = useParams();
  const [params] = useSearchParams();
  const spec = specFromParams(params);
  const qs = specToQuery(spec);
  const market = useMemo(() => searchMarket(spec), [qs]);
  const p = findProspect(market, id);
  const { toast, node } = useToast();

  if (!p) {
    return (
      <Card className="py-16 text-center">
        <div className="font-medium">Prospect not found</div>
        <p className="mt-1 text-[13px] text-muted">Run the search again to refresh the list.</p>
        <Link to={spec.biz ? "/prospects" : `/prospects${qs}`} className="mt-4 inline-block text-[13px] underline">Back to prospects</Link>
      </Card>
    );
  }

  const o = opportunity(p, market);
  const leaders = leadersOf(market).filter((l) => l.id !== p.id);
  const pitch = pitchText(p, market, leaders, o);

  const copy = async () => {
    try { await navigator.clipboard.writeText(pitch); toast("Pitch copied to clipboard"); } catch { toast("Couldn't access the clipboard"); }
  };

  return (
    <>
      <PageHeader
        crumbs={<span className="print:hidden"><Link to={spec.biz ? "/prospects" : `/prospects${qs}`} className="hover:text-fg">Prospects</Link> / {spec.biz ? "Direct audit" : <>“{market.keyword}” in {market.city}</>}</span>}
        title={p.name}
        sub={<>Local visibility audit for <b className="font-medium text-fg">“{market.keyword}”</b> in {market.city} · {p.address} · prepared {new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</>}
        actions={
          <div className="flex flex-wrap gap-2 print:hidden">
            <ShareAuditButton path={`/prospects/${p.id}${qs}`} name={p.name} />
            <Button icon={<Copy size={14} />} onClick={copy}>Copy pitch</Button>
            <Button icon={<Printer size={14} />} onClick={() => window.print()}>Save as PDF</Button>
            <Button variant="primary" icon={<UserPlus size={14} />} onClick={() => toast(`${p.name} added to pipeline`)}>Add to pipeline</Button>
          </div>
        }
      />

      <AuditBody p={p} market={market} o={o} beforeSections={
      <Card className="mb-8 print:hidden">
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-[15px] font-medium">Who to contact</h2>
          <span className="text-[12px] text-subtle">Only you see this. It's left out of the PDF.</span>
        </div>
        <ContactCard p={p} />
      </Card>
      } />

      <section className="mb-4 print:hidden">
        <SectionTitle n={6} title="Your pitch" sub="For you, not the prospect. Copy it into an email or use it on the call." />
        <Card>
          <div className="mb-4 flex flex-wrap gap-2">
            {o.reasons.map((r) => <Badge key={r} tone="neutral">{r}</Badge>)}
          </div>
          <pre className="rounded-lg bg-bg p-4 font-sans text-[13.5px] whitespace-pre-wrap">{pitch}</pre>
          <div className="mt-3 flex justify-end"><Button icon={<Copy size={14} />} onClick={copy}>Copy pitch</Button></div>
        </Card>
      </section>
      {node}
    </>
  );
}

/** The audit itself: shared by the internal page and the public share link (#/a/:token). */
export function AuditBody({ p, market, o, publicView = false, beforeSections }: { p: Prospect; market: Market; o: ReturnType<typeof opportunity>; publicView?: boolean; beforeSections?: ReactNode }) {
  const they = publicView ? "you" : "they", them = publicView ? "you" : "them", theyre = publicView ? "you're" : "they're";
  const ai = prospectAi(p, market);
  const vis = visibilityScore(p);
  return (
    <>
      {/* Headline: the one-paragraph story the prospect should take away. */}
      <Card className="mb-6">
        <div className="flex flex-col gap-6 md:flex-row md:items-center">
          <div className="flex items-center gap-5">
            <ScoreRing score={vis} size={96} stroke={7} label="Local visibility" />
            <div className="md:hidden"><div className="text-[12.5px] text-muted">Local visibility</div><Badge tone={vis >= 80 ? "good" : vis >= 60 ? "warn" : "bad"}>{vis >= 80 ? "Strong" : vis >= 60 ? "Fair" : "Needs work"}</Badge></div>
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-serif text-[21px] leading-snug">
              {p.mapRank === null
                ? <>{p.name} doesn't show up in the top 20 on Google Maps for “{market.keyword}”.</>
                : p.mapRank <= 3
                  ? <>{p.name} is #{p.mapRank} on Google Maps for “{market.keyword}”, but only in part of the area around the business.</>
                  : <>{p.name} is <span className="text-bad">#{p.mapRank}</span> on Google Maps for “{market.keyword}”. Most calls go to the top 3.</>}
              {" "}{o.wins.length > 0 && <>We found <b className="font-semibold">{o.wins.length} fixes</b>, {o.easyWins} of them under an hour each.</>}
            </p>
            <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
              <Mini label="Map pack rank" value={p.mapRank ? `#${p.mapRank}` : "20+"} tone={p.mapRank && p.mapRank <= 3 ? "good" : "bad"} />
              <Mini label="After fixes (est.)" value={`#${o.projectedRank}`} tone="good" />
              <Mini label="Missed customers / mo" value={fmt(o.missedLeads)} />
              <Mini label="Missed revenue / mo" value={`$${fmt(o.missedRevenue)}`} />
            </div>
          </div>
        </div>
      </Card>

      {beforeSections}

      <section data-section="competitors" className="mb-8 break-inside-avoid">
        <SectionTitle n={1} title={`How ${they} rank against competitors`} sub={`The businesses Google shows above ${them}, and where the gap is. Red means ${theyre} behind the top 3.`} />
        <CompetitorTable p={p} market={market} />
      </section>

      <section data-section="map" className="mb-8 break-inside-avoid">
        <SectionTitle n={2} title="Map pack coverage" sub={`Google results change depending on where the searcher is. We searched “${market.keyword}” from 49 points within 3 miles. Switch between ${publicView ? "your business" : "the business"} and the top 3 to see who owns which part of town.`} />
        <Card><ProspectMap p={p} market={market} /></Card>
      </section>

      <section data-section="profile & website" className="mb-8 break-inside-avoid">
        <SectionTitle n={3} title="Profile & website audit" sub="What Google sees when it decides who to show." />
        <SiteAudit p={p} market={market} />
      </section>

      <section data-section="AI answers" className="mb-8 break-inside-avoid">
        <SectionTitle n={4} title={`Do AI assistants recommend ${them}?`} sub={`More people now ask ChatGPT or Google's AI instead of scrolling the map. We asked each one: “${ai.question}”`} />
        <AiCheck p={p} ai={ai} />
      </section>

      <section data-section="game plan" className="mb-8 break-inside-avoid">
        <SectionTitle n={5} title="The game plan" sub="Quickest fixes first. Rank estimates are directional, based on the gap to the current top 3." />
        <Card pad={false}>
          {o.wins.map((w, i) => (
            <div key={w.id} className="flex gap-4 border-b border-line px-5 py-4 last:border-0">
              <span className="num mt-0.5 grid size-6 shrink-0 place-items-center rounded-full bg-hover text-[12px] text-muted">{i + 1}</span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[14px] font-medium">{w.title}</span>
                  {w.minutes <= 60 && <Badge tone="accent"><Zap size={11} /> Quick win</Badge>}
                </div>
                <p className="mt-0.5 text-[13px] text-muted">{w.detail}</p>
              </div>
              <div className="hidden shrink-0 text-right sm:block">
                <Badge tone={impactTone[w.impact]} className="capitalize">{w.impact} impact</Badge>
                <div className="mt-1 text-[12px] text-subtle">{w.area} · {w.effort}</div>
              </div>
            </div>
          ))}
          {!o.wins.length && <div className="py-10 text-center text-[13px] text-muted">No obvious gaps. This one is already well optimised.</div>}
        </Card>
      </section>

    </>
  );
}

function AiCheck({ p, ai }: { p: Prospect; ai: ReturnType<typeof prospectAi> }) {
  const hits = ai.answers.filter((a) => a.mentioned).length;
  return (
    <Card>
      <div className="mb-4 flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className={cn("num font-serif text-[28px] leading-none", hits >= 3 ? "text-good" : "text-bad")}>{hits} of {ai.answers.length}</span>
        <span className="text-[13.5px] text-muted">AI assistants mention {p.name}</span>
      </div>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {ai.answers.map((a) => (
          <div key={a.engine.id} className={cn("rounded-lg border p-3", a.mentioned ? "border-good/30 bg-good-soft/40" : "border-line")}>
            <div className="flex items-center justify-between gap-2 text-[13px] font-medium">
              {a.engine.name}
              {a.mentioned ? <Badge tone="good"><Check size={11} /> Mentioned</Badge> : <Badge tone="bad"><X size={11} /> Not mentioned</Badge>}
            </div>
            <div className="mt-1.5 text-[12px] text-muted">Recommends: {a.listed.map((n, i) => <span key={n} className={cn(n === p.name && "font-medium text-good")}>{i ? ", " : ""}{n}</span>)}</div>
          </div>
        ))}
      </div>
      <p className="mt-3 text-[12px] text-subtle">AI answers lean on reviews, directory listings (Yelp, BBB, industry sites) and the business's own website, so the fixes below help here too.</p>
    </Card>
  );
}

function Mini({ label, value, tone }: { label: string; value: string; tone?: "good" | "bad" }) {
  return (
    <div>
      <div className="text-[12px] text-muted">{label}</div>
      <div className={cn("num mt-0.5 font-serif text-[24px] leading-none", tone === "good" && "text-good", tone === "bad" && "text-bad")}>{value}</div>
    </div>
  );
}

function SectionTitle({ n, title, sub }: { n: number; title: string; sub: string }) {
  return (
    <div className="mb-3">
      <h2 className="flex items-baseline gap-2 font-serif text-[22px]"><span className="num text-[15px] text-subtle">{n}.</span>{title}</h2>
      <p className="mt-0.5 max-w-2xl text-[13px] text-muted">{sub}</p>
    </div>
  );
}

function CompetitorTable({ p, market }: { p: Prospect; market: Market }) {
  const leaders = leadersOf(market).filter((l) => l.id !== p.id);
  const rows = [...leadersOf(market), ...(p.mapRank === null || p.mapRank > 3 ? [p] : [])];
  const best = (f: (x: Prospect) => number) => Math.max(...leaders.map(f), 0);
  const behind = (x: Prospect, f: (x: Prospect) => number) => x.id === p.id && leaders.length > 0 && f(x) < best(f) * 0.75;
  const cols: { label: string; get: (x: Prospect) => number; show: (x: Prospect) => string }[] = [
    { label: "Reviews", get: (x) => x.reviews, show: (x) => fmt(x.reviews) },
    { label: "Reviews / mo", get: (x) => x.reviewVelocity, show: (x) => String(x.reviewVelocity) },
    { label: "Photos", get: (x) => x.photos, show: (x) => String(x.photos) },
    { label: "Posts 30d", get: (x) => x.posts30d, show: (x) => String(x.posts30d) },
    { label: "Categories", get: (x) => x.categories.length, show: (x) => String(x.categories.length) },
    { label: "Profile", get: profileScore, show: (x) => `${profileScore(x)}%` },
    { label: "Website", get: (x) => x.site?.score ?? 0, show: (x) => (x.site ? String(x.site.score) : "None") },
  ];
  return (
    <Card pad={false} className="overflow-x-auto">
      <table className="w-full min-w-[820px] text-[13.5px]">
        <thead className="border-b border-line text-left text-[12.5px] text-muted">
          <tr>
            <th className="px-5 py-2.5 font-normal">Map rank</th>
            <th className="px-3 py-2.5 font-normal">Business</th>
            <th className="px-3 py-2.5 text-right font-normal">Rating</th>
            {cols.map((c) => <th key={c.label} className="px-3 py-2.5 text-right font-normal last:pr-5">{c.label}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((x) => {
            const isP = x.id === p.id;
            return (
              <tr key={x.id} className={cn("border-b border-line last:border-0", isP && "bg-accent-soft/40")}>
                <td className="num px-5 py-3 font-serif text-[18px]">{x.mapRank ? `#${x.mapRank}` : "20+"}</td>
                <td className="px-3 py-3">
                  <div className="font-medium">{x.name} {isP && <Badge tone="accent">Prospect</Badge>}</div>
                  <div className="text-[12px] text-muted">{x.distanceMi} mi · {x.website ?? "no website"}</div>
                </td>
                <td className="num px-3 py-3 text-right"><span className="inline-flex items-center gap-1"><Star size={11} className="fill-current text-warn" />{x.rating}</span></td>
                {cols.map((c) => (
                  <td key={c.label} className={cn("num px-3 py-3 text-right last:pr-5", behind(x, c.get) && "font-medium text-bad")}>{c.show(x)}</td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </Card>
  );
}

function SiteAudit({ p, market }: { p: Prospect; market: Market }) {
  const leaderCats = Math.max(...leadersOf(market).map((l) => l.categories.length), 0);
  const gbp: [string, boolean, string][] = [
    ["Profile claimed & verified", p.claimed, p.claimed ? "Owner has control" : "Anyone can suggest edits"],
    ["Business hours listed", p.hasHours, p.hasHours ? "Shows for “open now”" : "Hidden from “open now” searches"],
    ["Business description", p.hasDescription, p.hasDescription ? "Present" : "Empty"],
    ["Categories", p.categories.length >= leaderCats, `${p.categories.length} vs. ${leaderCats} for the leaders`],
    ["Photos", p.photos >= 30, `${p.photos} uploaded`],
    ["Posted in last 30 days", p.posts30d > 0, p.posts30d ? `${p.posts30d} posts` : "No recent posts"],
    ["Replies to reviews", p.replyRate >= 50, `${p.replyRate}% replied`],
  ];
  const site = p.site;
  const web: [string, boolean, string][] = site
    ? [
        ["Secure (HTTPS)", site.https, site.https ? "Valid certificate" : "Shows “Not secure”"],
        ["Mobile friendly", site.mobile, site.mobile ? "Passes" : "Fails on phones"],
        ["Mobile speed (LCP)", site.lcp <= 2.5, `${site.lcp}s · target ≤ 2.5s`],
        ["Name, address, phone match Google", site.napMatches, site.napMatches ? "Consistent" : "Mismatch found"],
        ["LocalBusiness schema", site.schema, site.schema ? "Found" : "Missing"],
        ["City in page titles", site.titleHasCity, site.titleHasCity ? "Yes" : `No mention of ${market.city.split(",")[0]}`],
        ["Service pages", site.servicePages >= 3, `${site.servicePages} found`],
      ]
    : [];
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader title="Google Business Profile" sub={`${gbp.filter((x) => x[1]).length} of ${gbp.length} checks passed`} right={<ScoreRing score={profileScore(p)} size={52} stroke={5} label="Profile" />} />
        <CheckList items={gbp} />
      </Card>
      <Card>
        {site ? (
          <>
            <CardHeader title="Website" sub={<>{p.website && <ExternalUrl domain={p.website} />} · {site.pages} pages crawled</>} right={<ScoreRing score={site.score} size={52} stroke={5} label="Website" />} />
            <CheckList items={web} />
            {p.organicRank !== null && (
              <div className="mt-4 flex items-center gap-2 rounded-md bg-hover px-3 py-2 text-[13px]"><TrendingUp size={14} className="text-muted" /> Organic rank for “{market.keyword}”: <b className="num font-medium">#{p.organicRank}</b></div>
            )}
          </>
        ) : (
          <div className="grid h-full place-items-center py-10 text-center">
            <div>
              <Globe size={28} className="mx-auto text-bad" />
              <div className="mt-3 font-medium">No website linked</div>
              <p className="mx-auto mt-1 max-w-xs text-[13px] text-muted">Every business in the top 3 has a website. This is the single biggest gap, and the easiest upsell.</p>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}

function CheckList({ items }: { items: [string, boolean, string][] }) {
  return (
    <ul className="divide-y divide-line">
      {items.map(([label, ok, detail]) => (
        <li key={label} className="flex items-center gap-3 py-2.5 text-[13.5px]">
          <span className={cn("grid size-5 shrink-0 place-items-center rounded-full", ok ? "bg-good-soft text-good" : "bg-bad-soft text-bad")}>{ok ? <Check size={12} strokeWidth={2.5} /> : <X size={12} strokeWidth={2.5} />}</span>
          <span className="flex-1">{label}</span>
          <span className={cn("text-right text-[12.5px]", ok ? "text-subtle" : "text-bad")}>{detail}</span>
        </li>
      ))}
    </ul>
  );
}

function pitchText(p: Prospect, m: Market, leaders: Prospect[], o: ReturnType<typeof opportunity>) {
  const names = leaders.map((l) => l.name);
  const beatOn = leaders.filter((l) => p.rating > l.rating).length;
  const where = p.mapRank === null ? "doesn't show up in the top 20 on Google Maps" : `shows up #${p.mapRank} on Google Maps`;
  const fixes = o.wins.slice(0, 3).map((w) => `  • ${w.title}`).join("\n");
  return `Hi ${p.contact.owner?.name.split(" ")[0] ?? "there"},

I searched “${m.keyword}” in ${m.city.split(",")[0]} and ${p.name} ${where}${names.length ? `, behind ${names.join(", ")}` : ""}. The top 3 get most of the ~${fmt(m.volume)} searches a month, which I estimate is about ${fmt(o.missedLeads)} customers (~$${fmt(o.missedRevenue)}) a month you're not getting.

${beatOn > 0 ? `You have a better rating (${p.rating}★) than ${beatOn} of them, so this isn't a reputation problem. It's fixable.` : `This is fixable.`} The quickest wins I found:
${fixes}

I put together a one-page audit showing where you rank across town and exactly what to change. Could I walk you through it in 10 minutes this week?`;
}
