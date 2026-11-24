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
//   audit/        the site audit: which crawl facts are issues, health, fixes, and what its pages read
//   suggestions/  rules that write suggestions after each cycle (the Action plan); applying one is an automation Task
//   profile/      the Google Business Profile: linking, reading, changing, and its calls and clicks
//   onboarding/   finding the business, ideas for what to track, launch and its progress
//   admin/        what search data costs, for app admins
// Search data comes through integrations (`search.*`, `site.audit`, `places.find`, `places.details`, `profile.manage`),
// never directly.
export const seoModule = defineModule({
  id: "seo",
  apiGroup: {
    name: "SEO",
    description: "Locations, rankings on Google Maps and search, AI answers, competitors, site audits, suggestions and SEO onboarding.",
  },
  dependsOn: ["integrations", "automation", "features"],
  roleGroups: [{ id: "seo", label: "SEO" }],
  assistantBrief: [
    "Local SEO, AEO and GEO for the organization's businesses: where each shows on Google Maps, Google search and AI answers, who beats it, and what to change. Each business is a Location, chosen at the top of every page in the section.",
    "In the sidebar the section is Search, with four rows. Rankings and Actions each have their pages as tabs across the top.",
    "- Overview: a figure per check with its change over 30 days, the first few actions with the site's health, and what's behind the figures.",
    "- Rankings → Google Maps: per Maps keyword, how much of a grid of spots around the business sees it in the top 3, its average position and who is first. A keyword opens its map and why the ones ahead are ahead.",
    "- Rankings → Google search: per search keyword, searches a month, position, its change in 30 days and who is first, and whether Google showed a map pack or an AI Overview.",
    "- Rankings → AI answers: per question, whether ChatGPT, Google's AI Overview, Perplexity and other assistants name the business, where, and which sites they cite.",
    "- Rankings → Competitors: who is ahead on each channel and on how many keywords; each opens their results beside the business's.",
    "- Actions → Action plan: every suggestion in one list, most useful first, filtered by the ranking it should move and where it came from: fixing the website (from the site audit), the Google profile (categories, description, posts), keywords and questions to track, and sites to get listed on. Applying one is a Task, which can be undone; website fixes and listings are done by hand and marked done.",
    "- Actions → Site audit: the website's health out of 100, and each kind of issue found by crawling it (local business markup, phone matching the Google profile, a page per service, AI crawlers shut out by robots.txt, broken or slow pages, titles), with how to fix it and every page it's on. Errors and warnings are in the Action plan.",
    "- Search settings: business details, what is checked and how often, the map grid, and the Google Business Profile link.",
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
