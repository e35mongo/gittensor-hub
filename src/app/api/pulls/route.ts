import { NextRequest, NextResponse } from 'next/server';
import { getReadDb, PullRow } from '@/lib/db';
import { extractLinkedIssues } from '@/lib/pr-linking';
import { getLiveReposAsyncServer } from '@/lib/repos-server';

export const dynamic = 'force-dynamic';

const PAGE_SIZE_DEFAULT = 50;
const PAGE_SIZE_MAX = 100;

type SortKey = 'opened' | 'closed' | 'updated' | 'repo' | 'weight' | 'number';
type SortDir = 'asc' | 'desc';

interface AggPullRow extends Omit<PullRow, 'body'> {
  linked_issues: Array<{ repo: string; number: number }>;
}

function positiveInt(value: string | null, fallback: number): number {
  const n = Number.parseInt(value ?? '', 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function normalizeRepoList(raw: string | null): string[] | null {
  if (raw === null) return null;
  const seen = new Set<string>();
  const repos: string[] = [];
  for (const part of raw.split(',')) {
    const name = part.trim();
    if (!name) continue;
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    repos.push(name);
  }
  return repos;
}

async function resolveRepoScope(reqRepos: string[] | null): Promise<string[]> {
  const { repos: liveRepos } = await getLiveReposAsyncServer();
  const db = getReadDb();
  const userRows = db
    .prepare('SELECT full_name FROM user_repos')
    .all() as Array<{ full_name: string }>;

  const allowed = new Map<string, string>();
  for (const r of liveRepos) allowed.set(r.fullName.toLowerCase(), r.fullName);
  for (const r of userRows) {
    if (!allowed.has(r.full_name.toLowerCase())) allowed.set(r.full_name.toLowerCase(), r.full_name);
  }

  if (reqRepos !== null) {
    const scoped: string[] = [];
    for (const name of reqRepos) {
      const allowedName = allowed.get(name.toLowerCase());
      if (allowedName) scoped.push(allowedName);
    }
    return scoped;
  }

  return Array.from(allowed.values());
}

function addStateFilter(where: string[], state: string | null) {
  if (!state || state === 'all') return;
  if (state === 'open') {
    where.push("p.state = 'open' AND p.draft = 0");
    return;
  }
  if (state === 'draft') {
    where.push("p.draft = 1");
    return;
  }
  if (state === 'merged') {
    where.push("p.merged = 1");
    return;
  }
  if (state === 'closed') {
    where.push("p.state = 'closed' AND p.merged = 0");
    return;
  }
}

function buildWhere({
  repos,
  q,
  state,
  close,
  author,
  includeAuthor,
}: {
  repos: string[];
  q: string;
  state: string | null;
  close: string | null;
  author: string | null;
  includeAuthor: boolean;
}): { sql: string; args: unknown[] } {
  const where: string[] = [];
  const args: unknown[] = [];

  where.push(`p.repo_full_name IN (${repos.map(() => '?').join(',')})`);
  args.push(...repos);

  if (q) {
    const like = `%${q.toLowerCase()}%`;
    where.push(
      `(LOWER(p.title) LIKE ? OR CAST(p.number AS TEXT) LIKE ? OR ('#' || p.number) LIKE ? OR LOWER(COALESCE(p.author_login, '')) LIKE ? OR LOWER(p.repo_full_name) LIKE ?)`,
    );
    args.push(like, like, like, like, like);
  }

  addStateFilter(where, state);

  if (close === 'merged' && !state) where.push("p.merged = 1");
  else if (close === 'closed' && !state) where.push("p.state = 'closed' AND p.merged = 0");
  else if (close === 'still_open') where.push("p.closed_at IS NULL");

  if (includeAuthor && author && author !== 'all') {
    where.push('p.author_login = ?');
    args.push(author);
  }

  return { sql: where.length ? `WHERE ${where.join(' AND ')}` : '', args };
}

function orderBy(sort: SortKey, dir: SortDir): string {
  const direction = dir === 'asc' ? 'ASC' : 'DESC';
  const col =
    sort === 'opened'
      ? "COALESCE(p.created_at, '')"
      : sort === 'closed'
      ? "COALESCE(p.closed_at, '')"
      : sort === 'updated'
      ? "COALESCE(p.updated_at, '')"
      : sort === 'repo'
      ? 'LOWER(p.repo_full_name)'
      : sort === 'number'
      ? 'p.number'
      : 'COALESCE(rw.weight, ur.weight, 0)';

  return `ORDER BY ${col} ${direction}, LOWER(p.repo_full_name) ASC, p.number DESC`;
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const reqRepos = normalizeRepoList(url.searchParams.get('repos'));
  const q = url.searchParams.get('q')?.trim().toLowerCase() ?? '';
  const state = url.searchParams.get('state');
  const close = url.searchParams.get('close');
  const author = url.searchParams.get('author');
  const sortParam = url.searchParams.get('sort') as SortKey | null;
  const dirParam = url.searchParams.get('dir') as SortDir | null;
  const sort: SortKey =
    sortParam && ['opened', 'closed', 'updated', 'repo', 'weight', 'number'].includes(sortParam)
      ? sortParam
      : 'updated';
  const dir: SortDir = dirParam === 'asc' ? 'asc' : 'desc';
  const page = positiveInt(url.searchParams.get('page'), 1);
  const pageSize = Math.min(PAGE_SIZE_MAX, positiveInt(url.searchParams.get('pageSize'), PAGE_SIZE_DEFAULT));
  const offset = (page - 1) * pageSize;

  const repos = await resolveRepoScope(reqRepos);
  if (repos.length === 0) {
    return NextResponse.json({
      count: 0,
      repo_count: 0,
      page,
      page_size: pageSize,
      total_pages: 1,
      authors: [],
      author_count: 0,
      pulls: [],
    });
  }

  const db = getReadDb();
  const fromSql = `
    FROM pulls p
    LEFT JOIN repo_weights rw ON rw.full_name = p.repo_full_name
    LEFT JOIN user_repos ur ON ur.full_name = p.repo_full_name
  `;
  const filteredWhere = buildWhere({
    repos,
    q,
    state,
    close,
    author,
    includeAuthor: true,
  });
  const authorWhere = buildWhere({
    repos,
    q,
    state,
    close,
    author,
    includeAuthor: false,
  });

  const totals = db
    .prepare(
      `SELECT COUNT(*) as count, COUNT(DISTINCT p.repo_full_name) as repo_count
       ${fromSql}
       ${filteredWhere.sql}`,
    )
    .get(...filteredWhere.args) as { count: number; repo_count: number };

  const authorRows = db
    .prepare(
      `SELECT p.author_login as login, COUNT(*) as count
       ${fromSql}
       ${authorWhere.sql}
       AND p.author_login IS NOT NULL
       GROUP BY p.author_login
       ORDER BY count DESC, LOWER(p.author_login) ASC
       LIMIT 2000`,
    )
    .all(...authorWhere.args) as Array<{ login: string; count: number }>;

  const rows = db
    .prepare(
      `SELECT p.id, p.repo_full_name, p.number, p.title, p.body, p.state, p.draft, p.merged,
              p.author_login, p.author_association, p.created_at, p.updated_at, p.closed_at, p.merged_at,
              p.html_url, p.fetched_at, p.first_seen_at
       ${fromSql}
       ${filteredWhere.sql}
       ${orderBy(sort, dir)}
       LIMIT ? OFFSET ?`,
    )
    .all(...filteredWhere.args, pageSize, offset) as PullRow[];

  const enriched: AggPullRow[] = rows.map((pr) => {
    const links = extractLinkedIssues({
      body: pr.body,
      title: pr.title,
      repo_full_name: pr.repo_full_name,
    });
    const linked = links.map((l) => ({ repo: l.repo ?? pr.repo_full_name, number: l.number }));
    const { body, ...rest } = pr;
    void body;
    return { ...rest, linked_issues: linked };
  });

  const totalPages = Math.max(1, Math.ceil(totals.count / pageSize));

  return NextResponse.json({
    count: totals.count,
    repo_count: totals.repo_count,
    page,
    page_size: pageSize,
    total_pages: totalPages,
    authors: authorRows,
    author_count: authorRows.length,
    pulls: enriched,
  });
}
