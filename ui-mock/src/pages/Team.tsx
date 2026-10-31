import { useState } from "react";
import { ChevronRight, Eye, Plus, Copy, Trash2 } from "lucide-react";
import { Badge, Button, Card, Checkbox, Drawer, Field, Input, Modal, PageHeader, Segmented, Select, Tabs, Textarea, cn, useToast } from "../components/ui";
import { Can } from "../components/Can";
import { actionsFor, groups, levelHint, levelLabel, levels, resources, settingFor, type GroupId, type Level, type Resource, type RoleSpec } from "../data/access";
import { memberships, organization } from "../data/org";
import { partner } from "../data/partner";
import { useScope } from "../lib/scope";
import { assistant } from "../lib/whitelabel";
import {
  actionCount, allRoles, can, deleteRole, invite, inviteStaff, peopleWithRole, removePerson, removeStaff, roleById, saveRole, setPersonRole, setPreview, setStaff, staffOn, useAccess,
} from "../lib/access";

const initials = (n: string) => n.replace(/^Dr\.?\s+/, "").split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase();
const Avatar = ({ name }: { name: string }) => <span className="grid size-8 shrink-0 place-items-center rounded-full bg-hover text-[12px] font-medium">{initials(name)}</span>;
const groupLabel = (g: GroupId, label: string) => (g === "marko" ? assistant() : label);

/** Role picker with each role's description underneath the list. */
function RoleSelect({ value, onChange, label, exclude = ["owner"], disabled, title }: { value: string; onChange: (v: string) => void; label: string; exclude?: string[]; disabled?: boolean; title?: string }) {
  const s = useAccess();
  return (
    <Select size="sm" value={value} onChange={(e) => onChange(e.target.value)} aria-label={label} disabled={disabled} title={title} className="w-auto min-w-37.5">
      {allRoles(s).filter((r) => !exclude.includes(r.id)).map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
    </Select>
  );
}

// ---------- Organization team ----------

/**
 * The people on this Organization and the roles they can have. Roles are the
 * only way to grant access: no one-off exceptions per person, so what a person
 * can do is always "what their role says".
 */
export default function Team() {
  const s = useAccess();
  const { orgId } = useScope();
  const org = memberships.find((m) => m.id === orgId) ?? organization;
  const [tab, setTab] = useState<"people" | "roles">("people");
  const [inviting, setInviting] = useState(false);
  const [editing, setEditing] = useState<RoleSpec | null>(null);
  const { toast, node } = useToast();
  const staff = staffOn(orgId, s);
  const newRole = (from?: RoleSpec) => setEditing({ id: `r_${Date.now().toString(36)}`, name: from ? `${from.name} copy` : "", description: from?.description ?? "", base: from?.base ?? "none", groups: { ...from?.groups }, resources: { ...from?.resources } });

  return (
    <>
      <PageHeader
        title="Team"
        sub={`Who can open ${org.name}, and what their role lets them do.`}
        actions={tab === "people"
          ? <Can I="create" on="invitation"><Button size="sm" variant="primary" icon={<Plus size={13} />} onClick={() => setInviting(true)}>Invite</Button></Can>
          : <Can I="create" on="ac"><Button size="sm" variant="primary" icon={<Plus size={13} />} onClick={() => newRole()}>New role</Button></Can>}
      />
      <div className="max-w-3xl space-y-4">
        <Tabs value={tab} onChange={setTab} tabs={[{ id: "people", label: "People", count: s.people.length + staff.length }, { id: "roles", label: "Roles", count: allRoles(s).length }]} />

        {tab === "people" && (
          <>
            <Card pad={false}>
              {s.people.map((p) => (
                <div key={p.id} className="flex flex-wrap items-center gap-3 border-b border-line px-5 py-3 last:border-0">
                  <Avatar name={p.name} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 text-[14px]">{p.name}{p.id === s.me && <Badge>You</Badge>}{p.invited && <Badge tone="warn">Invited</Badge>}</div>
                    <div className="truncate text-[12.5px] text-muted">{p.email}</div>
                  </div>
                  {p.roleId === "owner" ? <span className="text-[13px] text-muted">Owner</span> : (
                    <Can I="update" on="member"><RoleSelect label={`${p.name}'s role`} value={p.roleId} onChange={(r) => { setPersonRole(p.id, r); toast(`${p.name} is now ${roleById(r).name}`); }} /></Can>
                  )}
                  {p.roleId !== "owner" && p.id !== s.me && (
                    <Can I={p.invited ? "cancel" : "delete"} on={p.invited ? "invitation" : "member"} hide>
                      <Button size="sm" variant="ghost" aria-label={p.invited ? `Cancel ${p.name}'s invite` : `Remove ${p.name}`} icon={<Trash2 size={13} />} onClick={() => { removePerson(p.id); toast(p.invited ? "Invite cancelled" : `${p.name} removed`); }} />
                    </Can>
                  )}
                </div>
              ))}
            </Card>
            {partner && staff.length > 0 && (
              <Card pad={false}>
                <div className="border-b border-line px-5 py-3 text-[12.5px] text-muted">From {partner.name}. Their access is managed by {partner.name}, not here.</div>
                {staff.map(({ staff: x, roleId }) => (
                  <div key={x.id} className="flex items-center gap-3 border-b border-line px-5 py-3 last:border-0">
                    <Avatar name={x.name} />
                    <div className="min-w-0 flex-1"><div className="text-[14px]">{x.name}</div><div className="truncate text-[12.5px] text-muted">{x.email}</div></div>
                    <span className="text-[13px] text-muted">{roleById(roleId).name}</span>
                  </div>
                ))}
              </Card>
            )}
          </>
        )}

        {tab === "roles" && (
          <div className="space-y-3">
            {allRoles(s).map((r) => (
              <Card key={r.id}>
                <div className="flex flex-wrap items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2 text-[14px] font-medium">{r.name}{r.preset ? <Badge>Built in</Badge> : <Badge tone="accent">Custom</Badge>}<span className="text-[12.5px] font-normal text-muted">{peopleWithRole(r.id, s)} {peopleWithRole(r.id, s) === 1 ? "person" : "people"} · {actionCount(r)} actions</span></div>
                    <p className="mt-0.5 text-[12.5px] text-muted">{r.description}</p>
                    <RoleSummary spec={r} />
                  </div>
                  <div className="flex gap-1.5">
                    {r.id !== "owner" && <Button size="sm" variant="ghost" icon={<Eye size={13} />} onClick={() => { setPreview(r.id); toast(`Previewing as ${r.name}`); }}>Preview</Button>}
                    <Button size="sm" onClick={() => setEditing(r)}>{r.preset || !can("ac", "update", s) ? "View" : "Edit"}</Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      <InviteModal open={inviting} onClose={() => setInviting(false)} onSent={(email) => toast(`Invite sent to ${email}`)} />
      {editing && <RoleEditor key={editing.id} spec={editing} onClose={() => setEditing(null)} onDuplicate={(r) => newRole(r)} toast={toast} />}
      {node}
    </>
  );
}

/** One line per group the role reaches, e.g. "Social media: Publish · Local SEO: View". */
function RoleSummary({ spec }: { spec: RoleSpec }) {
  const parts = groups.map((g) => {
    const lv = spec.id === "owner" ? "manage" : (spec.groups[g.id] ?? spec.base);
    const custom = g.resources.some((x) => spec.resources[x.id] !== undefined);
    return lv === "none" && !custom ? null : `${groupLabel(g.id, g.label)}: ${levelLabel[lv]}${custom ? "*" : ""}`;
  }).filter(Boolean);
  return <p className="mt-2 text-[12px] text-subtle">{parts.length ? parts.join(" · ") : "No access to anything yet"}</p>;
}

function InviteModal({ open, onClose, onSent }: { open: boolean; onClose: () => void; onSent: (email: string) => void }) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("editor");
  const ok = /^\S+@\S+\.\S+$/.test(email.trim());
  const send = () => { if (!ok) return; invite(email.trim(), role); onSent(email.trim()); setEmail(""); onClose(); };
  return (
    <Modal open={open} onClose={onClose} title="Invite to the team" footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button variant="primary" disabled={!ok} onClick={send}>Send invite</Button></>}>
      <div className="space-y-4">
        <Field label="Email"><Input autoFocus type="email" value={email} onChange={(e) => setEmail(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send()} placeholder="name@example.com" /></Field>
        <Field label="Role" hint={roleById(role).description}><RoleSelect label="Role" value={role} onChange={setRole} /></Field>
      </div>
    </Modal>
  );
}

// ---------- Role editor ----------

type Setting = Level | string[] | undefined;

/**
 * Set a level per module; open a module to give one feature a different level
 * or pick its exact actions. Anything left alone follows its module, so new
 * features get the module's level in every role without anyone editing them.
 */
function RoleEditor({ spec: initial, onClose, onDuplicate, toast }: { spec: RoleSpec; onClose: () => void; onDuplicate: (r: RoleSpec) => void; toast: (m: string) => void }) {
  const s = useAccess();
  const isNew = !allRoles(s).some((r) => r.id === initial.id);
  const readOnly = !!initial.preset || !can("ac", isNew ? "create" : "update", s);
  const [spec, setSpec] = useState(initial);
  const [open, setOpen] = useState<Partial<Record<GroupId, boolean>>>({});
  const setGroup = (g: GroupId, lv: Level | "inherit") => setSpec((x) => { const groups = { ...x.groups }; if (lv === "inherit") delete groups[g]; else groups[g] = lv; return { ...x, groups }; });
  const setResource = (r: Resource, v: Setting) => setSpec((x) => { const resources = { ...x.resources }; if (v === undefined) delete resources[r]; else resources[r] = v; return { ...x, resources }; });
  const save = () => {
    if (!spec.name.trim()) return toast("Give the role a name");
    saveRole({ ...spec, name: spec.name.trim() });
    toast(isNew ? `${spec.name.trim()} created` : `${spec.name.trim()} saved. Everyone with it has the new access now`);
    onClose();
  };
  const people = peopleWithRole(spec.id, s);

  return (
    <Drawer open onClose={onClose} width={720} title={readOnly ? spec.name : isNew ? "New role" : `Edit ${initial.name}`}
      footer={
        <div className="flex w-full flex-wrap items-center gap-2">
          {!isNew && !initial.preset && (
            <Can I="delete" on="ac" hide><Button variant="ghost" icon={<Trash2 size={13} />} onClick={() => { deleteRole(spec.id); toast(people ? `${spec.name} deleted. ${people} ${people === 1 ? "person is" : "people are"} now Viewer` : `${spec.name} deleted`); onClose(); }}>Delete</Button></Can>
          )}
          <span className="ml-auto" />
          {spec.id !== "owner" && <Can I="create" on="ac" hide><Button icon={<Copy size={13} />} onClick={() => { onClose(); onDuplicate(spec); }}>Duplicate</Button></Can>}
          {readOnly ? <Button variant="primary" onClick={onClose}>Done</Button> : <><Button variant="ghost" onClick={onClose}>Cancel</Button><Button variant="primary" onClick={save}>{isNew ? "Create role" : "Save"}</Button></>}
        </div>
      }>
      <div className="space-y-5">
        {initial.preset ? <p className="text-[13px] text-muted">{spec.description} Built-in roles are the same in every organization. Duplicate it to make your own version.</p> : (
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Name"><Input value={spec.name} disabled={readOnly} onChange={(e) => setSpec({ ...spec, name: e.target.value })} placeholder="Social media manager" /></Field>
            <Field label="Description" className="sm:col-span-2"><Textarea rows={2} value={spec.description} disabled={readOnly} onChange={(e) => setSpec({ ...spec, description: e.target.value })} placeholder="What this person does here" /></Field>
          </div>
        )}

        <div>
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <div><div className="text-[13.5px] font-medium">Everything</div><div className="text-[12px] text-muted">The starting level. Each area below can go higher or lower.</div></div>
            <Segmented label="Level for everything" value={spec.base} onChange={(v) => !readOnly && setSpec({ ...spec, base: v })} options={levels.map((l) => ({ id: l, label: levelLabel[l] }))} />
          </div>
          <p className="text-[12px] text-subtle">{levels.map((l) => `${levelLabel[l]}: ${levelHint[l].toLowerCase()}`).join(" · ")}</p>
        </div>

        <div className="divide-y divide-line overflow-hidden rounded-xl border border-line">
          {groups.map((g) => {
            const own = spec.groups[g.id];
            const overrides = g.resources.filter((x) => spec.resources[x.id] !== undefined).length;
            return (
              <div key={g.id}>
                <div className="flex flex-wrap items-center gap-2 px-3 py-2.5">
                  <button onClick={() => setOpen((o) => ({ ...o, [g.id]: !o[g.id] }))} aria-expanded={!!open[g.id]} className="flex min-w-0 flex-1 items-center gap-1.5 text-left text-[13.5px] font-medium">
                    <ChevronRight size={14} className={cn("shrink-0 text-subtle transition-transform", open[g.id] && "rotate-90")} />
                    {groupLabel(g.id, g.label)}
                    {overrides > 0 && <span className="text-[12px] font-normal text-muted">· {overrides} changed</span>}
                  </button>
                  <Segmented label={`${g.label} level`} value={own ?? "inherit"} onChange={(v) => !readOnly && setGroup(g.id, v)}
                    options={[{ id: "inherit" as const, label: <span className="text-subtle">Same</span> }, ...levels.map((l) => ({ id: l, label: levelLabel[l] }))]} />
                </div>
                {open[g.id] && (
                  <div className="space-y-1 bg-bg px-3 pt-1 pb-3">
                    {g.resources.map((x) => <ResourceRow key={x.id} spec={spec} r={x.id} label={x.label} readOnly={readOnly} onChange={(v) => setResource(x.id, v)} />)}
                  </div>
                )}
              </div>
            );
          })}
        </div>
        <p className="text-[12px] text-subtle">“Same” follows the level above it. Features added later follow their area, so this role never needs updating for them.</p>
      </div>
    </Drawer>
  );
}

function ResourceRow({ spec, r, label, readOnly, onChange }: { spec: RoleSpec; r: Resource; label: string; readOnly: boolean; onChange: (v: Setting) => void }) {
  const own = spec.resources[r];
  const allowed = actionsFor(spec, r);
  const acts = resources[r].filter((a) => !a.ownerOnly);
  const inherited = settingFor({ ...spec, resources: {} }, r);
  const value = own === undefined ? "inherit" : Array.isArray(own) ? "custom" : own;
  return (
    <div className="rounded-lg px-2 py-2 hover:bg-surface">
      <div className="flex flex-wrap items-center gap-2">
        <div className="min-w-0 flex-1">
          <div className="text-[13px]">{label}</div>
          <div className="truncate text-[12px] text-muted">{allowed.length ? acts.filter((a) => allowed.includes(a.id)).map((a) => a.label).join(", ") : "No access"}</div>
        </div>
        <Select size="xs" aria-label={`${label} level`} value={value} disabled={readOnly} className="w-auto"
          onChange={(e) => { const v = e.target.value; onChange(v === "inherit" ? undefined : v === "custom" ? allowed : (v as Level)); }}>
          <option value="inherit">Same ({Array.isArray(inherited) ? "custom" : levelLabel[inherited]})</option>
          {levels.map((l) => <option key={l} value={l}>{levelLabel[l]}</option>)}
          <option value="custom">Pick actions…</option>
        </Select>
      </div>
      {Array.isArray(own) && (
        <div className="mt-2 grid gap-1.5 pl-1 sm:grid-cols-2">
          {acts.map((a) => (
            <label key={a.id} className="flex items-center gap-2 text-[12.5px]">
              <Checkbox checked={own.includes(a.id)} onChange={(on) => !readOnly && onChange(on ? [...own, a.id] : own.filter((x) => x !== a.id))} label={a.label} />
              {a.label}<span className="text-subtle">· {levelLabel[a.tier]}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------- Partner team ----------

/**
 * The Partner's own staff. Admins are Admin on every Client and manage this
 * page; Members only open the Clients they're assigned, with a role per Client.
 */
export function PartnerTeam() {
  const s = useAccess();
  const [assigning, setAssigning] = useState<string | null>(null);
  const [inviting, setInviting] = useState(false);
  const [email, setEmail] = useState("");
  const { toast, node } = useToast();
  if (!partner) return <></>;
  const clients = memberships;
  const who = s.staff.find((x) => x.id === assigning);

  return (
    <>
      <PageHeader title="Partner team" sub={`${partner.name} staff. Admins work on every client and manage this page. Members only see the clients you assign, with the role you pick for each.`} actions={<Button size="sm" variant="primary" icon={<Plus size={13} />} onClick={() => setInviting(true)}>Invite</Button>} />
      <Card pad={false} className="max-w-3xl">
        {s.staff.map((x) => {
          const mine = Object.entries(x.clients);
          return (
            <div key={x.id} className="flex flex-wrap items-center gap-3 border-b border-line px-5 py-3.5 last:border-0">
              <Avatar name={x.name} />
              <div className="min-w-0 flex-1">
                <div className="text-[14px]">{x.name}</div>
                <div className="text-[12.5px] text-muted">
                  {x.partnerRole === "Admin" ? `Admin on all ${clients.length} clients` : mine.length ? mine.map(([o, r]) => `${clients.find((c) => c.id === o)?.name ?? o} · ${roleById(r).name}`).join(", ") : "No clients yet"}
                </div>
              </div>
              {x.partnerRole === "Member" && <Button size="sm" onClick={() => setAssigning(x.id)}>Clients</Button>}
              <Select size="sm" value={x.partnerRole} aria-label={`${x.name}'s partner role`} className="w-auto" onChange={(e) => setStaff(x.id, { partnerRole: e.target.value as "Admin" | "Member" })}>
                <option value="Admin">Admin</option>
                <option value="Member">Member</option>
              </Select>
              <Button size="sm" variant="ghost" aria-label={`Remove ${x.name}`} icon={<Trash2 size={13} />} onClick={() => { removeStaff(x.id); toast(`${x.name} removed from every client`); }} />
            </div>
          );
        })}
      </Card>

      <Modal open={inviting} onClose={() => setInviting(false)} title={`Invite to ${partner.name}`} footer={<><Button variant="ghost" onClick={() => setInviting(false)}>Cancel</Button><Button variant="primary" disabled={!/^\S+@\S+\.\S+$/.test(email)} onClick={() => { inviteStaff(email.trim(), "Member"); toast(`Invite sent. Assign ${email.trim()} to clients when they join`); setEmail(""); setInviting(false); }}>Send invite</Button></>}>
        <Field label="Email" hint="Joins as a Member with no clients. Assign clients, or make them an Admin, from the list."><Input autoFocus type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@youragency.com" /></Field>
      </Modal>

      <Modal open={!!who} onClose={() => setAssigning(null)} title={`${who?.name}'s clients`} width={560} footer={<Button variant="primary" onClick={() => setAssigning(null)}>Done</Button>}>
        {who && (
          <div className="divide-y divide-line">
            {clients.map((c) => {
              const role = who.clients[c.id];
              const toggle = (on: boolean) => { const next = { ...who.clients }; if (on) next[c.id] = "editor"; else delete next[c.id]; setStaff(who.id, { clients: next }); };
              return (
                <div key={c.id} className="flex items-center gap-3 py-2.5">
                  <Checkbox checked={!!role} onChange={toggle} label={c.name} />
                  <span className="min-w-0 flex-1 truncate text-[13.5px]">{c.name}</span>
                  {role && <RoleSelect label={`Role on ${c.name}`} value={role} onChange={(r) => setStaff(who.id, { clients: { ...who.clients, [c.id]: r } })} />}
                </div>
              );
            })}
          </div>
        )}
      </Modal>
      {node}
    </>
  );
}
