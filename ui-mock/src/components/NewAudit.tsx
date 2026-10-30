import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { Search, MapPin, Loader2, Star, Globe, ShieldAlert, Check, FileSearch } from "lucide-react";
import { Badge, Button, Modal, cn, fmt } from "./ui";
import { defaultSpec, lookupBusiness, opportunity, prospectId, searchMarket, specToQuery, type BizMatch } from "../data/prospects";
import { startRun } from "../lib/runs";
import { recordSaved } from "../lib/saved";

const field = "flex h-10 items-center gap-2 rounded-md border border-line bg-bg px-3 focus-within:border-line-strong";

/**
 * Audit one business you already have in mind, without a prospecting search:
 * find it, confirm it's the right listing, pick the keyword it should win.
 */
export function NewAuditModal({ open, onClose, initialCity = defaultSpec.city }: { open: boolean; onClose: () => void; initialCity?: string }) {
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [city, setCity] = useState(initialCity);
  const [finding, setFinding] = useState(false);
  const [matches, setMatches] = useState<BizMatch[] | null>(null);
  const [pick, setPick] = useState<BizMatch | null>(null);
  const [kw, setKw] = useState("");
  const [radius, setRadius] = useState(5);
  const [creating, setCreating] = useState(false);

  useEffect(() => { if (open) { setQ(""); setMatches(null); setPick(null); setKw(""); setCreating(false); } }, [open]);

  const find = () => {
    if (!q.trim()) return;
    setFinding(true);
    setTimeout(() => {
      const found = lookupBusiness(q, city);
      setMatches(found);
      setPick(found[0] ?? null);
      setKw(found[0]?.keyword ?? "");
      setFinding(false);
    }, 700);
  };

  const create = () => {
    if (!pick || !kw.trim()) return;
    setCreating(true);
    const spec = { ...defaultSpec, q: kw.trim(), city: city.trim() || defaultSpec.city, radiusMi: radius, biz: pick.name };
    startRun("prospect", { label: `Audit · ${pick.name}`, scope: `1 business vs. top 3 · “${spec.q}” · 7×7 grid`, cost: 0.05, seconds: 2 });
    setTimeout(() => {
      const market = searchMarket(spec);
      const id = prospectId(pick.name);
      const p = market.prospects.find((x) => x.id === id);
      const path = `/prospects/${id}${specToQuery(spec)}`;
      recordSaved({ kind: "audit", query: path, title: pick.name, where: `“${spec.q}” · ${spec.city}`, noSite: !pick.website, found: 1, hot: p && opportunity(p, market).label === "Hot" ? 1 : 0 });
      onClose();
      navigate(path);
    }, 2000);
  };

  return (
    <Modal open={open} onClose={() => !creating && onClose()} title="Audit a business" width={560} footer={<>
      <Button variant="ghost" onClick={onClose} disabled={creating}>Cancel</Button>
      <Button variant="primary" disabled={!pick || !kw.trim() || creating} onClick={create} icon={creating ? <Loader2 size={14} className="animate-spin" /> : <FileSearch size={14} />}>
        {creating ? "Building audit…" : "Create audit"}
      </Button>
    </>}>
      <div className="space-y-5">
        <p className="text-[13.5px] text-muted">Already have a business in mind? Skip the search. We'll check its profile, website and map rankings against the top 3 for one keyword.</p>

        <form onSubmit={(e) => { e.preventDefault(); find(); }} className="space-y-2">
          <label className="block text-[13px] font-medium" htmlFor="na-q">Business name or Google Maps link</label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <div className={cn(field, "flex-1")}>
              <Search size={15} className="text-subtle" />
              <input id="na-q" autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Lopez Plumbing, or paste a maps link" className="h-full min-w-0 flex-1 bg-transparent text-[14px] outline-none placeholder:text-subtle" />
            </div>
            <div className={cn(field, "sm:w-44")}>
              <MapPin size={15} className="text-subtle" />
              <input aria-label="City" value={city} onChange={(e) => setCity(e.target.value)} placeholder="City, state" className="h-full min-w-0 flex-1 bg-transparent text-[14px] outline-none placeholder:text-subtle" />
            </div>
            <Button type="submit" className="h-10" disabled={!q.trim() || finding} icon={finding ? <Loader2 size={14} className="animate-spin" /> : undefined}>{finding ? "Finding…" : "Find"}</Button>
          </div>
        </form>

        {matches && (
          <div className="anim-fade">
            <div className="mb-2 text-[13px] font-medium">{matches.length === 1 ? "Is this the one?" : `${matches.length} matches. Pick the right listing`}</div>
            {matches.length ? (
              <ul className="space-y-2" role="radiogroup" aria-label="Matching businesses">
                {matches.map((m) => {
                  const on = pick?.name === m.name;
                  return (
                    <li key={m.name}>
                      <button role="radio" aria-checked={on} onClick={() => { setPick(m); setKw(m.keyword); }} className={cn("flex w-full items-start gap-3 rounded-lg border p-3 text-left transition-colors", on ? "border-ink bg-hover/50" : "border-line hover:bg-hover")}>
                        <span className={cn("mt-0.5 grid size-4 shrink-0 place-items-center rounded-full border", on ? "border-ink bg-ink text-on-ink" : "border-line-strong")}>{on && <Check size={10} strokeWidth={3} />}</span>
                        <span className="min-w-0 flex-1">
                          <span className="block font-medium">{m.name}</span>
                          <span className="block text-[12.5px] text-muted">{m.category} · {m.address}</span>
                          <span className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[12px]">
                            <span className="num inline-flex items-center gap-1"><Star size={11} className="fill-current text-warn" />{m.rating} <span className="text-subtle">({fmt(m.reviews)})</span></span>
                            {m.website ? <span className="text-muted">· {m.website}</span> : <Badge tone="bad"><Globe size={11} /> No website</Badge>}
                            {!m.claimed && <Badge tone="bad"><ShieldAlert size={11} /> Unclaimed</Badge>}
                          </span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            ) : <p className="text-[13px] text-muted">Nothing found. Check the spelling or paste the Google Maps link instead.</p>}
          </div>
        )}

        {pick && (
          <div className="anim-fade grid gap-3 sm:grid-cols-[1fr_auto]">
            <div>
              <label className="mb-1.5 block text-[13px] font-medium" htmlFor="na-kw">Keyword to rank them on</label>
              <div className={field}><input id="na-kw" value={kw} onChange={(e) => setKw(e.target.value)} placeholder="e.g. emergency plumber" className="h-full flex-1 bg-transparent text-[14px] outline-none placeholder:text-subtle" /></div>
              <p className="mt-1 text-[12px] text-subtle">What their customers search for. We guessed it from their category.</p>
            </div>
            <div>
              <label className="mb-1.5 block text-[13px] font-medium" htmlFor="na-r">Area</label>
              <select id="na-r" value={radius} onChange={(e) => setRadius(Number(e.target.value))} className="h-10 rounded-md border border-line bg-bg px-2.5 text-[14px] outline-none">
                {[1, 3, 5, 10].map((r) => <option key={r} value={r}>{r} mi</option>)}
              </select>
            </div>
          </div>
        )}

        {pick && <p className="num text-[12px] text-subtle">≈ $0.05 · profile + reviews, site check, 7×7 map grid for them and the top 3. Saved to your list, so reopening it is free.</p>}
      </div>
    </Modal>
  );
}
