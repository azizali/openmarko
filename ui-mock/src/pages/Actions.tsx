import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { Wand2, Check, Loader2, Settings2, CircleDot, PlayCircle, CheckCircle2, Hand, Undo2 } from "lucide-react";
import { Badge, Button, Card, Drawer, PageHeader, Segmented, Toggle, cn, useToast } from "../components/ui";
import { actions as seed, type Action, type ActionStatus } from "../data/mock";

const cols: { id: ActionStatus; label: string; icon: typeof CircleDot }[] = [
  { id: "suggested", label: "Suggested", icon: CircleDot },
  { id: "approved", label: "Approved", icon: Hand },
  { id: "running", label: "Running", icon: PlayCircle },
  { id: "done", label: "Done", icon: CheckCircle2 },
];

export default function Actions() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [items, setItems] = useState<Action[]>(seed);
  const [view, setView] = useState<"board" | "list">("board");
  const [autopilot, setAutopilot] = useState(false);
  const { toast, node } = useToast();
  const open = items.find((a) => a.id === id) ?? null;

  const setStatus = (aid: string, status: ActionStatus) => setItems((xs) => xs.map((x) => (x.id === aid ? { ...x, status } : x)));

  const ActionCard = ({ a }: { a: Action }) => (
    <button onClick={() => navigate(`/actions/${a.id}`)} className="w-full rounded-lg border border-line bg-surface p-3.5 text-left transition-colors hover:border-line-strong">
      <div className="text-[13.5px] leading-snug font-medium">{a.title}</div>
      <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
        <Badge tone={a.impact === "High" ? "accent" : "neutral"}>{a.impact} impact</Badge>
        <Badge>{a.category}</Badge>
        {a.effort === "Auto" && <Badge tone="info"><Wand2 size={11} /> Auto</Badge>}
      </div>
      {a.status === "running" && <div className="mt-3 h-1 overflow-hidden rounded-full bg-hover"><div className="h-full w-2/3 animate-pulse rounded-full bg-info" /></div>}
    </button>
  );

  return (
    <>
      <PageHeader
        title="Action plan"
        sub="Improvements ranked by impact. Groundwork can apply most of them for you once you approve them."
        actions={<>
          <Segmented label="View" value={view} onChange={setView} options={[{ id: "board", label: "Board" }, { id: "list", label: "List" }]} />
        </>}
      />

      <Card className="mb-6 flex flex-wrap items-center gap-4">
        <span className="grid size-9 place-items-center rounded-lg bg-accent-soft text-accent"><Settings2 size={17} /></span>
        <div className="min-w-0 flex-1">
          <div className="text-[14px] font-medium">Autopilot</div>
          <div className="text-[13px] text-muted">Apply low-risk changes automatically (posts, alt text, schema). Changes to categories, descriptions and review replies always need your approval.</div>
        </div>
        <Toggle label="Autopilot" checked={autopilot} onChange={(v) => { setAutopilot(v); toast(v ? "Autopilot on · low-risk fixes will run nightly" : "Autopilot off"); }} />
      </Card>

      {view === "board" ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {cols.map((c) => {
            const list = items.filter((a) => a.status === c.id);
            return (
              <div key={c.id} className="min-w-0">
                <div className="mb-2.5 flex items-center gap-2 px-1 text-[13px] text-muted">
                  <c.icon size={14} /> {c.label} <span className="num text-subtle">{list.length}</span>
                </div>
                <div className="space-y-2">{list.map((a) => <ActionCard key={a.id} a={a} />)}</div>
              </div>
            );
          })}
        </div>
      ) : (
        <Card pad={false}>
          {items.map((a) => (
            <button key={a.id} onClick={() => navigate(`/actions/${a.id}`)} className="flex w-full items-center gap-4 border-b border-line px-5 py-3 text-left last:border-0 hover:bg-hover">
              <Badge tone={a.impact === "High" ? "accent" : "neutral"} className="w-16 justify-center">{a.impact}</Badge>
              <span className="min-w-0 flex-1 truncate text-[13.5px] font-medium">{a.title}</span>
              <span className="hidden text-[12.5px] text-muted sm:block">{a.executor}</span>
              <Badge tone={a.status === "done" ? "good" : a.status === "running" ? "info" : "neutral"} className="capitalize">{a.status}</Badge>
            </button>
          ))}
        </Card>
      )}

      <ActionDrawer
        action={open}
        onClose={() => navigate("/actions")}
        onApprove={(a) => { setStatus(a.id, "approved"); toast("Approved"); }}
        onRun={(a) => setStatus(a.id, "running")}
        onDone={(a) => setStatus(a.id, "done")}
        onDismiss={(a) => { setItems((xs) => xs.filter((x) => x.id !== a.id)); navigate("/actions"); toast("Dismissed. We won't suggest this again"); }}
      />
      {node}
    </>
  );
}

function ActionDrawer({ action: a, onClose, onApprove, onRun, onDone, onDismiss }: { action: Action | null; onClose: () => void; onApprove: (a: Action) => void; onRun: (a: Action) => void; onDone: (a: Action) => void; onDismiss: (a: Action) => void }) {
  const [step, setStep] = useState(-1);
  const [draft, setDraft] = useState("");
  useEffect(() => { setStep(a?.status === "done" ? 99 : -1); setDraft(a?.preview?.after ?? ""); }, [a?.id]);
  useEffect(() => {
    if (!a || step < 0 || step >= a.steps.length) return;
    const t = setTimeout(() => setStep((s) => s + 1), 750);
    return () => clearTimeout(t);
  }, [step, a]);
  useEffect(() => { if (a && step === a.steps.length) onDone(a); }, [step]);
  if (!a) return null;

  const executing = step >= 0 && step < a.steps.length;
  const finished = a.status === "done" || step >= a.steps.length;
  const manual = a.executor === "Manual";

  return (
    <Drawer
      open
      onClose={onClose}
      width={560}
      title={<span className="flex items-center gap-2"><Badge>{a.category}</Badge><span className="truncate">{a.title}</span></span>}
      footer={
        finished ? (
          <><Button variant="ghost" icon={<Undo2 size={14} />}>Revert</Button><Button onClick={onClose}>Close</Button></>
        ) : executing ? (
          <Button disabled><Loader2 size={14} className="animate-spin" /> Applying…</Button>
        ) : a.status === "suggested" ? (
          <><Button variant="ghost" onClick={() => onDismiss(a)}>Dismiss</Button><Button onClick={() => onApprove(a)}>Approve for later</Button>{!manual && <Button variant="primary" icon={<Wand2 size={14} />} onClick={() => { onRun(a); setStep(0); }}>Approve & apply</Button>}</>
        ) : (
          !manual && <Button variant="primary" icon={<Wand2 size={14} />} onClick={() => { onRun(a); setStep(0); }}>Apply now</Button>
        )
      }
    >
      <div className="space-y-6">
        <div className="grid grid-cols-3 gap-3 text-[12.5px]">
          <div><div className="text-muted">Impact</div><div className="mt-0.5 font-medium">{a.impact}</div></div>
          <div><div className="text-muted">Effort</div><div className="mt-0.5 font-medium">{a.effort === "Auto" ? "Automatic" : a.effort}</div></div>
          <div><div className="text-muted">Applied via</div><div className="mt-0.5 font-medium">{a.executor}</div></div>
        </div>

        <section>
          <h4 className="mb-1.5 text-[13px] font-medium">Why</h4>
          <p className="text-[14px] leading-relaxed text-muted">{a.rationale}</p>
          <ul className="mt-3 space-y-1.5">
            {a.evidence.map((e) => <li key={e} className="flex gap-2 text-[13px]"><span className="text-subtle">—</span>{e}</li>)}
          </ul>
        </section>

        {a.preview && (
          <section>
            <h4 className="mb-2 text-[13px] font-medium">{a.preview.label}</h4>
            {a.preview.before && (
              <div className="mb-2 rounded-lg border border-line bg-bad-soft/40 p-3 text-[13px] text-muted line-through decoration-bad/40">{a.preview.before}</div>
            )}
            <textarea
              aria-label="Proposed change"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              disabled={executing || finished}
              rows={Math.max(3, Math.ceil(draft.length / 60))}
              className="w-full resize-none rounded-lg border border-good/30 bg-good-soft/40 p-3 text-[13.5px] leading-relaxed outline-none focus:border-good disabled:opacity-80"
            />
            <div className="mt-1 flex justify-between text-[12px] text-subtle"><span>You can edit before applying.</span><span className="num">{draft.length} chars</span></div>
          </section>
        )}

        <section>
          <h4 className="mb-2.5 text-[13px] font-medium">{manual ? "How to do it" : "What happens"}</h4>
          <ol className="space-y-2.5">
            {a.steps.map((s, i) => {
              const state = finished || i < step ? "done" : i === step ? "run" : "todo";
              return (
                <li key={s} className={cn("flex items-center gap-3 text-[13.5px]", state === "todo" && step >= 0 && "opacity-40")}>
                  <span className="grid size-5 shrink-0 place-items-center rounded-full border border-line text-[11px] text-muted">
                    {state === "done" ? <Check size={12} className="text-good" /> : state === "run" ? <Loader2 size={12} className="animate-spin" /> : i + 1}
                  </span>
                  {s}
                </li>
              );
            })}
          </ol>
        </section>

        {finished && (
          <div className="anim-fade rounded-lg bg-good-soft p-4 text-[13.5px] text-good">
            <div className="font-medium">Applied</div>
            <div className="mt-0.5 opacity-90">We'll re-scan the affected keywords in 7 days and report the impact here.</div>
          </div>
        )}
      </div>
    </Drawer>
  );
}
