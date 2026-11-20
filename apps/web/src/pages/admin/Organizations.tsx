import { useState, type FormEvent } from "react";
import { Badge, Button, Card, CardHeader, Drawer, Field, Input, NewButton, Select } from "../../components/ui";
import { Table } from "../../components/Table";
import { Feedback, useFeedback, useToast } from "../../components/Feedback";
import { api, fmtDate, messageOf } from "../../lib/api";
import { useLoad } from "../../lib/useLoad";
import { modules } from "../../lib/modules";

export default function Organizations() {
  const orgs = useLoad(() => api.api.v1.admin.organizations.get());
  const plans = useLoad(() => (modules.billing ? api.api.v1.admin.plans.get() : Promise.resolve({ data: [], error: null })));
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ name: "", slug: "", ownerEmail: "" });
  const fb = useFeedback(creating);
  const toast = useToast();

  const create = async (e: FormEvent) => {
    e.preventDefault();
    fb.clear();
    const r = await api.api.v1.admin.organizations.post(form);
    if (r.error) return fb.fail(messageOf(r.error), "Could not create");
    toast.success(
      r.data.owner.status === "joined"
        ? `${r.data.name} made; ${r.data.owner.email} is its Owner.`
        : `${r.data.name} made; ${r.data.owner.email} was invited${r.data.emailed ? "" : " (the app can't send email yet, so share the invitation another way)"}.`,
    );
    setForm({ name: "", slug: "", ownerEmail: "" });
    setCreating(false);
    void orgs.reload();
  };
  const assign = async (orgId: string, planId: string) => {
    const r = await api.api.v1.admin.organizations({ orgId }).plan.post({ planId });
    if (r.error) return toast.error(messageOf(r.error), "Could not change the plan");
    toast.success(`Put on the ${planId} Plan.`);
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <NewButton onClick={() => setCreating(true)}>New organization</NewButton>
      </div>
      <Table
        head={["Organization", "Owner", "People", "Made", modules.billing ? "Plan" : ""]}
        rows={(orgs.data ?? []).map((o) => [
          <span key="n">
            <span className="block font-medium">{o.name}</span>
            <span className="block text-[12px] text-muted">
              {o.slug}
              {o.archivedAt ? " · archived" : ""}
              {o.partnerId ? " · client of a Partner" : ""}
            </span>
          </span>,
          <span key="o">
            {o.owner.email ?? <span className="text-subtle">none</span>}{" "}
            {o.owner.status === "invited" && <Badge tone="warn">invited</Badge>}
          </span>,
          o.members,
          <span key="d" className="text-muted">
            {fmtDate(o.createdAt as unknown as string)}
          </span>,
          modules.billing ? (
            <Select
              key="p"
              size="xs"
              defaultValue=""
              onChange={(e) => e.target.value && void assign(o.id, e.target.value)}
              className="w-auto"
            >
              <option value="">Put on a Plan…</option>
              {(plans.data ?? []).map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </Select>
          ) : null,
        ])}
      />
      <Drawer
        open={creating}
        onClose={() => setCreating(false)}
        title="New organization"
        onSubmit={create}
        feedback={<Feedback {...fb.props} />}
        footer={
          <>
            <Button type="button" onClick={() => setCreating(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary">
              Create
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Name">
            <Input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </Field>
          <Field label="Short name" hint="Lowercase letters, digits and dashes.">
            <Input required pattern="[a-z][a-z0-9-]{1,39}" value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} />
          </Field>
          <Field label="Owner's email" hint="An existing user becomes Owner at once; anyone else is invited.">
            <Input type="email" required value={form.ownerEmail} onChange={(e) => setForm({ ...form, ownerEmail: e.target.value })} />
          </Field>
        </div>
      </Drawer>
      <Card>
        <CardHeader
          title="About"
          sub="Organizations are the spaces people work in. Each has its own members, Roles, settings, connections and data. People make their own at sign-up; you make one here when you set it up for someone."
        />
      </Card>
    </div>
  );
}
