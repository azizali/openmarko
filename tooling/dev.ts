// `bun dev` starts everything: the API and the worker (watching for changes), the app (web), the marketing site
// and the mock (a clickable prototype, not the product). `bun dev api web` starts only the named ones.
// Each dev server has its own fixed port (strictPort in its Vite config), and the banner says what each one is.
// Output is prefixed with each process's label; Ctrl-C stops them all.
import { join } from "node:path";

type Proc = {
  name: string; // the argument `bun dev <name>` takes
  label: string; // the prefix on its output lines
  cmd: string[];
  cwd?: string;
  env?: Record<string, string>;
  url?: string; // what the banner shows for it
  role: string;
};

const APP_URL = "http://localhost:5173";
const SITE_URL = "http://localhost:5174";
const MOCK_URL = "http://localhost:5175";
const API_URL = "http://localhost:3000";

const root = join(import.meta.dir, "..");
const all: Proc[] = [
  {
    name: "api",
    label: "api",
    cmd: ["bun", "--watch", "apps/api/src/index.ts"],
    url: `${API_URL}/openapi`,
    role: "the API (docs at /openapi)",
  },
  { name: "worker", label: "worker", cmd: ["bun", "--watch", "apps/worker/src/index.ts"], role: "background jobs" },
  {
    name: "web",
    label: "app",
    cmd: ["bun", "run", "dev"],
    cwd: join(root, "apps/web"),
    url: APP_URL,
    role: "THE APP: sign-in, sign-up and the product",
  },
  {
    name: "site",
    label: "site",
    cmd: ["bun", "run", "dev"],
    cwd: join(root, "apps/site"),
    // Pinned so "Sign in" on the site always opens the app, whatever else is in the shell environment.
    env: { VITE_APP_URL: APP_URL },
    url: SITE_URL,
    role: "THE SITE: the marketing pages; its Sign in goes to the app",
  },
  {
    name: "mock",
    label: "mock",
    cmd: ["bun", "run", "dev"],
    cwd: join(root, "apps/mock"),
    url: MOCK_URL,
    role: "MOCK: a clickable prototype, not the product",
  },
];
const wanted = process.argv.slice(2);
const procs = wanted.length ? all.filter((p) => wanted.includes(p.name)) : all;
if (!procs.length) {
  console.error(`Nothing to start. Names: ${all.map((p) => p.name).join(", ")}`);
  process.exit(1);
}

const width = Math.max(...procs.map((p) => p.label.length));
console.log("Open in your browser:");
for (const p of procs) if (p.url) console.log(`  ${p.label.padEnd(width)}  ${p.url.padEnd(24)} ${p.role}`);
console.log("");

const children = procs.map((p) => {
  const child = Bun.spawn(p.cmd, {
    cwd: p.cwd ?? root,
    stdout: "pipe",
    stderr: "pipe",
    env: { ...process.env, ...p.env },
  });
  const label = `${p.label.padEnd(width)} |`;
  for (const stream of [child.stdout, child.stderr]) void prefix(stream, label);
  return child;
});

async function prefix(stream: ReadableStream<Uint8Array>, label: string) {
  const decoder = new TextDecoder();
  let buffered = "";
  for await (const chunk of stream) {
    buffered += decoder.decode(chunk, { stream: true });
    const lines = buffered.split("\n");
    buffered = lines.pop() ?? "";
    for (const line of lines) console.log(`${label} ${line}`);
  }
}

function stopAll() {
  for (const c of children) c.kill();
  process.exit(0);
}
process.on("SIGINT", stopAll);
process.on("SIGTERM", stopAll);
await Promise.race(children.map((c) => c.exited));
console.error("A process exited; stopping the rest.");
stopAll();
