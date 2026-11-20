// Team: who can open this Organization, with what Role, and the Roles it can give. A section of Settings.
import { useState, type FormEvent } from "react";
import { useSearchParams } from "react-router";
import { Trash2 } from "lucide-react";
import { compile, type RoleSpec } from "@app/shared/access";
import { Can } from "../../components/Can";
import { AccessSummary, RoleEditor, RoleSelect, type RoleCatalog } from "../../components/RoleEditor";
import { Feedback, LoadError, useFeedback, useToast } from "../../components/Feedback";
import { Avatar, Badge, Button, Card, Drawer, Field, Input, ItemCard, ItemRow, NewButton, PageHeader, Tabs } from "../../components/ui";
import { api, fmtDate, messageOf } from "../../lib/api";
import { authClient, authError } from "../../lib/auth";
import { useOrg, useSession } from "../../lib/session";
import { useLoad } from "../../lib/useLoad";

const blankRole: RoleSpec = { id: "", name: "", description: "", base: "none", groups: {}, resources: {} };

export default function Team() {
  const org = useOrg();
  const { me, can, caller } = useSession();
  const [tab, setTab] = useState<"people" | "roles">("people");
  const members = useLoad(() => api.api.v1.organizations({ orgId: org.id }).members.get(), [org.id]);
  const invites = useLoad(
    () =>
      can("invitation", "create")
        ? api.api.v1.organizations({ orgId: org.id }).invitations.get()
        : Promise.resolve({ data: [], error: null }),
    [org.id, caller],
  );
  const customRoles = useLoad(
    () => (can("ac", "read") ? api.api.v1.organizations({ orgId: org.id }).roles.get() : Promise.resolve({ data: [], error: null })),
    [org.id, caller],
  );
  const catalog = useLoad(() => api.api.v1.organizations({ orgId: org.id }).roles.catalog.get(), [org.id]);
  // ?invite: arriving from creating an Organization, whose next step is inviting its people.
  const [params, setParams] = useSearchParams();
  const [inviteOpen, setInviteOpen] = useState(params.has("invite"));
  const [editing, setEditing] = useState<{ role: RoleSpec; isNew: boolean } | null>(null);
  const toast = useToast();

  const cat = catalog.data as RoleCatalog | null;
  const people = members.data;
  if (!cat || !people) return <LoadError>{catalog.error ?? members.error}</LoadError>;

  const custom = (customRoles.data ?? []).map((r) => {
    const spec = r.spec as RoleSpec;
    return { ...spec, id: r.role, name: spec.name || r.role };
  });
  const roles = [...cat.presets, ...custom];
  const nameOf = (id: string) => roles.find((r) => r.id === id)?.name ?? id;
  const waiting = invites.data ?? [];
  const peopleWith = (id: string) => people.filter((m) => m.role === id).length + waiting.filter((i) => i.role === id).length;
  const actionCount = (spec: RoleSpec) => Object.values(compile(cat, spec)).flat().length;
  // Only an Owner can make or unmake another Owner (the API checks this too).
  const isOwner = caller?.role === "owner";

  const changeRole = async (userId: string, name: string, role: string) => {
    const r = await api.api.v1.organizations({ orgId: org.id }).members({ userId }).patch({ role });
    if (r.error) return toast.error(messageOf(r.error), "Could not change the role");
    void members.reload();
    toast.success(`${name} is now ${nameOf(role)}`);
  };
  const remove = async (userId: string, name: string) => {
    if (!confirm(`Remove ${name} from the organization?`)) return;
    const r = await api.api.v1.organizations({ orgId: org.id }).members({ userId }).delete();
    if (r.error) return toast.error(messageOf(r.error), "Could not remove");
    void members.reload();
    toast.success(`${name} removed`);
  };
  const cancelInvite = async (invitationId: string) => {
    const r = await authClient.organization.cancelInvitation({ invitationId });
    if (r.error) return toast.error(authError(r), "Could not cancel");
    void invites.reload();
    toast.success("Invite cancelled");
  };
  const duplicate = (from: RoleSpec) =>
    setEditing({
      isNew: true,
      role: {
        ...blankRole,
        name: `${from.name.slice(0, 35)} copy`,
        description: from.description,
        base: from.base,
        groups: from.groups,
        resources: from.resources,
      },
    });

  return (
    <>
      <PageHeader
        title="Team"
        sub={`Who can open ${org.name}, and what their role lets them do.`}
        actions={
          tab === "people" ? (
            <Can I="create" on="invitation">
              <NewButton size="sm" onClick={() => setInviteOpen(true)}>
                Invite
              </NewButton>
            </Can>
          ) : (
            <Can I="create" on="ac">
              <NewButton size="sm" onClick={() => setEditing({ role: blankRole, isNew: true })}>
                New role
              </NewButton>
            </Can>
          )
        }
      />
      <div className="max-w-3xl space-y-4">
        {can("ac", "read") && (
          <Tabs
            tabs={[
              { id: "people", label: "People", count: people.length + waiting.length },
              { id: "roles", label: "Roles", count: roles.length },
            ]}
            value={tab}
            onChange={setTab}
          />
        )}
        {tab === "people" && (
          <Card pad={false}>
            {people.map((m) => (
              <ItemRow
                key={m.userId}
                leading={<Avatar name={m.name} />}
                title={
                  <>
                    {m.name}
                    {m.userId === me?.id && <Badge>You</Badge>}
                  </>
                }
                sub={m.email}
              >
                {m.userId === me?.id || (m.role === "owner" && !isOwner) ? (
                  <span className="text-[13px] text-muted">{nameOf(m.role)}</span>
                ) : (
                  <Can I="update" on="member">
                    <RoleSelect
                      label={`${m.name}'s role`}
                      roles={roles}
                      exclude={isOwner ? [] : ["owner"]}
                      value={m.role}
                      onChange={(role) => void changeRole(m.userId, m.name, role)}
                    />
                  </Can>
                )}
                {m.userId !== me?.id && (
                  <Can I="delete" on="member" hide>
                    <Button
                      size="sm"
                      variant="ghost"
                      aria-label={`Remove ${m.name}`}
                      icon={<Trash2 size={13} />}
                      onClick={() => void remove(m.userId, m.name)}
                    />
                  </Can>
                )}
              </ItemRow>
            ))}
            {waiting.map((i) => (
              <ItemRow
                key={i.id}
                leading={<Avatar name={i.email} />}
                title={
                  <>
                    <span className="min-w-0 truncate">{i.email}</span>
                    <Badge tone="warn">Invited</Badge>
                  </>
                }
                sub={`Invite expires ${fmtDate(i.expiresAt as unknown as string)}`}
              >
                <span className="text-[13px] text-muted">{nameOf(i.role ?? "")}</span>
                <Can I="cancel" on="invitation" hide>
                  <Button
                    size="sm"
                    variant="ghost"
                    aria-label={`Cancel ${i.email}'s invite`}
                    icon={<Trash2 size={13} />}
                    onClick={() => void cancelInvite(i.id)}
                  />
                </Can>
              </ItemRow>
            ))}
          </Card>
        )}
        {tab === "roles" && (
          <div className="space-y-3">
            {roles.map((r) => {
              const holders = peopleWith(r.id);
              return (
                <ItemCard
                  key={r.id}
                  title={r.name}
                  badges={r.preset ? <Badge>Built in</Badge> : <Badge tone="accent">Custom</Badge>}
                  meta={`${holders} ${holders === 1 ? "person" : "people"} · ${actionCount(r)} actions`}
                  description={r.description}
                  actions={
                    <Button size="sm" onClick={() => setEditing({ role: r, isNew: false })}>
                      {r.preset || !can("ac", "update") ? "View" : "Edit"}
                    </Button>
                  }
                >
                  <AccessSummary spec={r} catalog={cat} />
                </ItemCard>
              );
            })}
          </div>
        )}
      </div>
      <InvitePanel
        open={inviteOpen}
        onClose={() => {
          setInviteOpen(false);
          setParams({}, { replace: true });
        }}
        orgId={org.id}
        roles={roles}
        onSent={(email) => {
          void invites.reload();
          toast.success(`Invited ${email}`);
        }}
      />
      {editing && (
        <RoleEditor
          key={editing.isNew ? "new" : editing.role.id}
          orgId={org.id}
          catalog={cat}
          role={editing.role}
          isNew={editing.isNew}
          taken={custom.map((r) => r.id)}
          onClose={() => setEditing(null)}
          onDuplicate={duplicate}
          onDone={(message) => {
            setEditing(null);
            void customRoles.reload();
            toast.success(message);
          }}
        />
      )}
    </>
  );
}

function InvitePanel({
  open,
  onClose,
  orgId,
  roles,
  onSent,
}: {
  open: boolean;
  onClose: () => void;
  orgId: string;
  roles: RoleSpec[];
  onSent: (email: string) => void;
}) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("editor");
  const [busy, setBusy] = useState(false);
  const fb = useFeedback(open);
  const address = email.trim();
  const valid = /^\S+@\S+\.\S+$/.test(address);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!valid) return;
    setBusy(true);
    fb.clear();
    const r = await authClient.organization.inviteMember({ email: address, role: role as never, organizationId: orgId });
    setBusy(false);
    if (r.error) return fb.fail(authError(r), "Could not send");
    setEmail("");
    onSent(address);
    onClose();
  };
  return (
    <Drawer
      open={open}
      onClose={onClose}
      title="Invite to the team"
      onSubmit={submit}
      feedback={<Feedback {...fb.props} />}
      footer={
        <>
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" disabled={!valid || busy}>
            {busy ? "Sending…" : "Send invite"}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Email">
          <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@example.com" />
        </Field>
        <Field label="Role" hint={roles.find((r) => r.id === role)?.description}>
          <RoleSelect label="Role" roles={roles} value={role} onChange={setRole} size="md" className="w-full" />
        </Field>
      </div>
    </Drawer>
  );
}
