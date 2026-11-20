// `bun run deploy:setup`: from a working fork to production, once. Asks where it goes, checks those places work before
// touching anything, fills the deploy files from deploy.config.json, prepares the Neon database, makes your admin,
// sets GitHub's secrets and creates the two Vercel projects. After this, a push to main deploys. Safe to rerun.
//
// Production's secrets live in .env.production (not committed). Add GOOGLE_*, STRIPE_*, TURNSTILE_* there and rerun.
import * as p from "@clack/prompts";
import { Pool } from "pg";
import { randomBytes } from "node:crypto";
import { existsSync, mkdirSync } from "node:fs";
import { resolve4 } from "node:dns/promises";
import { homedir } from "node:os";
import { appConfig } from "../app.config";
import { isPooledUrl } from "@app/kernel";
import { anEmail, ask, askModelKeys, capture, hasProgram, root, scripted, step, stop, required } from "./lib/cli";
import { githubRepo, patchDeployYml, patchPreDeploy, patchVercelJson, readEnv, upsertEnv, type DeployConfig } from "./lib/config-files";

const CONFIG = `${root}/deploy.config.json`;
const SECRETS = `${root}/.env.production`;
const OPTIONAL_SECRETS = [
  "GOOGLE_CLIENT_ID",
  "GOOGLE_CLIENT_SECRET",
  "STRIPE_SECRET_KEY",
  "STRIPE_WEBHOOK_SECRET",
  "TURNSTILE_SITE_KEY",
  "TURNSTILE_SECRET_KEY",
];
const slug = appConfig.slug;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const aDomain = (v: string) => (/^[a-z0-9-]+(\.[a-z0-9-]+)+$/i.test(v) ? undefined : "A domain, like app.example.com.");

// ----- What this machine needs -----

function checkTools() {
  const problems: string[] = [];
  if (!hasProgram("gh")) problems.push("GitHub's CLI is missing: brew install gh, then gh auth login");
  else if (!capture(["gh", "auth", "status"]).ok) problems.push("GitHub's CLI isn't signed in: gh auth login");
  if (!hasProgram("vercel")) problems.push("Vercel's CLI is missing: bun add -g vercel, then vercel login");
  else if (!capture(["vercel", "whoami"]).ok) problems.push("Vercel's CLI isn't signed in: vercel login");
  for (const tool of ["ssh", "ssh-keygen", "git"]) if (!hasProgram(tool)) problems.push(`${tool} is missing`);
  if (problems.length) stop(problems.join("\n"));
}

// ----- Checks, before anything changes -----

const sshTo = (c: DeployConfig, command: string, identity?: string) => [
  "ssh",
  "-o",
  "BatchMode=yes",
  "-o",
  "ConnectTimeout=10",
  "-o",
  "StrictHostKeyChecking=accept-new",
  ...(identity ? ["-o", "IdentitiesOnly=yes", "-i", identity] : []),
  `${c.sshUser}@${c.server}`,
  command,
];

async function checkDatabase(url: string): Promise<string | null> {
  if (isPooledUrl(url))
    return "That's Neon's pooled address. Use the direct one: turn off 'Connection pooling' in Neon's Connect dialog (no -pooler in the host).";
  const pool = new Pool({ connectionString: url, max: 1, connectionTimeoutMillis: 10_000 });
  try {
    await pool.query("select 1");
    return null;
  } catch (e) {
    return `Can't reach the database: ${(e as Error).message}`;
  } finally {
    await pool.end();
  }
}

async function apiDomainProblem(c: DeployConfig): Promise<string | null> {
  const found = await resolve4(c.apiDomain).catch(() => [] as string[]);
  if (found.includes(c.server)) return null;
  return `${c.apiDomain} points at ${found.join(", ") || "nothing"}, not ${c.server}. Add an A record for it; the HTTPS certificate can't be issued without one.`;
}

// ----- The steps -----

function installDeployKey(c: DeployConfig): string {
  const path = `${homedir()}/.ssh/${slug}-deploy`;
  mkdirSync(`${homedir()}/.ssh`, { recursive: true, mode: 0o700 });
  if (!existsSync(path)) step("Making a deploy key", ["ssh-keygen", "-t", "ed25519", "-N", "", "-C", `${slug}-deploy`, "-f", path]);
  const pub = capture(["cat", `${path}.pub`]).out;
  step(
    "Adding the deploy key to the server",
    sshTo(
      c,
      `mkdir -p ~/.ssh && chmod 700 ~/.ssh && touch ~/.ssh/authorized_keys && grep -qxF '${pub}' ~/.ssh/authorized_keys || echo '${pub}' >> ~/.ssh/authorized_keys`,
    ),
  );
  step("Checking the deploy key works", sshTo(c, "true", path));
  return path;
}

async function setGithubSecrets(c: DeployConfig, secrets: Record<string, string>, keyPath: string) {
  const values: Record<string, string> = { SSH_PRIVATE_KEY: await Bun.file(keyPath).text() };
  for (const k of ["DATABASE_URL", "BETTER_AUTH_SECRET", "MASTER_KEY_V1", ...OPTIONAL_SECRETS]) if (secrets[k]) values[k] = secrets[k]!;
  const s = p.spinner();
  s.start("Setting GitHub's secrets");
  for (const [name, value] of Object.entries(values)) {
    const r = capture(["gh", "secret", "set", name, "--repo", c.repo], { stdin: value });
    if (!r.ok) {
      s.stop("Setting GitHub's secrets: failed");
      stop(`${name}: ${r.err}`);
    }
  }
  s.stop(`Set ${Object.keys(values).length} GitHub secrets`);
  step("Turning on the deploy job", ["gh", "variable", "set", "DEPLOY", "--repo", c.repo, "--body", "true"]);
  // GitHub turns Actions off on a new fork until someone turns them on.
  capture(["gh", "api", "-X", "PUT", `repos/${c.repo}/actions/permissions`, "-F", "enabled=true", "-f", "allowed_actions=all"]);
  capture(["gh", "workflow", "enable", "ci.yml", "--repo", c.repo]);
}

function vercelProject(c: DeployConfig, name: string, directory: string, domain: string, env: Record<string, string> = {}) {
  if (!capture(["vercel", "api", `/v9/projects/${name}`]).ok) {
    const body = {
      name,
      framework: "vite",
      rootDirectory: directory,
      gitRepository: { type: "github", repo: c.repo },
      environmentVariables: Object.entries(env).map(([key, value]) => ({ key, value, type: "plain", target: ["production", "preview"] })),
    };
    step(`Creating Vercel project ${name}`, ["vercel", "api", "/v11/projects", "-X", "POST", "--input", "-"], {
      stdin: JSON.stringify(body),
    });
  } else {
    p.log.info(`Vercel project ${name} already exists.`);
  }
  // Fails harmlessly when the domain is already on the project.
  const added = capture(["vercel", "api", `/v10/projects/${name}/domains`, "-X", "POST", "--input", "-"], {
    stdin: JSON.stringify({ name: domain }),
  });
  if (!added.ok && !/already|in use by this project/i.test(`${added.out} ${added.err}`))
    p.log.warn(`Couldn't add ${domain} to ${name}: ${added.err || added.out}`);
}

async function waitForDeploy(c: DeployConfig) {
  await sleep(8000); // GitHub takes a moment to list the run the push started
  const id = capture([
    "gh",
    "run",
    "list",
    "--repo",
    c.repo,
    "--workflow",
    "ci.yml",
    "--limit",
    "1",
    "--json",
    "databaseId",
    "--jq",
    ".[0].databaseId",
  ]).out;
  if (id) {
    p.log.step("Watching the deploy (the first takes a few minutes)");
    const watch = Bun.spawnSync(["gh", "run", "watch", id, "--repo", c.repo, "--exit-status"], {
      stdio: ["inherit", "inherit", "inherit"],
    });
    if (watch.exitCode !== 0) stop(`The deploy failed. See: gh run view ${id} --repo ${c.repo} --log-failed`);
  }
  const live = await fetch(`https://${c.apiDomain}/health`).then(
    (r) => r.ok,
    () => false,
  );
  p.log[live ? "success" : "warn"](
    live ? `The API is live at https://${c.apiDomain}` : `The deploy finished, but https://${c.apiDomain}/health isn't answering yet.`,
  );
}

// ----- The questions -----

p.intro(`Deploy ${appConfig.name}`);
if (!scripted) checkTools();

const previous: Partial<DeployConfig> = existsSync(CONFIG) ? await Bun.file(CONFIG).json() : {};
const repo = githubRepo(capture(["git", "remote", "get-url", "origin"]).out);
if (!repo) stop("This repository's origin isn't on GitHub. Fork it there, or: git remote add origin git@github.com:you/your-app.git");

const secretsBefore = existsSync(SECRETS) ? readEnv(await Bun.file(SECRETS).text()) : {};
const envBefore = existsSync(`${root}/.env`) ? readEnv(await Bun.file(`${root}/.env`).text()) : {};

const config: DeployConfig = {
  repo: repo!,
  server: await ask.text("server", "VPS IP address", { initial: previous.server, validate: required("The address") }),
  sshUser: await ask.text("sshUser", "SSH user on the VPS (needs to be able to install Docker)", {
    initial: previous.sshUser ?? "root",
    validate: required("The user"),
  }),
  apiDomain: await ask.text("apiDomain", "API domain (an A record pointing at the VPS)", {
    initial: previous.apiDomain,
    validate: aDomain,
  }),
  appDomain: await ask.text("appDomain", "Web app domain", { initial: previous.appDomain, validate: aDomain }),
  siteDomain: await ask.text("siteDomain", "Marketing site domain (empty for none)", {
    initial: previous.siteDomain ?? "",
    validate: (v) => (v ? aDomain(v) : undefined),
  }),
  adminEmail: await ask.text("adminEmail", "Your email (your admin account in production)", {
    initial: previous.adminEmail ?? envBefore.ADMIN_EMAILS,
    validate: anEmail,
  }),
};
const databaseUrl = await ask.text("databaseUrl", "Neon connection string (the direct one)", {
  initial: secretsBefore.DATABASE_URL,
  validate: (v) => (/^postgres(ql)?:\/\//.test(v) ? undefined : "It starts with postgresql://"),
});
const keys = appConfig.modules.ai ? await askModelKeys() : [];

// ----- Everything is checked before anything changes -----

const spin = p.spinner();
spin.start("Checking the database, DNS and SSH");
const problems = [
  await checkDatabase(databaseUrl),
  await apiDomainProblem(config),
  capture(sshTo(config, "true")).ok
    ? null
    : `Can't SSH to ${config.sshUser}@${config.server} with your keys. Check you can: ssh ${config.sshUser}@${config.server}`,
].filter((x): x is string => x !== null);
spin.stop(problems.length ? "Found problems" : "Database, DNS and SSH are good");
if (problems.length) stop(problems.join("\n"));

// ----- The deploy files -----

const edit = async (path: string, fn: (text: string) => string) =>
  Bun.write(`${root}/${path}`, fn(await Bun.file(`${root}/${path}`).text()));
await Bun.write(CONFIG, `${JSON.stringify(config, null, 2)}\n`);
await edit("config/deploy.yml", (t) => patchDeployYml(t, config, slug));
await edit(".kamal/hooks/pre-deploy", (t) => patchPreDeploy(t, config));
await edit("apps/web/vercel.json", (t) => patchVercelJson(t, config));
p.log.success("Filled the deploy files from deploy.config.json");

const secret = () => randomBytes(32).toString("base64");
const secrets = {
  ...secretsBefore,
  DATABASE_URL: databaseUrl,
  BETTER_AUTH_SECRET: secretsBefore.BETTER_AUTH_SECRET || secret(),
  MASTER_KEY_V1: secretsBefore.MASTER_KEY_V1 || secret(),
};
const header =
  "# Production's secrets. Never commit this file. Without MASTER_KEY_V1, the provider keys stored in the database can't be read: keep a copy somewhere safe.\n";
await Bun.write(SECRETS, upsertEnv(existsSync(SECRETS) ? await Bun.file(SECRETS).text() : header, secrets));

// ----- The database: migrations, the first Plan, your admin, your AI keys -----

const env: Record<string, string> = {
  PATH: process.env.PATH!,
  HOME: process.env.HOME!,
  ...secrets,
  NODE_ENV: "production",
  BETTER_AUTH_URL: `https://${config.apiDomain}`,
  APP_URL: `https://${config.appDomain}`,
  ADMIN_EMAILS: config.adminEmail,
};
// --no-env-file: the local .env must not leak into production's data.
const prod = (script: string, ...args: string[]) => ["bun", "--no-env-file", `scripts/${script}.ts`, ...args];
step("Applying migrations to Neon", prod("migrate"), { env });
step("Adding the first Plan", prod("bootstrap"), { env });
const admin = JSON.parse(
  step("Creating your admin account", prod("create-admin", config.adminEmail, "--json"), { env })
    .split("\n")
    .at(-1)!,
) as { password: string | null };
// Now, not at the end: a later step can fail, and this password is shown only once.
if (admin.password) p.note(`${config.adminEmail}\n${admin.password}`, "Your admin account (the password is shown only once)");
for (const [i, { vendor, key }] of keys.entries())
  step(`Connecting ${vendor}`, prod("connect-model", vendor, ...(i === 0 ? ["--default"] : [])), { env: { ...env, MODEL_API_KEY: key } });

// ----- GitHub and Vercel -----

const keyPath = installDeployKey(config);
await setGithubSecrets(config, secrets, keyPath);
vercelProject(config, `${slug}-app`, "apps/web", config.appDomain);
if (config.siteDomain)
  vercelProject(config, `${slug}-site`, "apps/site", config.siteDomain, { VITE_APP_URL: `https://${config.appDomain}` });

p.note(
  [
    `${config.apiDomain}   A      ${config.server}`,
    `${config.appDomain}   CNAME  cname.vercel-dns.com`,
    ...(config.siteDomain ? [`${config.siteDomain}   CNAME  cname.vercel-dns.com`] : []),
    "",
    "(A domain's apex can't be a CNAME: use A 76.76.21.21 there.)",
  ].join("\n"),
  "DNS records you need",
);

// ----- The first deploy -----

const branch = capture(["git", "branch", "--show-current"]).out;
const push = await ask.yes(
  "push",
  `Commit the deploy files and push ${branch}?${branch === "main" ? " This starts the first deploy." : " Deploys run only from main."}`,
);
if (push) {
  // app.config.ts too: `bun run setup` wrote the name and modules there, and the deploy builds from what's committed.
  const files = ["app.config.ts", "deploy.config.json", "config/deploy.yml", ".kamal/hooks/pre-deploy", "apps/web/vercel.json"];
  capture(["git", "add", ...files]);
  capture(["git", "commit", "-m", "chore: deploy configuration", "--", ...files]);
  step(`Pushing ${branch}`, ["git", "push", "-u", "origin", branch]);
  if (branch === "main") await waitForDeploy(config);
} else {
  p.log.info(
    "When you're ready, commit app.config.ts, deploy.config.json, config/deploy.yml, .kamal/hooks/pre-deploy and apps/web/vercel.json, and push to main.",
  );
}

p.note(
  [
    `App       https://${config.appDomain}`,
    `Admin     ${config.adminEmail}`,
    "",
    "Still to do in the app, when you need them:",
    "  Admin → Connections   an email provider, so sign-up and invitation emails go out",
    "  Admin → Email         the address they come from",
  ].join("\n"),
  "Production",
);
p.log.warn(`Keep a copy of .env.production somewhere safe.`);
p.outro("From here, a push to main deploys.");
process.exit(0);
