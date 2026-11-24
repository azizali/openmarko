// How each kind of suggestion is applied and undone, as automation Task executors (ADR 0005). `apply` makes the
// change and returns what `revert` needs; the Task keeps it. Task payloads carry the suggestion's payload plus its
// Location and suggestion ids; a keyword or question the assistant proposes tracking (ADR 0036) has no suggestion.
// Whichever way a suggestion's Task is applied or undone (the Action plan, the Automation page, the chat), the
// suggestion follows: applied, or back in the list.

import { and, eq, inArray } from "drizzle-orm";
import { invalid } from "@app/kernel";
import { registerExecutor as register, type Executor } from "@app/automation";
import { getLocation } from "../locations/service";
import { changeProfile, deletePost, publishPost, readProfile } from "../profile/service";
import { keywords, questions, suggestions } from "../schema";
import { addKeywords, addQuestions } from "../tracking/service";
import { queueScopedCheck } from "../checks/jobs";
import { payloadSchemas } from "./kinds";

const common = (p: Record<string, unknown>): { locationId: string } => {
  if (typeof p.locationId !== "string") throw invalid("The task names no location.");
  return { locationId: p.locationId };
};

/** Registers a Task kind whose Task keeps its suggestion, when it has one, in step with it. */
function registerExecutor(kind: string, ex: Executor): void {
  const follow = (task: Parameters<Executor["apply"]>[1]) => {
    const id = task.payload.suggestionId;
    return typeof id === "string" ? and(eq(suggestions.id, id), eq(suggestions.organizationId, task.organizationId)) : null;
  };
  register(kind, {
    apply: async (ctx, task) => {
      const revert = await ex.apply(ctx, task);
      const where = follow(task);
      if (where) await ctx.db.update(suggestions).set({ status: "applied", taskId: task.id, decidedAt: new Date() }).where(where);
      return revert;
    },
    revert: async (ctx, task) => {
      await ex.revert(ctx, task);
      const where = follow(task);
      if (where) await ctx.db.update(suggestions).set({ status: "open", taskId: null, decidedBy: null, decidedAt: null }).where(where);
    },
  });
}

export function registerExecutors(): void {
  registerExecutor("seo.track_keyword", {
    apply: async (ctx, task) => {
      const { locationId } = common(task.payload);
      const { term } = payloadSchemas.track_keyword.parse(task.payload);
      const ids = await addKeywords(ctx, task.organizationId, task.createdBy, locationId, [term], "suggestion");
      await queueScopedCheck(ctx, task.organizationId, locationId, { keywordIds: ids });
      return { keywordIds: ids };
    },
    revert: async (ctx, task) => {
      const ids = (task.revert?.keywordIds as string[] | undefined) ?? [];
      if (ids.length) await ctx.db.update(keywords).set({ active: false }).where(inArray(keywords.id, ids));
    },
  });

  registerExecutor("seo.track_question", {
    apply: async (ctx, task) => {
      const { locationId } = common(task.payload);
      const { text } = payloadSchemas.track_question.parse(task.payload);
      const ids = await addQuestions(ctx, task.organizationId, task.createdBy, locationId, [text], "suggestion");
      await queueScopedCheck(ctx, task.organizationId, locationId, { questionIds: ids });
      return { questionIds: ids };
    },
    revert: async (ctx, task) => {
      const ids = (task.revert?.questionIds as string[] | undefined) ?? [];
      if (ids.length) await ctx.db.update(questions).set({ active: false }).where(inArray(questions.id, ids));
    },
  });

  registerExecutor("seo.profile_change", {
    apply: async (ctx, task) => {
      const { locationId } = common(task.payload);
      const change = payloadSchemas.profile_change.parse(task.payload);
      const l = await getLocation(ctx, task.organizationId, locationId);
      // What Google has now, not what the suggestion saw: Undo puts back exactly that.
      const now = await readProfile(ctx, l);
      if (!now) throw invalid("Link this location's Google profile first.");
      if (change.field === "categories") {
        const additional = change.after.filter((c) => c.toLowerCase() !== (now.primaryCategory ?? "").toLowerCase());
        await changeProfile(ctx, l, { additionalCategories: additional });
        return { additionalCategories: now.additionalCategories };
      }
      await changeProfile(ctx, l, { description: change.after });
      return { description: now.description ?? "" };
    },
    revert: async (ctx, task) => {
      const { locationId } = common(task.payload);
      const l = await getLocation(ctx, task.organizationId, locationId);
      const before = task.revert ?? {};
      if (Array.isArray(before.additionalCategories))
        await changeProfile(ctx, l, { additionalCategories: before.additionalCategories as string[] });
      else if (typeof before.description === "string") await changeProfile(ctx, l, { description: before.description });
    },
  });

  registerExecutor("seo.post", {
    apply: async (ctx, task) => {
      const { locationId } = common(task.payload);
      const { text } = payloadSchemas.post.parse(task.payload);
      const l = await getLocation(ctx, task.organizationId, locationId);
      return { post: await publishPost(ctx, l, text) };
    },
    revert: async (ctx, task) => {
      const { locationId } = common(task.payload);
      const post = task.revert?.post;
      if (typeof post !== "string") return;
      await deletePost(ctx, await getLocation(ctx, task.organizationId, locationId), post);
    },
  });

  // Getting listed on a directory, and fixing the website, are done by hand: applying marks it done, Undo marks it
  // not done. The next audit says whether a site fix took.
  for (const kind of ["seo.listing", "seo.site_fix"])
    registerExecutor(kind, {
      apply: async () => ({}),
      revert: async () => undefined,
    });
}
