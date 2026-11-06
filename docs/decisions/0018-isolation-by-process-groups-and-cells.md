# 0018. Isolation comes from process groups, cells and bulkheads, not microservices

- Status: Accepted
- Date: 2026-11-05
- Affects: platform/backend
- Builds on: [0008](0008-modules-by-feature.md) (modular monolith), [0017](0017-one-backend-many-projects.md) (many Projects)

## Context

With many Projects on one backend ([0017](0017-one-backend-many-projects.md)), one failing module or one busy Project must not take the others down. Microservices are one answer, but for a single developer they bring network calls between modules, distributed transactions, and many deploys.

Shopify shows the other answer: one modular codebase deployed as **pods**, each an isolated set of data stores holding a share of the shops. A spike on one shop strains its own pod, not every shop, and per-shop throttling protects neighbours inside a pod.

## Decision

Keep one codebase and one image, and isolate in three layers:

1. **Process groups.** The same image runs as several deployments, each with its own `ENABLED_MODULES`. Start with three: `api`, `api-ai` (chat streaming) and `worker`; split email or AI workers out only when one needs it. The router sends each path prefix to its group. A failure in the chatbot leaves sign-in and billing up.
2. **Cells.** A cell is a database plus its process groups. Every Project has a `cell`. Small Projects share one; a Project that grows or carries risk moves to its own cell (same image, its own database) through the Project export and import ([0017](0017-one-backend-many-projects.md)), then its domain is pointed at the new cell.
3. **Bulkheads inside a process.** Rate limits and concurrency caps per Project at the API and in the job queue; timeouts and circuit breakers on every provider call; a separate database pool per process group with statement timeouts; load shedding (an early 503) instead of unbounded queueing.

A module is split into its own service only when its runtime profile or trust level differs: running untrusted code, heavy ingestion, perhaps the chat gateway. The module boundaries (a Postgres schema per module, events through the outbox) keep that split contained.

## Consequences

- Process groups and cells are deploy configuration plus a small routing step; the modules don't change.
- Bulkheads are code, in shared places: a rate-limit plugin, a queue wrapper that reads `projectId` from every job, and one provider-call wrapper that every adapter goes through.
- Every job carries `projectId`.
- Process groups and the bulkheads come before the AI module, since chat traffic is the most likely to spike.
