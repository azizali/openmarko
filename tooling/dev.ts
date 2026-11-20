// `bun dev` starts everything: the API and the worker (watching for changes), the web app (http://localhost:5173)
// and the marketing site (http://localhost:5174). `bun dev api web` starts only those.
// Output is prefixed with each process's name; Ctrl-C stops them all.
import { join } from "node:path";

type Proc = { name: string; cmd: string[]; cwd?: string };

const root = join(import.meta.dir, "..");
const all: Proc[] = [
  { name: "api", cmd: ["bun", "--watch", "apps/api/src/index.ts"] },
  { name: "worker", cmd: ["bun", "--watch", "apps/worker/src/index.ts"] },
  { name: "web", cmd: ["bun", "run", "dev"], cwd: join(root, "apps/web") },
  { name: "site", cmd: ["bun", "run", "dev"], cwd: join(root, "apps/site") },
];
const wanted = process.argv.slice(2);
const procs = wanted.length ? all.filter((p) => wanted.includes(p.name)) : all;
if (!procs.length) {
  console.error(`Nothing to start. Names: ${all.map((p) => p.name).join(", ")}`);
  process.exit(1);
}

const width = Math.max(...procs.map((p) => p.name.length));
const children = procs.map((p) => {
  const child = Bun.spawn(p.cmd, { cwd: p.cwd ?? root, stdout: "pipe", stderr: "pipe", env: process.env });
  const label = `${p.name.padEnd(width)} |`;
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
