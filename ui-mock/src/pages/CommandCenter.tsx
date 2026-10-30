import { useState } from "react";
import { CommandTop } from "../components/CommandTop";
import { TaskDrawer, ThisWeek } from "../components/Todo";
import { business } from "../data/mock";
import { useRunState, type Task } from "../lib/tasks";

// Home answers one question: is Google bringing me customers, and what should I do
// this week? Rankings, site health and content live on their own pages; each
// scorecard row links there.
export default function CommandCenter() {
  const state = useRunState();
  const [open, setOpen] = useState<Task | null>(null);

  return (
    <>
      <div className="mb-6">
        <h1 className="font-serif text-[40px] leading-[1.1] tracking-[-0.02em]">{business.name}</h1>
        <p className="mt-1.5 max-w-2xl text-[14px] text-muted">How you show up on Google, and what to do this week.</p>
      </div>

      <CommandTop state={state} />

      <ThisWeek onOpen={setOpen} />

      <TaskDrawer task={open} onClose={() => setOpen(null)} />
    </>
  );
}
