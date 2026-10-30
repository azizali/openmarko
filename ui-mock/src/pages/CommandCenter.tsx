import { useEffect, useState } from "react";
import { Link, useOutletContext } from "react-router";
import { CommandTop } from "../components/CommandTop";
import { Composer, MarkoAvatar } from "../components/Assistant";
import { TaskDrawer, ThisWeek } from "../components/Todo";
import { actions, business } from "../data/mock";
import { openTasksFor, useRunState, type Task } from "../lib/tasks";
import { primeTasks, type PageContext } from "../lib/assistant";

// Home is Marko's weekly brief: how Google did for you, what Marko already did,
// the three things that need you, and a box to reply. Replies continue in the ⌘J panel.
export default function CommandCenter() {
  const ctx = useOutletContext<PageContext>();
  const state = useRunState();
  const [open, setOpen] = useState<Task | null>(null);
  const top3 = openTasksFor(state).slice(0, 3).map((t) => t.id);
  useEffect(() => { primeTasks(top3); }, [top3.join()]);
  const didAlready = actions.filter((a) => a.status === "done" || a.status === "running").map((a) => a.title.charAt(0).toLowerCase() + a.title.slice(1));

  return (
    <>
      <div className="mb-6">
        <div className="text-[12.5px] text-muted">Monday, Oct 30 · Weekly brief</div>
        <h1 className="mt-1 font-serif text-[40px] leading-[1.1] tracking-[-0.02em]">Good morning, Dr. Patel.</h1>
        <p className="mt-1.5 max-w-2xl text-[14px] text-muted">How {business.name} did on Google, and what needs you this week.</p>
      </div>

      <CommandTop state={state} />

      <div className="flex gap-3">
        <MarkoAvatar />
        <div className="min-w-0 flex-1">
          {didAlready.length > 0 && (
            <p className="mt-0.5 mb-4 text-[14px] leading-[1.55]">
              <b className="font-medium">While you were away</b> I {didAlready.join(" and ")}. <Link to="/runs" className="text-accent hover:underline">See activity</Link>
            </p>
          )}
          <ThisWeek onOpen={setOpen} heading={<p className="m-0 text-[14px] leading-[1.55]">Three things need you this week:</p>} />
          <div className="mt-5">
            <Composer big ctx={ctx} placeholder="Reply, ask a question or tell Marko what to do…" chips={["Do all three", "Which keywords dropped?", "Reply to my 5-star reviews"]} />
          </div>
        </div>
      </div>

      <TaskDrawer task={open} onClose={() => setOpen(null)} />
    </>
  );
}
