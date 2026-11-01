import { eq } from "drizzle-orm";
import { invalid, notFound } from "@openmarko/kernel";
import { invoke, siteCall } from "@openmarko/integrations";
import { registerExecutor } from "@openmarko/automation";
import { postReviewReply } from "./reviews";
import { locations } from "@openmarko/organizations/schema";

/** Registers how the seo module's tasks are applied and undone. Called from the module's setup. */
export function registerSeoExecutors(): void {
  registerSiteFixExecutor();
  registerExecutor("review_reply", {
    apply: async (ctx, task) => {
      const p = task.payload as { reviewId: string; text: string };
      const { previousReply } = await postReviewReply(ctx, p.reviewId, p.text);
      return { reviewId: p.reviewId, previousReply };
    },
    revert: async (ctx, task) => {
      const rev = task.revert as { reviewId: string; previousReply: string | null } | null;
      if (!rev) throw invalid("Nothing to undo.");
      // An empty reply removes the posted one on Google.
      await postReviewReply(ctx, rev.reviewId, rev.previousReply ?? "");
    },
  });

  registerExecutor("profile_edit", {
    apply: async (ctx, task) => {
      const p = task.payload as { locationId: string; field: string; value: unknown; previous: unknown };
      const [loc] = await ctx.db.select().from(locations).where(eq(locations.id, p.locationId));
      if (!loc) throw notFound("Location");
      if (!loc.gbpConnectionId) throw invalid("Connect this Location's Google Business Profile first.");
      await invoke(
        ctx,
        task.organizationId,
        "profile.edit",
        { updateMask: p.field, field: p.field, value: p.value },
        { connectionId: loc.gbpConnectionId },
      );
      return { locationId: p.locationId, field: p.field, previous: p.previous ?? null };
    },
    revert: async (ctx, task) => {
      const rev = task.revert as { locationId: string; field: string; previous: unknown } | null;
      if (!rev) throw invalid("Nothing to undo.");
      const [loc] = await ctx.db.select().from(locations).where(eq(locations.id, rev.locationId));
      if (!loc?.gbpConnectionId) throw invalid("Connect this Location's Google Business Profile first.");
      await invoke(
        ctx,
        task.organizationId,
        "profile.edit",
        { updateMask: rev.field, field: rev.field, value: rev.previous },
        { connectionId: loc.gbpConnectionId },
      );
    },
  });
}

/** site_fix: writes the new text through the website's CMS. Undo puts back the value read just before the change. */
export function registerSiteFixExecutor(): void {
  registerExecutor("site_fix", {
    apply: async (ctx, task) => {
      const p = task.payload as { websiteId: string; url: string; op: "setTitle" | "setMetaDescription"; value: string };
      const page = await siteCall(ctx, task.organizationId, p.websiteId, { op: "readPage", url: p.url });
      const previous = p.op === "setTitle" ? page.title : (page.metaDescription ?? "");
      await siteCall(ctx, task.organizationId, p.websiteId, { op: p.op, url: p.url, value: p.value });
      return { websiteId: p.websiteId, url: p.url, op: p.op, previous };
    },
    revert: async (ctx, task) => {
      const rev = task.revert as { websiteId: string; url: string; op: "setTitle" | "setMetaDescription"; previous: string } | null;
      if (!rev) throw invalid("Nothing to undo.");
      await siteCall(ctx, task.organizationId, rev.websiteId, { op: rev.op, url: rev.url, value: rev.previous });
    },
  });
}
