import { Fragment, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { Search, MapPin, Loader2, Star, ChevronRight, Flame, Zap, Target, Globe, ShieldAlert, Megaphone, SlidersHorizontal, Crosshair, Database, Download, UserPlus, X, MessageSquare, Mail, User, FileSearch, Bookmark, History, RefreshCw, Trash2, Eye, Send, ArrowUp, ArrowDown, ChevronsUpDown } from "lucide-react";
import { Badge, Button, Card, Checkbox, Modal, PageHeader, Progress, Segmented, cn, fmt, useToast } from "../components/ui";
import { GridThumb } from "../components/GridMap";
import { ProspectMap } from "../components/ProspectMap";
import { ContactCard, ContactIcons } from "../components/ProspectContact";
import { NewAuditModal } from "../components/NewAudit";
import { LeadBadge, SendToCampaignButton, SendToCampaignModal } from "../components/Outreach";
import { leadFor, useOutreach, type LeadStatus } from "../lib/outreach";
import { googleCategories, opportunity, prospectGrid, prospectSources, searchMarket, specFromParams, specToQuery, suggestedSearches, type Prospect, type Spec } from "../data/prospects";
import { startRun, timeAgo } from "../lib/runs";
import { ensureShare, shareFor, shareUrl, useShares } from "../lib/shares";
import { findSaved, recordSaved, removeSaved, sortSaved, togglePin, useSaved, type Saved } from "../lib/saved";

type Col = "name" | "score" | "rank" | "rating" | "contact" | "value" | "distance" | "status";
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

const ease = {
  Hot: { label: "Easy", tone: "good", bar: "good" },
  Warm: { label: "Medium", tone: "warn", bar: "warn" },
  Cool: { label: "Hard", tone: "bad", bar: "ink" },
} as const;
const field = "h-9 rounded-md border border-line bg-bg px-2.5 text-[13.5px] outline-none focus:border-line-strong placeholder:text-subtle";

/** Rough DataForSEO + partner cost for a search, so nobody is surprised by the bill. */
const searchCost = (depth: number) => 0.002 + depth * (0.0006 * 25 + 0.006); // 5×5 grid each + enrichment
const whereOf = (s: Spec) => (s.lat !== null ? `${s.lat}, ${s.lng}` : s.zip ?? s.city);

// Outreach status, furthest along first, for sorting.
const statusOrder: Record<LeadStatus, number> = { booked: 8, interested: 7, replied: 6, sent: 5, queued: 4, not_interested: 2, bounced: 1 };
const reach = (p: Prospect) => (p.contact.owner ? 4 : 0) + (p.contact.emailStatus === "verified" ? 3 : p.contact.email ? 2 : 0) + (p.contact.sms ? 1 : 0);

export default function Prospects() {
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const saved = useSaved();
  const shares = useShares();
  const outreach = useOutreach();
  const [sending, setSending] = useState(false);
  const spec = specFromParams(params);
  const [draft, setDraft] = useState<Spec>(spec);
  const [mode, setMode] = useState<"one" | "bulk">("one");
  const [bulkKw, setBulkKw] = useState("");
  const [bulkWhere, setBulkWhere] = useState("");
  const [bulk, setBulk] = useState<{ done: number; total: number } | null>(null);
  const [loc, setLoc] = useState<LocMode>(spec.lat !== null ? "pin" : spec.zip ? "zip" : "city");
  const [loading, setLoading] = useState(false);
  const [sort, setSort] = useState<{ col: Col; dir: "asc" | "desc" }>({ col: "score", dir: "desc" });
  const [f, setF] = useState<Filters>(noFilters);
  const [text, setText] = useState("");
  const [fresh, setFresh] = useState(false);
  const [panel, setPanel] = useState(false);
  const [sources, setSources] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [cursor, setCursor] = useState(0);
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
  const pathOf = (p: Prospect) => `/prospects/${p.id}${qsKey}`;
  // A no-website search also pulls the top 3 for comparison; they aren't prospects.
  const allScored = useMemo(() => market.prospects.filter((p) => !spec.noSite || !p.website).map((p) => ({ p, o: opportunity(p, market) })), [market]);
  const current = findSaved(saved, qsKey);
  const topId = allScored.reduce<(typeof allScored)[number] | null>((a, x) => (!a || x.o.score > a.o.score ? x : a), null)?.p.id;
  const rows = useMemo(() => {
    const key: Record<Col, (x: (typeof allScored)[number]) => number | string> = {
      name: (x) => x.p.name,
      score: (x) => x.o.score,
      rank: (x) => x.p.mapRank ?? 99,
      rating: (x) => x.p.rating * 100_000 + x.p.reviews,
      contact: (x) => reach(x.p),
      value: (x) => x.o.missedRevenue,
      distance: (x) => x.p.distanceMi,
      status: (x) => { const l = leadFor(outreach, pathOf(x.p)); return l ? statusOrder[l.status] : (shareFor(shares, pathOf(x.p))?.views.length ? 3 : 0); },
    };
    const k = key[sort.col], sign = sort.dir === "asc" ? 1 : -1;
    const q = text.trim().toLowerCase();
    return allScored
      .filter(({ p }) => passes(p, f) && (!q || `${p.name} ${p.address} ${p.contact.owner?.name ?? ""}`.toLowerCase().includes(q)) && (!fresh || !leadFor(outreach, pathOf(p))))
      .sort((a, b) => { const x = k(a), y = k(b); return sign * (typeof x === "string" ? x.localeCompare(y as string) : x - (y as number)); });
  }, [allScored, f, sort, text, fresh, outreach, shares]);

  const easy = allScored.filter((x) => x.o.label === "Hot").length;
  const reachable = allScored.filter((x) => x.p.contact.owner && (x.p.contact.email || x.p.contact.sms)).length;
  const pipeline = allScored.filter((x) => x.o.label !== "Cool").reduce((a, x) => a + x.o.missedRevenue, 0);
  const active = (Object.keys(noFilters) as (keyof Filters)[]).filter((k) => JSON.stringify(f[k]) !== JSON.stringify(noFilters[k])).length + (fresh ? 1 : 0) + (text.trim() ? 1 : 0);
  const chosen = rows.filter((r) => sel.has(r.p.id));
  const cur = Math.min(cursor, rows.length - 1);
  const toggle = (id: string) => setSel((s0) => { const s = new Set(s0); s.has(id) ? s.delete(id) : s.add(id); return s; });
  const selectWhere = (fn: (x: (typeof rows)[number]) => boolean) => setSel(new Set(rows.filter(fn).map((r) => r.p.id)));
  const sortBy = (col: Col) => setSort((s) => (s.col === col ? { col, dir: s.dir === "asc" ? "desc" : "asc" } : { col, dir: col === "name" || col === "rank" || col === "distance" ? "asc" : "desc" }));
  const clearFilters = () => { setF(noFilters); setFresh(false); setText(""); };

  // Work down the list without the mouse: j/k move, x selects, Enter opens the row, a opens the audit, s sends the selection.
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (e.metaKey || e.ctrlKey || e.altKey || t.closest("input, textarea, select, [role=dialog]")) return;
      const r = rows[cur];
      if (e.key === "j" || e.key === "ArrowDown") setCursor(Math.min(rows.length - 1, cur + 1));
      else if (e.key === "k" || e.key === "ArrowUp") setCursor(Math.max(0, cur - 1));
      else if (e.key === "x" && r) toggle(r.p.id);
      else if (e.key === "Enter" && r && !t.closest("button, a")) setExpanded(expanded === r.p.id ? null : r.p.id);
      else if (e.key === "a" && r) navigate(pathOf(r.p));
      else if (e.key === "s" && chosen.length) setSending(true);
      else return;
      e.preventDefault();
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [rows, cur, expanded, chosen.length]);
  useEffect(() => { document.querySelector(`[data-row="${rows[cur]?.p.id}"]`)?.scrollIntoView({ block: "nearest" }); }, [cur]);

  const record = (clean: Spec) => {
    const m = searchMarket(clean);
    const list = m.prospects.filter((p) => !clean.noSite || !p.website);
    recordSaved({ kind: "search", query: specToQuery(clean), title: clean.q, noSite: clean.noSite, where: `${whereOf(clean)} · ${clean.radiusMi} mi`, found: list.length, hot: list.filter((p) => opportunity(p, m).label === "Hot").length });
  };
  const open = (q: string) => { setParams(new URLSearchParams(q.slice(1))); setDraft(specFromParams(new URLSearchParams(q.slice(1)))); setExpanded(null); setSel(new Set()); setCursor(0); };

  const run = (s: Spec) => {
    if (!s.q.trim()) return;
    const clean: Spec = { ...s, biz: null, q: s.q.trim(), city: s.city.trim() || "Austin, TX", zip: loc === "zip" ? s.zip : null, lat: loc === "pin" ? s.lat : null, lng: loc === "pin" ? s.lng : null };
    setLoading(true);
    startRun("prospect", { label: `${clean.q} · ${whereOf(clean)}`, seconds: 2.5, scope: `${clean.depth} businesses · ${clean.radiusMi} mi`, cost: searchCost(clean.depth) });
    setTimeout(() => { record(clean); open(specToQuery(clean)); setLoading(false); }, 2500);
  };

  // Every keyword in every place. Each one is saved, so you work through them from the list on the left.
  const lines = (v: string) => [...new Set(v.split(/\n|;/).map((x) => x.trim()).filter(Boolean))];
  const bulkSpecs = lines(bulkKw).flatMap((q) => lines(bulkWhere).map((w): Spec => ({ ...draft, q, biz: null, lat: null, lng: null, ...(/^\d{5}$/.test(w) ? { zip: w } : { zip: null, city: w }) })));
  const runBulk = () => {
    if (!bulkSpecs.length) return;
    setBulk({ done: 0, total: bulkSpecs.length });
    bulkSpecs.forEach((s, i) => {
      startRun("prospect", { label: `${s.q} · ${whereOf(s)}`, seconds: 2 + i * 0.8, scope: `${s.depth} businesses · ${s.radiusMi} mi`, cost: searchCost(s.depth) });
      setTimeout(() => {
        record(s);
        setBulk({ done: i + 1, total: bulkSpecs.length });
        if (i === bulkSpecs.length - 1) { open(specToQuery(bulkSpecs[0])); setBulk(null); toast(`${bulkSpecs.length} searches saved. Work through them from the list.`); }
      }, 2000 + i * 800);
    });
  };

  const exportCsv = (list: typeof rows) => {
    const cols = ["Business", "Owner", "Owner title", "Phone", "Line type", "Can text", "Email", "Email status", "Website", "Address", "Lat", "Lng", "Map rank", "Rating", "Reviews", "Score", "Ease", "Missed revenue / mo", "Audit link", "Facebook", "Instagram"];
    const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const lines = list.map(({ p, o }) => [p.name, p.contact.owner?.name, p.contact.owner?.title, p.phone, p.contact.phoneType, p.contact.sms ? "yes" : "no", p.contact.email, p.contact.emailStatus, p.website, p.address, p.lat, p.lng, p.mapRank ?? "20+", p.rating, p.reviews, o.score, ease[o.label].label, o.missedRevenue, shareUrl(ensureShare(pathOf(p), p.name).token), p.contact.socials.facebook, p.contact.socials.instagram].map(esc).join(","));
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
  const busy = loading || !!bulk;

  // Called as a function, not rendered as a component, so the header keeps focus after sorting.
  const th = (col: Col, children: React.ReactNode, right?: boolean) => (
    <th key={col} aria-sort={sort.col === col ? (sort.dir === "asc" ? "ascending" : "descending") : "none"} className={cn("px-3 py-2.5 font-normal", right && "text-right")}>
      <button onClick={() => sortBy(col)} className={cn("inline-flex items-center gap-1 hover:text-fg", sort.col === col && "font-medium text-fg")}>
        {children}
        {sort.col === col ? (sort.dir === "asc" ? <ArrowUp size={12} /> : <ArrowDown size={12} />) : <ChevronsUpDown size={12} className="opacity-40" />}
      </button>
    </th>
  );

  return (
    <>
      <PageHeader
        title="Prospecting"
        sub="Find local businesses that need help, see exactly what's wrong, and send them their audit."
        actions={<>
          <Button icon={<Database size={14} />} onClick={() => setSources(true)}>Data sources</Button>
          <Button variant="primary" icon={<FileSearch size={14} />} onClick={() => setAuditOpen(true)}>Audit a business</Button>
        </>}
      />

      <div className="grid gap-4 2xl:grid-cols-[264px_minmax(0,1fr)] 2xl:gap-6">
        <SavedRail items={saved} active={qsKey} onOpen={(x) => (x.kind === "audit" ? navigate(x.query) : open(x.query))} />

        <div className="min-w-0">
          <Card className="mb-4">
            <form onSubmit={(e) => { e.preventDefault(); mode === "one" ? run(draft) : runBulk(); }} className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <Segmented label="Mode" value={mode} onChange={setMode} options={[{ id: "one", label: "One search" }, { id: "bulk", label: "Bulk" }]} />
                <Segmented label="Search by" value={draft.by} onChange={(v) => D({ by: v })} options={[{ id: "keyword", label: "Keyword" }, { id: "category", label: "Google category" }]} />
                {mode === "one" && <Segmented label="Location" value={loc} onChange={setLoc} options={[{ id: "city", label: "City" }, { id: "zip", label: "ZIP" }, { id: "pin", label: "Lat / lng" }]} />}
              </div>
              {mode === "one" ? (
                <div className="flex flex-col gap-2 lg:flex-row">
                  <label className="flex h-10 flex-1 items-center gap-2 rounded-md border border-line bg-bg px-3 focus-within:border-line-strong">
                    <Search size={15} className="text-subtle" />
                    <span className="sr-only">{draft.by === "keyword" ? "Keyword" : "Category"}</span>
                    <input list={draft.by === "category" ? "gcats" : undefined} value={draft.q} onChange={(e) => D({ q: e.target.value })} placeholder={draft.by === "keyword" ? "Keyword, e.g. emergency plumber" : "Category, e.g. Roofing contractor"} className="h-full flex-1 bg-transparent text-[14px] outline-none placeholder:text-subtle" />
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
                    <label className="flex h-10 items-center gap-2 rounded-md border border-line bg-bg px-3 focus-within:border-line-strong lg:w-52">
                      <MapPin size={15} className="text-subtle" />
                      <span className="sr-only">{loc === "zip" ? "ZIP code" : "City"}</span>
                      {loc === "zip"
                        ? <input inputMode="numeric" maxLength={5} value={draft.zip ?? ""} onChange={(e) => D({ zip: e.target.value.replace(/\D/g, "") || null })} placeholder="78704" className="num h-full flex-1 bg-transparent text-[14px] outline-none placeholder:text-subtle" />
                        : <input value={draft.city} onChange={(e) => D({ city: e.target.value })} placeholder="City, state" className="h-full flex-1 bg-transparent text-[14px] outline-none placeholder:text-subtle" />}
                    </label>
                  )}
                  <SearchSize draft={draft} D={D} />
                  <Button type="submit" variant="primary" className="h-10" disabled={busy || (loc === "pin" && (draft.lat === null || draft.lng === null)) || (loc === "zip" && (draft.zip ?? "").length !== 5)} icon={loading ? <Loader2 size={14} className="animate-spin" /> : <Target size={14} />}>
                    {loading ? "Scanning…" : "Find prospects"}
                  </Button>
                </div>
              ) : (
                <div className="grid gap-2 md:grid-cols-2">
                  <label className="block">
                    <span className="mb-1 block text-[12.5px] font-medium text-muted">{draft.by === "keyword" ? "Keywords" : "Categories"}, one per line</span>
                    <textarea rows={4} value={bulkKw} onChange={(e) => setBulkKw(e.target.value)} placeholder={"plumber\nwater heater repair\ndrain cleaning"} className="w-full resize-y rounded-md border border-line bg-bg p-2.5 text-[13.5px] outline-none placeholder:text-subtle focus:border-line-strong" />
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-[12.5px] font-medium text-muted">Cities or ZIPs, one per line</span>
                    <textarea rows={4} value={bulkWhere} onChange={(e) => setBulkWhere(e.target.value)} placeholder={"Austin, TX\nRound Rock, TX\n78704"} className="w-full resize-y rounded-md border border-line bg-bg p-2.5 text-[13.5px] outline-none placeholder:text-subtle focus:border-line-strong" />
                  </label>
                  <div className="flex flex-wrap items-center gap-2 md:col-span-2">
                    <SearchSize draft={draft} D={D} />
                    <span className="num text-[12.5px] text-muted">{bulkSpecs.length} search{bulkSpecs.length === 1 ? "" : "es"} · up to {fmt(bulkSpecs.length * draft.depth)} businesses · ≈ ${(bulkSpecs.length * searchCost(draft.depth)).toFixed(2)}</span>
                    <Button type="submit" variant="primary" className="ml-auto h-10" disabled={busy || !bulkSpecs.length} icon={bulk ? <Loader2 size={14} className="animate-spin" /> : <Target size={14} />}>
                      {bulk ? `Running ${bulk.done} of ${bulk.total}…` : `Run ${bulkSpecs.length || ""} searches`}
                    </Button>
                  </div>
                </div>
              )}
              <datalist id="gcats">{googleCategories.map((c) => <option key={c} value={c} />)}</datalist>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[12.5px]">
                <label className="inline-flex cursor-pointer items-center gap-1.5" title="Searches Google's business listings and keeps those with no website. The map pack top 3 are pulled too, so you can show who they're losing to.">
                  <Checkbox checked={draft.noSite} onChange={(v) => D({ noSite: v })} label="Only businesses with no website" /><Globe size={12} className="text-muted" /> Only businesses with no website
                </label>
                {mode === "one" && (
                  <span className="flex flex-wrap items-center gap-1.5">
                    <span className="text-subtle">Try</span>
                    {suggestedSearches.map((s) => (
                      <button type="button" key={s.keyword + s.city} onClick={() => { setLoc("city"); const next = { ...draft, q: s.keyword, city: s.city, by: "keyword" as const }; setDraft(next); run(next); }} className="h-6 rounded-full border border-line px-2.5 text-muted hover:bg-hover hover:text-fg">
                        {s.keyword} · {s.city.split(",")[0]}
                      </button>
                    ))}
                  </span>
                )}
                {mode === "one" && <span className="num ml-auto text-subtle">≈ ${searchCost(draft.depth).toFixed(2)} per search, with profiles, site checks and contacts</span>}
              </div>
            </form>
          </Card>

          <div className={cn("transition-opacity", busy && "pointer-events-none opacity-40")}>
            {/* One line about this search: what it is, what's in it, and when it was fetched. */}
            <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-2">
              <h2 className="text-[16px] font-medium">“{market.keyword}” <span className="font-normal text-muted">· {spec.lat !== null ? `${market.center.lat}, ${market.center.lng}` : spec.zip ?? market.city} · {spec.radiusMi} mi{spec.noSite ? " · no website only" : ""}</span></h2>
              <span className="num flex flex-wrap gap-x-3 text-[13px] text-muted">
                <span><b className="font-medium text-fg">{allScored.length}</b> found</span>
                <span><b className="font-medium text-good">{easy}</b> easy</span>
                <span><b className="font-medium text-fg">{reachable}</b> reachable owners</span>
                <span title={`Per month, from ${fmt(market.volume)} searches`}><b className="font-medium text-fg">${fmt(pipeline)}</b>/mo missed</span>
              </span>
              {current && (
                <span className="ml-auto flex items-center gap-1.5 text-[12.5px] text-muted">
                  Fetched {timeAgo(current.refreshedAt)}
                  <Button size="sm" variant="ghost" icon={<Bookmark size={12} className={current.pinned ? "fill-current text-accent" : ""} />} onClick={() => togglePin(current.id)}>{current.pinned ? "Pinned" : "Pin"}</Button>
                  <Button size="sm" icon={<RefreshCw size={12} />} disabled={busy} onClick={() => run(spec)}>Refresh · ≈${searchCost(spec.depth).toFixed(2)}</Button>
                </span>
              )}
            </div>

            <div className="mb-3 flex flex-wrap items-center gap-1.5">
              <label className="flex h-7 items-center gap-1.5 rounded-full border border-line bg-surface px-2.5 focus-within:border-line-strong">
                <Search size={12} className="text-subtle" /><span className="sr-only">Find in results</span>
                <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Find in results" className="w-32 bg-transparent text-[12.5px] outline-none placeholder:text-subtle" />
              </label>
              <button onClick={() => setPanel(!panel)} aria-expanded={panel} className={cn("inline-flex h-7 items-center gap-1.5 rounded-full border px-3 text-[12.5px] font-medium transition-colors", panel || active ? "border-ink bg-ink text-on-ink" : "border-line-strong hover:bg-hover")}>
                <SlidersHorizontal size={12} /> All filters{active ? <span className="num rounded-full bg-on-ink/20 px-1.5">{active}</span> : null}
              </button>
              <button aria-pressed={fresh} onClick={() => setFresh(!fresh)} className={cn("inline-flex h-7 items-center gap-1.5 rounded-full border px-3 text-[12.5px] transition-colors", fresh ? "border-ink bg-ink text-on-ink" : "border-line text-muted hover:bg-hover")}><Send size={12} />Not contacted yet</button>
              {presets.map((pr) => {
                const on = pr.on(f);
                return (
                  <button key={pr.id} aria-pressed={on} onClick={() => setF(pr.set(f, !on))} className={cn("inline-flex h-7 items-center gap-1.5 rounded-full border px-3 text-[12.5px] transition-colors", on ? "border-ink bg-ink text-on-ink" : "border-line text-muted hover:bg-hover")}>
                    {pr.icon && <pr.icon size={12} />}{pr.label}
                  </button>
                );
              })}
              {active > 0 && <button onClick={clearFilters} className="inline-flex h-7 items-center gap-1 px-2 text-[12.5px] text-muted hover:text-fg"><X size={12} /> Clear</button>}
            </div>

            {panel && <FilterPanel f={f} F={F} />}

            {/* Select and act in one place. Stays in view while you scroll the list. */}
            <div className="sticky top-12 z-10 -mx-1 mb-2 lg:top-0 flex flex-wrap items-center gap-x-2 gap-y-1.5 rounded-lg border border-line bg-surface px-3 py-2 text-[12.5px] shadow-card">
              {chosen.length ? (
                <>
                  <span className="font-medium text-fg">{chosen.length} selected</span>
                  <span className="text-muted">· {chosen.filter((r) => r.p.contact.email).length} with email · {chosen.filter((r) => r.p.contact.sms).length} can text</span>
                  <button onClick={() => setSel(new Set())} className="text-muted underline decoration-line-strong underline-offset-2 hover:text-fg">Clear</button>
                  <span className="ml-auto flex flex-wrap gap-1.5">
                    <Button size="sm" icon={<Download size={12} />} onClick={() => exportCsv(chosen)}>Export</Button>
                    <Button size="sm" icon={<UserPlus size={12} />} onClick={() => { toast(`${chosen.length} added to pipeline`); setSel(new Set()); }}>Add to pipeline</Button>
                    <Button size="sm" variant="primary" icon={<Send size={12} />} onClick={() => setSending(true)}>Send {chosen.length} to campaign</Button>
                  </span>
                </>
              ) : (
                <>
                  <span className="num text-muted"><b className="font-medium text-fg">{rows.length}</b>{rows.length !== allScored.length ? ` of ${allScored.length}` : ""} shown · select</span>
                  {([
                    ["All", () => true],
                    ["Easy", (x) => x.o.label === "Hot"],
                    ["Verified email", (x) => x.p.contact.emailStatus === "verified"],
                    ["Not contacted", (x) => !leadFor(outreach, pathOf(x.p))],
                  ] as [string, (x: (typeof rows)[number]) => boolean][]).map(([l, fn]) => (
                    <button key={l} onClick={() => selectWhere(fn)} className="num h-6 rounded-full border border-line px-2.5 text-muted hover:bg-hover hover:text-fg">{l} <span className="text-subtle">{rows.filter(fn).length}</span></button>
                  ))}
                  <span className="ml-auto flex items-center gap-2">
                    <span className="hidden text-subtle lg:inline"><Kbd>j</Kbd><Kbd>k</Kbd> move · <Kbd>x</Kbd> select · <Kbd>↵</Kbd> open · <Kbd>a</Kbd> audit · <Kbd>s</Kbd> send</span>
                    <Button size="sm" icon={<Download size={12} />} onClick={() => exportCsv(rows)}>Export {rows.length}</Button>
                  </span>
                </>
              )}
            </div>

            <Card pad={false} className="overflow-x-auto">
              <table className="w-full min-w-[1120px] text-[13.5px]">
                <thead className="border-b border-line text-left text-[12.5px] text-muted">
                  <tr>
                    <th className="w-10 pl-5"><Checkbox label="Select all" checked={rows.length > 0 && chosen.length === rows.length} onChange={(v) => setSel(v ? new Set(rows.map((r) => r.p.id)) : new Set())} /></th>
                    {th("name", "Business")}
                    <th className="px-3 py-2.5 font-normal">Map</th>
                    {th("score", "Ease of sale")}
                    {th("rank", "Rank", true)}
                    {th("rating", "Rating", true)}
                    {th("contact", "Contact")}
                    {th("value", "Missing / mo", true)}
                    {th("distance", "Distance", true)}
                    <th className="px-3 py-2.5 font-normal">Signals</th>
                    {th("status", "Outreach")}
                    <th className="pr-5" />
                  </tr>
                </thead>
                <tbody>
                  {rows.map(({ p, o }, i) => {
                    const on = expanded === p.id;
                    const lead = leadFor(outreach, pathOf(p));
                    const views = shareFor(shares, pathOf(p))?.views.length ?? 0;
                    return (
                    <Fragment key={p.id}>
                    <tr data-row={p.id} onClick={() => { setCursor(i); setExpanded(on ? null : p.id); }} aria-expanded={on} className={cn("cursor-pointer border-b border-line last:border-0", on ? "bg-accent-soft/40" : sel.has(p.id) ? "bg-hover/70" : "hover:bg-hover", i === cur && "shadow-[inset_2px_0_0_var(--ink)]")}>
                      <td className="pl-5" onClick={(e) => e.stopPropagation()}>
                        <Checkbox label={`Select ${p.name}`} checked={sel.has(p.id)} onChange={() => toggle(p.id)} />
                      </td>
                      <td className="max-w-64 px-3 py-3">
                        <span className="flex items-center gap-1.5 font-medium"><ChevronRight size={13} className={cn("shrink-0 text-subtle transition-transform", on && "rotate-90")} /><span className="truncate">{p.name}</span></span>
                        <div className="ml-[19px] flex items-center gap-1.5 text-[12px] text-muted">
                          {p.id === topId && <span className="inline-flex shrink-0 items-center gap-0.5 font-medium text-accent"><Flame size={11} />Easiest sale ·</span>}
                          <span className="truncate">{p.website ?? "No website"}</span>
                        </div>
                      </td>
                      <td className="px-3 py-2"><GridThumb scan={prospectGrid(p, market, 5)} /></td>
                      <td className="w-48 px-3 py-3">
                        <div className="flex items-center gap-2">
                          <Progress value={o.score} tone={ease[o.label].bar} className="w-12" />
                          <span className="num w-6 text-muted">{o.score}</span>
                          <Badge tone={ease[o.label].tone}>{ease[o.label].label}</Badge>
                        </div>
                      </td>
                      <td className="num px-3 py-3 text-right whitespace-nowrap">
                        {p.mapRank === null ? <span className="text-subtle">20+</span> : <span className={cn(p.mapRank <= 3 ? "text-good" : p.mapRank <= 10 ? "text-warn" : "text-bad")}>#{p.mapRank}</span>}
                        {p.mapRank !== null && o.projectedRank < p.mapRank && <span className="ml-1 text-[12px] text-subtle">→ #{o.projectedRank}</span>}
                      </td>
                      <td className="num px-3 py-3 text-right whitespace-nowrap"><span className="inline-flex items-center gap-1"><Star size={11} className="fill-current text-warn" />{p.rating}</span> <span className="text-[12px] text-subtle">({fmt(p.reviews)})</span></td>
                      <td className="w-40 max-w-40 px-3 py-3"><ContactIcons p={p} /></td>
                      <td className="num px-3 py-3 text-right">{o.missedRevenue ? `$${fmt(o.missedRevenue)}` : <span className="text-subtle">—</span>}</td>
                      <td className="num px-3 py-3 text-right text-muted">{p.distanceMi} mi</td>
                      <td className="px-3 py-3"><Signals p={p} /></td>
                      <td className="px-3 py-3">
                        <span className="flex flex-wrap items-center gap-1">
                          {lead && <LeadBadge lead={lead} />}
                          {views > 0 && <span title={`Opened the shared audit ${views} time${views > 1 ? "s" : ""}`} className="num inline-flex items-center gap-0.5 rounded-full bg-good-soft px-1.5 py-0.5 text-[11.5px] font-medium text-good"><Eye size={11} />{views}</span>}
                          {!lead && !views && <span className="text-subtle">—</span>}
                        </span>
                      </td>
                      <td className="pr-5 text-right" onClick={(e) => e.stopPropagation()}>
                        <span className="inline-flex items-center gap-1">
                          <SendToCampaignButton compact p={p} o={o} market={market} qsKey={qsKey} onSent={toast} />
                          <Link to={pathOf(p)} className="inline-flex h-7 items-center gap-1 rounded-md border border-line bg-surface px-2.5 text-[12.5px] font-medium whitespace-nowrap hover:bg-hover">Audit <ChevronRight size={12} /></Link>
                        </span>
                      </td>
                    </tr>
                    {on && (
                      <tr className="border-b border-line bg-bg">
                        <td colSpan={12} className="px-5 py-5">
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
                              <Link to={pathOf(p)} className="mt-4 inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-md bg-ink text-[13.5px] font-medium text-on-ink hover:opacity-90">Open sales audit <ChevronRight size={14} /></Link>
                              <SendToCampaignButton p={p} o={o} market={market} qsKey={qsKey} onSent={toast} className="mt-2 flex w-full justify-center" />
                            </div>
                            <ContactCard p={p} />
                          </div>
                        </td>
                      </tr>
                    )}
                    </Fragment>
                    );
                  })}
                  {!rows.length && <tr><td colSpan={12} className="py-12 text-center text-[13px] text-muted">No businesses match those filters. <button onClick={clearFilters} className="underline hover:text-fg">Clear filters</button></td></tr>}
                </tbody>
              </table>
            </Card>
            <p className="mt-3 max-w-3xl text-[12px] text-subtle">Ease of sale weighs how close they are to the top 3, how many fixes take under an hour, their rating, and whether they already have an agency. “Missing / mo” assumes ~{fmt(market.volume)} searches and a ${fmt(market.ticket)} average job. Contact details come from public sources; verify before outreach, and get consent before sending marketing texts (TCPA).</p>
          </div>
        </div>
      </div>

      <Modal open={sources} onClose={() => setSources(false)} title="What we check" width={620}>
        <div className="space-y-5">
          {prospectSources.map((g) => (
            <section key={g.group}>
              <h4 className="mb-1.5 text-[13px] font-medium">{g.group}</h4>
              <ul className="divide-y divide-line rounded-lg border border-line">
                {g.items.map((it) => (
                  <li key={it.what} className="flex flex-col gap-0.5 px-3 py-2 text-[13px] sm:flex-row sm:items-baseline sm:gap-3">
                    <span className="min-w-[38%] flex-1">{it.what}</span>
                    {it.partner && <span className="sm:text-right"><Badge>Partner</Badge></span>}
                  </li>
                ))}
              </ul>
            </section>
          ))}
          <p className="text-[12px] text-subtle">Emails, line types and owner names come from the business's own website plus the partner lookups marked above.</p>
        </div>
      </Modal>
      <SendToCampaignModal open={sending} onClose={() => setSending(false)} items={chosen} market={market} qsKey={qsKey} onSent={(m) => { toast(m); setSel(new Set()); }} />
      <NewAuditModal open={auditOpen} onClose={closeAudit} initialCity={spec.city} />
      {node}
    </>
  );
}

const Kbd = ({ children }: { children: React.ReactNode }) => <kbd className="mx-0.5 rounded border border-line bg-bg px-1 font-mono text-[11px] text-muted">{children}</kbd>;

function SearchSize({ draft, D }: { draft: Spec; D: (p: Partial<Spec>) => void }) {
  return (
    <>
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
    </>
  );
}

/**
 * Every search and direct audit, as a vertical list you can filter: pinned
 * first, then most recent. On narrow screens it folds behind a button.
 */
function SavedRail({ items, active, onOpen }: { items: Saved[]; active: string; onOpen: (x: Saved) => void }) {
  const [q, setQ] = useState("");
  const [kind, setKind] = useState<"all" | "search" | "audit">("all");
  const [open, setOpen] = useState(false);
  const list = sortSaved(items).filter((x) => (kind === "all" || x.kind === kind) && (!q.trim() || `${x.title} ${x.where}`.toLowerCase().includes(q.trim().toLowerCase())));
  const pinned = list.filter((x) => x.pinned), recent = list.filter((x) => !x.pinned);
  const Item = ({ x }: { x: Saved }) => {
    const on = x.kind === "search" && x.query === active;
    return (
      <li className={cn("group relative border-l-2", on ? "border-ink bg-active" : "border-transparent hover:bg-hover")}>
        <button onClick={() => { onOpen(x); setOpen(false); }} className="block w-full py-2 pr-14 pl-3 text-left">
          <span className="flex items-center gap-1.5 text-[13px]">
            {x.kind === "audit" ? <FileSearch size={12} className="shrink-0 text-accent" /> : <Search size={12} className="shrink-0 text-subtle" />}
            <span className={cn("truncate", on && "font-medium")}>{x.title}</span>
            {x.noSite && <Globe size={11} className="shrink-0 text-bad" aria-label="No website only" />}
          </span>
          <span className="mt-0.5 flex items-center gap-1.5 pl-[18px] text-[11.5px] text-subtle">
            <span className="truncate">{x.where}</span>
            <span className="ml-auto shrink-0">{timeAgo(x.refreshedAt)}</span>
          </span>
        </button>
        {x.kind === "search" && x.hot > 0 && <span className="num pointer-events-none absolute top-2 right-2 rounded-full bg-good-soft px-1.5 text-[11px] font-medium text-good group-hover:opacity-0" title={`${x.hot} easy of ${x.found}`}>{x.hot}</span>}
        <span className="absolute top-1.5 right-1.5 flex gap-0.5 opacity-0 group-hover:opacity-100 focus-within:opacity-100">
          <button onClick={() => togglePin(x.id)} aria-label={x.pinned ? "Unpin" : "Pin"} aria-pressed={x.pinned} className={cn("rounded p-1 hover:bg-surface", x.pinned ? "text-accent" : "text-subtle")}><Bookmark size={12} className={x.pinned ? "fill-current" : ""} /></button>
          <button onClick={() => removeSaved(x.id)} aria-label={`Remove ${x.title}`} className="rounded p-1 text-subtle hover:bg-surface hover:text-bad"><Trash2 size={12} /></button>
        </span>
      </li>
    );
  };
  const Group = ({ title, xs }: { title: string; xs: Saved[] }) => xs.length ? (
    <>
      <li className="px-3 pt-3 pb-1 text-[11px] font-medium tracking-[0.06em] text-subtle uppercase">{title}</li>
      {xs.map((x) => <Item key={x.id} x={x} />)}
    </>
  ) : null;
  return (
    <aside className="min-w-0 2xl:sticky 2xl:top-6 2xl:self-start">
      <button onClick={() => setOpen(!open)} aria-expanded={open} className="flex h-9 w-full items-center gap-2 rounded-lg border border-line bg-surface px-3 text-[13px] shadow-card 2xl:hidden">
        <History size={14} className="text-muted" />Saved searches & audits <span className="num text-muted">({items.length})</span><ChevronRight size={14} className={cn("ml-auto text-subtle transition-transform", open && "rotate-90")} />
      </button>
      <Card pad={false} className={cn("mt-2 flex max-h-[60dvh] flex-col 2xl:mt-0 2xl:max-h-[calc(100dvh-3rem)]", !open && "hidden 2xl:flex")}>
        <div className="space-y-2 border-b border-line p-3">
          <div className="flex items-center gap-1.5"><History size={14} className="text-muted" /><h2 className="text-[13.5px] font-medium">Saved</h2><span className="num text-[12px] text-subtle">{items.length}</span></div>
          <label className="flex h-8 items-center gap-1.5 rounded-md border border-line bg-bg px-2 focus-within:border-line-strong">
            <Search size={12} className="text-subtle" /><span className="sr-only">Filter saved</span>
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filter by keyword or place" className="min-w-0 flex-1 bg-transparent text-[12.5px] outline-none placeholder:text-subtle" />
          </label>
          <Segmented label="Show" value={kind} onChange={setKind} options={[{ id: "all", label: "All" }, { id: "search", label: "Searches" }, { id: "audit", label: "Audits" }]} />
        </div>
        <ul className="min-h-0 flex-1 overflow-y-auto pb-2">
          <Group title="Pinned" xs={pinned} />
          <Group title="Recent" xs={recent} />
          {!list.length && <li className="px-3 py-6 text-center text-[12.5px] text-muted">{items.length ? "Nothing matches." : "Searches you run are saved here. Reopening one is free."}</li>}
        </ul>
        <p className="border-t border-line px-3 py-2 text-[11.5px] text-subtle">Every search is saved. Reopening one is free; green is how many are easy.</p>
      </Card>
    </aside>
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
