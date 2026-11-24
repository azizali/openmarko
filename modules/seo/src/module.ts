import { defineModule } from "@app/kernel";
import { seoPermissions } from "./access";
import { checkJob, collectDueJob, collectJob, profileSyncJob, pruneJob } from "./checks/jobs";
import { seoRoutes } from "./routes";
import { registerExecutors } from "./suggestions/executors";
import { seoTools } from "./tools";

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
// Search data comes through integrations (`search.*`, `places.find`, `places.details`, `profile.manage`), never directly.
export const seoModule = defineModule({
  id: "seo",
  apiGroup: {
    name: "SEO",
    description: "Locations, rankings on Google Maps and search, AI answers, competitors, suggestions and SEO onboarding.",
  },
  dependsOn: ["integrations", "automation", "features"],
  roleGroups: [{ id: "seo", label: "SEO" }],
  assistantBrief: [
    "Local SEO, AEO and GEO for the organization's businesses. Each business is a Location, chosen at the top of every SEO page.",
    "Checks run on a schedule and show where a Location ranks, and who beats it, keyword by keyword. The pages, under SEO / AEO / GEO in the sidebar:",
    "- Overview: a figure per check with its change over 30 days, and What to do next: suggestions such as adding the categories competitors list, getting listed on a site AI answers cite, tracking a keyword, describing services in the Google profile, or posting on it. Applying one is a Task, which can be undone.",
    "- Google Maps: per Maps keyword, how much of a grid of spots around the business sees it in the top 3, its average position and who is first. A keyword opens its map and why the ones ahead are ahead.",
    "- Google search: per search keyword, searches a month, position, its change in 30 days and who is first, and whether Google showed a map pack or an AI Overview.",
    "- AI answers: per question, whether ChatGPT, Google's AI Overview, Perplexity and other assistants name the business, where, and which sites they cite.",
    "- Competitors: who is ahead on each channel and on how many keywords; each opens their results beside the business's.",
    "- SEO settings: business details, what is checked and how often, the map grid, and the Google Business Profile link.",
  ].join("\n"),
  permissions: [seoPermissions],
  setup: (ctx) => {
    registerExecutors();
    return {
      routes: seoRoutes(ctx),
      jobs: [checkJob(ctx), collectJob(ctx), collectDueJob(ctx), profileSyncJob(ctx), pruneJob(ctx)],
      tools: seoTools,
    };
  },
});
