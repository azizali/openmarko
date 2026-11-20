// Clients (Partners): the Organizations a Partner manages, and creating new ones. A section of Settings, shown when a Partner is open.
import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router";
import { Badge, Button, Callout, Checkbox, Drawer, Field, Input, NewButton, PageHeader } from "../../components/ui";
import { Table } from "../../components/Table";
import { Feedback, LoadError, useFeedback } from "../../components/Feedback";
import { api, messageOf } from "../../lib/api";
import { authClient, authError } from "../../lib/auth";
import { useLoad } from "../../lib/useLoad";
import { useSession, type Partner } from "../../lib/session";
import { slugify } from "../../lib/slug";

export default function Clients() {
  const { partner } = useSession();
  return partner ? (
    <PartnerClients partner={partner} />
  ) : (
    <>
      <PageHeader title="Clients" />
      <Callout>Clients are managed from a Partner organization. Switch to one to see them.</Callout>
    </>
  );
}

function PartnerClients({ partner }: { partner: Partner }) {
  const { switchOrg, organizations, can } = useSession();
  const navigate = useNavigate();
  const overview = useLoad(() => api.api.v1.organizations({ orgId: partner.id }).partner.get(), [partner.id]);
  const [creating, setCreating] = useState(false);
  const canCreate = can("organization", "update");

  const open = async (id: string) => {
    await switchOrg(id);
    void navigate("/");
  };

  return (
    <>
      <PageHeader
        title="Clients"
        sub={`The organizations ${partner.name} manages.`}
        actions={canCreate && <NewButton onClick={() => setCreating(true)}>New organization</NewButton>}
      />
      <LoadError>{overview.error}</LoadError>
      <div className="mt-4 max-w-3xl space-y-6">
        <Table
          head={["Client", "People", "Status", ""]}
          empty="No clients yet. Create an organization for your first one, then invite their people."
          rows={(overview.data?.clients ?? []).map((c) => [
            <span key="n" className="font-medium">
              {c.name}
            </span>,
            c.members,
            <Badge key="s" tone={c.archivedAt ? "neutral" : "good"}>
              {c.archivedAt ? "archived" : "active"}
            </Badge>,
            organizations.some((o) => o.id === c.id) ? (
              <Button key="o" size="sm" onClick={() => void open(c.id)}>
                Open
              </Button>
            ) : (
              <span key="o" className="text-[12px] text-subtle">
                not a member
              </span>
            ),
          ])}
        />
        {canCreate && (
          <p className="text-[12.5px] text-subtle">
            Your own brand lives in{" "}
            <Link to="/settings/whitelabel" className="underline-offset-2 hover:underline">
              Whitelabel
            </Link>
            .
          </p>
        )}
      </div>
      {creating && <NewOrganization partner={partner} onClose={() => setCreating(false)} />}
    </>
  );
}

/** Creates an Organization, a Client unless switched off, and goes to its Team to invite its people. */
function NewOrganization({ partner, onClose }: { partner: Partner; onClose: () => void }) {
  const { refresh, switchOrg } = useSession();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [asClient, setAsClient] = useState(true);
  const [busy, setBusy] = useState(false);
  const fb = useFeedback();

  const create = async (): Promise<string | null> => {
    const input = { name: name.trim(), slug: slug || slugify(name), timezone: Intl.DateTimeFormat().resolvedOptions().timeZone };
    if (asClient) {
      const r = await api.api.v1.organizations({ orgId: partner.id }).clients.post(input);
      if (r.error) fb.fail(messageOf(r.error), "Could not create");
      return r.data?.id ?? null;
    }
    const r = await authClient.organization.create(input as never);
    if (r.error) fb.fail(authError(r, "Couldn't create the organization."), "Could not create");
    return (r.data as { id: string } | null)?.id ?? null;
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    fb.clear();
    const id = await create();
    setBusy(false);
    if (!id) return;
    await refresh();
    await switchOrg(id);
    void navigate("/settings/team?invite");
  };

  return (
    <Drawer
      open
      onClose={onClose}
      title="New organization"
      onSubmit={submit}
      feedback={<Feedback {...fb.props} />}
      footer={
        <>
          <Button type="button" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" disabled={busy || !name.trim()}>
            {busy ? "Creating…" : "Create and invite people"}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Organization name">
          <Input
            required
            autoFocus
            maxLength={120}
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              if (!slugTouched) setSlug(slugify(e.target.value));
            }}
            placeholder="Acme Inc."
          />
        </Field>
        <Field label="Short name" hint="Lowercase letters, digits and dashes. Used in links.">
          <Input
            required
            pattern="[a-z0-9-]{2,40}"
            value={slug}
            onChange={(e) => {
              setSlugTouched(true);
              setSlug(slugify(e.target.value));
            }}
          />
        </Field>
        <label className="flex items-start gap-2.5">
          <span className="mt-0.5">
            <Checkbox checked={asClient} onChange={setAsClient} />
          </span>
          <span className="text-[13.5px]">
            <span className="block font-medium">Manage as a client of {partner.name}</span>
            <span className="block text-[12.5px] text-muted">
              It uses your plan and shows your brand. Turn this off for a separate organization of your own.
            </span>
          </span>
        </label>
      </div>
    </Drawer>
  );
}
