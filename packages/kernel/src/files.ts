import { rm } from "node:fs/promises";
import { join, resolve, sep } from "node:path";
import type { Config } from "./config";

// Files kept outside the database: on a disk folder, or in an S3-compatible bucket (AWS S3, Cloudflare R2, MinIO).
// Which one is configuration (FILES_DIR or FILES_S3_*); with neither, `ctx.files` is null and nothing that would be
// kept is (ADR 0035). Keys are paths with forward slashes, e.g. `originals/dataforseo/2026-11-23/<id>.json.gz`.

export type FileStore = {
  /** Where files go, for logs and docs: `disk:/path` or `s3:bucket`. */
  where: string;
  put: (key: string, bytes: Uint8Array, contentType: string) => Promise<void>;
  /** The file's bytes, or null when there's no such file. */
  get: (key: string) => Promise<Uint8Array | null>;
  /** Deletes these files; one that isn't there is fine. */
  delete: (keys: string[]) => Promise<void>;
};

export type FilesConfig =
  | { kind: "disk"; dir: string }
  | { kind: "s3"; bucket: string; endpoint: string | null; region: string | null; accessKeyId: string; secretAccessKey: string };

/** A key can't climb out of its folder or bucket prefix. */
function checkKey(key: string): string {
  if (!key || key.startsWith("/") || key.split("/").some((p) => p === "" || p === "." || p === ".."))
    throw new Error(`Not a file key: "${key}"`);
  return key;
}

export function diskStore(dir: string): FileStore {
  const root = resolve(dir);
  const pathOf = (key: string) => {
    const p = join(root, ...checkKey(key).split("/"));
    if (!p.startsWith(root + sep)) throw new Error(`Not a file key: "${key}"`);
    return p;
  };
  return {
    where: `disk:${root}`,
    put: async (key, bytes) => {
      await Bun.write(pathOf(key), bytes); // makes the folders it needs
    },
    get: async (key) => {
      const f = Bun.file(pathOf(key));
      return (await f.exists()) ? new Uint8Array(await f.arrayBuffer()) : null;
    },
    delete: async (keys) => {
      await Promise.all(keys.map((k) => rm(pathOf(k), { force: true })));
    },
  };
}

export function s3Store(c: Extract<FilesConfig, { kind: "s3" }>): FileStore {
  const client = new Bun.S3Client({
    bucket: c.bucket,
    accessKeyId: c.accessKeyId,
    secretAccessKey: c.secretAccessKey,
    ...(c.endpoint ? { endpoint: c.endpoint } : {}),
    ...(c.region ? { region: c.region } : {}),
  });
  return {
    where: `s3:${c.bucket}`,
    put: async (key, bytes, contentType) => {
      await client.write(checkKey(key), bytes, { type: contentType });
    },
    get: async (key) => {
      const f = client.file(checkKey(key));
      return (await f.exists()) ? new Uint8Array(await f.arrayBuffer()) : null;
    },
    delete: async (keys) => {
      await Promise.all(keys.map((k) => client.delete(checkKey(k))));
    },
  };
}

/** For tests: files in memory. */
export function memoryStore(): FileStore & { files: Map<string, Uint8Array> } {
  const files = new Map<string, Uint8Array>();
  return {
    where: "memory",
    files,
    put: async (key, bytes) => void files.set(checkKey(key), bytes),
    get: async (key) => files.get(checkKey(key)) ?? null,
    delete: async (keys) => keys.forEach((k) => files.delete(k)),
  };
}

export function createFileStore(cfg: Pick<Config, "files">): FileStore | null {
  if (!cfg.files) return null;
  return cfg.files.kind === "disk" ? diskStore(cfg.files.dir) : s3Store(cfg.files);
}
