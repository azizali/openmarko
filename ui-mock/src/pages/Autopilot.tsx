import { Link } from "react-router";
import { Play } from "lucide-react";
import { Badge, Button, Card, PageHeader, Segmented, Select, cn, useToast } from "../components/ui";
import { actions, applyPreset, levelMeta, presetLevel, setLevel, useAutopilot, type Action, type Level, type Preset } from "../lib/autopilot";
import { describeEvery, everyMeta, jobs, setEvery, useSchedules, type Every, type Job } from "../lib/schedules";
import { isOn, useFeatures } from "../lib/features";
import { useAds } from "../lib/ads";
import { lastDone, runningOf, startRun, timeAgo, useRuns } from "../lib/runs";
import { assistant } from "../lib/whitelabel";

const riskTone = { low: "good", medium: "warn", high: "bad" } as const;
const bySection = <T extends { section: string }>(items: T[]) => [...new Set(items.map((i) => i.section))].map((s) => ({ section: s, items: items.filter((i) => i.section === s) }));
const shared: Partial<Record<Action["id"], { to: string; where: string }>> = {
  ads_safe: { to: "/ads", where: "the Ads goal" },
  ads_launch: { to: "/ads", where: "the Ads goal" },
  outreach_send: { to: "/settings/outreach", where: "Outreach settings" },
};

/** Settings → Autopilot: what Marko may do without asking, per action. */
export function Autopilot() {
  const lv = useAutopilot();
  const flags = useFeatures();
  const { toast, node } = useToast();
  const shown = actions.filter((a) => isOn(a.feature, flags));
  const preset: Preset | "custom" = (["careful", "balanced", "handsoff"] as const).find((p) => shown.every((a) => lv[a.id] === presetLevel(a, p))) ?? "custom";
  return (
    <>
      <PageHeader title="Autopilot" sub={`What ${assistant()} does on its own when it finds something to change. Ask first puts it in To-do for you. On its own does it and logs it in Activity, with Undo.`} />
      <div className="max-w-3xl space-y-4">
        <Card className="flex flex-wrap items-center gap-3">
          <div className="min-w-0 flex-1"><div className="text-[13.5px] font-medium">Start from</div><div className="text-[12.5px] text-muted">Then change any row below.</div></div>
          <Segmented label="Preset" value={preset} onChange={(p) => { if (p !== "custom") { applyPreset(p); toast("Applied"); } }}
            options={[{ id: "careful", label: "Careful" }, { id: "balanced", label: "Low risk on its own" }, { id: "handsoff", label: "Hands-off" }, ...(preset === "custom" ? [{ id: "custom" as const, label: "Custom" }] : [])]} />
        </Card>
        {bySection(shown).map(({ section, items }) => (
          <Card key={section} pad={false}>
            <div className="border-b border-line px-5 py-3 text-[14px] font-medium">{section}</div>
            {items.map((a) => (
              <div key={a.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-line px-5 py-3.5 last:border-0">
                <div className="min-w-0 flex-1 basis-64">
                  <div className="flex flex-wrap items-center gap-2 text-[13.5px]">{a.label}<Badge tone={riskTone[a.risk]}>{a.risk} risk</Badge></div>
                  <div className="text-[12.5px] text-muted">{a.hint}{shared[a.id] && <>{a.hint ? ". " : ""}Same setting as <Link to={shared[a.id]!.to} className="underline underline-offset-2">{shared[a.id]!.where}</Link></>}</div>
                </div>
                <Segmented<Level> label={a.label} value={lv[a.id]} onChange={(v) => setLevel(a.id, v)} options={a.levels.map((l) => ({ id: l, label: <span title={levelMeta[l].hint}>{levelMeta[l].label}</span> }))} />
              </div>
            ))}
          </Card>
        ))}
        <p className="text-[12.5px] text-subtle">When things run is in <Link to="/settings/schedules" className="underline underline-offset-2">Schedules</Link>. Your own rules for contacts (when someone books, send a reminder) are <Link to="/workflows" className="underline underline-offset-2">Workflows</Link>. Turned-off features don't show here.</p>
      </div>
      {node}
    </>
  );
}

function nextRun(last: number | undefined, every: Every) {
  if (every === "paused") return "Paused";
  const h = everyMeta[every].hours;
  if (!last) return "Soon";
  const due = last + h * 3_600_000 - Date.now();
  if (due <= 0) return "Due now";
  const hrs = Math.round(due / 3_600_000);
  return hrs < 1 ? "Within the hour" : hrs < 48 ? `In ${hrs}h` : `In ${Math.round(hrs / 24)} days`;
}

/** Settings → Schedules: everything that runs on its own clock. */
export function Schedules() {
  const ev = useSchedules();
  const runs = useRuns();
  const ads = useAds();
  const flags = useFeatures();
  const { toast, node } = useToast();
  const shown = jobs.filter((j) => isOn(j.feature, flags));
  const row = (j: Job) => {
    const last = j.run ? lastDone(runs, j.run)?.started : j.id === "ads_review" ? ads.lastReview : undefined;
    const running = j.run && runningOf(runs, j.run).length > 0;
    return (
      <div key={j.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-line px-5 py-3.5 last:border-0">
        <div className="min-w-0 flex-1 basis-64">
          <div className="text-[13.5px]">{j.label}</div>
          <div className="text-[12.5px] text-muted">{j.what}{j.cost ? ` · ${j.cost}` : ""}</div>
          <div className={cn("mt-0.5 text-[12px]", ev[j.id] === "paused" ? "text-warn" : "text-subtle")}>
            {describeEvery(j, ev[j.id])}{ev[j.id] !== "paused" && (running || last) && <> · next: {running ? "running now" : nextRun(last, ev[j.id]).toLowerCase()}</>}{last && <> · last {timeAgo(last)}</>}
          </div>
        </div>
        <Select size="sm" className="w-auto" value={ev[j.id]} onChange={(e) => { setEvery(j.id, e.target.value as Every); toast(`${j.label}: ${describeEvery(j, e.target.value as Every)}`); }} aria-label={`${j.label} frequency`}>
          {j.options.map((o) => <option key={o} value={o}>{everyMeta[o].label}</option>)}
        </Select>
        {j.run && <Button size="sm" variant="ghost" icon={<Play size={12} />} disabled={!!running} onClick={() => { startRun(j.run!); toast(`${j.label} started`); }}>Run now</Button>}
      </div>
    );
  };
  return (
    <>
      <PageHeader title="Schedules" sub="Everything that runs on its own: scans, syncs and reviews. More often means fresher numbers and a higher data bill." />
      <div className="max-w-3xl space-y-4">
        {bySection(shown).map(({ section, items }) => (
          <Card key={section} pad={false}>
            <div className="border-b border-line px-5 py-3 text-[14px] font-medium">{section}</div>
            {items.map(row)}
          </Card>
        ))}
        <p className="text-[12.5px] text-subtle">What {assistant()} may change with what a run finds is <Link to="/settings/autopilot" className="underline underline-offset-2">Autopilot</Link>. Report emails are scheduled in <Link to="/reports" className="underline underline-offset-2">Reports</Link>. Everything that ran is in <Link to="/settings/activity" className="underline underline-offset-2">Activity</Link>.</p>
      </div>
      {node}
    </>
  );
}
