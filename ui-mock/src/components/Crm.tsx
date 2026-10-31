import { useEffect, useRef, useState } from "react";
import { Link } from "react-router";
import {
  AlertTriangle, Ban, CalendarCheck, CalendarDays, Check, Info, Mail, MessageSquareText, NotebookPen, Phone, PhoneIncoming, PhoneMissed, PhoneOutgoing, Plus, Send, Sparkles, Star, Workflow as WorkflowIcon, X,
} from "lucide-react";
import { Badge, Button, Drawer, Field, Input, Modal, Segmented, Select, Textarea, Toggle, cn, fmt } from "./ui";
import { mergeFields, sources, stageOf, stages, tagOptions, type Channel, type Contact, type Event, type Source, type Stage } from "../data/contacts";
import {
  addContact, addNote, addTag, blockedOn, contactOf, eventsOf, logCall, markRead, notReady, removeTag, sendMessage, setConsent, setStage, smsParts, startedText, suggestReply, useCrm, type Flag, type NewContact, type Started,
} from "../lib/crm";
import { timeAgo } from "../lib/runs";
import { isOn } from "../lib/features";
import { assistant } from "../lib/whitelabel";

export const channelIcon: Record<Channel, typeof Mail> = { email: Mail, sms: MessageSquareText, call: Phone };
export function ChannelIcon({ ch, size = 13, className }: { ch: Channel; size?: number; className?: string }) {
  const I = channelIcon[ch];
  return <I size={size} className={className} aria-label={ch === "sms" ? "Text" : ch === "email" ? "Email" : "Call"} />;
}

export function StageBadge({ stage }: { stage: Stage }) {
  const s = stageOf(stage);
  return <Badge tone={s.tone} className="whitespace-nowrap">{s.label}</Badge>;
}

/** Which channels we may use, at a glance. Struck through when they can't get it. */
export function Reach({ c }: { c: Contact }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      {(["sms", "email", "call"] as Channel[]).map((ch) => {
        const why = blockedOn(c, ch);
        return <span key={ch} title={why ?? `Can ${ch === "sms" ? "text" : ch}`} className={cn("grid size-5 place-items-center rounded", why ? "text-subtle opacity-40" : "bg-hover text-fg")}><ChannelIcon ch={ch} size={11} /></span>;
      })}
    </span>
  );
}

export function FlagList({ flags }: { flags: Flag[] }) {
  if (!flags.length) return null;
  return (
    <ul className="space-y-1.5">
      {flags.map((f, i) => (
        <li key={i} className={cn("flex items-start gap-2 text-[12.5px]", f.level === "block" ? "text-bad" : f.level === "warn" ? "text-warn" : "text-muted")}>
          {f.level === "info" ? <Info size={13} className="mt-0.5 shrink-0" /> : <AlertTriangle size={13} className="mt-0.5 shrink-0" />}<span>{f.text}</span>
        </li>
      ))}
    </ul>
  );
}

/** Buttons that drop a {{field}} into the message at the cursor. */
export function FieldPicker({ onPick }: { onPick: (token: string) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <Button size="sm" variant="ghost" icon={<Plus size={12} />} onClick={() => setOpen(!open)} aria-expanded={open}>Insert field</Button>
      {open && (
        <div className="anim-fade absolute bottom-full left-0 z-30 mb-1 w-64 rounded-lg border border-line bg-surface p-1 shadow-float">
          {mergeFields.map((f) => (
            <button key={f.key} onClick={() => { onPick(`{{${f.key}}}`); setOpen(false); }} className="flex w-full items-baseline justify-between gap-3 rounded px-2 py-1.5 text-left text-[12.5px] hover:bg-hover">
              <span>{f.label}</span><span className="truncate text-subtle">{f.example}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
export const insertAt = (el: HTMLTextAreaElement | null, value: string, token: string) => {
  const at = el?.selectionStart ?? value.length;
  return value.slice(0, at) + token + value.slice(el?.selectionEnd ?? at);
};

// ---------- Timeline ----------

const callIcon = (e: Event) => (e.call?.result === "missed" ? PhoneMissed : e.dir === "in" ? PhoneIncoming : PhoneOutgoing);
const markIcon: Partial<Record<Event["kind"], typeof Mail>> = { note: NotebookPen, stage: Check, form: Sparkles, booking: CalendarCheck, visit: Star };

/** Every touch with this person, oldest first: messages as bubbles, everything else as a line. */
export function Timeline({ c, events, follow }: { c: Contact; events: Event[]; follow?: boolean }) {
  const end = useRef<HTMLLIElement>(null);
  // Inside a scrolling thread, keep the newest message in view.
  useEffect(() => { if (follow) end.current?.scrollIntoView({ block: "nearest" }); }, [events.length, follow]);
  if (!events.length) return <p className="px-1 py-6 text-center text-[13px] text-muted">Nothing yet.</p>;
  return (
    <ol className="space-y-2.5">
      {events.map((e) => {
        if (e.kind === "sms" || e.kind === "email") {
          const them = e.dir === "in";
          return (
            <li key={e.id} className={cn("flex", them ? "justify-start" : "justify-end")}>
              <div className={cn("max-w-[85%] rounded-xl border px-3.5 py-2.5", them ? "border-accent/30 bg-accent-soft/40" : "border-line bg-bg")}>
                <div className="mb-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11.5px] text-subtle">
                  <ChannelIcon ch={e.kind} size={11} /><span className="font-medium text-muted">{them ? c.name.split(" ")[0] : e.by ?? "You"}</span>
                  <span>{timeAgo(e.at)}</span>
                </div>
                {e.subject && <div className="mb-0.5 text-[12.5px] font-medium">{e.subject}</div>}
                <p className="text-[13.5px] break-words whitespace-pre-wrap">{e.body}</p>
              </div>
            </li>
          );
        }
        const I = e.kind === "call" ? callIcon(e) : markIcon[e.kind] ?? Info;
        const missed = e.kind === "call" && e.call?.result === "missed";
        return (
          <li key={e.id} className="flex items-start gap-2 px-1 text-[12.5px] text-muted">
            <I size={13} className={cn("mt-0.5 shrink-0", missed && "text-bad")} />
            <span className="min-w-0 flex-1">{e.kind === "call" && e.dir === "in" && !missed ? "Called in" : ""}{e.kind === "call" && e.dir === "in" && !missed && e.body ? ": " : ""}{e.body}{e.by && e.by !== "You" && e.kind !== "call" && !e.body.includes(e.by) ? <span className="text-subtle"> · {e.by}</span> : null}</span>
            <span className="shrink-0 text-subtle">{timeAgo(e.at)}</span>
          </li>
        );
      })}
      <li ref={end} aria-hidden />
    </ol>
  );
}

// ---------- Composer ----------

type Mode = "sms" | "email" | "call" | "note";
/**
 * Reply on any channel from one box. It starts on the channel they last used,
 * with Marko's draft when it's their turn. Call logs what happened on the phone.
 */
export function Composer({ c, events, onDone, compact, call: callFirst }: { c: Contact; events: Event[]; onDone?: (msg: string) => void; compact?: boolean; call?: boolean }) {
  const st = useCrm();
  const talk = events.filter((e) => e.kind === "sms" || e.kind === "email" || e.kind === "call");
  const last = talk[talk.length - 1];
  const theirTurn = last?.dir === "in" && (last.kind !== "call" || last.call?.result === "missed");
  const lastCh: Mode = last?.kind === "email" ? "email" : "sms";
  // Start on the channel they last used, if it's on and allowed for them.
  const usable = (m: "sms" | "email") => isOn(m) && !blockedOn(c, m);
  const start: Mode = callFirst ? "call" : usable(lastCh as "sms" | "email") ? lastCh : usable("sms") ? "sms" : usable("email") ? "email" : "call";
  const [mode, setMode] = useState<Mode>(start);
  const [body, setBody] = useState(theirTurn && start !== "call" ? suggestReply(c, last) : "");
  const [subject, setSubject] = useState(last?.kind === "email" && last.subject ? (last.subject.startsWith("Re:") ? last.subject : `Re: ${last.subject}`) : "");
  const [drafted, setDrafted] = useState(theirTurn && start !== "call");
  const ta = useRef<HTMLTextAreaElement>(null);
  const blocked = mode === "sms" || mode === "email" ? notReady(st, mode) ?? blockedOn(c, mode) : mode === "call" ? blockedOn(c, mode) : null;
  const firstText = mode === "sms" && !events.some((e) => e.kind === "sms" && e.dir === "out");
  const parts = mode === "sms" ? smsParts(body + (firstText ? ` ${st.channels.sms.optOutLine}` : "")) : null;
  const from = mode === "sms" ? st.channels.sms.numbers.find((n) => n.location === c.location)?.number : st.channels.email.fromAddress;

  const send = () => {
    if (!body.trim()) return;
    if (mode === "note") { addNote(c.id, body.trim()); onDone?.("Note added"); }
    else if (mode === "sms" || mode === "email") { sendMessage(c.id, mode, body.trim(), mode === "email" ? subject || "Maple & Main Dental" : undefined); onDone?.(`${mode === "sms" ? "Text" : "Email"} sent from ${from}`); }
    setBody(""); setDrafted(false);
  };
  const call = (r: "answered" | "voicemail" | "no_answer") => { logCall(c.id, r, body, r === "answered" ? 240 : 30); setBody(""); onDone?.("Call logged"); };

  return (
    <div className={cn(!compact && "border-t border-line px-5 py-4")}>
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <Segmented<Mode> label="Reply by" value={mode} onChange={(m) => { setMode(m); if (m === "call" || m === "note") { setBody(""); setDrafted(false); } }}
          options={[
            ...(isOn("sms") ? [{ id: "sms" as Mode, label: <span className="inline-flex items-center gap-1"><MessageSquareText size={12} />Text</span> }] : []),
            ...(isOn("email") ? [{ id: "email" as Mode, label: <span className="inline-flex items-center gap-1"><Mail size={12} />Email</span> }] : []),
            { id: "call", label: <span className="inline-flex items-center gap-1"><Phone size={12} />Call</span> }, { id: "note", label: <span className="inline-flex items-center gap-1"><NotebookPen size={12} />Note</span> }]} />
        <span className="flex-1" />
        {(mode === "sms" || mode === "email") && !blocked && (drafted ? <span className="inline-flex items-center gap-1 text-[12px] text-accent"><Sparkles size={12} />{assistant()}'s draft</span> : <button onClick={() => { setBody(suggestReply(c, last)); setDrafted(true); }} className="text-[12.5px] text-muted underline decoration-line-strong underline-offset-2 hover:text-fg">Draft a reply</button>)}
      </div>
      {blocked ? (
        <p className="flex items-start gap-2 rounded-lg bg-hover px-3 py-2.5 text-[13px] text-muted"><Ban size={14} className="mt-0.5 shrink-0" /><span>{blocked}.{(mode === "sms" || mode === "email") && notReady(st, mode) ? <> <Link to="/settings/messaging" className="underline underline-offset-2">Set it up</Link></> : mode === "sms" && c.phone && c.mobile ? " Turn texts on in their details if they've said yes." : ""}</span></p>
      ) : (
        <>
          {mode === "call" && <p className="mb-2 text-[12.5px] text-muted">Call <a href={`tel:${c.phone}`} className="font-medium text-fg underline decoration-line-strong underline-offset-2">{c.phone}</a>, then log how it went. Calls go out from {st.channels.sms.numbers.find((n) => n.location === c.location)?.number}, so they see your number.</p>}
          {mode === "email" && <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Subject" aria-label="Subject" className="mb-2" />}
          <Textarea ref={ta} value={body} onChange={(e) => { setBody(e.target.value); setDrafted(false); }} rows={compact ? 3 : mode === "email" ? 6 : 3}
            placeholder={mode === "call" ? "What did you talk about? (optional)" : mode === "note" ? "Only your team sees notes" : mode === "sms" ? "Write a text…" : "Write an email…"} aria-label="Message"
            />
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {mode === "call" ? (
              <>
                <span className="text-[12.5px] text-muted">How did it go?</span>
                <span className="flex-1" />
                <Button size="sm" onClick={() => call("no_answer")}>No answer</Button>
                <Button size="sm" onClick={() => call("voicemail")}>Left voicemail</Button>
                <Button size="sm" variant="primary" icon={<Check size={12} />} onClick={() => call("answered")}>Talked</Button>
              </>
            ) : (
              <>
                {(mode === "sms" || mode === "email") && <FieldPicker onPick={(t) => setBody(insertAt(ta.current, body, t))} />}
                {mode === "sms" && <Button size="sm" variant="ghost" icon={<CalendarDays size={12} />} onClick={() => setBody((b) => `${b}${b && !b.endsWith(" ") ? " " : ""}{{booking_link}}`)}>Booking link</Button>}
                {parts && body && <span className={cn("text-[12px]", parts.parts > 1 ? "text-warn" : "text-subtle")}>{parts.len} chars · {parts.parts} text{parts.parts > 1 ? "s" : ""}</span>}
                <span className="flex-1" />
                {firstText && <span className="text-[12px] text-subtle">Adds “{st.channels.sms.optOutLine}”</span>}
                <Button variant="primary" size="sm" icon={mode === "note" ? <NotebookPen size={12} /> : <Send size={12} />} disabled={!body.trim()} onClick={send}>{mode === "note" ? "Add note" : mode === "sms" ? "Send text" : "Send email"}</Button>
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// ---------- Contact drawer ----------

const daysFrom = (ms: number) => { const d = Math.round((ms - Date.now()) / 86_400_000); return d === 0 ? "today" : d > 0 ? `in ${d} day${d === 1 ? "" : "s"}` : `${-d} day${d === -1 ? "" : "s"} ago`; };
const dateOf = (ms: number) => new Date(ms).toLocaleDateString("en-US", { month: "short", day: "numeric", year: new Date(ms).getFullYear() === new Date().getFullYear() ? undefined : "numeric" });

/** Everything about one person and every way to reach them, without leaving the list. */
export function ContactDrawer({ id, onClose, toast }: { id: string | null; onClose: () => void; toast: (m: string) => void }) {
  const st = useCrm();
  const c = id ? contactOf(st, id) : undefined;
  useEffect(() => { if (id) markRead(id); }, [id]);
  const [tagOpen, setTagOpen] = useState(false);
  if (!c) return <Drawer open={false} onClose={onClose} title="">{null}</Drawer>;
  const evs = eventsOf(st, c.id);
  const ad = sources[c.source].ad;
  const inAuto = evs.filter((e) => e.kind === "note" && e.body.startsWith("Started ")).map((e) => e.by!);
  return (
    <Drawer open onClose={onClose} width={600} title={<span className="flex items-center gap-2">{c.name}<StageBadge stage={c.stage} /></span>}>
      <div className="-mx-6 -mt-1">
        <div className="space-y-4 border-b border-line px-6 pb-4">
          <div className="flex flex-wrap items-center gap-2">
            <label className="flex items-center gap-2 text-[12.5px] text-muted">Stage
              <Select size="sm" className="w-auto" value={c.stage} onChange={(e) => { const st2 = setStage([c.id], e.target.value as Stage); toast(`Moved to ${stageOf(e.target.value as Stage).label}.${startedText(st2)}`); }}>
                {stages.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
              </Select>
            </label>
            <span className="flex-1" />
            {isOn("inbox") && <Link to={`/inbox?c=${c.id}`} className="inline-flex h-8 items-center gap-1.5 rounded-md border border-line bg-surface px-2.5 text-[12.5px] font-medium hover:bg-hover">Open in Inbox</Link>}
          </div>
          <dl className="grid grid-cols-[110px_minmax(0,1fr)] gap-x-3 gap-y-1.5 text-[13px]">
            <dt className="text-muted">Mobile</dt><dd className="truncate">{c.phone ?? "—"}{c.phone && !c.mobile && <span className="text-subtle"> · landline</span>}</dd>
            <dt className="text-muted">Email</dt><dd className="truncate">{c.email ?? "—"}</dd>
            <dt className="text-muted">Came from</dt><dd>{c.sourceDetail} · {dateOf(c.createdAt)}{ad && <div className="text-[12px] text-subtle">When they book, {c.source === "meta_ad" ? "Meta" : "Google Ads"} is told, so the ads find more people like them.</div>}</dd>
            <dt className="text-muted">Location</dt><dd>{c.location}</dd>
            <dt className="text-muted">Appointments</dt><dd>{c.nextAppt ? <>Next {dateOf(c.nextAppt)} ({daysFrom(c.nextAppt)})</> : "Nothing booked"}{c.lastVisit && <span className="text-muted"> · last visit {dateOf(c.lastVisit)}</span>}</dd>
            <dt className="text-muted">Worth</dt><dd>${fmt(c.value)} <span className="text-subtle">first year, estimated</span></dd>
            {inAuto.length > 0 && isOn("workflows") && <><dt className="text-muted">Workflows</dt><dd className="flex flex-wrap gap-1">{[...new Set(inAuto)].map((a) => <Badge key={a}><WorkflowIcon size={10} />{a}</Badge>)}</dd></>}
          </dl>
          <div className="flex flex-wrap items-center gap-1.5">
            {c.tags.map((t) => <Badge key={t} className="gap-1">{t}<button onClick={() => { const st2 = removeTag([c.id], t); if (st2.length) toast(`Removed “${t}”.${startedText(st2)}`); }} aria-label={`Remove ${t}`} className="hover:text-fg"><X size={10} /></button></Badge>)}
            <div className="relative">
              <button onClick={() => setTagOpen(!tagOpen)} className="inline-flex h-[22px] items-center gap-1 rounded-full border border-dashed border-line-strong px-2 text-[12px] text-muted hover:text-fg"><Plus size={11} />Tag</button>
              {tagOpen && (
                <div className="anim-fade absolute top-full left-0 z-30 mt-1 w-48 rounded-lg border border-line bg-surface p-1 shadow-float">
                  {tagOptions.filter((t) => !c.tags.includes(t)).map((t) => <button key={t} onClick={() => { const st2 = addTag([c.id], t); setTagOpen(false); toast(`Tagged “${t}”.${startedText(st2)}`); }} className="block w-full rounded px-2 py-1.5 text-left text-[12.5px] hover:bg-hover">{t}</button>)}
                </div>
              )}
            </div>
          </div>
          <div className="rounded-lg border border-line p-3">
            <div className="mb-2 text-[12.5px] font-medium">May we contact them?</div>
            <div className="space-y-2">
              {(["sms", "email"] as const).map((ch) => (
                <div key={ch} className="flex items-center gap-3 text-[13px]">
                  <ChannelIcon ch={ch} className="text-muted" />
                  <span className="flex-1">{ch === "sms" ? "Texts" : "Email"}{(ch === "sms" ? !c.phone || !c.mobile : !c.email) && <span className="text-subtle"> · {ch === "sms" ? "no mobile number" : "no email address"}</span>}</span>
                  <Toggle label={`${ch === "sms" ? "Texts" : "Email"} allowed`} checked={c.consent[ch]} onChange={(v) => { setConsent(c.id, ch, v); toast(v ? "Turned on" : "Turned off. They won't get campaigns or workflows on it"); }} />
                </div>
              ))}
            </div>
            <p className="mt-2 text-[12px] text-subtle">{c.consent.how}. Calls are always allowed for appointments; no automated marketing calls.</p>
          </div>
        </div>
        <div className="px-6 py-4"><Timeline c={c} events={evs} /></div>
        <div className="[&>div]:px-6"><Composer key={c.id} c={c} events={evs} onDone={toast} /></div>
      </div>
    </Drawer>
  );
}

// ---------- Add contact ----------

export function AddContactModal({ open, onClose, onAdded }: { open: boolean; onClose: () => void; onAdded: (id: string, started: Started[]) => void }) {
  const blank: NewContact = { name: "", email: "", phone: "", source: "call", location: "South Congress", tags: [], smsOk: true, emailOk: true };
  const [x, setX] = useState<NewContact>(blank);
  const ok = x.name.trim() && (x.email?.trim() || x.phone?.trim());
  const save = () => { const r = addContact(x); setX(blank); onAdded(r.id, r.started); };
  return (
    <Modal open={open} onClose={onClose} title="Add a contact" footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button variant="primary" disabled={!ok} onClick={save}>Add contact</Button></>}>
      <div className="space-y-3">
        <Field label="Name"><Input autoFocus value={x.name} onChange={(e) => setX({ ...x, name: e.target.value })} /></Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Mobile"><Input value={x.phone ?? ""} onChange={(e) => setX({ ...x, phone: e.target.value })} placeholder="(512) 555-…" /></Field>
          <Field label="Email"><Input type="email" value={x.email ?? ""} onChange={(e) => setX({ ...x, email: e.target.value })} /></Field>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="How they found you">
            <Select value={x.source} onChange={(e) => setX({ ...x, source: e.target.value as Source })}>{(Object.keys(sources) as Source[]).map((s) => <option key={s} value={s}>{sources[s].label}</option>)}</Select>
          </Field>
          <Field label="Location">
            <Select value={x.location} onChange={(e) => setX({ ...x, location: e.target.value })}><option>South Congress</option><option>Mueller</option></Select>
          </Field>
        </div>
        <div className="space-y-2 rounded-lg border border-line p-3 text-[13px]">
          <div className="flex items-center justify-between gap-3"><span>They said yes to texts</span><Toggle label="Texts allowed" checked={x.smsOk} onChange={(v) => setX({ ...x, smsOk: v })} /></div>
          <div className="flex items-center justify-between gap-3"><span>They said yes to email</span><Toggle label="Email allowed" checked={x.emailOk} onChange={(v) => setX({ ...x, emailOk: v })} /></div>
          <p className="text-[12px] text-subtle">Only turn these on if they agreed. Texting without consent can cost $500+ per message under the TCPA.</p>
        </div>
      </div>
    </Modal>
  );
}
