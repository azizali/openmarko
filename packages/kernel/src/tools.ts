// What a module offers the assistant: tools a member's chat can call to read the Organization's data or propose a
// change. Modules return them from setup(); the composition root checks and gathers them; the ai module turns them into
// the model's tools. No module imports ai, and with ai off nothing calls them (ADR 0036).
import type { ZodType } from "zod";
import type { Caller } from "./guard";
import type { AppContext } from "./module";

/** `<module id>.<verb_noun>`, e.g. `seo.keyword_detail`. The part before the dot is the module that offers it. */
export const TOOL_PATTERN = /^[a-z][a-z0-9_]*\.[a-z][a-z0-9_]*$/;

/**
 * Where the member was when they asked: the web app's path and its params (`{ location: "…" }`), so "this keyword"
 * can be resolved. Sent by the client and not trusted: a tool reads only what the caller may see, whatever it says.
 */
export type ToolPage = { path: string; params: Record<string, string> };

/** The turn a tool runs in. */
export type ToolCall = { conversationId: string; page: ToolPage | null; signal?: AbortSignal };

/** What a `propose` tool returns: the Task it proposed, and whether Autopilot applied it at once. */
export type ProposedTask = { taskId: string; applied: boolean; title: string };

type Run<I, O> = (ctx: AppContext, caller: Caller, input: I, call: ToolCall) => Promise<O>;

type BaseTool<I> = {
  /** `<module id>.<verb_noun>`; the module's id must come first. Checked at boot. */
  name: string;
  /** What the model reads to decide when to call it: what it answers, and when not to use it. */
  description: string;
  /** The input the model must send, with `.describe()` on each field. Checked before `run`. */
  input: ZodType<I>;
  /** The permission it needs. A member without it is never offered the tool. Must be declared by a module. */
  requires: { resource: string; action: string };
};

/**
 * - `read` answers from data the caller may see. It changes nothing and returns small, JSON-safe values: a summary
 *   the model can reason over, not a page's whole payload.
 * - `propose` never changes anything itself: it proposes an automation Task, so the Organization's Autopilot decides
 *   whether it applies at once or waits for Apply, and Activity and Undo work as for any other Task.
 */
export type AssistantTool<I = any> = BaseTool<I> &
  ({ effect: "read"; run: Run<I, unknown> } | { effect: "propose"; run: Run<I, ProposedTask> });

/** Types a tool's `run` input from its schema. */
export const defineTool = <I>(t: AssistantTool<I>): AssistantTool<I> => t;

/** The tools the enabled modules offer. Set by the composition root; empty before it runs. */
export const toolsOf = (ctx: AppContext): AssistantTool[] => ctx.tools ?? [];
