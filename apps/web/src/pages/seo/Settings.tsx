// SEO settings (/seo/settings): how the Location is checked and its Google profile. Each card shows what's set, and
// Change opens the side panel. Only people who manage SEO change anything; checks stay within the Plan's limits.
// The fields for services and for checks are shared with setup (fields.tsx).
import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router";
import { Badge, Button, Card, CardHeader, Drawer, Field, Input, NewButton, Select, cn } from "../../components/ui";
import { Feedback, LoadError, useFeedback, useToast } from "../../components/Feedback";
import { Row } from "../../components/Table";
import { messageOf } from "../../lib/api";
import { useLoad } from "../../lib/useLoad";
import { engineNames, locationApi, seoApi, type Engine, type Limits } from "./api";
import { SeoHeader, useSeo } from "./Seo";
import { ChecksFields, ServicesField, connectGoogle, everyLabel, useOAuthError, type Checks, type Every } from "./fields";

// ---------- The page ----------

export default function Settings() {
  const { orgId, location, can, reload } = useSeo();
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
        sub="How this location is checked, and its Google profile."
        actions={manage && <NewButton onClick={() => navigate("/seo/setup")}>Add location</NewButton>}
      />
      {!manage && (
        <p className="mb-4 text-[13.5px] text-muted">Only people who manage SEO can change these. Ask an admin of this organization.</p>
      )}
      <div className="grid max-w-3xl gap-4">
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
            {location.gridSize} × {location.gridSize} spots
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

      {/* Mounted only while open, so each opening starts from what's saved. */}
      {open === "business" && <BusinessDrawer open onClose={() => setOpen(null)} />}
      {open === "checks" && <ChecksDrawer open onClose={() => setOpen(null)} limits={limits.data} />}
      {open === "profile" && <ProfileDrawer open onClose={() => setOpen(null)} />}
    </>
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
  const [form, setForm] = useState({ name: location.name, website: location.website ?? "", services: location.services });
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
    gridSize: location.gridSize,
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
