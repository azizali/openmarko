// Envelope encryption for provider secrets (ADR 0010).
// Each secret gets its own random data key. The data key is wrapped with the
// master key for the current version, which never sits in the database.
import { createCipheriv, createDecipheriv, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

export type Sealed = {
  /** nonce(12) | tag(16) | ciphertext, AES-256-GCM with the data key. */
  ciphertext: Buffer;
  /** nonce(12) | tag(16) | data key, AES-256-GCM with the master key. */
  wrappedKey: Buffer;
  keyVersion: number;
};

export type MasterKeys = { current: number; keys: Record<number, Buffer> };

export function masterKeysFrom(cfg: { masterKeyCurrent: string; masterKeys: Record<string, string> }): MasterKeys {
  const keys: Record<number, Buffer> = {};
  for (const [v, b64] of Object.entries(cfg.masterKeys)) keys[Number(v)] = Buffer.from(b64, "base64");
  const current = Number(cfg.masterKeyCurrent);
  if (!keys[current]) throw new Error(`MASTER_KEY_V${current} is not set`);
  for (const [v, k] of Object.entries(keys)) if (k.length !== 32) throw new Error(`MASTER_KEY_V${v} must be 32 bytes (base64)`);
  return { current, keys };
}

function seal(key: Buffer, plain: Buffer): Buffer {
  const nonce = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", key, nonce);
  const body = Buffer.concat([c.update(plain), c.final()]);
  return Buffer.concat([nonce, c.getAuthTag(), body]);
}

function open(key: Buffer, blob: Buffer): Buffer {
  const nonce = blob.subarray(0, 12);
  const tag = blob.subarray(12, 28);
  const body = blob.subarray(28);
  const d = createDecipheriv("aes-256-gcm", key, nonce);
  d.setAuthTag(tag);
  return Buffer.concat([d.update(body), d.final()]);
}

export function encryptSecret(mk: MasterKeys, plaintext: string): Sealed {
  const dataKey = randomBytes(32);
  const masterKey = mk.keys[mk.current]!;
  return {
    ciphertext: seal(dataKey, Buffer.from(plaintext, "utf8")),
    wrappedKey: seal(masterKey, dataKey),
    keyVersion: mk.current,
  };
}

export function decryptSecret(mk: MasterKeys, sealed: Sealed): string {
  const masterKey = mk.keys[sealed.keyVersion];
  if (!masterKey) throw new Error(`master key version ${sealed.keyVersion} is not configured`);
  const dataKey = open(masterKey, sealed.wrappedKey);
  return open(dataKey, sealed.ciphertext).toString("utf8");
}

/** Re-wraps the data key under the current master key. The secret itself is untouched (ADR 0010 rotation). */
export function rewrap(mk: MasterKeys, sealed: Sealed): Sealed {
  if (sealed.keyVersion === mk.current) return sealed;
  const dataKey = open(mk.keys[sealed.keyVersion]!, sealed.wrappedKey);
  return { ...sealed, wrappedKey: seal(mk.keys[mk.current]!, dataKey), keyVersion: mk.current };
}

/** Compares two secrets in constant time, so the comparison can't leak how much of a guess was right. */
export function safeEqual(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b) return false;
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

/** HMAC-SHA256 of a body, hex. Used to check signed webhooks. */
export function hmacHex(secret: string, body: string): string {
  return createHmac("sha256", secret).update(body).digest("hex");
}
