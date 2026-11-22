import { defineModule } from "@app/kernel";
import { seoPermissions } from "./access";
import { checkJob, collectDueJob, collectJob, profileSyncJob, pruneJob } from "./checks/jobs";
import { seoRoutes } from "./routes";
import { registerExecutors } from "./suggestions/executors";

// SEO: where an Organization's businesses (Locations) show on Google Maps, Google search and AI answers, who beats
// them keyword by keyword, and what to do about it. Owns the `seo` schema (docs/features/seo/data-model.md).
//   locations/    Locations and Websites; launching puts a Location's checks on automation's schedule
//   tracking/     keywords, questions, and competitors added or hidden by hand
//   checks/       a cycle posts queries to the search-data provider, collects results and files them
//   results/      what each page reads: overview, maps, Google search, AI answers, competitors
//   suggestions/  rules that write suggestions after each cycle; applying one is an automation Task (Apply, Undo)
//   profile/      the Google Business Profile: linking, reading, changing, and its calls and clicks
//   onboarding/   finding the business, ideas for what to track, launch and its progress
//   admin/        what search data costs, for app admins
// Search data comes through integrations (`search.*`, `places.find`, `profile.manage`), never directly.
export const seoModule = defineModule({
  id: "seo",
  apiGroup: {
    name: "SEO",
    description: "Locations, rankings on Google Maps and search, AI answers, competitors, suggestions and SEO onboarding.",
  },
  dependsOn: ["integrations", "automation", "features"],
  roleGroups: [{ id: "seo", label: "SEO" }],
  permissions: [seoPermissions],
  setup: (ctx) => {
    registerExecutors();
    return { routes: seoRoutes(ctx), jobs: [checkJob(ctx), collectJob(ctx), collectDueJob(ctx), profileSyncJob(ctx), pruneJob(ctx)] };
  },
});
