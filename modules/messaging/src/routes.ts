import { Elysia, t } from "elysia";
import { type AppContext } from "@app/kernel";
import { emailStatus, sendNow } from "./service";

export function messagingRoutes(ctx: AppContext) {
  return new Elysia({ name: "messaging.admin" }).group("/api/v1/admin/email", (g) =>
    g
      .use(ctx.adminGuard!)
      .get("/", () => emailStatus(ctx), { detail: { summary: "Whether the app can send email: its sender and the provider it would use" } })
      .post("/test", ({ body }) => sendNow(ctx, { to: body.to, template: "test", data: {} }), {
        body: t.Object({ to: t.String({ format: "email" }) }),
        detail: { summary: "Send a test email now, from the app's sender, and say what the provider answered" },
      }),
  );
}
