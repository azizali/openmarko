# 0014. LLMs are an integration; the platform provides a default

- Status: Accepted
- Date: 2026-10-31
- Affects: platform/integrations, platform/brand-skills, platform/backend, marko (assistant)

## Context

The assistant, and later every writer feature (review replies, posts, articles), needs a language model. Some Organizations will bring their own provider and key; most won't. The owner supplies the default models.

## Decision

- **LLM access is a Capability**, `llm.complete` (and later `llm.embed`), like email or reviews ([0002](0002-capabilities-not-providers.md)). Providers are Anthropic, OpenAI, Google, and OpenRouter, plus later others. Each is a Provider with an adapter.
- **Bring your own key** is an ordinary Connection at the Organization (`max: one`), with its key encrypted as any credential ([0010](0010-envelope-encrypted-credentials.md)).
- **The platform default** is a Connection owned by the platform, with `target_type = 'platform'`. It uses keys the owner sets. If an Organization has no Connection for `llm.complete`, it uses the platform default. The owner's keys never leave the backend.
- **Which model for which job** is configuration: `core.settings` with `scope_type = 'platform' | 'organization'`, namespace `llm.routes`, e.g. `{ "assistant.chat": "claude-…", "reviews.draft": "…" }`. Changing a model is a settings change, not a deploy.
- Every call writes `usage_events` (tokens and cost), so usage is visible per Organization.
- **How AI use is sold is Plan configuration**, not code ([0012](0012-billing-module-and-plans-as-data.md)). A Plan sets, per meter, how much is included and what happens beyond it: block, charge per unit, or allow only with the Organization's own key. The owner will try different packages; no rule here is fixed.
- Stubs ([0013](0013-stub-or-live-providers.md)) apply: `PROVIDERS=stub` returns canned replies, so development never spends tokens.

## Consequences

- Features ask for `llm.complete`, never for a vendor. Switching or adding a provider needs no feature change.
- The platform default is a real Connection, so it shows in the same place as any other, with its status, and it can be rotated like any other.
- The assistant itself (chat, Skills, knowledge, tools, MCP) is a separate module in phase 3. This decision only covers the model access it will use.
- **Knowledge bases are context, not training.** Content an Organization adds about its business is retrieved and given to the model when relevant. No model is fine-tuned on it, and it is never shared with other Organizations. Covered in phase 3.
