// A Task was proposed or applied somewhere other than the page on screen: the chat's tools propose them, and Apply on
// a chat's Task card applies one (ADR 0036). Pages that show Tasks, or what a Task changes, listen and reload.
import { useEffect, useRef } from "react";

const TASKS_CHANGED = "app:tasks-changed";

export const announceTasksChanged = (applied: boolean) =>
  window.dispatchEvent(new CustomEvent<{ applied: boolean }>(TASKS_CHANGED, { detail: { applied } }));

/** Calls `fn` when a Task is proposed or applied elsewhere; `applied` says whether something already changed. */
export function useTasksChanged(fn: (applied: boolean) => void) {
  const latest = useRef(fn);
  useEffect(() => {
    latest.current = fn;
  });
  useEffect(() => {
    const on = (e: Event) => latest.current((e as CustomEvent<{ applied: boolean }>).detail.applied);
    window.addEventListener(TASKS_CHANGED, on);
    return () => window.removeEventListener(TASKS_CHANGED, on);
  }, []);
}
