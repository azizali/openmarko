import { useMemo, useState, type ReactNode } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { ArrowDown, ArrowUp, ChevronDown, ChevronsUpDown, Download, Kanban, List, Mail, MessageSquareText, Tag, Trash2, Upload, UserPlus, Workflow as WorkflowIcon } from "lucide-react";
import { Button, Card, Checkbox, Modal, PageHeader, SearchInput, Segmented, Select, cn, fmt, useToast } from "../components/ui";
import { AddContactModal, ChannelIcon, ContactDrawer, Reach, StageBadge } from "../components/Crm";
import { segments, sources, stageOf, stages, tagOptions, type Contact, type SegmentId, type Source, type Stage } from "../data/contacts";
import { addTag, enroll, importFromBooking, inSegment, lastTouch, needsReply, newCampaign, removeContacts, setStage, startedText, useCrm } from "../lib/crm";
import { useAds } from "../lib/ads";
import { timeAgo } from "../lib/runs";
import { isOn, useFeatures } from "../lib/features";
import { Can } from "../components/Can";

type View = "list" | "pipeline";
type Col = "name" | "stage" | "source" | "last" | "value";
const PAGE = 50;
const stageRank = Object.fromEntries(stages.map((s, i) => [s.id, i])) as Record<Stage, number>;
const shortDate = (ms: number) => new Date(ms).toLocaleDateString("en-US", { month: "short", day: "numeric" });

/**
 * Contacts is the CRM: everyone who has called, filled a form, booked or
 * visited. Lists on the left are saved filters (who's due for a cleaning, new
 * ad leads); the pipeline is the same people by stage. Select people to text
 * or email them, start a workflow, or move them along.
 */
export default function Contacts() {
  const st = useCrm();
  const ads = useAds();
  const flags = useFeatures();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const { toast, node } = useToast();
  const seg = (params.get("list") as SegmentId) ?? "all";
  const view: View = params.get("view") === "pipeline" ? "pipeline" : "list";
  const open = params.get("c");
  const go = (patch: Record<string, string | null>) => { const p = new URLSearchParams(params); Object.entries(patch).forEach(([k, v]) => (v === null ? p.delete(k) : p.set(k, v))); setParams(p, { replace: true }); };
  const [q, setQ] = useState("");
  const [source, setSource] = useState<Source | "ads" | "all">("all");
  const [stage, setStageF] = useState<Stage | null>(null);
  const [sort, setSort] = useState<{ col: Col; dir: "asc" | "desc" }>({ col: "last", dir: "desc" });
  const [sel, setSel] = useState<string[]>([]);
  const [shown, setShown] = useState(PAGE);
  const [adding, setAdding] = useState(false);
  const [importing, setImporting] = useState(false);

  const counts = useMemo(() => Object.fromEntries(segments.map((s) => [s.id, inSegment(st, s.id).length])) as Record<SegmentId, number>, [st]);
  const touch = useMemo(() => new Map(st.contacts.map((c) => [c.id, lastTouch(st, c.id)])), [st]);
  const rows = useMemo(() => {
    const term = q.trim().toLowerCase();
    const base = inSegment(st, seg).filter((c) =>
      (!term || [c.name, c.email ?? "", c.phone ?? "", ...c.tags].some((x) => x.toLowerCase().includes(term))) &&
      (source === "all" || (source === "ads" ? sources[c.source].ad : c.source === source)) &&
      (view === "pipeline" || !stage || c.stage === stage));
    const val = (c: Contact): number | string => {
      switch (sort.col) {
        case "name": return c.name;
        case "stage": return stageRank[c.stage];
        case "source": return sources[c.source].label;
        case "last": return touch.get(c.id)?.at ?? c.createdAt;
        case "value": return c.value;
      }
    };
    return [...base].sort((a, b) => { const x = val(a), y = val(b); const d = typeof x === "string" ? x.localeCompare(y as string) : x - (y as number); return sort.dir === "asc" ? d : -d; });
  }, [st, seg, q, source, stage, sort, view, touch]);

  const picked = rows.filter((c) => sel.includes(c.id));
  const allOn = rows.length > 0 && rows.slice(0, shown).every((c) => sel.includes(c.id));
  const sortBy = (col: Col) => setSort((s) => (s.col === col ? { col, dir: s.dir === "asc" ? "desc" : "asc" } : { col, dir: col === "name" || col === "stage" ? "asc" : "desc" }));
  const th = (col: Col, label: string, cls = "") => (
    <th key={col} aria-sort={sort.col === col ? (sort.dir === "asc" ? "ascending" : "descending") : "none"} className={cn("px-3 py-2.5 font-normal whitespace-nowrap", cls)}>
      <button onClick={() => sortBy(col)} className={cn("inline-flex items-center gap-1 hover:text-fg", sort.col === col && "font-medium text-fg")}>
        {label}{sort.col === col ? (sort.dir === "asc" ? <ArrowUp size={12} /> : <ArrowDown size={12} />) : <ChevronsUpDown size={12} className="opacity-40" />}
      </button>
    </th>
  );
  const message = (ch: "sms" | "email") => { const id = newCampaign(ch, { ids: picked.map((c) => c.id), label: `${picked.length} selected contact${picked.length === 1 ? "" : "s"}` }); navigate(`/campaigns/${id}`); };
  const pickList = (id: SegmentId) => { go({ list: id === "all" ? null : id }); setSel([]); setShown(PAGE); };

  return (
    <>
      <PageHeader
        title="Contacts"
        sub="Everyone who has called, filled a form, booked or visited, with every email, text and call. Leads from your ads land here on their own."
        actions={<>
          <Button icon={<Upload size={14} />} onClick={() => setImporting(true)}>Import</Button>
          <Button variant="primary" icon={<UserPlus size={14} />} onClick={() => setAdding(true)}>Add contact</Button>
        </>}
      />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[232px_minmax(0,1fr)]">
        {/* Lists: saved filters, vertical, with live counts. */}
        <nav aria-label="Lists" className="self-start lg:sticky lg:top-4">
          <Select value={seg} onChange={(e) => pickList(e.target.value as SegmentId)} aria-label="List" className="lg:hidden">
            {segments.map((s) => <option key={s.id} value={s.id}>{s.label} ({counts[s.id]})</option>)}
          </Select>
          <ul className="hidden space-y-px lg:block">
            {segments.map((s) => (
              <li key={s.id}>
                <button onClick={() => pickList(s.id)} title={s.hint || undefined} aria-current={seg === s.id ? "true" : undefined} className={cn("flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-[13px]", seg === s.id ? "bg-active font-medium" : "text-muted hover:bg-hover hover:text-fg")}>
                  <span className="min-w-0 flex-1 truncate">{s.label}</span><span className="num text-[12px] text-subtle">{fmt(counts[s.id])}</span>
                </button>
              </li>
            ))}
          </ul>
          <p className="mt-3 hidden px-2.5 text-[12px] text-subtle lg:block">Lists update on their own. {isOn("campaigns", flags) ? <>Use one as the audience for a <Link to="/campaigns" className="underline underline-offset-2">campaign</Link>.</> : null}</p>
        </nav>

        <div className="min-w-0">
          <div className="sticky top-12 z-10 -mx-1 mb-3 flex min-h-11 flex-wrap items-center gap-2 bg-bg px-1 py-1.5 lg:top-0">
            {picked.length ? (
              <>
                <span className="text-[13px] font-medium">{picked.length} selected</span>
                <Button size="sm" variant="ghost" onClick={() => setSel([])}>Clear</Button>
                <span className="flex-1" />
                {isOn("campaigns", flags) && isOn("sms", flags) && <Button size="sm" icon={<MessageSquareText size={12} />} onClick={() => message("sms")}>Text</Button>}
                {isOn("campaigns", flags) && isOn("email", flags) && <Button size="sm" icon={<Mail size={12} />} onClick={() => message("email")}>Email</Button>}
                {isOn("workflows", flags) && <Menu label="Workflow" icon={<WorkflowIcon size={12} />} items={st.workflows.filter((a) => a.on).map((a) => ({ label: a.name, onPick: () => { const n = enroll(picked.map((c) => c.id), a.id); toast(`${n} started ${a.name}${n < picked.length ? `; ${picked.length - n} can't get its first message` : ""}`); setSel([]); } }))} />}
                <Menu label="Move to" items={stages.map((s) => ({ label: s.label, onPick: () => { const st2 = setStage(picked.map((c) => c.id), s.id); toast(`Moved ${picked.length} to ${s.label}.${startedText(st2)}`); setSel([]); } }))} />
                <Menu label="Tag" icon={<Tag size={12} />} items={tagOptions.map((t) => ({ label: t, onPick: () => { const st2 = addTag(picked.map((c) => c.id), t); toast(`Tagged ${picked.length} “${t}”.${startedText(st2)}`); } }))} />
                <Can I="export" on="customers"><Button size="sm" variant="ghost" icon={<Download size={12} />} onClick={() => toast(`Exported ${picked.length} as CSV`)}>Export</Button></Can>
                <Button size="sm" variant="ghost" icon={<Trash2 size={12} />} onClick={() => { removeContacts(picked.map((c) => c.id)); toast(`Deleted ${picked.length}`); setSel([]); }} aria-label="Delete selected" />
              </>
            ) : (
              <>
                <Segmented<View> label="View" value={view} onChange={(v) => go({ view: v === "list" ? null : v })} options={[{ id: "list", label: <span className="inline-flex items-center gap-1"><List size={13} />List</span> }, { id: "pipeline", label: <span className="inline-flex items-center gap-1"><Kanban size={13} />Pipeline</span> }]} />
                <SearchInput size="sm" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Name, phone, email or tag" aria-label="Find a contact" className="min-w-[180px] flex-1 sm:max-w-[260px]" />
                <Select size="sm" value={source} onChange={(e) => setSource(e.target.value as Source | "ads" | "all")} aria-label="Came from" className="w-auto">
                  <option value="all">From anywhere</option><option value="ads">Any ad</option>
                  {(Object.keys(sources) as Source[]).map((s) => <option key={s} value={s}>{sources[s].label}</option>)}
                </Select>
                {view === "list" && (
                  <Select size="sm" value={stage ?? ""} onChange={(e) => setStageF((e.target.value || null) as Stage | null)} aria-label="Stage" className="w-auto">
                    <option value="">Any stage</option>
                    {stages.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
                  </Select>
                )}
              </>
            )}
          </div>

          {view === "list" ? (
            <Card pad={false} className="overflow-x-auto">
              <table className="w-full min-w-[780px] text-[13.5px]">
                <thead className="border-b border-line text-left text-[12.5px] text-muted">
                  <tr>
                    <th className="w-10 pl-4"><Checkbox label="Select all" checked={allOn} onChange={(v) => setSel(v ? rows.slice(0, shown).map((c) => c.id) : [])} /></th>
                    {th("name", "Name", "pl-1")}{th("stage", "Stage")}{th("source", "Came from")}{th("last", "Last touch")}
                    <th className="px-3 py-2.5 font-normal">Can reach</th>
                    {th("value", "Worth", "pr-5 text-right")}
                  </tr>
                </thead>
                <tbody>
                  {rows.slice(0, shown).map((c) => {
                    const t = touch.get(c.id);
                    const waiting = needsReply(t);
                    return (
                      <tr key={c.id} onClick={() => go({ c: c.id })} className={cn("cursor-pointer border-b border-line last:border-0", sel.includes(c.id) ? "bg-active" : "hover:bg-hover")}>
                        <td className="pl-4" onClick={(e) => e.stopPropagation()}><Checkbox label={`Select ${c.name}`} checked={sel.includes(c.id)} onChange={(v) => setSel(v ? [...sel, c.id] : sel.filter((x) => x !== c.id))} /></td>
                        <td className="py-2.5 pr-3 pl-1"><div className="font-medium">{c.name}</div><div className="truncate text-[12px] text-muted">{c.tags.length ? c.tags.join(" · ") : c.phone ?? c.email}</div></td>
                        <td className="px-3"><StageBadge stage={c.stage} />{c.nextAppt && <div className="mt-0.5 text-[11.5px] whitespace-nowrap text-muted">Next {shortDate(c.nextAppt)}</div>}</td>
                        <td className="px-3 text-[12.5px] text-muted"><div className="max-w-[160px] truncate">{c.sourceDetail}</div></td>
                        <td className="px-3 text-[12.5px] whitespace-nowrap">{t ? <span className={cn("inline-flex items-center gap-1.5", waiting ? "font-medium text-accent" : "text-muted")}><ChannelIcon ch={t.kind as "sms"} size={12} />{waiting ? "Your turn · " : ""}{timeAgo(t.at)}</span> : <span className="text-subtle">Never</span>}</td>
                        <td className="px-3"><Reach c={c} /></td>
                        <td className="num pr-5 text-right text-muted">${fmt(c.value)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {!rows.length && <p className="px-5 py-12 text-center text-[13px] text-muted">Nobody matches. Try another list or clear the search.</p>}
              {rows.length > shown && <div className="border-t border-line p-2 text-center"><Button size="sm" variant="ghost" onClick={() => setShown(shown + PAGE)}>Show {Math.min(PAGE, rows.length - shown)} more of {fmt(rows.length - shown)}</Button></div>}
            </Card>
          ) : (
            <Pipeline rows={rows} touch={touch} onOpen={(id) => go({ c: id })} toast={toast} />
          )}
        </div>
      </div>

      <ContactDrawer id={open} onClose={() => go({ c: null })} toast={toast} />
      <AddContactModal open={adding} onClose={() => setAdding(false)} onAdded={(id, started) => { setAdding(false); go({ c: id, list: null }); toast(`Added.${startedText(started)}`); }} />
      <Modal open={importing} onClose={() => setImporting(false)} title="Import contacts">
        <div className="space-y-2.5">
          {ads.connected.booking ? (
            <button onClick={() => { const n = importFromBooking(); setImporting(false); toast(n ? `Imported ${n} patients from NexHealth` : "Already up to date with NexHealth"); }} className="flex w-full items-start gap-3 rounded-xl border border-line p-3.5 text-left hover:border-line-strong hover:bg-hover">
              <Upload size={18} className="mt-0.5 shrink-0 text-muted" /><span><span className="block text-[14px] font-medium">Sync from your booking system</span><span className="block text-[12.5px] text-muted">Patients, visits and appointments from NexHealth. Keeps syncing every 15 minutes.</span></span>
            </button>
          ) : (
            <Link to="/settings/integrations?cat=Ads" className="flex items-start gap-3 rounded-xl border border-line p-3.5 hover:border-line-strong hover:bg-hover">
              <Upload size={18} className="mt-0.5 shrink-0 text-muted" /><span><span className="block text-[14px] font-medium">Connect your booking system</span><span className="block text-[12.5px] text-muted">Patients, visits and appointments sync in, and stay in sync. Settings → Ad accounts → Booking system.</span></span>
            </Link>
          )}
          <button onClick={() => { setImporting(false); toast("CSV import: map columns, then choose who agreed to texts and email"); }} className="flex w-full items-start gap-3 rounded-xl border border-line p-3.5 text-left hover:border-line-strong hover:bg-hover">
            <Download size={18} className="mt-0.5 shrink-0 rotate-180 text-muted" /><span><span className="block text-[14px] font-medium">Upload a CSV</span><span className="block text-[12.5px] text-muted">From a spreadsheet or another CRM. You'll match columns and say who agreed to texts and email.</span></span>
          </button>
          <p className="pt-1 text-[12px] text-subtle">Leads from Meta lead forms, Google Ads calls and your website forms come in on their own once those are connected.</p>
        </div>
      </Modal>
      {node}
    </>
  );
}

function Menu({ label, icon, items }: { label: string; icon?: ReactNode; items: { label: string; onPick: () => void }[] }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <Button size="sm" icon={icon} onClick={() => setOpen(!open)} aria-expanded={open}>{label}<ChevronDown size={12} /></Button>
      {open && (
        <>
          <div className="fixed inset-0 z-20" onClick={() => setOpen(false)} />
          <div className="anim-fade absolute top-full right-0 z-30 mt-1 max-h-72 w-56 overflow-y-auto rounded-lg border border-line bg-surface p-1 shadow-float">
            {items.length ? items.map((i) => <button key={i.label} onClick={() => { i.onPick(); setOpen(false); }} className="block w-full rounded px-2 py-1.5 text-left text-[13px] hover:bg-hover">{i.label}</button>) : <p className="px-2 py-1.5 text-[12.5px] text-muted">Nothing to pick</p>}
          </div>
        </>
      )}
    </div>
  );
}

/** Leads by stage. Drag a card to move it; patients live in the list. */
function Pipeline({ rows, touch, onOpen, toast }: { rows: Contact[]; touch: Map<string, ReturnType<typeof lastTouch>>; onOpen: (id: string) => void; toast: (m: string) => void }) {
  const [over, setOver] = useState<Stage | null>(null);
  const cols = stages.filter((s) => s.id !== "patient");
  const leads = rows.filter((c) => c.stage !== "patient");
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {cols.map((s) => {
        const items = leads.filter((c) => c.stage === s.id).sort((a, b) => (touch.get(b.id)?.at ?? b.createdAt) - (touch.get(a.id)?.at ?? a.createdAt));
        return (
          <section key={s.id} aria-label={s.label}
            onDragOver={(e) => { e.preventDefault(); setOver(s.id); }} onDragLeave={() => setOver(null)}
            onDrop={(e) => { const id = e.dataTransfer.getData("text/plain"); setOver(null); if (id) { setStage([id], s.id); toast(`Moved to ${s.label}`); } }}
            className={cn("flex min-h-40 flex-col rounded-xl border bg-surface/50 p-2", over === s.id ? "border-ink" : "border-line")}>
            <header className="flex items-baseline gap-2 px-1.5 pt-1 pb-2">
              <span className="text-[13px] font-medium">{s.label}</span><span className="num text-[12px] text-muted">{items.length}</span>
              <span className="num ml-auto text-[12px] text-subtle">${fmt(items.reduce((a, c) => a + c.value, 0))}</span>
            </header>
            <ul className="space-y-1.5">
              {items.slice(0, 30).map((c) => {
                const t = touch.get(c.id);
                const waiting = needsReply(t);
                return (
                  <li key={c.id} draggable onDragStart={(e) => e.dataTransfer.setData("text/plain", c.id)}>
                    <button onClick={() => onOpen(c.id)} className="block w-full cursor-grab rounded-lg border border-line bg-surface p-2.5 text-left shadow-card hover:border-line-strong active:cursor-grabbing">
                      <div className="flex items-center gap-1.5">{waiting && <span className="size-2 shrink-0 rounded-full bg-accent" aria-label="Waiting on you" />}<span className="min-w-0 flex-1 truncate text-[13px] font-medium">{c.name}</span><span className="num text-[11.5px] text-subtle">${fmt(c.value)}</span></div>
                      <div className="mt-0.5 truncate text-[12px] text-muted">{c.sourceDetail}</div>
                      <div className="mt-1 flex items-center gap-1.5 text-[11.5px] text-subtle">
                        {t ? <><ChannelIcon ch={t.kind as "sms"} size={11} />{timeAgo(t.at)}</> : <>Came in {timeAgo(c.createdAt)}</>}
                        {c.nextAppt && s.id === "booked" && <span className="ml-auto text-good">{shortDate(c.nextAppt)}</span>}
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
            {items.length > 30 && <p className="px-1.5 pt-2 text-[12px] text-muted">+{items.length - 30} more in the list view</p>}
            {!items.length && <p className="px-1.5 py-6 text-center text-[12px] text-subtle">Drop a card here</p>}
          </section>
        );
      })}
      <p className="text-[12px] text-subtle sm:col-span-2 xl:col-span-4">Booked is what Meta and Google count as a result. {stageOf("patient").label}s are in the list view.</p>
    </div>
  );
}
