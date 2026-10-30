import { useState } from "react";
import { Radar, ScanSearch, Store, Users, Target, Check, X, Loader2, Sparkles, MapPinned, Link2 } from "lucide-react";
import { Badge, Card, PageHeader, Progress, Tabs, cn } from "../components/ui";
import { RunButton } from "../components/RunStatus";
import { dur, lastDone, runKinds, runningOf, stamp, timeAgo, useRuns, type RunKind } from "../lib/runs";

const icons: Record<RunKind, typeof Radar> = { rank: Radar, audit: ScanSearch, profile: Store, competitors: Users, ai: Sparkles, citations: MapPinned, links: Link2, prospect: Target };

export default function Runs() {
  const runs = useRuns();
  const [kind, setKind] = useState<RunKind | "all">("all");
  const list = runs.filter((r) => kind === "all" || r.kind === kind).sort((a, b) => b.started - a.started);
  const running = runningOf(runs);
  const week = runs.filter((r) => Date.now() - r.started < 7 * 86_400_000);
  const spend = week.reduce((a, r) => a + r.cost, 0);
  const failed = week.filter((r) => r.status === "failed").length;

  return (
    <>
      <PageHeader title="Activity" sub="Every scan, crawl and sync that refreshes your data: scheduled and manual, with status, duration and cost." />

      <div className="mb-6 grid gap-3 sm:grid-cols-2 2xl:grid-cols-4">
        {(Object.keys(runKinds) as RunKind[]).map((k) => {
          const Icon = icons[k];
          const last = lastDone(runs, k);
          const live = runningOf(runs, k)[0];
          return (
            <Card key={k} className={cn("!p-4", live && "border-info/40")}>
              <div className="flex items-center gap-2 text-[13px] font-medium"><Icon size={14} className="text-muted" /> {runKinds[k].label}</div>
              {live ? (
                <div className="mt-2">
                  <div className="flex justify-between text-[12.5px] text-info"><span>In progress</span><span className="num">{Math.round(live.progress * 100)}%</span></div>
                  <Progress value={live.progress * 100} tone="info" className="mt-1.5" />
                </div>
              ) : (
                <div className="mt-2 text-[12.5px] text-muted">Last {last ? timeAgo(last.started + (last.durationSec ?? 0) * 1000) : "never"}</div>
              )}
              <div className="mt-1 text-[12px] text-subtle">{runKinds[k].schedule}</div>
            </Card>
          );
        })}
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-x-6 gap-y-2 text-[13px] text-muted">
        <span><b className="num font-medium text-fg">{running.length}</b> running</span>
        <span><b className="num font-medium text-fg">{week.length}</b> runs in the last 7 days</span>
        <span><b className="num font-medium text-fg">${spend.toFixed(2)}</b> spent</span>
        {failed > 0 && <span className="text-bad"><b className="num font-medium">{failed}</b> failed</span>}
        <span className="ml-auto flex gap-2"><RunButton kind="audit" /><RunButton kind="rank" variant="primary" /></span>
      </div>

      <Tabs value={kind} onChange={setKind} tabs={[
        { id: "all", label: "All", count: runs.length },
        ...(Object.keys(runKinds) as RunKind[]).map((k) => ({ id: k, label: runKinds[k].label, count: runs.filter((r) => r.kind === k).length })),
      ]} />

      <Card pad={false} className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[760px] text-[13.5px]">
          <thead className="border-b border-line text-left text-[12.5px] text-muted">
            <tr>
              <th className="px-5 py-2.5 font-normal">Status</th>
              <th className="px-3 py-2.5 font-normal">Run</th>
              <th className="px-3 py-2.5 font-normal">Started</th>
              <th className="px-3 py-2.5 text-right font-normal">Duration</th>
              <th className="px-3 py-2.5 font-normal">Trigger</th>
              <th className="px-3 py-2.5 pr-5 text-right font-normal">Cost</th>
            </tr>
          </thead>
          <tbody>
            {list.map((r) => {
              const Icon = icons[r.kind];
              return (
                <tr key={r.id} className={cn("border-b border-line align-top last:border-0", r.status === "running" && "bg-info-soft/30")}>
                  <td className="w-36 px-5 py-3">
                    {r.status === "running" ? (
                      <div>
                        <Badge tone="info"><Loader2 size={11} className="animate-spin" /> Running</Badge>
                        <Progress value={r.progress * 100} tone="info" className="mt-2 w-24" />
                      </div>
                    ) : r.status === "done" ? <Badge tone="good"><Check size={11} /> Done</Badge> : <Badge tone="bad"><X size={11} /> Failed</Badge>}
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-2 font-medium"><Icon size={14} className="text-muted" />{r.label}</div>
                    <div className="text-[12.5px] text-muted">{r.scope}</div>
                    {r.note && <div className="mt-1 text-[12.5px] text-bad">{r.note}</div>}
                  </td>
                  <td className="px-3 py-3"><div>{timeAgo(r.started)}</div><div className="text-[12px] text-subtle">{stamp(r.started)}</div></td>
                  <td className="num px-3 py-3 text-right">{r.status === "running" ? <span className="text-muted">{Math.round((Date.now() - r.started) / 1000)}s / ~{r.expectedSec}s</span> : dur(r.durationSec)}</td>
                  <td className="px-3 py-3"><Badge tone={r.trigger === "Manual" ? "accent" : "neutral"}>{r.trigger}</Badge></td>
                  <td className="num px-3 py-3 pr-5 text-right">${r.cost.toFixed(2)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>
    </>
  );
}
