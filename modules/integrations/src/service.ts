import { and, eq, isNull, sql } from "drizzle-orm";
import {
  AppError,
  decryptSecret,
  emit,
  encryptSecret,
  logActivity,
  needs,
  newId,
  notFound,
  providerMode,
  invalid,
  type AppContext,
  type Tx,
} from "@openmarko/kernel";
import { assertMeterAllowed, recordUsage } from "@openmarko/billing";
import { capabilityOf, meterOf, providerOf, type CapabilityId, type ProviderId } from "@openmarko/shared";
import { connections, credentials, webhookEvents } from "./schema";
import { adapterFor } from "./adapters";
import type { Mode } from "./mode";

export type Target = { type: "platform" | "partner" | "organization" | "location" | "website"; id: string | null };

export type ConnectInput = {
  organizationId: string | null;
  providerId: ProviderId;
  target: Target;
  externalId?: string | null;
  label: string;
  /** Secrets for live calls. Encrypted at rest; never returned by any API. */
  secrets?: Record<string, string>;
  /** Non-secret settings (site address, SEO plugin…). Returned by the connections list. */
  settings?: Record<string, string>;
  capabilities?: CapabilityId[];
  createdBy?: string | null;
};

/**
 * Connects a provider. A capability with `max: one` replaces the connection that already serves it for the
 * same target (catalog rule). Both happen in one transaction.
 */
export async function connect(ctx: AppContext, input: ConnectInput): Promise<string> {
  const provider = providerOf(input.providerId);
  if (!provider) throw invalid(`Unknown provider ${input.providerId}.`);
  if (provider.attach !== input.target.type && !(provider.attach === "organization" && input.target.type === "platform")) {
    throw invalid(`${provider.name} connects to a ${provider.attach}, not a ${input.target.type}.`);
  }
  const caps = input.capabilities ?? provider.capabilities;
  const mode: Mode = providerMode(ctx.cfg, input.providerId);
  const id = newId();

  await ctx.db.transaction(async (tx) => {
    for (const c of caps) {
      if (capabilityOf(c).max !== "one") continue;
      const replaced = await tx
        .select({ id: connections.id })
        .from(connections)
        .where(
          and(
            input.organizationId ? eq(connections.organizationId, input.organizationId) : isNull(connections.organizationId),
            eq(connections.targetType, input.target.type),
            input.target.id ? eq(connections.targetId, input.target.id) : isNull(connections.targetId),
            sql`${connections.capabilities} @> ARRAY[${c}]::text[]`,
            isNull(connections.revokedAt),
          ),
        );
      for (const r of replaced) await revokeIn(tx, r.id);
    }
    await tx.insert(connections).values({
      id,
      organizationId: input.organizationId,
      providerId: input.providerId,
      targetType: input.target.type,
      targetId: input.target.id,
      externalId: input.externalId ?? null,
      label: input.label,
      capabilities: caps,
      settings: input.settings ?? {},
      mode,
      createdBy: input.createdBy ?? null,
    });
    if (input.secrets && Object.keys(input.secrets).length) {
      const sealed = encryptSecret(ctx.masterKeys, JSON.stringify(input.secrets));
      await tx.insert(credentials).values({
        connectionId: id,
        organizationId: input.organizationId,
        ciphertext: sealed.ciphertext,
        wrappedKey: sealed.wrappedKey,
        keyVersion: String(sealed.keyVersion),
      });
    }
    if (input.organizationId) {
      await logActivity(tx, {
        organizationId: input.organizationId,
        actorType: "member",
        actorId: input.createdBy ?? null,
        action: "setup.connect",
        resourceType: "connection",
        resourceId: id,
        summary: `Connected ${provider.name}: ${input.label}`,
      });
    }
    await emit(tx, {
      event: "connection.created",
      organizationId: input.organizationId,
      payload: { connectionId: id, providerId: input.providerId, capabilities: caps },
    });
  });
  return id;
}

async function revokeIn(tx: Tx, connectionId: string) {
  await tx.delete(credentials).where(eq(credentials.connectionId, connectionId));
  await tx
    .update(connections)
    .set({ revokedAt: new Date(), updatedAt: new Date(), status: "revoked" })
    .where(eq(connections.id, connectionId));
}

/** Disconnects, and removes the stored secret. The Connection row stays, revoked, for history. */
export async function disconnect(ctx: AppContext, organizationId: string, connectionId: string, actorId: string | null): Promise<void> {
  await ctx.db.transaction(async (tx) => {
    const [c] = await tx
      .select()
      .from(connections)
      .where(and(eq(connections.id, connectionId), eq(connections.organizationId, organizationId)));
    if (!c) throw notFound("Connection");
    await revokeIn(tx, connectionId);
    await logActivity(tx, {
      organizationId,
      actorType: "member",
      actorId,
      action: "setup.connect",
      resourceType: "connection",
      resourceId: connectionId,
      summary: `Disconnected ${providerOf(c.providerId as ProviderId)?.name ?? c.providerId}`,
    });
    await emit(tx, { event: "connection.revoked", organizationId, payload: { connectionId, providerId: c.providerId } });
  });
}

export async function listConnections(ctx: AppContext, organizationId: string) {
  return ctx.db
    .select({
      id: connections.id,
      providerId: connections.providerId,
      targetType: connections.targetType,
      targetId: connections.targetId,
      label: connections.label,
      status: connections.status,
      statusNote: connections.statusNote,
      capabilities: connections.capabilities,
      mode: connections.mode,
      settings: connections.settings,
      createdAt: connections.createdAt,
    })
    .from(connections)
    .where(and(eq(connections.organizationId, organizationId), isNull(connections.revokedAt)));
}

type Picked = {
  id: string;
  providerId: ProviderId;
  organizationId: string | null;
  externalId: string | null;
  mode: Mode;
  settings: Record<string, string>;
};

/** The connection that serves a capability: the Organization's own first, then the platform default for LLM calls. */
export async function pickConnection(ctx: AppContext, organizationId: string | null, capability: CapabilityId): Promise<Picked | null> {
  const serves = sql`${connections.capabilities} @> ARRAY[${capability}]::text[]`;
  if (organizationId) {
    const [own] = await ctx.db
      .select()
      .from(connections)
      .where(and(eq(connections.organizationId, organizationId), serves, isNull(connections.revokedAt)))
      .orderBy(sql`created_at desc`)
      .limit(1);
    if (own) return pick(own);
  }
  if (capability.startsWith("llm.")) {
    const [platform] = await ctx.db
      .select()
      .from(connections)
      .where(and(isNull(connections.organizationId), eq(connections.providerId, "platform_llm"), serves, isNull(connections.revokedAt)))
      .limit(1);
    if (platform) return pick(platform);
  }
  return null;
}

function pick(c: typeof connections.$inferSelect): Picked {
  return {
    id: c.id,
    providerId: c.providerId as ProviderId,
    organizationId: c.organizationId,
    externalId: c.externalId,
    mode: c.mode as Mode,
    settings: c.settings,
  };
}

export type InvokeOptions = { connectionId?: string; runId?: string | null };
export type InvokeResult<T> = { output: T; connectionId: string; provider: ProviderId; mode: Mode };

/**
 * The one path to a provider (ADR 0002). Picks the connection, checks the Plan's allowance for metered
 * providers, calls the adapter, and records usage. Throws needs() when nothing is connected.
 */
export async function invoke<T = unknown>(
  ctx: AppContext,
  organizationId: string | null,
  capability: CapabilityId,
  input: unknown,
  opts: InvokeOptions = {},
): Promise<InvokeResult<T>> {
  const conn = opts.connectionId ? await loadConnection(ctx, opts.connectionId) : await pickConnection(ctx, organizationId, capability);
  if (!conn) throw needs(capability);

  const adapter = adapterFor(conn.providerId);
  if (!adapter || !adapter.capabilities.includes(capability)) {
    throw new AppError(501, "not_implemented", `${conn.providerId} doesn't implement ${capability}.`);
  }
  const meter = meterOf(conn.providerId);
  const byok = conn.organizationId !== null && conn.providerId !== "platform_llm";
  const estimate = adapter.estimate?.(capability, input) ?? 1;
  if (meter && organizationId) {
    await assertMeterAllowed(ctx, organizationId, meter.meter, estimate, { byok });
  }

  const secrets = async () => readSecrets(ctx, conn.id);
  const result = await adapter.call(capability, input, {
    mode: conn.mode,
    provider: conn.providerId,
    externalId: conn.externalId,
    secrets,
    settings: conn.settings,
    google: ctx.cfg.google,
  });

  if (meter && organizationId) {
    await recordUsage(ctx.db, {
      organizationId,
      meter: meter.meter,
      quantity: result.quantity,
      costMicros: result.costMicros,
      provider: conn.providerId,
      mode: conn.mode,
      runId: opts.runId ?? null,
      meta: { capability },
    });
  }
  return { output: result.output as T, connectionId: conn.id, provider: conn.providerId, mode: conn.mode };
}

async function loadConnection(ctx: AppContext, id: string): Promise<Picked> {
  const [c] = await ctx.db
    .select()
    .from(connections)
    .where(and(eq(connections.id, id), isNull(connections.revokedAt)));
  if (!c) throw notFound("Connection");
  return pick(c);
}

/** Decrypts a connection's secrets. Only adapters call this. */
export async function readSecrets(ctx: AppContext, connectionId: string): Promise<Record<string, string>> {
  const [row] = await ctx.db.select().from(credentials).where(eq(credentials.connectionId, connectionId));
  if (!row) return {};
  const plain = decryptSecret(ctx.masterKeys, {
    ciphertext: row.ciphertext,
    wrappedKey: row.wrappedKey,
    keyVersion: Number(row.keyVersion),
  });
  return JSON.parse(plain) as Record<string, string>;
}

/**
 * Stores an inbound webhook before anything reads it. Returns false when the same event was already stored,
 * so a provider's retries do nothing twice.
 */
export async function storeWebhook(
  ctx: AppContext,
  providerId: string,
  externalId: string,
  payload: Record<string, unknown>,
): Promise<boolean> {
  const rows = await ctx.db
    .insert(webhookEvents)
    .values({ id: newId(), providerId, externalId, payload })
    .onConflictDoNothing()
    .returning({ id: webhookEvents.id });
  return rows.length === 1;
}
