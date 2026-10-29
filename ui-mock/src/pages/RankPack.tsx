import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router";
import { Radar, MapPin, Columns2, Square, Loader2 } from "lucide-react";
import { Badge, Button, Card, CardHeader, Modal, Progress, Segmented, PageHeader, cn, fmt, useToast } from "../components/ui";
import { GridMap, GridLegend } from "../components/GridMap";
import { business, competitors, gridStats, keywords, makeGrid, type GridPoint } from "../data/mock";
import { estimateGridCost, gridCoordinates } from "../lib/api";

export default function RankPack() {
  const [params, setParams] = useSearchParams();
  const kwId = params.get("kw") ?? "kw_1";
  const kw = keywords.find((k) => k.id === kwId) ?? keywords[0];
  const [size, setSize] = useState<"5" | "7" | "9">("7");
  const [view, setView] = useState<"single" | "compare">("single");
  const [sel, setSel] = useState<GridPoint | null>(null);
  const [runOpen, setRunOpen] = useState(false);
  const [running, setRunning] = useState(false);
  const { toast, node } = useToast();

  const n = Number(size);
  const seed = Number(kwId.split("_")[1]);
  const scan = useMemo(() => makeGrid(kwId, n, 1, seed % 3), [kwId, n, seed]);
  const prev = useMemo(() => makeGrid(kwId, n, 2, (seed % 3) - 1.5), [kwId, n, seed]);
  const s = gridStats(scan), p = gridStats(prev);
  const coords = gridCoordinates(business.lat, business.lng, n, 3);
  const selCoord = sel && coords.find((c) => c.row === sel.row && c.col === sel.col);

  const metric = (label: string, cur: number, was: number, fmtFn: (v: number) => string, lowerBetter = false) => {
    const better = lowerBetter ? cur < was : cur > was;
    return (
      <div>
        <div className="text-[12.5px] text-muted">{label}</div>
        <div className="num mt-1 font-serif text-[26px] leading-none">{fmtFn(cur)}</div>
        <div className={cn("num mt-1 text-[12px]", Math.abs(cur - was) < 0.05 ? "text-subtle" : better ? "text-good" : "text-bad")}>
          {cur > was ? "+" : ""}{fmtFn(cur - was)} vs Sep 28
        </div>
      </div>
    );
  };

  return (
    <>
      <PageHeader
        title="Rank pack"
        sub="Where you appear in Google's local 3-pack across your service area, scanned from each grid point."
        actions={<Button variant="primary" icon={<Radar size={14} />} onClick={() => setRunOpen(true)}>New scan</Button>}
      />

      <div className="mb-5 flex flex-wrap items-center gap-2">
        <label className="sr-only" htmlFor="kw-select">Keyword</label>
        <select id="kw-select" value={kwId} onChange={(e) => { setParams({ kw: e.target.value }); setSel(null); }} className="h-8 rounded-md border border-line bg-surface px-2.5 text-[13px] outline-none">
          {keywords.filter((k) => k.local).map((k) => <option key={k.id} value={k.id}>{k.term}</option>)}
        </select>
        <Segmented label="Grid size" value={size} onChange={(v) => { setSize(v); setSel(null); }} options={[{ id: "5", label: "5×5" }, { id: "7", label: "7×7" }, { id: "9", label: "9×9" }]} />
        <Segmented label="View" value={view} onChange={setView} options={[{ id: "single", label: <span className="inline-flex items-center gap-1"><Square size={12} /> Latest</span> }, { id: "compare", label: <span className="inline-flex items-center gap-1"><Columns2 size={12} /> Compare</span> }]} />
        <span className="ml-auto text-[12.5px] text-subtle">3 mi radius · Oct 28, 06:14 · {n * n} points</span>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-line bg-line sm:grid-cols-4">
        <div className="bg-surface p-5">{metric("Share of local voice", s.solv, p.solv, (v) => `${v.toFixed(0)}%`)}</div>
        <div className="bg-surface p-5">{metric("Avg. rank (ARP)", s.arp, p.arp, (v) => v.toFixed(1), true)}</div>
        <div className="bg-surface p-5">{metric("Avg. found rank (ATRP)", s.atrp, p.atrp, (v) => v.toFixed(1), true)}</div>
        <div className="bg-surface p-5">{metric("Top-3 points", s.top3, p.top3, (v) => `${Math.round(v)}`)}</div>
      </div>

      {view === "compare" ? (
        <div className="grid gap-6 md:grid-cols-2">
          {[["Sep 28", prev], ["Oct 28", scan]].map(([label, sc]) => (
            <Card key={label as string}>
              <CardHeader title={label as string} sub={kw.term} />
              <GridMap scan={sc as typeof scan} />
            </Card>
          ))}
          <div className="md:col-span-2"><GridLegend /></div>
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
          <Card>
            <GridMap scan={scan} selected={sel} onSelect={setSel} />
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2"><GridLegend /><span className="text-[12px] text-subtle">Click a point to see who ranks there</span></div>
          </Card>
          <Card>
            {sel ? (
              <div className="anim-fade">
                <div className="flex items-center gap-2 text-[12.5px] text-muted"><MapPin size={13} /> Row {sel.row + 1}, col {sel.col + 1}</div>
                {selCoord && <div className="num mt-0.5 text-[12px] text-subtle">{selCoord.lat.toFixed(4)}, {selCoord.lng.toFixed(4)}</div>}
                <div className="mt-3 font-serif text-[30px] leading-none">{sel.rank ? `#${sel.rank}` : "Not in top 20"}</div>
                <div className="mt-5 mb-2 text-[12.5px] font-medium text-muted">Local pack at this point</div>
                <ol className="space-y-1.5">
                  {sel.top3.map((name, i) => (
                    <li key={name} className={cn("flex items-center gap-2.5 rounded-md px-2.5 py-2 text-[13.5px]", name === business.name ? "bg-accent-soft/60 font-medium" : "bg-hover")}>
                      <span className="num w-4 text-muted">{i + 1}</span>
                      <span className="truncate">{name}</span>
                    </li>
                  ))}
                </ol>
                {(sel.rank ?? 99) > 3 && (
                  <p className="mt-4 text-[12.5px] text-muted">You're outside the pack here. The businesses above have more relevant categories, or sit closer to this point.</p>
                )}
              </div>
            ) : (
              <>
                <CardHeader title="Share of local voice" sub="Competitors on this keyword" />
                <ul className="space-y-3">
                  {[...competitors].sort((a, b) => b.solv - a.solv).map((c) => (
                    <li key={c.id}>
                      <div className="mb-1 flex justify-between text-[13px]">
                        <span className={cn("truncate", c.isYou && "font-medium")}>{c.name}{c.isYou && " (you)"}</span>
                        <span className="num text-muted">{c.solv}%</span>
                      </div>
                      <Progress value={c.solv} tone={c.isYou ? "accent" : "ink"} />
                    </li>
                  ))}
                </ul>
                <Link to="/competitors" className="mt-5 block text-[13px] text-muted hover:text-fg">Compare profiles →</Link>
              </>
            )}
          </Card>
        </div>
      )}

      <Modal
        open={runOpen}
        onClose={() => !running && setRunOpen(false)}
        title="Run a new scan"
        footer={<>
          <Button variant="ghost" onClick={() => setRunOpen(false)} disabled={running}>Cancel</Button>
          <Button variant="primary" disabled={running} onClick={() => { setRunning(true); setTimeout(() => { setRunning(false); setRunOpen(false); toast("Scan queued · results in ~2 minutes"); }, 1200); }}>
            {running ? <><Loader2 size={14} className="animate-spin" /> Queuing…</> : "Run scan"}
          </Button>
        </>}
      >
        <div className="space-y-3 text-[13.5px]">
          <div className="flex justify-between"><span className="text-muted">Keyword</span><span>{kw.term}</span></div>
          <div className="flex justify-between"><span className="text-muted">Grid</span><span className="num">{n}×{n}, 3 mi</span></div>
          <div className="flex justify-between"><span className="text-muted">DataForSEO tasks</span><span className="num">{fmt(n * n)} × maps/live</span></div>
          <div className="flex justify-between border-t border-line pt-3"><span className="text-muted">Estimated cost</span><Badge className="num">${estimateGridCost(n, 1).toFixed(3)}</Badge></div>
        </div>
      </Modal>
      {node}
    </>
  );
}
