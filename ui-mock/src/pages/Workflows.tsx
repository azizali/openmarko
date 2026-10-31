import { Fragment, useState } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router";
import { ArrowDown, ArrowLeft, ArrowUp, ChevronRight, Hourglass, Mail, MessageSquareText, Phone, Plus, Tag, Trash2, Zap, Flag as FlagIcon, CircleStop, TagsIcon, Play, Link2, X } from "lucide-react";
import { Badge, Button, Card, Checkbox, Input, Modal, PageHeader, Select, Stat, Textarea, Toggle, cn, fmt, useToast } from "../components/ui";
import { FieldPicker, FlagList } from "../components/Crm";
import { segments, sources, stages, tagOptions, type SegmentId, type Source, type Stage } from "../data/contacts";
import { condMeta, dateFields, eventGroups, eventMeta, exitMeta, recipes, stepMeta, type Workflow, type Cond, type CondField, type DateField, type EventId, type Exit, type Step, type StepKind, type Wait, type When } from "../data/messaging";
import { isOn } from "../lib/features";
import { addWorkflow, addStep, deleteWorkflow, describeWhen, messageChecks, moveStep, removeStep, smsParts, withExamples, updateWorkflow, updateStep, useCrm } from "../lib/crm";

const stepIcon: Record<StepKind, typeof Mail> = { sms: MessageSquareText, email: Mail, call: Phone, wait: Hourglass, stage: FlagIcon, tag: Tag, untag: TagsIcon, start: Play };
const waitText = (w: Wait) => `${w.n} ${w.n === 1 ? w.unit.replace(/s$/, "") : w.unit}${w.before ? " before the appointment" : ""}`;
const short = (w: Wait) => `${w.n}${w.unit[0]}${w.before ? " before" : ""}`;
const pct = (a: number, b: number) => (b ? `${Math.round((a / b) * 100)}%` : "0%");

/**
 * Workflows: sequences that run for each person when something happens.
 * Texts and emails send on their own; call steps make a task in the Inbox.
 * Everyone stops when they reply, book or opt out (per workflow).
 */
export default function Workflows() {
  const { id } = useParams();
  return id ? <Editor id={id} /> : <List />;
}

function List() {
  const st = useCrm();
  const navigate = useNavigate();
  const { toast, node } = useToast();
  const [picking, setPicking] = useState(false);
  const make = (r: string | null) => { setPicking(false); navigate(`/workflows/${addWorkflow(r)}`); };
  return (
    <>
      <PageHeader
        title="Workflows"
        sub={<>Texts, emails and call tasks that go out on their own when something happens. Each person stops when they reply, book or opt out. For a one-time send to a list, use <Link to="/campaigns" className="underline underline-offset-2">Campaigns</Link>.</>}
        actions={<Button variant="primary" icon={<Plus size={14} />} onClick={() => setPicking(true)}>New workflow</Button>}
      />
      <Card pad={false}>
        <div className="hidden grid-cols-[44px_minmax(0,1fr)_200px_80px_80px_80px_20px] gap-3 border-b border-line px-5 py-2.5 text-[12.5px] text-muted md:grid">
          <span>On</span><span>Workflow</span><span>Steps</span><span className="text-right">In it now</span><span className="text-right">Started, 30d</span><span className="text-right">Booked, 30d</span><span />
        </div>
        {st.workflows.map((a) => (
          <div key={a.id} className="grid grid-cols-[44px_minmax(0,1fr)_20px] items-center gap-3 border-b border-line px-5 py-3 last:border-0 hover:bg-hover md:grid-cols-[44px_minmax(0,1fr)_200px_80px_80px_80px_20px]">
            <Toggle label={`${a.name} on`} checked={a.on} onChange={(v) => { updateWorkflow(a.id, { on: v }); toast(v ? `${a.name} is on` : `${a.name} is off. People already in it finish their current step`); }} />
            <Link to={`/workflows/${a.id}`} className="min-w-0">
              <div className={cn("truncate text-[14px] font-medium", !a.on && "text-muted")}>{a.name}</div>
              <div className="truncate text-[12.5px] text-muted">When {describeWhen(st, a.when).replace(/^./, (c) => c.toLowerCase())}{a.only.length ? ` · only if ${a.only.length} condition${a.only.length > 1 ? "s" : ""}` : ""}</div>
              <div className="mt-1 flex gap-3 text-[12px] text-muted md:hidden"><Strip steps={a.steps} /><span>{a.stats.inNow} in it · {a.stats.booked30} booked</span></div>
            </Link>
            <Link to={`/workflows/${a.id}`} className="hidden md:block"><Strip steps={a.steps} /></Link>
            <span className="num hidden text-right md:block">{fmt(a.stats.inNow)}</span>
            <span className="num hidden text-right text-muted md:block">{fmt(a.stats.started30)}</span>
            <span className="num hidden text-right font-medium md:block">{a.stats.booked30 || <span className="font-normal text-subtle">—</span>}</span>
            <Link to={`/workflows/${a.id}`} aria-label={`Open ${a.name}`}><ChevronRight size={15} className="text-subtle" /></Link>
          </div>
        ))}
        {!st.workflows.length && <p className="px-5 py-12 text-center text-[13px] text-muted">No workflows yet.</p>}
      </Card>
      <p className="mt-3 text-[12.5px] text-subtle">Booked counts people who booked while in the workflow. Reminders and review requests don't aim for bookings, so they show —.</p>

      <Modal open={picking} onClose={() => setPicking(false)} title="New workflow" width={620}>
        <ul className="space-y-2">
          {recipes.map((r) => {
            const used = st.workflows.some((a) => a.recipe === r.id);
            return (
              <li key={r.id}>
                <button onClick={() => make(r.id)} className="flex w-full items-start gap-3 rounded-xl border border-line p-3.5 text-left hover:border-line-strong hover:bg-hover">
                  <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-accent-soft text-accent"><Zap size={15} /></span>
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-2 text-[14px] font-medium">{r.name}{used && <Badge>You have one</Badge>}</span>
                    <span className="block text-[12.5px] text-muted">{r.blurb}</span>
                    <span className="mt-1.5 block"><Strip steps={r.steps()} /></span>
                  </span>
                </button>
              </li>
            );
          })}
          <li><button onClick={() => make(null)} className="w-full rounded-xl border border-dashed border-line-strong p-3 text-center text-[13px] text-muted hover:bg-hover hover:text-fg">Start from scratch</button></li>
        </ul>
      </Modal>
      {node}
    </>
  );
}

/** The sequence at a glance: icons for each send, with the waits between. */
function Strip({ steps }: { steps: Step[] }) {
  return (
    <span className="inline-flex flex-wrap items-center gap-1 text-[11.5px] text-subtle">
      {steps.map((s, i) => {
        if (s.kind === "wait") return <span key={s.id}>{short(s.wait!)}</span>;
        const I = stepIcon[s.kind];
        return <Fragment key={s.id}>{i > 0 && steps[i - 1].kind !== "wait" && <span>·</span>}<span title={stepMeta[s.kind].label} className="grid size-5 place-items-center rounded bg-hover text-fg"><I size={11} /></span></Fragment>;
      })}
      {!steps.length && "No steps yet"}
    </span>
  );
}


function Editor({ id }: { id: string }) {
  const st = useCrm();
  const navigate = useNavigate();
  const { toast, node } = useToast();
  const a = st.workflows.find((x) => x.id === id);
  if (!a) return <Navigate replace to="/workflows" />;
  const up = (p: Partial<Workflow>) => updateWorkflow(a.id, p);
  const sends = a.steps.filter((s) => s.kind === "sms" || s.kind === "email");
  const problems = sends.flatMap((s) => messageChecks(s.kind as "sms" | "email", s.subject ?? "", s.body ?? "", st.channels.sms.optOutLine).filter((f) => f.level !== "info").map((f) => ({ ...f, text: `${s.kind === "sms" ? "Text" : "Email"} ${sends.indexOf(s) + 1}: ${f.text}` })));
  const canOn = a.steps.length > 0 && !problems.some((p) => p.level === "block");

  return (
    <>
      <PageHeader
        crumbs={<Link to="/workflows" className="inline-flex items-center gap-1 hover:text-fg"><ArrowLeft size={13} /> Workflows</Link>}
        title={<input value={a.name} onChange={(e) => up({ name: e.target.value })} aria-label="Workflow name" className="w-[min(560px,80vw)] bg-transparent outline-none" />}
        sub={a.on ? "On. Changes apply to the next step each person reaches." : "Off. Nobody new starts it."}
        actions={<>
          <span className="flex items-center gap-2 text-[13px]"><Toggle label="On" checked={a.on} onChange={(v) => { if (v && !canOn) return toast("Fix the red items first"); up({ on: v }); toast(v ? "It's on" : "It's off"); }} />{a.on ? "On" : "Off"}</span>
          <Button variant="ghost" icon={<Trash2 size={14} />} onClick={() => { deleteWorkflow(a.id); navigate("/workflows"); }}>Delete</Button>
        </>}
      />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
        <ol className="min-w-0">
          <li><WhenCard a={a} /></li>
          <AddHere at={0} a={a} />
          {a.steps.map((s, i) => (
            <Fragment key={s.id}>
              <li><StepCard a={a} s={s} i={i} optOut={st.channels.sms.optOutLine} /></li>
              <AddHere at={i + 1} a={a} />
            </Fragment>
          ))}
          <li>
            <Card className="flex flex-wrap items-center gap-x-4 gap-y-2">
              <span className="grid size-8 place-items-center rounded-lg bg-hover text-muted"><CircleStop size={15} /></span>
              <span className="text-[13px] font-medium">Stop early when</span>
              {(Object.keys(exitMeta) as Exit[]).map((x) => <label key={x} className="flex items-center gap-2 text-[13px]"><Checkbox checked={a.exits.includes(x)} onChange={(v) => up({ exits: v ? [...a.exits, x] : a.exits.filter((y) => y !== x) })} />{exitMeta[x]}</label>)}
            </Card>
          </li>
        </ol>

        <aside className="space-y-4 self-start lg:sticky lg:top-4">
          <Card className="grid grid-cols-3 gap-3 lg:grid-cols-1">
            <Stat label="In it now" value={fmt(a.stats.inNow)} />
            <Stat label="Started, 30 days" value={fmt(a.stats.started30)} />
            <Stat label="Booked, 30 days" value={a.stats.booked30 || "—"} delta={a.stats.booked30 ? <span className="text-[12.5px] text-muted">{pct(a.stats.booked30, a.stats.started30)}</span> : undefined} />
          </Card>
          <Card>
            <div className="mb-2 text-[13px] font-medium">Checks</div>
            {problems.length ? <FlagList flags={problems} /> : <p className="text-[12.5px] text-good">Every message passes.</p>}
            <ul className="mt-3 space-y-1 border-t border-line pt-3 text-[12px] text-muted">
              <li>Texts wait for 8am–9pm in their time zone.</li>
              <li>People without consent for a channel skip that step.</li>
              <li>Someone already in it isn't started again.</li>
            </ul>
          </Card>
          <Linked a={a} />
          <Button className="w-full" onClick={() => toast("Running it on you: the first step goes to your phone and email now, with waits shortened to a minute")}>Test it on yourself</Button>
        </aside>
      </div>
      {node}
    </>
  );
}

function AddHere({ at, a }: { at: number; a: Workflow }) {
  const [open, setOpen] = useState(false);
  return (
    <li className="relative flex h-9 items-center justify-center">
      <span className="absolute inset-y-0 left-1/2 w-px bg-line-strong" aria-hidden />
      <button onClick={() => setOpen(!open)} aria-expanded={open} aria-label="Add a step here" className="relative grid size-6 place-items-center rounded-full border border-line-strong bg-bg text-muted hover:bg-hover hover:text-fg"><Plus size={12} /></button>
      {open && (
        <>
          <div className="fixed inset-0 z-20" onClick={() => setOpen(false)} />
          <div className="anim-fade absolute top-full z-30 mt-1 w-60 rounded-lg border border-line bg-surface p-1 shadow-float">
            {(Object.keys(stepMeta) as StepKind[]).filter((k) => (k !== "sms" && k !== "email") || isOn(k)).map((k) => {
              const I = stepIcon[k];
              return (
                <button key={k} onClick={() => { addStep(a.id, at, k); setOpen(false); }} className="flex w-full items-start gap-2.5 rounded px-2 py-1.5 text-left hover:bg-hover">
                  <I size={14} className="mt-0.5 shrink-0 text-muted" /><span><span className="block text-[13px]">{stepMeta[k].label}</span>{stepMeta[k].hint && <span className="block text-[11.5px] text-subtle">{stepMeta[k].hint}</span>}</span>
                </button>
              );
            })}
          </div>
        </>
      )}
    </li>
  );
}

function StepCard({ a, s, i, optOut }: { a: Workflow; s: Step; i: number; optOut: string }) {
  const all = useCrm().workflows;
  const I = stepIcon[s.kind];
  const set = (p: Partial<Step>) => updateStep(a.id, s.id, p);
  const tools = (
    <span className="ml-auto flex items-center">
      <button onClick={() => moveStep(a.id, s.id, -1)} disabled={i === 0} aria-label="Move up" className="rounded p-1 text-subtle hover:bg-hover hover:text-fg disabled:opacity-30"><ArrowUp size={13} /></button>
      <button onClick={() => moveStep(a.id, s.id, 1)} disabled={i === a.steps.length - 1} aria-label="Move down" className="rounded p-1 text-subtle hover:bg-hover hover:text-fg disabled:opacity-30"><ArrowDown size={13} /></button>
      <button onClick={() => removeStep(a.id, s.id)} aria-label="Remove step" className="rounded p-1 text-subtle hover:bg-hover hover:text-bad"><Trash2 size={13} /></button>
    </span>
  );

  if (s.kind === "wait") return (
    <div className="mx-auto flex max-w-md flex-wrap items-center gap-2 rounded-full border border-line bg-surface px-3 py-1.5 text-[13px] shadow-card">
      <Hourglass size={13} className="text-muted" />Wait
      <Input size="xs" type="number" min={1} value={s.wait!.n} onChange={(e) => set({ wait: { ...s.wait!, n: Math.max(1, +e.target.value) } })} aria-label="How long" className="w-14" />
      <Select size="xs" className="w-auto" value={s.wait!.unit} onChange={(e) => set({ wait: { ...s.wait!, unit: e.target.value as Wait["unit"] } })} aria-label="Unit"><option value="minutes">minutes</option><option value="hours">hours</option><option value="days">days</option></Select>
      {a.when.event === "appt_booked" && <label className="flex items-center gap-1.5"><Checkbox checked={!!s.wait!.before} onChange={(v) => set({ wait: { ...s.wait!, before: v } })} />before the appointment</label>}
      {tools}
      <span className="sr-only">{waitText(s.wait!)}</span>
    </div>
  );

  const msg = s.kind === "sms" || s.kind === "email";
  const chOff = msg && !isOn(s.kind as "sms" | "email");
  const flags = msg ? messageChecks(s.kind as "sms" | "email", s.subject ?? "", s.body ?? "", optOut).filter((f) => f.level !== "info") : [];
  const parts = s.kind === "sms" && s.body ? smsParts(`${withExamples(s.body)} ${optOut}`) : null;
  return (
    <Card className={cn("space-y-3", chOff && "opacity-60")}>
      {chOff && <p className="rounded-md bg-warn-soft px-3 py-2 text-[12.5px] text-warn">Skipped while {s.kind === "sms" ? "Texting" : "Email"} is turned off in Settings → Features. People move on to the next step.</p>}
      <div className="flex flex-wrap items-center gap-2">
        <span className={cn("grid size-8 place-items-center rounded-lg", s.kind === "call" ? "bg-warn-soft text-warn" : "bg-hover text-fg")}><I size={15} /></span>
        <span className="text-[13.5px] font-medium">{stepMeta[s.kind].label}</span>
        {(msg || s.kind === "call") && i > 0 && (
          <Select size="xs" className="w-auto text-muted" value={s.onlyIf ?? ""} onChange={(e) => set({ onlyIf: (e.target.value || undefined) as Step["onlyIf"] })} aria-label="Only if">
            <option value="">Everyone still in it</option><option value="no_reply">Only if they haven't replied</option><option value="not_booked">Only if they haven't booked</option>
          </Select>
        )}
        {tools}
      </div>
      {s.kind === "email" && <Input value={s.subject ?? ""} onChange={(e) => set({ subject: e.target.value })} placeholder="Subject" aria-label="Subject" />}
      {(msg || s.kind === "call") && (
        <>
          {s.kind === "call" && <p className="text-[12.5px] text-muted">The front desk gets a task in Inbox → Calls to make, with this script. Nothing is dialed automatically.</p>}
          <Textarea value={s.body ?? ""} onChange={(e) => set({ body: e.target.value })} rows={s.kind === "email" ? 5 : 3} aria-label={s.kind === "call" ? "Call script" : "Message"} placeholder={s.kind === "call" ? "What to say when they pick up" : "Write the message"} />
          <div className="flex flex-wrap items-center gap-2">
            {msg && <FieldPicker onPick={(t) => set({ body: `${s.body ?? ""}${t}` })} />}
            {parts && <span className={cn("text-[12px]", parts.parts > 1 ? "text-warn" : "text-subtle")}>{parts.len} chars · {parts.parts} segment{parts.parts > 1 ? "s" : ""}</span>}
            {s.stats && <span className="ml-auto text-[12px] text-muted">{s.kind === "call" ? `${fmt(s.stats.done)} calls` : `Sent ${fmt(s.stats.done)}`}{s.kind !== "call" && s.stats.replied ? ` · ${pct(s.stats.replied, s.stats.done)} replied` : ""}{s.stats.booked ? ` · ${s.stats.booked} booked` : ""}</span>}
          </div>
          <FlagList flags={flags} />
        </>
      )}
      {s.kind === "stage" && <Select value={s.stage} onChange={(e) => set({ stage: e.target.value as Stage })} aria-label="Stage" className="w-auto">{stages.map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}</Select>}
      {s.kind === "start" && <Select value={s.workflow ?? ""} onChange={(e) => set({ workflow: e.target.value })} aria-label="Workflow" className="w-auto">{all.filter((x) => x.id !== a.id).map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</Select>}
      {(s.kind === "tag" || s.kind === "untag") && <Select value={s.tag} onChange={(e) => set({ tag: e.target.value })} aria-label="Tag" className="w-auto">{[...new Set([...(s.tag ? [s.tag] : []), ...tagOptions])].map((t) => <option key={t}>{t}</option>)}</Select>}
    </Card>
  );
}



/** When something happens, and only if the contact matches. */
function WhenCard({ a }: { a: Workflow }) {
  const st = useCrm();
  const w = a.when;
  const set = (p: Partial<When>) => updateWorkflow(a.id, { when: { ...w, ...p } });
  const pick = (event: EventId) => {
    const needs = eventMeta[event].needs;
    updateWorkflow(a.id, { when: { event, ...(needs === "tag" ? { tag: w.tag ?? "Invisalign" } : needs === "stage" ? { stage: w.stage ?? "booked" } : needs === "list" ? { list: w.list ?? "recall" } : needs === "date" ? { date: w.date ?? { field: "last_visit", days: 180, dir: "after" } } : needs === "workflow" ? { workflow: st.workflows.find((x) => x.id !== a.id)?.id, ended: "any" } : needs === "campaign" ? { campaign: "any" } : {}) } });
  };
  const needs = eventMeta[w.event].needs;
  const only = a.only;
  const setOnly = (next: Cond[]) => updateWorkflow(a.id, { only: next });
  return (
    <Card className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="grid size-8 place-items-center rounded-lg bg-accent-soft text-accent"><Zap size={15} /></span>
        <span className="w-14 text-[13px] font-medium">When</span>
        <Select value={w.event} onChange={(e) => pick(e.target.value as EventId)} aria-label="When" className="min-w-0 flex-1">
          {eventGroups.map((g) => <optgroup key={g.label} label={g.label}>{g.events.map((e) => <option key={e} value={e}>{eventMeta[e].label}</option>)}</optgroup>)}
        </Select>
      </div>
      {needs && (
        <div className="flex flex-wrap items-center gap-2 sm:pl-[104px]">
          {needs === "tag" && <Select value={w.tag} onChange={(e) => set({ tag: e.target.value })} aria-label="Tag" className="w-auto">{[...new Set([...(w.tag ? [w.tag] : []), ...tagOptions])].map((t) => <option key={t}>{t}</option>)}</Select>}
          {needs === "stage" && <Select value={w.stage} onChange={(e) => set({ stage: e.target.value as Stage })} aria-label="Stage" className="w-auto">{stages.map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}</Select>}
          {needs === "list" && <Select value={w.list} onChange={(e) => set({ list: e.target.value as SegmentId })} aria-label="List" className="w-auto">{segments.filter((g) => g.id !== "all").map((g) => <option key={g.id} value={g.id}>{g.label}</option>)}</Select>}
          {needs === "keyword" && <Input value={w.keyword ?? ""} onChange={(e) => set({ keyword: e.target.value || undefined })} placeholder="Any reply, or a word like YES" aria-label="Reply contains" className="w-60" />}
          {needs === "date" && w.date && <>
            <Input type="number" min={0} value={w.date.days} onChange={(e) => set({ date: { ...w.date!, days: Math.max(0, +e.target.value) } })} aria-label="Days" className="w-20" />
            <span className="text-[13px]">days</span>
            <Select value={w.date.dir} onChange={(e) => set({ date: { ...w.date!, dir: e.target.value as "before" | "after" } })} aria-label="Before or after" className="w-auto"><option value="after">after</option><option value="before">before</option></Select>
            <span className="text-[13px]">their</span>
            <Select value={w.date.field} onChange={(e) => set({ date: { ...w.date!, field: e.target.value as DateField } })} aria-label="Date" className="w-auto">{(Object.keys(dateFields) as DateField[]).map((f) => <option key={f} value={f}>{dateFields[f]}</option>)}</Select>
          </>}
          {needs === "workflow" && <>
            <Select value={w.workflow} onChange={(e) => set({ workflow: e.target.value })} aria-label="Workflow" className="w-auto">{st.workflows.filter((x) => x.id !== a.id).map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</Select>
            <Select value={w.ended ?? "any"} onChange={(e) => set({ ended: e.target.value as When["ended"] })} aria-label="How it ended" className="w-auto"><option value="any">ends either way</option><option value="finished">gets through every step</option><option value="stopped">stops early (replied, booked…)</option></Select>
          </>}
          {needs === "campaign" && <Select value={w.campaign} onChange={(e) => set({ campaign: e.target.value })} aria-label="Campaign" className="w-auto"><option value="any">Any campaign</option>{st.campaigns.map((c) => <option key={c.id} value={c.id}>{c.name || "Untitled"}</option>)}</Select>}
        </div>
      )}
      {eventMeta[w.event].hint && <p className="text-[12.5px] text-muted sm:pl-[104px]">{eventMeta[w.event].hint}</p>}

      <div className="space-y-2 border-t border-line pt-3">
        {only.map((k, i) => <CondRow key={i} k={k} first={i === 0} onChange={(nk) => setOnly(only.map((x, j) => (j === i ? nk : x)))} onRemove={() => setOnly(only.filter((_, j) => j !== i))} />)}
        <div className="flex flex-wrap items-center gap-2">
          <span className="w-24 shrink-0 text-[13px] font-medium sm:pl-10">{only.length ? "" : "Only if"}</span>
          <Button size="sm" variant="ghost" icon={<Plus size={12} />} onClick={() => setOnly([...only, { field: "tag", op: "is_not", values: [] }])}>{only.length ? "And…" : "Add a condition"}</Button>
          {!only.length && <span className="text-[12.5px] text-subtle">Everyone it happens to starts</span>}
        </div>
      </div>
    </Card>
  );
}

const condOptions = (f: CondField): { id: string; label: string }[] => {
  const o = condMeta[f].options;
  return o === "tags" ? tagOptions.map((t) => ({ id: t, label: t }))
    : o === "stages" ? stages.map((x) => ({ id: x.id, label: x.label }))
    : o === "sources" ? (Object.keys(sources) as Source[]).map((x) => ({ id: x, label: sources[x].label }))
    : o === "locations" ? ["South Congress", "Mueller"].map((x) => ({ id: x, label: x })) : [];
};

function CondRow({ k, first, onChange, onRemove }: { k: Cond; first: boolean; onChange: (k: Cond) => void; onRemove: () => void }) {
  const opts = condOptions(k.field);
  const m = condMeta[k.field];
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="w-24 shrink-0 text-[13px] font-medium sm:pl-10">{first ? "Only if" : "and"}</span>
      <Select value={k.field} onChange={(e) => onChange({ field: e.target.value as CondField, op: "is", values: [] })} aria-label="Field" className="w-auto">{(Object.keys(condMeta) as CondField[]).map((f) => <option key={f} value={f}>{condMeta[f].label}</option>)}</Select>
      <Select value={k.op} onChange={(e) => onChange({ ...k, op: e.target.value as Cond["op"] })} aria-label="Is or is not" className="w-auto"><option value="is">{m.isLabel[0]}</option><option value="is_not">{m.isLabel[1]}</option></Select>
      <button onClick={onRemove} aria-label="Remove condition" className="rounded p-1 text-subtle hover:bg-hover hover:text-bad"><X size={13} /></button>
      {opts.length > 0 && (
        <span className="flex min-w-0 basis-full flex-wrap gap-1 sm:pl-[104px]">
          {opts.map((o) => {
            const on = k.values.includes(o.id);
            return <button key={o.id} onClick={() => onChange({ ...k, values: on ? k.values.filter((v) => v !== o.id) : [...k.values, o.id] })} aria-pressed={on} className={cn("h-7 rounded-full border px-2.5 text-[12px]", on ? "border-ink bg-ink text-on-ink" : "border-line text-muted hover:text-fg")}>{o.label}</button>;
          })}
        </span>
      )}
    </div>
  );
}

/** Workflows that hand people to this one, and the ones it hands on to. */
function Linked({ a }: { a: Workflow }) {
  const st = useCrm();
  const hands = (from: Workflow, to: Workflow) =>
    (to.when.event === "workflow_finished" && to.when.workflow === from.id) ||
    from.steps.some((s) => (s.kind === "start" && s.workflow === to.id) || (s.kind === "tag" && to.when.event === "tag_added" && to.when.tag === s.tag) || (s.kind === "untag" && to.when.event === "tag_removed" && to.when.tag === s.tag));
  const before = st.workflows.filter((b) => b.id !== a.id && hands(b, a));
  const after = st.workflows.filter((b) => b.id !== a.id && hands(a, b));
  if (!after.length && !before.length) return null;
  const row = (b: Workflow) => <li key={b.id}><Link to={`/workflows/${b.id}`} className="flex items-center gap-1.5 text-[13px] hover:underline"><Link2 size={12} className="text-muted" />{b.name}{!b.on && <Badge>Off</Badge>}</Link></li>;
  return (
    <Card className="space-y-3">
      {before.length > 0 && <div><div className="mb-1 text-[12.5px] text-muted">Starts after</div><ul className="space-y-1">{before.map(row)}</ul></div>}
      {after.length > 0 && <div><div className="mb-1 text-[12.5px] text-muted">Hands people on to</div><ul className="space-y-1">{after.map(row)}</ul></div>}
    </Card>
  );
}
