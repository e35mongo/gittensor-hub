// Single source of truth for classifying a repo's pull requests into the four
// mutually-exclusive status buckets the dashboard shows. The list `state`
// filter, the `state_counts` aggregation, and the `sort=state` ordering all
// derive from here so they can never drift apart.
//
// The buckets follow PullStatusBadge's precedence (merged → draft → open →
// closed): a PR is classified by the FIRST matching rule, so a draft that was
// closed without ever merging is a `draft`, never a `closed`.
//
//   merged = merged = 1
//   draft  = not merged AND draft = 1                  (open OR closed drafts)
//   open   = not merged AND not draft AND state = 'open'
//   closed = not merged AND not draft AND state = 'closed'
//
// Because the predicates are disjoint and cover every PR (GitHub PR state is
// only 'open' or 'closed', and a merged PR is never still a draft), the four
// counts always sum to the total. Previously `closed` was written as just
// `state = 'closed' AND merged = 0`, which ALSO matched closed drafts — so a
// closed draft was double-counted against `draft`, inflated `state_counts`, and
// surfaced under the Closed filter even though its badge read "Draft".

export type PullBucket = 'open' | 'draft' | 'merged' | 'closed';

// Bucket display/iteration order — also the order `state_counts` emits columns.
export const PULL_BUCKETS: readonly PullBucket[] = ['open', 'draft', 'merged', 'closed'];

/**
 * SQL boolean predicate over the `pulls` columns (`state` / `draft` / `merged`)
 * that is true for exactly the rows in `bucket`. The predicates are mutually
 * exclusive. Inputs are developer-controlled constants — never user input.
 */
export function pullBucketPredicate(bucket: PullBucket): string {
  switch (bucket) {
    case 'merged':
      return 'merged = 1';
    case 'draft':
      return 'merged = 0 AND draft = 1';
    case 'open':
      return "merged = 0 AND draft = 0 AND state = 'open'";
    case 'closed':
      return "merged = 0 AND draft = 0 AND state = 'closed'";
  }
}

/**
 * `SUM(CASE WHEN <predicate> THEN 1 ELSE 0 END) AS <bucket>` columns for all
 * four buckets, for the `state_counts` aggregation `SELECT`.
 */
export function pullBucketSums(): string {
  return PULL_BUCKETS.map(
    (b) => `SUM(CASE WHEN ${pullBucketPredicate(b)} THEN 1 ELSE 0 END) AS ${b}`,
  ).join(',\n         ');
}

/**
 * `CASE … END` expression ranking rows by bucket precedence
 * (merged 0 → draft 1 → open 2 → closed 3) for `ORDER BY state`. Matches the
 * partition above so the sort, the filter, and the counts agree.
 */
export function pullBucketRankSql(): string {
  return `CASE
      WHEN ${pullBucketPredicate('merged')} THEN 0
      WHEN ${pullBucketPredicate('draft')} THEN 1
      WHEN ${pullBucketPredicate('open')} THEN 2
      ELSE 3 END`;
}
