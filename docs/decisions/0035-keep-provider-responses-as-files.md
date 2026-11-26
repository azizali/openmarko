# 0035. Keep providers' untrimmed responses as files

- Status: Accepted
- Date: 2026-11-23
- Affects: kernel, integrations, seo, deploy

## Context

DataForSEO answers with far more than we read. An adapter turns each response into our own small shape (an organic result becomes positions, "map pack shown", "AI Overview shown and who it cites") and the rest is dropped: the businesses inside the map pack, the AI Overview's text, featured snippets, ads, results past the first page. The SEO module also keeps that small shape for 30 days (`seo.provider_tasks.raw`), for re-reading after a parser fix, but a field we never parsed can't be recovered from it. A column we decide to show next year would only fill from the next check, never for the past ones.

The responses are large (tens to hundreds of kilobytes each, thousands a week per Location), which doesn't suit Postgres rows.

## Decision

1. **The kernel has a file store** (`packages/kernel/src/files.ts`, `ctx.files`): `put`, `get`, `delete` on keys like `originals/dataforseo/2026-11-23/<id>.json.gz`. It's an S3-compatible bucket when `FILES_S3_*` are set (AWS S3, Cloudflare R2, MinIO, through Bun's S3 client), a folder when `FILES_DIR` is, and in development `.data/files` by default. With neither, `ctx.files` is null and nothing is kept, the same "missing values turn it off" rule as other services.
2. **Adapters hand over what's worth keeping; `invoke()` keeps it.** A live call's context has `keep({ ref, body })`. The DataForSEO adapter calls it for every task that comes back with results, with DataForSEO's task id as `ref` and the task as it came. `invoke()` writes each as gzipped JSON and records it in `integrations.provider_originals` (provider, capability, ref, Organization, file key, size). Stubs keep nothing, and keeping never fails the call: an error is logged.
3. **They're kept `PROVIDER_ORIGINALS_DAYS` (default 400)**, so a year-on-year comparison can still be read. `0` keeps them for good. A daily job (`integrations.prune-originals`) deletes older files, then their rows.
4. Reading one back is `readOriginal(ctx, provider, ref)`. For a check, `ref` is DataForSEO's task id inside `seo.provider_tasks.external_task_id` (after `|`, or after `live_` for an answer that came back at once).

## Consequences

- A new column from data we already pay for can be filled backwards: re-read the kept responses for the past 400 days instead of waiting for new checks.
- Production keeps nothing until a bucket (or a mounted folder) is configured. A folder inside the container is lost on each deploy; use a bucket or a Kamal volume.
- Storage is cheap but not free: roughly 10 to 50 KB a response gzipped. At 0.015 USD per GB a month (R2), a busy Location's year is cents.
- Only DataForSEO opts in. Model calls and email aren't kept: they carry people's words, and there's nothing in them we'd want to read later.
- The kept files hold only what the provider returned about public search results; they're deleted on schedule, and their rows lose their Organization when it's deleted.
