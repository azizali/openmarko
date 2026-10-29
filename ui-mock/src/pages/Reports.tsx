import { useState } from "react";
import { FileText, Plus, Mail, Hash, Download } from "lucide-react";
import { Badge, Button, Card, CardHeader, Checkbox, Modal, PageHeader, useToast } from "../components/ui";
import { reports } from "../data/mock";

const sections = ["Executive summary", "Rankings & changes", "Rank pack grids", "Competitor movement", "Business Profile insights", "Site audit", "Actions completed", "Search Console & GA4 traffic"];

export default function Reports() {
  const [open, setOpen] = useState(false);
  const [sel, setSel] = useState(new Set(sections.slice(0, 5)));
  const { toast, node } = useToast();

  return (
    <>
      <PageHeader
        title="Reports"
        sub="Scheduled summaries for owners, clients and your team. White-label ready."
        actions={<Button variant="primary" icon={<Plus size={14} />} onClick={() => setOpen(true)}>New report</Button>}
      />
      <Card pad={false}>
        {reports.map((r) => (
          <div key={r.id} className="flex flex-wrap items-center gap-4 border-b border-line px-5 py-4 last:border-0">
            <span className="grid size-9 place-items-center rounded-lg bg-hover">{r.format === "Slack" ? <Hash size={16} /> : r.format === "Email" ? <Mail size={16} /> : <FileText size={16} />}</span>
            <div className="min-w-0 flex-1">
              <div className="text-[14px] font-medium">{r.name}</div>
              <div className="text-[12.5px] text-muted">{r.schedule} · {r.recipients}</div>
            </div>
            <Badge>{r.format}</Badge>
            <span className="text-[12.5px] text-subtle">Last sent {r.last}</span>
            <Button size="sm" variant="ghost" icon={<Download size={13} />} onClick={() => toast("Generating PDF…")}>PDF</Button>
          </div>
        ))}
      </Card>

      <Card className="mt-6">
        <CardHeader title="Preview: Monthly performance, October" sub="What your client sees" />
        <div className="rounded-lg border border-line bg-bg p-8">
          <div className="text-[12px] tracking-wide text-subtle uppercase">Maple & Main Dental · October 2026</div>
          <h2 className="mt-2 font-serif text-[28px] leading-tight">Map pack visibility up 9 points. Invisalign is now a top-3 result.</h2>
          <div className="mt-6 grid grid-cols-3 gap-6 border-t border-line pt-6">
            {[["31%", "Share of local voice", "+9 pts"], ["184", "Calls from Google", "+12%"], ["7", "Improvements shipped", ""]].map(([v, l, d]) => (
              <div key={l}><div className="num font-serif text-[28px]">{v}</div><div className="text-[12.5px] text-muted">{l}</div>{d && <div className="text-[12px] text-good">{d}</div>}</div>
            ))}
          </div>
        </div>
      </Card>

      <Modal open={open} onClose={() => setOpen(false)} title="New report" width={520} footer={<><Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button><Button variant="primary" onClick={() => { setOpen(false); toast("Report scheduled"); }}>Create</Button></>}>
        <div className="space-y-4 text-[13.5px]">
          <label className="block"><span className="mb-1 block text-[12.5px] text-muted">Name</span><input defaultValue="Monthly client report" className="h-9 w-full rounded-md border border-line bg-surface px-3 outline-none focus:border-line-strong" /></label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block"><span className="mb-1 block text-[12.5px] text-muted">Frequency</span><select className="h-9 w-full rounded-md border border-line bg-surface px-2 outline-none"><option>Monthly</option><option>Weekly</option></select></label>
            <label className="block"><span className="mb-1 block text-[12.5px] text-muted">Deliver to</span><select className="h-9 w-full rounded-md border border-line bg-surface px-2 outline-none"><option>Email</option><option>Slack</option><option>Shareable link</option></select></label>
          </div>
          <div>
            <span className="mb-1.5 block text-[12.5px] text-muted">Sections</span>
            <div className="grid grid-cols-2 gap-2">
              {sections.map((s) => (
                <label key={s} className="flex cursor-pointer items-center gap-2"><Checkbox checked={sel.has(s)} onChange={() => { const n = new Set(sel); n.has(s) ? n.delete(s) : n.add(s); setSel(n); }} />{s}</label>
              ))}
            </div>
          </div>
        </div>
      </Modal>
      {node}
    </>
  );
}
