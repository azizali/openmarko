import { useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import {
  ArrowDown, ArrowUp, Bookmark, ChevronsUpDown, Loader2, Pause, Play, Plug, RefreshCw, Scissors, Search, Settings2, ShieldBan, Sparkles, TrendingUp, Undo2, Wand2, X,
} from "lucide-react";
import { Badge, Button, Card, Checkbox, Drawer, LineChart, PageHeader, Segmented, Sparkline, Tabs, Toggle, cn, useToast } from "../components/ui";
import { AdPlatformMark, ConnectToolModal, CreativeThumb, VerdictBadge, styleFor } from "../components/Ads";
import { adPlatforms, goalHistory, resultKinds, toolOf, type AdPlatform, type Level, type ResultKind, type Row } from "../data/ads";
import {
  applyAll, applyRec, cadences, connectedPlatforms, dailyBudget, dismissRec, metricsOf, money, nextReview, recommendations, resultWord, runReview, setBudget, setGoal,
  setRowStatus, undoChange, useAds, verdictOf, verdicts, type Cadence, type Goal, type Rec, type RecKind, type Verdict,
} from "../lib/ads";
import { saveRowToSwipe } from "../lib/creatives";
import { useOn } from "../lib/features";
import { timeAgo } from "../lib/runs";
import { assistant, product } from "../lib/whitelabel";

type Col = "name" | "verdict" | "budget" | "spend" | "results" | "cpa" | "ctr" | "frequency";
const recIcon: Record<RecKind, typeof Pause> = { pause: Pause, scale: TrendingUp, cut: Scissors, negatives: ShieldBan, refresh: RefreshCw, more: Wand2 };
const levels: { id: Level; label: string }[] = [{ id: "campaign", label: "Campaigns" }, { id: "adset", label: "Ad sets" }, { id: "ad", label: "Ads" }];
const verdictOrder: Verdict[] = ["losing", "tired", "learning", "on", "winning", "paused"];
const inHours = (ms: number) => { const h = Math.round((ms - Date.now()) / 3_600_000); return h <= 0 ? "due now" : h < 24 ? `in ${h}h` : `in ${Math.round(h / 24)} day${Math.round(h / 24) === 1 ? "" : "s"}`; };

/**
 * Ads: one goal (a cost per booked patient), what every campaign, ad set and
 * ad is doing against it, and what Marko recommends changing. The review runs
 * on the goal's schedule; in auto mode the safe changes are applied within
 * the guardrails and land in Changes, each with Undo.
 */
export default function Ads() {
  const st = useAds();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const { toast, node } = useToast();
  const [connect, setConnect] = useState<AdPlatform | null>(null);
  const [goalOpen, setGoalOpen] = useState(false);
  const [level, setLevel] = useState<Level>("ad");
  const [platform, setPlatform] = useState<AdPlatform | "all">("all");
  const [only, setOnly] = useState<Verdict | null>(null);
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<{ col: Col; dir: "asc" | "desc" }>({ col: "spend", dir: "desc" });
  const [sel, setSel] = useState<string[]>([]);
  const tab = params.get("tab") === "changes" ? "changes" : "campaigns";
  const g = st.goal;
  const live = connectedPlatforms(st);
  const studioOn = useOn("ad_studio");
  // Without Creative studio there's nowhere to make fresh versions, so those recommendations are left out.
  const recs = recommendations(st).filter((r) => studioOn || (r.kind !== "refresh" && r.kind !== "more"));
  const rows = st.rows.filter((r) => st.connected[r.platform]);

  // The goal, this week: every ad's results add up to the account's.
  const ads = rows.filter((r) => r.level === "ad");
  const spend = ads.reduce((a, r) => a + r.spend, 0), results = ads.reduce((a, r) => a + r.results, 0);
  const cpa = results ? spend / results : 0;
  const perDay = dailyBudget(rows);

  const parentName = (r: Row) => [r.level === "ad" ? rows.find((x) => x.id === r.parentId)?.name : null, r.level !== "campaign" ? rows.find((x) => x.id === r.campaignId)?.name : null].filter(Boolean).join(" › ");
  const all = rows.filter((r) => r.level === level && (platform === "all" || r.platform === platform));
  const counts = Object.fromEntries(verdictOrder.map((v) => [v, all.filter((r) => verdictOf(rows, r, g) === v).length])) as Record<Verdict, number>;
  const shown = useMemo(() => {
    const val = (r: Row): number | string => {
      const m = metricsOf(rows, r.id);
      return { name: r.name.toLowerCase(), verdict: verdictOrder.indexOf(verdictOf(rows, r, g)), budget: rows.find((x) => x.id === r.campaignId)?.budget ?? 0, spend: m.spend, results: m.results, cpa: m.results ? m.cpa : 1e9, ctr: m.ctr, frequency: r.frequency ?? 0 }[sort.col];
    };
    const ql = q.trim().toLowerCase();
    return all
      .filter((r) => (!only || verdictOf(rows, r, g) === only) && (!ql || `${r.name} ${parentName(r)}`.toLowerCase().includes(ql)))
      .sort((a, b) => { const x = val(a), y = val(b); return (x < y ? -1 : x > y ? 1 : 0) * (sort.dir === "asc" ? 1 : -1); });
  }, [all, only, q, sort, st]);
  const picked = shown.filter((r) => sel.includes(r.id));

  const sortBy = (col: Col) => setSort((s) => (s.col === col ? { col, dir: s.dir === "asc" ? "desc" : "asc" } : { col, dir: col === "name" || col === "cpa" || col === "verdict" ? "asc" : "desc" }));
  const th = (col: Col, label: string, right = true) => (
    <th key={col} aria-sort={sort.col === col ? (sort.dir === "asc" ? "ascending" : "descending") : "none"} className={cn("px-3 py-2.5 font-normal whitespace-nowrap", right && "text-right")}>
      <button onClick={() => sortBy(col)} className={cn("inline-flex items-center gap-1 hover:text-fg", sort.col === col && "font-medium text-fg")}>
        {label}{sort.col === col ? (sort.dir === "asc" ? <ArrowUp size={12} /> : <ArrowDown size={12} />) : <ChevronsUpDown size={12} className="opacity-40" />}
      </button>
    </th>
  );
  const review = () => runReview((applied, open) => toast(applied ? `Review done: ${assistant()} applied ${applied} change${applied === 1 ? "" : "s"}, ${open} to look at` : `Review done: ${open} recommendation${open === 1 ? "" : "s"}`));
  const fresh = (ids: string[]) => navigate(`/ads/studio?from=${ids.join(",")}`);
  const doRec = (r: Rec) => (r.kind === "refresh" || r.kind === "more" ? fresh([r.rowId]) : (applyRec(r), toast("Done. It's in Changes, with Undo")));

  return (
    <>
      <PageHeader
        title="Ads"
        sub={`Every campaign against one goal: ${resultKinds[g.result].label.toLowerCase()} at ${money(g.target)} or less. ${assistant()} reviews ${cadences[g.cadence].label.toLowerCase()} and ${g.mode === "auto" ? "makes the safe changes itself" : "recommends changes for you to approve"}.`}
        actions={<>
          {live.map((p) => <Link key={p} to="/settings/ads" title={`${adPlatforms[p].name} · ${toolOf(p).account}`} className="inline-flex h-9 items-center gap-2 rounded-lg border border-line bg-surface px-2.5 text-[13px] shadow-card hover:bg-hover"><AdPlatformMark platform={p} size={20} /><Settings2 size={13} className="text-muted" /></Link>)}
          {studioOn && <Link to="/ads/studio"><Button icon={<Wand2 size={14} />}>Make creatives</Button></Link>}
          {live.length > 0 && <Button variant="primary" disabled={st.reviewing} onClick={review} icon={st.reviewing ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}>{st.reviewing ? "Reviewing…" : "Review now"}</Button>}
        </>}
      />

      {!live.length ? (
        <Card className="flex flex-col items-start gap-4 sm:flex-row">
          <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-accent-soft text-accent"><Plug size={20} /></span>
          <div className="flex-1">
            <div className="text-[15px] font-medium">Connect an ad account</div>
            <p className="mt-1 mb-3 text-[13.5px] text-muted">{product()} reads results, publishes the creatives you approve, and pauses or scales ads toward your goal.</p>
            <div className="flex flex-wrap gap-2">{(Object.keys(adPlatforms) as AdPlatform[]).map((p) => <Button key={p} icon={<AdPlatformMark platform={p} size={18} />} onClick={() => setConnect(p)}>{adPlatforms[p].name}</Button>)}</div>
          </div>
        </Card>
      ) : (
        <>
          {/* Goal: one card, the numbers that matter and the loop's state. */}
          <Card className="mb-4 grid gap-5 lg:grid-cols-[minmax(0,1fr)_420px]">
            <div className="min-w-0">
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <span className="num font-serif text-[34px] leading-none">{cpa ? money(cpa) : "—"}</span>
                <span className="text-[14px] text-muted">a {resultWord(g, 1)} this week, target <span className="num">{money(g.target)}</span></span>
                {cpa > 0 && <Badge tone={cpa <= g.target ? "good" : "bad"}>{cpa <= g.target ? `${Math.round((1 - cpa / g.target) * 100)}% under` : `${Math.round((cpa / g.target - 1) * 100)}% over`}</Badge>}
              </div>
              <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-3 text-[13px] sm:grid-cols-4">
                <div><dt className="text-muted">{resultKinds[g.result].label}</dt><dd className="num mt-0.5 text-[16px]">{results}</dd></div>
                <div><dt className="text-muted">Spent, 7 days</dt><dd className="num mt-0.5 text-[16px]">{money(spend)}</dd></div>
                <div><dt className="text-muted">Daily budgets</dt><dd className="num mt-0.5 text-[16px]">{money(perDay)} <span className="text-[12px] text-muted">of {money(g.monthly / 30)} cap</span></dd></div>
                <div><dt className="text-muted">Next review</dt><dd className="mt-0.5 text-[16px]">{st.reviewing ? "Now" : inHours(nextReview(st))} <span className="text-[12px] text-muted">last {timeAgo(st.lastReview)}</span></dd></div>
              </dl>
              <div className="mt-4 flex flex-wrap items-center gap-2 text-[12.5px] text-muted">
                <Badge tone={g.mode === "auto" ? "accent" : "neutral"}>{g.mode === "auto" ? "Auto within guardrails" : "Recommend, you approve"}</Badge>
                <span>Budget steps up to {g.step}% · judges an ad after {money(g.minSpend * g.target)} · {g.launch ? "may launch new ads" : "new ads need your OK"}</span>
                <Button size="sm" variant="ghost" icon={<Settings2 size={12} />} onClick={() => setGoalOpen(true)}>Goal & guardrails</Button>
              </div>
            </div>
            <div>
              <div className="mb-1 text-[12.5px] text-muted">Cost per {resultWord(g, 1)}, weekly</div>
              <LineChart height={130} labels={goalHistory.labels} format={(v) => `$${v}`} series={[
                { name: `Cost per ${resultWord(g, 1)}`, color: "var(--ink)", values: [...goalHistory.cost.slice(0, -1), Math.round(cpa)] },
                { name: "Target", color: "var(--good)", dashed: true, values: goalHistory.labels.map(() => g.target) },
              ]} />
            </div>
          </Card>

          {recs.length > 0 && (
            <Card pad={false} className="mb-6">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-3">
                <div className="flex items-center gap-2 text-[14px] font-medium"><Sparkles size={14} className="text-accent" />{assistant()} recommends <span className="num rounded-full bg-hover px-1.5 text-[11.5px] text-muted">{recs.length}</span></div>
                {recs.filter((r) => r.safe).length > 1 && <Button size="sm" variant="primary" onClick={() => { applyAll(recs); toast("Applied. Each one is in Changes, with Undo"); }}>Apply {recs.filter((r) => r.safe).length} budget & pause changes</Button>}
              </div>
              {recs.map((r) => {
                const Icon = recIcon[r.kind];
                const row = rows.find((x) => x.id === r.rowId);
                return (
                  <div key={r.id} className="flex flex-col gap-3 border-b border-line px-5 py-3.5 last:border-0 md:flex-row md:items-center">
                    <span className={cn("grid size-8 shrink-0 place-items-center rounded-lg", r.kind === "scale" || r.kind === "more" ? "bg-good-soft text-good" : r.kind === "refresh" ? "bg-warn-soft text-warn" : "bg-hover text-fg")}><Icon size={15} /></span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2 text-[14px] font-medium">{row && <AdPlatformMark platform={row.platform} size={16} />}{r.title}</div>
                      <p className="mt-0.5 mb-0 text-[13px] leading-[1.5] text-muted">{r.why} <span className="text-good">{r.impact}.</span></p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1.5">
                      <Button size="sm" variant={r.safe ? "primary" : "secondary"} icon={r.safe ? undefined : <Wand2 size={12} />} onClick={() => doRec(r)}>{r.kind === "refresh" ? "Make fresh versions" : r.kind === "more" ? "Make more like it" : "Apply"}</Button>
                      <Button size="sm" variant="ghost" onClick={() => dismissRec(r.id)} aria-label={`Dismiss: ${r.title}`}><X size={13} /></Button>
                    </div>
                  </div>
                );
              })}
            </Card>
          )}

          <Tabs value={tab} onChange={(t) => setParams(t === "changes" ? { tab: "changes" } : {}, { replace: true })} tabs={[{ id: "campaigns", label: "Performance, 7 days" }, { id: "changes", label: "Changes", count: st.log.length }]} />

          {tab === "campaigns" ? (
            <div className="mt-4">
              <div className="sticky top-12 z-10 -mx-1 mb-3 flex flex-wrap items-center gap-2 bg-bg px-1 py-1.5 lg:top-0">
                {picked.length ? (
                  <>
                    <span className="text-[13px] font-medium">{picked.length} selected</span>
                    <Button size="sm" variant="ghost" onClick={() => setSel([])}>Clear</Button>
                    <span className="flex-1" />
                    <Button size="sm" icon={<Pause size={12} />} onClick={() => { setRowStatus(picked.map((r) => r.id), "paused"); setSel([]); toast(`Paused ${picked.length}`); }}>Pause</Button>
                    <Button size="sm" icon={<Play size={12} />} onClick={() => { setRowStatus(picked.map((r) => r.id), "active"); setSel([]); toast(`Turned on ${picked.length}`); }}>Turn on</Button>
                    {level === "ad" && <Button size="sm" icon={<Bookmark size={12} />} onClick={() => { picked.forEach((r) => saveRowToSwipe(r)); toast("Saved to the ad swipe file"); }}>Save to swipe file</Button>}
                    {level === "ad" && studioOn && <Button size="sm" variant="primary" icon={<Wand2 size={12} />} onClick={() => fresh(picked.map((r) => r.id))}>Make variations</Button>}
                  </>
                ) : (
                  <>
                    <Segmented label="Level" value={level} onChange={(v) => { setLevel(v); setSel([]); setOnly(null); }} options={levels} />
                    <Segmented label="Platform" value={platform} onChange={setPlatform} options={[{ id: "all", label: "All" }, ...live.map((p) => ({ id: p, label: adPlatforms[p].name.replace(" Ads", "") }))]} />
                    <div className="flex flex-wrap gap-1">
                      {verdictOrder.filter((v) => counts[v]).map((v) => (
                        <button key={v} onClick={() => setOnly(only === v ? null : v)} aria-pressed={only === v} className={cn("inline-flex h-7 items-center gap-1.5 rounded-full border px-2.5 text-[12.5px]", only === v ? "border-ink bg-ink text-on-ink" : "border-line text-muted hover:bg-hover")}>
                          {verdicts[v].label}<span className="num opacity-70">{counts[v]}</span>
                        </button>
                      ))}
                    </div>
                    <span className="flex-1" />
                    <label className="relative">
                      <Search size={13} className="absolute top-1/2 left-2.5 -translate-y-1/2 text-subtle" />
                      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Find" aria-label="Find in table" className="h-8 w-44 rounded-lg border border-line bg-surface pr-2 pl-7 text-[13px] outline-none focus:border-line-strong" />
                    </label>
                  </>
                )}
              </div>
              <Card pad={false} className="overflow-x-auto">
                <table className="w-full min-w-[1040px] text-[13.5px]">
                  <thead className="border-b border-line text-left text-[12.5px] text-muted">
                    <tr>
                      <th className="w-10 py-2.5 pl-4"><Checkbox label="Select all" checked={shown.length > 0 && shown.every((r) => sel.includes(r.id))} onChange={(v) => setSel(v ? shown.map((r) => r.id) : [])} /></th>
                      {th("name", level === "ad" ? "Ad" : level === "adset" ? "Ad set" : "Campaign", false)}
                      <th className="px-3 py-2.5 font-normal">On</th>
                      {th("verdict", "Verdict", false)}
                      {th("budget", "Budget / day")}
                      {th("spend", "Spend")}
                      {th("results", resultKinds[g.result].many.replace(/^\w/, (c) => c.toUpperCase()))}
                      {th("cpa", `Cost / ${resultWord(g, 1)}`)}
                      {th("ctr", "Click rate")}
                      {level === "ad" && th("frequency", "Seen ×")}
                      <th className="px-3 py-2.5 font-normal">Click rate trend</th>
                    </tr>
                  </thead>
                  <tbody>
                    {shown.map((r) => {
                      const m = metricsOf(rows, r.id);
                      const v = verdictOf(rows, r, g);
                      const camp = rows.find((x) => x.id === r.campaignId)!;
                      return (
                        <tr key={r.id} className={cn("border-b border-line last:border-0 hover:bg-hover/50", sel.includes(r.id) && "bg-active/40", r.status === "paused" && "text-muted")}>
                          <td className="py-2.5 pl-4"><Checkbox label={`Select ${r.name}`} checked={sel.includes(r.id)} onChange={(c) => setSel(c ? [...sel, r.id] : sel.filter((x) => x !== r.id))} /></td>
                          <td className="max-w-[380px] px-3 py-2.5">
                            <div className="flex items-center gap-3">
                              {r.copy ? <CreativeThumb angle={r.copy.angle} format={r.copy.format} style={styleFor(r.copy.angle, r.copy.format)} headline={r.copy.headline} w={40} /> : <AdPlatformMark platform={r.platform} size={22} />}
                              <div className="min-w-0">
                                <div className="flex items-center gap-1.5 truncate font-medium">{r.copy && <AdPlatformMark platform={r.platform} size={14} />}<span className="truncate">{r.name}</span>{r.fromStudio && <Badge tone="accent">Studio</Badge>}</div>
                                <div className="truncate text-[12px] text-muted">{parentName(r) || `${adPlatforms[r.platform].name} · ${r.startedDaysAgo} days`}</div>
                              </div>
                            </div>
                          </td>
                          <td className="px-3 py-2.5"><Toggle label={`${r.name} on`} checked={r.status === "active"} onChange={(on) => setRowStatus([r.id], on ? "active" : "paused")} /></td>
                          <td className="px-3 py-2.5 whitespace-nowrap"><VerdictBadge v={v} /></td>
                          <td className="num px-3 py-2.5 text-right">
                            {r.level === "campaign" ? <BudgetInput value={r.budget ?? 0} onCommit={(b) => { setBudget(r.id, b); toast("Budget changed"); }} /> : <span className="text-subtle" title={`Set on ${camp.name}`}>{money(camp.budget ?? 0)}</span>}
                          </td>
                          <td className="num px-3 py-2.5 text-right">{money(m.spend)}</td>
                          <td className="num px-3 py-2.5 text-right">{m.results}</td>
                          <td className={cn("num px-3 py-2.5 text-right font-medium", m.results && m.cpa <= g.target ? "text-good" : m.results && m.cpa > g.target * 1.1 ? "text-bad" : "")}>{m.results ? money(m.cpa) : m.spend ? "—" : ""}</td>
                          <td className="num px-3 py-2.5 text-right">{m.ctr ? `${m.ctr.toFixed(1)}%` : "—"}</td>
                          {level === "ad" && <td className={cn("num px-3 py-2.5 text-right", (r.frequency ?? 0) >= 3.5 && "text-warn")}>{r.frequency?.toFixed(1) ?? "—"}</td>}
                          <td className="px-3 py-2.5"><Sparkline data={r.level === "ad" ? r.ctrTrend : rows.filter((x) => x.level === "ad" && (x.parentId === r.id || x.campaignId === r.id))[0]?.ctrTrend ?? []} tone={r.level === "ad" && v === "tired" ? "bad" : "muted"} /></td>
                        </tr>
                      );
                    })}
                    {!shown.length && <tr><td colSpan={11} className="px-5 py-10 text-center text-muted">Nothing matches. <button className="text-fg underline" onClick={() => { setOnly(null); setQ(""); setPlatform("all"); }}>Clear filters</button></td></tr>}
                  </tbody>
                </table>
              </Card>
            </div>
          ) : (
            <Card pad={false} className="mt-4">
              {st.log.map((c) => (
                <div key={c.id} className="flex flex-col gap-2 border-b border-line px-5 py-3.5 last:border-0 md:flex-row md:items-start md:gap-5">
                  <div className="w-28 shrink-0 text-[12.5px] text-muted">{timeAgo(c.at)}<div><Badge tone={c.by === "marko" ? "accent" : "neutral"}>{c.by === "marko" ? assistant() : "You"}</Badge></div></div>
                  <div className={cn("min-w-0 flex-1", c.undone && "line-through opacity-60")}>
                    <div className="text-[14px]">{c.title}</div>
                    <div className="mt-0.5 text-[13px] text-muted">{c.outcome ?? "Measuring. The next review says what changed."}</div>
                  </div>
                  {c.before && !c.undone && <Button size="sm" variant="ghost" icon={<Undo2 size={12} />} onClick={() => { undoChange(c.id); toast("Undone"); }}>Undo</Button>}
                </div>
              ))}
            </Card>
          )}
        </>
      )}

      <ConnectToolModal tool={connect ? toolOf(connect) : null} onClose={() => setConnect(null)} />
      <GoalDrawer open={goalOpen} onClose={() => setGoalOpen(false)} goal={g} />
      {node}
    </>
  );
}

function BudgetInput({ value, onCommit }: { value: number; onCommit: (v: number) => void }) {
  const commit = (el: HTMLInputElement) => { const n = Math.max(1, Math.round(+el.value || value)); el.value = String(n); if (n !== value) onCommit(n); };
  return (
    <span className="inline-flex items-center rounded-md border border-transparent px-1 hover:border-line focus-within:border-line-strong">
      $<input key={value} defaultValue={value} onBlur={(e) => commit(e.currentTarget)} onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()} aria-label="Daily budget" className="num w-10 bg-transparent text-right outline-none" />
    </span>
  );
}

function GoalDrawer({ open, onClose, goal }: { open: boolean; onClose: () => void; goal: Goal }) {
  const [g, setG] = useState(goal);
  const [was, setWas] = useState(open);
  if (open !== was) { setWas(open); if (open) setG(goal); }
  const field = "h-9 w-full rounded-lg border border-line bg-surface px-3 text-[13.5px] outline-none focus:border-line-strong";
  const label = "mb-1.5 block text-[12.5px] font-medium text-muted";
  return (
    <Drawer open={open} onClose={onClose} title="Goal & guardrails" width={520} footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button variant="primary" onClick={() => { setGoal(g); onClose(); }}>Save</Button></>}>
      <div className="space-y-6">
        <section className="space-y-3">
          <h3 className="text-[14px] font-medium">What counts as a result</h3>
          <select value={g.result} onChange={(e) => setG({ ...g, result: e.target.value as ResultKind })} className={field}>
            {(Object.keys(resultKinds) as ResultKind[]).map((k) => <option key={k} value={k}>{resultKinds[k].label}</option>)}
          </select>
          <p className="m-0 text-[12.5px] text-muted">Bookings come from your booking system, calls from CallRail. Connect them under <Link to="/settings/ads" className="underline">Ad accounts</Link> so {assistant()} optimizes for patients, not clicks.</p>
          <div className="grid grid-cols-2 gap-3">
            <label><span className={label}>Target cost per {resultKinds[g.result].one}</span><input type="number" value={g.target} onChange={(e) => setG({ ...g, target: +e.target.value })} className={cn(field, "num")} /></label>
            <label><span className={label}>Never spend more than, a month</span><input type="number" value={g.monthly} onChange={(e) => setG({ ...g, monthly: +e.target.value })} className={cn(field, "num")} /></label>
          </div>
        </section>
        <section className="space-y-3">
          <h3 className="text-[14px] font-medium">How often {assistant()} reviews</h3>
          <Segmented label="Review cadence" value={g.cadence} onChange={(c: Cadence) => setG({ ...g, cadence: c })} options={(Object.keys(cadences) as Cadence[]).map((c) => ({ id: c, label: cadences[c].label }))} />
          <p className="m-0 text-[12.5px] text-muted">Daily suits budgets over $50 a day. Smaller accounts get clearer answers checking less often.</p>
        </section>
        <section className="space-y-3">
          <h3 className="text-[14px] font-medium">What {assistant()} may do</h3>
          <Segmented label="Mode" value={g.mode} onChange={(m) => setG({ ...g, mode: m })} options={[{ id: "recommend", label: "Recommend, I approve" }, { id: "auto", label: "Auto within guardrails" }]} />
          <div className="grid grid-cols-2 gap-3">
            <label><span className={label}>Biggest budget change at once</span><div className="relative"><input type="number" value={g.step} onChange={(e) => setG({ ...g, step: +e.target.value })} className={cn(field, "num pr-8")} /><span className="absolute top-1/2 right-3 -translate-y-1/2 text-muted">%</span></div></label>
            <label><span className={label}>Judge an ad after spending</span><select value={g.minSpend} onChange={(e) => setG({ ...g, minSpend: +e.target.value })} className={field}>{[1.5, 2, 3, 4].map((x) => <option key={x} value={x}>{x}× target ({money(x * g.target)})</option>)}</select></label>
          </div>
          <label className="flex items-start justify-between gap-4 rounded-lg border border-line p-3">
            <span><span className="block text-[13.5px]">Launch new ads without asking</span><span className="text-[12.5px] text-muted">Fresh versions of tired ads go live on their own. Off means they wait in Creative studio.</span></span>
            <Toggle label="Launch new ads without asking" checked={g.launch} onChange={(v) => setG({ ...g, launch: v })} />
          </label>
          <p className="m-0 text-[12.5px] text-muted">Auto mode pauses, scales, cuts and blocks search terms; it never goes over the monthly cap, and every change can be undone from Changes. The same switches are in <Link to="/settings/autopilot" className="underline underline-offset-2">Settings → Autopilot</Link>, and the review cadence in <Link to="/settings/schedules" className="underline underline-offset-2">Schedules</Link>.</p>
        </section>
      </div>
    </Drawer>
  );
}
