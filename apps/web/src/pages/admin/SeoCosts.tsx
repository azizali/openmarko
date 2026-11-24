// Platform admin → SEO costs: what search data really cost this month per Organization (from the checks that ran, at the
// provider's own prices), what each Location will cost a month at its settings, and the unit prices behind the
// estimate. For whoever prices the product; customers only ever see their Plan's limits.
import { Card, CardHeader } from "../../components/ui";
import { Table } from "../../components/Table";
import { LoadError } from "../../components/Feedback";
import { api, money } from "../../lib/api";
import { useLoad } from "../../lib/useLoad";
import { engineNames } from "../seo/api";

const kinds: [string, string][] = [
  ["maps", "Google Maps"],
  ["organic", "Google search"],
  ["ai", "AI answers"],
];
const usd = (n: number) => `$${n < 0.01 ? n.toFixed(4) : n.toFixed(2)}`;

export default function SeoCosts() {
  const costs = useLoad(() => api.api.v1.admin.seo.costs.get());
  if (costs.error) return <LoadError what="SEO costs">{costs.error}</LoadError>;
  const d = costs.data;
  if (!d) return null;
  const total = d.thisMonth.reduce((n, o) => n + o.costMicros, 0);
  const monthly = d.locations.reduce((n, l) => n + l.estimate.total, 0);

  return (
    <div className="space-y-8">
      <section>
        <h2 className="mb-1 text-[15px] font-medium">This month so far</h2>
        <p className="mb-3 text-[13px] text-muted">
          {money(total)} across {d.thisMonth.length} {d.thisMonth.length === 1 ? "organization" : "organizations"}, from the searches their
          checks made.
        </p>
        <Table
          head={["Organization", "Searches", ...kinds.map(([, label]) => label), "Total"]}
          rows={d.thisMonth.map((o) => [
            <span key="n" className="font-medium">
              {o.name}
            </span>,
            <span key="c" className="num">
              {o.calls.toLocaleString("en-US")}
            </span>,
            ...kinds.map(([k]) => (
              <span key={k} className="num text-muted">
                {money(o.byKind[k] ?? 0)}
              </span>
            )),
            <span key="t" className="num font-medium">
              {money(o.costMicros)}
            </span>,
          ])}
          empty="No checks have run this month."
        />
      </section>

      <section>
        <h2 className="mb-1 text-[15px] font-medium">A month at each location's settings</h2>
        <p className="mb-3 text-[13px] text-muted">
          About {money(monthly)} a month for {d.locations.length} active {d.locations.length === 1 ? "location" : "locations"}. Keyword
          volumes are refreshed once a month and counted in the total.
        </p>
        <Table
          head={["Location", "Tracks", "Checks", "Google Maps", "Google search", "AI answers", "A month"]}
          rows={d.locations.map((l) => [
            <span key="n">
              <span className="block font-medium">{l.name}</span>
              <span className="block text-[12px] text-muted">{l.organization}</span>
            </span>,
            <span key="t" className="text-muted">
              {l.keywords} keywords, {l.questions} questions
            </span>,
            <span key="c" className="text-muted">
              {l.gridSize} × {l.gridSize}, {l.checkEvery}; {l.engines.map((e) => engineNames[e] ?? e).join(", ")}
            </span>,
            <span key="m" className="num text-muted">
              {money(l.estimate.maps)}
            </span>,
            <span key="o" className="num text-muted">
              {money(l.estimate.organic)}
            </span>,
            <span key="a" className="num text-muted">
              {money(l.estimate.ai)}
            </span>,
            <span key="x" className="num font-medium">
              {money(l.estimate.total)}
            </span>,
          ])}
          empty="No location is being checked yet."
        />
      </section>

      <Card>
        <CardHeader
          title="Prices per search"
          sub="What the search-data provider charges per request as our checks send it, on its standard queue. The priority queue, used for a location's first check, costs twice as much for Google Maps, Google search and Google AI Overview. Perplexity is billed by the tokens its answer takes; its price here is typical."
        />
        <dl className="grid gap-x-8 gap-y-2 text-[13.5px] sm:grid-cols-2">
          {[
            ["Google Maps, one spot", d.unitPricesUsd.maps],
            ["Google search, one keyword (100 results)", d.unitPricesUsd.organic],
            ...Object.entries(d.unitPricesUsd.ai).map(([e, p]) => [`${engineNames[e] ?? e}, one question`, p] as const),
            ["Keyword volumes, up to 1,000 keywords", d.unitPricesUsd.volume],
            ["Keyword ideas, per request", d.unitPricesUsd.labsTask],
          ].map(([label, price]) => (
            <div key={label} className="flex justify-between gap-4 border-b border-line py-1.5">
              <dt className="text-muted">{label}</dt>
              <dd className="num">{usd(price as number)}</dd>
            </div>
          ))}
        </dl>
      </Card>
    </div>
  );
}
