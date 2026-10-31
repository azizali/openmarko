import { Fragment, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router";
import { AlertTriangle, ArrowDown, ArrowUp, Check, ChevronsUpDown, Copy, Loader2, Rocket, Trash2, Wand2, X } from "lucide-react";
import { Badge, Button, Card, Checkbox, Empty, Field, FieldLabel, Input, PageHeader, Progress, Segmented, Select, Textarea, cn, useToast } from "../components/ui";
import { AdPlatformMark, CreativeThumb, PublishModal } from "../components/Ads";
import { angles, ctas, formats, sizes, type Angle, type Format, type Size } from "../data/ads";
import { useAds } from "../lib/ads";
import {
  blankBrief, blockedStyles, costOf, editCreative, fileCount, generate, moreLike, removeBatch, removeCreatives, rewrite, saveRowToSwipe, setCreativeStatus, styles,
  useCreatives, variationCount, type Brief, type Creative, type CreativeStatus, type Style,
} from "../lib/creatives";

type Col = "score" | "angle" | "status" | "checks";
const statusMeta: Record<CreativeStatus, { label: string; tone: "neutral" | "good" | "bad" | "accent" }> = {
  draft: { label: "To review", tone: "neutral" },
  approved: { label: "Approved", tone: "good" },
  rejected: { label: "Rejected", tone: "bad" },
  published: { label: "Published", tone: "accent" },
};
const statusOrder: CreativeStatus[] = ["draft", "approved", "published", "rejected"];
const blocked = (c: Creative) => c.flags.some((f) => f.level === "block");
const toggle = <T,>(xs: T[], x: T) => (xs.includes(x) ? xs.filter((y) => y !== x) : [...xs, x]);
const chip = (on: boolean) => cn("inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-[13px] transition-colors", on ? "border-ink bg-active text-fg" : "border-line text-muted hover:bg-hover");

/**
 * Creative studio: a brief multiplies angles × hooks × formats into a batch of
 * creatives, each in every size, checked against ad rules and the brand's
 * rules, and scored. Review them fast in one list, then publish the approved
 * ones as a test. References come from the ad swipe file or your own ads.
 */
export default function AdStudio() {
  const cr = useCreatives();
  const ads = useAds();
  const [params, setParams] = useSearchParams();
  const { toast, node } = useToast();
  const [brief, setBrief] = useState<Brief>(blankBrief);
  const [busy, setBusy] = useState(false);
  const [batch, setBatch] = useState<string | "all">("all");
  const [status, setStatus] = useState<CreativeStatus | "all">("all");
  const [sort, setSort] = useState<{ col: Col; dir: "asc" | "desc" }>({ col: "score", dir: "desc" });
  const [sel, setSel] = useState<string[]>([]);
  const [open, setOpen] = useState<string | null>(null);
  const [publishing, setPublishing] = useState<Creative[] | null>(null);

  // Arriving from research (?refs=) or from Ads (?from= your own ads): start the brief from them.
  useEffect(() => {
    const refs = params.get("refs")?.split(",").filter(Boolean) ?? [];
    const from = params.get("from")?.split(",").filter(Boolean) ?? [];
    if (!refs.length && !from.length) return;
    const rows = ads.rows.filter((r) => from.includes(r.id) && r.copy);
    rows.forEach((r) => saveRowToSwipe(r, "Your ad, used as a reference for fresh versions."));
    const ids = [...refs, ...rows.map((r) => `sw_${r.id}`)];
    const picked = [...cr.swipe.filter((s) => refs.includes(s.id)).map((s) => ({ angle: s.angle, format: s.format })), ...rows.map((r) => r.copy!)];
    const fmts = [...new Set(picked.map((p) => (p.format === "carousel" ? "image" : p.format)))] as Format[];
    setBrief((b) => ({ ...b, refs: ids, angles: [...new Set(picked.map((p) => p.angle))], formats: fmts.length ? fmts : b.formats, hooks: 5, name: rows.length ? `Fresh versions of ${rows.map((r) => `“${r.name}”`).join(", ")}` : "" }));
    setParams({}, { replace: true });
  }, []);

  const inBatch = cr.creatives.filter((c) => batch === "all" || c.batchId === batch);
  const counts = Object.fromEntries(statusOrder.map((s) => [s, inBatch.filter((c) => c.status === s).length])) as Record<CreativeStatus, number>;
  const shown = useMemo(() => {
    const val = (c: Creative): number | string => ({ score: c.score, angle: `${angles[c.angle].label} ${c.format}`, status: statusOrder.indexOf(c.status), checks: c.flags.length }[sort.col]);
    return inBatch.filter((c) => status === "all" || c.status === status).sort((a, b) => { const x = val(a), y = val(b); return (x < y ? -1 : x > y ? 1 : 0) * (sort.dir === "asc" ? 1 : -1); });
  }, [inBatch, status, sort]);
  const picked = shown.filter((c) => sel.includes(c.id));
  const approved = inBatch.filter((c) => c.status === "approved");

  const run = () => {
    setBusy(true);
    setTimeout(() => { const b = generate(brief); setBatch(b.id); setStatus("all"); setSel([]); setBusy(false); toast(`${variationCount(brief)} variations ready to review`); }, 1400);
  };
  const mark = (ids: string[], s: CreativeStatus) => { setCreativeStatus(ids, s); setSel([]); };
  const startPublish = (cs: Creative[]) => {
    const ok = cs.filter((c) => !blocked(c) && c.status !== "published");
    if (ok.length < cs.length) toast(`${cs.length - ok.length} left out: published already or failing a check`);
    if (ok.length) setPublishing(ok);
  };
  const sortBy = (col: Col) => setSort((s) => (s.col === col ? { col, dir: s.dir === "asc" ? "desc" : "asc" } : { col, dir: col === "score" || col === "checks" ? "desc" : "asc" }));
  const th = (col: Col, label: string, right = false) => (
    <th key={col} aria-sort={sort.col === col ? (sort.dir === "asc" ? "ascending" : "descending") : "none"} className={cn("px-3 py-2.5 font-normal whitespace-nowrap", right && "text-right")}>
      <button onClick={() => sortBy(col)} className={cn("inline-flex items-center gap-1 hover:text-fg", sort.col === col && "font-medium text-fg")}>
        {label}{sort.col === col ? (sort.dir === "asc" ? <ArrowUp size={12} /> : <ArrowDown size={12} />) : <ChevronsUpDown size={12} className="opacity-40" />}
      </button>
    </th>
  );
  const pubBatch = cr.batches.find((b) => b.id === publishing?.[0]?.batchId);

  return (
    <>
      <PageHeader title="Creative studio" sub="Write a brief once and get every angle, hook, format and size. Review them in one list, then publish the ones you approve as a test." />

      <div className="grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
        <div className="space-y-4 xl:sticky xl:top-6 xl:self-start">
          <BriefCard brief={brief} setBrief={setBrief} busy={busy} onRun={run} />
          {cr.batches.length > 0 && (
            <Card pad={false}>
              <div className="border-b border-line px-4 py-2.5 text-[12.5px] font-medium text-muted">Batches</div>
              <ul className="m-0 max-h-[320px] list-none overflow-y-auto p-1.5">
                {[{ id: "all", name: "All batches", at: 0 }, ...cr.batches].map((b) => {
                  const cs = cr.creatives.filter((c) => b.id === "all" || c.batchId === b.id);
                  return (
                    <li key={b.id} className="group flex items-center">
                      <button onClick={() => { setBatch(b.id); setSel([]); }} aria-current={batch === b.id} className={cn("flex min-w-0 flex-1 items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-[13px]", batch === b.id ? "bg-active font-medium" : "hover:bg-hover")}>
                        <span className="min-w-0 flex-1 truncate">{b.name}</span>
                        <span className="num shrink-0 text-[11.5px] text-muted">{cs.filter((c) => c.status === "approved" || c.status === "published").length}/{cs.length}</span>
                      </button>
                      {b.id !== "all" && <button onClick={() => { removeBatch(b.id); if (batch === b.id) setBatch("all"); }} aria-label={`Delete ${b.name}`} title="Delete batch (keeps published ones)" className="ml-0.5 grid size-7 place-items-center rounded text-subtle opacity-0 group-hover:opacity-100 hover:bg-hover hover:text-fg focus:opacity-100"><Trash2 size={13} /></button>}
                    </li>
                  );
                })}
              </ul>
            </Card>
          )}
        </div>

        <div className="min-w-0">
          {!cr.creatives.length ? (
            <Card><Empty icon={<Wand2 size={28} />} title="No creatives yet" sub="Pick angles and formats in the brief, or start from ads you saved in Ad research." action={<Link to="/ads/research"><Button>Find ads to learn from</Button></Link>} /></Card>
          ) : (
            <>
              <div className="sticky top-12 z-10 -mx-1 mb-3 flex flex-wrap items-center gap-2 bg-bg px-1 py-1.5 lg:top-0">
                {picked.length ? (
                  <>
                    <span className="text-[13px] font-medium">{picked.length} selected</span>
                    <Button size="sm" variant="ghost" onClick={() => setSel([])}>Clear</Button>
                    <span className="flex-1" />
                    <Button size="sm" icon={<Check size={12} />} onClick={() => mark(picked.filter((c) => c.status !== "published").map((c) => c.id), "approved")}>Approve</Button>
                    <Button size="sm" icon={<X size={12} />} onClick={() => mark(picked.filter((c) => c.status !== "published").map((c) => c.id), "rejected")}>Reject</Button>
                    <Button size="sm" icon={<Copy size={12} />} onClick={() => { const b = moreLike(picked.map((c) => c.id)); if (b) { setBatch(b.id); setSel([]); toast("New batch with more like these"); } }}>More like these</Button>
                    <Button size="sm" variant="ghost" icon={<Trash2 size={12} />} onClick={() => { removeCreatives(picked.filter((c) => c.status !== "published").map((c) => c.id)); setSel([]); }}>Delete</Button>
                    <Button size="sm" variant="primary" icon={<Rocket size={12} />} onClick={() => startPublish(picked)}>Publish {picked.length}</Button>
                  </>
                ) : (
                  <>
                    <div className="flex flex-wrap gap-1">
                      {(["all", ...statusOrder] as const).map((s) => (
                        <button key={s} onClick={() => setStatus(s)} aria-pressed={status === s} className={cn("inline-flex h-7 items-center gap-1.5 rounded-full border px-2.5 text-[12.5px]", status === s ? "border-ink bg-ink text-on-ink" : "border-line text-muted hover:bg-hover")}>
                          {s === "all" ? "All" : statusMeta[s].label}<span className="num opacity-70">{s === "all" ? inBatch.length : counts[s]}</span>
                        </button>
                      ))}
                    </div>
                    <span className="flex-1" />
                    {counts.draft > 0 && <Button size="sm" icon={<Check size={12} />} onClick={() => { mark(inBatch.filter((c) => c.status === "draft" && !blocked(c) && c.score >= 75).map((c) => c.id), "approved"); toast("Approved every draft scoring 75+ that passes the checks"); }}>Approve 75+ that pass</Button>}
                    <Button size="sm" variant="primary" disabled={!approved.length} icon={<Rocket size={12} />} onClick={() => startPublish(approved)}>Publish {approved.length} approved</Button>
                  </>
                )}
              </div>

              <Card pad={false} className="overflow-x-auto">
                <table className="w-full min-w-[680px] text-[13.5px]">
                  <thead className="border-b border-line text-left text-[12.5px] text-muted">
                    <tr>
                      <th className="w-10 py-2.5 pl-4"><Checkbox label="Select all" checked={shown.length > 0 && shown.every((c) => sel.includes(c.id))} onChange={(v) => setSel(v ? shown.map((c) => c.id) : [])} /></th>
                      <th className="px-3 py-2.5 font-normal">Creative</th>
                      {th("angle", "Angle & format")}
                      {th("score", "Score", true)}
                      {th("checks", "Checks")}
                      {th("status", "Status")}
                      <th className="w-20" />
                    </tr>
                  </thead>
                  <tbody>
                    {shown.map((c) => (
                      <Fragment key={c.id}>
                        <tr onClick={() => setOpen(open === c.id ? null : c.id)} className={cn("cursor-pointer border-b border-line hover:bg-hover/50", sel.includes(c.id) && "bg-active/40", open === c.id && "border-transparent", c.status === "rejected" && "opacity-60")}>
                          <td className="py-2.5 pl-4" onClick={(e) => e.stopPropagation()}><Checkbox label={`Select ${c.headline}`} checked={sel.includes(c.id)} onChange={(v) => setSel(v ? [...sel, c.id] : sel.filter((x) => x !== c.id))} /></td>
                          <td className="px-3 py-2.5">
                            <div className="flex items-center gap-3">
                              <CreativeThumb angle={c.angle} format={c.format} style={c.style} headline={c.headline} size={c.sizes[0] ?? "1:1"} w={52} />
                              <div className="min-w-0">
                                <div className="line-clamp-1 font-medium">{c.headline}</div>
                                <div className="line-clamp-1 text-[12.5px] text-muted">{c.text}</div>
                              </div>
                            </div>
                          </td>
                          <td className="px-3 py-2.5 whitespace-nowrap">{angles[c.angle].label}<div className="text-[12px] text-muted">{formats[c.format].label}{c.sizes.length > 0 && ` · ${c.sizes.length} sizes`}</div></td>
                          <td className="px-3 py-2.5 text-right" title="How ads like this did in your account and how long similar ads run in your market">
                            <div className="flex items-center justify-end gap-2"><Progress value={c.score} tone={c.score >= 75 ? "good" : c.score >= 60 ? "warn" : "bad"} className="w-12" /><span className="num w-6">{c.score}</span></div>
                          </td>
                          <td className="px-3 py-2.5">
                            {!c.flags.length ? <span className="inline-flex items-center gap-1 text-[12.5px] text-good"><Check size={12} />Pass</span>
                              : <Badge tone={blocked(c) ? "bad" : "warn"}><AlertTriangle size={11} />{c.flags.length} {blocked(c) ? "to fix" : "note"}</Badge>}
                          </td>
                          <td className="px-3 py-2.5 whitespace-nowrap"><Badge tone={statusMeta[c.status].tone}>{statusMeta[c.status].label}</Badge></td>
                          <td className="px-3 py-2.5 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                            {c.status !== "published" && <>
                              <button onClick={() => setCreativeStatus([c.id], c.status === "approved" ? "draft" : "approved")} aria-label="Approve" title="Approve" aria-pressed={c.status === "approved"} className={cn("inline-grid size-7 place-items-center rounded-md", c.status === "approved" ? "bg-good-soft text-good" : "text-muted hover:bg-hover hover:text-fg")}><Check size={14} /></button>
                              <button onClick={() => setCreativeStatus([c.id], c.status === "rejected" ? "draft" : "rejected")} aria-label="Reject" title="Reject" aria-pressed={c.status === "rejected"} className={cn("inline-grid size-7 place-items-center rounded-md", c.status === "rejected" ? "bg-bad-soft text-bad" : "text-muted hover:bg-hover hover:text-fg")}><X size={14} /></button>
                            </>}
                            {c.status === "published" && <Link to="/ads" className="text-[12.5px] text-muted hover:text-fg">In Ads →</Link>}
                          </td>
                        </tr>
                        {open === c.id && <tr className="border-b border-line bg-hover/30"><td /><td colSpan={6} className="px-3 pt-1 pb-4"><CreativeEditor c={c} /></td></tr>}
                      </Fragment>
                    ))}
                    {!shown.length && <tr><td colSpan={7} className="px-5 py-10 text-center text-muted">None {status === "all" ? "in this batch" : `marked ${statusMeta[status as CreativeStatus].label.toLowerCase()}`}.</td></tr>}
                  </tbody>
                </table>
              </Card>
            </>
          )}
        </div>
      </div>

      <PublishModal open={!!publishing} onClose={() => setPublishing(null)} batchId={pubBatch?.id ?? ""} batchName={pubBatch ? `Test · ${pubBatch.name}` : "Studio test"} onDone={(m) => { toast(m); setSel([]); }}
        ads={(publishing ?? []).map((c) => ({ id: c.id, angle: c.angle, format: c.format, headline: c.headline, text: c.text, hue: angles[c.angle].hue, score: c.score }))} />
      {node}
    </>
  );
}

function BriefCard({ brief, setBrief, busy, onRun }: { brief: Brief; setBrief: (b: Brief) => void; busy: boolean; onRun: () => void }) {
  const cr = useCreatives();
  const b = brief, set = (p: Partial<Brief>) => setBrief({ ...b, ...p });
  const visual = b.formats.some((f) => f !== "search");
  const refs = cr.swipe.filter((s) => b.refs.includes(s.id));
  const n = variationCount(b);
  return (
    <Card pad={false}>
      <div className="space-y-4 p-4">
        <div>
          <FieldLabel>Learn from</FieldLabel>
          {refs.length > 0 && (
            <ul className="mb-2 list-none space-y-1 pl-0">
              {refs.map((r) => (
                <li key={r.id} className="flex items-center gap-2 rounded-md bg-hover px-2 py-1.5 text-[12.5px]">
                  <AdPlatformMark platform={r.platform} size={14} /><span className="min-w-0 flex-1 truncate"><span className="text-muted">{r.advertiser}: </span>{r.headline}</span>
                  <button onClick={() => set({ refs: b.refs.filter((x) => x !== r.id) })} aria-label={`Remove ${r.headline}`} className="text-subtle hover:text-fg"><X size={12} /></button>
                </li>
              ))}
            </ul>
          )}
          <Select value="" onChange={(e) => { const s = cr.swipe.find((x) => x.id === e.target.value); if (s) set({ refs: [...b.refs, s.id], angles: b.angles.includes(s.angle) ? b.angles : [...b.angles, s.angle] }); }} className="text-muted">
            <option value="">{cr.swipe.length ? "Add an ad from your swipe file…" : "Your swipe file is empty"}</option>
            {cr.swipe.filter((s) => !b.refs.includes(s.id)).map((s) => <option key={s.id} value={s.id}>{s.advertiser}: {s.headline}</option>)}
          </Select>
        </div>
        <Field label="Offer"><Input value={b.offer} onChange={(e) => set({ offer: e.target.value })} /></Field>
        <Field label="Landing page"><Input value={b.landing} onChange={(e) => set({ landing: e.target.value })} /></Field>
        <div>
          <FieldLabel>Angles</FieldLabel>
          <div className="flex flex-wrap gap-1.5">{(Object.keys(angles) as Angle[]).map((a) => <button key={a} title={angles[a].blurb} aria-pressed={b.angles.includes(a)} onClick={() => set({ angles: toggle(b.angles, a) })} className={chip(b.angles.includes(a))}><span className="size-2 rounded-full" style={{ background: `hsl(${angles[a].hue} 60% 50%)` }} />{angles[a].label}</button>)}</div>
        </div>
        <div>
          <FieldLabel>Hooks per angle</FieldLabel>
          <Segmented label="Hooks per angle" value={String(b.hooks)} onChange={(v) => set({ hooks: +v })} options={["1", "2", "3", "4", "5"].map((x) => ({ id: x, label: x }))} />
        </div>
        <div>
          <FieldLabel>Formats</FieldLabel>
          <div className="flex flex-wrap gap-1.5">{(Object.keys(formats) as Format[]).map((f) => <button key={f} aria-pressed={b.formats.includes(f)} onClick={() => set({ formats: toggle(b.formats, f) })} className={chip(b.formats.includes(f))}>{formats[f].label}<span className="flex gap-0.5">{formats[f].platforms.map((p) => <AdPlatformMark key={p} platform={p} size={12} />)}</span></button>)}</div>
        </div>
        {visual && <>
          <div>
            <FieldLabel>Sizes</FieldLabel>
            <div className="flex flex-wrap gap-1.5">{sizes.map((s) => <button key={s.id} title={s.where} aria-pressed={b.sizes.includes(s.id)} onClick={() => set({ sizes: toggle(b.sizes, s.id as Size) })} className={chip(b.sizes.includes(s.id))}>{s.id}</button>)}</div>
          </div>
          <div>
            <FieldLabel>Looks</FieldLabel>
            <div className="flex flex-wrap gap-1.5">
              {styles.map((s) => <button key={s.id} aria-pressed={b.styles.includes(s.id)} onClick={() => set({ styles: toggle(b.styles, s.id as Style) })} className={chip(b.styles.includes(s.id))}>{s.label}</button>)}
              {blockedStyles.map((s) => <span key={s.label} title={s.why} className="inline-flex h-8 cursor-not-allowed items-center rounded-full border border-dashed border-line px-3 text-[13px] text-subtle line-through">{s.label}</span>)}
            </div>
            <p className="mt-1.5 mb-0 text-[12px] text-subtle">Before / after is off: {blockedStyles[0].why.toLowerCase()}.</p>
          </div>
        </>}
      </div>
      <div className="flex items-center gap-3 border-t border-line px-4 py-3">
        <div className="min-w-0 flex-1 text-[12.5px] leading-snug text-muted">
          <span className="num font-medium text-fg">{n}</span> variations{visual && <>, <span className="num">{fileCount(b)}</span> files</>}<br />≈ <span className="num">${costOf(b).toFixed(2)}</span> to render
        </div>
        <Button variant="primary" disabled={busy || !n || (visual && !b.sizes.length)} onClick={onRun} icon={busy ? <Loader2 size={14} className="animate-spin" /> : <Wand2 size={14} />}>{busy ? "Writing…" : `Make ${n}`}</Button>
      </div>
    </Card>
  );
}

function CreativeEditor({ c }: { c: Creative }) {
  const cr = useCreatives();
  const ref = cr.swipe.find((s) => s.id === c.refId);
  const locked = c.status === "published";
  return (
    <div className="flex flex-wrap gap-6">
      <div className="min-w-0">
        <div className="flex flex-wrap items-end gap-3">
          {(c.sizes.length ? c.sizes : (["1:1"] as Size[])).map((s) => (
            <figure key={s} className="m-0">
              <CreativeThumb angle={c.angle} format={c.format} style={c.style} headline={c.headline} size={s} w={c.format === "search" ? 180 : s === "9:16" ? 90 : s === "1.91:1" ? 190 : 120} />
              {c.format !== "search" && <figcaption className="mt-1 text-center text-[11.5px] text-muted">{s}</figcaption>}
            </figure>
          ))}
        </div>
        {ref && <p className="mt-3 mb-0 text-[12.5px] text-muted">Learned from {ref.advertiser === "You" ? "your ad" : ref.advertiser}: “{ref.headline}”</p>}
      </div>
      <div className="max-w-[420px] min-w-[260px] flex-1 space-y-3">
        <Field label={<>{c.format === "search" ? "Headlines (separated by | , 30 characters each)" : "Headline"}</>}>
          <Input key={c.headline} defaultValue={c.headline} disabled={locked} onBlur={(e) => e.target.value !== c.headline && editCreative(c.id, { headline: e.target.value })} />
        </Field>
        <Field label={<>{c.format === "search" ? "Description" : "Text"}</>}>
          <Textarea key={c.text} defaultValue={c.text} disabled={locked} rows={3} onBlur={(e) => e.target.value !== c.text && editCreative(c.id, { text: e.target.value })} className="py-2 leading-[1.5]" />
        </Field>
        {!locked && (
          <div className="flex flex-wrap items-center gap-1.5">
            {(["shorter", "punchier", "local"] as const).map((h) => <Button key={h} size="sm" variant="ghost" onClick={() => editCreative(c.id, { text: rewrite(c.text, h) })}>{h === "local" ? "More local" : h[0].toUpperCase() + h.slice(1)}</Button>)}
            <span className="flex-1" />
            <Select size="xs" className="w-auto" value={c.cta} onChange={(e) => editCreative(c.id, { cta: e.target.value })} aria-label="Button">{ctas.map((x) => <option key={x}>{x}</option>)}</Select>
          </div>
        )}
        {c.flags.length > 0 && (
          <ul className="m-0 list-none space-y-1.5 pl-0">
            {c.flags.map((f) => <li key={f.text} className={cn("flex gap-2 rounded-md px-2.5 py-2 text-[12.5px] leading-snug", f.level === "block" ? "bg-bad-soft text-bad" : "bg-warn-soft text-warn")}><AlertTriangle size={13} className="mt-0.5 shrink-0" />{f.text}</li>)}
          </ul>
        )}
      </div>
    </div>
  );
}
