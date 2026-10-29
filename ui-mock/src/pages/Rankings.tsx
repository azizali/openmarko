import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router";
import { Download, Plus, Search, ArrowUpDown } from "lucide-react";
import { Badge, Button, Card, PageHeader, RankDelta, Segmented, Sparkline, Tabs, cn, fmt, rankTone } from "../components/ui";
import { keywords, type Keyword } from "../data/mock";

type Filter = "all" | "improved" | "declined" | "top3" | "pack";
type SortKey = "term" | "organic" | "local" | "volume" | "change";

export default function Rankings() {
  const [filter, setFilter] = useState<Filter>("all");
  const [q, setQ] = useState("");
  const [mode, setMode] = useState<"both" | "organic" | "local">("both");
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: "volume", dir: -1 });
  const navigate = useNavigate();

  const counts = {
    all: keywords.length,
    improved: keywords.filter((k) => k.organicPrev! > k.organic!).length,
    declined: keywords.filter((k) => k.organicPrev! < k.organic!).length,
    top3: keywords.filter((k) => (k.organic ?? 99) <= 3).length,
    pack: keywords.filter((k) => (k.local ?? 99) <= 3).length,
  };

  const rows = useMemo(() => {
    const f = keywords.filter((k) => {
      if (q && !k.term.includes(q.toLowerCase())) return false;
      if (filter === "improved") return k.organicPrev! > k.organic!;
      if (filter === "declined") return k.organicPrev! < k.organic!;
      if (filter === "top3") return (k.organic ?? 99) <= 3;
      if (filter === "pack") return (k.local ?? 99) <= 3;
      return true;
    });
    const val = (k: Keyword): number | string => {
      if (sort.key === "term") return k.term;
      if (sort.key === "change") return (k.organicPrev ?? 0) - (k.organic ?? 0);
      return (k[sort.key] as number | null) ?? 999;
    };
    return [...f].sort((a, b) => (val(a) > val(b) ? 1 : -1) * sort.dir);
  }, [filter, q, sort]);

  const Th = ({ k, children, className }: { k: SortKey; children: React.ReactNode; className?: string }) => (
    <th className={cn("px-3 py-2.5 font-normal", className)}>
      <button onClick={() => setSort({ key: k, dir: sort.key === k ? (-sort.dir as 1 | -1) : k === "term" ? 1 : -1 })} className="inline-flex items-center gap-1 hover:text-fg">
        {children}
        <ArrowUpDown size={11} className={sort.key === k ? "text-fg" : "opacity-40"} />
      </button>
    </th>
  );

  const avg = (xs: (number | null)[]) => { const v = xs.filter((x): x is number => x !== null); return v.reduce((a, b) => a + b, 0) / v.length; };

  return (
    <>
      <PageHeader
        title="Rankings"
        sub="Organic and map pack positions from the business location, refreshed daily via DataForSEO."
        actions={<><Button icon={<Download size={14} />}>Export</Button><Link to="/keywords"><Button variant="primary" icon={<Plus size={14} />}>Add keywords</Button></Link></>}
      />

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          ["Avg. organic", avg(keywords.map((k) => k.organic)).toFixed(1), avg(keywords.map((k) => k.organicPrev)).toFixed(1)],
          ["Avg. map pack", avg(keywords.map((k) => k.local)).toFixed(1), avg(keywords.map((k) => k.localPrev)).toFixed(1)],
          ["In top 3 organic", String(counts.top3), "3"],
          ["In map pack", String(counts.pack), "5"],
        ].map(([l, v, p]) => (
          <Card key={l} className="!p-4">
            <div className="text-[12.5px] text-muted">{l}</div>
            <div className="num mt-1 font-serif text-[26px] leading-none">{v}</div>
            <div className="num mt-1.5 text-[12px] text-subtle">was {p} last week</div>
          </Card>
        ))}
      </div>

      <Tabs
        value={filter}
        onChange={setFilter}
        tabs={[
          { id: "all", label: "All", count: counts.all },
          { id: "improved", label: "Improved", count: counts.improved },
          { id: "declined", label: "Declined", count: counts.declined },
          { id: "top3", label: "Top 3", count: counts.top3 },
          { id: "pack", label: "In map pack", count: counts.pack },
        ]}
      />

      <div className="my-4 flex flex-wrap items-center gap-2">
        <div className="flex h-8 items-center gap-2 rounded-md border border-line bg-surface px-2.5">
          <Search size={14} className="text-subtle" />
          <input aria-label="Filter keywords" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filter keywords" className="w-44 bg-transparent text-[13px] outline-none" />
        </div>
        <Segmented label="Columns" value={mode} onChange={setMode} options={[{ id: "both", label: "Both" }, { id: "organic", label: "Organic" }, { id: "local", label: "Map pack" }]} />
        <span className="ml-auto text-[12.5px] text-subtle">Compared with Oct 22 · Desktop · Austin, TX</span>
      </div>

      <Card pad={false} className="overflow-x-auto">
        <table className="w-full min-w-[760px] text-[13.5px]">
          <thead className="border-b border-line text-left text-[12.5px] text-muted">
            <tr>
              <Th k="term" className="pl-5">Keyword</Th>
              {mode !== "local" && <Th k="organic" className="text-right">Organic</Th>}
              {mode !== "local" && <Th k="change">Δ 7d</Th>}
              {mode !== "organic" && <Th k="local" className="text-right">Map pack</Th>}
              {mode !== "organic" && <th className="px-3 py-2.5 font-normal">Δ 7d</th>}
              <th className="px-3 py-2.5 font-normal">90 days</th>
              <Th k="volume" className="text-right">Volume</Th>
              <th className="px-3 py-2.5 pr-5 font-normal">URL</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((k) => (
              <tr key={k.id} onClick={() => navigate(`/rankings/${k.id}`)} className="cursor-pointer border-b border-line last:border-0 hover:bg-hover">
                <td className="px-3 py-2.5 pl-5">
                  <Link to={`/rankings/${k.id}`} onClick={(e) => e.stopPropagation()} className="font-medium hover:underline">{k.term}</Link>
                  <div className="mt-0.5 flex gap-1">{k.tags.map((t) => <span key={t} className="text-[11.5px] text-subtle">#{t}</span>)}</div>
                </td>
                {mode !== "local" && <td className="num px-3 py-2.5 text-right">{k.organic ?? "—"}</td>}
                {mode !== "local" && <td className="px-3 py-2.5"><RankDelta cur={k.organic} prev={k.organicPrev} /></td>}
                {mode !== "organic" && (
                  <td className="px-3 py-2.5 text-right">
                    {k.local ? <Badge tone={rankTone(k.local)} className="num">#{k.local}</Badge> : <span className="text-subtle">—</span>}
                  </td>
                )}
                {mode !== "organic" && <td className="px-3 py-2.5"><RankDelta cur={k.local} prev={k.localPrev} /></td>}
                <td className="px-3 py-2.5"><Sparkline data={k.history.map((h) => (mode === "local" ? h.local : h.organic))} invert /></td>
                <td className="num px-3 py-2.5 text-right text-muted">{fmt(k.volume)}</td>
                <td className="max-w-40 truncate px-3 py-2.5 pr-5 text-muted">{k.url}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!rows.length && <div className="py-12 text-center text-[13px] text-muted">No keywords match.</div>}
      </Card>
    </>
  );
}
