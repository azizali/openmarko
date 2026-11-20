import { defineModule, type AppContext, type JobDefinition, type Knowledge } from "@app/kernel";
import { getBase, ingest, INGEST_JOB, search } from "./service";
import { knowledgeRoutes } from "./routes";

// Knowledge: an Organization's knowledge bases, their documents, ingesting in the worker, and hybrid search.
// Assistants (the ai module) retrieve from them through ctx.knowledge. It needs the ai module, and sits in its
// Role editor group, so the two read as one area.
export const knowledgeModule = defineModule({
  id: "knowledge",
  apiGroup: { name: "Knowledge", description: "Knowledge bases, their documents, and hybrid search." },
  dependsOn: ["integrations", "ai"],
  permissions: [
    {
      id: "knowledge",
      label: "Knowledge bases",
      group: "ai",
      actions: [
        { id: "view", label: "See and search knowledge bases", tier: "view" },
        { id: "edit", label: "Add and remove documents", tier: "edit" },
        { id: "manage", label: "Create and delete knowledge bases", tier: "manage" },
      ],
    },
  ],
  setup: (ctx) => {
    ctx.knowledge = knowledgeFor(ctx);
    return { routes: knowledgeRoutes(ctx), jobs: [ingestJob(ctx)] };
  },
});

/** What the kernel's `knowledgeOf(ctx)` answers while this module runs. */
export const knowledgeFor = (ctx: AppContext): Knowledge => ({
  assertBase: async (orgId, baseId) => void (await getBase(ctx, orgId, baseId)),
  search: (orgId, baseIds, query, k) => search(ctx, orgId, baseIds, query, k),
});

/** Ingests one document; a provider problem throws, so pg-boss retries it. */
const ingestJob = (ctx: AppContext): JobDefinition => ({
  name: INGEST_JOB,
  retry: { limit: 5, delaySeconds: 30, maxDelaySeconds: 1800 },
  perOrganization: true,
  run: async (data) => ingest(ctx, String(data.documentId)),
});
