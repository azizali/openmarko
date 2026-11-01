import type { CapabilityId, ProviderId } from "@openmarko/shared";
import type { Config } from "@openmarko/kernel";
import type { Mode } from "../mode";

/** What an adapter gets for one call. `secrets` decrypts lazily, so stubs never touch credentials. */
export type CallContext = {
  mode: Mode;
  /** The provider this call goes to (an adapter can serve several, e.g. the LLM adapter). */
  provider: ProviderId;
  externalId: string | null;
  secrets: () => Promise<Record<string, string>>;
  /** The connection's non-secret settings (from the provider's fields). */
  settings: Record<string, string>;
  /** Platform-level OAuth client settings some adapters need (Google refresh). From config, never the request. */
  google: Config["google"];
};

export type CallResult<T = unknown> = {
  output: T;
  /** Units the provider billed for (requests, tokens, messages). Used for metering. */
  quantity: number;
  /** What the call cost us, in micros (millionths of a dollar). */
  costMicros: number;
};

export type Adapter = {
  provider: ProviderId;
  /** Capabilities this adapter implements. */
  capabilities: CapabilityId[];
  /** Units a call is expected to use, before it runs. Checked against the Plan's allowance. */
  estimate?: (capability: CapabilityId, input: any) => number;
  call: (capability: CapabilityId, input: any, ctx: CallContext) => Promise<CallResult<any>>;
};
