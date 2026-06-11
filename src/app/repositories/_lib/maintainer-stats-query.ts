import type { MaintainerStats } from '@/lib/api-types';

/** Shared TanStack Query config for a repo's maintainer scorecard, so the four
 *  call sites (drawer, detail page, compare modal, leaderboard) share one query
 *  key, fetcher, and cache entry instead of copy-pasting it. Spread it and add
 *  per-site options (`enabled`, a longer `staleTime`):
 *
 *    useQuery({ ...maintainerStatsQuery(owner, name), enabled: open })
 */
export function maintainerStatsQuery(owner: string, name: string) {
  return {
    queryKey: ['repo-maintainer-stats', owner, name] as const,
    queryFn: async ({ signal }: { signal?: AbortSignal }): Promise<MaintainerStats> => {
      const res = await fetch(
        `/api/repos/${encodeURIComponent(owner)}/${encodeURIComponent(name)}/maintainer-stats`,
        { signal },
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json() as Promise<MaintainerStats>;
    },
    staleTime: 120_000,
    refetchOnWindowFocus: false as const,
  };
}
