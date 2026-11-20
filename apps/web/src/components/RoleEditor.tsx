// The Role editor (ADR 0003) and the pieces other pages show Roles with. A Role is a starting level for everything, a
// level per area where it differs, and a level or a hand-picked list of actions per resource where that differs. Each
// step falls back to the one above it, so a feature added later follows its area in every Role.
import { useRef, useState, type ReactNode } from "react";
import { Copy, Trash2 } from "lucide-react";
import { actionsFor, levelHint, levelLabel, levels, type AccessCatalog, type Level, type RoleSpec } from "@app/shared/access";
import { api, messageOf } from "../lib/api";
import { useSession } from "../lib/session";
import { Can } from "./Can";
import { Feedback, useFeedback } from "./Feedback";
import { Button, Checkbox, Disclosure, Drawer, Field, Input, Segmented, Select, Textarea, type FieldSize } from "./ui";

export type RoleCatalog = AccessCatalog & { presets: RoleSpec[] };
type Resource = AccessCatalog["resources"][number];
type Group = AccessCatalog["groups"][number];
type Draft = Omit<RoleSpec, "groups" | "resources" | "preset"> & {
  groups: Record<string, Level>;
  resources: Record<string, Level | string[]>;
};

const NAME_PATTERN = /^[\p{L}\p{N}][\p{L}\p{N} -]*$/u;
const levelOptions = levels.map((id) => ({ id, label: levelLabel[id] }));
const assignable = (r: Resource) => r.actions.filter((a) => !a.ownerOnly);

/** A dropdown of Roles, for giving one to a person. Owner is left out unless the caller may hand it out. */
export function RoleSelect({
  roles,
  value,
  onChange,
  label,
  exclude = ["owner"],
  size = "sm",
  className = "w-auto min-w-37.5",
  disabled,
  title,
}: {
  roles: Pick<RoleSpec, "id" | "name">[];
  value: string;
  onChange: (role: string) => void;
  label: string;
  exclude?: string[];
  size?: FieldSize;
  className?: string;
  disabled?: boolean;
  title?: string;
}) {
  return (
    <Select
      size={size}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      aria-label={label}
      disabled={disabled}
      title={title}
      className={className}
    >
      {roles
        .filter((r) => !exclude.includes(r.id))
        .map((r) => (
          <option key={r.id} value={r.id}>
            {r.name}
          </option>
        ))}
    </Select>
  );
}

/** One line on what a Role reaches: each area and its level, with * where part of the area differs. */
export function AccessSummary({ spec, catalog }: { spec: RoleSpec; catalog: AccessCatalog }) {
  const areas = catalog.groups.flatMap((g) => {
    const level = spec.id === "owner" ? "manage" : (spec.groups[g.id] ?? spec.base);
    const adjusted = catalog.resources.some((r) => r.group === g.id && spec.resources[r.id] !== undefined);
    return level === "none" && !adjusted ? [] : [`${g.label}: ${levelLabel[level]}${adjusted ? "*" : ""}`];
  });
  return <p className="mt-2 text-[12px] text-subtle">{areas.length ? areas.join(" · ") : "No access to anything yet"}</p>;
}

export function RoleEditor({
  orgId,
  catalog,
  role,
  isNew,
  taken,
  onClose,
  onDone,
  onDuplicate,
}: {
  orgId: string;
  catalog: RoleCatalog;
  /** The Role to show, or what a new one starts as. */
  role: RoleSpec;
  isNew: boolean;
  /** Names already in use in this Organization. */
  taken: string[];
  onClose: () => void;
  /** Saved or deleted; the message says which. */
  onDone: (message: string) => void;
  onDuplicate: (spec: RoleSpec) => void;
}) {
  const { can } = useSession();
  const [initial] = useState<Draft>(() => ({
    id: role.id,
    name: role.name,
    description: role.description,
    base: role.base,
    groups: { ...role.groups } as Draft["groups"],
    resources: { ...role.resources } as Draft["resources"],
  }));
  const [draft, setDraft] = useState(initial);
  const [triedSave, setTriedSave] = useState(false);
  const [busy, setBusy] = useState(false);
  const fb = useFeedback();
  const nameInput = useRef<HTMLInputElement>(null);

  const readOnly = !!role.preset || !can("ac", isNew ? "create" : "update");
  const name = draft.name.trim();
  const reserved = [...catalog.presets.map((p) => p.id), ...taken].map((n) => n.toLowerCase());
  const nameProblem = !isNew
    ? null
    : !name
      ? "Give the role a name."
      : !NAME_PATTERN.test(name)
        ? "Use only letters, digits, spaces and dashes."
        : reserved.includes(name.toLowerCase())
          ? "That name is already taken."
          : null;
  const showNameProblem = nameProblem && (triedSave || !!name);
  const dirty = JSON.stringify(draft) !== JSON.stringify(initial);

  const close = () => {
    if (readOnly || !dirty || confirm("Discard your changes to this role?")) onClose();
  };
  const setGroup = (id: string, level: Level | "inherit") => {
    const groups = { ...draft.groups };
    if (level === "inherit") delete groups[id];
    else groups[id] = level;
    setDraft({ ...draft, groups });
  };
  const setResource = (id: string, setting: Level | string[] | undefined) => {
    const resources = { ...draft.resources };
    if (setting === undefined) delete resources[id];
    else resources[id] = setting;
    setDraft({ ...draft, resources });
  };
  const save = async () => {
    if (nameProblem) {
      setTriedSave(true);
      nameInput.current?.focus();
      return;
    }
    setBusy(true);
    fb.clear();
    const { description, base, groups, resources } = draft;
    const body = { name: isNew ? name : draft.name, description, base, groups, resources };
    const roles = api.api.v1.organizations({ orgId }).roles({ role: isNew ? name : role.id });
    const r = await (isNew ? roles.post(body) : roles.put(body));
    setBusy(false);
    if (r.error) return fb.fail(messageOf(r.error));
    onDone(isNew ? `${name} created` : `${role.name} saved. Everyone with it has the new access now`);
  };
  const remove = async () => {
    if (!confirm(`Delete the role "${role.name}"?`)) return;
    fb.clear();
    const r = await api.api.v1.organizations({ orgId }).roles({ role: role.id }).delete();
    if (r.error) return fb.fail(messageOf(r.error), "Could not delete");
    onDone(`${role.name} deleted`);
  };

  return (
    <Drawer
      open
      onClose={close}
      width={720}
      feedback={<Feedback {...fb.props} />}
      title={readOnly ? role.name : isNew ? "New role" : `Edit ${role.name}`}
      footer={
        <>
          {!isNew && !role.preset && (
            <Can I="delete" on="ac" hide>
              <Button variant="ghost" icon={<Trash2 size={13} />} onClick={() => void remove()}>
                Delete
              </Button>
            </Can>
          )}
          <span className="mr-auto" />
          {!isNew && role.id !== "owner" && (
            <Can I="create" on="ac" hide>
              <Button icon={<Copy size={13} />} onClick={() => onDuplicate({ ...draft, name: draft.name || role.name })}>
                Duplicate
              </Button>
            </Can>
          )}
          {readOnly ? (
            <Button variant="primary" onClick={onClose}>
              Done
            </Button>
          ) : (
            <>
              <Button variant="ghost" onClick={close}>
                Cancel
              </Button>
              <Button variant="primary" disabled={busy} onClick={() => void save()}>
                {busy ? "Saving…" : isNew ? "Create role" : "Save"}
              </Button>
            </>
          )}
        </>
      }
    >
      <div className="space-y-5">
        {role.preset ? (
          <p className="text-[13px] text-muted">
            {role.description} Built-in roles are the same in every organization. Duplicate it to make your own version.
          </p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            <Field
              label="Name"
              hint={
                showNameProblem ? <span className="text-bad">{nameProblem}</span> : !isNew && !readOnly ? "Fixed once made." : undefined
              }
            >
              <Input
                ref={nameInput}
                required
                maxLength={40}
                disabled={!isNew || readOnly}
                aria-invalid={!!showNameProblem}
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                placeholder="Social media manager"
              />
            </Field>
            <Field label="Description" className="sm:col-span-2">
              <Textarea
                rows={2}
                maxLength={200}
                disabled={readOnly}
                value={draft.description}
                onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                placeholder="What this person does here"
              />
            </Field>
          </div>
        )}

        <div>
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <div>
              <div className="text-[13.5px] font-medium">Everything</div>
              <div className="text-[12px] text-muted">The starting level. Each area below can go higher or lower.</div>
            </div>
            <Segmented
              label="Level for everything"
              disabled={readOnly}
              options={levelOptions}
              value={draft.base}
              onChange={(base) => setDraft({ ...draft, base })}
            />
          </div>
          <p className="text-[12px] text-subtle">{levels.map((l) => `${levelLabel[l]}: ${levelHint[l].toLowerCase()}`).join(" · ")}</p>
        </div>

        <div className="divide-y divide-line overflow-hidden rounded-xl border border-line">
          {catalog.groups.map((g) => (
            <Area
              key={g.id}
              group={g}
              resources={catalog.resources.filter((r) => r.group === g.id)}
              draft={draft}
              readOnly={readOnly}
              onLevel={(level) => setGroup(g.id, level)}
              onResource={setResource}
            />
          ))}
        </div>
        <p className="text-[12px] text-subtle">
          “Same” follows the level above it. Features added later follow their area, so this role never needs updating for them.
        </p>
      </div>
    </Drawer>
  );
}

function Area({
  group,
  resources,
  draft,
  readOnly,
  onLevel,
  onResource,
}: {
  group: Group;
  resources: Resource[];
  draft: Draft;
  readOnly: boolean;
  onLevel: (level: Level | "inherit") => void;
  onResource: (id: string, setting: Level | string[] | undefined) => void;
}) {
  const changed = resources.filter((r) => draft.resources[r.id] !== undefined).length;
  const options: { id: Level | "inherit"; label: ReactNode }[] = [
    { id: "inherit", label: <span className="text-subtle">Same</span> },
    ...levelOptions,
  ];
  return (
    <Disclosure
      label={group.label}
      note={changed > 0 ? `${changed} changed` : undefined}
      control={
        <Segmented
          label={`${group.label} level`}
          disabled={readOnly}
          options={options}
          value={draft.groups[group.id] ?? "inherit"}
          onChange={onLevel}
        />
      }
    >
      {resources
        .filter((r) => assignable(r).length > 0)
        .map((r) => (
          <ResourceRow key={r.id} resource={r} draft={draft} readOnly={readOnly} onChange={(s) => onResource(r.id, s)} />
        ))}
    </Disclosure>
  );
}

function ResourceRow({
  resource: r,
  draft,
  readOnly,
  onChange,
}: {
  resource: Resource;
  draft: Draft;
  readOnly: boolean;
  onChange: (setting: Level | string[] | undefined) => void;
}) {
  const setting = draft.resources[r.id];
  const has = actionsFor(draft, r);
  const actions = assignable(r);
  const inherited = draft.groups[r.group] ?? draft.base;
  // Only the levels that do something here, and whatever is already saved.
  const offered = levels.filter((l) => l === "none" || l === setting || actions.some((a) => a.tier === l));
  return (
    <div className="rounded-lg px-2 py-2 hover:bg-surface">
      <div className="flex flex-wrap items-center gap-2">
        <div className="min-w-0 flex-1 basis-40">
          <div className="text-[13px]">{r.label}</div>
          <div className="truncate text-[12px] text-muted">
            {has.length
              ? actions
                  .filter((a) => has.includes(a.id))
                  .map((a) => a.label)
                  .join(", ")
              : "No access"}
          </div>
        </div>
        <Select
          size="xs"
          aria-label={`${r.label} level`}
          disabled={readOnly}
          className="w-auto"
          value={setting === undefined ? "inherit" : Array.isArray(setting) ? "custom" : setting}
          onChange={(e) => {
            const v = e.target.value;
            onChange(v === "inherit" ? undefined : v === "custom" ? has : (v as Level));
          }}
        >
          <option value="inherit">Same ({levelLabel[inherited]})</option>
          {offered.map((l) => (
            <option key={l} value={l}>
              {levelLabel[l]}
            </option>
          ))}
          <option value="custom">Pick actions…</option>
        </Select>
      </div>
      {Array.isArray(setting) && (
        <div className="mt-2 grid gap-1.5 pl-1 sm:grid-cols-2">
          {actions.map((a) => (
            <label key={a.id} className="flex items-center gap-2 text-[12.5px]">
              <Checkbox
                checked={setting.includes(a.id)}
                label={a.label}
                onChange={(on) => !readOnly && onChange(on ? [...setting, a.id] : setting.filter((id) => id !== a.id))}
              />
              {a.label}
              <span className="text-subtle">· {levelLabel[a.tier]}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}
