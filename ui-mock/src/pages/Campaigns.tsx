import { useRef, useState } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router";
import { ArrowLeft, CalendarClock, ChevronLeft, ChevronRight, Copy, Inbox, Loader2, Mail, MessageSquareText, Send, Sparkles, Trash2, Workflow as WorkflowIcon } from "lucide-react";
import { Badge, Button, Card, Input, PageHeader, Segmented, Select, Stat, Textarea, cn, fmt, useToast } from "../components/ui";
import { FieldPicker, FlagList, insertAt } from "../components/Crm";
import { fillFields, segments, type SegmentId } from "../data/contacts";
import { brandFacts } from "../data/brand";
import type { Campaign, Send as SendCh } from "../data/messaging";
import { audienceLabel, audienceOf, deleteCampaign, draftCampaign, duplicateCampaign, messageChecks, newCampaign, sendCampaign, smsParts, withExamples, updateCampaign, useCrm } from "../lib/crm";
import { timeAgo } from "../lib/runs";
import { isOn, useOn } from "../lib/features";
import { assistant } from "../lib/whitelabel";
import { Can } from "../components/Can";

const pct = (n: number | undefined, of: number) => (n === undefined ? "—" : of ? `${Math.round((n / of) * 100)}%` : "0%");
const when = (c: Campaign) =>
  c.status === "sent" ? `Sent ${timeAgo(c.sentAt!)}` : c.status === "sending" ? "Sending…" : c.status === "scheduled" ? `Goes ${new Date(c.sendAt!).toLocaleString("en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}` : `Draft · ${timeAgo(c.createdAt)}`;

/**
 * Campaigns: one email or one text to a list, sent once. Workflows (the
 * ones that run when something happens) are their own page; both write to the
 * same contact timelines and replies land in the same Inbox.
 */
export default function Campaigns() {
  const { id } = useParams();
  return id ? <Editor id={id} /> : <CampaignList />;
}

function CampaignList() {
  const st = useCrm();
  const navigate = useNavigate();
  const start = (ch: SendCh) => navigate(`/campaigns/${newCampaign(ch)}`);
  const smsOn = useOn("sms");
  const emailOn = useOn("email");
  const sent = st.campaigns.filter((c) => c.stats);
  const total = (k: "sent" | "replied" | "booked") => sent.reduce((a, c) => a + (c.stats![k] ?? 0), 0);
  return (
    <>
      <PageHeader
        title="Campaigns"
        sub={<>One email or text to a list, sent once. For messages that go out when something happens (a new lead, a visit), use <Link to="/workflows" className="underline underline-offset-2">Workflows</Link>.</>}
        actions={<>{smsOn && <Button icon={<MessageSquareText size={14} />} onClick={() => start("sms")}>New text</Button>}{emailOn && <Button variant="primary" icon={<Mail size={14} />} onClick={() => start("email")}>New email</Button>}</>}
      />
      {sent.length > 0 && (
        <Card className="mb-5 grid grid-cols-3 gap-5">
          <Stat label="Sent, all campaigns" value={fmt(total("sent"))} />
          <Stat label="Replied" value={fmt(total("replied"))} delta={<span className="text-[12.5px] text-muted">{pct(total("replied"), total("sent"))}</span>} />
          <Stat label="Booked within 7 days" value={fmt(total("booked"))} delta={<span className="text-[12.5px] text-muted">≈ ${fmt(total("booked") * 1200)}</span>} />
        </Card>
      )}
      <Card pad={false} className="overflow-x-auto">
        <table className="w-full min-w-[760px] text-[13.5px]">
          <thead className="border-b border-line text-left text-[12.5px] text-muted">
            <tr>
              <th className="px-5 py-2.5 font-normal">Campaign</th><th className="px-3 py-2.5 font-normal">Status</th>
              <th className="px-3 py-2.5 text-right font-normal">Sent</th><th className="px-3 py-2.5 text-right font-normal">Opened</th><th className="px-3 py-2.5 text-right font-normal">Replied</th>
              <th className="px-3 py-2.5 text-right font-normal">Booked</th><th className="px-5 py-2.5 text-right font-normal">Opted out</th>
            </tr>
          </thead>
          <tbody>
            {st.campaigns.map((c) => {
              const s = c.stats;
              return (
                <tr key={c.id} onClick={() => navigate(`/campaigns/${c.id}`)} className="cursor-pointer border-b border-line last:border-0 hover:bg-hover">
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2 font-medium">{c.channel === "sms" ? <MessageSquareText size={13} className="shrink-0 text-muted" /> : <Mail size={13} className="shrink-0 text-muted" />}{c.name || "Untitled"}</div>
                    <div className="pl-[21px] text-[12px] text-muted">{audienceLabel(c.audience)}</div>
                  </td>
                  <td className="px-3 whitespace-nowrap"><Badge tone={c.status === "sent" ? "good" : c.status === "scheduled" ? "info" : c.status === "sending" ? "accent" : "neutral"}>{when(c)}</Badge></td>
                  <td className="num px-3 text-right">{s ? fmt(s.sent) : "—"}</td>
                  <td className="num px-3 text-right text-muted">{s && c.channel === "email" ? pct(s.opened, s.delivered) : "—"}</td>
                  <td className="num px-3 text-right">{s ? <>{s.replied} <span className="text-muted">({pct(s.replied, s.delivered)})</span></> : "—"}</td>
                  <td className="num px-3 text-right font-medium">{s ? s.booked : "—"}</td>
                  <td className="num px-5 text-right text-muted">{s ? s.optedOut : "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {!st.campaigns.length && <p className="px-5 py-12 text-center text-[13px] text-muted">No campaigns yet.</p>}
      </Card>
      <p className="mt-3 text-[12.5px] text-subtle">Booked counts anyone who booked within 7 days of getting it. Texts only go between 8am and 9pm in their time zone.</p>
    </>
  );
}


function Editor({ id }: { id: string }) {
  const st = useCrm();
  const navigate = useNavigate();
  const { toast, node } = useToast();
  const c = st.campaigns.find((x) => x.id === id);
  const ta = useRef<HTMLTextAreaElement>(null);
  const [later, setLater] = useState(false);
  const [at, setAt] = useState(() => { const d = new Date(Date.now() + 86_400_000); d.setHours(10, 0, 0, 0); return d.toISOString().slice(0, 16); });
  const [who, setWho] = useState(0);
  if (!c) return <Navigate replace to="/campaigns" />;
  const aud = audienceOf(st, c);
  const locked = c.status === "sent" || c.status === "sending";
  const flags = messageChecks(c.channel, c.subject, c.body, st.channels.sms.optOutLine);
  const blocked = flags.some((f) => f.level === "block") || !aud.will.length;
  const sample = aud.will[who % Math.max(1, aud.will.length)] ?? aud.all[0];
  const up = (p: Partial<Campaign>) => updateCampaign(c.id, p);
  const write = () => { const d = draftCampaign(c.channel, "segment" in c.audience ? c.audience.segment : null); up({ name: c.name || d.name, subject: d.subject, body: d.body }); };
  const go = () => {
    sendCampaign(c.id, later ? new Date(at).getTime() : null);
    toast(later ? `Scheduled for ${new Date(at).toLocaleString("en-US", { weekday: "short", hour: "numeric", minute: "2-digit" })}` : `Sending to ${aud.will.length}`);
  };
  const s = c.stats;

  return (
    <>
      <PageHeader
        crumbs={<Link to="/campaigns" className="inline-flex items-center gap-1 hover:text-fg"><ArrowLeft size={13} /> Campaigns</Link>}
        title={locked ? c.name || "Untitled" : <input value={c.name} onChange={(e) => up({ name: e.target.value })} placeholder="Name this campaign" aria-label="Campaign name" className="w-[min(560px,80vw)] bg-transparent outline-none placeholder:text-subtle" />}
        sub={locked ? `${c.channel === "sms" ? "Text" : "Email"} to ${audienceLabel(c.audience)} · ${when(c)}` : "Only you see the name."}
        actions={locked ? (
          <>
            {s && s.replied > 0 && <Link to="/inbox"><Button icon={<Inbox size={14} />}>{s.replied} replies</Button></Link>}
            <Button icon={<Copy size={14} />} onClick={() => { const n = duplicateCampaign(c.id); if (n) navigate(`/campaigns/${n}`); }}>Duplicate</Button>
          </>
        ) : <Can I="edit" on="campaigns"><Button variant="ghost" icon={<Trash2 size={14} />} onClick={() => { deleteCampaign(c.id); navigate("/campaigns"); }}>Delete draft</Button></Can>}
      />

      {c.status === "sending" && <Card className="mb-5 flex items-center gap-3 text-[13.5px]"><Loader2 size={16} className="animate-spin" />Sending to {aud.will.length}…</Card>}
      {s && (
        <Card className="mb-5 grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-6">
          <Stat label="Delivered" value={fmt(s.delivered)} delta={<span className="text-[12.5px] text-muted">of {fmt(s.sent)}</span>} />
          {c.channel === "email" ? <Stat label="Opened" value={pct(s.opened, s.delivered)} hint="Apple Mail opens everything, so treat this as rough" /> : <Stat label="Cost" value={`$${(s.sent * smsParts(withExamples(c.body)).parts * 0.0083).toFixed(2)}`} />}
          {c.channel === "email" ? <Stat label="Clicked" value={pct(s.clicked, s.delivered)} /> : <Stat label="Segments each" value={smsParts(withExamples(c.body)).parts} />}
          <Stat label="Replied" value={s.replied} delta={<span className="text-[12.5px] text-muted">{pct(s.replied, s.delivered)}</span>} />
          <Stat label="Booked" value={s.booked} delta={<span className="text-[12.5px] text-good">≈ ${fmt(s.booked * 1200)}</span>} />
          <Stat label="Opted out" value={s.optedOut} delta={<span className="text-[12.5px] text-muted">{pct(s.optedOut, s.delivered)}</span>} />
        </Card>
      )}

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-4">
          {!locked && (
            <Card className="space-y-4">
              <div className="flex flex-wrap items-center gap-3">
                <span className="w-20 text-[13px] font-medium">Send as</span>
                <Segmented<SendCh> label="Channel" value={c.channel} onChange={(ch) => up({ channel: ch })} options={[
                  ...(isOn("email") || c.channel === "email" ? [{ id: "email" as SendCh, label: <span className="inline-flex items-center gap-1"><Mail size={12} />Email</span> }] : []),
                  ...(isOn("sms") || c.channel === "sms" ? [{ id: "sms" as SendCh, label: <span className="inline-flex items-center gap-1"><MessageSquareText size={12} />Text</span> }] : []),
                ]} />
              </div>
              <div className="flex flex-wrap items-start gap-3">
                <span className="w-20 pt-2 text-[13px] font-medium">To</span>
                <div className="min-w-0 flex-1">
                  <Select value={"segment" in c.audience ? c.audience.segment : "ids"} onChange={(e) => e.target.value !== "ids" && up({ audience: { segment: e.target.value as SegmentId } })} aria-label="Audience">
                    {"ids" in c.audience && <option value="ids">{c.audience.label}</option>}
                    {segments.map((sg) => <option key={sg.id} value={sg.id}>{sg.label}</option>)}
                  </Select>
                  <p className="mt-1.5 text-[12.5px]"><span className="font-medium">{fmt(aud.will.length)} will get it</span>{aud.skipped.length > 0 && <span className="text-muted"> · skipping {aud.skipped.map((x) => `${x.n} ${x.why.toLowerCase()}`).join(", ")}</span>}</p>
                </div>
              </div>
            </Card>
          )}

          <Card className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-[14px] font-medium">Message</h2>
              {!locked && <Button size="sm" variant="ghost" icon={<Sparkles size={12} />} onClick={write}>{c.body ? `Rewrite with ${assistant()}` : `Write with ${assistant()}`}</Button>}
            </div>
            {c.channel === "email" && <Input value={c.subject} disabled={locked} onChange={(e) => up({ subject: e.target.value })} placeholder="Subject" aria-label="Subject" />}
            <Textarea ref={ta} value={c.body} disabled={locked} onChange={(e) => up({ body: e.target.value })} rows={c.channel === "email" ? 10 : 4} aria-label="Message"
              placeholder={c.channel === "sms" ? "Keep it under 160 characters, with one link." : `Write it like ${brandFacts.name} talks. Use Insert field for their name.`}
              className="disabled:opacity-80" />
            {!locked && (
              <div className="flex flex-wrap items-center gap-2">
                <FieldPicker onPick={(t) => up({ body: insertAt(ta.current, c.body, t) })} />
                {c.channel === "sms" && c.body && (() => { const p = smsParts(`${withExamples(c.body)} ${st.channels.sms.optOutLine}`); return <span className={cn("text-[12px]", p.parts > 1 ? "text-warn" : "text-subtle")}>{p.len} characters with the opt-out line · {p.parts} segment{p.parts > 1 ? "s" : ""}</span>; })()}
              </div>
            )}
            {!locked && <div className="border-t border-line pt-3"><FlagList flags={flags} /></div>}
          </Card>

          {!locked && (
            <Card className="space-y-3">
              <div className="flex flex-wrap items-center gap-3">
                <span className="w-20 text-[13px] font-medium">When</span>
                <Segmented label="When" value={later ? "later" : "now"} onChange={(v) => setLater(v === "later")} options={[{ id: "now", label: "Now" }, { id: "later", label: "Schedule" }]} />
                {later && <Input type="datetime-local" value={at} onChange={(e) => setAt(e.target.value)} aria-label="Send at" className="w-auto" />}
              </div>
              {c.status === "scheduled" && <p className="flex items-center gap-1.5 text-[12.5px] text-info"><CalendarClock size={13} />{when(c)}. Change anything and schedule again to update it.</p>}
              <div className="flex flex-wrap items-center gap-2 border-t border-line pt-3">
                <Button size="sm" variant="ghost" disabled={!c.body} onClick={() => toast(c.channel === "sms" ? "Test text sent to your phone" : "Test email sent to you")}>Send me a test</Button>
                <span className="flex-1" />
                {blocked && c.body && <span className="text-[12.5px] text-bad">{aud.will.length ? "Fix the red items first" : "Nobody on this list can get it"}</span>}
                <Can I="send" on="campaigns"><Button variant="primary" icon={later ? <CalendarClock size={14} /> : <Send size={14} />} disabled={blocked} onClick={go}>{later ? "Schedule" : `Send to ${fmt(aud.will.length)}`}</Button></Can>
              </div>
            </Card>
          )}
          {locked && <p className="flex items-center gap-1.5 text-[12.5px] text-muted"><WorkflowIcon size={13} />Want this to go out on its own every time someone becomes due? <Link to="/workflows" className="underline underline-offset-2">Make it a workflow</Link>.</p>}
        </div>

        {/* What one real recipient will see. */}
        <aside className="min-w-0 self-start break-words lg:sticky lg:top-4">
          <div className="mb-2 flex items-center gap-2 text-[12.5px] text-muted">
            <span className="flex-1 truncate">Preview{sample ? ` for ${sample.name}` : ""}</span>
            {aud.will.length > 1 && <><button onClick={() => setWho(who + aud.will.length - 1)} aria-label="Previous person" className="rounded p-1 hover:bg-hover"><ChevronLeft size={14} /></button><button onClick={() => setWho(who + 1)} aria-label="Next person" className="rounded p-1 hover:bg-hover"><ChevronRight size={14} /></button></>}
          </div>
          {c.channel === "sms" ? (
            <div className="rounded-[28px] border border-line bg-surface p-3 shadow-card">
              <div className="mb-3 text-center text-[11.5px] text-subtle">{st.channels.sms.numbers.find((n) => n.location === sample?.location)?.number ?? st.channels.sms.numbers[0].number}</div>
              <div className="min-h-40">
                {c.body ? <div className="ml-1 max-w-[88%] rounded-2xl rounded-bl-md bg-hover px-3 py-2 text-[13px] whitespace-pre-wrap">{sample ? fillFields(c.body, sample) : c.body} {st.channels.sms.optOutLine}</div> : <p className="pt-12 text-center text-[12.5px] text-subtle">Your text shows here</p>}
              </div>
            </div>
          ) : (
            <Card pad={false}>
              <div className="border-b border-line px-4 py-3 text-[12.5px]">
                <div className="truncate"><span className="text-muted">From </span>{st.channels.email.fromName} &lt;{st.channels.email.fromAddress}&gt;</div>
                <div className="mt-0.5 truncate font-medium">{c.subject && sample ? fillFields(c.subject, sample) : c.subject || <span className="text-subtle">Subject</span>}</div>
              </div>
              <div className="min-h-40 px-4 py-3 text-[13px] whitespace-pre-wrap">{c.body ? (sample ? fillFields(c.body, sample) : c.body) : <span className="text-subtle">Your email shows here</span>}</div>
              <div className="border-t border-line px-4 py-2.5 text-[11.5px] text-subtle">{st.channels.email.footer} · Unsubscribe</div>
            </Card>
          )}
        </aside>
      </div>
      {node}
    </>
  );
}
