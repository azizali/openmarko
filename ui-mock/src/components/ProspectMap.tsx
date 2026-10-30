import { useMemo, useState } from "react";
import { MapPin } from "lucide-react";
import { Segmented, cn } from "./ui";
import { GridMap, GridLegend } from "./GridMap";
import { gridStats, type GridPoint } from "../data/mock";
import { leadersOf, prospectGrid, type Market, type Prospect } from "../data/prospects";

/**
 * A prospect's map pack next to the top 3 that beat them. Picking a
 * business swaps its grid into the same map, which is the core of the
 * sales story: "here's you, here's who's taking your calls".
 */
export function ProspectMap({ p, market, compact = false }: { p: Prospect; market: Market; compact?: boolean }) {
  const [whoId, setWhoId] = useState(p.id);
  const [size, setSize] = useState<"5" | "7">(compact ? "5" : "7");
  const [sel, setSel] = useState<GridPoint | null>(null);
  const n = Number(size);
  const field = useMemo(() => [p, ...leadersOf(market).filter((l) => l.id !== p.id)], [p, market]);
  const scans = useMemo(() => Object.fromEntries(field.map((x) => [x.id, prospectGrid(x, market, n)])), [field, market, n]);
  const who = field.find((x) => x.id === whoId) ?? p;
  const scan = scans[who.id];
  const c = (n - 1) / 2;
  const shown = sel ?? scan.points.find((x) => x.row === c && x.col === c)!;
  const pick = (id: string) => { setWhoId(id); setSel(null); };

  return (
    <div className={cn("grid gap-5", compact ? "md:grid-cols-[300px_1fr]" : "lg:grid-cols-[minmax(0,1fr)_300px]")}>
      <div className="min-w-0">
        <div className="mb-2 flex flex-wrap gap-1.5">
          {field.map((x) => (
            <button key={x.id} onClick={() => pick(x.id)} aria-pressed={x.id === whoId}
              className={cn("inline-flex h-7 max-w-full items-center gap-1.5 rounded-full border px-2.5 text-[12.5px] transition-colors",
                x.id === whoId ? (x.id === p.id ? "border-accent bg-accent text-white" : "border-ink bg-ink text-on-ink") : "border-line text-muted hover:bg-hover")}>
              <span className="num opacity-75">#{x.mapRank ?? "20+"}</span><span className="truncate">{x.id === p.id && compact ? "This business" : x.name}</span>
            </button>
          ))}
        </div>
        <div key={who.id + size} className="anim-fade"><GridMap scan={scan} compact={compact} selected={sel} onSelect={(pt) => setSel((cur) => (cur && cur.row === pt.row && cur.col === pt.col ? null : pt))} /></div>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
          <GridLegend />
          {!compact && <Segmented label="Grid size" value={size} onChange={(v) => { setSize(v); setSel(null); }} options={[{ id: "5", label: "5×5" }, { id: "7", label: "7×7" }]} />}
        </div>
      </div>

      <div className="min-w-0 space-y-4">
        <div>
          <div className="mb-2 text-[12.5px] font-medium text-muted">Top-3 coverage across the area</div>
          <ul className="space-y-2">
            {field.map((x) => {
              const st = gridStats(scans[x.id]);
              return (
                <li key={x.id}>
                  <button onClick={() => pick(x.id)} className={cn("block w-full rounded-md px-2 py-1.5 text-left hover:bg-hover", x.id === whoId && "bg-hover")}>
                    <div className="mb-1 flex justify-between gap-2 text-[12.5px]">
                      <span className={cn("truncate", x.id === p.id && "font-medium text-accent")}>{x.name}</span>
                      <span className="num shrink-0 text-muted">{st.solv.toFixed(0)}%</span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-hover"><div className={cn("h-full rounded-full", x.id === p.id ? "bg-accent" : "bg-ink")} style={{ width: `${Math.max(2, st.solv)}%` }} /></div>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
        <div key={`${who.id}-${shown.row}-${shown.col}`} className="anim-fade rounded-lg border border-line p-3">
          <div className="flex items-center gap-1.5 text-[12px] text-muted"><MapPin size={12} /> {sel ? `Searching from row ${sel.row + 1}, col ${sel.col + 1}` : `Searching from ${who.id === p.id ? "their" : "the"} front door`}</div>
          <div className="mt-1 text-[13.5px]"><b className="font-medium">{who.id === p.id ? p.name : who.name}</b> is <b className="num font-medium">{shown.rank ? `#${shown.rank}` : "not in the top 20"}</b> here</div>
          <ol className="mt-2 space-y-1">
            {shown.top3.map((name, i) => (
              <li key={name} className={cn("flex items-center gap-2 rounded px-2 py-1 text-[12.5px]", name === p.name ? "bg-accent-soft/60 font-medium" : "bg-hover")}>
                <span className="num w-3 text-muted">{i + 1}</span><span className="truncate">{name}</span>
              </li>
            ))}
          </ol>
          <p className="mt-2 text-[11.5px] text-subtle">Tap a dot to search from that spot.</p>
        </div>
      </div>
    </div>
  );
}
