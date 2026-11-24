// Automation: Tasks waiting for a decision (Apply, Undo, Dismiss), schedules for jobs that run on their own,
// Runs with their cost, and the Activity log.
import { useState, type FormEvent } from "react";
import { Badge, Button, Card, CardHeader, Drawer, Field, Input, PageHeader, Select, Tabs } from "../components/ui";
import { Table } from "../components/Table";
import { Feedback, useFeedback, useToast } from "../components/Feedback";
import { api, fmtTime, messageOf, money } from "../lib/api";
import { useLoad } from "../lib/useLoad";
import { useOrg, useSession } from "../lib/session";
import { useTasksChanged } from "../lib/tasksChanged";

type Tab = "tasks" | "schedules" | "runs" | "activity";

export default function Automation() {
  const org = useOrg();
  const { can } = useSession();
  const [tab, setTab] = useState<Tab>("tasks");
  const tasks = useLoad(() => api.api.v1.organizations({ orgId: org.id }).tasks.get({ query: {} }), [org.id]);
  // The chat proposes and applies Tasks too.
  useTasksChanged(() => void tasks.reload());
  const open = (tasks.data ?? []).filter((t) => t.status === "open").length;
  return (
    <>
      <PageHeader title="Automation" sub="What the app proposes, what runs on its own, and what happened." />
      <div className="mb-5">
        <Tabs
          tabs={[
            { id: "tasks", label: "Tasks", count: open || undefined },
            ...(can("autopilot", "view") ? [{ id: "schedules" as Tab, label: "Schedules" }] : []),
            { id: "runs", label: "Runs" },
            { id: "activity", label: "Activity" },
          ]}
          value={tab}
          onChange={setTab}
        />
      </div>
      {tab === "tasks" && <TasksView tasks={tasks.data ?? []} reload={() => void tasks.reload()} />}
      {tab === "schedules" && <Schedules />}
      {tab === "runs" && <Runs />}
      {tab === "activity" && <Activity />}
    </>
  );
}

type Task = {
  id: string;
  title: string;
  why: string | null;
  status: string;
  action: string;
  kind: string;
  impact: string | null;
  preview: { label: string; before?: string; after: string } | null;
  createdAt: string | Date;
  createdByType: string;
  /** Applied by Autopilot, not by a person. */
  autopilot: boolean;
  /** Where it came from: `conversation` when the chat's tools proposed it (ADR 0036). */
  sourceType: string | null;
};

function TasksView({ tasks, reload }: { tasks: Task[]; reload: () => void }) {
  const org = useOrg();
  const { can } = useSession();
  const toast = useToast();
  const [proposing, setProposing] = useState(false);
  const fb = useFeedback(proposing);
  const [newName, setNewName] = useState("");
  const act = async (id: string, what: "apply" | "undo" | "dismiss") => {
    const r = await api.api.v1.organizations({ orgId: org.id }).tasks({ taskId: id })[what].post();
    if (r.error) return toast.error(messageOf(r.error), `Could not ${what}`);
    toast.success({ apply: "Applied", undo: "Undone", dismiss: "Dismissed" }[what]);
    reload();
  };
  // The example Task the boilerplate ships: renaming the Organization, with Undo. Replace with your own kinds.
  const propose = async (e: FormEvent) => {
    e.preventDefault();
    fb.clear();
    const r = await api.api.v1.organizations({ orgId: org.id }).tasks.post({
      kind: "organization.rename",
      featureId: "organization",
      action: "organization.update",
      title: `Rename the organization to "${newName}"`,
      why: "Proposed from the Automation page as an example.",
      impact: "low",
      preview: { label: "Name", before: org.name, after: newName },
      payload: { name: newName },
    });
    if (r.error) return fb.fail(messageOf(r.error), "Could not propose");
    setProposing(false);
    setNewName("");
    reload();
  };
  const tone = (s: string) => (s === "applied" ? "good" : s === "open" ? "warn" : s === "failed" ? "bad" : "neutral");
  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        {can("organization", "update") && <Button onClick={() => setProposing(true)}>Propose an example task</Button>}
      </div>
      {tasks.length === 0 && (
        <Card>
          <p className="text-[13.5px] text-muted">
            No tasks. A Task is a change the app (or a person) proposes, applied with one click and undone with another.
          </p>
        </Card>
      )}
      {tasks.map((t) => (
        <Card key={t.id}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-[14px] font-medium">{t.title}</span>
                <Badge tone={tone(t.status)}>{t.status}</Badge>
                {t.autopilot && <Badge tone="accent">autopilot</Badge>}
                {t.sourceType === "conversation" && <Badge tone="neutral">from chat</Badge>}
              </div>
              {t.why && <p className="mt-1 text-[13px] text-muted">{t.why}</p>}
              {t.preview && (
                <p className="mt-2 text-[13px]">
                  <span className="text-muted">{t.preview.label}:</span>{" "}
                  {t.preview.before && (
                    <>
                      <s className="text-subtle">{t.preview.before}</s> →{" "}
                    </>
                  )}
                  <b className="font-medium">{t.preview.after}</b>
                </p>
              )}
              <p className="mt-1 text-[12px] text-subtle">
                {t.kind} · needs {t.action} · {fmtTime(t.createdAt as unknown as string)}
              </p>
            </div>
            <div className="flex gap-2">
              {t.status === "open" && (
                <>
                  <Button size="sm" variant="ghost" onClick={() => void act(t.id, "dismiss")}>
                    Dismiss
                  </Button>
                  <Button size="sm" variant="primary" onClick={() => void act(t.id, "apply")}>
                    Apply
                  </Button>
                </>
              )}
              {t.status === "applied" && (
                <Button size="sm" onClick={() => void act(t.id, "undo")}>
                  Undo
                </Button>
              )}
            </div>
          </div>
        </Card>
      ))}
      <Drawer
        open={proposing}
        onClose={() => setProposing(false)}
        title="Propose a task"
        onSubmit={propose}
        feedback={<Feedback {...fb.props} />}
        footer={
          <>
            <Button type="button" onClick={() => setProposing(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary">
              Propose
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <p className="text-[13px] text-muted">
            The one example kind the boilerplate ships: renaming the organization. It waits for Apply (or runs at once when Autopilot is On
            for organization.update), and can be undone.
          </p>
          <Field label="New name">
            <Input required value={newName} onChange={(e) => setNewName(e.target.value)} />
          </Field>
        </div>
      </Drawer>
    </div>
  );
}

function Schedules() {
  const org = useOrg();
  const { can } = useSession();
  const schedules = useLoad(() => api.api.v1.organizations({ orgId: org.id }).schedules.get(), [org.id]);
  const [every, setEvery] = useState<"hourly" | "6h" | "daily" | "3d" | "weekly" | "monthly">("daily");
  const [at, setAt] = useState("09:00");
  const fb = useFeedback();
  const toast = useToast();
  const add = async (e: FormEvent) => {
    e.preventDefault();
    fb.clear();
    const r = await api.api.v1
      .organizations({ orgId: org.id })
      .schedules.put({ jobId: "example.heartbeat", every, at: ["hourly", "6h"].includes(every) ? null : at });
    if (r.error) return fb.fail(messageOf(r.error));
    fb.succeed("Schedule saved");
    void schedules.reload();
  };
  const remove = async (id: string) => {
    const r = await api.api.v1.organizations({ orgId: org.id }).schedules({ scheduleId: id }).delete();
    if (r.error) return toast.error(messageOf(r.error), "Could not remove");
    void schedules.reload();
  };
  return (
    <div className="space-y-4">
      <Table
        head={["Job", "Every", "At (UTC)", "Next run", "Last run", ""]}
        empty="Nothing scheduled."
        rows={(schedules.data ?? []).map((s) => [
          <code key="j" className="font-mono text-[12.5px]">
            {s.jobId}
          </code>,
          s.every,
          s.at ?? "–",
          fmtTime(s.nextRunAt as unknown as string),
          s.lastRunAt ? fmtTime(s.lastRunAt as unknown as string) : "never",
          can("autopilot", "edit") ? (
            <Button key="x" size="sm" variant="ghost" onClick={() => void remove(s.id)}>
              Remove
            </Button>
          ) : null,
        ])}
      />
      {can("autopilot", "edit") && (
        <Card>
          <CardHeader
            title="Schedule the example job"
            sub="example.heartbeat writes one Activity line each time it runs. Your own jobs schedule the same way."
          />
          <form onSubmit={add} className="flex flex-wrap items-end gap-2">
            <Field label="Every">
              <Select value={every} onChange={(e) => setEvery(e.target.value as typeof every)}>
                {["hourly", "6h", "daily", "3d", "weekly", "monthly"].map((v) => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="At (UTC)">
              <Input type="time" value={at} onChange={(e) => setAt(e.target.value)} disabled={["hourly", "6h"].includes(every)} />
            </Field>
            <Button type="submit" variant="primary">
              Save schedule
            </Button>
            <Feedback {...fb.props} className="basis-full" />
          </form>
        </Card>
      )}
    </div>
  );
}

function Runs() {
  const org = useOrg();
  const runs = useLoad(() => api.api.v1.organizations({ orgId: org.id }).runs.get(), [org.id]);
  const tone = (s: string) => (s === "done" ? "good" : s === "failed" ? "bad" : s === "running" ? "info" : "neutral");
  return (
    <Table
      head={["Run", "Trigger", "Status", "Cost", "Started", "Finished"]}
      empty="No runs yet."
      rows={(runs.data ?? []).map((r) => [
        <span key="l" className="font-medium">
          {r.label}
        </span>,
        r.trigger,
        <span key="s">
          <Badge tone={tone(r.status)}>{r.status}</Badge>
          {r.error && <span className="ml-2 text-[12px] text-bad">{r.error}</span>}
        </span>,
        money(r.costMicros),
        fmtTime(r.startedAt as unknown as string),
        r.finishedAt ? fmtTime(r.finishedAt as unknown as string) : "–",
      ])}
    />
  );
}

function Activity() {
  const org = useOrg();
  const activity = useLoad(() => api.api.v1.organizations({ orgId: org.id }).activity.get(), [org.id]);
  return (
    <Table
      head={["What", "Who", "Action", "When"]}
      empty="Nothing yet."
      rows={(activity.data ?? []).map((a) => [
        a.summary,
        <span key="w" className="text-muted">
          {a.actorName ?? a.actorType}
        </span>,
        <code key="a" className="font-mono text-[12px] text-muted">
          {a.action}
        </code>,
        <span key="t" className="text-muted">
          {fmtTime(a.createdAt as unknown as string)}
        </span>,
      ])}
    />
  );
}
