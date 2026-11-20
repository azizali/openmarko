// What the setup commands share: running other programs, and asking questions. `--answers file.json` takes the answers
// from a file instead of a terminal, for rerunning a setup or testing one.
import * as p from "@clack/prompts";
import { parseArgs } from "node:util";

export const root = `${import.meta.dir}/../..`;

const { values } = parseArgs({ options: { answers: { type: "string" } }, strict: false });
const fromFile: Record<string, unknown> | null = values.answers ? await Bun.file(String(values.answers)).json() : null;

export const scripted = fromFile !== null;

function answer<T>(value: T | symbol): T {
  if (p.isCancel(value)) {
    p.cancel("Stopped. Nothing further was changed.");
    process.exit(1);
  }
  return value as T;
}
const given = <T>(key: string, fallback: T): T => (fromFile && key in fromFile ? (fromFile[key] as T) : fallback);

export const ask = {
  text: async (
    key: string,
    message: string,
    opts: { initial?: string; validate?: (v: string) => string | undefined } = {},
  ): Promise<string> =>
    fromFile
      ? given(key, opts.initial ?? "")
      : answer<string>(await p.text({ message, initialValue: opts.initial, validate: (v) => opts.validate?.(v ?? "") })),
  secret: async (key: string, message: string, validate?: (v: string) => string | undefined): Promise<string> =>
    fromFile ? given(key, "") : answer<string>(await p.password({ message, validate: (v) => validate?.(v ?? "") })),
  yes: async (key: string, message: string, initial = true): Promise<boolean> =>
    fromFile ? given(key, false) : answer<boolean>(await p.confirm({ message, initialValue: initial })),
  some: async <T extends string>(
    key: string,
    message: string,
    options: { value: T; label: string; hint?: string }[],
    initial: T[],
  ): Promise<T[]> =>
    fromFile
      ? given<T[]>(key, initial)
      : answer<T[]>(await p.multiselect({ message, options: options as never, initialValues: initial, required: false })),
};

export const required = (what: string) => (v: string) => (v.trim() ? undefined : `${what} is needed.`);
export const anEmail = (v: string) => (/^\S+@\S+\.\S+$/.test(v) ? undefined : "That isn't an email address.");

export function stop(message: string): never {
  p.log.error(message);
  p.outro("Stopped.");
  process.exit(1);
}

type RunOptions = { env?: Record<string, string>; stdin?: string; cwd?: string };

/** Runs a program and captures its output. Never throws for a failing exit. */
export function capture(cmd: string[], opts: RunOptions = {}): { ok: boolean; out: string; err: string } {
  try {
    const r = Bun.spawnSync(cmd, {
      cwd: opts.cwd ?? root,
      env: opts.env ?? (process.env as Record<string, string>),
      stdin: opts.stdin === undefined ? "ignore" : Buffer.from(opts.stdin),
    });
    return { ok: r.exitCode === 0, out: r.stdout.toString().trim(), err: r.stderr.toString().trim() };
  } catch (e) {
    return { ok: false, out: "", err: (e as Error).message };
  }
}

/** Runs a step with a spinner, and stops the whole command, showing the program's output, if it fails. */
export function step(label: string, cmd: string[], opts: RunOptions = {}): string {
  const s = p.spinner();
  s.start(label);
  const r = capture(cmd, opts);
  if (!r.ok) {
    s.stop(`${label}: failed`);
    stop([r.out, r.err].filter(Boolean).join("\n") || `${cmd[0]} failed`);
  }
  s.stop(label);
  return r.out;
}

export const hasProgram = (name: string) => Bun.which(name) !== null;

export const modelVendors = [
  { value: "anthropic", label: "Anthropic" },
  { value: "openai", label: "OpenAI", hint: "also embeddings, for knowledge bases" },
  { value: "google", label: "Google AI", hint: "also embeddings, for knowledge bases" },
  { value: "openrouter", label: "OpenRouter" },
] as const;
export type ModelVendor = (typeof modelVendors)[number]["value"];

/** Asks which model vendors to connect, and each one's key. Vendors are in the order they'll be connected. */
export async function askModelKeys(): Promise<{ vendor: ModelVendor; key: string }[]> {
  const chosen = await ask.some<ModelVendor>(
    "vendors",
    "Connect real AI models? (none: chat answers with made-up text)",
    [...modelVendors],
    [],
  );
  const out: { vendor: ModelVendor; key: string }[] = [];
  for (const vendor of chosen) out.push({ vendor, key: await ask.secret(`${vendor}Key`, `${vendor} API key`, required("The key")) });
  return out;
}
