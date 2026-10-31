# Site health: technical

## Code map

| File | Role |
|---|---|
| [pages/Audit.tsx](../../../ui-mock/src/pages/Audit.tsx) | `/audit` |
| [pages/AuditIssue.tsx](../../../ui-mock/src/pages/AuditIssue.tsx) | `/audit/:id` |
| [data/mock.ts](../../../ui-mock/src/data/mock.ts) | `auditSummary`, `AuditIssue` |

## Permissions (`site_health`)

view · fix (apply fixes to the website, publish tier).

## Real build

- DataForSEO On-Page: `task_post`, `summary/{id}`, `pages`, `lighthouse/live/json`. Weekly crawl.
- Fixes via WordPress REST (`site.write`: `updatePage`, `revert`), Yoast / Rank Math aware.
- Every applied change logged with a revert payload.
