import { useMemo, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router";
import { Download, Plus, Search, X } from "lucide-react";
import { Button, PageHeader, Segmented, Tabs, cn, useToast } from "../components/ui";
import { KeywordTable, scanFor, type RankView } from "../components/KeywordTable";
import { TaskDrawer } from "../components/Todo";
import { gridStats, type Keyword } from "../data/mock";
import { keywordsFor } from "../data/scoped";
import { LocationOverview, ScopeBar } from "../components/Scope";
import { useScopedLocation } from "../lib/scope";
import { openTasksFor, useRunState, type Task } from "../lib/tasks";

type Filter = "all" | "improved" | "declined" | "top3";
const avg = (xs: (number | null)[]) => { const v = xs.filter((x): x is number => x !== null); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : 0; };

// Map and search rankings are measured from a Location's area, so this page shows
// one Location's keywords at a time; "All locations" compares them.
export default function Rankings() {
  const { location } = useScopedLocation();
  if (location) return <RankingsBody key={location.id} keywords={keywordsFor(location.id)} />;
  const sum = (id: string) => {
    const kw = keywordsFor(id).filter((k) => k.local !== null);
    return { n: keywordsFor(id).length, top3: kw.filter((k) => (k.local ?? 99) <= 3).length, avg: kw.reduce((a, k) => a + (k.local ?? 20), 0) / Math.max(1, kw.length), solv: Math.round(kw.reduce((a, k) => a + gridStats(scanFor(k, 7)).solv, 0) / Math.max(1, kw.length)) };
  };
  return (
    <>
      <PageHeader title="Rankings" sub="Where each location shows up on Google and in the map pack." />
      <ScopeBar kind="location" />
      <LocationOverview columns={["Keywords", "In the map pack top 3", "Average map rank", "Top 3 of nearby searches"]} row={(id) => { const x = sum(id); return [x.n, x.top3, `#${x.avg.toFixed(1)}`, `${x.solv}%`]; }} />
    </>
  );
}

function RankingsBody({ keywords }: { keywords: Keyword[] }) {
  const tags = [...new Set(keywords.flatMap((k) => k.tags))];
  const { id } = useParams();
  const [params, setParams] = useSearchParams();
  const state = useRunState();
  const [view, setView] = useState<RankView>(params.get("view") === "local" ? "local" : params.get("view") === "organic" ? "organic" : "both");
  const [filter, setFilter] = useState<Filter>("all");
  const [q, setQ] = useState("");
  const [tag, setTag] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(id ?? params.get("kw"));
  const [task, setTask] = useState<Task | null>(null);
  const { toast, node } = useToast();

  // "Improved / declined / top 3" follow the chosen view: map pack when viewing map pack, otherwise organic.
  const pos = (k: Keyword) => (view === "local" ? k.local : k.organic);
  const prev = (k: Keyword) => (view === "local" ? k.localPrev : k.organicPrev);
  const base = keywords.filter((k) => (!q || k.term.includes(q.toLowerCase())) && (!tag || k.tags.includes(tag)) && (view !== "local" || k.local !== null));
  const match = (k: Keyword, f: Filter) => {
    const c = pos(k), p = prev(k);
    if (f === "improved") return c !== null && p !== null && p > c;
    if (f === "declined") return c !== null && p !== null && p < c;
    if (f === "top3") return (c ?? 99) <= 3;
    return true;
  };
  const rows = base.filter((k) => match(k, filter));
  const count = (f: Filter) => base.filter((k) => match(k, f)).length;

  const solv = useMemo(() => avg(base.filter((k) => k.local).map((k) => gridStats(scanFor(k, 7)).solv)), [base.length, tag, q, view]);
  const stats = [
    ...(view !== "local" ? [
      { label: "Avg. Google position", value: avg(base.map((k) => k.organic)).toFixed(1), was: avg(base.map((k) => k.organicPrev)).toFixed(1) },
      { label: "On page 1", value: String(base.filter((k) => (k.organic ?? 99) <= 10).length), was: `of ${base.length}` },
    ] : []),
    ...(view !== "organic" ? [
      { label: "Avg. map pack position", value: avg(base.map((k) => k.local)).toFixed(1), was: avg(base.map((k) => k.localPrev)).toFixed(1) },
      { label: "Share of local voice", value: `${solv.toFixed(0)}%`, was: "top 3 across the grid" },
    ] : []),
  ];
  if (view !== "both") stats.push(
    { label: view === "local" ? "In the map pack" : "Top 3 on Google", value: String(count("top3")), was: `of ${base.length}` },
    { label: "Keywords with to-dos", value: String(base.filter((k) => openTasksFor(state, k.id).length).length), was: "open improvements" },
  );

  const toggle = (kid: string) => {
    const next = expanded === kid ? null : kid;
    setExpanded(next);
    const p = new URLSearchParams(params);
    next ? p.set("kw", next) : p.delete("kw");
    setParams(p, { replace: true });
  };
  const changeView = (v: RankView) => {
    setView(v);
    const p = new URLSearchParams(params);
    v === "both" ? p.delete("view") : p.set("view", v);
    setParams(p, { replace: true });
  };

  return (
    <>
      <PageHeader
        title="Rankings"
        sub="Where you show up on Google and in the map pack for every keyword. Open a keyword for its map grid, history and competitors."
        actions={<>
          <Button icon={<Download size={14} />} onClick={() => toast("CSV exported")}>Export</Button>
          <Link to="/keywords"><Button variant="primary" icon={<Plus size={14} />}>Add keywords</Button></Link>
        </>}
      />
      <ScopeBar kind="location" />

      <div className="mb-6 flex flex-wrap items-center gap-3">
        <Segmented label="Results" value={view} onChange={changeView} options={[{ id: "both", label: "All results" }, { id: "organic", label: "Organic" }, { id: "local", label: "Map pack" }]} />
        <span className="text-[12.5px] text-muted">
          {view === "both" ? "Google results and the map pack side by side" : view === "organic" ? "The regular blue-link results" : "The 3 businesses shown on the map"}
        </span>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-line bg-line lg:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="bg-surface p-5">
            <div className="text-[12.5px] text-muted">{s.label}</div>
            <div className="num mt-1 font-serif text-[28px] leading-none">{s.value}</div>
            <div className="num mt-1.5 text-[12px] text-subtle">{/^\d/.test(s.was) ? `was ${s.was} last week` : s.was}</div>
          </div>
        ))}
      </div>

      <Tabs value={filter} onChange={setFilter} tabs={[
        { id: "all", label: "All", count: count("all") },
        { id: "improved", label: "Improved", count: count("improved") },
        { id: "declined", label: "Declined", count: count("declined") },
        { id: "top3", label: view === "local" ? "In map pack" : "Top 3", count: count("top3") },
      ]} />

      <div className="my-4 flex flex-wrap items-center gap-2">
        <div className="flex h-8 items-center gap-2 rounded-md border border-line bg-surface px-2.5">
          <Search size={14} className="text-subtle" />
          <input aria-label="Filter keywords" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Find a keyword" className="w-40 bg-transparent text-[13px] outline-none" />
          {q && <button onClick={() => setQ("")} aria-label="Clear search" className="text-subtle hover:text-fg"><X size={13} /></button>}
        </div>
        <span className="mx-1 hidden h-5 w-px bg-line sm:block" />
        <button onClick={() => setTag(null)} className={cn("h-7 rounded-full border px-2.5 text-[12.5px] transition-colors", !tag ? "border-ink bg-ink text-on-ink" : "border-line text-muted hover:bg-hover")}>All topics</button>
        {tags.map((t) => (
          <button key={t} onClick={() => setTag(tag === t ? null : t)} className={cn("h-7 rounded-full border px-2.5 text-[12.5px] capitalize transition-colors", tag === t ? "border-ink bg-ink text-on-ink" : "border-line text-muted hover:bg-hover")}>{t}</button>
        ))}
        <span className="ml-auto text-[12.5px] text-subtle">Changes vs. Oct 22 · Austin, TX</span>
      </div>

      <KeywordTable rows={rows} expanded={expanded} onToggle={toggle} view={view} onOpenTask={(kid) => setTask(openTasksFor(state, kid)[0] ?? null)} />

      <TaskDrawer task={task} onClose={() => setTask(null)} />
      {node}
    </>
  );
}
