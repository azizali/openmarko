// The tools a member's chat may call: what the enabled modules offer (`toolsOf`), less what the member's Role doesn't
// allow, as the AI SDK's tools (ADR 0036). A tool the member may not use is never offered, so the model can't call it.
// Visitors on a website's widget get none: they aren't members.
import { dynamicTool, zodSchema, type ToolSet } from "ai";
import { AppError, toolsOf, type AppContext, type AssistantTool, type Caller, type ToolCall } from "@app/kernel";
import { allows } from "@app/shared";

/** Model providers allow letters, digits, `_` and `-` in a tool's name: `seo.keyword_detail` is `seo__keyword_detail`. */
export const modelToolName = (name: string) => name.replace(".", "__");

/** The tools this member may use, keyed by the names the model sees. */
export function toolsFor(ctx: AppContext, caller: Caller, call: ToolCall): ToolSet {
  const set: ToolSet = {};
  for (const t of toolsOf(ctx)) {
    if (!allows(caller.permission, t.requires.resource, t.requires.action)) continue;
    set[modelToolName(t.name)] = asModelTool(ctx, caller, call, t);
  }
  return set;
}

/**
 * One tool for the model: a dynamic tool, its input typed by the module's schema, which still checks what the model
 * sends. A refusal the app explains (an AppError: not found, a Plan limit, nothing connected) goes back to the model as
 * the tool's result, so it can tell the member; anything else fails the turn.
 */
function asModelTool(ctx: AppContext, caller: Caller, call: ToolCall, t: AssistantTool) {
  return dynamicTool({
    description: t.description,
    inputSchema: zodSchema(t.input),
    execute: async (input) => {
      try {
        return await t.run(ctx, caller, input, call);
      } catch (err) {
        if (err instanceof AppError) return { error: { code: err.code, message: err.message } };
        throw err;
      }
    },
  });
}
