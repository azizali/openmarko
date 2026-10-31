import { useState } from "react";
import { useSearchParams } from "react-router";
import { Crosshair, Settings2, X } from "lucide-react";
import { Card, PageHeader, Select, Tabs, Toggle, useToast } from "../components/ui";
import { TaskDrawer, TodoList, type TodoStatus } from "../components/Todo";
import { keywords } from "../data/mock";
import { openTasksFor, tasks, useRunState } from "../lib/tasks";

// The single list of everything that improves rankings. The old Action plan
// lives here now: /actions and /actions/:id redirect to /todo?task=:id.
export default function Todo() {
  const [params, setParams] = useSearchParams();
  const state = useRunState();
  const [status, setStatus] = useState<TodoStatus>("open");
  const [autopilot, setAutopilot] = useState(false);
  const { toast, node } = useToast();
  const focus = keywords.find((k) => k.id === params.get("kw")) ?? null;
  const open = tasks.find((t) => t.id === params.get("task")) ?? null;
  const done = tasks.filter((t) => state[t.id] === "done").length;
  const dismissed = tasks.filter((t) => state[t.id] === "dismissed").length;
  const update = (key: string, val: string | null) => {
    const p = new URLSearchParams(params);
    val ? p.set(key, val) : p.delete(key);
    setParams(p, { replace: true });
  };

  return (
    <>
      <PageHeader
        title="To-do"
        sub={<>{openTasksFor(state).length} things can improve your rankings, ranked by impact. Most take one click; the rest come with step-by-step instructions.</>}
      />

      <Card className="mb-6 flex flex-wrap items-center gap-4 !py-4">
        <span className="grid size-9 place-items-center rounded-lg bg-accent-soft text-accent"><Settings2 size={17} /></span>
        <div className="min-w-0 flex-1">
          <div className="text-[14px] font-medium">Autopilot</div>
          <div className="text-[13px] text-muted">Apply low-risk fixes automatically every night (posts, alt text, schema). Categories, descriptions and review replies always wait for you.</div>
        </div>
        <Toggle label="Autopilot" checked={autopilot} onChange={(v) => { setAutopilot(v); toast(v ? "Autopilot on · low-risk fixes will run nightly" : "Autopilot off"); }} />
      </Card>

      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <Tabs value={status} onChange={setStatus} tabs={[
          { id: "open", label: "To do", count: openTasksFor(state, focus?.id).length },
          { id: "done", label: "Done", count: done },
          { id: "dismissed", label: "Dismissed", count: dismissed },
        ]} />
        <div className="flex flex-wrap items-center gap-2">
          <Crosshair size={14} className="text-subtle" />
          <label htmlFor="todo-kw" className="text-[13px] text-muted">For keyword</label>
          <Select size="sm" id="todo-kw" value={focus?.id ?? ""} onChange={(e) => update("kw", e.target.value || null)} className="w-auto">
            <option value="">All keywords</option>
            {keywords.map((k) => <option key={k.id} value={k.id}>{k.term} ({openTasksFor(state, k.id).length})</option>)}
          </Select>
          {focus && <button onClick={() => update("kw", null)} className="inline-flex items-center gap-1 rounded px-2 py-1 text-[12.5px] text-muted hover:bg-hover"><X size={12} /> Clear</button>}
        </div>
      </div>
      <TodoList focus={focus} status={status} onOpen={(t) => update("task", t.id)} />
      <TaskDrawer task={open} onClose={() => update("task", null)} />
      {node}
    </>
  );
}
