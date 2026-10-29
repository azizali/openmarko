import { useState } from "react";
import { Link, useParams } from "react-router";
import { ChevronRight, ExternalLink, Grid3x3, Bell, Star } from "lucide-react";
import { Badge, Button, Card, CardHeader, LineChart, PageHeader, RankDelta, Segmented, Stat, fmt, shortDate, useToast } from "../components/ui";
import { business, competitors, keywords } from "../data/mock";

export default function KeywordDetail() {
  const { id } = useParams();
  const k = keywords.find((x) => x.id === id) ?? keywords[0];
  const [range, setRange] = useState<"30" | "90">("90");
  const { toast, node } = useToast();
  const hist = range === "30" ? k.history.slice(-11) : k.history;

  const serp = [
    { pos: 1, title: "Bright Smile Austin — Dentist in South Austin", url: "brightsmileatx.com" },
    { pos: 2, title: "10 Best Dentists in Austin, TX (2026) — Yelp", url: "yelp.com" },
    { pos: 3, title: "Congress Ave Dental | Family & Cosmetic Dentistry", url: "congressavedental.com" },
    { pos: 4, title: "Austin Dentists — Zocdoc", url: "zocdoc.com" },
    { pos: 5, title: "South Lamar Dental Studio", url: "southlamardental.com" },
  ];
  const withYou = [...serp];
  if (k.organic && k.organic <= 6) withYou.splice(k.organic - 1, 0, { pos: k.organic, title: `${business.name} — Dentist in Austin, TX`, url: business.website });
  const list = withYou.slice(0, 6).map((r, i) => ({ ...r, pos: i + 1 }));

  return (
    <>
      <PageHeader
        crumbs={<span className="flex items-center gap-1"><Link to="/rankings" className="hover:text-fg">Rankings</Link><ChevronRight size={12} />{k.term}</span>}
        title={k.term}
        sub={<span className="flex flex-wrap items-center gap-2"><Badge>{k.intent}</Badge><span className="num">{fmt(k.volume)} searches/mo</span>·<span className="num">KD {k.kd}</span>·<span>Ranking URL {k.url}</span></span>}
        actions={<>
          <Button icon={<Bell size={14} />} onClick={() => toast("Alert set: notify on ±3 position change")}>Alert</Button>
          <Link to={`/grid?kw=${k.id}`}><Button variant="primary" icon={<Grid3x3 size={14} />}>View rank pack</Button></Link>
        </>}
      />

      <div className="mb-6 grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-line bg-line lg:grid-cols-4">
        <div className="bg-surface p-5"><Stat label="Organic" value={k.organic ?? "—"} delta={<RankDelta cur={k.organic} prev={k.organicPrev} />} /></div>
        <div className="bg-surface p-5"><Stat label="Map pack" value={k.local ? `#${k.local}` : "—"} delta={<RankDelta cur={k.local} prev={k.localPrev} />} /></div>
        <div className="bg-surface p-5"><Stat label="Best ever" value={k.best} /></div>
        <div className="bg-surface p-5"><Stat label="Est. monthly clicks" value={k.organic ? Math.round(k.volume * Math.max(0.01, 0.3 / k.organic)) : 0} /></div>
      </div>

      <Card className="mb-6">
        <CardHeader title="Position history" sub="Lower is better" right={<Segmented label="Range" value={range} onChange={setRange} options={[{ id: "30", label: "30d" }, { id: "90", label: "90d" }]} />} />
        <LineChart
          invert
          yMax={Math.max(20, ...hist.map((h) => h.organic ?? 0)) + 2}
          labels={hist.map((h) => shortDate(h.date))}
          series={[
            { name: "Organic", color: "var(--info)", values: hist.map((h) => h.organic) },
            { name: "Map pack", color: "var(--accent)", values: hist.map((h) => h.local) },
          ]}
        />
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Map pack right now" sub="From the business location" />
          <ol className="space-y-2">
            {competitors
              .slice()
              .sort((a, b) => a.avgGridRank - b.avgGridRank)
              .slice(0, 4)
              .map((c, i) => (
                <li key={c.id} className={`flex items-center gap-3 rounded-lg border p-3 ${c.isYou ? "border-accent/40 bg-accent-soft/40" : "border-line"}`}>
                  <span className="num w-5 text-center font-serif text-[18px] text-muted">{i + 1}</span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[13.5px] font-medium">{c.name} {c.isYou && <Badge tone="accent">You</Badge>}</div>
                    <div className="flex items-center gap-1 text-[12px] text-muted"><Star size={11} className="fill-current text-warn" />{c.rating} ({c.reviews}) · {c.categories[0]}</div>
                  </div>
                  {!c.isYou && <Link to={`/competitors/${c.id}`} className="text-[12.5px] text-muted hover:text-fg">Compare</Link>}
                </li>
              ))}
          </ol>
        </Card>
        <Card>
          <CardHeader title="Organic results" sub={`SERP features: ${k.serpFeatures.join(", ") || "none"}`} />
          <ol className="space-y-3">
            {list.map((r) => (
              <li key={r.pos + r.url} className="flex gap-3">
                <span className="num w-5 shrink-0 text-right text-[13px] text-subtle">{r.pos}</span>
                <div className="min-w-0">
                  <div className={`truncate text-[13.5px] ${r.url === business.website ? "font-medium text-accent" : ""}`}>{r.title}</div>
                  <div className="flex items-center gap-1 truncate text-[12px] text-muted">{r.url} <ExternalLink size={10} /></div>
                </div>
              </li>
            ))}
          </ol>
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader title="How to move up" sub="Generated from ranking factors and the pages above you" right={<Link to="/actions" className="text-[13px] text-muted hover:text-fg">Action plan →</Link>} />
        <ul className="space-y-2 text-[13.5px]">
          <li className="flex gap-2"><span className="text-accent">→</span> Add “{k.term.replace(" austin", "")}” to your Business Profile services and description.</li>
          <li className="flex gap-2"><span className="text-accent">→</span> {k.url} has 420 words. The top 3 results average 1,380. Expand with FAQs and pricing.</li>
          <li className="flex gap-2"><span className="text-accent">→</span> Ask recent patients to mention the service in reviews. 2% of your reviews do, vs. 11% for the leader.</li>
        </ul>
      </Card>
      {node}
    </>
  );
}
