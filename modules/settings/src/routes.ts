import { Elysia, t } from "elysia";
import { z } from "zod";
import { APP_SCOPE_ID, catalogOf, logActivity, notFound, type AppContext } from "@app/kernel";
import { readSetting, writeSetting } from "./service";

export function settingsRoutes(ctx: AppContext) {
  const appEntries = () => catalogOf(ctx).settings.filter((s) => s.scopes.includes("app"));
  return new Elysia({ name: "settings.admin" }).group("/api/v1/admin/settings", (g) =>
    g
      .use(ctx.adminGuard!)
      .get(
        "/",
        async () =>
          Promise.all(
            appEntries().map(async (e) => {
              const current = await readSetting(ctx, "app", APP_SCOPE_ID, e.id);
              return {
                id: e.id,
                module: e.module,
                label: e.label,
                schema: z.toJSONSchema(e.schema, { io: "input" }) as Record<string, unknown>,
                value: current?.value ?? null,
                version: current?.version ?? 0,
              };
            }),
          ),
        { detail: { summary: "The app's settings: each namespace the enabled modules declare, its schema and its value" } },
      )
      .put(
        "/:namespace",
        async ({ admin, params, body }) => {
          if (!appEntries().some((e) => e.id === params.namespace)) throw notFound("Setting");
          const version = await writeSetting(ctx, "app", APP_SCOPE_ID, params.namespace, body.value, {
            expectedVersion: body.version || undefined,
            by: admin.userId,
          });
          await ctx.db.transaction((tx) =>
            logActivity(tx, {
              actorType: "admin",
              actorId: admin.userId,
              action: "settings.update",
              resourceType: "setting",
              resourceId: params.namespace,
              summary: `Changed the ${params.namespace} settings`,
            }),
          );
          return { version };
        },
        {
          body: t.Object({ value: t.Unknown(), version: t.Optional(t.Number()) }),
          detail: { summary: "Change one of the app's settings (checked against its schema; version guards against overwriting)" },
        },
      ),
  );
}
