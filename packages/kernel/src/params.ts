import { t } from "elysia";

export const uuidParam = t.String({ format: "uuid" });

/**
 * Params for a route under /organizations/:orgId plus these ids, all UUIDs. Declare it on each route: Elysia rejects
 * any path param a schema doesn't list, so a group-level schema with only orgId breaks every route with another id.
 */
export const ids = <K extends string>(...keys: K[]) =>
  t.Object({ orgId: uuidParam, ...(Object.fromEntries(keys.map((k) => [k, uuidParam])) as Record<K, typeof uuidParam>) });
