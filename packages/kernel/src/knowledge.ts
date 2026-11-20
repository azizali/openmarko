// What the ai module asks of knowledge bases, without importing the knowledge module (which may be off).
import type { AppContext } from "./module";

export type KnowledgeHit = { chunkId: string; documentId: string; documentTitle: string; baseId: string; text: string; score: number };

export type Knowledge = {
  /** Throws not_found unless the base exists and belongs to the Organization. */
  assertBase(orgId: string, baseId: string): Promise<void>;
  /** Hybrid search over some of an Organization's bases, best chunks first. */
  search(orgId: string, baseIds: string[], query: string, k: number): Promise<KnowledgeHit[]>;
};

/** The knowledge in this process, or null when the module is off. */
export const knowledgeOf = (ctx: AppContext): Knowledge | null => ctx.knowledge ?? null;
