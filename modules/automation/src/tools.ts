// The tools automation offers the assistant (ADR 0036): the boilerplate's examples of each effect. `recent_activity`
// reads; `rename_organization` proposes the example Task kind, so Autopilot decides whether it applies. A feature
// offers its own the same way, from its module's setup().
import { z } from "zod";
import { defineTool, invalid } from "@app/kernel";
import { listActivity, proposeTask } from "./service";

export const recentActivity = defineTool({
  name: "automation.recent_activity",
  description:
    "What changed in this organization recently, newest first: who did it (a member, the assistant or the system) and a one-line summary. Use it for questions like 'what happened this week?' or 'who changed X?'.",
  input: z.object({
    limit: z.number().int().min(1).max(50).default(20).describe("How many entries, newest first (1–50)."),
    since: z.iso.datetime().optional().describe("Only entries after this moment (ISO 8601)."),
  }),
  requires: { resource: "activity", action: "view" },
  effect: "read",
  run: async (ctx, caller, input) => {
    const since = input.since ? new Date(input.since) : null;
    const rows = await listActivity(ctx, caller.orgId, input.limit);
    return rows
      .filter((r) => !since || r.createdAt > since)
      .map((r) => ({
        at: r.createdAt.toISOString(),
        by: r.actorType === "member" ? (r.actorName ?? "a member") : r.actorType,
        summary: r.summary,
      }));
  },
});

export const renameOrganization = defineTool({
  name: "automation.rename_organization",
  description:
    "Proposes renaming this organization. It doesn't rename it directly: the change waits for a member to Apply it, unless Autopilot applies it at once. Say which happened.",
  input: z.object({
    name: z.string().trim().min(1).max(100).describe("The new name."),
  }),
  requires: { resource: "organization", action: "update" },
  effect: "propose",
  run: async (ctx, caller, input) => {
    if (!input.name) throw invalid("The new name is empty.");
    const title = `Rename the organization to "${input.name}"`;
    const r = await proposeTask(ctx, {
      organizationId: caller.orgId,
      kind: "organization.rename",
      featureId: "organization",
      action: "organization.update",
      title,
      why: "Asked for in chat.",
      impact: "low",
      sourceType: "conversation",
      preview: { label: "Name", after: input.name },
      payload: { name: input.name },
      createdByType: "assistant",
      createdBy: caller.userId,
    });
    return { taskId: r.id, applied: r.applied, title };
  },
});
