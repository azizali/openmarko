import { useMemo, useState } from "react";
import { Link } from "react-router";
import { Send, Check, Loader2, KeyRound, Webhook, Inbox as InboxIcon, Flame, ChevronLeft, ChevronRight, AlertTriangle, Sparkles, Mail } from "lucide-react";
import { Badge, Button, Checkbox, Modal, cn } from "./ui";
import { providers, starterCampaign, type ProviderId } from "../data/sequencers";
import { isOn, useOn } from "../lib/features";
import type { Market, Opportunity, Prospect } from "../data/prospects";
import {
  campaignOf, connect, createStarterCampaign, leadFor, leadFrom, providerName, pushLeads, render, setRules, statusMeta, useOutreach, type Lead,
} from "../lib/outreach";

export function ProviderMark({ id, size = 28 }: { id: ProviderId; size?: number }) {
  const p = providers[id];
  return <span title={p.name} className="grid shrink-0 place-items-center rounded-lg font-semibold text-white" style={{ width: size, height: size, background: p.color, fontSize: size * 0.4 }}>{p.short}</span>;
}

/** Where a prospect is in the sequence; links to its thread in Outreach. */
export function LeadBadge({ lead }: { lead: Lead }) {
  if (!isOn("outreach")) return null;
  const m = statusMeta[lead.status];
  const label = lead.status === "sent" ? `Step ${lead.step}` : m.label;
  return (
    <Link to={`/outreach?lead=${encodeURIComponent(lead.auditPath)}`} onClick={(e) => e.stopPropagation()} title={`${m.label} · ${lead.campaignName}`}>
      <Badge tone={m.tone} className="whitespace-nowrap hover:opacity-80">{lead.unread && <span className="size-1.5 rounded-full bg-current" />}<Mail size={10} />{label}</Badge>
    </Link>
  );
}

// ---------- Connect ----------

const field = "h-10 w-full rounded-lg border border-line bg-surface px-3 text-[13.5px] outline-none focus:border-line-strong";

/**
 * Pick a sequencer, paste its API key, choose where prospects go by default.
 * OpenMarko registers the webhooks itself, so there's nothing to set up on the other side.
 */
export function ConnectFlow({ onConnect, onDone }: { onConnect?: () => void; onDone: () => void }) {
  const st = useOutreach();
  const [step, setStep] = useState<"pick" | "key" | "setup">(st.connection ? "setup" : "pick");
  const [provider, setProvider] = useState<ProviderId>(st.connection?.provider ?? "plusvibe");
  const [key, setKey] = useState("");
  const [ws, setWs] = useState("");
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [choice, setChoice] = useState<string>("starter");
  const meta = providers[provider];

  const verify = () => {
    if (key.trim().length < 12) return setError("That key looks too short. Copy the whole key from " + meta.keyWhere + ".");
    if (meta.needsWorkspace && !ws.trim()) return setError("Add the workspace ID too. It's on the same page as the key.");
    setError(null); setChecking(true);
    setTimeout(() => { onConnect?.(); connect(provider, key.trim()); setChecking(false); setStep("setup"); }, 1400);
  };
  const finish = () => {
    const id = choice === "starter" ? createStarterCampaign()?.id ?? null : choice;
    setRules({ defaultCampaign: id });
    onDone();
  };

  if (step === "pick") return (
    <div className="space-y-3">
      <p className="text-[13.5px] text-muted">Your sequencer sends the emails, warms up your inboxes and keeps them out of spam. OpenMarko hands it prospects with their audit link and shows you the replies.</p>
      {(Object.keys(providers) as ProviderId[]).map((id) => {
        const p = providers[id];
        return (
          <button key={id} onClick={() => { setProvider(id); setStep("key"); }} className="flex w-full items-start gap-3 rounded-xl border border-line bg-surface p-3.5 text-left transition-colors hover:border-line-strong hover:bg-hover">
            <ProviderMark id={id} size={36} />
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-2 text-[14px] font-medium">{p.name}{id === "plusvibe" && <Badge tone="accent">Recommended</Badge>}</span>
              <span className="block text-[12.5px] text-muted">{p.blurb}</span>
              <span className="mt-1.5 flex flex-wrap gap-1">{p.has.map((h) => <Badge key={h}>{h}</Badge>)}</span>
            </span>
            <ChevronRight size={16} className="mt-2 shrink-0 text-subtle" />
          </button>
        );
      })}
      <p className="text-[12px] text-subtle">Using another tool? Export CSV from Prospecting works with any sequencer; the audit link is in the file.</p>
    </div>
  );

  if (step === "key") return (
    <div className="space-y-4">
      <button onClick={() => { setStep("pick"); setError(null); }} className="inline-flex items-center gap-1 text-[12.5px] text-muted hover:text-fg"><ChevronLeft size={13} /> All sequencers</button>
      <div className="flex items-center gap-3">
        <ProviderMark id={provider} size={36} />
        <div><div className="text-[15px] font-medium">Connect {meta.name}</div><div className="text-[12.5px] text-muted">Find it in {meta.keyWhere}</div></div>
      </div>
      <label className="block"><span className="mb-1.5 block text-[12.5px] font-medium text-muted">API key</span><input type="password" autoComplete="off" value={key} onChange={(e) => setKey(e.target.value)} placeholder="Paste your API key" className={field} /></label>
      {meta.needsWorkspace && <label className="block"><span className="mb-1.5 block text-[12.5px] font-medium text-muted">Workspace ID</span><input value={ws} onChange={(e) => setWs(e.target.value)} placeholder="e.g. 66f1c0…" className={cn(field, "font-mono text-[12.5px]")} /></label>}
      {meta.note && <p className="flex items-start gap-2 text-[12.5px] text-muted"><KeyRound size={13} className="mt-0.5 shrink-0" />{meta.note} The key is stored encrypted and only used to add leads and read replies.</p>}
      {error && <p className="rounded-md bg-bad-soft px-3 py-2 text-[13px] text-bad">{error}</p>}
      <Button variant="primary" className="w-full" disabled={checking} onClick={verify} icon={checking ? <Loader2 size={14} className="animate-spin" /> : undefined}>{checking ? `Checking ${meta.name}…` : `Connect ${meta.name}`}</Button>
    </div>
  );

  const c = st.connection!;
  const ready = c.inboxes.filter((i) => i.status === "ready").length;
  const warming = c.inboxes.filter((i) => i.status === "warming").length;
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 rounded-lg bg-good-soft px-3 py-2.5 text-good">
        <Check size={16} /><span className="text-[13.5px] font-medium">Connected to {c.workspace} on {providers[c.provider].name}</span>
      </div>
      <ul className="space-y-1.5 text-[13px]">
        <li className="flex items-center gap-2"><InboxIcon size={14} className="text-muted" />{c.inboxes.length} sending inboxes · {ready} ready{warming ? `, ${warming} still warming up` : ""}</li>
        <li className="flex items-center gap-2"><Flame size={14} className="text-muted" />Warmup stays on in {providers[c.provider].name}; we only send through ready inboxes</li>
        <li className="flex items-center gap-2"><Webhook size={14} className="text-muted" />Webhooks added for replies, labels, bounces and unibox sends</li>
      </ul>
      <div>
        <div className="mb-1.5 text-[13px] font-medium">Where should prospects go by default?</div>
        <div className="space-y-1.5" role="radiogroup">
          {[{ id: "starter", name: starterCampaign().name, sub: "We create it: 3 emails over 7 days, built around the audit link", rec: true }, ...c.campaigns.filter((x) => !x.fromOpenMarko).map((x) => ({ id: x.id, name: x.name, sub: `${x.steps.length} steps · ${x.leads} leads · ${x.status}${x.usesAuditUrl ? "" : " · doesn't use {{audit_url}}"}`, rec: false }))].map((o) => (
            <button key={o.id} role="radio" aria-checked={choice === o.id} onClick={() => setChoice(o.id)} className={cn("flex w-full items-start gap-2.5 rounded-lg border px-3 py-2.5 text-left", choice === o.id ? "border-ink" : "border-line hover:border-line-strong")}>
              <span className={cn("mt-0.5 grid size-4 shrink-0 place-items-center rounded-full border", choice === o.id ? "border-ink" : "border-line-strong")}>{choice === o.id && <span className="size-2 rounded-full bg-ink" />}</span>
              <span className="min-w-0"><span className="flex items-center gap-2 text-[13.5px] font-medium">{o.name}{o.rec && <Badge tone="accent">Recommended</Badge>}</span><span className="block text-[12.5px] text-muted">{o.sub}</span></span>
            </button>
          ))}
        </div>
      </div>
      <Button variant="primary" className="w-full" onClick={finish}>Done</Button>
    </div>
  );
}

export function ConnectSequencerModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const st = useOutreach();
  return <Modal open={open} onClose={onClose} title={st.connection ? "Default campaign" : "Connect a sequencer"} width={520}><ConnectFlow onDone={onClose} /></Modal>;
}

// ---------- Send ----------

export type SendItem = { p: Prospect; o: Opportunity };

/** Review and send selected prospects to a campaign. Connects a sequencer first if there isn't one. */
export function SendToCampaignModal({ open, onClose, items, market, qsKey, onSent }: { open: boolean; onClose: () => void; items: SendItem[]; market: Market; qsKey: string; onSent: (msg: string) => void }) {
  const outreachOn = useOn("outreach");
  const st = useOutreach();
  const [campaignId, setCampaignId] = useState<string>("");
  const [i, setI] = useState(0);
  const [stepIx, setStepIx] = useState(0);
  const [oneClick, setOneClick] = useState(false);
  // Stay on the connect flow until its last step, even though the connection exists by then.
  const [connecting, setConnecting] = useState(false);
  const path = (p: Prospect) => `/prospects/${p.id}${qsKey}`;

  const sorted = useMemo(() => {
    const ready: SendItem[] = [], skipped: { p: Prospect; why: string }[] = [];
    for (const it of items) {
      const c = it.p.contact;
      const lead = leadFor(st, path(it.p));
      if (lead) skipped.push({ p: it.p, why: `Already in “${lead.campaignName}”` });
      else if (!c.email) skipped.push({ p: it.p, why: "No email found" });
      else if (st.rules.verifiedOnly && c.emailStatus !== "verified") skipped.push({ p: it.p, why: `Email is ${c.emailStatus}` });
      else ready.push(it);
    }
    return { ready, skipped };
  }, [items, st]);

  if (!open) return null;
  const name = providerName(st);
  if (!st.connection || connecting) return <Modal open onClose={onClose} title="Connect a sequencer" width={520}><ConnectFlow onConnect={() => setConnecting(true)} onDone={() => setConnecting(false)} /></Modal>;

  const camp = campaignOf(st, campaignId || st.rules.defaultCampaign) ?? st.connection.campaigns[0];
  const { ready, skipped } = sorted;
  const cur = ready[Math.min(i, ready.length - 1)];
  const preview = cur && leadFrom(cur.p, cur.o, market, path(cur.p), false);
  const step = camp?.steps[Math.min(stepIx, (camp?.steps.length ?? 1) - 1)];
  const inboxes = st.connection.inboxes.filter((x) => x.status === "ready");
  const free = inboxes.reduce((a, x) => a + x.dailyLimit - x.sentToday, 0);

  const send = () => {
    if (!camp) return;
    const n = pushLeads(ready.flatMap(({ p, o }) => leadFrom(p, o, market, path(p)) ?? []), camp.id);
    if (oneClick) setRules({ review: false, defaultCampaign: camp.id });
    onSent(`${n} sent to “${camp.name}” in ${name}`);
    onClose();
  };

  if (!outreachOn) return null;
  return (
    <Modal open onClose={onClose} title={`Send to ${name}`} width={640} footer={
      <>
        <label className="mr-auto flex items-center gap-2 text-[12.5px] text-muted"><Checkbox checked={oneClick} onChange={setOneClick} />Next time, send to this campaign in one click</label>
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button variant="primary" icon={<Send size={13} />} disabled={!ready.length || !camp} onClick={send}>Send {ready.length || ""} to {name}</Button>
      </>
    }>
      <div className="space-y-5">
        <label className="block">
          <span className="mb-1.5 block text-[12.5px] font-medium text-muted">Campaign</span>
          <select value={camp?.id ?? ""} onChange={(e) => { if (e.target.value === "__new") { setCampaignId(createStarterCampaign()?.id ?? ""); } else setCampaignId(e.target.value); setStepIx(0); }} className={field}>
            {st.connection.campaigns.map((c) => <option key={c.id} value={c.id}>{c.name} · {c.steps.length} steps{c.status !== "active" ? ` · ${c.status}` : ""}</option>)}
            {!st.connection.campaigns.some((c) => c.fromOpenMarko) && <option value="__new">+ Create “{starterCampaign().name}” (3 steps)</option>}
          </select>
          {camp && !camp.usesAuditUrl && <p className="mt-1.5 flex items-start gap-1.5 text-[12.5px] text-warn"><AlertTriangle size={13} className="mt-0.5 shrink-0" />This campaign's emails don't use {"{{audit_url}}"}, so prospects won't get their audit link.</p>}
        </label>

        <div className="flex flex-wrap items-center gap-2 text-[13px]">
          <Badge tone="good"><Check size={11} /> {ready.length} ready</Badge>
          {skipped.length > 0 && <span className="text-muted">{skipped.length} skipped:</span>}
          {Object.entries(skipped.reduce<Record<string, number>>((a, s) => ({ ...a, [s.why]: (a[s.why] ?? 0) + 1 }), {})).map(([why, n]) => <Badge key={why}>{n} · {why}</Badge>)}
        </div>

        {preview && step && (
          <section className="rounded-xl border border-line">
            <div className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-2.5">
              <div className="flex gap-1">
                {camp.steps.map((s, k) => <button key={k} onClick={() => setStepIx(k)} className={cn("h-7 rounded-md px-2.5 text-[12.5px]", stepIx === k ? "bg-active font-medium" : "text-muted hover:bg-hover")}>Day {s.day}</button>)}
              </div>
              {ready.length > 1 && (
                <div className="ml-auto flex items-center gap-1 text-[12.5px] text-muted">
                  <button aria-label="Previous prospect" onClick={() => setI((i - 1 + ready.length) % ready.length)} className="rounded p-1 hover:bg-hover"><ChevronLeft size={14} /></button>
                  <span className="num max-w-48 truncate">{cur.p.name}</span>
                  <button aria-label="Next prospect" onClick={() => setI((i + 1) % ready.length)} className="rounded p-1 hover:bg-hover"><ChevronRight size={14} /></button>
                </div>
              )}
            </div>
            <div className="px-4 py-3 text-[13px]">
              <div className="mb-2 grid grid-cols-[52px_1fr] gap-y-0.5 text-[12.5px]">
                <span className="text-subtle">To</span><span className="truncate">{preview.owner ?? preview.company} &lt;{preview.email}&gt;</span>
                <span className="text-subtle">From</span><span className="truncate text-muted">Rotates across {inboxes.length} ready inboxes</span>
                <span className="text-subtle">Subject</span><span className="font-medium">{render(step.subject, preview.vars)}</span>
              </div>
              <pre className="max-h-56 overflow-y-auto rounded-lg bg-bg p-3 font-sans text-[13px] whitespace-pre-wrap">{render(step.body, preview.vars)}</pre>
              <p className="mt-2 text-[12px] text-subtle">Each prospect gets their own audit link. Edit the wording in {name}; these are its templates filled with OpenMarko's numbers.</p>
            </div>
          </section>
        )}

        <p className="text-[12.5px] text-muted">{inboxes.length} inboxes ready · {free} sends left today. {name} spaces them out within the campaign's send window and stops the sequence when someone replies.</p>
      </div>
    </Modal>
  );
}

/**
 * One prospect, one click: sends straight to the default campaign once you've
 * turned off review; otherwise opens the send dialog. Shows the lead's status once sent.
 */
export function SendToCampaignButton({ p, o, market, qsKey, onSent, className, compact }: { p: Prospect; o: Opportunity; market: Market; qsKey: string; onSent: (msg: string) => void; className?: string; compact?: boolean }) {
  const outreachOn = useOn("outreach");
  const st = useOutreach();
  const [open, setOpen] = useState(false);
  const path = `/prospects/${p.id}${qsKey}`;
  const lead = leadFor(st, path);
  // Compact buttons sit in table rows, where a status column already shows the lead.
  if (lead) return compact ? null : <span className={className}><LeadBadge lead={lead} /></span>;
  const camp = campaignOf(st, st.rules.defaultCampaign);
  const quick = st.connection && camp && !st.rules.review;
  const click = () => {
    if (!quick) return setOpen(true);
    const l = leadFrom(p, o, market, path);
    if (l && pushLeads([l], camp.id)) onSent(`${p.name} sent to “${camp.name}”`);
  };
  if (!outreachOn) return null;
  return (
    <>
      {compact ? (
        <Button className={className} size="sm" variant="ghost" icon={<Send size={13} />} disabled={!p.contact.email} aria-label={`Send ${p.name} to a campaign`} title={p.contact.email ? (quick ? `Send to ${camp.name}` : "Send to campaign") : "No email found"} onClick={(e) => { e.stopPropagation(); click(); }} />
      ) : (
        <Button className={className} variant="primary" icon={<Send size={13} />} disabled={!p.contact.email} title={p.contact.email ? undefined : "No email found for this business"} onClick={click}>
          {quick ? `Send to ${camp.name}` : "Send to campaign"}
        </Button>
      )}
      <SendToCampaignModal open={open} onClose={() => setOpen(false)} items={[{ p, o }]} market={market} qsKey={qsKey} onSent={onSent} />
    </>
  );
}

export function SuggestedTag() {
  return <span className="inline-flex items-center gap-1 text-[12px] text-accent"><Sparkles size={12} /> Drafted by Marko in your voice</span>;
}
