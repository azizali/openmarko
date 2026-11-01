# 0010. Provider credentials are envelope-encrypted, apart from Connections

- Status: Accepted
- Date: 2026-10-31
- Affects: platform/integrations, platform/backend

## Context

Connections hold secrets that act for customers: Google OAuth refresh tokens, provider API keys. A leaked database dump must not expose them.

## Decision

- Each secret is encrypted with its own random **data key** (AES-256-GCM). The data key is encrypted ("wrapped") with a **master key** that never sits in the database: an env var now, a cloud KMS later.
- `integrations.credentials` stores the ciphertext, the wrapped key and the master key's version. It is a separate table from `integrations.connections`.
- Only provider adapters decrypt, and only at the moment they call the provider. Secrets never leave the backend.

## Consequences

- A database dump alone is useless.
- Rotating the master key re-wraps the small data keys, not every secret.
- Moving to KMS changes how the master key is fetched, not the schema.
- Connections can be listed and shown freely; credentials can't.
