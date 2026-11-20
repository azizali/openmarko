# 0019. A request is for the Project its key or its domain names

- Status: Superseded by [0022](0022-a-boilerplate-not-a-platform.md)
- Date: 2026-11-07
- Affects: platform/projects, platform/identity, platform/whitelabel
- Builds on: [0017](0017-one-backend-many-projects.md) (many Projects), [0004](0004-whitelabel-per-partner.md) (whitelabel), [0007](0007-backend-stack.md) (frontends forward `/api`)

## Context

One backend serves many Projects. Until piece 2.3, a request with no key went to a default Project (the oldest one), which was only a stopgap. Each Project needs its own API domain anyway: sign-in redirects, Stripe and provider webhooks, cookies and email links must not use the platform's address, or moving or selling a Project would break them. Partners' whitelabel hosts also need a Project, and something must check they're real before the platform requests a TLS certificate for them.

## Decision

1. **One table of hosts.** `platform.domains` holds every host the platform answers on: a Project's `api` domain (one), its `app` domains, and Partners' whitelabel hosts (`partner`). A host belongs to exactly one Project.
2. **Key first, then domain, never a default.** A request is for its key's Project. With no key, it is for the Project whose verified domain it arrived on. With neither, it gets a 404. A key presented on another Project's domain is a 401: a domain names one Project, so a mismatch is a mistake worth surfacing. Keys work on any host that isn't a Project's, which is how servers call the platform.
3. **A Project's addresses come from its API domain.** Each Project's Better Auth instance uses `https://<api domain>` as its base URL. A local host (`localhost`, `*.localhost`), or a Project with no API domain yet, uses the platform's `BETTER_AUTH_URL`.
4. **Origins follow domains.** A browser may call a Project from an origin it lists, or from an `https` page on one of its verified app or Partner domains. CORS and Better Auth's trusted origins both use this one rule; Better Auth checks it per request, so a newly verified Partner host works without a rebuild.
5. **Who verifies.** Operators add API and app domains, which count as verified at once: Operators control those hosts and list them in `deploy.yml`. Partners prove their hosts with a DNS TXT record, `_domain-verify.<host>` = `domain-verify=<token>`. The record name is neutral because Partners show it to their own clients.
6. **Certificates on demand.** `GET /tls/allowed?host=` answers 200 only for verified domains of active Projects. kamal-proxy calls it before issuing a certificate (`--tls-on-demand-url`, set per deploy).

## Consequences

- Every test request names its host. The test kit gives OpenMarko `localhost`, and the requester sends a Host header.
- Development has to register `localhost` for OpenMarko; the seed does it, from `BETTER_AUTH_URL`.
- Admin routes (`/api/v1/admin/*`) answer only on the platform's own host, the host of `BETTER_AUTH_URL` (added 2026-11-07: on a Project's or Partner's domain they are a 404, so customer-facing hosts expose nothing of the platform's administration). They are not tied to a Project: module gating skips them, and the admin Plan route names its Project in the body until 5.1.
- Behind a frontend that forwards `/api` (ADR 0007), the request arrives on the API domain, so that domain picks the Project. The brand route reads `x-forwarded-host` to find the Partner, which is safe because a brand is public.
- Better Auth's origin check, which it turns off under test runners, is switched on so tests exercise it.
- Moving a Project, to a new cell or a new owner, means pointing its domains elsewhere. Nothing stored refers to the platform's own address.
