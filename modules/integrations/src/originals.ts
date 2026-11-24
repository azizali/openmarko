// A provider's untrimmed responses, kept as files (ADR 0035). Adapters read each response into our own small shape
// and the rest is gone; the original is kept beside it so a field we don't read yet can be read later, past checks
// included. Each is one gzipped JSON file in the file store (`ctx.files`) and one row saying where it is. With no
// file store nothing is kept, and keeping never fails the call it came from.

import { and, eq, lt, sql } from "drizzle-orm";
import { newId, type AppContext } from "@app/kernel";
import type { CapabilityId, ProviderId } from "@app/shared";
import { providerOriginals } from "./schema";

export type Original = { ref: string; body: unknown };

/** Rows deleted per pass, so pruning a long backlog doesn't hold one huge transaction. */
const PRUNE_BATCH = 500;

/** Writes each original to the file store and records it. Errors are logged, not thrown. */
export async function keepOriginals(
  ctx: AppContext,
  call: { providerId: ProviderId; capability: CapabilityId; organizationId: string | null },
  originals: Original[],
): Promise<void> {
  const files = ctx.files;
  if (!files || !originals.length) return;
  const day = new Date().toISOString().slice(0, 10);
  for (const o of originals) {
    try {
      const id = newId();
      const bytes = Bun.gzipSync(new TextEncoder().encode(JSON.stringify(o.body)));
      const fileKey = `originals/${call.providerId}/${day}/${id}.json.gz`;
      await files.put(fileKey, bytes, "application/gzip");
      await ctx.db.insert(providerOriginals).values({
        id,
        providerId: call.providerId,
        capability: call.capability,
        ref: o.ref.slice(0, 200),
        organizationId: call.organizationId,
        fileKey,
        bytes: bytes.length,
      });
    } catch (e) {
      console.error(`Could not keep a ${call.providerId} response (${o.ref}):`, e);
    }
  }
}

/** The provider's untrimmed response with this id, the latest when there are several; null when none was kept. */
export async function readOriginal(ctx: AppContext, providerId: ProviderId, ref: string): Promise<unknown> {
  if (!ctx.files) return null;
  const [row] = await ctx.db
    .select({ fileKey: providerOriginals.fileKey })
    .from(providerOriginals)
    .where(and(eq(providerOriginals.providerId, providerId), eq(providerOriginals.ref, ref)))
    .orderBy(sql`${providerOriginals.createdAt} desc`)
    .limit(1);
  const bytes = row && (await ctx.files.get(row.fileKey));
  return bytes ? JSON.parse(new TextDecoder().decode(Bun.gunzipSync(new Uint8Array(bytes)))) : null;
}

/** Drops originals older than `PROVIDER_ORIGINALS_DAYS` (0 keeps them for good): their files, then their rows. */
export async function pruneOriginals(ctx: AppContext): Promise<number> {
  const days = ctx.cfg.providerOriginalsDays;
  if (!ctx.files || days === 0) return 0;
  const before = new Date(Date.now() - days * 86_400_000);
  let dropped = 0;
  for (;;) {
    const rows = await ctx.db
      .select({ id: providerOriginals.id, fileKey: providerOriginals.fileKey })
      .from(providerOriginals)
      .where(lt(providerOriginals.createdAt, before))
      .limit(PRUNE_BATCH);
    if (!rows.length) return dropped;
    await ctx.files.delete(rows.map((r) => r.fileKey));
    await ctx.db.delete(providerOriginals).where(sql`${providerOriginals.id} in ${rows.map((r) => r.id)}`);
    dropped += rows.length;
  }
}
