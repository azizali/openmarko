import { afterAll, describe, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { diskStore } from "../src";

const dir = await mkdtemp(join(tmpdir(), "files-"));
afterAll(() => rm(dir, { recursive: true, force: true }));

describe("disk file store", () => {
  const store = diskStore(dir);

  test("puts, gets and deletes a file, making its folders", async () => {
    await store.put("a/b/c.txt", new TextEncoder().encode("hello"), "text/plain");
    expect(new TextDecoder().decode((await store.get("a/b/c.txt"))!)).toBe("hello");
    await store.delete(["a/b/c.txt", "not/there.txt"]);
    expect(await store.get("a/b/c.txt")).toBeNull();
  });

  test("a key can't climb out of its folder", async () => {
    for (const key of ["../x", "a/../../x", "/etc/passwd", "a//b", ""])
      await expect(store.put(key, new Uint8Array(), "text/plain")).rejects.toThrow("Not a file key");
  });
});
