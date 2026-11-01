import { describe, expect, test } from "bun:test";
import { decryptSecret, encryptSecret, masterKeysFrom, rewrap } from "../src/crypto";
import { randomBytes } from "node:crypto";

const key = () => randomBytes(32).toString("base64");

describe("envelope encryption (ADR 0010)", () => {
  test("round-trips a secret and never stores it in the clear", () => {
    const mk = masterKeysFrom({ masterKeyCurrent: "1", masterKeys: { "1": key() } });
    const sealed = encryptSecret(mk, "refresh-token-abc");
    expect(sealed.ciphertext.toString("utf8")).not.toContain("refresh-token-abc");
    expect(decryptSecret(mk, sealed)).toBe("refresh-token-abc");
  });

  test("two encryptions of the same secret differ (fresh data key and nonce each time)", () => {
    const mk = masterKeysFrom({ masterKeyCurrent: "1", masterKeys: { "1": key() } });
    const a = encryptSecret(mk, "same");
    const b = encryptSecret(mk, "same");
    expect(a.ciphertext.equals(b.ciphertext)).toBe(false);
    expect(a.wrappedKey.equals(b.wrappedKey)).toBe(false);
  });

  test("tampering with the ciphertext fails authentication", () => {
    const mk = masterKeysFrom({ masterKeyCurrent: "1", masterKeys: { "1": key() } });
    const sealed = encryptSecret(mk, "secret");
    sealed.ciphertext[sealed.ciphertext.length - 1]! ^= 0xff;
    expect(() => decryptSecret(mk, sealed)).toThrow();
  });

  test("rotation: rewrap moves the data key to the new master key, and the old key is no longer needed", () => {
    const old = key();
    const next = key();
    const v1 = masterKeysFrom({ masterKeyCurrent: "1", masterKeys: { "1": old } });
    const sealed = encryptSecret(v1, "rotate me");
    const v2 = masterKeysFrom({ masterKeyCurrent: "2", masterKeys: { "1": old, "2": next } });
    const moved = rewrap(v2, sealed);
    expect(moved.keyVersion).toBe(2);
    expect(decryptSecret(masterKeysFrom({ masterKeyCurrent: "2", masterKeys: { "2": next } }), moved)).toBe("rotate me");
  });

  test("refuses a master key that isn't 32 bytes", () => {
    expect(() => masterKeysFrom({ masterKeyCurrent: "1", masterKeys: { "1": Buffer.alloc(8).toString("base64") } })).toThrow("32 bytes");
  });
});
