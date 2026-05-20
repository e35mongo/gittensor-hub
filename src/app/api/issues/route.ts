import { NextRequest, NextResponse } from 'next/server';
import { getReadDb, IssueRow } from '@/lib/db';

export const dynamic = 'force-dynamic';

interface AggIssueRow extends IssueRow {
  repo_weight: number | null;
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const hasRepoFilter = url.searchParams.has('repos');
  const repoFilter = url.searchParams.get('repos');
  const repoList = repoFilter ? repoFilter.split(',').map((repo) => repo.trim()).filter(Boolean) : [];
  const repoWhere = repoList.length > 0 ? `LOWER(repo_full_name) IN (${repoList.map(() => '?').join(',')})` : null;
  const repoArgs = repoList.map((repo) => repo.toLowerCase());
  // Watcher mode: caller passes `?since=ISO` to receive only newly-cached
  // issues. Filters on first_seen_at so we surface anything the poller picked
  // up after the watcher's baseline, regardless of GitHub's created_at.
  const since = url.searchParams.get('since');
  const activitySince = url.searchParams.get('activity_since');

  if (hasRepoFilter && repoList.length === 0) {
    return NextResponse.json({ count: 0, repo_count: 0, issues: [] });
  }

  const db = getReadDb();
  const rows = since
    ? (db
        .prepare(
          `SELECT id, repo_full_name, number, title, NULL as body, state, state_reason,
                  author_login, author_association, labels, comments,
                  created_at, updated_at, closed_at, html_url, fetched_at, first_seen_at
           FROM issues
           WHERE first_seen_at > ?
             ${repoWhere ? `AND ${repoWhere}` : ''}
           ORDER BY first_seen_at DESC
           LIMIT 200`
        )
        .all(since, ...repoArgs) as IssueRow[])
    : activitySince
      ? (db
          .prepare(
            `SELECT id, repo_full_name, number, title, NULL as body, state, state_reason,
                    author_login, author_association, labels, comments,
                    created_at, updated_at, closed_at, html_url, fetched_at, first_seen_at
             FROM issues
             WHERE (COALESCE(created_at, '') >= ?
                OR COALESCE(updated_at, '') >= ?
                OR COALESCE(closed_at, '') >= ?)
               ${repoWhere ? `AND ${repoWhere}` : ''}
             ORDER BY COALESCE(closed_at, updated_at, created_at, first_seen_at) DESC
             LIMIT 5000`
          )
          .all(activitySince, activitySince, activitySince, ...repoArgs) as IssueRow[])
    : (db
        .prepare(
          `SELECT id, repo_full_name, number, title, NULL as body, state, state_reason,
                  author_login, author_association, labels, comments,
                  created_at, updated_at, closed_at, html_url, fetched_at, first_seen_at
           FROM issues
           ${repoWhere ? `WHERE ${repoWhere}` : ''}
           ORDER BY updated_at DESC
           LIMIT 2000`
        )
        .all(...repoArgs) as IssueRow[]);

  const filtered = rows;

  const repoCount = new Set(filtered.map((r) => r.repo_full_name)).size;
  const linkedPrsByIssue = new Map<string, Array<{
    number: number;
    title: string;
    state: string;
    draft: number;
    merged: number;
    author_login: string | null;
    closed_at: string | null;
    merged_at: string | null;
    html_url: string | null;
  }>>();

  if (filtered.length > 0) {
    const repoNames = Array.from(new Set(filtered.map((r) => r.repo_full_name)));
    const repoPlaceholders = repoNames.map(() => '?').join(',');
    const wanted = new Set(filtered.map((r) => `${r.repo_full_name.toLowerCase()}#${r.number}`));
    const linkRows = db
      .prepare(
        `SELECT l.repo_full_name, l.issue_number, p.number, p.title, p.state, p.draft, p.merged,
                p.author_login, p.closed_at, p.merged_at, p.html_url
         FROM pr_issue_links l
         JOIN pulls p ON p.repo_full_name = l.repo_full_name AND p.number = l.pr_number
         WHERE l.repo_full_name IN (${repoPlaceholders})`,
      )
      .all(...repoNames) as Array<{
        repo_full_name: string;
        issue_number: number;
        number: number;
        title: string;
        state: string;
        draft: number;
        merged: number;
        author_login: string | null;
        closed_at: string | null;
        merged_at: string | null;
        html_url: string | null;
      }>;

    for (const row of linkRows) {
      const key = `${row.repo_full_name.toLowerCase()}#${row.issue_number}`;
      if (!wanted.has(key)) continue;
      const list = linkedPrsByIssue.get(key) ?? [];
      list.push({
        number: row.number,
        title: row.title,
        state: row.state,
        draft: row.draft,
        merged: row.merged,
        author_login: row.author_login,
        closed_at: row.closed_at,
        merged_at: row.merged_at,
        html_url: row.html_url,
      });
      linkedPrsByIssue.set(key, list);
    }
  }

  return NextResponse.json({
    count: filtered.length,
    repo_count: repoCount,
    issues: filtered.map((r) => {
      const linkedPrs = linkedPrsByIssue.get(`${r.repo_full_name.toLowerCase()}#${r.number}`) ?? [];
      return {
        ...r,
        labels: r.labels ? JSON.parse(r.labels) : [],
        linked_prs: linkedPrs,
        linked_pr_count: linkedPrs.length,
        merged_pr_count: linkedPrs.filter((pr) => pr.merged || pr.merged_at).length,
        closed_pr_count: linkedPrs.filter((pr) => !pr.merged && !pr.merged_at && pr.state.toLowerCase() === 'closed').length,
      };
    }),
  });
}
