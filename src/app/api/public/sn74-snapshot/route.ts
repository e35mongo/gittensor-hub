import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getLiveReposAsyncServer } from '@/lib/repos-server';

export const dynamic = 'force-dynamic';

/**
 * Public SN74 snapshot for the landing proof strip.
 * No auth. Returns only aggregate counts — no per-repo errors or internals.
 */
export async function GET() {
  try {
    const db = getDb();
    const { repos: liveRepos } = await getLiveReposAsyncServer();
    const liveKeys = liveRepos.map((r) => r.fullName.toLowerCase());

    if (liveKeys.length === 0) {
      return NextResponse.json({
        ok: true,
        repos: 0,
        issues: 0,
        pulls: 0,
        last_fetch: null,
      });
    }

    const placeholders = liveKeys.map(() => '?').join(',');
    const issueCount =
      (
        db
          .prepare(
            `SELECT COUNT(DISTINCT LOWER(repo_full_name) || char(35) || number) as c
             FROM issues WHERE LOWER(repo_full_name) IN (${placeholders})`,
          )
          .get(...liveKeys) as { c: number } | undefined
      )?.c ?? 0;
    const pullCount =
      (
        db
          .prepare(
            `SELECT COUNT(DISTINCT LOWER(repo_full_name) || char(35) || number) as c
             FROM pulls WHERE LOWER(repo_full_name) IN (${placeholders})`,
          )
          .get(...liveKeys) as { c: number } | undefined
      )?.c ?? 0;
    const lastFetch =
      (
        db
          .prepare(
            `SELECT MAX(last_issues_fetch) as t FROM repo_meta
             WHERE LOWER(full_name) IN (${placeholders})`,
          )
          .get(...liveKeys) as { t: string | null } | undefined
      )?.t ?? null;

    return NextResponse.json({
      ok: true,
      repos: liveRepos.length,
      issues: issueCount,
      pulls: pullCount,
      last_fetch: lastFetch,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'snapshot_failed';
    console.error(`[public/sn74-snapshot] ${message}`);
    return NextResponse.json(
      { ok: false, repos: null, issues: null, pulls: null, last_fetch: null, error: 'unavailable' },
      { status: 503 },
    );
  }
}
