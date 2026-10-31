import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router";
import { ArrowLeft, CalendarCheck, Eye, FileSearch, Inbox, Plug, Send, Settings2, ThumbsDown, ThumbsUp, Target } from "lucide-react";
import { Badge, Button, Card, Empty, PageHeader, Segmented, Stat, Tabs, Textarea, cn, useToast } from "../components/ui";
import { ConnectSequencerModal, LeadBadge, ProviderMark, SuggestedTag } from "../components/Outreach";
import { providers } from "../data/sequencers";
import { markRead, providerName, reply, setStatus, statusMeta, suggestReply, useOutreach, type Lead, type LeadStatus } from "../lib/outreach";
import { shareFor, useShares, type Share } from "../lib/shares";
import { timeAgo } from "../lib/runs";
import { Can } from "../components/Can";

type Tab = "replies" | "leads";
const replied = (l: Lead) => l.thread.some((m) => m.from === "them");
const waiting = (l: Lead) => l.thread[l.thread.length - 1]?.from === "them" && l.status !== "not_interested";

/**
 * Outreach: every prospect handed to the sequencer and what came back. The
 * Replies tab is the unibox: answering here sends through the sequencer from
 * the inbox the thread started in, so the conversation stays in one place.
 */
export default function Outreach() {
  const st = useOutreach();
  const shares = useShares();
  const [params, setParams] = useSearchParams();
  const [connectOpen, setConnectOpen] = useState(false);
  const { toast, node } = useToast();
  const tab: Tab = params.get("tab") === "leads" ? "leads" : "replies";
  const selected = st.leads.find((l) => l.auditPath === params.get("lead")) ?? null;
  const name = providerName(st);
  const go = (patch: Record<string, string | null>) => {
    const p = new URLSearchParams(params);
    Object.entries(patch).forEach(([k, v]) => (v === null ? p.delete(k) : p.set(k, v)));
    setParams(p, { replace: true });
  };

  const sent = st.leads.filter((l) => l.status !== "queued");
  const opened = st.leads.filter((l) => (shareFor(shares, l.auditPath)?.views.length ?? 0) > 0);
  const answered = st.leads.filter(replied);
  const won = st.leads.filter((l) => l.status === "interested" || l.status === "booked");
  const pct = (n: number) => (sent.length ? `${Math.round((n / sent.length) * 100)}%` : "—");

  return (
    <>
      <PageHeader
        title="Outreach"
        sub={st.connection ? `Prospects you've sent to ${name} and what came back. Replies you send here go out from the same inbox, through ${name}.` : "Connect your sequencer to send audits to prospects in one click and answer replies here."}
        actions={
          <>
            {st.connection && (
              <Link to="/settings/outreach" className="inline-flex h-9 items-center gap-2 rounded-lg border border-line bg-surface px-3 text-[13px] shadow-card hover:bg-hover">
                <ProviderMark id={st.connection.provider} size={20} />{st.connection.workspace}<Settings2 size={13} className="text-muted" />
              </Link>
            )}
            <Link to="/prospects"><Button icon={<Target size={14} />}>Find prospects</Button></Link>
          </>
        }
      />

      {!st.connection && (
        <Card className="mb-6 flex flex-col items-start gap-4 sm:flex-row">
          <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-accent-soft text-accent"><Plug size={20} /></span>
          <div className="min-w-0 flex-1">
            <h2 className="text-[16px] font-medium">Connect your sequencer</h2>
            <p className="mt-1 text-[13.5px] text-muted">{Object.values(providers).map((p) => p.name).join(", ")}. Paste an API key and you get:</p>
            <ul className="mt-2 list-disc space-y-0.5 pl-5 text-[13.5px]">
              <li>“Send to campaign” on every prospect and audit, with their audit link and numbers filled in</li>
              <li>Replies from every sending inbox in one place, with a draft answer ready</li>
              <li>Who opened their audit, next to who replied</li>
            </ul>
            <Button variant="primary" className="mt-4" icon={<Plug size={14} />} onClick={() => setConnectOpen(true)}>Connect a sequencer</Button>
          </div>
        </Card>
      )}

      {st.leads.length > 0 && (
        <>
          <Card className="mb-6 grid grid-cols-2 gap-5 sm:grid-cols-4">
            <Stat label="Sent" value={sent.length} />
            <Stat label="Opened their audit" value={opened.length} delta={<span className="text-[12.5px] text-muted">{pct(opened.length)}</span>} />
            <Stat label="Replied" value={answered.length} delta={<span className="text-[12.5px] text-muted">{pct(answered.length)}</span>} />
            <Stat label="Interested or booked" value={won.length} delta={<span className="text-[12.5px] text-muted">{pct(won.length)}</span>} />
          </Card>
          <div className="mb-4">
            <Tabs<Tab>
              value={tab}
              onChange={(t) => go({ tab: t === "replies" ? null : t })}
              tabs={[{ id: "replies", label: "Replies", count: st.leads.filter(waiting).length }, { id: "leads", label: "All leads", count: st.leads.length }]}
            />
          </div>
          {tab === "replies" ? <Unibox selected={selected} onSelect={(l) => go({ lead: l?.auditPath ?? null })} shares={shares} toast={toast} /> : <LeadTable shares={shares} />}
        </>
      )}

      {st.connection && !st.leads.length && (
        <Card><Empty icon={<Send size={28} />} title="Nothing sent yet" sub="Select prospects in Prospecting, or open an audit, and choose Send to campaign." action={<Link to="/prospects"><Button variant="primary">Open Prospecting</Button></Link>} /></Card>
      )}

      <ConnectSequencerModal open={connectOpen} onClose={() => setConnectOpen(false)} />
      {node}
    </>
  );
}

function AuditViews({ share }: { share: Share | undefined }) {
  const v = share?.views ?? [];
  if (!v.length) return <span className="text-[12.5px] text-subtle">Hasn't opened the audit</span>;
  const last = v[v.length - 1];
  return <span className="inline-flex items-center gap-1 text-[12.5px] text-good"><Eye size={12} />Opened the audit {v.length}× · last {timeAgo(last.at)}</span>;
}

function Unibox({ selected, onSelect, shares, toast }: { selected: Lead | null; onSelect: (l: Lead | null) => void; shares: Share[]; toast: (m: string) => void }) {
  const st = useOutreach();
  const [filter, setFilter] = useState<"waiting" | "replied" | "all">(selected && !replied(selected) ? "all" : "waiting");
  const list = [...st.leads].filter(filter === "waiting" ? waiting : filter === "replied" ? replied : () => true).sort((a, b) => b.lastAt - a.lastAt);
  // Desktop opens the newest thread; phones start on the list.
  useEffect(() => { if (!selected && list[0] && window.matchMedia("(min-width: 1024px)").matches) onSelect(list[0]); }, []);
  useEffect(() => { if (selected?.unread) markRead(selected.auditPath); }, [selected?.auditPath]);

  return (
    <div className="grid gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
      <Card pad={false} className={cn("self-start", selected && "hidden lg:block")}>
        <div className="border-b border-line p-2.5">
          <Segmented label="Show" value={filter} onChange={setFilter} options={[{ id: "waiting", label: "Needs reply" }, { id: "replied", label: "Replied" }, { id: "all", label: "Everyone" }]} />
        </div>
        {list.length ? (
          <ul className="max-h-[560px] overflow-y-auto">
            {list.map((l) => {
              const last = l.thread[l.thread.length - 1];
              return (
                <li key={l.auditPath}>
                  <button onClick={() => onSelect(l)} className={cn("block w-full border-b border-line px-4 py-3 text-left last:border-0", selected?.auditPath === l.auditPath ? "bg-active" : "hover:bg-hover")}>
                    <div className="flex items-center gap-2">
                      {l.unread && <span className="size-2 shrink-0 rounded-full bg-accent" aria-label="Unread" />}
                      <span className={cn("min-w-0 flex-1 truncate text-[13.5px]", l.unread && "font-medium")}>{l.company}</span>
                      <span className="shrink-0 text-[12px] text-subtle">{timeAgo(l.lastAt)}</span>
                    </div>
                    <div className="mt-0.5 truncate text-[12.5px] text-muted">{last ? `${last.from === "us" ? "You: " : ""}${last.body.split("\n").find((x) => x.trim()) ?? ""}` : "Queued"}</div>
                    <div className="mt-1.5 flex items-center gap-1.5"><Badge tone={statusMeta[l.status].tone}>{statusMeta[l.status].label}</Badge>{(shareFor(shares, l.auditPath)?.views.length ?? 0) > 0 && <Badge tone="good"><Eye size={10} />{shareFor(shares, l.auditPath)!.views.length}</Badge>}</div>
                  </button>
                </li>
              );
            })}
          </ul>
        ) : <p className="px-4 py-10 text-center text-[13px] text-muted">{filter === "waiting" ? "You're all caught up." : "No replies yet."}</p>}
      </Card>
      {selected ? <Thread key={selected.auditPath} l={selected} share={shareFor(shares, selected.auditPath)} onBack={() => onSelect(null)} toast={toast} /> : <Card className="hidden lg:block"><Empty icon={<Inbox size={28} />} title="Pick a conversation" sub="Replies from every sending inbox land here." /></Card>}
    </div>
  );
}

function Thread({ l, share, onBack, toast }: { l: Lead; share: Share | undefined; onBack: () => void; toast: (m: string) => void }) {
  const st = useOutreach();
  const theirTurn = waiting(l);
  const [draft, setDraft] = useState(theirTurn ? suggestReply(l, st.rules) : "");
  const [drafted, setDrafted] = useState(theirTurn);
  const label = (s: LeadStatus, msg: string) => { setStatus(l.auditPath, s); toast(msg); };
  const send = () => {
    if (!draft.trim()) return;
    reply(l.auditPath, draft.trim());
    setDraft(""); setDrafted(false);
    toast(`Sent from ${l.thread[0]?.inbox ?? "your inbox"}`);
  };

  return (
    <Card pad={false} className="min-w-0 self-start">
      <div className="border-b border-line px-5 py-4">
        <button onClick={onBack} className="mb-2 inline-flex items-center gap-1 text-[12.5px] text-muted hover:text-fg lg:hidden"><ArrowLeft size={13} /> All conversations</button>
        <div className="flex flex-wrap items-start gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2"><h2 className="text-[16px] font-medium">{l.company}</h2><Badge tone={statusMeta[l.status].tone}>{statusMeta[l.status].label}</Badge></div>
            <div className="truncate text-[12.5px] text-muted">{l.owner ? `${l.owner} · ` : ""}{l.email} · {l.campaignName}{l.status === "sent" ? ` · step ${l.step}` : ""}</div>
            <div className="mt-1"><AuditViews share={share} /></div>
          </div>
          <Link to={l.auditPath}><Button size="sm" icon={<FileSearch size={13} />}>Open audit</Button></Link>
        </div>
        <div className="mt-3 flex flex-wrap gap-1.5">
          <Button size="sm" variant={l.status === "interested" ? "primary" : "secondary"} icon={<ThumbsUp size={12} />} onClick={() => label("interested", "Marked interested")}>Interested</Button>
          <Button size="sm" variant={l.status === "booked" ? "primary" : "secondary"} icon={<CalendarCheck size={12} />} onClick={() => label("booked", "Marked as booked. The sequence is stopped.")}>Meeting booked</Button>
          <Button size="sm" variant={l.status === "not_interested" ? "primary" : "secondary"} icon={<ThumbsDown size={12} />} onClick={() => label("not_interested", "Marked not interested")}>Not interested</Button>
        </div>
      </div>

      <ol className="space-y-3 px-5 py-4">
        {l.thread.length === 0 && <li className="text-[13px] text-muted">Queued. The first email goes out in the campaign's next send window.</li>}
        {l.thread.map((m, k) => (
          <li key={k} className={cn("rounded-xl border p-3.5", m.from === "them" ? "border-accent/30 bg-accent-soft/40" : "border-line bg-bg")}>
            <div className="mb-1.5 flex flex-wrap items-baseline gap-x-2 text-[12.5px]">
              <span className="font-medium">{m.from === "them" ? l.owner ?? l.company : "You"}</span>
              <span className="truncate text-subtle">{m.from === "them" ? l.email : m.inbox}</span>
              {m.step && <Badge>Step {m.step}</Badge>}
              <span className="ml-auto text-subtle">{timeAgo(m.at)}</span>
            </div>
            <div className="mb-1 text-[12.5px] text-muted">{m.subject}</div>
            <p className="text-[13.5px] whitespace-pre-wrap">{m.body}</p>
          </li>
        ))}
      </ol>

      <div className="border-t border-line px-5 py-4">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <span className="text-[12.5px] font-medium text-muted">Reply from {l.thread[0]?.inbox ?? "your inbox"}</span>
          {drafted ? <SuggestedTag /> : <button onClick={() => { setDraft(suggestReply(l, st.rules)); setDrafted(true); }} className="text-[12.5px] text-muted underline decoration-line-strong underline-offset-2 hover:text-fg">Draft a reply</button>}
        </div>
        <Textarea value={draft} onChange={(e) => { setDraft(e.target.value); setDrafted(false); }} rows={6} placeholder="Write a reply…" aria-label="Reply" />
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <Button size="sm" variant="ghost" icon={<CalendarCheck size={12} />} onClick={() => setDraft((d) => `${d}${d && !d.endsWith("\n") ? "\n\n" : ""}${st.rules.bookingUrl}`)}>Insert booking link</Button>
          <Can I="send" on="outreach"><Button className="ml-auto" variant="primary" icon={<Send size={13} />} disabled={!draft.trim()} onClick={send}>Send reply</Button></Can>
        </div>
      </div>
    </Card>
  );
}

function LeadTable({ shares }: { shares: Share[] }) {
  const st = useOutreach();
  const rows = [...st.leads].sort((a, b) => b.lastAt - a.lastAt);
  return (
    <Card pad={false} className="overflow-x-auto">
      <table className="w-full min-w-[820px] text-[13.5px]">
        <thead className="border-b border-line text-left text-[12.5px] text-muted">
          <tr>
            <th className="px-5 py-2.5 font-normal">Business</th>
            <th className="px-3 py-2.5 font-normal">Campaign</th>
            <th className="px-3 py-2.5 font-normal">Status</th>
            <th className="px-3 py-2.5 font-normal">Audit</th>
            <th className="px-3 py-2.5 font-normal">Last activity</th>
            <th className="pr-5" />
          </tr>
        </thead>
        <tbody>
          {rows.map((l) => (
            <tr key={l.auditPath} className="border-b border-line last:border-0 hover:bg-hover">
              <td className="px-5 py-3"><div className="font-medium">{l.company}</div><div className="text-[12px] text-muted">{l.owner ? `${l.owner} · ` : ""}{l.email}</div></td>
              <td className="px-3 py-3 text-muted">{l.campaignName}</td>
              <td className="px-3 py-3"><LeadBadge lead={l} /></td>
              <td className="px-3 py-3"><AuditViews share={shareFor(shares, l.auditPath)} /></td>
              <td className="px-3 py-3 text-muted">{timeAgo(l.lastAt)}</td>
              <td className="pr-5 text-right"><Link to={l.auditPath} className="inline-flex h-7 items-center rounded-md border border-line bg-surface px-2.5 text-[12.5px] font-medium hover:bg-hover">Audit</Link></td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}
