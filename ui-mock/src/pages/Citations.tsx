import { useMemo, useState } from "react";
import { useSearchParams } from "react-router";
import { locations } from "../data/mock";
import { citationsFor, linkData } from "../data/scoped";
import { ExternalUrl, LocationOverview, ScopeBar, WebsiteOverview } from "../components/Scope";
import { useScopedLocation, useScopedWebsite } from "../lib/scope";
import { Needs } from "../components/Needs";
import { Sparkles, Wrench, Plus, Loader2, Mail, Check, MapPin, ArrowUp, ArrowDown, Copy } from "lucide-react";
import { Badge, Button, Card, CardHeader, Checkbox, Drawer, LineChart, Modal, PageHeader, ScoreRing, Segmented, Tabs, cn, useToast } from "../components/ui";
import { business } from "../data/mock";
import { backlinks, citationScore, citationStatusMeta, linkHistory, linkOpportunities, linkSummary, type Citation, type CitationStatus, type LinkOpportunity, type LinkStatus } from "../data/authority";
import { startRun } from "../lib/runs";
import { Can } from "../components/Can";

type Tab = "citations" | "links";

export default function Citations() {
  const [params, setParams] = useSearchParams();
  const tab: Tab = params.get("tab") === "links" ? "links" : "citations";
  const { location } = useScopedLocation();
  const { website, missing } = useScopedWebsite();
  return (
    <>
      <PageHeader
        title="Citations & backlinks"
        sub="Where your business is listed and who links to you. Both tell Google, and the AI assistants that copy from these sites, that you're a real, trusted local business."
      />
      {/* Citations are a Location's listings; backlinks point at a Website. */}
      <ScopeBar kind={tab === "citations" ? "location" : "website"} />
      <Tabs value={tab} onChange={(t) => setParams(t === "links" ? { tab: "links" } : {}, { replace: true })} tabs={[
        { id: "citations", label: "Citations", count: (location ? citationsFor(location.id) : locations.flatMap((l) => citationsFor(l.id))).filter((c) => c.status !== "correct").length },
        { id: "links", label: "Backlinks", count: linkOpportunities.filter((l) => l.status === "idea").length },
      ]} />
      <div className="mt-6">
        {tab === "citations"
          ? location ? <CitationsTab key={location.id} seed={citationsFor(location.id)} /> : (
            <LocationOverview columns={["Citation health", "Wrong details", "Missing"]} row={(id) => {
              const list = citationsFor(id);
              return [`${citationScore(list)}`, list.filter((c) => c.status === "wrong" || c.status === "duplicate").length, list.filter((c) => c.status === "missing").length];
            }} />
          )
          : website ? <LinksTab key={website.id} websiteId={website.id} /> : missing ? <Needs kind="website" locationId={location?.id} note="Backlinks point at a website." /> : (
            <WebsiteOverview columns={["Referring domains", "Local sites", "New, 30 days"]} row={(w) => { const y = linkData[w.id].you; return [y.refDomains, y.localDomains, `+${y.new30}`]; }} />
          )}
      </div>
    </>
  );
}

// ---------- Citations ----------

type Building = Record<string, "running" | "submitted">;

function CitationsTab({ seed }: { seed: Citation[] }) {
  const [list, setList] = useState(seed);
  const [filter, setFilter] = useState<CitationStatus | "all" | "ai">("all");
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [building, setBuilding] = useState<Building>({});
  const [confirm, setConfirm] = useState(false);
  const { toast, node } = useToast();
  const score = citationScore(list);
  const count = (s: CitationStatus) => list.filter((c) => c.status === s).length;
  const rows = list.filter((c) => filter === "all" || (filter === "ai" ? c.aiCited : c.status === filter));
  const actionable = (c: Citation) => c.status !== "correct" && !building[c.id];
  const chosen = list.filter((c) => sel.has(c.id) && actionable(c));
  const gap = list.filter((c) => c.status === "missing" && c.rivalsListed >= 3);

  const run = (ids: string[]) => {
    const items = list.filter((c) => ids.includes(c.id));
    setBuilding((b) => ({ ...b, ...Object.fromEntries(ids.map((id) => [id, "running" as const])) }));
    startRun("citations", { label: `Citation fixes · ${items.length} sites`, scope: items.map((c) => c.site).slice(0, 3).join(", ") + (items.length > 3 ? ` +${items.length - 3}` : ""), cost: items.reduce((a, c) => a + c.cost, 0), seconds: 4 });
    setTimeout(() => {
      setBuilding((b) => ({ ...b, ...Object.fromEntries(ids.map((id) => [id, "submitted" as const])) }));
      // Direct-API listings update right away; the rest are submitted and go live in 2–6 weeks.
      setList((xs) => xs.map((c) => (ids.includes(c.id) && c.method === "Direct API" ? { ...c, status: "correct", issue: undefined } : c)));
      toast(`${ids.length} submitted · we re-check each site weekly until it's live`);
    }, 4000);
    setSel(new Set());
    setConfirm(false);
  };

  return (
    <>
      <div className="mb-6 grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)]">
        <Card className="flex items-center gap-5">
          <ScoreRing score={score} size={88} stroke={7} label="Citation health" />
          <div>
            <div className="text-[12.5px] text-muted">Citation health</div>
            <div className="mt-1 text-[14px] font-medium">{list.length - count("correct")} of {list.length} key sites need attention</div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <Badge tone="good">{count("correct")} correct</Badge>
              <Badge tone="warn">{count("wrong")} wrong info</Badge>
              <Badge tone="bad">{count("missing")} missing</Badge>
              <Badge tone="info">{count("duplicate")} duplicate</Badge>
            </div>
          </div>
        </Card>
        <Card>
          <CardHeader title="Why this matters" />
          <ul className="space-y-2 text-[13px] text-muted">
            <li className="flex gap-2"><MapPin size={14} className="mt-0.5 shrink-0 text-accent" />Wrong addresses or phones on big sites confuse Google about where you are, which can cost map-pack spots.</li>
            <li className="flex gap-2"><Sparkles size={14} className="mt-0.5 shrink-0 text-accent" /><span><b className="font-medium text-fg">{list.filter((c) => c.aiCited && c.status !== "correct").length} sites AI assistants quote</b> are missing you or have wrong details.</span></li>
            {gap.length > 0 && <li className="flex gap-2"><Plus size={14} className="mt-0.5 shrink-0 text-accent" />Most competitors are on {gap.map((g) => g.site).join(", ")}. You aren't.</li>}
          </ul>
        </Card>
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Segmented label="Filter" value={filter} onChange={setFilter} options={[
          { id: "all", label: "All" }, { id: "wrong", label: `Wrong (${count("wrong")})` }, { id: "missing", label: `Missing (${count("missing")})` },
          { id: "duplicate", label: `Duplicates (${count("duplicate")})` }, { id: "ai", label: <span className="inline-flex items-center gap-1"><Sparkles size={11} /> AI cites</span> },
        ]} />
        <span className="ml-auto flex gap-2">
          <Button size="sm" onClick={() => setSel(new Set(list.filter(actionable).map((c) => c.id)))}>Select all fixes</Button>
          <Button size="sm" variant="primary" icon={<Wrench size={12} />} disabled={!chosen.length} onClick={() => setConfirm(true)}>Fix & build {chosen.length || ""}</Button>
        </span>
      </div>

      <Card pad={false} className="overflow-x-auto">
        <table className="w-full min-w-[860px] text-[13.5px]">
          <thead className="border-b border-line text-left text-[12.5px] text-muted">
            <tr>
              <th className="w-10 pl-5" />
              <th className="px-3 py-2.5 font-normal">Site</th>
              <th className="px-3 py-2.5 font-normal">Status</th>
              <th className="px-3 py-2.5 text-right font-normal" title="How much weight the site carries, 0–100">Authority</th>
              <th className="px-3 py-2.5 text-right font-normal">Rivals listed</th>
              <th className="px-3 py-2.5 font-normal">How we fix it</th>
              <th className="px-3 py-2.5 pr-5 text-right font-normal">Action</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((c) => {
              const m = citationStatusMeta[c.status];
              const b = building[c.id];
              return (
                <tr key={c.id} className="border-b border-line last:border-0 hover:bg-hover/50">
                  <td className="pl-5">{actionable(c) && <Checkbox label={`Select ${c.site}`} checked={sel.has(c.id)} onChange={() => { const s = new Set(sel); s.has(c.id) ? s.delete(c.id) : s.add(c.id); setSel(s); }} />}</td>
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-1.5 font-medium">{c.site}{c.aiCited && <span title="AI assistants cite this site for local recommendations"><Sparkles size={12} className="text-accent" /></span>}</div>
                    <div className="text-[12px] text-muted"><ExternalUrl domain={c.domain} /> · {c.kind}</div>
                  </td>
                  <td className="px-3 py-2.5">
                    <Badge tone={m.tone}>{m.label}</Badge>
                    {c.issue && <div className="mt-0.5 text-[12px] text-muted">{c.issue}</div>}
                  </td>
                  <td className="num px-3 py-2.5 text-right">{c.authority}</td>
                  <td className={cn("num px-3 py-2.5 text-right", c.status === "missing" && c.rivalsListed >= 3 && "font-medium text-bad")}>{c.rivalsListed}/5</td>
                  <td className="px-3 py-2.5 text-[12.5px] text-muted">{c.method}</td>
                  <td className="px-3 py-2.5 pr-5 text-right">
                    {c.status === "correct" && !b ? <span className="inline-flex items-center gap-1 text-[12.5px] text-good"><Check size={13} /> Good</span>
                      : b === "running" ? <Button size="sm" disabled><Loader2 size={12} className="animate-spin" /></Button>
                      : b === "submitted" ? <Badge tone="info">{c.method === "Direct API" ? "Updated" : "Submitted · 2–6 wks"}</Badge>
                      : <Button size="sm" onClick={() => run([c.id])}>{c.status === "missing" ? "Build" : c.status === "duplicate" ? "Merge" : "Fix"}</Button>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>
      <p className="mt-3 max-w-3xl text-[12px] text-subtle">We find each listing by searching the site for your name and phone, then compare name, address, phone, hours and website with your Google profile. Google, Apple and Bing are updated through their own APIs; aggregators feed hundreds of smaller sites; the rest are submitted through a citation partner. Sites you must claim yourself come with step-by-step instructions.</p>

      <Modal open={confirm} onClose={() => setConfirm(false)} title={`Fix & build ${chosen.length} citations`} footer={<>
        <Button variant="ghost" onClick={() => setConfirm(false)}>Cancel</Button>
        <Button variant="primary" onClick={() => run(chosen.map((c) => c.id))}>Start</Button>
      </>}>
        <div className="space-y-3 text-[13.5px]">
          {(["Direct API", "Aggregator", "Partner submission", "Claim it yourself"] as const).map((mth) => {
            const xs = chosen.filter((c) => c.method === mth);
            if (!xs.length) return null;
            return (
              <div key={mth} className="flex items-start justify-between gap-3">
                <div><div className="font-medium">{mth}</div><div className="text-[12.5px] text-muted">{xs.map((c) => c.site).join(", ")}</div></div>
                {mth === "Claim it yourself" && <span className="shrink-0 text-muted">added to To-do</span>}
              </div>
            );
          })}
          <div className="border-t border-line pt-3 text-[12.5px] text-subtle">Google, Apple and Bing update within a day. Other sites usually go live in 2–6 weeks. We re-check weekly and show progress here.</div>
        </div>
      </Modal>
      {node}
    </>
  );
}

// ---------- Backlinks ----------

const statusLabel: Record<LinkStatus, { label: string; tone: "neutral" | "info" | "good" | "bad" }> = {
  idea: { label: "To do", tone: "neutral" }, outreach: { label: "Outreach sent", tone: "info" }, won: { label: "Won", tone: "good" }, lost: { label: "No reply", tone: "bad" },
};

const order: Record<LinkStatus, number> = { idea: 0, outreach: 1, won: 2, lost: 3 };

function LinksTab({ websiteId }: { websiteId: string }) {
  const [ops, setOps] = useState<LinkOpportunity[]>(linkOpportunities);
  const [only, setOnly] = useState<"all" | "local" | "gap">("all");
  const [draft, setDraft] = useState<LinkOpportunity | null>(null);
  const { toast, node } = useToast();
  const s = { ...linkSummary, you: linkData[websiteId].you };
  const shown = useMemo(() => ops.filter((o) => only === "all" || (only === "local" ? o.local : o.linksTo.length >= 2)).sort((a, b) => order[a.status] - order[b.status] || b.linksTo.length - a.linksTo.length || b.authority - a.authority), [ops, only]);
  const setStatus = (id: string, status: LinkStatus) => setOps((xs) => xs.map((x) => (x.id === id ? { ...x, status } : x)));
  const email = (o: LinkOpportunity) => `Hi there,

I'm Dr. Patel from ${business.name} on South Congress. ${o.type === "Unlinked mention" ? `Thanks for mentioning us in your article. Would you be able to link our name to ${business.website}? It helps readers find us.` : o.type === "Local news" ? "With Halloween coming up, I'd be glad to share practical tips for parents on candy and kids' teeth, as a local dentist source for a quick story." : o.type === "Sponsorship" ? "We'd love to sponsor a team this season. Could you send over the sponsorship options?" : `We'd love to be included on your site. Here are our details: ${business.address}, ${business.phone}, ${business.website}.`}

Thanks,
Dr. Patel · ${business.phone}`;

  return (
    <>
      <div className="mb-6 grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-line bg-line lg:grid-cols-4">
        {[
          ["Sites linking to you", String(s.you.refDomains), `Leader ${s.leader.refDomains} · top 3 avg ${s.avgTop3RefDomains}`],
          ["Local sites", String(s.you.localDomains), `Leader has ${s.leader.localDomains}`],
          ["New in 30 days", `+${s.you.new30}`, `${s.you.lost30} lost`],
          ["Gap to the leader", String(s.leader.refDomains - s.you.refDomains), "sites linking to them, not you"],
        ].map(([l, v, sub]) => (
          <div key={l} className="bg-surface p-5">
            <div className="text-[12.5px] text-muted">{l}</div>
            <div className="num mt-1 font-serif text-[28px] leading-none">{v}</div>
            <div className="mt-1.5 text-[12px] text-subtle">{sub}</div>
          </div>
        ))}
      </div>

      <div className="mb-6 grid gap-3 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <Card>
          <CardHeader title="Sites linking to you, over time" sub="Referring domains" />
          <LineChart height={180} labels={linkHistory.labels} series={[
            { name: "You", color: "var(--accent)", values: linkData[websiteId].history },
            { name: s.leader.name, color: "var(--ink)", values: linkHistory.leader },
            { name: "Top 3 average", color: "var(--subtle)", values: linkHistory.top3, dashed: true },
          ]} />
        </Card>
        <Card pad={false}>
          <div className="border-b border-line px-5 py-3"><h3 className="text-[14px] font-medium">Recent changes</h3></div>
          <ul className="divide-y divide-line">
            {backlinks.filter((b) => b.state !== "live").map((b) => (
              <li key={b.domain} className="flex items-center gap-3 px-5 py-2.5 text-[13px]">
                {b.state === "new" ? <ArrowUp size={14} className="text-good" /> : <ArrowDown size={14} className="text-bad" />}
                <span className="min-w-0 flex-1">
                  <ExternalUrl domain={b.domain} className="block font-medium" />
                  <span className="block truncate text-[12px] text-muted">“{b.anchor}” · {b.follow ? "counts for SEO" : "nofollow"}{b.local && " · local"}</span>
                </span>
                <span className="shrink-0 text-[12px] text-subtle">{b.state === "new" ? "Found" : "Lost"} {b.firstSeen}</span>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="font-serif text-[22px] leading-tight">Links you can get</h2>
          <p className="mt-0.5 text-[13px] text-muted">Sites that already link to your competitors, plus local sources. Sorted by how many rivals they link to.</p>
        </div>
        <Segmented label="Show" value={only} onChange={setOnly} options={[{ id: "all", label: "All" }, { id: "gap", label: "Link 2+ rivals" }, { id: "local", label: "Local only" }]} />
      </div>
      <Card pad={false}>
        {shown.map((o) => {
          const st = statusLabel[o.status];
          return (
            <div key={o.id} className="flex flex-col gap-3 border-b border-line px-5 py-4 last:border-0 sm:flex-row sm:items-start">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <ExternalUrl domain={o.domain} className="font-medium" />
                  <Badge>{o.type}</Badge>
                  {o.local && <Badge tone="accent"><MapPin size={10} /> Local</Badge>}
                  <span className="num text-[12px] text-subtle">authority {o.authority}</span>
                </div>
                <p className="mt-1 text-[13px] text-muted">{o.how}</p>
                {o.linksTo.length > 0 && <p className="mt-1 text-[12px] text-subtle">Already links to {o.linksTo.join(", ")}</p>}
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <Badge tone={st.tone}>{st.label}</Badge>
                {o.status === "idea" && <Button size="sm" icon={<Mail size={12} />} onClick={() => setDraft(o)}>Reach out</Button>}
                {o.status === "outreach" && <Button size="sm" onClick={() => { setStatus(o.id, "won"); toast(`Marked ${o.domain} as won · we'll confirm the link on the next crawl`); }}>Mark won</Button>}
              </div>
            </div>
          );
        })}
      </Card>
      <p className="mt-3 max-w-3xl text-[12px] text-subtle">We track your referring domains, new and lost links, and sites that link to two or more competitors but not you. Outreach goes from your own mailbox; nothing is sent without your approval.</p>

      <Drawer open={!!draft} onClose={() => setDraft(null)} title={draft ? `Reach out to ${draft.domain}` : ""} footer={draft && <>
        <Button variant="ghost" icon={<Copy size={14} />} onClick={async () => { try { await navigator.clipboard.writeText(email(draft)); toast("Email copied"); } catch { toast("Couldn't access the clipboard"); } }}>Copy</Button>
        <Can I="submit" on="citations"><Button variant="primary" icon={<Mail size={14} />} onClick={() => { setStatus(draft.id, "outreach"); setDraft(null); toast(`Sent to ${draft.contact} · we'll remind you in 5 days if there's no reply`); }}>Send from my mailbox</Button></Can>
      </>}>
        {draft && (
          <div className="space-y-4">
            <div className="text-[13px]"><span className="text-muted">To</span> {draft.contact}</div>
            <p className="text-[13px] text-muted">{draft.how}</p>
            <pre className="rounded-lg border border-line bg-bg p-4 font-sans text-[13.5px] whitespace-pre-wrap">{email(draft)}</pre>
          </div>
        )}
      </Drawer>
      {node}
    </>
  );
}
