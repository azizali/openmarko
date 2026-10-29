import { useState } from "react";
import { Search, MapPin, Plus, Loader2 } from "lucide-react";
import { Badge, Button, Card, Checkbox, Modal, PageHeader, Segmented, Sparkline, Tabs, cn, fmt, useToast } from "../components/ui";
import { competitorNames, keywordIdeas } from "../data/mock";

type Tab = "ideas" | "questions" | "gap" | "nearme";

const questions = [
  { term: "how much does a dental cleaning cost in austin", volume: 390 },
  { term: "do i need to see a dentist for a chipped tooth", volume: 1600 },
  { term: "is invisalign cheaper than braces", volume: 2400 },
  { term: "how long do veneers last", volume: 5400 },
  { term: "what counts as a dental emergency", volume: 880 },
];

const kdTone = (kd: number) => (kd < 20 ? "good" : kd < 35 ? "warn" : "bad");

export default function Keywords() {
  const [seed, setSeed] = useState("dentist");
  const [tab, setTab] = useState<Tab>("ideas");
  const [loading, setLoading] = useState(false);
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [localOnly, setLocalOnly] = useState<"all" | "local">("all");
  const [modal, setModal] = useState(false);
  const { toast, node } = useToast();

  const ideas = keywordIdeas.filter((k) => localOnly === "all" || k.localPack);
  const gap = keywordIdeas.filter((k) => k.competitorRanks);
  const toggle = (t: string) => { const n = new Set(sel); n.has(t) ? n.delete(t) : n.add(t); setSel(n); };
  const run = () => { setLoading(true); setTimeout(() => setLoading(false), 700); };

  return (
    <>
      <PageHeader title="Keyword ideas" sub="Find local keywords worth tracking, from DataForSEO Labs and your Search Console queries." />

      <form onSubmit={(e) => { e.preventDefault(); run(); }} className="mb-6 flex flex-wrap gap-2">
        <div className="flex h-10 min-w-0 flex-1 items-center gap-2 rounded-lg border border-line bg-surface px-3 focus-within:border-line-strong">
          <Search size={16} className="text-subtle" />
          <input aria-label="Seed keyword" value={seed} onChange={(e) => setSeed(e.target.value)} className="flex-1 bg-transparent outline-none" placeholder="Seed keyword or competitor domain" />
        </div>
        <div className="flex h-10 items-center gap-2 rounded-lg border border-line bg-surface px-3 text-[13.5px] text-muted"><MapPin size={14} /> Austin, TX · English</div>
        <Button type="submit" variant="primary" className="h-10">{loading ? <Loader2 size={14} className="animate-spin" /> : "Search"}</Button>
      </form>

      <Tabs value={tab} onChange={setTab} tabs={[
        { id: "ideas", label: "Ideas", count: keywordIdeas.length },
        { id: "questions", label: "Questions", count: questions.length },
        { id: "gap", label: "Competitor gap", count: gap.length },
        { id: "nearme", label: "Near me & zip", count: 6 },
      ]} />

      <div className="my-4 flex flex-wrap items-center gap-2">
        {tab === "ideas" && <Segmented label="Filter" value={localOnly} onChange={setLocalOnly} options={[{ id: "all", label: "All" }, { id: "local", label: "Has map pack" }]} />}
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
                <tr key={k.term} className="border-b border-line last:border-0 hover:bg-hover">
                  <td className="py-2.5 pl-5"><Checkbox label={`Select ${k.term}`} checked={sel.has(k.term)} onChange={() => toggle(k.term)} /></td>
                  <td className="px-3 py-2.5 font-medium">{k.term}</td>
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
        {tab === "questions" && questions.map((q) => (
          <label key={q.term} className="flex cursor-pointer items-center gap-3 border-b border-line px-5 py-3 last:border-0 hover:bg-hover">
            <Checkbox checked={sel.has(q.term)} onChange={() => toggle(q.term)} />
            <span className="flex-1 text-[13.5px]">{q.term}?</span>
            <span className="num text-[12.5px] text-muted">{fmt(q.volume)}/mo</span>
            <Button size="sm" variant="ghost" onClick={(e) => { e.preventDefault(); toast("Content brief drafted, see Action plan"); }}>Draft FAQ</Button>
          </label>
        ))}
        {tab === "nearme" && ["dentist 78704", "dentist 78745", "dentist travis heights", "dentist bouldin creek", "dentist near zilker park", "dentist near south congress"].map((t, i) => (
          <label key={t} className="flex cursor-pointer items-center gap-3 border-b border-line px-5 py-3 last:border-0 hover:bg-hover">
            <Checkbox checked={sel.has(t)} onChange={() => toggle(t)} />
            <span className="flex-1 text-[13.5px]">{t}</span>
            <span className="num text-[12.5px] text-muted">{fmt([390, 210, 90, 70, 140, 110][i])}/mo</span>
          </label>
        ))}
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
