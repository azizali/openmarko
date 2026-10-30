import { useState } from "react";
import { Search, MapPin, Plus, Loader2, Sparkles } from "lucide-react";
import { Badge, Button, Card, Checkbox, Modal, PageHeader, Segmented, Sparkline, Tabs, cn, fmt, useToast } from "../components/ui";
import { competitorNames, keywordIdeas, keywords, type KeywordIdea } from "../data/mock";

type Tab = "ideas" | "questions" | "gap" | "nearme";

type Idea = KeywordIdea & { isNew?: boolean };
type Simple = { term: string; volume: number; isNew?: boolean };

const questions: Simple[] = [
  { term: "how much does a dental cleaning cost in austin", volume: 390 },
  { term: "do i need to see a dentist for a chipped tooth", volume: 1600 },
  { term: "is invisalign cheaper than braces", volume: 2400 },
  { term: "how long do veneers last", volume: 5400 },
  { term: "what counts as a dental emergency", volume: 880 },
];

const nearMe: Simple[] = ["dentist 78704", "dentist 78745", "dentist travis heights", "dentist bouldin creek", "dentist near zilker park", "dentist near south congress"]
  .map((term, i) => ({ term, volume: [390, 210, 90, 70, 140, 110][i] }));

const kdTone = (kd: number) => (kd < 20 ? "good" : kd < 35 ? "warn" : "bad");

// ---------- Idea generator ----------
// Mock of DataForSEO Labs keyword_ideas / keyword_suggestions + "People also ask". Metrics are
// seeded from the term so the same idea always gets the same numbers.

const city = "austin";
const ideaTemplates: [(s: string) => string, KeywordIdea["intent"], boolean][] = [
  [(s) => `best ${s} ${city}`, "commercial", true],
  [(s) => `${s} open sunday ${city}`, "transactional", true],
  [(s) => `${s} accepting new patients`, "transactional", true],
  [(s) => `${s} prices ${city}`, "commercial", false],
  [(s) => `${s} payment plans`, "commercial", false],
  [(s) => `24 hour ${s} ${city}`, "transactional", true],
  [(s) => `${s} for kids ${city}`, "transactional", true],
  [(s) => `walk in ${s} ${city}`, "transactional", true],
  [(s) => `${s} that takes delta dental`, "transactional", true],
  [(s) => `top rated ${s} south ${city}`, "commercial", true],
  [(s) => `${s} reviews ${city}`, "commercial", true],
  [(s) => `bilingual ${s} ${city}`, "transactional", true],
  [(s) => `${s} downtown ${city}`, "transactional", true],
  [(s) => `cheap ${s} near me`, "commercial", true],
  [(s) => `${s} without insurance`, "commercial", false],
  [(s) => `${s} for seniors ${city}`, "transactional", true],
];
const questionTemplates = [
  (s: string) => `how much does a ${s} visit cost without insurance`,
  (s: string) => `how often should you see a ${s}`,
  (s: string) => `what to expect at your first ${s} appointment`,
  (s: string) => `how to find a good ${s} in ${city}`,
  (s: string) => `can a ${s} see me the same day`,
  (s: string) => `what does a ${s} do on a first visit`,
  (s: string) => `is it worth paying for a private ${s}`,
  (s: string) => `when should kids first see a ${s}`,
  (s: string) => `what questions should i ask a new ${s}`,
  (s: string) => `how long does a ${s} appointment take`,
];
const places = ["78701", "78702", "78703", "78741", "78748", "78749", "barton hills", "east austin", "mueller", "hyde park", "south lamar", "westlake", "circle c", "manchaca"];

function seeded(term: string) {
  let s = [...term].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 2147483647, 7) || 1;
  return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
}

function makeIdea(term: string, intent: KeywordIdea["intent"], localPack: boolean, gap: boolean): Idea {
  const r = seeded(term);
  const volume = [50, 70, 90, 110, 140, 170, 210, 260, 320, 390, 480, 590, 720, 880][Math.floor(r() * 14)];
  return {
    term, volume, intent, localPack, isNew: true,
    kd: Math.round(8 + r() * 38),
    cpc: Math.round((intent === "informational" ? 0.5 + r() * 2 : 4 + r() * 16) * 10) / 10,
    trend: Array.from({ length: 12 }, () => Math.round(40 + r() * 60)),
    competitorRanks: gap || r() < 0.3 ? Math.ceil(r() * 6) : undefined,
  };
}

/** Next `n` ideas for this tab that aren't already listed or tracked. Empty when the templates run out. */
function generate(tab: Tab, seed: string, have: Set<string>, n = 6) {
  const s = seed.trim().toLowerCase() || "dentist";
  const tracked = new Set(keywords.map((k) => k.term));
  const fresh = (t: string) => !have.has(t) && !tracked.has(t);
  if (tab === "questions") return questionTemplates.map((f) => f(s)).filter(fresh).slice(0, n).map((term) => ({ term, volume: makeIdea(term, "informational", false, false).volume * 3, isNew: true }));
  if (tab === "nearme") return places.map((p) => `${s} ${p}`).filter(fresh).slice(0, n).map((term) => ({ term, volume: makeIdea(term, "transactional", true, false).volume, isNew: true }));
  return ideaTemplates.filter(([f]) => fresh(f(s))).slice(0, n).map(([f, intent, local]) => makeIdea(f(s), intent, local, tab === "gap"));
}

export default function Keywords() {
  const [seed, setSeed] = useState("dentist");
  const [tab, setTab] = useState<Tab>("ideas");
  const [loading, setLoading] = useState(false);
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [localOnly, setLocalOnly] = useState<"all" | "local">("all");
  const [modal, setModal] = useState(false);
  const [allIdeas, setAllIdeas] = useState<Idea[]>(keywordIdeas);
  const [qs, setQs] = useState(questions);
  const [near, setNear] = useState(nearMe);
  const [generating, setGenerating] = useState(false);
  const { toast, node } = useToast();

  const ideas = allIdeas.filter((k) => localOnly === "all" || k.localPack);
  const gap = allIdeas.filter((k) => k.competitorRanks);
  const toggle = (t: string) => { const n = new Set(sel); n.has(t) ? n.delete(t) : n.add(t); setSel(n); };
  const clearNew = <T extends { isNew?: boolean }>(xs: T[]) => xs.map((x) => ({ ...x, isNew: false }));
  // New ideas go on top, marked New until the next batch.
  const more = (quiet = false) => {
    setGenerating(true);
    setTimeout(() => {
      let added = 0;
      if (tab === "questions") { const f = generate(tab, seed, new Set(qs.map((q) => q.term))); added = f.length; setQs([...f, ...clearNew(qs)]); }
      else if (tab === "nearme") { const f = generate(tab, seed, new Set(near.map((q) => q.term))); added = f.length; setNear([...f, ...clearNew(near)]); }
      else { const f = generate(tab, seed, new Set(allIdeas.map((q) => q.term))) as Idea[]; added = f.length; setAllIdeas([...f, ...clearNew(allIdeas)]); }
      setGenerating(false);
      if (!quiet || !added) toast(added ? `${added} new idea${added === 1 ? "" : "s"} for “${seed || "dentist"}”` : `No more new ideas for “${seed}”. Try another seed keyword`);
    }, 700);
  };
  const run = () => { setLoading(true); setTimeout(() => { setLoading(false); more(true); }, 500); };

  return (
    <>
      <PageHeader title="Keyword ideas" sub="Find local keywords worth tracking, from Google search data and your Search Console queries." />

      <form onSubmit={(e) => { e.preventDefault(); run(); }} className="mb-6 flex flex-wrap gap-2">
        <div className="flex h-10 min-w-0 flex-1 items-center gap-2 rounded-lg border border-line bg-surface px-3 focus-within:border-line-strong">
          <Search size={16} className="text-subtle" />
          <input aria-label="Seed keyword" value={seed} onChange={(e) => setSeed(e.target.value)} className="flex-1 bg-transparent outline-none" placeholder="Seed keyword or competitor domain" />
        </div>
        <div className="flex h-10 items-center gap-2 rounded-lg border border-line bg-surface px-3 text-[13.5px] text-muted"><MapPin size={14} /> Austin, TX · English</div>
        <Button type="submit" variant="primary" className="h-10">{loading ? <Loader2 size={14} className="animate-spin" /> : "Search"}</Button>
      </form>

      <Tabs value={tab} onChange={setTab} tabs={[
        { id: "ideas", label: "Ideas", count: allIdeas.length },
        { id: "questions", label: "Questions", count: qs.length },
        { id: "gap", label: "Competitor gap", count: gap.length },
        { id: "nearme", label: "Near me & zip", count: near.length },
      ]} />

      <div className="my-4 flex flex-wrap items-center gap-2">
        {tab === "ideas" && <Segmented label="Filter" value={localOnly} onChange={setLocalOnly} options={[{ id: "all", label: "All" }, { id: "local", label: "Has map pack" }]} />}
        <Button size="sm" icon={generating ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />} disabled={generating} onClick={() => more()}>Generate more ideas</Button>
        <span className="ml-auto text-[12.5px] text-subtle">{sel.size ? `${sel.size} selected` : "Select keywords to track"}</span>
        <Button variant="primary" size="sm" icon={<Plus size={13} />} disabled={!sel.size} onClick={() => setModal(true)}>Track</Button>
      </div>

      <Card pad={false} className={cn("overflow-x-auto transition-opacity", loading && "opacity-50")}>
        {(tab === "ideas" || tab === "gap") && (
          <table className="w-full min-w-[720px] text-[13.5px]">
            <thead className="border-b border-line text-left text-[12.5px] text-muted">
              <tr>
                <th className="w-10 py-2.5 pl-5"><span className="sr-only">Select</span></th>
                <th className="px-3 py-2.5 font-normal">Keyword</th>
                <th className="px-3 py-2.5 text-right font-normal">Volume</th>
                <th className="px-3 py-2.5 font-normal">Trend</th>
                <th className="px-3 py-2.5 font-normal">KD</th>
                <th className="px-3 py-2.5 text-right font-normal">CPC</th>
                <th className="px-3 py-2.5 font-normal">Intent</th>
                <th className="px-3 py-2.5 pr-5 font-normal">{tab === "gap" ? "Competitor" : "SERP"}</th>
              </tr>
            </thead>
            <tbody>
              {(tab === "gap" ? gap : ideas).map((k, i) => (
                <tr key={k.term} className={cn("border-b border-line last:border-0 hover:bg-hover", k.isNew && "bg-accent-soft/40")}>
                  <td className="py-2.5 pl-5"><Checkbox label={`Select ${k.term}`} checked={sel.has(k.term)} onChange={() => toggle(k.term)} /></td>
                  <td className="px-3 py-2.5 font-medium">{k.term}{k.isNew && <Badge tone="accent" className="ml-2">New</Badge>}</td>
                  <td className="num px-3 py-2.5 text-right">{fmt(k.volume)}</td>
                  <td className="px-3 py-2.5"><Sparkline data={k.trend} tone="muted" /></td>
                  <td className="px-3 py-2.5"><Badge tone={kdTone(k.kd)} className="num">{k.kd}</Badge></td>
                  <td className="num px-3 py-2.5 text-right text-muted">${k.cpc.toFixed(2)}</td>
                  <td className="px-3 py-2.5 text-muted capitalize">{k.intent}</td>
                  <td className="px-3 py-2.5 pr-5">
                    {tab === "gap"
                      ? <span className="text-[12.5px] text-muted">{competitorNames[i % competitorNames.length]} <b className="num font-medium text-fg">#{k.competitorRanks}</b> · you —</span>
                      : k.localPack ? <Badge tone="accent">Map pack</Badge> : <span className="text-[12.5px] text-subtle">Organic only</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {tab === "questions" && qs.map((q) => (
          <label key={q.term} className={cn("flex cursor-pointer items-center gap-3 border-b border-line px-5 py-3 last:border-0 hover:bg-hover", q.isNew && "bg-accent-soft/40")}>
            <Checkbox checked={sel.has(q.term)} onChange={() => toggle(q.term)} />
            <span className="flex-1 text-[13.5px]">{q.term}?{q.isNew && <Badge tone="accent" className="ml-2">New</Badge>}</span>
            <span className="num text-[12.5px] text-muted">{fmt(q.volume)}/mo</span>
            <Button size="sm" variant="ghost" onClick={(e) => { e.preventDefault(); toast("Content brief drafted, see To-do"); }}>Draft FAQ</Button>
          </label>
        ))}
        {tab === "nearme" && near.map((q) => (
          <label key={q.term} className={cn("flex cursor-pointer items-center gap-3 border-b border-line px-5 py-3 last:border-0 hover:bg-hover", q.isNew && "bg-accent-soft/40")}>
            <Checkbox checked={sel.has(q.term)} onChange={() => toggle(q.term)} />
            <span className="flex-1 text-[13.5px]">{q.term}{q.isNew && <Badge tone="accent" className="ml-2">New</Badge>}</span>
            <span className="num text-[12.5px] text-muted">{fmt(q.volume)}/mo</span>
          </label>
        ))}
        <button onClick={() => more()} disabled={generating} className="flex w-full items-center justify-center gap-1.5 border-t border-line py-3 text-[13px] text-muted hover:bg-hover hover:text-fg disabled:opacity-50">
          {generating ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />} Generate more ideas for “{seed || "dentist"}”
        </button>
      </Card>

      <Modal open={modal} onClose={() => setModal(false)} title={`Track ${sel.size} keyword${sel.size === 1 ? "" : "s"}`} footer={<><Button variant="ghost" onClick={() => setModal(false)}>Cancel</Button><Button variant="primary" onClick={() => { setModal(false); toast(`${sel.size} keywords added · first scan running`); setSel(new Set()); }}>Add to tracking</Button></>}>
        <div className="space-y-3 text-[13.5px]">
          <label className="flex items-center justify-between"><span>Daily organic rank</span><input type="checkbox" defaultChecked className="size-4 accent-[var(--ink)]" /></label>
          <label className="flex items-center justify-between"><span>Weekly geo-grid (7×7)</span><input type="checkbox" defaultChecked className="size-4 accent-[var(--ink)]" /></label>
          <label className="flex items-center justify-between"><span>Tag</span><input defaultValue="new" className="h-8 w-32 rounded-md border border-line bg-surface px-2 text-[13px] outline-none" /></label>
          <p className="num border-t border-line pt-3 text-[12.5px] text-muted">Uses {sel.size} of your 9 remaining keyword slots.</p>
        </div>
      </Modal>
      {node}
    </>
  );
}
