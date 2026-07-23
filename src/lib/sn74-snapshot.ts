import { getDb } from '@/lib/db';
import { getLiveReposAsyncServer } from '@/lib/repos-server';

export type Sn74Snapshot = {
  ok: boolean;
  repos: number | null;
  issues: number | null;
  pulls: number | null;
  last_fetch: string | null;
  error?: string;
};

export async function getSn74Snapshot(): Promise<Sn74Snapshot> {
  try {
    const db = getDb();
    const { repos: liveRepos } = await getLiveReposAsyncServer();
    const liveKeys = liveRepos.map((r) => r.fullName.toLowerCase());

    if (liveKeys.length === 0) {
      return { ok: true, repos: 0, issues: 0, pulls: 0, last_fetch: null };
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

    return {
      ok: true,
      repos: liveRepos.length,
      issues: issueCount,
      pulls: pullCount,
      last_fetch: lastFetch,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'snapshot_failed';
    console.error(`[sn74-snapshot] ${message}`);
    return {
      ok: false,
      repos: null,
      issues: null,
      pulls: null,
      last_fetch: null,
      error: 'unavailable',
    };
  }
}
