// Settings → Billing: the Plan the Organization is on, what it allows, and the Plans it could move to.
import { useState } from "react";
import { Badge, Button, Card, CardHeader } from "../../components/ui";
import { Row } from "../../components/Table";
import { LoadError, useToast } from "../../components/Feedback";
import { api, messageOf } from "../../lib/api";
import { useLoad } from "../../lib/useLoad";
import { useOrg, useSession } from "../../lib/session";

export default function Billing() {
  const org = useOrg();
  const { can, me } = useSession();
  const billing = useLoad(() => api.api.v1.organizations({ orgId: org.id }).billing.get(), [org.id]);
  const toast = useToast();
  const [busy, setBusy] = useState<string | null>(null);
  if (!billing.data) return <LoadError>{billing.error}</LoadError>;
  const { planId, entitlements, plans, stripe } = billing.data;
  const current = plans.find((p) => p.id === planId);

  const checkout = async (id: string) => {
    setBusy(id);
    const r = await api.api.v1.organizations({ orgId: org.id }).billing.checkout.post({ planId: id, email: me!.email });
    setBusy(null);
    if (r.error) return toast.error(messageOf(r.error), "Could not change plan");
    void billing.reload();
  };

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader
          title="Your plan"
          sub={current ? current.description : "No plan yet."}
          right={current && <Badge tone="accent">{current.name}</Badge>}
        />
        <div>
          {Object.entries(entitlements).map(([k, v]) => (
            <Row key={k} label={k}>
              {v === null ? "unlimited" : String(v)}
            </Row>
          ))}
          {Object.keys(entitlements).length === 0 && <p className="text-[13px] text-muted">Nothing granted yet.</p>}
        </div>
      </Card>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {plans.map((p) => {
          const price = p.prices.find((x) => x.interval === "month");
          return (
            <Card key={p.id} className={p.id === planId ? "border-line-strong" : undefined}>
              <div className="flex items-start justify-between gap-2">
                <h3 className="text-[15px] font-medium">{p.name}</h3>
                {p.isDefault && <Badge>default</Badge>}
              </div>
              <p className="mt-1 min-h-10 text-[13px] text-muted">{p.description}</p>
              <p className="mt-3 font-serif text-[26px]">
                {price ? `$${(price.amountCents / 100).toFixed(0)}` : "Free"}
                <span className="text-[13px] text-muted">{price ? " / month" : ""}</span>
              </p>
              <ul className="mt-3 space-y-1 text-[12.5px] text-muted">
                {Object.entries(p.entitlements)
                  .slice(0, 6)
                  .map(([k, v]) => (
                    <li key={k}>
                      {k}: {v === null ? "unlimited" : String(v)}
                    </li>
                  ))}
              </ul>
              {p.id !== planId && can("billing", "update") && price && (
                <Button
                  className="mt-4 w-full"
                  variant="primary"
                  disabled={!stripe || busy === p.id}
                  onClick={() => void checkout(p.id)}
                  title={stripe ? undefined : "Stripe isn't configured"}
                >
                  {busy === p.id ? "Starting…" : stripe ? "Choose" : "Payments not set up"}
                </Button>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}
