// `bun run setup`: from a fresh fork to the app running on this machine. Asks a few questions, writes .env and
// app.config.ts, starts Postgres and Mailpit, migrates, seeds, makes your admin, and connects any AI keys you give it.
// Safe to rerun: secrets and data stay, answers are replaced.
import * as p from "@clack/prompts";
import { Pool } from "pg";
import { randomBytes } from "node:crypto";
import { basename, resolve } from "node:path";
import { appConfig as checkedIn } from "../app.config";
import { anEmail, ask, askModelKeys, capture, root, stop, step, required, scripted } from "./lib/cli";
import { patchAppConfig, readEnv, slugify, upsertEnv } from "./lib/config-files";

// Widened: `as const` would type the name as whatever a fork has answered, and comparing it to the default wouldn't compile.
const appConfig: { name: string; slug: string; modules: Record<string, boolean> } = checkedIn;

const SERVER = "postgres://postgres:dev@localhost:5433";
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function canReachPostgres(): Promise<"yes" | "no" | "other"> {
  const pool = new Pool({ connectionString: `${SERVER}/postgres`, max: 1, connectionTimeoutMillis: 1500 });
  try {
    await pool.query("select 1");
    return "yes";
  } catch (e) {
    // Something answers on the port, but it isn't this project's Postgres.
    return (e as { code?: string }).code === "28P01" ? "other" : "no";
  } finally {
    await pool.end();
  }
}

async function databaseExists(name: string): Promise<boolean> {
  const pool = new Pool({ connectionString: `${SERVER}/postgres`, max: 1 });
  const { rows } = await pool.query("select 1 from pg_database where datname = $1", [name]);
  await pool.end();
  return rows.length > 0;
}

/** Forks share one local Postgres, each with its own database, so a second fork finds the first one's server running. */
async function startServices() {
  const state = await canReachPostgres();
  if (state === "other") stop("Something else is on port 5433, and it isn't this project's Postgres. Stop it and run this again.");
  if (state === "yes") return p.log.info("Using the Postgres already running on port 5433.");
  if (!capture(["docker", "info"]).ok) stop("Docker isn't running. Start it and run this again.");
  step("Starting Postgres and Mailpit", ["docker", "compose", "-f", "docker-compose.dev.yml", "up", "-d"]);
  for (let i = 0; i < 60; i++) {
    if ((await canReachPostgres()) === "yes") return;
    await sleep(500);
  }
  stop("Postgres didn't start within 30 seconds. See: docker compose -f docker-compose.dev.yml logs postgres");
}

const portFree = async (port: number) => {
  try {
    const s = await Bun.connect({ hostname: "localhost", port, socket: { data() {} } });
    s.end();
    return false;
  } catch {
    return true;
  }
};

/** Starts `bun dev`, and opens the browser once the API answers. */
async function startApp() {
  if (!(await portFree(3000)) || !(await portFree(5173)) || !(await portFree(5174)) || !(await portFree(5175))) {
    p.log.warn("Ports 3000, 5173, 5174 or 5175 are in use, so I didn't start the app. Stop what's using them, then run: bun dev");
    return;
  }
  const dev = Bun.spawn(["bun", "dev"], { cwd: root, stdio: ["inherit", "inherit", "inherit"] });
  void (async () => {
    for (let i = 0; i < 120; i++) {
      if (
        await fetch("http://localhost:3000/health").then(
          (r) => r.ok,
          () => false,
        )
      ) {
        Bun.spawn([process.platform === "darwin" ? "open" : "xdg-open", "http://localhost:5173"], {
          stdio: ["ignore", "ignore", "ignore"],
        });
        return;
      }
      await sleep(500);
    }
  })();
  await dev.exited;
}

p.intro(`Set up ${appConfig.name === "Boilerplate" ? "your app" : appConfig.name}`);

const envFile = Bun.file(`${root}/.env`);
const had = await envFile.exists();
const before = had ? readEnv(await envFile.text()) : {};

const firstName =
  appConfig.name === "Boilerplate"
    ? basename(resolve(root))
        .replace(/[-_]+/g, " ")
        .replace(/\b\w/g, (c) => c.toUpperCase())
    : appConfig.name;
const name = await ask.text("name", "App name", { initial: firstName, validate: required("A name") });
const slug = await ask.text("slug", "Short id (lowercase letters, digits, dashes)", {
  initial: appConfig.slug === "app" ? slugify(name) : appConfig.slug,
  validate: (v) => (/^[a-z][a-z0-9-]*$/.test(v) ? undefined : "Lowercase letters, digits and dashes, starting with a letter."),
});

const optional = [
  { value: "billing", label: "Billing", hint: "Plans, limits, Stripe" },
  { value: "ai", label: "AI", hint: "models, assistants, chat widget" },
  { value: "knowledge", label: "Knowledge bases", hint: "needs AI" },
  { value: "automation", label: "Automation", hint: "schedules, Tasks, Activity" },
  { value: "partners", label: "Partners", hint: "agencies managing Clients, whitelabel" },
] as const;
type Optional = (typeof optional)[number]["value"];
const on = await ask.some<Optional>(
  "modules",
  "Which optional modules? (space to toggle)",
  [...optional],
  optional.map((m) => m.value).filter((id) => appConfig.modules[id]),
);
const modules = Object.fromEntries(optional.map((m) => [m.value, on.includes(m.value)])) as Record<Optional, boolean>;
if (modules.knowledge && !modules.ai) {
  modules.knowledge = false;
  p.log.warn("Knowledge bases need AI, so I turned them off.");
}

const email = await ask.text("email", "Your email (your admin account)", {
  initial: before.ADMIN_EMAILS?.includes("example.test") ? "" : before.ADMIN_EMAILS,
  validate: anEmail,
});
const database = await ask.text("database", "Local database name", {
  initial:
    before.DATABASE_URL && !before.DATABASE_URL.endsWith("/app")
      ? new URL(before.DATABASE_URL).pathname.slice(1)
      : slug.replaceAll("-", "_"),
  validate: (v) => (/^[a-z][a-z0-9_]*$/.test(v) ? undefined : "Lowercase letters, digits and underscores."),
});
const keys = modules.ai ? await askModelKeys() : [];

const secret = () => randomBytes(32).toString("base64");
const envText = upsertEnv(had ? await envFile.text() : await Bun.file(`${root}/.env.example`).text(), {
  DATABASE_URL: `${SERVER}/${database}`,
  BETTER_AUTH_SECRET: before.BETTER_AUTH_SECRET || secret(),
  MASTER_KEY_V1: before.MASTER_KEY_V1 || secret(),
  ADMIN_EMAILS: email,
});
await Bun.write(`${root}/.env`, envText);
await Bun.write(`${root}/app.config.ts`, patchAppConfig(await Bun.file(`${root}/app.config.ts`).text(), { name, slug, modules }));
p.log.success("Wrote .env and app.config.ts");

await startServices();

// Each step reads the files just written, not the ones this process started with.
const env = { ...(process.env as Record<string, string>), ...readEnv(envText) };
if (await databaseExists(database)) {
  step("Updating the database", ["bun", "scripts/migrate.ts"], { env });
  step("Seeding", ["bun", "scripts/seed.ts"], { env });
} else {
  step("Creating the database and sample data", ["bun", "scripts/reset.ts"], { env });
}

const admin = JSON.parse(
  step("Creating your admin account", ["bun", "scripts/create-admin.ts", email, "--json"], { env }).split("\n").at(-1)!,
) as {
  password: string | null;
};

// Now, not at the end: a later step can fail, and this password is shown only once.
if (admin.password) p.note(`${email}\n${admin.password}`, "Your admin account (the password is shown only once)");

for (const [i, { vendor, key }] of keys.entries())
  step(`Connecting ${vendor}`, ["bun", "scripts/connect-model.ts", vendor, ...(i === 0 ? ["--default"] : [])], {
    env: { ...env, MODEL_API_KEY: key },
  });

p.note(
  [
    `Your admin:  ${email}`,
    "",
    "Sample accounts, password password-123:",
    "  owner@example.test     owns the Acme Organization",
    "  member@example.test    an Editor in Acme",
    ...(modules.partners ? ["  partner@example.test   a Partner that manages Acme"] : []),
    "",
    "App       http://localhost:5173   (sign-in and the product)",
    "Site      http://localhost:5174   (its Sign in goes to the App)",
    "Mock      http://localhost:5175   (clickable prototype, not the product)",
    "API docs  http://localhost:3000/openapi",
    "Email     http://localhost:8025",
  ].join("\n"),
  "Ready",
);
p.outro("When you want it live: bun run deploy:setup");

if (!scripted && (await ask.yes("start", "Start the app now?"))) await startApp();
process.exit(0);
