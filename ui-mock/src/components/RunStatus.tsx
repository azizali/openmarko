import { useState } from "react";
import { Link } from "react-router";
import { Loader2, Radar, RefreshCw, Clock } from "lucide-react";
import { Badge, Button, Modal, Segmented } from "./ui";
import { keywords } from "../data/mock";
import { estimateGridCost } from "../lib/api";
import { lastDone, runKinds, runningOf, startRun, stamp, timeAgo, useRuns, type Run, type RunKind } from "../lib/runs";

/** Which data a page is built from. null = the page has no refreshable data. */
export function kindForPath(path: string): RunKind | null {
  if (path === "/" || path.startsWith("/rankings") || path.startsWith("/keywords") || path.startsWith("/todo") || path.startsWith("/reports")) return "rank";
  if (path.startsWith("/audit")) return "audit";
  if (path.startsWith("/profile")) return "profile";
  if (path.startsWith("/competitors") || path.startsWith("/factors")) return "competitors";
  if (path.startsWith("/ai")) return "ai";
  if (path.startsWith("/citations")) return new URLSearchParams(location.hash.split("?")[1] ?? "").get("tab") === "links" ? "links" : "citations";
  if (path.startsWith("/prospects")) return "prospect";
  return null;
}

const finished = (r: Run) => r.started + (r.durationSec ?? 0) * 1000;

/** "Updated 3h ago", plus a live chip for anything running right now. */
export function Freshness({ kind }: { kind: RunKind | null }) {
  const runs = useRuns();
  const last = kind && lastDone(runs, kind);
  const running = runningOf(runs);
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[12.5px] text-muted">
      {last && (
        <span className="inline-flex items-center gap-1.5" title={`${runKinds[last.kind].label} finished ${stamp(finished(last))}`}>
          <Clock size={12} className="text-subtle" /> Updated <b className="font-medium text-fg">{timeAgo(finished(last))}</b>
          <span className="hidden text-subtle sm:inline">· {stamp(finished(last))}</span>
        </span>
      )}
      {running.map((r) => (
        <Link key={r.id} to="/settings/activity" className="inline-flex items-center gap-1.5 rounded-full bg-info-soft px-2 py-0.5 font-medium text-info hover:opacity-80">
          <span className="relative flex size-2"><span className="absolute inline-flex size-full animate-ping rounded-full bg-info opacity-60" /><span className="relative inline-flex size-2 rounded-full bg-info" /></span>
          {r.kind === "prospect" ? "Searching" : `${runKinds[r.kind].label} running`} <span className="num">{Math.round(r.progress * 100)}%</span>
        </Link>
      ))}
    </div>
  );
}

/** Starts a run for this page's data. Locked while one of the same kind is in progress. */
export function RunButton({ kind, variant = "secondary" }: { kind: RunKind; variant?: "primary" | "secondary" }) {
  const runs = useRuns();
  const [open, setOpen] = useState(false);
  const [grid, setGrid] = useState<"5" | "7" | "9">("7");
  const active = runningOf(runs, kind)[0];
  const meta = runKinds[kind];
  const n = Number(grid);
  const kwCount = keywords.length;
  const rankCost = estimateGridCost(n, keywords.filter((k) => k.local).length) + kwCount * 0.002;

  if (active) {
    return (
      <Link to="/settings/activity" title="A run is already in progress. Open the run log" className="inline-flex h-9 items-center gap-1.5 rounded-md border border-line bg-surface px-3.5 text-[13.5px] font-medium whitespace-nowrap text-muted hover:bg-hover">
        <Loader2 size={14} className="animate-spin" />
        {kind === "rank" ? "Scan" : meta.label} in progress · <span className="num">{Math.round(active.progress * 100)}%</span>
      </Link>
    );
  }
  return (
    <>
      <Button variant={variant} icon={kind === "rank" ? <Radar size={14} /> : <RefreshCw size={14} />} onClick={() => setOpen(true)}>{meta.button}</Button>
      <Modal open={open} onClose={() => setOpen(false)} title={meta.button} footer={<>
        <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
        <Button variant="primary" onClick={() => {
          startRun(kind, kind === "rank" ? { scope: `${kwCount} keywords · ${n}×${n} grid`, cost: rankCost } : {});
          setOpen(false);
        }}>Start</Button>
      </>}>
        <div className="space-y-3 text-[13.5px]">
          {kind === "rank" ? (
            <>
              <div className="flex justify-between"><span className="text-muted">Keywords</span><span className="num">{kwCount}</span></div>
              <div className="flex items-center justify-between"><span className="text-muted">Map grid</span>
                <Segmented label="Grid size" value={grid} onChange={setGrid} options={[{ id: "5", label: "5×5" }, { id: "7", label: "7×7" }, { id: "9", label: "9×9" }]} />
              </div>
              <div className="flex justify-between"><span className="text-muted">Checks</span><span className="num">{(keywords.filter((k) => k.local).length * n * n + kwCount).toLocaleString()} searches</span></div>
            </>
          ) : (
            <div className="flex justify-between"><span className="text-muted">Scope</span><span>{lastDone(runs, kind)?.scope ?? "Everything"}</span></div>
          )}
          <div className="flex justify-between"><span className="text-muted">Schedule</span><span>{meta.schedule}</span></div>
          <div className="flex justify-between border-t border-line pt-3"><span className="text-muted">Estimated cost</span>
            <Badge className="num">${(kind === "rank" ? rankCost : lastDone(runs, kind)?.cost ?? 0.05).toFixed(3)}</Badge>
          </div>
          <p className="text-[12.5px] text-subtle">You can keep working. Pages update when the run finishes, and it's logged under Runs.</p>
        </div>
      </Modal>
    </>
  );
}
