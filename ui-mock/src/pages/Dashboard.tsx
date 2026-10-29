import { Link } from "react-router";
import { ArrowRight, Sparkles, Radar, Wand2, ScanSearch, Trophy, AlertCircle } from "lucide-react";
import { Badge, Button, Card, CardHeader, Delta, LineChart, PageHeader, RankDelta, ScoreRing, Stat, shortDate } from "../components/ui";
import { GridMap, GridLegend } from "../components/GridMap";
import { actions, activity, auditSummary, gbpInsights, gridStats, gscSeries, keywords, makeGrid, visibilitySeries } from "../data/mock";

const activityIcon = { scan: Radar, exec: Wand2, win: Trophy, audit: ScanSearch, alert: AlertCircle } as const;

export default function Dashboard() {
  const scan = makeGrid("kw_1", 7);
  const s = gridStats(scan);
  const movers = [...keywords]
    .filter((k) => k.organic && k.organicPrev)
    .sort((a, b) => Math.abs(b.organicPrev! - b.organic!) - Math.abs(a.organicPrev! - a.organic!))
    .slice(0, 5);
  const next = actions.filter((a) => a.status === "suggested").slice(0, 3);
  const avgMap = keywords.filter((k) => k.local).reduce((a, k) => a + k.local!, 0) / keywords.filter((k) => k.local).length;
  const avgMapPrev = keywords.filter((k) => k.localPrev).reduce((a, k) => a + k.localPrev!, 0) / keywords.filter((k) => k.localPrev).length;

  return (
    <>
      <PageHeader
        title="Good morning"
        sub="Here's how Maple & Main Dental is showing up in Austin this week."
        actions={<><Button>Last 30 days</Button><Button variant="primary" icon={<Radar size={14} />}>Run scan</Button></>}
      />

      <Card className="mb-6 flex flex-wrap items-center gap-4 border-accent/30 bg-accent-soft/50">
        <Sparkles size={18} className="text-accent" />
        <p className="min-w-0 flex-1 text-[14px]">
          <b className="font-medium">“invisalign austin” entered the map pack.</b>{" "}
          <span className="text-muted">Adding “Teeth whitening service” as a category could do the same for 3 more cosmetic keywords.</span>
        </p>
        <Link to="/actions/a1"><Button size="sm" variant="primary">Review change</Button></Link>
      </Card>

      <div className="mb-6 grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-line bg-line lg:grid-cols-4">
        {[
          <Stat key="1" label="Share of local voice" hint="% of grid points where you're in the top 3" value={`${visibilitySeries.at(-1)!.value}%`} delta={<Delta cur={visibilitySeries.at(-1)!.value} prev={visibilitySeries.at(-5)!.value} />} />,
          <Stat key="2" label="Avg. map pack rank" value={avgMap.toFixed(1)} delta={<Delta cur={avgMap} prev={avgMapPrev} invert />} />,
          <Stat key="3" label="Organic clicks · GSC" value={gscSeries.at(-1)!.value} delta={<Delta cur={gscSeries.at(-1)!.value} prev={gscSeries.at(-5)!.value} />} />,
          <Stat key="4" label="Calls from profile" value={gbpInsights.calls} delta={<Delta cur={gbpInsights.calls} prev={gbpInsights.callsPrev} />} />,
        ].map((n, i) => <div key={i} className="bg-surface p-5">{n}</div>)}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <Card>
          <CardHeader title="Local visibility" sub="Share of local voice vs. organic clicks, weekly" right={<Link to="/rankings" className="text-[13px] text-muted hover:text-fg">Rankings →</Link>} />
          <LineChart
            labels={visibilitySeries.map((d) => shortDate(d.date))}
            series={[
              { name: "Share of local voice (%)", color: "var(--accent)", values: visibilitySeries.map((d) => d.value) },
              { name: "Organic clicks (÷20)", color: "var(--info)", values: gscSeries.map((d) => Math.round(d.value / 20)), dashed: true },
            ]}
            area
          />
        </Card>
        <Card>
          <CardHeader title="Rank pack" sub="“dentist austin” · 7×7 · 3 mi" right={<Link to="/grid" className="text-[13px] text-muted hover:text-fg">Open →</Link>} />
          <GridMap scan={scan} compact />
          <div className="mt-3 flex items-center justify-between">
            <GridLegend />
          </div>
          <div className="num mt-3 grid grid-cols-3 gap-2 text-center text-[12px] text-muted">
            <div><div className="font-serif text-[20px] text-fg">{s.arp.toFixed(1)}</div>ARP</div>
            <div><div className="font-serif text-[20px] text-fg">{s.atrp.toFixed(1)}</div>ATRP</div>
            <div><div className="font-serif text-[20px] text-fg">{s.solv.toFixed(0)}%</div>SoLV</div>
          </div>
        </Card>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title="Next best actions" sub="Ranked by estimated impact on map pack visibility" right={<Link to="/actions" className="text-[13px] text-muted hover:text-fg">All {actions.length} →</Link>} />
          <ul className="-mx-2">
            {next.map((a) => (
              <li key={a.id}>
                <Link to={`/actions/${a.id}`} className="group flex items-center gap-3 rounded-md px-2 py-2.5 hover:bg-hover">
                  <Badge tone={a.impact === "High" ? "accent" : "neutral"}>{a.impact}</Badge>
                  <span className="min-w-0 flex-1 truncate text-[14px]">{a.title}</span>
                  {a.effort === "Auto" && <Badge tone="info"><Wand2 size={11} /> Auto</Badge>}
                  <ArrowRight size={14} className="text-subtle opacity-0 transition-opacity group-hover:opacity-100" />
                </Link>
              </li>
            ))}
          </ul>
        </Card>
        <Card>
          <CardHeader title="Site health" right={<Link to="/audit" className="text-[13px] text-muted hover:text-fg">Audit →</Link>} />
          <div className="flex items-center gap-5">
            <ScoreRing score={auditSummary.score} label="Site health" />
            <div className="text-[13px] text-muted">
              <div><Delta cur={auditSummary.score} prev={auditSummary.prevScore} suffix=" pts" /> since last crawl</div>
              <div className="mt-1">2 critical · 4 warnings</div>
              <div className="mt-1">{auditSummary.pages} pages crawled</div>
            </div>
          </div>
        </Card>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Biggest movers" sub="Organic position, 7 days" />
          <table className="w-full text-[13.5px]">
            <tbody>
              {movers.map((k) => (
                <tr key={k.id} className="border-t border-line first:border-0">
                  <td className="py-2.5"><Link to={`/rankings/${k.id}`} className="hover:underline">{k.term}</Link></td>
                  <td className="num w-12 py-2.5 text-right">{k.organic}</td>
                  <td className="w-12 py-2.5 text-right"><RankDelta cur={k.organic} prev={k.organicPrev} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
        <Card>
          <CardHeader title="Activity" />
          <ul className="space-y-3.5">
            {activity.map((a, i) => {
              const Icon = activityIcon[a.kind as keyof typeof activityIcon];
              return (
                <li key={i} className="flex gap-3 text-[13.5px]">
                  <Icon size={15} className="mt-0.5 shrink-0 text-subtle" />
                  <span className="flex-1">{a.text}</span>
                  <span className="shrink-0 text-[12px] text-subtle">{a.when}</span>
                </li>
              );
            })}
          </ul>
        </Card>
      </div>
    </>
  );
}
