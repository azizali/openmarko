import { useEffect, useMemo } from "react";
import { useSearchParams } from "react-router";
import { ArrowLeft, CalendarCheck, Inbox as InboxIcon, Phone, PhoneCall, UserRound } from "lucide-react";
import { Badge, Button, Card, Empty, PageHeader, Segmented, cn, useToast } from "../components/ui";
import { ChannelIcon, Composer, ContactDrawer, StageBadge, Timeline } from "../components/Crm";
import { fillFields, type Channel } from "../data/contacts";
import { contactOf, conversations, eventsOf, markRead, openTasks, setStage, skipTask, startedText, useCrm, type Conversation } from "../lib/crm";
import { timeAgo } from "../lib/runs";
import { isOn } from "../lib/features";

type Filter = "waiting" | "calls" | "all";
type ChFilter = Channel | "any";

/**
 * Inbox: every text, email and call with every contact, newest first. One
 * thread per person whatever the channel, so a lead who texted, then emailed,
 * then called reads as one conversation. Calls to make are the call tasks
 * workflows create, with the script to read.
 */
export default function Inbox() {
  const st = useCrm();
  const [params, setParams] = useSearchParams();
  const { toast, node } = useToast();
  const go = (patch: Record<string, string | null>) => { const p = new URLSearchParams(params); Object.entries(patch).forEach(([k, v]) => (v === null ? p.delete(k) : p.set(k, v))); setParams(p, { replace: true }); };
  const filter: Filter = (params.get("f") as Filter) ?? "waiting";
  const ch = (params.get("ch") ?? "any") as ChFilter;
  const sel = params.get("c");
  const details = params.get("details") === "1";

  const convs = useMemo(() => conversations(st), [st]);
  const tasks = openTasks(st);
  const list = convs.filter((c) => (filter === "waiting" ? c.waiting : true) && (ch === "any" || c.channels.includes(ch)));
  const contact = sel ? contactOf(st, sel) : undefined;
  // Desktop opens the top conversation; phones start on the list.
  useEffect(() => {
    if (sel || !window.matchMedia("(min-width: 1024px)").matches) return;
    const first = filter === "calls" ? tasks[0]?.contactId : list[0]?.contact.id;
    if (first) go({ c: first });
  }, [filter]);
  useEffect(() => { if (sel) markRead(sel); }, [sel]);

  const waitingN = convs.filter((c) => c.waiting).length;
  const overdue = tasks.filter((t) => t.due < Date.now()).length;

  return (
    <>
      <PageHeader title="Inbox" sub="Texts, emails and calls with every contact, in one place. Replies go out on the channel you pick, from your number or your domain." />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[340px_minmax(0,1fr)]">
        <Card pad={false} className={cn("self-start", contact && "hidden lg:block")}>
          <div className="space-y-2 overflow-x-auto border-b border-line p-2.5">
            <Segmented<Filter> label="Show" value={filter} onChange={(f) => go({ f: f === "waiting" ? null : f, c: null })}
              options={[{ id: "waiting", label: `Needs reply${waitingN ? ` · ${waitingN}` : ""}` }, { id: "calls", label: <span className={cn(overdue > 0 && "text-bad")}>Calls to make{tasks.length ? ` · ${tasks.length}` : ""}</span> }, { id: "all", label: "All" }]} />
            {filter !== "calls" && (
              <div className="flex gap-1">
                {(["any", "sms", "email", "call"] as ChFilter[]).filter((x) => (x !== "sms" && x !== "email") || isOn(x)).map((x) => (
                  <button key={x} onClick={() => go({ ch: x === "any" ? null : x })} aria-pressed={ch === x} className={cn("inline-flex h-7 items-center gap-1 rounded-full border px-2.5 text-[12px]", ch === x ? "border-ink bg-ink text-on-ink" : "border-line text-muted hover:text-fg")}>
                    {x !== "any" && <ChannelIcon ch={x} size={11} />}{x === "any" ? "Every channel" : x === "sms" ? "Texts" : x === "email" ? "Email" : "Calls"}
                  </button>
                ))}
              </div>
            )}
          </div>
          {filter === "calls" ? (
            tasks.length ? (
              <ul className="max-h-[620px] overflow-y-auto">
                {tasks.map((t) => {
                  const c = contactOf(st, t.contactId);
                  if (!c) return null;
                  const late = t.due < Date.now();
                  return (
                    <li key={t.id}>
                      <button onClick={() => go({ c: c.id })} className={cn("block w-full border-b border-line px-4 py-3 text-left last:border-0", sel === c.id ? "bg-active" : "hover:bg-hover")}>
                        <div className="flex items-center gap-2"><PhoneCall size={13} className={late ? "text-bad" : "text-muted"} /><span className="min-w-0 flex-1 truncate text-[13.5px] font-medium">{c.name}</span><span className={cn("shrink-0 text-[12px]", late ? "text-bad" : "text-subtle")}>{late ? `due ${timeAgo(t.due)}` : `in ${Math.max(1, Math.round((t.due - Date.now()) / 3_600_000))}h`}</span></div>
                        <div className="mt-0.5 truncate text-[12.5px] text-muted">{t.reason}</div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            ) : <p className="px-4 py-10 text-center text-[13px] text-muted">No calls to make. Workflows add them here when a lead needs a call.</p>
          ) : list.length ? (
            <ul className="max-h-[620px] overflow-y-auto">{list.map((c) => <Row key={c.contact.id} c={c} on={sel === c.contact.id} onClick={() => go({ c: c.contact.id })} />)}</ul>
          ) : <p className="px-4 py-10 text-center text-[13px] text-muted">{filter === "waiting" ? "You're all caught up." : "Nothing here yet."}</p>}
        </Card>

        {contact ? (
          <Card pad={false} className="min-w-0 self-start">
            <div className="border-b border-line px-5 py-4">
              <button onClick={() => go({ c: null })} className="mb-2 inline-flex items-center gap-1 text-[12.5px] text-muted hover:text-fg lg:hidden"><ArrowLeft size={13} /> All conversations</button>
              <div className="flex flex-wrap items-start gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2"><h2 className="text-[16px] font-medium">{contact.name}</h2><StageBadge stage={contact.stage} /></div>
                  <div className="truncate text-[12.5px] text-muted">{[contact.phone, contact.email, contact.sourceDetail].filter(Boolean).join(" · ")}</div>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {contact.stage !== "booked" && contact.stage !== "patient" && <Button size="sm" icon={<CalendarCheck size={12} />} onClick={() => { const st2 = setStage([contact.id], "booked"); toast(`Marked booked. The ad gets the credit.${startedText(st2)}`); }}>Booked</Button>}
                  <Button size="sm" icon={<UserRound size={12} />} onClick={() => go({ details: "1" })}>Details</Button>
                </div>
              </div>
            </div>
            {tasks.filter((t) => t.contactId === contact.id).map((t) => (
              <div key={t.id} className="flex flex-wrap items-start gap-3 border-b border-line bg-warn-soft/50 px-5 py-3">
                <Phone size={15} className="mt-0.5 shrink-0 text-warn" />
                <div className="min-w-0 flex-1">
                  <div className="text-[13px] font-medium">Call {contact.phone} <span className="font-normal text-muted">· {t.reason}</span></div>
                  <p className="mt-1 text-[13px] text-muted italic">“{fillFields(t.script, contact)}”</p>
                  <p className="mt-1 text-[12px] text-subtle">Log the call below with Call. That finishes the task.</p>
                </div>
                <Button size="sm" variant="ghost" onClick={() => { skipTask(t.id); toast("Skipped"); }}>Skip</Button>
              </div>
            ))}
            <div className="max-h-[440px] overflow-y-auto px-5 py-4"><Timeline c={contact} events={eventsOf(st, contact.id)} follow /></div>
            <Composer key={contact.id + (tasks.some((t) => t.contactId === contact.id) ? "t" : "")} c={contact} events={eventsOf(st, contact.id)} onDone={toast} call={tasks.some((t) => t.contactId === contact.id)} />
          </Card>
        ) : <Card className="hidden lg:block"><Empty icon={<InboxIcon size={28} />} title="Pick a conversation" sub="Texts, emails and calls from every contact land here." /></Card>}
      </div>
      <ContactDrawer id={details && sel ? sel : null} onClose={() => go({ details: null })} toast={toast} />
      {node}
    </>
  );
}

function Row({ c, on, onClick }: { c: Conversation; on: boolean; onClick: () => void }) {
  const l = c.last;
  const text = l.kind === "call" ? (l.call?.result === "missed" ? "Missed call" : l.dir === "in" ? "Called in" : l.body) : `${l.dir === "out" ? `${l.by && l.by !== "You" ? l.by : "You"}: ` : ""}${l.body.replace(/\s+/g, " ").trim()}`;
  return (
    <li>
      <button onClick={onClick} className={cn("block w-full border-b border-line px-4 py-3 text-left last:border-0", on ? "bg-active" : "hover:bg-hover")}>
        <div className="flex items-center gap-2">
          {c.unread > 0 && <span className="size-2 shrink-0 rounded-full bg-accent" aria-label="Unread" />}
          <span className={cn("min-w-0 flex-1 truncate text-[13.5px]", c.unread > 0 && "font-medium")}>{c.contact.name}</span>
          <span className="shrink-0 text-[12px] text-subtle">{timeAgo(l.at)}</span>
        </div>
        <div className={cn("mt-0.5 flex items-center gap-1.5 text-[12.5px]", l.kind === "call" && l.call?.result === "missed" ? "text-bad" : "text-muted")}><ChannelIcon ch={l.kind as Channel} size={12} className="shrink-0" /><span className="truncate">{text}</span></div>
        <div className="mt-1.5 flex items-center gap-1.5"><StageBadge stage={c.contact.stage} />{c.waiting && <Badge tone="accent">Your turn</Badge>}</div>
      </button>
    </li>
  );
}
