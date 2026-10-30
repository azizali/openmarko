import { useEffect, useState, type ReactNode } from "react";
import { Link } from "react-router";
import { Wand2, Wrench, MessageSquare, PenLine, Check, Loader2, Undo2, ArrowRight, Hand } from "lucide-react";
import { Badge, Button, Card, Checkbox, Drawer, cn, rankTone } from "./ui";
import { keywords, type Keyword } from "../data/mock";
import { dismissTask, openTasksFor, runTasks, tasks, undoTask, useRunState, type Kind, type Task } from "../lib/tasks";

export const kindMeta: Record<Kind, { label: string; icon: typeof Wand2 }> = {
  action: { label: "Improve", icon: Wand2 },
  fix: { label: "Site fix", icon: Wrench },
  review: { label: "Review", icon: MessageSquare },
  content: { label: "Content", icon: PenLine },
};

export function TaskButton({ t, primary, onOpen }: { t: Task; primary?: boolean; onOpen: (t: Task) => void }) {
  const st = useRunState()[t.id];
  if (st === "done" || st === "dismissed") return <button onClick={() => undoTask(t.id)} className="inline-flex items-center gap-1 rounded px-2 py-1 text-[12.5px] text-muted hover:bg-hover"><Undo2 size={12} /> {st === "done" ? "Undo" : "Restore"}</button>;
  if (st === "running") return <Button size="sm" disabled><Loader2 size={13} className="animate-spin" /></Button>;
  return <Button size="sm" variant={primary ? "primary" : "secondary"} onClick={() => (t.auto ? runTasks([t.id]) : onOpen(t))}>{t.cta}</Button>;
}

/** The home page's action list: the three most useful things to do this week. */
export function ThisWeek({ onOpen, heading }: { onOpen: (t: Task) => void; heading?: ReactNode }) {
  const state = useRunState();
  const open = openTasksFor(state);
  const done = tasks.filter((t) => state[t.id] === "done").length;
  return (
    <section>
      <div className="mb-3 flex items-end justify-between gap-3">
        {heading ?? <h2 className="font-serif text-[22px] leading-tight">This week</h2>}
        <Link to="/todo" className="inline-flex items-center gap-1 text-[13px] text-muted hover:text-fg">
          {open.length > 3 ? `See all ${open.length}` : "See all"}{done ? ` · ${done} done` : ""} <ArrowRight size={13} />
        </Link>
      </div>
      <Card pad={false}>
        {open.slice(0, 3).map((t, i) => (
          <div key={t.id} className="flex items-center gap-4 border-b border-line px-5 py-4 last:border-0">
            <span className="num grid size-6 shrink-0 place-items-center rounded-full bg-hover text-[12px] font-medium text-muted">{i + 1}</span>
            <button onClick={() => onOpen(t)} className="min-w-0 flex-1 text-left">
              <div className="text-[14px] leading-snug font-medium">{t.title}</div>
              <div className="mt-0.5 line-clamp-1 text-[12.5px] text-muted">{t.why}</div>
            </button>
            <div className="shrink-0"><TaskButton t={t} primary={i === 0} onOpen={onOpen} /></div>
          </div>
        ))}
        {!open.length && <div className="px-5 py-10 text-center text-[13.5px] text-muted">You're all caught up. We'll add new things here as they come up.</div>}
      </Card>
    </section>
  );
}

export type TodoStatus = "open" | "done" | "dismissed";

export function TodoList({ focus, status = "open", onOpen }: { focus: Keyword | null; status?: TodoStatus; onOpen: (t: Task) => void }) {
  const state = useRunState();
  const [kind, setKind] = useState<Kind | "all">("all");
  const [sel, setSel] = useState<Set<string>>(new Set());

  const inStatus = (t: Task) => (status === "open" ? state[t.id] !== "done" && state[t.id] !== "dismissed" : state[t.id] === status);
  const inScope = (t: Task) => (!focus || t.keywordIds.includes(focus.id)) && inStatus(t);
  const scoped = tasks.filter((t) => inScope(t) && (kind === "all" || t.kind === kind));
  const bulkable = scoped.filter((t) => t.auto && !state[t.id]);
  const selected = [...sel].filter((id) => !state[id]);
  const count = (k: Kind | "all") => tasks.filter((t) => inScope(t) && (k === "all" || t.kind === k)).length;

  return (
    <>
      <div className="mb-3 flex flex-wrap items-center gap-1.5">
        {(["all", "action", "fix", "review", "content"] as const).map((k) => (
          <button key={k} onClick={() => setKind(k)} className={cn("inline-flex h-7 items-center gap-1.5 rounded-full border px-2.5 text-[12.5px] transition-colors", kind === k ? "border-ink bg-ink text-on-ink" : "border-line text-muted hover:bg-hover")}>
            {k === "all" ? "All" : kindMeta[k].label} <span className="num opacity-70">{count(k)}</span>
          </button>
        ))}
      </div>
      <Card pad={false}>
        {status === "open" && (
          <div className="flex items-center gap-3 border-b border-line px-4 py-2 text-[12.5px] text-muted">
            <Checkbox label="Select all" checked={bulkable.length > 0 && selected.length === bulkable.length} onChange={(v) => setSel(v ? new Set(bulkable.map((t) => t.id)) : new Set())} />
            <span>{selected.length ? `${selected.length} selected` : "Select several to apply at once"}</span>
            <Button size="sm" variant="primary" className="ml-auto" disabled={!selected.length} icon={<Wand2 size={12} />} onClick={() => { runTasks(selected); setSel(new Set()); }}>Apply selected</Button>
          </div>
        )}
        {scoped.map((t, i) => {
          const st = state[t.id];
          const M = kindMeta[t.kind];
          return (
            <div key={t.id} className={cn("flex items-start gap-3 border-b border-line px-4 py-3.5 last:border-0", st === "done" && "bg-good-soft/30")}>
              <span className="pt-0.5">
                {status === "open" && t.auto ? (
                  <Checkbox label={`Select ${t.title}`} checked={sel.has(t.id)} onChange={() => { const n = new Set(sel); n.has(t.id) ? n.delete(t.id) : n.add(t.id); setSel(n); }} />
                ) : st === "done" ? (
                  <span className="grid size-4 place-items-center rounded-full bg-good text-white"><Check size={10} strokeWidth={3} /></span>
                ) : (
                  <span className="grid size-4 place-items-center text-subtle" title="Needs you to do it"><Hand size={13} /></span>
                )}
              </span>
              <button onClick={() => onOpen(t)} className="min-w-0 flex-1 text-left">
                <div className={cn("text-[14px] leading-snug font-medium", st === "done" && "text-muted line-through decoration-1")}>{t.title}</div>
                <div className="mt-0.5 line-clamp-1 text-[12.5px] text-muted">{t.why}</div>
                <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                  <Badge><M.icon size={11} /> {M.label}</Badge>
                  <Badge tone={t.impact === "High" ? "accent" : "neutral"}>{t.impact} impact</Badge>
                  {t.auto ? <Badge tone="info"><Wand2 size={11} /> One click</Badge> : <Badge>{t.effort} effort</Badge>}
                  {t.keywordIds.slice(0, 2).map((k) => <span key={k} className="text-[11.5px] text-subtle">#{keywords.find((x) => x.id === k)?.term}</span>)}
                </div>
              </button>
              <div className="shrink-0 pt-0.5"><TaskButton t={t} primary={i === 0 && status === "open"} onOpen={onOpen} /></div>
            </div>
          );
        })}
        {!scoped.length && <div className="px-4 py-10 text-center text-[13px] text-muted">{status === "open" ? "Nothing to do here right now." : status === "done" ? "Nothing finished yet." : "Nothing dismissed."}</div>}
      </Card>
    </>
  );
}

export function TaskDrawer({ task: t, onClose }: { task: Task | null; onClose: () => void }) {
  const status = useRunState()[t?.id ?? ""];
  const [draft, setDraft] = useState("");
  useEffect(() => { setDraft(t?.preview?.after ?? ""); }, [t?.id]);
  if (!t) return null;
  const M = kindMeta[t.kind];
  return (
    <Drawer
      open
      onClose={onClose}
      width={560}
      title={<span className="flex items-center gap-2"><Badge><M.icon size={11} /> {M.label}</Badge><span className="truncate">{t.title}</span></span>}
      footer={status === "done" || status === "dismissed" ? <>
        <Button variant="ghost" icon={<Undo2 size={14} />} onClick={() => undoTask(t.id)}>{status === "done" ? "Revert" : "Restore"}</Button>
        <Button onClick={onClose}>Close</Button>
      </> : <>
        {t.href && <Link to={t.href} className="mr-auto text-[13px] text-muted hover:text-fg">Open full view →</Link>}
        <Button variant="ghost" disabled={status === "running"} onClick={() => { dismissTask(t.id); onClose(); }}>Dismiss</Button>
        <Button variant="primary" disabled={status === "running"} icon={status === "running" ? <Loader2 size={14} className="animate-spin" /> : t.auto ? <Wand2 size={14} /> : <Check size={14} />} onClick={() => runTasks([t.id])}>{t.auto ? t.cta : "Mark as done"}</Button>
      </>}
    >
      <div className="space-y-6">
        <div className="grid grid-cols-3 gap-3 rounded-lg bg-hover/60 p-3 text-[12.5px]">
          <div><div className="text-muted">Impact</div><div className="mt-0.5 font-medium">{t.impact}</div></div>
          <div><div className="text-muted">Effort</div><div className="mt-0.5 font-medium">{t.effort}</div></div>
          <div><div className="text-muted">Applied via</div><div className="mt-0.5 font-medium">{t.via}</div></div>
        </div>
        <section>
          <h4 className="mb-1.5 text-[13px] font-medium">Why this matters</h4>
          <p className="text-[14px] leading-relaxed text-muted">{t.why}</p>
          {t.evidence && <ul className="mt-3 space-y-1.5">{t.evidence.map((e) => <li key={e} className="flex gap-2 text-[13px]"><span className="text-subtle">—</span>{e}</li>)}</ul>}
        </section>
        {t.keywordIds.length > 0 && (
          <section>
            <h4 className="mb-2 text-[13px] font-medium">Helps these keywords</h4>
            <div className="flex flex-wrap gap-1.5">
              {t.keywordIds.map((id) => { const k = keywords.find((x) => x.id === id)!; return <Badge key={id} tone={rankTone(k.local ?? k.organic)}>{k.term} · #{k.local ?? k.organic}</Badge>; })}
            </div>
          </section>
        )}
        {t.preview && (
          <section>
            <h4 className="mb-2 text-[13px] font-medium">{t.preview.label}</h4>
            {t.preview.before && <div className="mb-2 rounded-lg border border-line bg-bad-soft/40 p-3 font-mono text-[12.5px] text-muted line-through decoration-bad/40">{t.preview.before}</div>}
            <textarea aria-label="Proposed change" value={draft} onChange={(e) => setDraft(e.target.value)} disabled={!!status} rows={Math.min(14, Math.max(3, draft.split("\n").length, Math.ceil(draft.length / 60)))} className="w-full resize-none rounded-lg border border-good/30 bg-good-soft/40 p-3 text-[13.5px] leading-relaxed outline-none focus:border-good" />
            <div className="mt-1 flex justify-between text-[12px] text-subtle"><span>You can edit this before applying.</span><span className="num">{draft.length} chars</span></div>
          </section>
        )}
        <section>
          <h4 className="mb-2.5 text-[13px] font-medium">{t.auto ? "What happens" : "How to do it"}</h4>
          <ol className="space-y-2">
            {t.steps.map((s, i) => (
              <li key={s} className="flex items-center gap-3 text-[13.5px]">
                <span className="grid size-5 shrink-0 place-items-center rounded-full border border-line text-[11px] text-muted">{status === "done" ? <Check size={12} className="text-good" /> : status === "running" ? <Loader2 size={11} className="animate-spin" /> : i + 1}</span>{s}
              </li>
            ))}
          </ol>
        </section>
        {status === "done" && <div className="anim-fade rounded-lg bg-good-soft p-4 text-[13.5px] text-good">Done. We'll re-scan the affected keywords and report the effect on rankings over the next 14 days.</div>}
      </div>
    </Drawer>
  );
}
