import { useMemo, useState } from "react";
import { FileText, Plus, Mail, Hash, Download, Newspaper, Store, ChevronRight } from "lucide-react";
import { Badge, Button, Card, CardHeader, Checkbox, Modal, PageHeader, Segmented, Sparkline, cn, fmt, rankTone, shortDate, useToast } from "../components/ui";
import { gridStats, keywords, reports, type GridScan, type Keyword } from "../data/mock";
import { useContent } from "../lib/content";
import { GridLegend, GridMap, GridThumb } from "../components/GridMap";
import { periodScanFor } from "../components/KeywordTable";
import { Logo, LogoMark } from "../components/Logo";

const sections = ["Executive summary", "Keyword progress & map pack", "Rankings & changes", "Competitor movement", "Content published & planned", "Business Profile insights", "Site audit", "Actions completed", "Search Console & GA4 traffic"];

export default function Reports() {
  const [open, setOpen] = useState(false);
  const [sel, setSel] = useState(new Set(sections.slice(0, 6)));
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
        <div className="rounded-lg border border-line bg-bg p-5 sm:p-8">
          <div className="mb-6 flex items-center justify-between gap-3 border-b border-line pb-4">
            <Logo size={20} />
            <span className="text-[12px] text-subtle">Monthly performance report</span>
          </div>
          <div className="text-[12px] tracking-wide text-subtle uppercase">Maple & Main Dental · October 2026</div>
          <h2 className="mt-2 font-serif text-[28px] leading-tight">Map pack visibility up 9 points. Invisalign is now a top-3 result.</h2>
          <div className="mt-6 grid grid-cols-3 gap-6 border-t border-line pt-6">
            {[["31%", "Share of local voice", "+9 pts"], ["184", "Calls from Google", "+12%"], ["7", "Improvements shipped", ""]].map(([v, l, d]) => (
              <div key={l}><div className="num font-serif text-[28px]">{v}</div><div className="text-[12.5px] text-muted">{l}</div>{d && <div className="text-[12px] text-good">{d}</div>}</div>
            ))}
          </div>
          <KeywordProgress />
          <ContentSummary />
          <div className="mt-8 flex items-center justify-center gap-1.5 border-t border-line pt-5 text-[12px] text-subtle">
            <LogoMark size={14} /> Prepared with OpenMarko
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

// ---------- Keyword progress ----------

type View = "organic" | "local";
// Colors match the geo-grid dots (GridMap) so pills, bars and maps read the same.
// Four evenly spaced points from each keyword's 90-day history: start, two in between, and now.
const snaps = [0, 10, 20, 30];
const pos = (k: Keyword, view: View, i: number) => k.history[i]?.[view] ?? null;
const bands = [
  { label: "Top 3", test: (p: number | null) => p !== null && p <= 3, cls: "bg-good" },
  { label: "4–10", test: (p: number | null) => p !== null && p > 3 && p <= 10, cls: "bg-warn" },
  { label: "11–20", test: (p: number | null) => p !== null && p > 10 && p <= 20, cls: "bg-bad" },
  { label: "Lower / not ranking", test: (p: number | null) => p === null || p > 20, cls: "bg-line-strong" },
];
const pct = (n: number) => `${Math.round(n)}%`;
// Share of grid points where you show in the top 10. Moves more visibly than top 3 for clients.
const top10 = (scan: GridScan) => (scan.points.filter((p) => p.rank !== null && p.rank <= 10).length / scan.points.length) * 100;

function Pos({ p }: { p: number | null }) {
  const tone = rankTone(p);
  return (
    <span className={cn("num inline-block min-w-9 rounded-md px-1.5 py-0.5 text-center text-[12.5px] font-medium",
      tone === "good" ? "bg-good-soft text-good" : tone === "warn" ? "bg-warn-soft text-warn" : tone === "bad" ? "bg-bad-soft text-bad" : "text-subtle")}>
      {p === null ? "—" : `#${p}`}
    </span>
  );
}

function KeywordProgress() {
  const [view, setView] = useState<View>("local");
  const [open, setOpen] = useState<string | null>(null);
  const local = view === "local";
  const rows = useMemo(() => keywords
    .filter((k) => k.history.some((h) => h[view] !== null))
    .map((k) => {
      const first = pos(k, view, snaps[0]), last = pos(k, view, snaps[snaps.length - 1]);
      const scans = local ? snaps.map((_, n) => periodScanFor(k, n)) : [];
      const cover = scans.map(top10);
      return { k, first, last, scans, cover, change: first !== null && last !== null ? first - last : 0 };
    })
    .sort((a, b) => b.change - a.change || (a.last ?? 99) - (b.last ?? 99)), [view, local]);
  const dates = snaps.map((i, n) => (n === snaps.length - 1 ? "Now" : shortDate(keywords[0].history[i].date)));
  const up = rows.filter((r) => r.change > 0).length, down = rows.filter((r) => r.change < 0).length;
  const top3 = (i: number) => rows.filter((r) => bands[0].test(pos(r.k, view, i))).length;
  const avgCover = (n: number) => rows.reduce((t, r) => t + r.cover[n], 0) / Math.max(1, rows.length);
  const cols = 3 + snaps.length;

  return (
    <section className="mt-8 border-t border-line pt-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h3 className="font-serif text-[22px]">Keyword progress</h3>
          <p className="mt-1 text-[13.5px] text-muted">
            Since {dates[0]}, <b className="font-medium text-good">{up} of {rows.length} keywords moved up</b>
            {down > 0 && <>, {down} slipped</>}. <b className="font-medium text-fg">{top3(snaps[snaps.length - 1])}</b> are in the top 3 now, up from {top3(snaps[0])}.
            {local && <> On the map you show in the top 10 across <b className="font-medium text-good">{pct(avgCover(snaps.length - 1))} of the area</b>, up from {pct(avgCover(0))}.</>}
          </p>
        </div>
        <Segmented label="Results" value={view} onChange={(v) => { setView(v); setOpen(null); }} options={[{ id: "local", label: "Map pack" }, { id: "organic", label: "Google search" }]} />
      </div>

      {/* How the whole set shifted: one bar per date, split by position band. */}
      <div className="mt-5 space-y-2">
        {snaps.map((i, n) => {
          const counts = bands.map((b) => rows.filter((r) => b.test(pos(r.k, view, i))).length);
          return (
            <div key={i} className="flex items-center gap-3">
              <span className="w-12 shrink-0 text-right text-[12px] text-muted">{dates[n]}</span>
              <div className="flex h-6 flex-1 gap-0.5 overflow-hidden rounded-md" role="img" aria-label={`${dates[n]}: ${bands.map((b, j) => `${counts[j]} ${b.label}`).join(", ")}`}>
                {counts.map((c, j) => c > 0 && (
                  <div key={j} className={cn("num grid place-items-center text-[11.5px] font-medium", bands[j].cls, j < 3 ? "text-white" : "text-muted")} style={{ width: `${(c / rows.length) * 100}%` }}>{c}</div>
                ))}
              </div>
            </div>
          );
        })}
        <div className="flex flex-wrap gap-x-4 gap-y-1 pl-15 text-[12px] text-muted">
          {bands.map((b) => <span key={b.label} className="inline-flex items-center gap-1.5"><span className={cn("size-2.5 rounded-sm", b.cls)} />{b.label}</span>)}
        </div>
      </div>

      <div className="mt-6 overflow-x-auto">
        <table className="w-full min-w-[680px] text-[13.5px]">
          <thead className="border-b border-line text-left text-[12px] text-muted">
            <tr>
              <th className="py-2 pr-3 font-normal">Keyword</th>
              {dates.map((d) => <th key={d} className="px-2 py-2 text-center font-normal">{d}</th>)}
              <th className="px-2 py-2 text-right font-normal">Change</th>
              <th className="py-2 pl-3 font-normal">90-day trend</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const on = local && open === r.k.id;
              return [
                <tr key={r.k.id} onClick={local ? () => setOpen(on ? null : r.k.id) : undefined} aria-expanded={local ? on : undefined}
                  className={cn("border-b border-line last:border-0", local && "cursor-pointer", on ? "bg-accent-soft/40" : local && "hover:bg-hover")}>
                  <td className="py-2.5 pr-3">
                    <span className="inline-flex items-center gap-1.5 font-medium">
                      {local && <ChevronRight size={13} className={cn("shrink-0 text-subtle transition-transform", on && "rotate-90")} />}{r.k.term}
                    </span>
                    <div className={cn("num text-[11.5px] text-subtle", local && "ml-[19px]")}>{fmt(r.k.volume)} searches/mo</div>
                  </td>
                  {snaps.map((i, n) => (
                    <td key={i} className="px-2 py-2.5 text-center">
                      {local ? (
                        <span className="inline-flex flex-col items-center gap-1">
                          <GridThumb scan={r.scans[n]} gap={6} />
                          <Pos p={pos(r.k, view, i)} />
                        </span>
                      ) : <Pos p={pos(r.k, view, i)} />}
                    </td>
                  ))}
                  <td className="px-2 py-2.5 text-right">
                    <div className={cn("num font-medium", r.change > 0 ? "text-good" : r.change < 0 ? "text-bad" : "text-subtle")}>
                      {r.change > 0 ? `▲ ${r.change}` : r.change < 0 ? `▼ ${-r.change}` : "–"}
                    </div>
                    {local && <div className="num text-[11.5px] text-muted" title="Share of the map where you show in the top 10">Top 10: {pct(r.cover[0])} → {pct(r.cover[snaps.length - 1])}</div>}
                  </td>
                  <td className="py-2.5 pl-3"><Sparkline data={r.k.history.map((h) => h[view])} invert width={96} /></td>
                </tr>,
                on && (
                  <tr key={r.k.id + "-x"} className="border-b border-line">
                    <td colSpan={cols} className="py-5">
                      <div className="anim-fade">
                        <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-[12.5px] text-muted">
                          <span>Each dot is a spot around the practice where we searched Google Maps, showing your rank from there.</span>
                          <GridLegend />
                        </div>
                        <div className="grid gap-6 sm:grid-cols-2">
                          {([0, snaps.length - 1] as const).map((n) => (
                            <figure key={n}>
                              <figcaption className="mb-2 flex items-baseline justify-between text-[13px]">
                                <span className="font-medium">{n === 0 ? `Before · ${dates[0]}` : "After · now"}</span>
                                <span className="text-muted">Top 10 in <b className="num font-medium text-fg">{pct(r.cover[n])}</b> of the area · avg <span className="num">#{gridStats(r.scans[n]).arp.toFixed(1)}</span></span>
                              </figcaption>
                              <GridMap scan={r.scans[n]} compact />
                            </figure>
                          ))}
                        </div>
                      </div>
                    </td>
                  </tr>
                ),
              ];
            })}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-[12px] text-subtle">
        {local ? "Small grids show where you rank around the practice on each date; open a keyword to see the full map before and after. " : ""}
        Position #1 is the top result. ▲ means it moved up.
      </p>
    </section>
  );
}

// ---------- Content ----------

function ContentSummary() {
  const items = useContent();
  const published = items.filter((i) => i.status === "published");
  const upcoming = items.filter((i) => i.status === "scheduled" || i.status === "draft");
  const ideas = items.filter((i) => i.status === "idea").length;
  const term = (id: string) => keywords.find((k) => k.id === id)?.term;
  const Icon = ({ type }: { type: "article" | "post" }) => (type === "article" ? <Newspaper size={14} className="mt-0.5 shrink-0 text-subtle" /> : <Store size={14} className="mt-0.5 shrink-0 text-subtle" />);

  return (
    <section className="mt-8 border-t border-line pt-6">
      <h3 className="font-serif text-[22px]">Content</h3>
      <p className="mt-1 text-[13.5px] text-muted">
        <b className="font-medium text-fg">{published.length} pieces published</b> so far, {upcoming.length} on the way and {ideas} idea{ideas === 1 ? "" : "s"} in the pipeline.
      </p>
      <div className="mt-4 grid gap-6 md:grid-cols-2">
        <div>
          <div className="mb-2 text-[12px] tracking-wide text-subtle uppercase">Published</div>
          <ul className="space-y-2.5">
            {published.map((i) => (
              <li key={i.id} className="flex items-start gap-2.5 text-[13.5px]">
                <Icon type={i.type} />
                <div className="min-w-0 flex-1">
                  <div className="leading-snug">{i.title}</div>
                  <div className="text-[12px] text-subtle">{i.date}{term(i.keywordId) && ` · ${term(i.keywordId)}`}</div>
                </div>
                {i.metric && <span className="num shrink-0 text-[12.5px] font-medium text-good">{i.metric}</span>}
              </li>
            ))}
          </ul>
        </div>
        <div>
          <div className="mb-2 text-[12px] tracking-wide text-subtle uppercase">Coming up</div>
          <ul className="space-y-2.5">
            {upcoming.map((i) => (
              <li key={i.id} className="flex items-start gap-2.5 text-[13.5px]">
                <Icon type={i.type} />
                <div className="min-w-0 flex-1">
                  <div className="leading-snug">{i.title}</div>
                  <div className="text-[12px] text-subtle">{i.date}{term(i.keywordId) && ` · ${term(i.keywordId)}`}</div>
                </div>
                <Badge tone={i.status === "scheduled" ? "info" : "warn"} className="shrink-0 capitalize">{i.status}</Badge>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
