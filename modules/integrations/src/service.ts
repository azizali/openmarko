import { and, eq, isNull, sql } from "drizzle-orm";
import {
  AppError,
  billingOf,
  decryptSecret,
  emit,
  encryptSecret,
  logActivity,
  needs,
  newId,
  notFound,
  invalid,
  type AppContext,
  type Tx,
} from "@app/kernel";
import { capabilityOf, meterOf, providerOf, type CapabilityId, type ProviderId } from "@app/shared";
import { connections, credentials, webhookEvents } from "./schema";
import { adapterFor } from "./adapters";
import type { Mode } from "./mode";

/** What a Connection belongs to: the app itself, or an Organization (as itself, or as a Partner for its Clients). */
export type Target = { type: "app" | "partner" | "organization"; id: string | null };

export type ConnectInput = {
  /** The Organization that owns it. Null for the app's own Connection (target `app`). */
  organizationId: string | null;
  providerId: ProviderId;
  target: Target;
  externalId?: string | null;
  label: string;
  /** Secrets for live calls. Encrypted at rest; never returned by any API. */
  secrets?: Record<string, string>;
  /** Non-secret settings (host, region…). Returned by the connections list. */
  settings?: Record<string, string>;
  capabilities?: CapabilityId[];
  /** `live` calls the vendor; `stub` answers with made-up data and no network (ADR 0029). A stub unless a caller says. */
  mode?: Mode;
  createdBy?: string | null;
};

/** What may connect where. Returns the provider's name and capabilities, or throws. */
function checkTarget(input: ConnectInput): { name: string; capabilities: CapabilityId[] } {
  const provider = providerOf(input.providerId);
  if (!provider) throw invalid(`Unknown provider ${input.providerId}.`);
  const owner = input.target.type;
  // A provider an Organization connects can also be connected once for the whole app.
  if (owner !== "app" && provider.attach !== owner && !(provider.attach === "organization" && owner === "partner"))
    throw invalid(`${provider.name} connects to a ${provider.attach}, not a ${owner}.`);
  return { name: provider.name, capabilities: input.capabilities ?? provider.capabilities };
}

/**
 * Connects a provider. A capability with `max: one` replaces the connection that already serves it for the
 * same target (catalog rule), and the app holds one Connection per provider. Both happen in one transaction.
 */
export async function connect(ctx: AppContext, input: ConnectInput): Promise<string> {
  const provider = checkTarget(input);
  const forApp = input.target.type === "app";
  if (forApp) {
    if (input.organizationId) throw invalid("The app's Connection names no Organization.");
    input = { ...input, target: { type: "app", id: null } };
  } else if (!input.organizationId) {
    throw invalid(`A Connection for a ${input.target.type} needs the Organization it belongs to.`);
  }
  const caps = provider.capabilities;
  const mode: Mode = input.mode ?? "stub";
  const id = newId();

  await ctx.db.transaction(async (tx) => {
    const sameTarget = and(
      input.organizationId ? eq(connections.organizationId, input.organizationId) : isNull(connections.organizationId),
      eq(connections.targetType, input.target.type),
      input.target.id ? eq(connections.targetId, input.target.id) : isNull(connections.targetId),
      isNull(connections.revokedAt),
    );
    const replaces = [
      ...caps.filter((c) => capabilityOf(c).max === "one").map((c) => sql`${connections.capabilities} @> ARRAY[${c}]::text[]`),
      ...(forApp ? [eq(connections.providerId, input.providerId)] : []),
    ];
    for (const rule of replaces) {
      const replaced = await tx.select({ id: connections.id }).from(connections).where(and(sameTarget, rule));
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
    await logActivity(tx, {
      organizationId: input.organizationId,
      actorType: forApp ? "admin" : "member",
      actorId: input.createdBy ?? null,
      action: "setup.connect",
      resourceType: "connection",
      resourceId: id,
      summary: `Connected ${provider.name}: ${input.label}`,
    });
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

const listed = {
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
};

/** The app's own Connections (no secrets). */
export async function listAppConnections(ctx: AppContext) {
  return ctx.db
    .select(listed)
    .from(connections)
    .where(and(eq(connections.targetType, "app"), isNull(connections.revokedAt)))
    .orderBy(connections.providerId);
}

/** Disconnects one of the app's own Connections and removes its secret. */
export async function disconnectAppConnection(ctx: AppContext, connectionId: string, by: string | null = null) {
  await ctx.db.transaction(async (tx) => {
    const [c] = await tx
      .select()
      .from(connections)
      .where(and(eq(connections.id, connectionId), eq(connections.targetType, "app"), isNull(connections.revokedAt)));
    if (!c) throw notFound("Connection");
    await revokeIn(tx, connectionId);
    await logActivity(tx, {
      actorType: "admin",
      actorId: by,
      action: "setup.connect",
      resourceType: "connection",
      resourceId: connectionId,
      summary: `Disconnected ${c.label}`,
    });
    await emit(tx, { event: "connection.revoked", payload: { connectionId, providerId: c.providerId } });
  });
}

/** Switches one of the app's own Connections between live and stub. Live needs the key the provider is called with. */
export async function setAppConnectionMode(ctx: AppContext, connectionId: string, mode: Mode, by: string | null = null) {
  await ctx.db.transaction(async (tx) => {
    const [c] = await tx
      .select()
      .from(connections)
      .where(and(eq(connections.id, connectionId), eq(connections.targetType, "app"), isNull(connections.revokedAt)));
    if (!c) throw notFound("Connection");
    if (mode === "live" && providerOf(c.providerId as ProviderId)?.fields?.some((f) => f.secret && !f.optional)) {
      const [held] = await tx.select({ id: credentials.connectionId }).from(credentials).where(eq(credentials.connectionId, connectionId));
      if (!held) throw invalid(`${c.label} has no key to go live with. Disconnect it and connect it again with one.`);
    }
    await tx.update(connections).set({ mode, updatedAt: new Date() }).where(eq(connections.id, connectionId));
    await logActivity(tx, {
      actorType: "admin",
      actorId: by,
      action: "setup.connect",
      resourceType: "connection",
      resourceId: connectionId,
      summary: `Switched ${c.label} to ${mode}`,
    });
  });
}

/** The app's own account with a provider: its settings and decrypted secrets together, or null. */
export async function appCredentials(ctx: AppContext, providerId: string): Promise<Record<string, string> | null> {
  const [c] = await ctx.db
    .select()
    .from(connections)
    .where(and(eq(connections.targetType, "app"), eq(connections.providerId, providerId), isNull(connections.revokedAt)))
    .orderBy(sql`created_at desc`)
    .limit(1);
  if (!c) return null;
  return { ...c.settings, ...(await readSecrets(ctx, c.id)) };
}

export async function listConnections(ctx: AppContext, organizationId: string) {
  return ctx.db
    .select(listed)
    .from(connections)
    .where(and(eq(connections.organizationId, organizationId), isNull(connections.revokedAt)))
    .orderBy(connections.providerId);
}

type Picked = {
  id: string;
  providerId: ProviderId;
  organizationId: string | null;
  externalId: string | null;
  mode: Mode;
  settings: Record<string, string>;
};

/** The connection that serves a capability: the Organization's own, else the app's. */
export async function pickConnection(ctx: AppContext, organizationId: string | null, capability: CapabilityId): Promise<Picked | null> {
  const live = and(sql`${connections.capabilities} @> ARRAY[${capability}]::text[]`, isNull(connections.revokedAt));
  const first = async (where: ReturnType<typeof and>) => {
    const [row] = await ctx.db
      .select()
      .from(connections)
      .where(where)
      .orderBy(sql`created_at desc`)
      .limit(1);
    return row ? pick(row) : null;
  };
  if (organizationId) {
    const own = await first(and(eq(connections.organizationId, organizationId), live));
    if (own) return own;
  }
  return first(and(isNull(connections.organizationId), eq(connections.targetType, "app"), live));
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
  const billing = billingOf(ctx);
  const meter = meterOf(conn.providerId);
  const byok = conn.organizationId !== null;
  const estimate = adapter.estimate?.(capability, input) ?? 1;
  if (meter && organizationId) await billing.assertMeterAllowed(organizationId, meter.meter, estimate, { byok });

  const result = await adapter.call(capability, input, {
    mode: conn.mode,
    provider: conn.providerId,
    externalId: conn.externalId,
    secrets: () => readSecrets(ctx, conn.id),
    settings: conn.settings,
  });

  if (meter && organizationId) {
    await billing.recordUsage(ctx.db, {
      organizationId,
      meter: meter.meter,
      quantity: result.quantity,
      costMicros: byok ? 0 : result.costMicros,
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
