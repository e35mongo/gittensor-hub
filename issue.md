---
name: Bug Report
about: Report a bug or unexpected behavior
title: "[Bug] HTTP-path callers bypass in-flight deduplication, causing concurrent redundant GitHub fetches and PAT quota drain"
labels: bug
---

## Description

The application has no per-route, per-user, or per-IP **concurrent-request cap or in-flight deduplication layer** at the HTTP boundary. Every authenticated API route executes unconditionally on every call — there is no guard against the same client hammering the same route dozens of times before any response returns.

This is critical because several routes are **not idempotent under concurrency**:

- `GET /api/repos/[owner]/[name]/issues` and `/pulls` each call `refreshIssuesIfStale` / `refreshPullsIfStale`, which consult `repo_meta` timestamps, then fire GitHub Octokit fetches and chunked SQLite upserts. The in-flight deduplication (`inFlightIssues` / `inFlightPulls` in `src/lib/refresh.ts`) only deduplicates **within** the poller process — it does **not** gate concurrent HTTP handlers that independently enter `refreshIssuesIfStale` before any of them have written the `last_issues_fetch` timestamp.
- `GET /api/repos/[owner]/[name]/owner-comments` triggers `refreshCommentsIfStale`, which fetches and writes `issue_comments` rows. Multiple simultaneous calls to this route fan out multiple GitHub fetches for the same repo simultaneously, burning PAT quota and risking duplicate-upsert write contention on the writer connection.
- `GET /api/gt/repos/[owner]/[name]/health`, `/contributors`, `/readme`, `/contents` proxy live GitHub REST calls with no caching TTL enforced at the HTTP layer — these are fully passthrough on every hit, exhausting the shared PAT pool when a user opens multiple tabs or a browser pre-fetches routes.
- The `/api/repo-activity` route (POST with GET fallback) has no idempotency guard; two concurrent requests for the same repo fire two independent `octokit.paginate` chains that both write to `repo_badges`.

The current codebase has only timestamp-based staleness guards at the **database row level** (`repo_meta.last_issues_fetch`, etc.), which are read under the **reader connection** and compared before deciding to fetch. But because the reader sees the WAL snapshot from before the writer's in-flight transaction, concurrent HTTP handlers all read the old timestamp simultaneously, all conclude "stale", and all fire redundant GitHub fetches in parallel before any of them commits the new timestamp.

The planned `src/lib/ttl-map.ts` module (visible in the open file list but absent from the repository) appears to be the intended fix for this — a shared, process-level in-memory TTL map that can gate both poller and HTTP-path callers. Without it the deduplication gap is only half-closed.

## Steps to Reproduce

1. Open two browser tabs simultaneously, both navigating to `/explorer?repo=<any-heavy-repo>`.
2. Observe in server logs: `refreshIssuesIfStale` is entered twice concurrently for the same repo, both see a stale timestamp, both call `fetchIssuesFromGithub`, and both attempt chunked upserts to the writer.
3. Run `wrk -t4 -c20 -d10s http://localhost:12074/api/repos/owner/name/issues` (any load tool) while watching the GitHub rate-limit endpoint at `/api/rate-limit` — PAT `coreRemaining` drops at 2–4× the expected rate.
4. Open the Network tab in DevTools, navigate to `/explorer`, and immediately switch to another repo tab before the first finishes loading — the stale comment-refresh for the first repo continues to run in the background even as a new one starts for the second.

## Expected Behavior

A process-level TTL map (keyed on `"${owner}/${name}:issues"`, `"${owner}/${name}:pulls"`, `"${owner}/${name}:comments"`) prevents any HTTP handler from entering a fetch if the key is either **in-flight** or **fresh within the last N seconds**. The deduplication is enforced at the entry point of the refresh helpers, not just in the poller.

All API routes that proxy live GitHub calls (`/health`, `/readme`, `/contents`, `/contributing`) carry a short-lived (e.g., 60–120 s) response-level TTL so repeated calls within the window return the cached value without touching Octokit.

## Actual Behavior

- Concurrent navigations to the same repo trigger 2–N simultaneous GitHub fetches for the same data.
- No shared in-flight set exists at the HTTP-handler level; `inFlightIssues` / `inFlightPulls` in `src/lib/refresh.ts` are populated **after** entering the async fetch, so a second concurrent caller entering before the first `await` completes passes the guard.
- PAT `coreRemaining` drains proportionally to the number of concurrent users and open browser tabs, not to the number of distinct repos being viewed.
- On a high-traffic instance, the writer connection accumulates backpressure from duplicate chunked transactions, increasing latency for all readers.

## Environment

- Browser: any (reproduces server-side; not browser-specific)
- OS: Linux (production PM2 deployment via `ecosystem.config.js`)
- Node version: 20+ (Next.js 15 App Router, `runtime = 'nodejs'` middleware)

## Files Affected

This fix requires coordinated changes across the following files and likely introduces `src/lib/ttl-map.ts` as a new shared module:

| File | Change Required |
|------|----------------|
| `src/lib/ttl-map.ts` | **New file.** Export a generic `TtlMap<K>` class (or `createTtlMap`) backed by a `Map<K, number>` storing expiry timestamps. Methods: `has(key)`, `set(key, ttlMs)`, `delete(key)`, `isInFlight(key)`, `markInFlight(key)` / `clearInFlight(key)`. Entries auto-expire without a separate `setInterval` (lazy eviction on `has`). |
| `src/lib/refresh.ts` | Replace the bare `Set<string>` / `Map<string, number>` in-flight guards (`inFlightIssues`, `inFlightPulls`, `lastLinkedPrsFetch`, `lastCommentsFetch`) with a shared `TtlMap` instance imported from `ttl-map.ts`. Gate HTTP-path callers with the same map that the poller uses. |
| `src/lib/github.ts` | Add a process-level `TtlMap` for proxied "passthrough" calls (health, readme, contents, contributing). Cache the raw JSON response keyed on `"${method}:${url}"` for 60–120 s and return the cached value if still fresh. |
| `src/app/api/repos/[owner]/[name]/issues/route.ts` | Before calling `refreshIssuesIfStale`, check the shared in-flight map. Return 202 with a `Retry-After` header if a fetch is already running for this repo, so the client can poll instead of hammering. |
| `src/app/api/repos/[owner]/[name]/pulls/route.ts` | Same as above for pulls. |
| `src/app/api/repos/[owner]/[name]/owner-comments/route.ts` | Gate `refreshCommentsIfStale` behind the shared map. |
| `src/app/api/gt/repos/[owner]/[name]/health/route.ts` | Wrap the Octokit call in a TTL cache; serve stale value on cache hit. |
| `src/app/api/gt/repos/[owner]/[name]/readme/route.ts` | Same as health. |
| `src/app/api/gt/repos/[owner]/[name]/contents/route.ts` | Same as health. |
| `src/app/api/gt/repos/[owner]/[name]/contributing/route.ts` | Same as health. |
| `src/app/api/repo-activity/route.ts` | Add an in-flight guard keyed on `repo_full_name` before initiating the paginate chain. |
| `src/app/api/repos/[owner]/[name]/badges/route.ts` | Short-circuit on fresh TTL entry to avoid re-reading counts from DB on every poll cycle from the sidebar watcher. |
| `src/types/entities.ts` | Add `RetryAfterResponse` type (`{ retryAfter: number }`) for 202 responses. |
| `src/app/api/api-types.ts` | Export the new `RetryAfterResponse` shape and a shared `IN_FLIGHT_RETRY_SECONDS` constant. |

## Additional Context

The open file `src/lib/ttl-map.ts` (listed in the IDE but not yet committed) confirms this work was anticipated. The issue is that partial in-flight guards exist inside `refresh.ts` but are not reachable from HTTP-path callers, so any two browser tabs or polling intervals that arrive within the same millisecond window bypass the guard entirely.

Related to — but distinct from — open issue #211 (pagination contract + bounded TTL caches for list responses): that issue targets response-body size bounds; this issue targets **request-path fan-out** and PAT quota drain caused by concurrent callers. The fix here is the prerequisite for issue #211's TTL cache to be coherent: without a shared in-flight map, even a bounded TTL cache can be populated with N simultaneous identical fetches on a cold key.

The `TtlMap` module should be designed so it can later be extracted to a worker-thread-safe store (e.g. backed by a SQLite in-memory table or a shared `ArrayBuffer` via `SharedArrayBuffer` + `Atomics`) if the app ever moves to a multi-worker PM2 cluster. For now, a module-level singleton is sufficient since PM2 runs one Node.js instance per `ecosystem.config.js`.
