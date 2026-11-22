// Files a Google search check: per keyword, your position (by your website's domain), what the page shows (map pack,
// AI Overview and whether it cites you, "People also ask"), and the first page in order, each site marked as a known
// business or a directory.

import { newId, type Tx } from "@app/kernel";
import type { OrganicResult } from "@app/integrations";
import { serpItems, serpResults } from "../schema";
import type { TaskTarget } from "./cycle";
import { domainOfLocation, placesByDomain, type Filing } from "./filing";

type OrganicTask = { target: Extract<TaskTarget, { kind: "organic" }>; result: OrganicResult | null };

/** How much of the page is kept per keyword: the first page, where competitors are read from. */
const KEPT = 10;

export async function fileOrganic(tx: Tx, f: Filing, tasks: OrganicTask[]): Promise<void> {
  const domain = await domainOfLocation(tx, f.location);
  const known = await placesByDomain(
    tx,
    tasks.flatMap((t) => (t.result?.items ?? []).slice(0, KEPT).map((i) => i.domain)),
  );
  for (const t of tasks) {
    const r = t.result;
    const mine = domain ? r?.items.find((i) => i.domain === domain) : undefined;
    const resultId = newId();
    await tx.insert(serpResults).values({
      id: resultId,
      organizationId: f.location.organizationId,
      locationId: f.location.id,
      checkId: f.checkId,
      keywordId: t.target.keywordId,
      checkedAt: f.checkedAt,
      yourPosition: mine?.position ?? null,
      yourUrl: mine?.url ?? null,
      hasMapPack: r?.mapPack ?? false,
      hasAiOverview: r?.aiOverview.shown ?? false,
      aiOverviewCitesYou: !!domain && !!r?.aiOverview.citedDomains.includes(domain),
      peopleAlsoAsk: (r?.peopleAlsoAsk ?? []).slice(0, 8),
    });
    const page = [...new Map((r?.items ?? []).slice(0, KEPT).map((i) => [i.position, i])).values()];
    if (page.length)
      await tx.insert(serpItems).values(
        page.map((i) => ({
          resultId,
          position: i.position,
          domain: i.domain,
          url: i.url,
          title: i.title.slice(0, 300),
          itemType: known.has(i.domain) || i.domain === domain ? "business" : "directory",
          placeId: i.domain === domain ? (f.location.placeId ?? null) : (known.get(i.domain) ?? null),
        })),
      );
  }
}
