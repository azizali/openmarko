# SEO schema

Status: **built** in `modules/seo/src/schema.ts`, migrations `0000` (initial tables) and `0002` (grid, review requests, backlinks). Baseline conventions are in [schema.md](schema.md). This file lists the SEO tables as the database has them.

All tables live in the `seo` schema. Every row carries `organization_id` (text, the Organization's Better Auth id) with a cascade on delete, so hard-deleting an Organization removes all of its SEO data. Our own row ids are UUIDv7.

## Tables by feature

| Feature | Table | Key columns | Written by | Grows |
|---|---|---|---|---|
| Business Profile | `profile_insights` | `location_id`, `day` (unique with location), `calls`, `directions`, `searches` | `seo.profile-sync` job | one row per Location per day |
| Reviews | `reviews` | `location_id`, `external_id` (Google's review name, unique with location), `rating`, `text`, `author`, `reviewed_at`, `reply`, `replied_at` | `profile.ts` (sync), review reply Task | with reviews received |
| Rankings | `keywords` | `location_id`, `term` (unique with location), `active` | rankings service | slowly |
| Rankings | `competitors` | `location_id`, `name` (unique with location), `domain` | rankings service | slowly |
| Rankings | `rank_snapshots` | `keyword_id`, `organic_rank`, `map_rank`, `top_domain`, `run_id`, `checked_at` | rank scan job | **every scan**, partitioned by month on `checked_at` |
| Rankings | `grid_scans` | `location_id`, `keyword`, `size`, `step_km`, `run_id` | grid scan job | per scan |
| Rankings | `grid_points` | `scan_id`, `row`, `col`, `lat`, `lng`, `rank` | grid scan job | `size²` per scan |
| AI answers | `ai_questions` | `location_id`, `text` (unique with location), `active` | AI answers service | slowly |
| AI answers | `ai_answers` | `question_id`, `engine`, `listed` (jsonb list of names), `mentioned`, `run_id`, `checked_at` | AI check job | per question per check |
| Site health | `audits` | `website_id`, `status`, `pages_crawled`, `run_id` | audit job | per audit |
| Site health | `audit_issues` | `audit_id`, `rule`, `severity`, `url`, `detail` | audit job | per issue |
| Citations | `citations` | `location_id`, `directory` (unique with location), `status` (`found` / `missing`), `url`, `checked_at` | citation job | one row per directory per Location |
| Citations & backlinks | `backlinks` | `website_id`, `source_domain` (unique with website), `url`, `first_seen_at`, `last_seen_at`, `lost_at` | backlink job | per referring domain; links that disappear are kept with `lost_at` |
| Articles | `articles` | `website_id`, `keyword`, `title`, `body`, `status` (`draft` / `published`), `created_by`, `published_at` | articles service | per article |
| Review requests | `review_requests` | `location_id`, `recipient_email`, `recipient_name`, `status`, `message_id`, `created_by` | review requests service | per request sent |

## Rules the schema keeps

- **One Location, one Google Business Profile.** The Location holds the profile id (organizations schema). Reviews, insights and profile edits are keyed by Location.
- **A website is a domain.** Audits, backlinks and site fixes key on `website_id`. A Google Business Profile's website link may be a deep link; it is stored on the Location for display and never audited (see [ADR 0011](../../decisions/0011-partner-is-an-organization-row.md) and the organizations domain rules).
- **Nothing is deleted when the source changes.** A lost backlink keeps its row with `lost_at`. Citations and reviews are updated in place; snapshots are never overwritten.
- **Uniqueness that stops double work:** one review per Location and Google review name; one keyword per Location; one audit issue fix per open Task (automation `tasks_open_source`).

## Growth

- `rank_snapshots` gets one row per keyword per scan. It is the table that grows fastest, and it is partitioned by month from migration `0000` (`seo.rank_snapshots_default` catches anything outside the created months; `automation.partitions` creates the next months each day).
- `grid_points` is `size²` rows per grid scan. A 5×5 scan is 25 rows and 25 billed requests. Keep scans on demand or on a schedule the owner pays for.
- `ai_answers` gets one row per question per engine per check.

## Not in the schema yet

- Partitioning for `grid_points`, `ai_answers` and `audit_issues`. Add when their volume is known (the same pattern as `rank_snapshots`).
- Google Business Profile insights are one row per day; the live Performance API adapter isn't run yet.
