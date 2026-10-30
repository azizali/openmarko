import { Fragment, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { Search, MapPin, Loader2, Star, ChevronRight, Flame, Zap, Target, Globe, ShieldAlert, Megaphone, SlidersHorizontal, Crosshair, Database, Download, UserPlus, X, MessageSquare, Mail, User, FileSearch, Bookmark, History, RefreshCw, Trash2 } from "lucide-react";
import { Badge, Button, Card, Checkbox, Modal, PageHeader, Progress, Segmented, cn, fmt, useToast } from "../components/ui";
import { GridMap, GridLegend, GridThumb } from "../components/GridMap";
import { ProspectMap } from "../components/ProspectMap";
import { ContactCard, ContactIcons } from "../components/ProspectContact";
import { NewAuditModal } from "../components/NewAudit";
import { gridStats } from "../data/mock";
import { googleCategories, leadersOf, opportunity, prospectGrid, prospectSources, searchMarket, specFromParams, specToQuery, suggestedSearches, type Market, type Opportunity, type Prospect, type Spec } from "../data/prospects";
import { startRun, timeAgo } from "../lib/runs";
import { findSaved, recordSaved, removeSaved, sortSaved, togglePin, useSaved, type Saved } from "../lib/saved";

type Sort = "easiest" | "rank" | "value" | "distance";
type Tri = "any" | "yes" | "no";
type LocMode = "city" | "zip" | "pin";
type Filters = {
  website: Tri; claimed: Tri; ads: Tri; agency: Tri; posts: Tri;
  rating: [string, string]; reviews: [string, string]; rank: [string, string]; maxPhotos: string;
  noHours: boolean; noDescription: boolean; staleReviews: boolean;
  slow: boolean; notMobile: boolean; noHttps: boolean; noSchema: boolean; noAnalytics: boolean; cms: string;
  email: "any" | "found" | "verified"; sms: boolean; owner: boolean; employees: string; young: boolean;
};

const noFilters: Filters = {
  website: "any", claimed: "any", ads: "any", agency: "any", posts: "any",
  rating: ["", ""], reviews: ["", ""], rank: ["", ""], maxPhotos: "",
  noHours: false, noDescription: false, staleReviews: false,
  slow: false, notMobile: false, noHttps: false, noSchema: false, noAnalytics: false, cms: "",
  email: "any", sms: false, owner: false, employees: "", young: false,
};

const n = (v: string) => (v.trim() === "" ? null : Number(v));
const tri = (t: Tri, v: boolean) => t === "any" || (t === "yes") === v;
const between = (x: number | null, [lo, hi]: [string, string], missing = 999) => {
  const v = x ?? missing, a = n(lo), b = n(hi);
  return (a === null || v >= a) && (b === null || v <= b);
};

function passes(p: Prospect, f: Filters) {
  const s = p.site, c = p.contact, co = p.company;
  return tri(f.website, !!p.website) && tri(f.claimed, p.claimed) && tri(f.ads, p.runsAds) && tri(f.agency, p.hasAgency) && tri(f.posts, p.posts30d > 0)
    && between(p.rating, f.rating) && between(p.reviews, f.reviews) && between(p.mapRank, f.rank, 21)
    && (n(f.maxPhotos) === null || p.photos <= n(f.maxPhotos)!)
    && (!f.noHours || !p.hasHours) && (!f.noDescription || !p.hasDescription) && (!f.staleReviews || p.lastReviewDays > 60)
    && (!f.slow || (!!s && s.lcp > 2.5)) && (!f.notMobile || (!!s && !s.mobile)) && (!f.noHttps || (!!s && !s.https)) && (!f.noSchema || (!!s && !s.schema))
    && (!f.noAnalytics || (!!p.website && !co.analytics)) && (!f.cms || co.cms === f.cms)
    && (f.email === "any" || (f.email === "found" ? !!c.email : c.emailStatus === "verified"))
    && (!f.sms || c.sms) && (!f.owner || !!c.owner) && (!f.employees || co.employees === f.employees) && (!f.young || (co.founded ?? 0) >= 2023);
}

// One-tap presets. Each one just sets fields in the full filter panel, so the two never disagree.
const presets: { id: string; label: string; icon?: typeof Globe; on: (f: Filters) => boolean; set: (f: Filters, v: boolean) => Filters }[] = [
  { id: "fruit", label: "Low-hanging fruit (#4–15)", on: (f) => f.rank[0] === "4" && f.rank[1] === "15", set: (f, v) => ({ ...f, rank: v ? ["4", "15"] : ["", ""] }) },
  { id: "nosite", label: "No website", icon: Globe, on: (f) => f.website === "no", set: (f, v) => ({ ...f, website: v ? "no" : "any" }) },
  { id: "unclaimed", label: "Unclaimed profile", icon: ShieldAlert, on: (f) => f.claimed === "no", set: (f, v) => ({ ...f, claimed: v ? "no" : "any" }) },
  { id: "noagency", label: "No agency", on: (f) => f.agency === "no", set: (f, v) => ({ ...f, agency: v ? "no" : "any" }) },
  { id: "ads", label: "Already pays for ads", icon: Megaphone, on: (f) => f.ads === "yes", set: (f, v) => ({ ...f, ads: v ? "yes" : "any" }) },
  { id: "sms", label: "Can text", icon: MessageSquare, on: (f) => f.sms, set: (f, v) => ({ ...f, sms: v }) },
  { id: "email", label: "Email found", icon: Mail, on: (f) => f.email !== "any", set: (f, v) => ({ ...f, email: v ? "found" : "any" }) },
  { id: "owner", label: "Owner known", icon: User, on: (f) => f.owner, set: (f, v) => ({ ...f, owner: v }) },
];

const labelTone = { Hot: "bad", Warm: "warn", Cool: "neutral" } as const;
const field = "h-9 rounded-md border border-line bg-bg px-2.5 text-[13.5px] outline-none focus:border-line-strong placeholder:text-subtle";

/** Rough DataForSEO + partner cost for a search, so nobody is surprised by the bill. */
const searchCost = (depth: number) => 0.002 + depth * (0.0006 * 25 + 0.006); // 5×5 grid each + enrichment

export default function Prospects() {
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const saved = useSaved();
  const spec = specFromParams(params);
  const [draft, setDraft] = useState<Spec>(spec);
  const [loc, setLoc] = useState<LocMode>(spec.lat !== null ? "pin" : spec.zip ? "zip" : "city");
  const [loading, setLoading] = useState(false);
  const [sort, setSort] = useState<Sort>("easiest");
  const [f, setF] = useState<Filters>(noFilters);
  const [panel, setPanel] = useState(false);
  const [sources, setSources] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [auditOpen, setAuditOpen] = useState(params.get("new") === "audit");
  useEffect(() => { if (params.get("new") === "audit") setAuditOpen(true); }, [params]);
  const closeAudit = () => {
    setAuditOpen(false);
    if (params.get("new")) { const p = new URLSearchParams(params); p.delete("new"); setParams(p, { replace: true }); }
  };
  const { toast, node } = useToast();

  // Coming back to Prospecting reopens your last search from the saved list instead of the default.
  useEffect(() => {
    const last = sortSaved(saved).filter((x) => x.kind === "search").sort((a, b) => b.refreshedAt - a.refreshedAt)[0];
    if (!params.get("kw") && last) setParams(new URLSearchParams(last.query.slice(1)), { replace: true });
  }, []);

  const qsKey = specToQuery(spec);
  const market = useMemo(() => searchMarket(spec), [qsKey]);
  // A no-website search also pulls the top 3 for comparison; they aren't prospects.
  const allScored = useMemo(() => market.prospects.filter((p) => !spec.noSite || !p.website).map((p) => ({ p, o: opportunity(p, market) })), [market]);
  const current = findSaved(saved, qsKey);
  const rows = useMemo(() => {
    const by: Record<Sort, (a: (typeof allScored)[number], b: (typeof allScored)[number]) => number> = {
      easiest: (a, b) => b.o.score - a.o.score,
      rank: (a, b) => (a.p.mapRank ?? 99) - (b.p.mapRank ?? 99),
      value: (a, b) => b.o.missedRevenue - a.o.missedRevenue,
      distance: (a, b) => a.p.distanceMi - b.p.distanceMi,
    };
    return allScored.filter(({ p }) => passes(p, f)).sort(by[sort]);
  }, [allScored, f, sort]);

  const ranked = [...allScored].sort((a, b) => b.o.score - a.o.score);
  const top = ranked[0];
  const hot = allScored.filter((x) => x.o.label === "Hot").length;
  const reachable = allScored.filter((x) => x.p.contact.owner && (x.p.contact.email || x.p.contact.sms)).length;
  const pipeline = allScored.filter((x) => x.o.label !== "Cool").reduce((a, x) => a + x.o.missedRevenue, 0);
  const active = (Object.keys(noFilters) as (keyof Filters)[]).filter((k) => JSON.stringify(f[k]) !== JSON.stringify(noFilters[k])).length;
  const chosen = rows.filter((r) => sel.has(r.p.id));

  const run = (s: Spec) => {
    if (!s.q.trim()) return;
    const clean: Spec = { ...s, biz: null, q: s.q.trim(), city: s.city.trim() || "Austin, TX", zip: loc === "zip" ? s.zip : null, lat: loc === "pin" ? s.lat : null, lng: loc === "pin" ? s.lng : null };
    setLoading(true);
    startRun("prospect", { label: `${clean.q} · ${loc === "pin" ? `${clean.lat}, ${clean.lng}` : loc === "zip" ? clean.zip : clean.city}`, seconds: 2.5, scope: `${clean.depth} businesses · ${clean.radiusMi} mi`, cost: searchCost(clean.depth) });
    setTimeout(() => {
      const q = specToQuery(clean);
      const m = searchMarket(clean);
      const list = m.prospects.filter((p) => !clean.noSite || !p.website);
      recordSaved({
        kind: "search", query: q, title: clean.q, noSite: clean.noSite,
        where: `${loc === "pin" ? `${clean.lat}, ${clean.lng}` : loc === "zip" ? clean.zip : clean.city} · ${clean.radiusMi} mi`,
        found: list.length, hot: list.filter((p) => opportunity(p, m).label === "Hot").length,
      });
      setParams(new URLSearchParams(q.slice(1))); setExpanded(null); setSel(new Set()); setLoading(false);
    }, 2500);
  };

  const exportCsv = (list: typeof rows) => {
    const cols = ["Business", "Owner", "Owner title", "Phone", "Line type", "Can text", "Email", "Email status", "Website", "Address", "Lat", "Lng", "Map rank", "Rating", "Reviews", "Score", "Missed revenue / mo", "Facebook", "Instagram"];
    const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const lines = list.map(({ p, o }) => [p.name, p.contact.owner?.name, p.contact.owner?.title, p.phone, p.contact.phoneType, p.contact.sms ? "yes" : "no", p.contact.email, p.contact.emailStatus, p.website, p.address, p.lat, p.lng, p.mapRank ?? "20+", p.rating, p.reviews, o.score, o.missedRevenue, p.contact.socials.facebook, p.contact.socials.instagram].map(esc).join(","));
    try {
      const url = URL.createObjectURL(new Blob([[cols.join(","), ...lines].join("\n")], { type: "text/csv" }));
      const a = Object.assign(document.createElement("a"), { href: url, download: `prospects-${market.keyword.replace(/\s+/g, "-")}.csv` });
      a.click();
      URL.revokeObjectURL(url);
    } catch { /* SSR / blocked */ }
    toast(`Exported ${list.length} prospects`);
  };

  const D = (patch: Partial<Spec>) => setDraft((d) => ({ ...d, ...patch }));
  const F = (patch: Partial<Filters>) => setF((x) => ({ ...x, ...patch }));

  return (
    <>
      <PageHeader
        title="Prospecting"
        sub="Find local businesses that need help, see exactly what's wrong, and get the owner's name, phone and email to reach out."
        actions={<>
          <Button icon={<Database size={14} />} onClick={() => setSources(true)}>Data sources</Button>
          <Button variant="primary" icon={<FileSearch size={14} />} onClick={() => setAuditOpen(true)}>Audit a business</Button>
        </>}
      />

      <SavedList items={saved} active={qsKey} onOpen={(x) => { if (x.kind === "audit") navigate(x.query); else { setParams(new URLSearchParams(x.query.slice(1))); setDraft(specFromParams(new URLSearchParams(x.query.slice(1)))); setExpanded(null); setSel(new Set()); } }} />

      <Card className="mb-4">
        <form onSubmit={(e) => { e.preventDefault(); run(draft); }} className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Segmented label="Search by" value={draft.by} onChange={(v) => D({ by: v })} options={[{ id: "keyword", label: "Keyword" }, { id: "category", label: "Google category" }]} />
            <Segmented label="Location" value={loc} onChange={setLoc} options={[{ id: "city", label: "City" }, { id: "zip", label: "ZIP" }, { id: "pin", label: "Lat / lng" }]} />
          </div>
          <div className="flex flex-col gap-2 lg:flex-row">
            <label className="flex h-10 flex-1 items-center gap-2 rounded-md border border-line bg-bg px-3 focus-within:border-line-strong">
              <Search size={15} className="text-subtle" />
              <span className="sr-only">{draft.by === "keyword" ? "Keyword" : "Category"}</span>
              <input list={draft.by === "category" ? "gcats" : undefined} value={draft.q} onChange={(e) => D({ q: e.target.value })} placeholder={draft.by === "keyword" ? "Keyword, e.g. emergency plumber" : "Category, e.g. Roofing contractor"} className="h-full flex-1 bg-transparent text-[14px] outline-none placeholder:text-subtle" />
              <datalist id="gcats">{googleCategories.map((c) => <option key={c} value={c} />)}</datalist>
            </label>
            {loc === "pin" ? (
              <div className="flex gap-2">
                <label className="flex h-10 items-center gap-2 rounded-md border border-line bg-bg px-3 focus-within:border-line-strong">
                  <Crosshair size={15} className="text-subtle" /><span className="sr-only">Latitude</span>
                  <input inputMode="decimal" value={draft.lat ?? ""} onChange={(e) => D({ lat: e.target.value === "" ? null : Number(e.target.value) })} placeholder="30.2672" className="num h-full w-24 bg-transparent text-[14px] outline-none placeholder:text-subtle" />
                </label>
                <label className="flex h-10 items-center rounded-md border border-line bg-bg px-3 focus-within:border-line-strong">
                  <span className="sr-only">Longitude</span>
                  <input inputMode="decimal" value={draft.lng ?? ""} onChange={(e) => D({ lng: e.target.value === "" ? null : Number(e.target.value) })} placeholder="-97.7431" className="num h-full w-24 bg-transparent text-[14px] outline-none placeholder:text-subtle" />
                </label>
              </div>
            ) : (
              <label className="flex h-10 items-center gap-2 rounded-md border border-line bg-bg px-3 focus-within:border-line-strong lg:w-56">
                <MapPin size={15} className="text-subtle" />
                <span className="sr-only">{loc === "zip" ? "ZIP code" : "City"}</span>
                {loc === "zip"
                  ? <input inputMode="numeric" maxLength={5} value={draft.zip ?? ""} onChange={(e) => D({ zip: e.target.value.replace(/\D/g, "") || null })} placeholder="78704" className="num h-full flex-1 bg-transparent text-[14px] outline-none placeholder:text-subtle" />
                  : <input value={draft.city} onChange={(e) => D({ city: e.target.value })} placeholder="City, state" className="h-full flex-1 bg-transparent text-[14px] outline-none placeholder:text-subtle" />}
              </label>
            )}
            <label className="flex h-10 items-center gap-1.5 rounded-md border border-line bg-bg pl-3 text-[13px] text-muted">
              Within
              <select aria-label="Radius" value={draft.radiusMi} onChange={(e) => D({ radiusMi: Number(e.target.value) })} className="h-full bg-transparent pr-2 text-fg outline-none">
                {[1, 3, 5, 10, 15, 25].map((r) => <option key={r} value={r}>{r} mi</option>)}
              </select>
            </label>
            <label className="flex h-10 items-center gap-1.5 rounded-md border border-line bg-bg pl-3 text-[13px] text-muted">
              Pull
              <select aria-label="Number of businesses" value={draft.depth} onChange={(e) => D({ depth: Number(e.target.value) })} className="h-full bg-transparent pr-2 text-fg outline-none">
                {[20, 50, 100].map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
            </label>
            <Button type="submit" variant="primary" className="h-10" disabled={loading || (loc === "pin" && (draft.lat === null || draft.lng === null)) || (loc === "zip" && (draft.zip ?? "").length !== 5)} icon={loading ? <Loader2 size={14} className="animate-spin" /> : <Target size={14} />}>
              {loading ? "Scanning…" : "Find prospects"}
            </Button>
          </div>
          <label className={cn("flex cursor-pointer items-start gap-2.5 rounded-md border px-3 py-2 text-[13px] transition-colors", draft.noSite ? "border-ink bg-hover/60" : "border-line hover:bg-hover")}>
            <span className="pt-0.5"><Checkbox checked={draft.noSite} onChange={(v) => D({ noSite: v })} label="Only businesses with no website" /></span>
            <span>
              <span className="inline-flex items-center gap-1.5 font-medium"><Globe size={13} /> Only businesses with no website</span>
              <span className="block text-[12.5px] text-muted">{draft.noSite ? "Searches Google's business listings in this area and keeps only those with no website (DataForSEO Business Listings, url = null). The map pack top 3 are pulled too, so you can show who they're losing to." : "Your easiest pitch: they need a site before anything else."}</span>
            </span>
          </label>
          <div className="flex flex-wrap items-center gap-1.5 text-[12.5px]">
            <span className="text-subtle">Try</span>
            {suggestedSearches.map((s) => (
              <button type="button" key={s.keyword + s.city} onClick={() => { setLoc("city"); const next = { ...draft, q: s.keyword, city: s.city, by: "keyword" as const }; setDraft(next); run(next); }} className="h-6 rounded-full border border-line px-2.5 text-muted hover:bg-hover hover:text-fg">
                {s.keyword} · {s.city.split(",")[0]}
              </button>
            ))}
            <span className="num ml-auto text-subtle">≈ ${searchCost(draft.depth).toFixed(2)} per search · includes profiles, site checks and contact lookup</span>
          </div>
        </form>
      </Card>

      <div className={cn("transition-opacity", loading && "pointer-events-none opacity-40")}>
        {current && (
          <div className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg border border-line bg-surface px-4 py-2.5 text-[13px]">
            <Bookmark size={14} className={current.pinned ? "fill-current text-accent" : "text-muted"} />
            <span>Saved results for <b className="font-medium">“{current.title}”</b>{current.noSite && " · no website only"} · fetched <b className="font-medium">{timeAgo(current.refreshedAt)}</b></span>
            <span className="text-muted">Reopening a saved search is free.</span>
            <span className="ml-auto flex gap-2">
              <Button size="sm" variant="ghost" icon={<Bookmark size={12} className={current.pinned ? "fill-current" : ""} />} onClick={() => togglePin(current.id)}>{current.pinned ? "Pinned" : "Pin"}</Button>
              <Button size="sm" icon={<RefreshCw size={12} />} disabled={loading} onClick={() => run(spec)}>Refresh · ≈${searchCost(spec.depth).toFixed(2)}</Button>
            </span>
          </div>
        )}
        <div className="mb-6 grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-line bg-line sm:grid-cols-4">
          {[
            [spec.noSite ? "Without a website" : "Businesses found", fmt(allScored.length), `${market.niche} · ${market.spec.lat !== null ? `${market.center.lat}, ${market.center.lng}` : market.spec.zip ?? market.city} · ${market.spec.radiusMi} mi`],
            ["Hot leads", String(hot), "Close to the pack, easy fixes"],
            ["Reachable owners", String(reachable), "Name + email or textable phone"],
            ["Revenue they're missing", `$${fmt(pipeline)}`, `Per month · ${fmt(market.volume)} searches`],
          ].map(([l, v, s]) => (
            <div key={l} className="bg-surface p-5">
              <div className="text-[12.5px] text-muted">{l}</div>
              <div className="num mt-1 font-serif text-[26px] leading-none">{v}</div>
              <div className="mt-1.5 truncate text-[12px] text-subtle">{s}</div>
            </div>
          ))}
        </div>

        {top && <TopPick p={top.p} o={top.o} market={market} to={`/prospects/${top.p.id}${qsKey}`} />}

        <div className="mt-8 mb-3 flex flex-wrap items-center gap-2">
          <h2 className="mr-auto text-[15px] font-medium">All prospects <span className="num text-muted">({rows.length}{rows.length !== allScored.length ? ` of ${allScored.length}` : ""})</span></h2>
          <Segmented label="Sort" value={sort} onChange={setSort} options={[{ id: "easiest", label: "Easiest sale" }, { id: "value", label: "Biggest value" }, { id: "rank", label: "Map rank" }, { id: "distance", label: "Nearest" }]} />
        </div>
        <div className="mb-3 flex flex-wrap items-center gap-1.5">
          <button onClick={() => setPanel(!panel)} aria-expanded={panel} className={cn("inline-flex h-7 items-center gap-1.5 rounded-full border px-3 text-[12.5px] font-medium transition-colors", panel || active ? "border-ink bg-ink text-on-ink" : "border-line-strong hover:bg-hover")}>
            <SlidersHorizontal size={12} /> All filters{active ? <span className="num rounded-full bg-on-ink/20 px-1.5">{active}</span> : null}
          </button>
          {presets.map((pr) => {
            const on = pr.on(f);
            return (
              <button key={pr.id} aria-pressed={on} onClick={() => setF(pr.set(f, !on))} className={cn("inline-flex h-7 items-center gap-1.5 rounded-full border px-3 text-[12.5px] transition-colors", on ? "border-ink bg-ink text-on-ink" : "border-line text-muted hover:bg-hover")}>
                {pr.icon && <pr.icon size={12} />}{pr.label}
              </button>
            );
          })}
          {active > 0 && <button onClick={() => setF(noFilters)} className="inline-flex h-7 items-center gap-1 px-2 text-[12.5px] text-muted hover:text-fg"><X size={12} /> Clear</button>}
        </div>

        {panel && <FilterPanel f={f} F={F} />}

        {chosen.length > 0 && (
          <div className="anim-fade mb-3 flex flex-wrap items-center gap-2 rounded-lg border border-line bg-surface px-4 py-2 text-[13px]">
            <span className="font-medium">{chosen.length} selected</span>
            <span className="text-muted">· {chosen.filter((r) => r.p.contact.email).length} with email · {chosen.filter((r) => r.p.contact.sms).length} can text</span>
            <div className="ml-auto flex gap-2">
              <Button size="sm" icon={<Download size={12} />} onClick={() => exportCsv(chosen)}>Export CSV</Button>
              <Button size="sm" variant="primary" icon={<UserPlus size={12} />} onClick={() => { toast(`${chosen.length} added to pipeline`); setSel(new Set()); }}>Add to pipeline</Button>
            </div>
          </div>
        )}

        <Card pad={false} className="overflow-x-auto">
          <table className="w-full min-w-[1080px] text-[13.5px]">
            <thead className="border-b border-line text-left text-[12.5px] text-muted">
              <tr>
                <th className="w-10 pl-5"><Checkbox label="Select all" checked={rows.length > 0 && chosen.length === rows.length} onChange={(v) => setSel(v ? new Set(rows.map((r) => r.p.id)) : new Set())} /></th>
                <th className="px-3 py-2.5 font-normal">Business</th>
                <th className="px-3 py-2.5 font-normal">Map</th>
                <th className="px-3 py-2.5 font-normal">Ease of sale</th>
                <th className="px-3 py-2.5 text-right font-normal">Map rank</th>
                <th className="px-3 py-2.5 text-right font-normal">Rating</th>
                <th className="px-3 py-2.5 font-normal">Contact</th>
                <th className="px-3 py-2.5 text-right font-normal">Missing / mo</th>
                <th className="px-3 py-2.5 font-normal">Signals</th>
                <th className="pr-5" />
              </tr>
            </thead>
            <tbody>
              {rows.map(({ p, o }) => {
                const on = expanded === p.id;
                return (
                <Fragment key={p.id}>
                <tr onClick={() => setExpanded(on ? null : p.id)} aria-expanded={on} className={cn("cursor-pointer border-b border-line last:border-0", on ? "bg-accent-soft/40" : "hover:bg-hover")}>
                  <td className="pl-5" onClick={(e) => e.stopPropagation()}>
                    <Checkbox label={`Select ${p.name}`} checked={sel.has(p.id)} onChange={() => { const s = new Set(sel); s.has(p.id) ? s.delete(p.id) : s.add(p.id); setSel(s); }} />
                  </td>
                  <td className="px-3 py-3">
                    <span className="inline-flex items-center gap-1.5 font-medium"><ChevronRight size={13} className={cn("text-subtle transition-transform", on && "rotate-90")} />{p.name}</span>
                    <div className="ml-[19px] text-[12px] text-muted">{p.website ?? "No website"} · {p.distanceMi} mi</div>
                  </td>
                  <td className="px-3 py-2"><GridThumb scan={prospectGrid(p, market, 5)} /></td>
                  <td className="w-44 px-3 py-3">
                    <div className="flex items-center gap-2">
                      <Progress value={o.score} tone={o.label === "Hot" ? "accent" : o.label === "Warm" ? "warn" : "ink"} className="w-14" />
                      <span className="num w-6 text-muted">{o.score}</span>
                      <Badge tone={labelTone[o.label]}>{o.label}</Badge>
                    </div>
                  </td>
                  <td className="num px-3 py-3 text-right">
                    {p.mapRank === null ? <span className="text-subtle">20+</span> : <span className={cn(p.mapRank <= 3 ? "text-good" : p.mapRank <= 10 ? "text-warn" : "text-bad")}>#{p.mapRank}</span>}
                    {p.mapRank !== null && o.projectedRank < p.mapRank && <span className="ml-1 text-[12px] text-subtle">→ #{o.projectedRank}</span>}
                  </td>
                  <td className="num px-3 py-3 text-right"><span className="inline-flex items-center gap-1"><Star size={11} className="fill-current text-warn" />{p.rating}</span> <span className="text-[12px] text-subtle">({fmt(p.reviews)})</span></td>
                  <td className="w-40 max-w-40 px-3 py-3"><ContactIcons p={p} /></td>
                  <td className="num px-3 py-3 text-right">{o.missedRevenue ? `$${fmt(o.missedRevenue)}` : <span className="text-subtle">—</span>}</td>
                  <td className="px-3 py-3"><Signals p={p} /></td>
                  <td className="pr-5 text-right"><Link to={`/prospects/${p.id}${qsKey}`} onClick={(e) => e.stopPropagation()} className="inline-flex h-7 items-center gap-1 rounded-md border border-line bg-surface px-2.5 text-[12.5px] font-medium whitespace-nowrap hover:bg-hover">Audit <ChevronRight size={12} /></Link></td>
                </tr>
                {on && (
                  <tr className="border-b border-line bg-bg">
                    <td colSpan={10} className="px-5 py-5">
                      <div className="anim-fade grid gap-6 xl:grid-cols-[minmax(0,1fr)_260px_320px]">
                        <ProspectMap p={p} market={market} compact />
                        <div>
                          <div className="mb-2 text-[12.5px] font-medium text-muted">Quickest fixes <span className="num font-normal text-subtle">({o.easyWins} under an hour, {o.wins.length} total)</span></div>
                          <ul className="space-y-1.5">
                            {o.wins.slice(0, 5).map((w) => <li key={w.id} className="flex items-start gap-2 text-[13px]"><Zap size={13} className="mt-0.5 shrink-0 text-accent" /><span className="flex-1">{w.title}</span><span className="shrink-0 text-[12px] text-subtle">{w.effort}</span></li>)}
                          </ul>
                          <ul className="mt-4 space-y-1 text-[12.5px] text-muted">
                            {o.reasons.slice(0, 3).map((r) => <li key={r}>· {r}</li>)}
                          </ul>
                          <Link to={`/prospects/${p.id}${qsKey}`} className="mt-4 inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-md bg-ink text-[13.5px] font-medium text-on-ink hover:opacity-90">Open sales audit <ChevronRight size={14} /></Link>
                        </div>
                        <ContactCard p={p} />
                      </div>
                    </td>
                  </tr>
                )}
                </Fragment>
                );
              })}
              {!rows.length && <tr><td colSpan={10} className="py-12 text-center text-[13px] text-muted">No businesses match those filters. <button onClick={() => setF(noFilters)} className="underline hover:text-fg">Clear filters</button></td></tr>}
            </tbody>
          </table>
        </Card>
        <div className="mt-3 flex flex-wrap items-start justify-between gap-3">
          <p className="max-w-3xl text-[12px] text-subtle">“Missing / mo” estimates revenue from reaching the top 3, using ~{fmt(market.volume)} searches and a ${fmt(market.ticket)} average job. Contact details come from public sources; verify before outreach, and get consent before sending marketing texts (TCPA).</p>
          <Button size="sm" icon={<Download size={12} />} onClick={() => exportCsv(rows)}>Export all {rows.length}</Button>
        </div>
      </div>

      <Modal open={sources} onClose={() => setSources(false)} title="Where the data comes from" width={620}>
        <div className="space-y-5">
          {prospectSources.map((g) => (
            <section key={g.group}>
              <h4 className="mb-1.5 text-[13px] font-medium">{g.group}</h4>
              <ul className="divide-y divide-line rounded-lg border border-line">
                {g.items.map((it) => (
                  <li key={it.what} className="flex flex-col gap-0.5 px-3 py-2 text-[13px] sm:flex-row sm:items-baseline sm:gap-3">
                    <span className="min-w-[38%] flex-1">{it.what}</span>
                    <span className="text-[12px] text-muted sm:max-w-[58%] sm:text-right">{it.api}{it.partner && <Badge className="ml-1.5">Partner</Badge>}</span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
          <p className="text-[12px] text-subtle">DataForSEO doesn't return emails, line types or owner names directly. Those come from parsing the business's own site plus the partner lookups above.</p>
        </div>
      </Modal>
      <NewAuditModal open={auditOpen} onClose={closeAudit} initialCity={spec.city} />
      {node}
    </>
  );
}

function SavedList({ items, active, onOpen }: { items: Saved[]; active: string; onOpen: (x: Saved) => void }) {
  const [all, setAll] = useState(false);
  const list = sortSaved(items);
  if (!list.length) return null;
  const shown = all ? list : list.slice(0, 4);
  return (
    <section className="mb-4">
      <div className="mb-2 flex items-center gap-2">
        <History size={14} className="text-muted" />
        <h2 className="text-[13.5px] font-medium">Saved searches & audits</h2>
        <span className="text-[12.5px] text-subtle">Every search is saved. Reopen without running it again.</span>
        {list.length > 4 && <button onClick={() => setAll(!all)} className="ml-auto text-[12.5px] text-muted hover:text-fg">{all ? "Show fewer" : `Show all ${list.length}`}</button>}
      </div>
      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        {shown.map((x) => {
          const on = x.kind === "search" && x.query === active;
          return (
            <div key={x.id} className={cn("group relative rounded-lg border bg-surface transition-colors", on ? "border-ink" : "border-line hover:border-line-strong")}>
              <button onClick={() => onOpen(x)} className="block w-full p-3 pr-16 text-left">
                <span className="flex items-center gap-1.5 text-[13.5px] font-medium">
                  {x.kind === "audit" ? <FileSearch size={13} className="shrink-0 text-accent" /> : <Search size={13} className="shrink-0 text-muted" />}
                  <span className="truncate">{x.title}</span>
                </span>
                <span className="mt-0.5 block truncate text-[12px] text-muted">{x.kind === "audit" ? "Audit · " : ""}{x.where}</span>
                <span className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[11.5px] text-subtle">
                  {x.kind === "search" && <span className="num">{x.found} found{x.hot ? ` · ${x.hot} hot` : ""}</span>}
                  {x.noSite && <Badge tone="bad"><Globe size={10} /> No website</Badge>}
                  <span>· {timeAgo(x.refreshedAt)}</span>
                </span>
              </button>
              <span className="absolute top-2 right-2 flex gap-0.5">
                <button onClick={() => togglePin(x.id)} aria-label={x.pinned ? "Unpin" : "Pin"} aria-pressed={x.pinned} className={cn("rounded p-1 hover:bg-hover", x.pinned ? "text-accent" : "text-subtle opacity-0 group-hover:opacity-100 focus:opacity-100")}>
                  <Bookmark size={13} className={x.pinned ? "fill-current" : ""} />
                </button>
                <button onClick={() => removeSaved(x.id)} aria-label={`Remove ${x.title}`} className="rounded p-1 text-subtle opacity-0 hover:bg-hover hover:text-bad group-hover:opacity-100 focus:opacity-100"><Trash2 size={13} /></button>
              </span>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return <div><div className="mb-2.5 text-[12px] font-medium tracking-wide text-muted uppercase">{title}</div><div className="space-y-2.5">{children}</div></div>;
}

function FilterPanel({ f, F }: { f: Filters; F: (p: Partial<Filters>) => void }) {
  const T = ({ label, k, yes = "Yes", no = "No" }: { label: string; k: "website" | "claimed" | "ads" | "agency" | "posts"; yes?: string; no?: string }) => (
    <div className="flex items-center justify-between gap-2">
      <span className="text-[13px]">{label}</span>
      <Segmented label={label} value={f[k]} onChange={(v) => F({ [k]: v } as Partial<Filters>)} options={[{ id: "any", label: "Any" }, { id: "yes", label: yes }, { id: "no", label: no }]} />
    </div>
  );
  const Range = ({ label, k, step }: { label: string; k: "rating" | "reviews" | "rank"; step?: string }) => (
    <div className="flex items-center justify-between gap-2">
      <span className="text-[13px]">{label}</span>
      <span className="flex items-center gap-1">
        <input aria-label={`${label} from`} type="number" step={step} value={f[k][0]} onChange={(e) => F({ [k]: [e.target.value, f[k][1]] } as Partial<Filters>)} placeholder="min" className={cn(field, "num h-8 w-[72px]")} />
        <span className="text-subtle">–</span>
        <input aria-label={`${label} to`} type="number" step={step} value={f[k][1]} onChange={(e) => F({ [k]: [f[k][0], e.target.value] } as Partial<Filters>)} placeholder="max" className={cn(field, "num h-8 w-[72px]")} />
      </span>
    </div>
  );
  const C = ({ label, k }: { label: string; k: "noHours" | "noDescription" | "staleReviews" | "slow" | "notMobile" | "noHttps" | "noSchema" | "noAnalytics" | "sms" | "owner" | "young" }) => (
    <label className="flex cursor-pointer items-center gap-2 text-[13px]"><Checkbox checked={f[k]} onChange={(v) => F({ [k]: v } as Partial<Filters>)} />{label}</label>
  );
  const Sel = ({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: string[] }) => (
    <div className="flex items-center justify-between gap-2">
      <span className="text-[13px]">{label}</span>
      <select aria-label={label} value={value} onChange={(e) => onChange(e.target.value)} className={cn(field, "h-8")}>
        <option value="">Any</option>{options.map((o) => <option key={o}>{o}</option>)}
      </select>
    </div>
  );

  return (
    <Card className="anim-fade mb-4">
      <div className="grid gap-x-8 gap-y-6 md:grid-cols-2 xl:grid-cols-4">
        <Group title="Google profile">
          {T({ label: "Website", k: "website", yes: "Has one", no: "Missing" })}
          {T({ label: "Claimed", k: "claimed" })}
          {T({ label: "Posted in 30 days", k: "posts" })}
          {Range({ label: "Map rank", k: "rank" })}
          {Range({ label: "Rating", k: "rating", step: "0.1" })}
          {Range({ label: "Reviews", k: "reviews" })}
          <div className="flex items-center justify-between gap-2"><span className="text-[13px]">Photos at most</span><input aria-label="Photos at most" type="number" value={f.maxPhotos} onChange={(e) => F({ maxPhotos: e.target.value })} placeholder="e.g. 20" className={cn(field, "num h-8 w-[90px]")} /></div>
          {C({ label: "Hours missing", k: "noHours" })}
          {C({ label: "Description missing", k: "noDescription" })}
          {C({ label: "No review in 60+ days", k: "staleReviews" })}
        </Group>
        <Group title="Website">
          {C({ label: "Slow on mobile (LCP over 2.5s)", k: "slow" })}
          {C({ label: "Not mobile friendly", k: "notMobile" })}
          {C({ label: "No HTTPS", k: "noHttps" })}
          {C({ label: "No LocalBusiness schema", k: "noSchema" })}
          {C({ label: "No analytics installed", k: "noAnalytics" })}
          {Sel({ label: "Built with", value: f.cms, onChange: (v) => F({ cms: v }), options: ["WordPress", "Wix", "Squarespace", "GoDaddy", "Custom"] })}
        </Group>
        <Group title="Marketing & company">
          {T({ label: "Runs Google Ads", k: "ads" })}
          {T({ label: "Has an SEO agency", k: "agency" })}
          {Sel({ label: "Employees", value: f.employees, onChange: (v) => F({ employees: v }), options: ["1–10", "11–50", "51–200"] })}
          {C({ label: "Opened in the last 3 years", k: "young" })}
        </Group>
        <Group title="Contact">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[13px]">Email</span>
            <Segmented label="Email" value={f.email} onChange={(v) => F({ email: v })} options={[{ id: "any", label: "Any" }, { id: "found", label: "Found" }, { id: "verified", label: "Verified" }]} />
          </div>
          {C({ label: "Phone can receive texts", k: "sms" })}
          {C({ label: "Owner name known", k: "owner" })}
          <p className="pt-1 text-[12px] leading-relaxed text-subtle">Filters run on results you already pulled, so they don't cost anything extra.</p>
        </Group>
      </div>
    </Card>
  );
}

function Signals({ p }: { p: Prospect }) {
  return (
    <div className="flex flex-wrap gap-1">
      {!p.site && <Badge tone="bad"><Globe size={11} /> No site</Badge>}
      {!p.claimed && <Badge tone="bad"><ShieldAlert size={11} /> Unclaimed</Badge>}
      {p.runsAds && <Badge tone="info"><Megaphone size={11} /> Ads</Badge>}
      {p.hasAgency && <Badge>Has agency</Badge>}
      {p.posts30d === 0 && p.claimed && <Badge tone="warn">No posts</Badge>}
    </div>
  );
}

function TopPick({ p, o, market, to }: { p: Prospect; o: Opportunity; market: Market; to: string }) {
  const leader = leadersOf(market).find((l) => l.id !== p.id);
  return (
    <Card className="border-accent/40 bg-accent-soft/25">
      <div className="flex flex-col gap-6 md:flex-row">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 text-[12.5px] font-medium text-accent"><Flame size={14} /> Easiest sale in this market</div>
          <h2 className="mt-1.5 font-serif text-[26px] leading-tight">{p.name}</h2>
          <div className="mt-1 text-[13px] text-muted">
            #{p.mapRank ?? "20+"} in the map pack · {p.rating}★ from {fmt(p.reviews)} reviews · {p.website ?? "no website"}
          </div>
          <ul className="mt-4 space-y-1.5 text-[13.5px]">
            {o.reasons.slice(0, 4).map((r) => <li key={r} className="flex gap-2"><span className="mt-[7px] size-1.5 shrink-0 rounded-full bg-accent" />{r}</li>)}
          </ul>
        </div>
        <div className="md:w-[300px]">
          <div className="grid grid-cols-3 gap-3 rounded-lg border border-line bg-surface p-4">
            <div><div className="text-[12px] text-muted">Score</div><div className="num font-serif text-[24px] leading-tight">{o.score}</div></div>
            <div><div className="text-[12px] text-muted">Now → after</div><div className="num font-serif text-[24px] leading-tight">#{p.mapRank ?? "20+"}<span className="text-subtle">→</span>#{o.projectedRank}</div></div>
            <div><div className="text-[12px] text-muted">Value / mo</div><div className="num font-serif text-[24px] leading-tight">${fmt(Math.round(o.missedRevenue / 100) / 10)}k</div></div>
          </div>
          <div className="mt-3 space-y-1.5">
            {o.wins.slice(0, 3).map((w) => (
              <div key={w.id} className="flex items-center gap-2 text-[13px]"><Zap size={13} className="shrink-0 text-accent" /><span className="flex-1 truncate">{w.title}</span><span className="text-[12px] text-subtle">{w.effort}</span></div>
            ))}
          </div>
          <Link to={to} className="mt-4 inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-md bg-ink text-[13.5px] font-medium text-on-ink hover:opacity-90">Open sales audit <ChevronRight size={14} /></Link>
        </div>
      </div>
      <div className="mt-6 grid gap-4 border-t border-line pt-5 sm:grid-cols-2">
        {[p, leader].filter((x): x is Prospect => !!x).map((x) => {
          const scan = prospectGrid(x, market, 7);
          const st = gridStats(scan);
          return (
            <div key={x.id}>
              <div className="mb-2 flex items-baseline justify-between gap-2 text-[13px]">
                <span className="truncate"><span className="num text-muted">#{x.mapRank ?? "20+"}</span> <b className={cn("font-medium", x.id === p.id && "text-accent")}>{x.name}</b> {x.id !== p.id && <span className="text-muted">(the leader)</span>}</span>
                <span className="num shrink-0 text-muted">top 3 in {st.solv.toFixed(0)}%</span>
              </div>
              <GridMap scan={scan} compact />
            </div>
          );
        })}
        <div className="sm:col-span-2 flex flex-wrap items-center justify-between gap-2"><GridLegend /><span className="text-[12px] text-subtle">Same search, from 49 points within 3 miles</span></div>
      </div>
    </Card>
  );
}
