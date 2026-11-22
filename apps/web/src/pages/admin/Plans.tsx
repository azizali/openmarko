// Platform admin → Plans & usage: the Plans as data (what each grants and meters), and what Organizations used.
import { useState } from "react";
import { Badge, Button, Card, CardHeader, Drawer, NewButton, Textarea } from "../../components/ui";
import { Table } from "../../components/Table";
import { Feedback, useFeedback } from "../../components/Feedback";
import { api, messageOf, money } from "../../lib/api";
import { useLoad } from "../../lib/useLoad";
import { FEATURES } from "../../lib/modules";

const example = {
  id: "starter",
  name: "Starter",
  description: "Everything on, with monthly limits.",
  sort: 0,
  default: false,
  entitlements: Object.fromEntries(FEATURES.map((f) => [`feature.${f.id}`, 1])),
  meters: [{ meter: "llm.tokens", included: 200000, overage: "block" }],
  prices: [{ interval: "month", amountCents: 1900 }],
};

export default function Plans() {
  const plans = useLoad(() => api.api.v1.admin.plans.get());
  const usage = useLoad(() => api.api.v1.admin.usage.get({ query: { days: "30" } }));
  const [editing, setEditing] = useState<string | null>(null);
  const fb = useFeedback(editing === null);

  const save = async () => {
    if (editing === null) return;
    fb.clear();
    let body: unknown;
    try {
      body = JSON.parse(editing);
    } catch {
      return fb.fail("That isn't valid JSON.");
    }
    const r = await api.api.v1.admin.plans.put(body as never);
    if (r.error) return fb.fail(messageOf(r.error));
    setEditing(null);
    fb.clear();
    void plans.reload();
  };

  return (
    <div className="space-y-5">
      <div className="flex justify-end">
        <NewButton onClick={() => setEditing(JSON.stringify(example, null, 2))}>New plan</NewButton>
      </div>
      <Table
        head={["Plan", "Grants", "Meters", "Price", "Organizations", ""]}
        empty="No Plans yet. Without one, Organizations have no entitlements."
        rows={(plans.data ?? []).map((p) => [
          <span key="n">
            <span className="flex items-center gap-2 font-medium">
              {p.name}
              {p.isDefault && <Badge tone="accent">default</Badge>}
              {!p.active && <Badge>inactive</Badge>}
            </span>
            <span className="block text-[12px] text-muted">
              {p.id}
              {p.description ? ` · ${p.description}` : ""}
            </span>
          </span>,
          <span key="e" className="text-[12.5px] text-muted">
            {Object.entries(p.entitlements)
              .map(([k, v]) => `${k}=${v === null ? "∞" : v}`)
              .join(", ") || "nothing"}
          </span>,
          <span key="m" className="text-[12.5px] text-muted">
            {p.meters.map((m) => `${m.meter}: ${m.included === null ? "∞" : m.included} (${m.overage})`).join(", ") || "none"}
          </span>,
          p.prices.find((x) => x.interval === "month")
            ? `$${(p.prices.find((x) => x.interval === "month")!.amountCents / 100).toFixed(2)}/mo`
            : "free",
          p.organizations,
          <Button
            key="x"
            size="sm"
            onClick={() =>
              setEditing(
                JSON.stringify(
                  {
                    id: p.id,
                    name: p.name,
                    description: p.description,
                    sort: p.sort,
                    active: p.active,
                    default: p.isDefault,
                    entitlements: p.entitlements,
                    meters: p.meters,
                    prices: p.prices,
                  },
                  null,
                  2,
                ),
              )
            }
          >
            Edit
          </Button>,
        ])}
      />
      <Card>
        <CardHeader title="Usage, last 30 days" sub="What Organizations used of metered providers, and what it cost the app." />
        <div className="grid gap-4 md:grid-cols-2">
          <Table
            head={["Meter", "Quantity", "Cost", "Events"]}
            empty="Nothing metered yet."
            rows={(usage.data?.byMeter ?? []).map((m) => [m.meter, m.quantity, money(m.costMicros), m.events])}
          />
          <Table
            head={["Organization", "Quantity", "Cost"]}
            empty="No usage yet."
            rows={(usage.data?.topOrganizations ?? []).map((o) => [o.name, o.quantity, money(o.costMicros)])}
          />
        </div>
      </Card>
      <Drawer
        open={editing !== null}
        onClose={() => setEditing(null)}
        title="Plan"
        width={640}
        feedback={<Feedback {...fb.props} />}
        footer={
          <>
            <Button onClick={() => setEditing(null)}>Cancel</Button>
            <Button variant="primary" onClick={() => void save()}>
              Save
            </Button>
          </>
        }
      >
        <p className="mb-3 text-[13px] text-muted">
          A Plan is data (ADR 0012). Entitlements: <code className="font-mono text-[12px]">feature.&lt;id&gt;</code> = 1 to allow a feature,{" "}
          <code className="font-mono text-[12px]">limit.&lt;name&gt;</code> = a number (null: unlimited),{" "}
          <code className="font-mono text-[12px]">action.&lt;resource&gt;.&lt;action&gt;</code> = 0 to take an action away,{" "}
          <code className="font-mono text-[12px]">partner</code> = 1 for Partners. Meters sell metered use: included units per month and
          what happens past them (block, charge, byok_only).
        </p>
        <Textarea mono rows={22} value={editing ?? ""} onChange={(e) => setEditing(e.target.value)} />
      </Drawer>
    </div>
  );
}
