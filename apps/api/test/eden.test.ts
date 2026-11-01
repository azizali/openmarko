import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { treaty } from "@elysiajs/eden";
import { createTestDb, ownerSession, type TestDb, type Session } from "@openmarko/testkit";
import { compose, buildApi, type Api } from "@openmarko/platform";

let t: TestDb;
let owner: Session;
let api: ReturnType<typeof treaty<Api>>;

beforeAll(async () => {
  t = await createTestDb();
  const app = buildApi(t.ctx, compose(t.ctx));
  api = treaty(app as unknown as Api);
  owner = await ownerSession(t.ctx, { orgName: "Eden check" });
});
afterAll(() => t.teardown());

describe("the typed client (Eden) talks to the same routes", () => {
  test("health is typed and returns the enabled modules", async () => {
    const { data, status } = await api.health.get();
    expect(status).toBe(200);
    expect((data as { ok: boolean }).ok).toBe(true);
  });

  test("an organization is read with the same session cookie", async () => {
    const { data, status } = await api.api.v1.organizations({ orgId: owner.orgId }).get({ headers: Object.fromEntries(owner.headers) });
    expect(status).toBe(200);
    expect((data as { name: string }).name).toBe("Eden check");
  });
});
