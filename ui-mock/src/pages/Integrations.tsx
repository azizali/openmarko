import { useState } from "react";
import { useSearchParams } from "react-router";
import { X } from "lucide-react";
import { Badge, Button, Card, PageHeader, SearchInput, Segmented, cn } from "../components/ui";
import { IntegrationMark, StatusBadge, blockedReason } from "../components/Integrations";
import { capabilities, capabilityOf, categories, providers, type Category, type CapabilityId, type Provider } from "../data/integrations";
import { featureOf } from "../data/features";
import { connectProvider, connectionsOf, manageProvider, providerName, replaces, servingOf, targetsOf, useConnections, type Connection } from "../lib/integrations";
import { useAccess } from "../lib/access";

/**
 * Everything the Organization is connected to, in one place. Connect once here
 * and every feature that can use it does; feature pages show the same
 * connections inline and open the same drawer.
 */
export default function Integrations() {
  const list = useConnections();
  useAccess();
  const [params, setParams] = useSearchParams();
  const cat = params.get("cat") as Category | null;
  const cap = params.get("cap") as CapabilityId | null;
  const [view, setView] = useState<"apps" | "powers">("apps");
  const [q, setQ] = useState("");
  const setParam = (k: string, v: string | null) => { const n = new URLSearchParams(params); if (v) n.set(k, v); else n.delete(k); if (k === "cat") n.delete("cap"); setParams(n, { replace: true }); };

  const match = (p: Provider) =>
    (!cat || p.category === cat) && (!cap || p.capabilities.includes(cap)) &&
    (!q.trim() || `${p.name} ${p.vendor ?? ""} ${p.category} ${p.capabilities.map((c) => capabilityOf(c).label).join(" ")}`.toLowerCase().includes(q.trim().toLowerCase()));
  const shown = providers.filter(match);
  const connectedCount = (c: Category) => providers.filter((p) => p.category === c && connectionsOf(list, p.id).length).length;

  return (
    <>
      <PageHeader title="Integrations" sub="Everything connected, and what each one powers. Connect once here and every feature that can use it does." />
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <Segmented label="View" value={view} onChange={setView} options={[{ id: "apps", label: "Apps" }, { id: "powers", label: "What they power" }]} />
          <SearchInput size="sm" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search apps or what they do" aria-label="Search integrations" className="w-auto min-w-56 flex-1 sm:max-w-xs" />
          <span className="ml-auto text-[12.5px] text-muted">{list.length} connected</span>
        </div>

        {view === "apps" && (
          <>
            <div className="flex flex-wrap gap-1.5" role="group" aria-label="Category">
              {[null, ...categories].map((c) => (
                <button key={c ?? "all"} onClick={() => setParam("cat", c)} aria-pressed={cat === c} className={cn("inline-flex h-7 items-center gap-1.5 rounded-full border px-2.5 text-[12.5px] transition-colors", cat === c ? "border-ink bg-ink text-on-ink" : "border-line bg-surface text-muted hover:text-fg")}>
                  {c ?? "All"}{c && connectedCount(c) > 0 && <span className={cn("num", cat === c ? "opacity-70" : "text-subtle")}>{connectedCount(c)}</span>}
                </button>
              ))}
            </div>
            {cap && (
              <div className="flex items-center gap-2 rounded-lg bg-hover px-3 py-2 text-[13px]">
                <span className="flex-1">Apps that can <b>{capabilityOf(cap).label.toLowerCase()}</b>. {capabilityOf(cap).max === "one" ? "One at a time; connecting another replaces it." : "Connect as many as you use."}</span>
                <button onClick={() => setParam("cap", null)} aria-label="Clear filter" className="rounded p-1 text-muted hover:bg-surface hover:text-fg"><X size={14} /></button>
              </div>
            )}
            {categories.filter((c) => shown.some((p) => p.category === c)).map((c) => (
              <section key={c}>
                <h2 className="mb-2 text-[12px] font-medium tracking-[0.06em] text-subtle uppercase">{c}</h2>
                <div className="grid gap-3 md:grid-cols-2">
                  {shown.filter((p) => p.category === c).map((p) => <ProviderCard key={p.id} p={p} list={list} />)}
                </div>
              </section>
            ))}
            {!shown.length && <p className="py-10 text-center text-[13.5px] text-muted">Nothing matches “{q}”.</p>}
          </>
        )}

        {view === "powers" && <Powers list={list} q={q} onPick={(c) => { setView("apps"); setParams({ cap: c }, { replace: true }); }} />}
      </div>
    </>
  );
}

function ProviderCard({ p, list }: { p: Provider; list: Connection[] }) {
  const mine = connectionsOf(list, p.id);
  const why = blockedReason(p, list);
  const name = providerName(p);
  // A second email sender, texting provider or sequencer replaces the one in use.
  const current = !mine.length && (p.attach === "organization" || p.attach === "partner") ? replaces(list, p, targetsOf(p.attach)[0]) : [];
  return (
    <Card className="flex flex-col gap-3">
      <div className="flex items-start gap-3">
        <IntegrationMark p={p} size={36} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2 text-[14px] font-medium">{name}{p.vendor && <span className="text-[12px] font-normal text-subtle">{p.vendor}</span>}{mine.length === 1 && <StatusBadge c={mine[0]} />}{mine.length > 1 && <Badge tone="good">{mine.length} connected</Badge>}</div>
          <div className="text-[12.5px] text-muted">{mine.length ? mine.map((c) => (c.target.kind === "organization" ? c.account : `${c.target.label}`)).join(" · ") : p.blurb}</div>
        </div>
      </div>
      <div className="flex flex-wrap gap-1">
        {p.capabilities.map((c) => <span key={c} className="rounded-full bg-hover px-2 py-0.5 text-[11.5px] text-muted">{capabilityOf(c).label}</span>)}
      </div>
      <div className="mt-auto flex items-center gap-2">
        {mine.length ? <Button size="sm" onClick={() => manageProvider(p.id)}>Manage</Button> : <Button size="sm" variant={current.length ? "secondary" : "primary"} disabled={!!why} title={why ?? undefined} onClick={() => connectProvider(p.id)}>{current.length ? "Switch" : "Connect"}</Button>}
        {!mine.length && <Button size="sm" variant="ghost" onClick={() => manageProvider(p.id)}>Details</Button>}
        {(why || current.length > 0) && !mine.length && <span className="truncate text-[12px] text-subtle">{why ?? `Replaces ${current.map((c) => providerName(providers.find((x) => x.id === c.provider)!)).join(", ")}`}</span>}
      </div>
    </Card>
  );
}

/** Every capability, what powers it, and the gaps: the view that answers "why doesn't X work?". */
function Powers({ list, q, onPick }: { list: Connection[]; q: string; onPick: (c: CapabilityId) => void }) {
  const caps = capabilities.filter((c) => !q.trim() || `${c.label} ${c.does}`.toLowerCase().includes(q.trim().toLowerCase()));
  return (
    <Card pad={false}>
      {caps.map((c) => {
        const serving = servingOf(list, c.id);
        return (
          <div key={c.id} className="flex flex-wrap items-start gap-3 border-b border-line px-5 py-3.5 last:border-0">
            <div className="min-w-0 flex-1 basis-64">
              <div className="text-[13.5px] font-medium">{c.label}</div>
              <div className="text-[12.5px] text-muted">{c.does}</div>
              {c.usedBy.length > 0 && <div className="mt-1 text-[12px] text-subtle">Used by {c.usedBy.map((f) => featureOf(f).label).join(", ")}</div>}
            </div>
            <div className="flex flex-wrap items-center justify-end gap-1.5">
              {serving.map((x) => { const p = providers.find((y) => y.id === x.provider)!; return (
                <button key={x.id} onClick={() => manageProvider(p.id)} className="inline-flex h-8 items-center gap-1.5 rounded-full border border-line bg-surface pr-2.5 pl-1 text-[12.5px] hover:bg-hover" title={`${providerName(p)} · ${x.account}`}>
                  <IntegrationMark p={p} size={22} />{providerName(p)}{x.target.kind !== "organization" && x.target.kind !== "partner" && <span className="text-subtle">· {x.target.label}</span>}
                </button>
              ); })}
              {(!serving.length || c.max === "many" || c.per === "location" || c.per === "website") && (
                <Button size="sm" variant={serving.length ? "ghost" : "primary"} onClick={() => onPick(c.id)}>{serving.length ? "Add" : "Connect"}</Button>
              )}
            </div>
          </div>
        );
      })}
    </Card>
  );
}
