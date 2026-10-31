import { Fragment, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { ArrowDown, ArrowUp, Bookmark, BookmarkCheck, ChevronsUpDown, Eye, Loader2, Plus, Search, Sparkles, Trash2, Wand2 } from "lucide-react";
import { Badge, Button, Card, Checkbox, Modal, PageHeader, Segmented, Tabs, cn, useToast } from "../components/ui";
import { AdPlatformMark, CreativeThumb, styleFor } from "../components/Ads";
import { adPlatforms, angles, formats, library, researchStarters, watchedAdvertisers, type AdPlatform, type Angle, type Format, type LibraryAd } from "../data/ads";
import { brandFacts } from "../data/brand";
import { addSwipe, inSwipe, removeSwipe, saveToSwipe, setSwipeNote, useCreatives, type SwipeAd } from "../lib/creatives";
import { timeAgo } from "../lib/runs";
import { useOn } from "../lib/features";

type Col = "advertiser" | "days" | "versions" | "angle" | "format";
const LONG = 30;
const allPlatforms = Object.keys(adPlatforms) as AdPlatform[];

/** Category searches return the whole local market; a name or phrase narrows it. */
function search(q: string, platforms: AdPlatform[]) {
  const ql = q.trim().toLowerCase();
  const broad = !ql || /dentist|dental/.test(ql);
  return library.filter((a) => platforms.includes(a.platform) && (broad || `${a.advertiser} ${a.headline} ${a.text} ${angles[a.angle].label}`.toLowerCase().includes(ql)));
}

/**
 * Ad research: what other advertisers run, and which of it is working. Days
 * running and the number of live versions are the tell: nobody keeps paying
 * for an ad that doesn't book. Save the good ones to the ad swipe file, then
 * make your own versions in Creative studio.
 */
export default function AdResearch() {
  const [params, setParams] = useSearchParams();
  const tab = params.get("tab") === "swipe" ? "swipe" : "find";
  const cr = useCreatives();
  return (
    <>
      <PageHeader title="Ad research" sub="See what competitors and other local businesses are running, which ads they keep paying for, and save the ones worth learning from." />
      <Tabs value={tab} onChange={(t) => setParams(t === "swipe" ? { tab: "swipe" } : {}, { replace: true })} tabs={[{ id: "find", label: "Find ads" }, { id: "swipe", label: "Ad swipe file", count: cr.swipe.length }]} />
      <div className="mt-5">{tab === "find" ? <FindAds /> : <SwipeList />}</div>
    </>
  );
}

function FindAds() {
  const cr = useCreatives();
  const navigate = useNavigate();
  const studioOn = useOn("ad_studio");
  const { toast, node } = useToast();
  const [q, setQ] = useState("dentist austin");
  const [where, setWhere] = useState("Austin, TX");
  const [platforms, setPlatforms] = useState<AdPlatform[]>(allPlatforms);
  const [ran, setRan] = useState<{ q: string; where: string; platforms: AdPlatform[] }>({ q: "dentist austin", where: "Austin, TX", platforms: allPlatforms });
  const [busy, setBusy] = useState(false);
  const [long, setLong] = useState(false);
  const [format, setFormat] = useState<Format | "all">("all");
  const [sort, setSort] = useState<{ col: Col; dir: "asc" | "desc" }>({ col: "days", dir: "desc" });
  const [sel, setSel] = useState<string[]>([]);
  const [open, setOpen] = useState<string | null>(null);

  const run = (query = q) => { setQ(query); setBusy(true); setSel([]); setTimeout(() => { setRan({ q: query, where, platforms }); setBusy(false); }, 900); };
  const found = useMemo(() => search(ran.q, ran.platforms), [ran]);
  const shown = useMemo(() => {
    const val = (a: LibraryAd) => ({ advertiser: a.advertiser, days: a.active ? a.days : -1, versions: a.versions, angle: angles[a.angle].label, format: formats[a.format].label }[sort.col]);
    return found
      .filter((a) => (!long || (a.active && a.days >= LONG)) && (format === "all" || a.format === format))
      .sort((a, b) => { const x = val(a), y = val(b); return (x < y ? -1 : x > y ? 1 : 0) * (sort.dir === "asc" ? 1 : -1); });
  }, [found, long, format, sort]);
  const picked = shown.filter((a) => sel.includes(a.id));

  // Marko's read of what's working, from the ads that kept running.
  const runners = found.filter((a) => a.active && a.days >= LONG);
  const tally = <K extends string>(xs: K[]) => Object.entries(xs.reduce((m, x) => ({ ...m, [x]: (m[x] ?? 0) + 1 }), {} as Record<string, number>)).sort((a, b) => b[1] - a[1]) as [K, number][];
  const topAngles = tally(runners.map((a) => a.angle));
  const topFormats = tally(runners.map((a) => a.format));
  const offers = [...new Set(runners.map((a) => a.offer).filter(Boolean))];
  const onYourName = found.filter((a) => a.headline.includes(brandFacts.name.split(" & ")[0]));
  const unused = (Object.keys(angles) as Angle[]).filter((a) => !runners.some((r) => r.angle === a));
  const newFromWatched = library.filter((a) => watchedAdvertisers.includes(a.advertiser) && a.days <= 14);

  const sortBy = (col: Col) => setSort((s) => (s.col === col ? { col, dir: s.dir === "asc" ? "desc" : "asc" } : { col, dir: col === "advertiser" || col === "angle" || col === "format" ? "asc" : "desc" }));
  const th = (col: Col, label: string, right = false) => (
    <th key={col} aria-sort={sort.col === col ? (sort.dir === "asc" ? "ascending" : "descending") : "none"} className={cn("px-3 py-2.5 font-normal whitespace-nowrap", right && "text-right")}>
      <button onClick={() => sortBy(col)} className={cn("inline-flex items-center gap-1 hover:text-fg", sort.col === col && "font-medium text-fg")}>
        {label}{sort.col === col ? (sort.dir === "asc" ? <ArrowUp size={12} /> : <ArrowDown size={12} />) : <ChevronsUpDown size={12} className="opacity-40" />}
      </button>
    </th>
  );
  const save = (ads: LibraryAd[]) => { const n = saveToSwipe(ads); toast(n ? `Saved ${n} to the ad swipe file` : "Already in the swipe file"); };
  const variations = (ads: LibraryAd[]) => { saveToSwipe(ads); navigate(`/ads/studio?refs=${ads.map((a) => `sw_${a.id}`).join(",")}`); };
  const field = "h-9 rounded-lg border border-line bg-surface px-3 text-[13.5px] outline-none focus:border-line-strong";

  return (
    <>
      <Card className="mb-4">
        <form onSubmit={(e) => { e.preventDefault(); run(); }} className="flex flex-wrap items-end gap-3">
          <label className="min-w-[220px] flex-[2]">
            <span className="mb-1.5 block text-[12.5px] font-medium text-muted">Advertiser, keyword or service</span>
            <span className="relative block"><Search size={14} className="absolute top-1/2 left-3 -translate-y-1/2 text-subtle" /><input value={q} onChange={(e) => setQ(e.target.value)} className={cn(field, "w-full pl-8")} placeholder="Bright Smile Austin, invisalign…" /></span>
          </label>
          <label className="min-w-[160px] flex-1">
            <span className="mb-1.5 block text-[12.5px] font-medium text-muted">Shown in</span>
            <input value={where} onChange={(e) => setWhere(e.target.value)} className={cn(field, "w-full")} />
          </label>
          <div>
            <span className="mb-1.5 block text-[12.5px] font-medium text-muted">Libraries</span>
            <div className="flex gap-1.5">
              {allPlatforms.map((p) => (
                <button type="button" key={p} aria-pressed={platforms.includes(p)} onClick={() => setPlatforms(platforms.includes(p) ? platforms.filter((x) => x !== p) : [...platforms, p])} className={cn("inline-flex h-9 items-center gap-1.5 rounded-lg border pr-2.5 pl-1.5 text-[13px]", platforms.includes(p) ? "border-ink bg-active" : "border-line text-muted opacity-60 hover:bg-hover")}>
                  <AdPlatformMark platform={p} size={20} />{adPlatforms[p].name.replace(" Ads", "")}
                </button>
              ))}
            </div>
          </div>
          <Button variant="primary" type="submit" disabled={busy || !platforms.length} icon={busy ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}>Search</Button>
        </form>
        <div className="mt-3 flex flex-wrap items-center gap-1.5 text-[12.5px]">
          <span className="text-muted">Try</span>
          {researchStarters.map((s) => <button key={s} onClick={() => run(s)} className="h-6 rounded-full border border-line px-2 hover:bg-hover">{s}</button>)}
          <span className="ml-auto flex items-center gap-1.5 text-muted"><Eye size={13} />Watching {watchedAdvertisers.join(" and ")}{newFromWatched.length > 0 && <button onClick={() => { run(watchedAdvertisers[0]); }} className="text-accent hover:underline">· {newFromWatched.length} new in 2 weeks</button>}</span>
        </div>
      </Card>

      {busy ? (
        <Card className="flex items-center gap-3 text-[13.5px] text-muted"><Loader2 size={16} className="animate-spin" />Reading {platforms.map((p) => adPlatforms[p].name.replace(" Ads", "")).join(", ")} ad libraries for “{q}” in {where}…</Card>
      ) : (
        <>
          {runners.length > 0 && (
            <Card className="mb-4">
              <div className="mb-2 flex items-center gap-2 text-[14px] font-medium"><Sparkles size={14} className="text-accent" />What's working for “{ran.q}” in {ran.where}</div>
              <ul className="m-0 grid list-none gap-x-8 gap-y-1.5 pl-0 text-[13.5px] leading-[1.5] md:grid-cols-2">
                <li><b className="num">{runners.length}</b> of {found.length} ads have run {LONG}+ days. Those are the ones paying for themselves.</li>
                {topAngles[0] && <li>Most common angle among them: <b>{angles[topAngles[0][0]].label}</b> ({topAngles[0][1]}){topAngles[1] && <>, then {angles[topAngles[1][0]].label.toLowerCase()} ({topAngles[1][1]})</>}.</li>}
                {offers.length > 0 && <li>Offers that keep running: {offers.join(" · ")}.</li>}
                {topFormats[0] && <li>Format: {topFormats.map(([f, n]) => `${formats[f].label.toLowerCase()} ${n}`).join(", ")}.</li>}
                {onYourName.length > 0 && <li className="text-bad">{[...new Set(onYourName.map((a) => a.advertiser))].join(", ")} {onYourName.length === 1 ? "is" : "are"} bidding on your name.</li>}
                {unused.length > 0 && <li>Nobody here keeps running <b>{unused.map((a) => angles[a].label.toLowerCase()).join(", ")}</b>. Room to stand out, or a sign it doesn't pay.</li>}
              </ul>
            </Card>
          )}

          <div className="sticky top-12 z-10 -mx-1 mb-3 flex flex-wrap items-center gap-2 bg-bg px-1 py-1.5 lg:top-0">
            {picked.length ? (
              <>
                <span className="text-[13px] font-medium">{picked.length} selected</span>
                <Button size="sm" variant="ghost" onClick={() => setSel([])}>Clear</Button>
                <span className="flex-1" />
                <Button size="sm" icon={<Bookmark size={12} />} onClick={() => { save(picked); setSel([]); }}>Save to swipe file</Button>
                {studioOn && <Button size="sm" variant="primary" icon={<Wand2 size={12} />} onClick={() => variations(picked)}>Make my versions</Button>}
              </>
            ) : (
              <>
                <span className="text-[13px] text-muted"><b className="num text-fg">{shown.length}</b> ads</span>
                <button onClick={() => setLong(!long)} aria-pressed={long} className={cn("inline-flex h-7 items-center gap-1.5 rounded-full border px-2.5 text-[12.5px]", long ? "border-ink bg-ink text-on-ink" : "border-line text-muted hover:bg-hover")}>Running {LONG}+ days<span className="num opacity-70">{runners.length}</span></button>
                <Segmented label="Format" value={format} onChange={setFormat} options={[{ id: "all", label: "All" }, ...(Object.keys(formats) as Format[]).filter((f) => found.some((a) => a.format === f)).map((f) => ({ id: f, label: formats[f].label }))]} />
              </>
            )}
          </div>

          <Card pad={false} className="overflow-x-auto">
            <table className="w-full min-w-[980px] text-[13.5px]">
              <thead className="border-b border-line text-left text-[12.5px] text-muted">
                <tr>
                  <th className="w-10 py-2.5 pl-4"><Checkbox label="Select all" checked={shown.length > 0 && shown.every((a) => sel.includes(a.id))} onChange={(v) => setSel(v ? shown.map((a) => a.id) : [])} /></th>
                  {th("advertiser", "Ad")}
                  {th("angle", "Angle")}
                  {th("format", "Format")}
                  {th("days", "Running", true)}
                  {th("versions", "Live versions", true)}
                  <th className="px-3 py-2.5 font-normal">Offer</th>
                  <th className="w-24" />
                </tr>
              </thead>
              <tbody>
                {shown.map((a) => (
                  <Fragment key={a.id}>
                    <tr onClick={() => setOpen(open === a.id ? null : a.id)} className={cn("cursor-pointer border-b border-line hover:bg-hover/50", sel.includes(a.id) && "bg-active/40", open === a.id && "border-transparent")}>
                      <td className="py-2.5 pl-4" onClick={(e) => e.stopPropagation()}><Checkbox label={`Select ${a.headline}`} checked={sel.includes(a.id)} onChange={(v) => setSel(v ? [...sel, a.id] : sel.filter((x) => x !== a.id))} /></td>
                      <td className="max-w-[440px] px-3 py-2.5">
                        <div className="flex items-center gap-3">
                          <CreativeThumb angle={a.angle} format={a.format} style={styleFor(a.angle, a.format)} headline={a.headline} brand={a.advertiser} w={48} />
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5 text-[12.5px] text-muted"><AdPlatformMark platform={a.platform} size={14} />{a.advertiser}{a.competitor && <Badge>Competitor</Badge>}</div>
                            <div className="truncate font-medium">{a.headline}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-2.5 whitespace-nowrap">{angles[a.angle].label}</td>
                      <td className="px-3 py-2.5 whitespace-nowrap text-muted">{formats[a.format].label}</td>
                      <td className="px-3 py-2.5 text-right whitespace-nowrap">
                        {a.active ? <span className="num">{a.days} days</span> : <span className="text-muted">Stopped after {a.days}d</span>}
                        {a.active && a.days >= LONG && <div><Badge tone="good">Long runner</Badge></div>}
                      </td>
                      <td className="num px-3 py-2.5 text-right">{a.versions}</td>
                      <td className="px-3 py-2.5 text-muted">{a.offer ?? "—"}</td>
                      <td className="px-3 py-2.5 text-right" onClick={(e) => e.stopPropagation()}>
                        <Button size="sm" variant="ghost" aria-label={inSwipe(cr, a.id) ? "Saved" : "Save to swipe file"} title={inSwipe(cr, a.id) ? "In your swipe file" : "Save to swipe file"} onClick={() => save([a])}>{inSwipe(cr, a.id) ? <BookmarkCheck size={14} className="text-accent" /> : <Bookmark size={14} />}</Button>
                        {studioOn && <Button size="sm" variant="ghost" aria-label="Make my versions" title="Make my versions" onClick={() => variations([a])}><Wand2 size={14} /></Button>}
                      </td>
                    </tr>
                    {open === a.id && (
                      <tr className="border-b border-line bg-hover/30">
                        <td />
                        <td colSpan={7} className="px-3 pt-1 pb-4">
                          <div className="grid gap-5 md:grid-cols-[auto_minmax(0,1fr)_minmax(0,1fr)]">
                            <CreativeThumb angle={a.angle} format={a.format} style={styleFor(a.angle, a.format)} headline={a.headline} brand={a.advertiser} site={a.landing.split("/")[0]} w={150} size={a.format === "video" ? "9:16" : "1:1"} />
                            <div className="text-[13.5px] leading-[1.55]">
                              <div className="text-[12px] font-medium text-muted uppercase">The ad</div>
                              <p className="mt-1 mb-2">{a.text}</p>
                              <div className="text-[12.5px] text-muted">Button: {a.cta} · Goes to {a.landing}</div>
                            </div>
                            <div className="text-[13.5px] leading-[1.55]">
                              <div className="text-[12px] font-medium text-muted uppercase">Why it works</div>
                              <p className="mt-1 mb-3">{a.why}</p>
                              <div className="text-[12px] font-medium text-muted uppercase">Your version</div>
                              <p className="mt-1 mb-0">{a.yours}</p>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
                {!shown.length && <tr><td colSpan={8} className="px-5 py-10 text-center text-muted">No ads found. Try a competitor's name or a broader service.</td></tr>}
              </tbody>
            </table>
          </Card>
        </>
      )}
      {node}
    </>
  );
}

const sources: { id: "all" | SwipeAd["source"]; label: string }[] = [{ id: "all", label: "All" }, { id: "library", label: "From research" }, { id: "yours", label: "Your ads" }, { id: "added", label: "Added by hand" }];

function SwipeList() {
  const cr = useCreatives();
  const navigate = useNavigate();
  const studioOn = useOn("ad_studio");
  const [source, setSource] = useState<(typeof sources)[number]["id"]>("all");
  const [angle, setAngle] = useState<Angle | null>(null);
  const [sel, setSel] = useState<string[]>([]);
  const [adding, setAdding] = useState(false);
  const shown = cr.swipe.filter((s) => (source === "all" || s.source === source) && (!angle || s.angle === angle));
  const picked = shown.filter((s) => sel.includes(s.id));
  const usedAngles = (Object.keys(angles) as Angle[]).filter((a) => cr.swipe.some((s) => s.angle === a));

  return (
    <>
      <div className="sticky top-12 z-10 -mx-1 mb-3 flex flex-wrap items-center gap-2 bg-bg px-1 py-1.5 lg:top-0">
        {picked.length ? (
          <>
            <span className="text-[13px] font-medium">{picked.length} selected</span>
            <Button size="sm" variant="ghost" onClick={() => setSel([])}>Clear</Button>
            <span className="flex-1" />
            <Button size="sm" icon={<Trash2 size={12} />} onClick={() => { removeSwipe(picked.map((s) => s.id)); setSel([]); }}>Remove</Button>
            {studioOn && <Button size="sm" variant="primary" icon={<Wand2 size={12} />} onClick={() => navigate(`/ads/studio?refs=${picked.map((s) => s.id).join(",")}`)}>Make my versions</Button>}
          </>
        ) : (
          <>
            <Segmented label="Source" value={source} onChange={setSource} options={sources.map((s) => ({ id: s.id, label: s.label }))} />
            <div className="flex flex-wrap gap-1">
              {usedAngles.map((a) => <button key={a} onClick={() => setAngle(angle === a ? null : a)} aria-pressed={angle === a} className={cn("inline-flex h-7 items-center gap-1.5 rounded-full border px-2.5 text-[12.5px]", angle === a ? "border-ink bg-ink text-on-ink" : "border-line text-muted hover:bg-hover")}>{angles[a].label}<span className="num opacity-70">{cr.swipe.filter((s) => s.angle === a).length}</span></button>)}
            </div>
            <span className="flex-1" />
            <Button size="sm" icon={<Plus size={13} />} onClick={() => setAdding(true)}>Add an ad</Button>
          </>
        )}
      </div>
      <Card pad={false}>
        {shown.map((s) => (
          <article key={s.id} className={cn("flex gap-4 border-b border-line px-4 py-4 last:border-0", sel.includes(s.id) && "bg-active/40")}>
            <div className="pt-1"><Checkbox label={`Select ${s.headline}`} checked={sel.includes(s.id)} onChange={(v) => setSel(v ? [...sel, s.id] : sel.filter((x) => x !== s.id))} /></div>
            <CreativeThumb angle={s.angle} format={s.format} style={styleFor(s.angle, s.format)} headline={s.headline} brand={s.advertiser === "You" ? undefined : s.advertiser} w={84} />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[12.5px] text-muted">
                <AdPlatformMark platform={s.platform} size={14} /><span>{s.advertiser}</span>
                <Badge>{angles[s.angle].label}</Badge><span>{formats[s.format].label}</span>
                {s.days !== undefined && <span>· {s.days} days{s.versions ? `, ${s.versions} versions` : ""}</span>}
                <span className="text-subtle">· saved {timeAgo(s.savedAt)}</span>
              </div>
              <div className="mt-1 text-[14.5px] font-medium">{s.headline}</div>
              <p className="mt-0.5 mb-0 text-[13.5px] leading-[1.55] text-muted">{s.why}</p>
              {s.yours && <p className="mt-1 mb-0 text-[13.5px] leading-[1.55]"><span className="font-medium">Yours: </span>{s.yours}</p>}
              <input defaultValue={s.note} onBlur={(e) => setSwipeNote(s.id, e.target.value)} placeholder="Add a note" aria-label="Note" className="mt-2 h-8 w-full max-w-lg rounded-md border border-transparent bg-transparent px-2 text-[13px] outline-none hover:border-line focus:border-line-strong" />
            </div>
            {studioOn && <div className="shrink-0"><Button size="sm" icon={<Wand2 size={12} />} onClick={() => navigate(`/ads/studio?refs=${s.id}`)}>Make my versions</Button></div>}
          </article>
        ))}
        {!shown.length && <div className="px-5 py-10 text-center text-[13.5px] text-muted">Nothing saved here yet. Save ads from <b>Find ads</b>, or your own winners from Ads.</div>}
      </Card>
      <AddAdModal open={adding} onClose={() => setAdding(false)} />
    </>
  );
}

function AddAdModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const blank = { link: "", advertiser: "", headline: "", text: "", angle: "price" as Angle, format: "image" as Format, platform: "meta" as AdPlatform };
  const [a, setA] = useState(blank);
  if (!open) return null;
  const field = "w-full rounded-lg border border-line bg-surface px-3 text-[13.5px] outline-none focus:border-line-strong";
  const label = "mb-1.5 block text-[12.5px] font-medium text-muted";
  const done = () => { addSwipe({ advertiser: a.advertiser || "Unknown", platform: a.platform, format: a.format, angle: a.angle, headline: a.headline, text: a.text, why: a.link ? `Saved from ${a.link}` : "Added by hand.", note: "" }); setA(blank); onClose(); };
  return (
    <Modal open onClose={onClose} title="Add an ad" width={520} footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button variant="primary" disabled={!a.headline.trim()} onClick={done}>Save to swipe file</Button></>}>
      <div className="space-y-4">
        <label className="block"><span className={label}>Link (Ad Library, TikTok or a post)</span><input value={a.link} onChange={(e) => setA({ ...a, link: e.target.value })} placeholder="https://www.facebook.com/ads/library/?id=…" className={cn(field, "h-9")} /></label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block"><span className={label}>Advertiser</span><input value={a.advertiser} onChange={(e) => setA({ ...a, advertiser: e.target.value })} className={cn(field, "h-9")} /></label>
          <label className="block"><span className={label}>Where</span><select value={a.platform} onChange={(e) => setA({ ...a, platform: e.target.value as AdPlatform })} className={cn(field, "h-9")}>{allPlatforms.map((p) => <option key={p} value={p}>{adPlatforms[p].name}</option>)}</select></label>
        </div>
        <label className="block"><span className={label}>Headline or hook</span><input value={a.headline} onChange={(e) => setA({ ...a, headline: e.target.value })} className={cn(field, "h-9")} /></label>
        <label className="block"><span className={label}>Text</span><textarea value={a.text} onChange={(e) => setA({ ...a, text: e.target.value })} rows={3} className={cn(field, "py-2")} /></label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block"><span className={label}>Angle</span><select value={a.angle} onChange={(e) => setA({ ...a, angle: e.target.value as Angle })} className={cn(field, "h-9")}>{(Object.keys(angles) as Angle[]).map((x) => <option key={x} value={x}>{angles[x].label}</option>)}</select></label>
          <label className="block"><span className={label}>Format</span><select value={a.format} onChange={(e) => setA({ ...a, format: e.target.value as Format })} className={cn(field, "h-9")}>{(Object.keys(formats) as Format[]).map((x) => <option key={x} value={x}>{formats[x].label}</option>)}</select></label>
        </div>
      </div>
    </Modal>
  );
}
