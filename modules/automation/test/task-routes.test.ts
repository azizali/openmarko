// A Task's Apply, Undo and Dismiss each need the permission of the Task's own Action, over HTTP.
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { addMember } from "@app/organizations";
import { composedApp, createTestDb, ownerSession, requester, type Session, type TestDb } from "@app/testkit";
import { listTasks } from "../src";

let t: TestDb;
let call: ReturnType<typeof requester>;
let owner: Session;

const rename = (name: string) => ({
  kind: "organization.rename",
  featureId: "organization",
  action: "organization.update",
  title: `Rename to ${name}`,
  payload: { name },
});
const tasksUrl = (s: Session) => `/api/v1/organizations/${s.orgId}/tasks`;

beforeAll(async () => {
  t = await createTestDb();
  call = requester(await composedApp(t.ctx));
  owner = await ownerSession(t.ctx);
});
afterAll(() => t.teardown());

describe("task routes", () => {
  test("whoever may make the change may dismiss it, even on a resource with no view action", async () => {
    const r = await call("POST", tasksUrl(owner), { headers: owner.headers, body: rename("Dismissed Co") });
    expect(r.status).toBe(200);
    expect((await call("POST", `${tasksUrl(owner)}/${r.body.id}/dismiss`, { headers: owner.headers })).status).toBe(200);
    expect((await listTasks(t.ctx, owner.orgId)).find((x) => x.id === r.body.id)?.status).toBe("dismissed");
  });

  test("a member whose Role can't make the change can't dismiss it either", async () => {
    const r = await call("POST", tasksUrl(owner), { headers: owner.headers, body: rename("Kept Co") });
    const viewer = await ownerSession(t.ctx, { orgName: "Viewer's own" });
    await addMember(t.ctx, owner.orgId, viewer.userId, "viewer");
    const asViewer = { ...viewer, orgId: owner.orgId };
    expect((await call("POST", `${tasksUrl(asViewer)}/${r.body.id}/dismiss`, { headers: viewer.headers })).status).toBe(403);
  });
});
