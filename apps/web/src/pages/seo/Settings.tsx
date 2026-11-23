// SEO settings (/seo/settings): how the Location is checked and its Google profile. Each card shows what's set, and
// Change opens the side panel. Only people who manage SEO change anything; checks stay within the Plan's limits.
// The fields for services and for checks are shared with setup (fields.tsx).
import { useState, type FormEvent } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { Badge, Button, Card, CardHeader, Checkbox, Drawer, Field, Input, NewButton, Select, cn } from "../../components/ui";
import { Feedback, LoadError, useFeedback, useToast } from "../../components/Feedback";
import { Row } from "../../components/Table";
import { messageOf } from "../../lib/api";
import { useLoad } from "../../lib/useLoad";
import { engineNames, locationApi, seoApi, type Engine, type Limits } from "./api";
import { SeoHeader, useSeo } from "./Seo";
import {
  ChecksFields,
  GRID_SIZE,
  ServicesField,
  gridCoverage,
  connectGoogle,
  everyLabel,
  useOAuthError,
  type Checks,
  type Every,
} from "./fields";

// ---------- The page ----------

export default function Settings() {
  const { orgId, location, locations, can, reload } = useSeo();
  const manage = can("manage");
  const limits = useLoad(() => seoApi(orgId).limits.get(), [orgId]);
  const [open, setOpen] = useState<"business" | "checks" | "profile" | null>(null);
  const toast = useToast();
  const navigate = useNavigate();
  const here = locationApi(orgId, location.id);
  useOAuthError((text) => toast.error(text, "Could not connect Google"));

  const setStatus = async (status: "active" | "paused" | "archived") => {
    if (status === "archived" && !confirm(`Remove ${location.name} from SEO? Its checks stop and it leaves every page.`)) return;
    const r = await here.status.post({ status });
    if (r.error) return toast.error(messageOf(r.error), "Could not change");
    toast.success(status === "active" ? "Checks resumed" : status === "paused" ? "Checks paused" : `${location.name} removed`);
    await reload();
    if (status === "archived") navigate("/seo");
  };
  const change = (section: typeof open) => manage && <Button onClick={() => setOpen(section)}>Change</Button>;

  return (
    <>
      <SeoHeader
        tab="settings"
        switcher={false}
        sub={`Your locations, and how ${location.name} is checked.`}
        actions={manage && <NewButton onClick={() => navigate("/seo/setup")}>Add location</NewButton>}
      />
      {!manage && (
        <p className="mb-4 text-[13.5px] text-muted">Only people who manage SEO can change these. Ask an admin of this organization.</p>
      )}
      {/* With several Locations the list sits beside what it chooses, so a click shows its effect at once. */}
      <div className={cn("grid items-start gap-6", locations.length > 1 ? "max-w-5xl lg:grid-cols-[17rem_minmax(0,1fr)]" : "max-w-3xl")}>
        {locations.length > 1 && <LocationsList />}
        <div className="grid gap-4">
          {locations.length > 1 && (
            <h2 className="flex items-center gap-2 text-[15px] font-semibold">
              <span className="truncate">{location.name}</span>
              <Badge tone={location.status === "active" ? "good" : "neutral"}>{location.status === "active" ? "Checking" : "Paused"}</Badge>
            </h2>
          )}
          <Card>
            <CardHeader title="Business" right={change("business")} />
            <Row label="Name">{location.name}</Row>
            <Row label="Address">{location.address ?? "—"}</Row>
            <Row label="Website">{location.website ?? "None"}</Row>
            <Row label="Services">{location.services.length ? location.services.join(", ") : "None yet"}</Row>
          </Card>
          <Card>
            <CardHeader title="Checks" sub={everyLabel[location.checkEvery as Every]} right={change("checks")} />
            <Row label="Map grid">
              {location.gridSize} × {location.gridSize} spots. {gridCoverage(location.gridRadiusM)}
            </Row>
            <Row label="AI assistants">{location.engines.map((e) => engineNames[e] ?? e).join(", ")}</Row>
            <Row label="Status">
              <Badge tone={location.status === "active" ? "good" : "neutral"}>{location.status === "active" ? "Checking" : "Paused"}</Badge>
            </Row>
            {manage && (
              <div className="mt-4 flex flex-wrap gap-2 border-t border-line pt-4">
                {location.status === "active" ? (
                  <Button onClick={() => void setStatus("paused")}>Pause checks</Button>
                ) : (
                  <Button onClick={() => void setStatus("active")}>Resume checks</Button>
                )}
                <Button variant="danger" onClick={() => void setStatus("archived")}>
                  Remove location
                </Button>
              </div>
            )}
          </Card>
          <Card>
            <CardHeader
              title="Google profile"
              sub="Linking it lets suggestions be applied with one click, and shows calls and clicks from Google."
              right={change("profile")}
            />
            <Row label="Status">
              {location.profileLinked ? <Badge tone="good">Linked</Badge> : <span className="text-muted">Not linked</span>}
            </Row>
          </Card>
        </div>
      </div>

      {/* Mounted only while open, so each opening starts from what's saved. */}
      {open === "business" && <BusinessDrawer open onClose={() => setOpen(null)} />}
      {open === "checks" && <ChecksDrawer open onClose={() => setOpen(null)} limits={limits.data} />}
      {open === "profile" && <ProfileDrawer open onClose={() => setOpen(null)} />}
    </>
  );
}

/**
 * The Locations, beside the settings of the one being viewed. Click a row to view it. "Select" turns the rows into
 * checkboxes to pause, resume or remove several at once, so choosing one and acting on many never share a gesture.
 */
function LocationsList() {
  const { orgId, location, locations, can, reload } = useSeo();
  const manage = can("manage");
  const [, setParams] = useSearchParams();
  const toast = useToast();
  const [selecting, setSelecting] = useState(false);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const chosen = locations.filter((l) => picked.has(l.id));
  const all = chosen.length === locations.length;
  const stop = () => {
    setSelecting(false);
    setPicked(new Set());
  };
  const toggle = (id: string, on: boolean) =>
    setPicked((p) => {
      const next = new Set(p);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });
  const view = (id: string) =>
    setParams(
      (p) => {
        p.set("location", id);
        return p;
      },
      { replace: true },
    );

  const apply = async (status: "active" | "paused" | "archived") => {
    const names = chosen.map((l) => l.name);
    if (status === "archived") {
      const what = names.length === 1 ? names[0] : `these ${names.length} locations`;
      if (!confirm(`Remove ${what} from SEO? Checks stop and they leave every page.\n\n${names.join("\n")}`)) return;
    }
    setBusy(true);
    const results = await Promise.all(chosen.map((l) => locationApi(orgId, l.id).status.post({ status })));
    setBusy(false);
    const failed = results.map((r, i) => (r.error ? chosen[i]! : null)).filter((l) => l !== null);
    const done = chosen.length - failed.length;
    const verb = status === "active" ? "resumed" : status === "paused" ? "paused" : "removed";
    if (done) toast.success(`${done} ${done === 1 ? "location" : "locations"} ${verb}`);
    if (failed.length) {
      const first = results.find((r) => r.error)!.error;
      toast.error(`${failed.map((l) => l.name).join(", ")}: ${messageOf(first)}`, "Could not change");
    }
    setPicked(new Set(failed.map((l) => l.id)));
    await reload();
  };

  return (
    <nav aria-label="Locations" className="lg:sticky lg:top-4">
      <Card pad={false}>
        <div className="flex min-h-12 items-center gap-2 border-b border-line px-4 py-2">
          {selecting ? (
            <label className="flex cursor-pointer items-center gap-2 text-[13px]">
              <Checkbox
                checked={all}
                label="Select all locations"
                onChange={(on) => setPicked(on ? new Set(locations.map((l) => l.id)) : new Set())}
              />
              {chosen.length ? `${chosen.length} selected` : "Select all"}
            </label>
          ) : (
            <span className="text-[13.5px] font-semibold">Locations</span>
          )}
          {manage && (
            <Button size="sm" variant="ghost" className="ml-auto" onClick={selecting ? stop : () => setSelecting(true)}>
              {selecting ? "Done" : "Select"}
            </Button>
          )}
        </div>
        <ul className="divide-y divide-line">
          {locations.map((l) => {
            const viewing = !selecting && l.id === location.id;
            const body = (
              <>
                <span className="block truncate text-[13.5px] font-medium">{l.name}</span>
                <span className="block truncate text-[12.5px] text-muted">{l.address ?? l.city ?? "No address"}</span>
              </>
            );
            return (
              <li key={l.id} className={cn("flex items-center gap-3 px-4 py-2.5", viewing && "bg-hover")}>
                {selecting ? (
                  <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-3">
                    <Checkbox checked={picked.has(l.id)} label={`Select ${l.name}`} onChange={(on) => toggle(l.id, on)} />
                    <span className="min-w-0 flex-1">{body}</span>
                  </label>
                ) : (
                  <button
                    type="button"
                    aria-current={viewing ? "true" : undefined}
                    onClick={() => view(l.id)}
                    className="min-w-0 flex-1 cursor-pointer text-left"
                  >
                    {body}
                  </button>
                )}
                {l.status !== "active" && <Badge tone="neutral">Paused</Badge>}
              </li>
            );
          })}
        </ul>
        {selecting && (
          <div className="flex flex-wrap gap-2 border-t border-line px-4 py-3">
            <Button size="sm" disabled={busy || !chosen.length} onClick={() => void apply("paused")}>
              Pause
            </Button>
            <Button size="sm" disabled={busy || !chosen.length} onClick={() => void apply("active")}>
              Resume
            </Button>
            <Button size="sm" variant="danger" disabled={busy || !chosen.length} onClick={() => void apply("archived")}>
              Remove
            </Button>
          </div>
        )}
      </Card>
    </nav>
  );
}

function SaveFooter({ busy, onClose }: { busy: boolean; onClose: () => void }) {
  return (
    <>
      <Button type="button" onClick={onClose}>
        Cancel
      </Button>
      <Button type="submit" variant="primary" disabled={busy}>
        {busy ? "Saving…" : "Save"}
      </Button>
    </>
  );
}

function BusinessDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { orgId, location, reload } = useSeo();
  const [form, setForm] = useState({
    name: location.name,
    website: location.website ?? "",
    services: location.services,
  });
  const [busy, setBusy] = useState(false);
  const fb = useFeedback(open);
  const save = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const r = await locationApi(orgId, location.id).patch({
      name: form.name,
      website: form.website.trim() || null,
      services: form.services,
    });
    setBusy(false);
    if (r.error) return fb.fail(messageOf(r.error));
    await reload();
    onClose();
  };
  return (
    <Drawer
      open={open}
      onClose={onClose}
      title="Business"
      onSubmit={save}
      feedback={<Feedback {...fb.props} />}
      footer={<SaveFooter busy={busy} onClose={onClose} />}
    >
      <div className="space-y-4">
        <Field label="Name">
          <Input required maxLength={200} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </Field>
        <Field label="Website" hint="Google search positions are read for this site.">
          <Input value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} placeholder="example.com" />
        </Field>
        <Field label="Services" hint="Keyword and question ideas, and suggestions, come from these.">
          <ServicesField value={form.services} onChange={(services) => setForm({ ...form, services })} />
        </Field>
      </div>
    </Drawer>
  );
}

function ChecksDrawer({ open, onClose, limits }: { open: boolean; onClose: () => void; limits: Limits | null }) {
  const { orgId, location, reload } = useSeo();
  const [value, setValue] = useState<Checks>({
    gridSize: GRID_SIZE,
    gridRadiusM: location.gridRadiusM,
    checkEvery: location.checkEvery as Every,
    engines: location.engines as Engine[],
  });
  const [busy, setBusy] = useState(false);
  const fb = useFeedback(open);
  const save = async (e: FormEvent) => {
    e.preventDefault();
    if (!value.engines.length) return fb.fail("Pick at least one assistant.");
    setBusy(true);
    // Only what changed: after a Plan downgrade, changing the assistants alone must not be refused for the grid.
    const r = await locationApi(orgId, location.id).patch({
      ...(value.gridSize !== location.gridSize ? { gridSize: value.gridSize } : {}),
      ...(value.gridRadiusM !== location.gridRadiusM ? { gridRadiusM: value.gridRadiusM } : {}),
      ...(value.checkEvery !== location.checkEvery ? { checkEvery: value.checkEvery } : {}),
      ...(value.engines.join() !== location.engines.join() ? { engines: value.engines } : {}),
    });
    setBusy(false);
    if (r.error) return fb.fail(messageOf(r.error));
    await reload();
    onClose();
  };
  return (
    <Drawer
      open={open}
      onClose={onClose}
      title="Checks"
      onSubmit={save}
      feedback={<Feedback {...fb.props} />}
      footer={<SaveFooter busy={busy} onClose={onClose} />}
    >
      <ChecksFields value={value} onChange={setValue} limits={limits} />
    </Drawer>
  );
}

function ProfileDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { orgId, location, reload } = useSeo();
  const profiles = useLoad(() => seoApi(orgId).profile.locations.get(), [orgId]);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const fb = useFeedback(open);
  const link = async (to: string | null) => {
    setBusy(true);
    const r = await locationApi(orgId, location.id).profile.put({ name: to });
    setBusy(false);
    if (r.error) return fb.fail(messageOf(r.error), to ? "Could not link" : "Could not unlink");
    await reload();
    onClose();
  };
  const connect = async () => {
    setBusy(true);
    const error = await connectGoogle(orgId, `/seo/settings?location=${location.id}`);
    setBusy(false);
    if (error) fb.fail(error, "Could not connect");
  };
  const list = profiles.data?.locations ?? [];
  const submit = (e: FormEvent) => {
    e.preventDefault();
    void link(name || list[0]?.name || "");
  };
  return (
    <Drawer open={open} onClose={onClose} title="Google profile" onSubmit={submit} feedback={<Feedback {...fb.props} />}>
      {profiles.error ? (
        <LoadError what="your Google profiles">{profiles.error}</LoadError>
      ) : !profiles.data ? null : !profiles.data.connected ? (
        <div className="space-y-4">
          <p className="text-[13.5px] text-muted">
            Every check works without it. Connect your Google Business Profile to apply suggestions to it and see calls and clicks.
          </p>
          <Button type="button" variant="primary" disabled={busy} onClick={() => void connect()}>
            Connect Google
          </Button>
        </div>
      ) : location.profileLinked ? (
        <div className="space-y-4">
          <p className="text-[13.5px]">{location.name} is linked to its Google profile.</p>
          <Button type="button" variant="danger" disabled={busy} onClick={() => void link(null)}>
            Unlink
          </Button>
        </div>
      ) : list.length === 0 ? (
        <p className="text-[13.5px] text-muted">The connected Google account manages no business profiles.</p>
      ) : (
        <div className="space-y-4">
          <Field label="Which profile is this location?">
            <Select value={name || list[0]!.name} onChange={(e) => setName(e.target.value)}>
              {list.map((p) => (
                <option key={p.name} value={p.name}>
                  {p.title}
                  {p.address ? ` · ${p.address}` : ""}
                </option>
              ))}
            </Select>
          </Field>
          <Button type="submit" variant="primary" disabled={busy}>
            {busy ? "Linking…" : "Link"}
          </Button>
        </div>
      )}
      <p className={cn("mt-6 text-[12.5px] text-muted", !profiles.data && "hidden")}>
        Changes and posts only go out when someone applies a suggestion.
      </p>
    </Drawer>
  );
}
