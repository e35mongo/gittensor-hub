export type PollerErrorRow = {
  full_name: string;
  last_fetch_error: string | null;
};

export type PollerSnapshot = {
  repos_cached: number;
  repos_total: number;
  issues_cached: number;
  pulls_cached: number;
  last_fetch: string | null;
  recent_errors: PollerErrorRow[];
};

/** Fresh enough for a green “healthy” badge on /status. */
export const POLLER_HEALTHY_MS = 30 * 60 * 1000;

export type PollerHealth = 'healthy' | 'degraded' | 'unknown';

export function pollerHealth(snap: PollerSnapshot, nowMs = Date.now()): PollerHealth {
  if (!snap.last_fetch) return 'unknown';
  const t = new Date(snap.last_fetch).getTime();
  if (Number.isNaN(t)) return 'unknown';
  const stale = nowMs - t > POLLER_HEALTHY_MS;
  const coverageGap = snap.repos_total > 0 && snap.repos_cached === 0;
  const hasErrors = snap.recent_errors.length > 0;
  if (stale || coverageGap || hasErrors) return 'degraded';
  return 'healthy';
}
