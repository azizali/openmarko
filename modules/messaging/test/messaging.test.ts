// The app's email. It sends from its sender (the `messaging` app setting) through an email Connection, queued and
// retried by the worker; sign-up, password reset and invitations go through it.
import { afterAll, afterEach, beforeAll, describe, expect, test } from "bun:test";
import { adapterFor, connect } from "@app/integrations";
import { writeAppSetting } from "@app/settings";
import { adminSession, composedApp, createTestDb, ownerSession, requester, type TestDb } from "@app/testkit";
import { emailStatus, render, sendNow, SEND_JOB } from "../src";

let t: TestDb;
let call: ReturnType<typeof requester>;
let admin: Awaited<ReturnType<typeof adminSession>>;
let queued: { name: string; data: Record<string, unknown> }[] = [];

beforeAll(async () => {
  t = await createTestDb();
  call = requester(await composedApp(t.ctx));
  admin = await adminSession(t.ctx);
  t.ctx.enqueue = async (name, data) => void queued.push({ name, data });
});
afterEach(() => void (queued = []));
afterAll(() => t.teardown());

const signUp = (email: string) =>
  call("POST", "/api/auth/sign-up/email", {
    headers: new Headers({ origin: t.cfg.appUrl }),
    body: { email, password: "password-123", name: "Sam" },
  });
const emails = () => queued.filter((q) => q.name === SEND_JOB).map((q) => q.data);

describe("before the app can send", () => {
  test("it isn't ready without a sender and a provider, and sign-up still works, sending nothing", async () => {
    expect((await call("GET", "/api/v1/admin/email", { headers: admin.headers })).body).toMatchObject({
      ready: false,
      sender: null,
      connection: null,
    });
    expect((await signUp("early@app.test")).status).toBe(200);
    expect(emails()).toEqual([]);
  });
});

describe("once it has a sender and a provider", () => {
  beforeAll(async () => {
    await writeAppSetting(t.ctx, "messaging", { fromEmail: "hello@app.test", fromName: "Maple" });
    await connect(t.ctx, {
      organizationId: null,
      providerId: "resend",
      target: { type: "app", id: null },
      label: "Resend",
      secrets: { key: "re_x" },
    });
  });

  test("it's ready, and a test email goes out through the app's provider", async () => {
    expect(await emailStatus(t.ctx)).toMatchObject({
      ready: true,
      sender: { fromEmail: "hello@app.test" },
      connection: { providerId: "resend", mode: "stub" },
    });
    const res = await call("POST", "/api/v1/admin/email/test", { headers: admin.headers, body: { to: "op@app.test" } });
    expect(res.status).toBe(200);
    expect(res.body.messageId).toMatch(/^stub-/);
  });

  test("signing up queues a verification email with its link, and the job sends it", async () => {
    expect((await signUp("new@app.test")).status).toBe(200);
    const [mail] = emails();
    expect(mail).toMatchObject({ to: "new@app.test", template: "verify-email" });
    expect(String((mail!.data as { url: string }).url)).toContain("/api/auth/verify-email?token=");
    await expect(sendNow(t.ctx, mail as never)).resolves.toMatchObject({ messageId: expect.stringMatching(/^stub-/) });
  });

  test("a password reset is emailed", async () => {
    await call("POST", "/api/auth/request-password-reset", {
      headers: new Headers({ origin: t.cfg.appUrl }),
      // The page to return to must be on an origin the app trusts, or Better Auth sends nothing.
      body: { email: "new@app.test", redirectTo: `${t.cfg.appUrl}/reset-password` },
    });
    // Better Auth may send it just after it answers.
    for (let i = 0; i < 20 && !emails().length; i++) await Bun.sleep(10);
    expect(emails().map((m) => m.template)).toContain("reset-password");
  });

  test("an invitation is emailed with a link into the app", async () => {
    const owner = await ownerSession(t.ctx, { orgName: "Maple & Main" });
    queued = [];
    const res = await call("POST", "/api/auth/organization/invite-member", {
      headers: new Headers({ cookie: owner.headers.get("cookie")!, origin: t.cfg.appUrl }),
      body: { email: "guest@app.test", role: "viewer", organizationId: owner.orgId },
    });
    expect(res.status).toBe(200);
    const [mail] = emails();
    expect(mail).toMatchObject({ template: "invitation", to: "guest@app.test", data: { organization: "Maple & Main", role: "viewer" } });
    const sent = render(
      { template: "invitation", data: { ...(mail!.data as Record<string, string>), url: `${t.cfg.appUrl}/accept-invitation/x` } },
      "Maple",
    );
    expect(sent.text).toContain(`${t.cfg.appUrl}/accept-invitation/`);
  });
});

const live = (secrets: Record<string, string>, settings: Record<string, string> = {}) => ({
  mode: "live" as const,
  provider: "resend" as never,
  externalId: null,
  secrets: async () => secrets,
  settings,
});

describe("live providers send what they expect", () => {
  const realFetch = globalThis.fetch;
  let seen: { url: string; init: RequestInit }[] = [];
  afterEach(() => {
    globalThis.fetch = realFetch;
    seen = [];
  });
  const fake = (res: Response) => {
    globalThis.fetch = (async (url: string, init: RequestInit) => {
      seen.push({ url: String(url), init });
      return res.clone();
    }) as typeof fetch;
  };
  const input = {
    to: "a@b.test",
    subject: "Hi",
    text: "Hello",
    html: "<p>Hello</p>",
    from: { email: "hello@app.test", name: "Maple" },
    replyTo: "help@app.test",
  };

  test("Resend", async () => {
    fake(Response.json({ id: "re_1" }));
    const out = await adapterFor("resend")!.call("email.send", input, live({ key: "re_x" }));
    expect(out.output).toEqual({ messageId: "re_1", accepted: true });
    expect(seen[0]!.url).toBe("https://api.resend.com/emails");
    expect(JSON.parse(String(seen[0]!.init.body))).toMatchObject({
      from: "Maple <hello@app.test>",
      to: ["a@b.test"],
      reply_to: "help@app.test",
    });
  });

  test("Postmark and SendGrid", async () => {
    fake(Response.json({ MessageID: "pm_1" }));
    expect((await adapterFor("postmark")!.call("email.send", input, live({ key: "pm" }))).output).toEqual({
      messageId: "pm_1",
      accepted: true,
    });
    expect(JSON.parse(String(seen[0]!.init.body))).toMatchObject({
      From: "Maple <hello@app.test>",
      To: "a@b.test",
      MessageStream: "outbound",
    });
    fake(new Response(null, { status: 202, headers: { "x-message-id": "sg_1" } }));
    expect((await adapterFor("sendgrid")!.call("email.send", input, live({ key: "SG.x" }))).output).toEqual({
      messageId: "sg_1",
      accepted: true,
    });
  });

  test("Mailgun needs its domain; EU goes to the EU endpoint", async () => {
    await expect(adapterFor("mailgun")!.call("email.send", input, live({ key: "k" }))).rejects.toMatchObject({ code: "invalid" });
    fake(Response.json({ id: "<mg_1>" }));
    await adapterFor("mailgun")!.call("email.send", input, live({ key: "k" }, { domain: "mg.app.test", region: "EU" }));
    expect(seen[0]!.url).toBe("https://api.eu.mailgun.net/v3/mg.app.test/messages");
  });

  test("a provider's refusal comes back as a 502 with what it said", async () => {
    fake(new Response("domain not verified", { status: 403 }));
    await expect(adapterFor("resend")!.call("email.send", input, live({ key: "re_x" }))).rejects.toMatchObject({
      status: 502,
      details: { status: 403, body: "domain not verified" },
    });
  });
});

describe("templates", () => {
  test("names in an email are escaped in its HTML", () => {
    const m = render({ template: "invitation", data: { inviter: "<script>x</script>", organization: "A & B" } }, "App");
    expect(m.html).not.toContain("<script>");
    expect(m.html).toContain("A &amp; B");
  });
  test("a magic link email has its link", () => {
    const m = render({ template: "magic-link", data: { url: "https://x.test/m" } }, "App");
    expect(m.subject).toBe("Sign in to App");
    expect(m.text).toContain("https://x.test/m");
  });
});
