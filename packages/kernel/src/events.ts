// The event bus and outbox (ADR 0009).
// emit() writes a row in the same transaction as the change it describes.
// drainOutbox() delivers rows to their handlers. Each handler runs in its own
// transaction together with its "handled" mark, so its database writes are
// committed exactly once. Calls to outside services can still repeat after a
// crash, so provider calls must be safe to repeat.
import { and, asc, eq, isNull, lt, lte, sql } from "drizzle-orm";
import { newId } from "./ids";
import { outbox, outboxHandled } from "./schema";
import type { Db, Tx } from "./db";

export type DomainEvent = {
  id: string;
  event: string;
  organizationId: string | null;
  payload: Record<string, unknown>;
};

export type Handler = (tx: Tx, event: DomainEvent) => Promise<void>;
type Registered = { name: string; fn: Handler };

const handlers = new Map<string, Registered[]>();

/**
 * Register a handler. `name` is its idempotency key: registering the same name again replaces the
 * earlier one, so booting a module twice in one process (as tests do) is harmless.
 */
export function handle(event: string, name: string, fn: Handler) {
  const list = (handlers.get(event) ?? []).filter((h) => h.name !== name);
  handlers.set(event, [...list, { name, fn }]);
}

export function handlersFor(event: string): string[] {
  return (handlers.get(event) ?? []).map((h) => h.name);
}

/** Write an event in the caller's transaction. Returns its id. */
export async function emit(
  tx: Tx,
  input: { event: string; organizationId?: string | null; payload?: Record<string, unknown> },
): Promise<string> {
  const id = newId();
  await tx.insert(outbox).values({
    id,
    event: input.event,
    organizationId: input.organizationId ?? null,
    payload: input.payload ?? {},
  });
  return id;
}

/** After this many failures an event stays in the table (processed_at null) for a person to look at. */
export const MAX_ATTEMPTS = 12;

/** Delivers up to `batch` pending events. Safe to run from several workers at once. */
export async function drainOutbox(db: Db, opts: { batch?: number; now?: Date } = {}): Promise<{ delivered: number; failed: number }> {
  const now = opts.now ?? new Date();
  const pending = await db
    .select({ id: outbox.id })
    .from(outbox)
    .where(and(isNull(outbox.processedAt), lte(outbox.availableAt, now), lt(outbox.attempts, MAX_ATTEMPTS)))
    .orderBy(asc(outbox.id))
    .limit(opts.batch ?? 100);

  let delivered = 0;
  let failed = 0;
  for (const { id } of pending) {
    try {
      await db.transaction(async (tx) => {
        // Lock the row; skip it if another worker is already on it.
        const [row] = await tx
          .select()
          .from(outbox)
          .where(and(eq(outbox.id, id), isNull(outbox.processedAt)))
          .for("update", { skipLocked: true });
        if (!row) return;
        const event: DomainEvent = {
          id: row.id,
          event: row.event,
          organizationId: row.organizationId,
          payload: row.payload,
        };
        for (const h of handlers.get(row.event) ?? []) {
          const claimed = await tx
            .insert(outboxHandled)
            .values({ eventId: row.id, handler: h.name })
            .onConflictDoNothing()
            .returning({ handler: outboxHandled.handler });
          if (claimed.length === 0) continue; // already ran
          await h.fn(tx, event);
        }
        await tx
          .update(outbox)
          .set({ processedAt: sql`now()` })
          .where(eq(outbox.id, row.id));
      });
      delivered++;
    } catch (err) {
      failed++;
      const message = err instanceof Error ? err.message : String(err);
      await db
        .update(outbox)
        .set({
          attempts: sql`${outbox.attempts} + 1`,
          lastError: message.slice(0, 2000),
          availableAt: sql`now() + make_interval(secs => least(3600, power(2, ${outbox.attempts} + 1)))`,
        })
        .where(eq(outbox.id, id));
    }
  }
  return { delivered, failed };
}
