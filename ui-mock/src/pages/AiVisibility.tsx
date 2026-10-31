import { Fragment, useMemo, useState } from "react";
import { Link } from "react-router";
import { Sparkles, Plus, Check, X, ChevronRight, ExternalLink, ArrowUp, ArrowDown, Link2 } from "lucide-react";
import { Badge, Button, Card, CardHeader, Input, LineChart, PageHeader, Progress, cn, useToast } from "../components/ui";
import { business, keywords } from "../data/mock";
import { aiVisibility, engines, type AiPrompt } from "../data/ai";
import { aiPromptsFor } from "../data/scoped";
import { ExternalUrl, LocationOverview, ScopeBar } from "../components/Scope";
import { useScopedLocation } from "../lib/scope";

// AI assistants answer "best dentist near …", so this is measured per Location.
export default function AiVisibility() {
  const { location } = useScopedLocation();
  if (location) return <AiBody key={location.id} seed={aiPromptsFor(location.id)} />;
  return (
    <>
      <PageHeader title="AI visibility" sub="How often AI assistants recommend each location when people ask for a dentist nearby." />
      <ScopeBar kind="location" />
      <LocationOverview columns={["Named in answers", "Change", "Questions tracked"]} row={(id) => {
        const v = aiVisibility(aiPromptsFor(id));
        return [`${Math.round(v.pct)}%`, `${v.pct >= v.prevPct ? "+" : ""}${Math.round(v.pct - v.prevPct)} pts`, aiPromptsFor(id).length];
      }} />
    </>
  );
}

function AiBody({ seed }: { seed: AiPrompt[] }) {
  const [prompts, setPrompts] = useState<AiPrompt[]>(seed);
  const [open, setOpen] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const { toast, node } = useToast();
  const v = useMemo(() => aiVisibility(prompts), [prompts]);
  const delta = v.pct - v.prevPct;
  const gaps = v.sources.filter((s) => !s.you && s.n > 0).slice(0, 4);

  const add = () => {
    const text = draft.trim();
    if (!text) return;
    setPrompts((ps) => [...ps, { id: `ai_new_${ps.length}`, text, keywordId: keywords[0].id, answers: engines.map((e) => ({ engine: e.id, listed: [], position: null, sources: [], excerpt: "Queued. The first answers arrive with the next check." })), history: Array(8).fill(0) }]);
    setDraft("");
    toast("Question added · checked across 6 AI engines on the next run");
  };

  return (
    <>
      <PageHeader
        title="AI visibility"
        sub="When people ask ChatGPT, Gemini, Perplexity, Claude or Google's AI for a local business, are you recommended? We ask the questions your customers ask, every week, on every engine."
      />
      <ScopeBar kind="location" />

      <div className="mb-6 grid gap-3 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,2fr)]">
        <Card className="flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-1.5 text-[12.5px] font-medium text-muted"><Sparkles size={14} className="text-accent" /> Mentioned in AI answers</div>
            <div className="mt-2 flex items-end gap-3">
              <span className="num font-serif text-[52px] leading-none tracking-tight">{v.pct.toFixed(0)}<span className="text-[28px] text-muted">%</span></span>
              <span className={cn("num mb-1.5 inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[12px] font-medium", delta >= 0 ? "bg-good-soft text-good" : "bg-bad-soft text-bad")}>
                {delta >= 0 ? <ArrowUp size={11} strokeWidth={2.5} /> : <ArrowDown size={11} strokeWidth={2.5} />}{Math.abs(delta).toFixed(0)} pts vs 4 wks
              </span>
            </div>
            <p className="mt-2 text-[13px] text-muted">{v.hits} of {v.total} answers ({prompts.length} questions × {engines.length} engines) name {business.name}.{v.avgPos && <> When you're named, you're usually <b className="num font-medium text-fg">#{v.avgPos.toFixed(1)}</b> in the list.</>}</p>
          </div>
          <div className="mt-4"><LineChart height={150} labels={["8w", "7w", "6w", "5w", "4w", "3w", "2w", "Now"]} yMax={Math.ceil(Math.max(...v.weekly) / 10) * 10 + 10} format={(n) => `${n}%`} series={[{ name: "Mentioned", color: "var(--accent)", values: v.weekly.map((x) => Math.round(x)) }]} area /></div>
        </Card>
        <Card>
          <CardHeader title="By engine" sub="Share of your tracked questions where each one names you" />
          <ul className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
            {v.byEngine.map((e) => {
              const pct = (e.mentioned / e.total) * 100;
              return (
                <li key={e.id}>
                  <div className="mb-1 flex items-baseline justify-between gap-2 text-[13px]">
                    <span className="font-medium">{e.name}</span>
                    <span className="num text-muted">{e.mentioned}/{e.total} · <b className={cn("font-medium", pct >= 50 ? "text-good" : pct >= 25 ? "text-warn" : "text-bad")}>{pct.toFixed(0)}%</b></span>
                  </div>
                  <Progress value={pct} tone={pct >= 50 ? "good" : pct >= 25 ? "warn" : "bad"} />
                </li>
              );
            })}
          </ul>
        </Card>
      </div>

      <div className="mb-6 grid gap-3 lg:grid-cols-2">
        <Card>
          <CardHeader title="Who AI recommends instead" sub="Share of all answers that name each business" />
          <ul className="space-y-2.5">
            {v.shareOfVoice.slice(0, 7).map((x) => (
              <li key={x.name}>
                <div className="mb-1 flex justify-between gap-2 text-[13px]"><span className={cn("truncate", x.name === business.name && "font-medium text-accent")}>{x.name}{x.name === business.name && " (you)"}</span><span className="num text-muted">{x.pct.toFixed(0)}%</span></div>
                <div className="h-1.5 overflow-hidden rounded-full bg-hover"><div className={cn("h-full rounded-full", x.name === business.name ? "bg-accent" : "bg-ink")} style={{ width: `${x.pct}%` }} /></div>
              </li>
            ))}
          </ul>
        </Card>
        <Card>
          <CardHeader title="Sites AI answers cite" sub="AI engines repeat what these sites say. Being listed (correctly) on them is how you get named." right={<Link to="/citations" className="text-[13px] text-muted hover:text-fg">Citations →</Link>} />
          <ul className="divide-y divide-line">
            {v.sources.filter((s) => s.n > 0).slice(0, 7).map((s) => (
              <li key={s.domain} className="flex items-center gap-3 py-2 text-[13px]">
                <span className="min-w-0 flex-1 truncate">{s.label} <span className="text-subtle">· <ExternalUrl domain={s.domain} /></span></span>
                <span className="num w-20 text-right text-muted">{s.pct.toFixed(0)}% of answers</span>
                {s.you ? <Badge tone="good"><Check size={11} /> Listed</Badge> : <Badge tone="bad"><X size={11} /> Not listed</Badge>}
              </li>
            ))}
          </ul>
          {gaps.length > 0 && <p className="mt-3 rounded-md bg-warn-soft px-3 py-2 text-[12.5px] text-warn">Biggest gap: AI answers cite {gaps.map((g) => g.label).join(", ")}, and you're not there. <Link to="/citations" className="font-medium underline">Get listed</Link></p>}
        </Card>
      </div>

      <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="font-serif text-[22px] leading-tight">Questions we track</h2>
          <p className="mt-0.5 text-[13px] text-muted">Phrased the way customers ask. Open one to read every engine's answer.</p>
        </div>
        <form onSubmit={(e) => { e.preventDefault(); add(); }} className="flex gap-2">
          <Input size="sm" value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Add a question, e.g. best dentist for anxious patients" aria-label="New question" className="w-72 max-w-full" />
          <Button size="sm" type="submit" icon={<Plus size={12} />} disabled={!draft.trim()}>Track</Button>
        </form>
      </div>

      <Card pad={false} className="overflow-x-auto">
        <table className="w-full min-w-[880px] text-[13.5px]">
          <thead className="border-b border-line text-left text-[12.5px] text-muted">
            <tr>
              <th className="px-5 py-2.5 font-normal">Question</th>
              {engines.map((e) => <th key={e.id} className="px-2 py-2.5 text-center font-normal">{e.name}</th>)}
              <th className="px-3 py-2.5 pr-5 text-right font-normal">Named in</th>
            </tr>
          </thead>
          <tbody>
            {prompts.map((p) => {
              const on = open === p.id;
              const hits = p.answers.filter((a) => a.position !== null).length;
              return (
                <Fragment key={p.id}>
                  <tr onClick={() => setOpen(on ? null : p.id)} aria-expanded={on} className={cn("cursor-pointer border-b border-line last:border-0", on ? "bg-accent-soft/40" : "hover:bg-hover")}>
                    <td className="px-5 py-3"><span className="inline-flex items-center gap-1.5 font-medium"><ChevronRight size={13} className={cn("shrink-0 text-subtle transition-transform", on && "rotate-90")} />“{p.text}”</span></td>
                    {p.answers.map((a) => (
                      <td key={a.engine} className="px-2 py-3 text-center">
                        {a.position !== null
                          ? <span className="num inline-grid min-w-8 place-items-center rounded-full bg-good-soft px-1.5 py-0.5 text-[12px] font-medium text-good" title={`Named #${a.position}`}>#{a.position}</span>
                          : <span className="inline-grid size-6 place-items-center rounded-full bg-hover text-subtle" title="Not named"><X size={12} /></span>}
                      </td>
                    ))}
                    <td className="num px-3 py-3 pr-5 text-right"><span className={cn("font-medium", hits >= 4 ? "text-good" : hits >= 2 ? "text-warn" : "text-bad")}>{hits}</span><span className="text-subtle">/{engines.length}</span></td>
                  </tr>
                  {on && (
                    <tr className="border-b border-line bg-bg">
                      <td colSpan={engines.length + 2} className="px-5 py-4">
                        <div className="anim-fade grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                          {p.answers.map((a) => {
                            const e = engines.find((x) => x.id === a.engine)!;
                            return (
                              <div key={a.engine} className={cn("rounded-lg border bg-surface p-3", a.position !== null ? "border-good/30" : "border-line")}>
                                <div className="mb-1.5 flex items-center justify-between gap-2 text-[13px] font-medium">{e.name}{a.position !== null ? <Badge tone="good">Named #{a.position}</Badge> : <Badge tone="bad">Not named</Badge>}</div>
                                <p className="text-[12.5px] leading-relaxed text-muted italic">{a.excerpt}</p>
                                {a.listed.length > 0 && <ol className="mt-2 space-y-0.5 text-[12.5px]">{a.listed.map((n, i) => <li key={n} className={cn(n === business.name && "font-medium text-accent")}><span className="num text-subtle">{i + 1}.</span> {n}</li>)}</ol>}
                                {a.sources.length > 0 && <div className="mt-2 flex flex-wrap gap-1">{a.sources.map((s) => <span key={s} className="inline-flex items-center gap-0.5 rounded bg-hover px-1.5 py-0.5 text-[11px] text-muted"><ExternalLink size={9} />{s}</span>)}</div>}
                              </div>
                            );
                          })}
                        </div>
                        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[12.5px] text-muted">
                          <Link to={`/rankings?kw=${p.keywordId}`} className="hover:text-fg">Map rank for “{keywords.find((k) => k.id === p.keywordId)?.term}” →</Link>
                          <Link to="/citations" className="inline-flex items-center gap-1 hover:text-fg"><Link2 size={12} /> Get listed where AI looks →</Link>
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </Card>
      <p className="mt-3 max-w-3xl text-[12px] text-subtle">AI answers change from one ask to the next, so each question is asked several times per engine and we count how often you're named.</p>
      {node}
    </>
  );
}
