// Knowledge bases. Documents are parsed, chunked and embedded in the worker, then found by meaning and by words
// (hybrid search). Embeddings come from the stub here: a word-hash vector, so overlap in words is closeness.
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { connect } from "@app/integrations";
import { assignPlanManually, upsertPlan } from "@app/billing";
import { addMember } from "@app/organizations";
import { adminSession, composedApp, createTestDb, ownerSession, requester, type Session, type TestDb } from "@app/testkit";
import { chunkText, htmlToText, ingest, INGEST_JOB, pdfToText } from "../src";

let t: TestDb;
let app: Awaited<ReturnType<typeof composedApp>>;
let call: ReturnType<typeof requester>;
let owner: Session;
let queued: string[] = [];

const k = (s: Session) => `/api/v1/organizations/${s.orgId}/knowledge`;
/** Runs the ingest jobs queued so far, as the worker would. */
async function drain() {
  const ids = queued;
  queued = [];
  for (const id of ids) await ingest(t.ctx, id);
}

/** A one-page PDF with the given text, built by hand (offsets and all), so the parser is tested for real. */
function tinyPdf(text: string): Uint8Array<ArrayBuffer> {
  const stream = `BT /F1 12 Tf 72 720 Td (${text}) Tj ET`;
  const objs = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];
  let out = "%PDF-1.4\n";
  const offsets: number[] = [];
  objs.forEach((o, i) => {
    offsets.push(out.length);
    out += `${i + 1} 0 obj\n${o}\nendobj\n`;
  });
  const xref = out.length;
  out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n${offsets.map((o) => `${String(o).padStart(10, "0")} 00000 n \n`).join("")}`;
  out += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return new TextEncoder().encode(out);
}

beforeAll(async () => {
  t = await createTestDb();
  app = await composedApp(t.ctx);
  call = requester(app);
  t.ctx.enqueue = async (name, data) => void (name === INGEST_JOB && queued.push(String(data.documentId)));
  await connect(t.ctx, {
    organizationId: null,
    providerId: "openai",
    target: { type: "app", id: null },
    label: "OpenAI",
    secrets: { apiKey: "sk-x" },
  });
  await upsertPlan(t.ctx, {
    id: "kb",
    name: "KB",
    entitlements: {},
    meters: [{ meter: "llm.tokens", included: null, overage: "charge", unitPriceMicros: 0 }],
  });
  owner = await ownerSession(t.ctx, { orgName: "Maple Dental" });
  await assignPlanManually(t.ctx, owner.orgId, "kb");
});
afterAll(() => t.teardown());

const topHit = (baseId: string, q: string) =>
  call("POST", `${k(owner)}/search`, { headers: owner.headers, body: { baseIds: [baseId], query: q, k: 1 } });

describe("text in", () => {
  test("chunks: short text is one; long text splits at paragraphs, overlapping, and always ends", () => {
    expect(chunkText("One short paragraph.")).toEqual(["One short paragraph."]);
    const long = Array.from({ length: 40 }, (_, i) => `Paragraph ${i}. ${"word ".repeat(40)}`).join("\n\n");
    const pieces = chunkText(long);
    expect(pieces.length).toBeGreaterThan(3);
    expect(pieces.every((p) => p.length <= 2400)).toBe(true);
    expect(pieces.join(" ")).toContain("Paragraph 39.");
  });

  test("HTML loses scripts, styles and markup; a PDF's text is read", async () => {
    const { text, title } = htmlToText(
      "<html><head><title>Hours</title><style>p{}</style></head><body><script>x()</script><p>Open &amp; friendly</p><p>Mon&ndash;Fri</p></body></html>",
    );
    expect(title).toBe("Hours");
    expect(text).toContain("Open & friendly");
    expect(text).not.toContain("x()");
    expect(await pdfToText(tinyPdf("Whitening costs 300 dollars"))).toContain("Whitening costs 300 dollars");
  });
});

describe("knowledge bases", () => {
  let baseId: string;

  test("documents are ingested in the background and found by meaning and by words", async () => {
    const base = await call("POST", `${k(owner)}/bases`, { headers: owner.headers, body: { name: "Clinic facts" } });
    expect(base.status).toBe(200);
    expect(base.body).toMatchObject({ embeddingModel: "openai/text-embedding-3-small", dimensions: 1536 });
    baseId = base.body.id;

    const hours = await call("POST", `${k(owner)}/bases/${baseId}/documents`, {
      headers: owner.headers,
      body: {
        title: "Opening hours",
        kind: "markdown",
        content: "# Hours\n\nWe are open Monday to Friday, 9 to 5. On Sunday we are closed.",
      },
    });
    expect(hours.body.status).toBe("queued");
    await call("POST", `${k(owner)}/bases/${baseId}/documents`, {
      headers: owner.headers,
      body: { title: "Prices", kind: "text", content: "Teeth whitening costs 300 dollars. A cleaning costs 120 dollars." },
    });
    await drain();

    const docs = (await call("GET", `${k(owner)}/bases/${baseId}/documents`, { headers: owner.headers })).body as {
      title: string;
      status: string;
      chunkCount: number;
    }[];
    expect(docs.map((d) => [d.title, d.status])).toEqual(
      expect.arrayContaining([
        ["Opening hours", "ready"],
        ["Prices", "ready"],
      ]),
    );

    const listed = (await call("GET", `${k(owner)}/bases`, { headers: owner.headers })).body as {
      id: string;
      documents: number;
      chunks: number;
    }[];
    expect(listed.find((b) => b.id === baseId)).toMatchObject({ documents: 2, chunks: 2 });

    const open = await call("POST", `${k(owner)}/search`, {
      headers: owner.headers,
      body: { baseIds: [baseId], query: "are you open on sunday", k: 3 },
    });
    expect(open.body[0].documentTitle).toBe("Opening hours");
    const cost = await call("POST", `${k(owner)}/search`, {
      headers: owner.headers,
      body: { baseIds: [baseId], query: "how much is whitening", k: 3 },
    });
    expect(cost.body[0]).toMatchObject({ documentTitle: "Prices", text: expect.stringContaining("whitening") });

    const { rows } = await t.ctx.pool.query(`select meta from billing.usage_events where organization_id = $1`, [owner.orgId]);
    expect(rows.map((r) => r.meta.kind)).toEqual(["embed", "embed"]);
  });

  test("the vector half of the search uses its HNSW index", async () => {
    const c = await t.ctx.pool.connect();
    try {
      await c.query("set enable_seqscan = off");
      const vec = `[${Array.from({ length: 1536 }, () => 0.01).join(",")}]`;
      const { rows } = await c.query(
        `explain select id from knowledge.chunks where dimensions = 1536 order by embedding::vector(1536) <=> $1::vector(1536) limit 5`,
        [vec],
      );
      expect(rows.map((r) => r["QUERY PLAN"]).join("\n")).toContain("chunks_hnsw_1536");
    } finally {
      c.release();
    }
  });

  test("a web page and an uploaded PDF are read too", async () => {
    const realFetch = globalThis.fetch;
    globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) =>
      String(url).startsWith("https://maple.test/")
        ? new Response("<html><title>Insurance</title><body><p>We accept Delta Dental insurance.</p></body></html>", {
            headers: { "content-type": "text/html" },
          })
        : realFetch(url, init)) as typeof fetch;
    try {
      await call("POST", `${k(owner)}/bases/${baseId}/documents`, {
        headers: owner.headers,
        body: { title: "Insurance", kind: "url", url: "https://maple.test/insurance" },
      });
      const form = new FormData();
      form.set("file", new File([tinyPdf("Parking is free behind the building")], "parking.pdf", { type: "application/pdf" }));
      const up = await app.handle(
        new Request(`http://localhost:3000${k(owner)}/bases/${baseId}/files`, {
          method: "POST",
          headers: { cookie: owner.headers.get("cookie")!, origin: t.cfg.appUrl, host: "localhost:3000" },
          body: form,
        }),
      );
      expect(up.status).toBe(200);
      await drain();
    } finally {
      globalThis.fetch = realFetch;
    }
    expect((await topHit(baseId, "delta dental insurance")).body[0].documentTitle).toBe("Insurance");
    expect((await topHit(baseId, "free parking")).body[0].documentTitle).toBe("parking.pdf");
  });

  test("a document with no text, or a Plan that doesn't sell tokens, fails with the reason", async () => {
    const empty = await call("POST", `${k(owner)}/bases/${baseId}/documents`, {
      headers: owner.headers,
      body: { title: "Blank", kind: "text", content: "   " },
    });
    await drain();
    expect((await call("GET", `${k(owner)}/documents/${empty.body.id}`, { headers: owner.headers })).body).toMatchObject({
      status: "failed",
      error: expect.stringContaining("No text"),
    });

    const bare = await ownerSession(t.ctx, { orgName: "No plan" });
    const b = (await call("POST", `${k(bare)}/bases`, { headers: bare.headers, body: { name: "B" } })).body.id;
    const d = await call("POST", `${k(bare)}/bases/${b}/documents`, {
      headers: bare.headers,
      body: { title: "x", kind: "text", content: "hello world" },
    });
    await drain();
    expect((await call("GET", `${k(bare)}/documents/${d.body.id}`, { headers: bare.headers })).body).toMatchObject({
      status: "failed",
      error: expect.stringContaining("plan"),
    });
  });

  test("a viewer searches but can't add or create; another Organization's base isn't there", async () => {
    const viewer = await ownerSession(t.ctx, { orgName: "Viewer home" });
    await addMember(t.ctx, owner.orgId, viewer.userId, "viewer");
    const asViewer = { ...viewer, orgId: owner.orgId };
    expect(
      (await call("POST", `${k(asViewer)}/search`, { headers: viewer.headers, body: { baseIds: [baseId], query: "hours" } })).status,
    ).toBe(200);
    expect(
      (
        await call("POST", `${k(asViewer)}/bases/${baseId}/documents`, {
          headers: viewer.headers,
          body: { title: "x", kind: "text", content: "x" },
        })
      ).status,
    ).toBe(403);
    expect((await call("POST", `${k(asViewer)}/bases`, { headers: viewer.headers, body: { name: "x" } })).status).toBe(403);

    const other = await ownerSession(t.ctx, { orgName: "Other" });
    expect((await call("POST", `${k(other)}/search`, { headers: other.headers, body: { baseIds: [baseId], query: "hours" } })).status).toBe(
      404,
    );
  });
});

describe("the platform admin area's view", () => {
  test("an admin sees every base with its Organization, and can try a search", async () => {
    const admin = await adminSession(t.ctx);
    const list = (await call("GET", "/api/v1/admin/knowledge", { headers: admin.headers })).body as {
      id: string;
      organization: string;
      documents: number;
    }[];
    const clinic = list.find((b) => b.organization === "Maple Dental")!;
    expect(clinic.documents).toBeGreaterThan(0);
    const hits = await call("POST", "/api/v1/admin/knowledge/search", {
      headers: admin.headers,
      body: { baseId: clinic.id, query: "sunday hours" },
    });
    expect(hits.body[0].documentTitle).toBe("Opening hours");
    expect(
      (await call("POST", "/api/v1/admin/knowledge/search", { headers: owner.headers, body: { baseId: clinic.id, query: "x" } })).status,
    ).toBe(403);
  });
});
