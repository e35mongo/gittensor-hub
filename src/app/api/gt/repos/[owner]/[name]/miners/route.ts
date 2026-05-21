import { NextResponse } from 'next/server';
import { buildIssueDiscoveriesForRepo, repoNamesMatch } from '@/lib/gt-repo-miners';
import type { RepoMiner, RepoMinersResponse } from '@/types/entities';

export const dynamic = 'force-dynamic';

const PRS_URL = 'https://api.gittensor.io/prs';
const MINERS_URL = 'https://api.gittensor.io/miners';
const REPOS_URL = 'https://api.gittensor.io/dash/repos';
const TTL_MS = 30_000;
const TOP_MINERS_LIMIT = 5;

interface UpstreamPr {
  repository: string;
  author?: string | null;
  githubId?: string | null;
  mergedAt: string | null;
  score?: string | number | null;
}

interface UpstreamMiner {
  id: string;
  githubUsername: string;
  githubId?: string | null;
  totalScore?: string | number | null;
}

interface UpstreamRepo {
  fullName: string;
  config?: { issueDiscoveryShare?: string | number | null; issue_discovery_share?: string | number | null } | null;
  issueDiscoveryShare?: string | number | null;
  issue_discovery_share?: string | number | null;
}

interface CachedShared {
  fetched_at: number;
  prs: UpstreamPr[];
  miners: UpstreamMiner[];
  issueDiscoveryShareByRepo: Map<string, number>;
  ossRankByGithubId: Map<string, number>;
}

let cache: CachedShared | null = null;
let inFlight: Promise<CachedShared> | null = null;

function num(v: unknown): number {
  const n = typeof v === 'string' ? parseFloat(v) : typeof v === 'number' ? v : 0;
  return Number.isFinite(n) ? n : 0;
}

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(15_000) });
  if (!response.ok) throw new Error(`upstream ${url} ${response.status}`);
  return response.json() as Promise<T>;
}

function issueDiscoveryReason(row: {
  issueCount: number;
  maintainerIssueCount: number;
  ownerIssueCount: number;
  solvedIssueCount: number;
  sameAuthorSolvedCount: number;
  candidateIssueCount: number;
  issueDiscoveryEnabled: boolean;
}): string {
  if (!row.issueDiscoveryEnabled) return 'issue discovery disabled for repo';
  if (row.candidateIssueCount > 0) return 'can score';
  if (row.ownerIssueCount > 0) return 'repo owner cannot earn issue score';
  if (row.maintainerIssueCount > 0) return 'maintainer cannot earn issue score';
  if (row.solvedIssueCount === 0) return 'no solved issue with merged PR';
  if (row.sameAuthorSolvedCount > 0) return 'same author as solving PR';
  return 'not first issue for solving PR';
}

async function refresh(): Promise<CachedShared> {
  const [prs, miners, repos] = await Promise.all([
    fetchJson<UpstreamPr[]>(PRS_URL),
    fetchJson<UpstreamMiner[]>(MINERS_URL),
    fetchJson<UpstreamRepo[]>(REPOS_URL),
  ]);
  const issueDiscoveryShareByRepo = new Map<string, number>();
  for (const repo of repos) {
    issueDiscoveryShareByRepo.set(
      repo.fullName.toLowerCase(),
      num(repo.config?.issueDiscoveryShare ?? repo.config?.issue_discovery_share ?? repo.issueDiscoveryShare ?? repo.issue_discovery_share),
    );
  }
  const ossRanked = [...miners].sort((a, b) => num(b.totalScore) - num(a.totalScore));
  const ossRankByGithubId = new Map<string, number>();
  ossRanked.forEach((m, i) => { if (m.githubId) ossRankByGithubId.set(m.githubId, i + 1); });
  const next: CachedShared = { fetched_at: Date.now(), prs, miners, issueDiscoveryShareByRepo, ossRankByGithubId };
  cache = next;
  return next;
}

async function getShared(): Promise<CachedShared> {
  const now = Date.now();
  if (cache && now - cache.fetched_at < TTL_MS) return cache;
  if (!inFlight) inFlight = refresh().finally(() => { inFlight = null; });
  return inFlight;
}

export async function GET(_req: Request, ctx: { params: Promise<{ owner: string; name: string }> }) {
  const params = await ctx.params;
  const fullName = `${params.owner}/${params.name}`;
  const fullNameKey = fullName.toLowerCase();
  try {
    const shared = await getShared();
    const issueDiscoveryEnabled = (shared.issueDiscoveryShareByRepo.get(fullNameKey) ?? 0) > 0;
    const minersByGithubId = new Map<string, UpstreamMiner>();
    const minersByLogin = new Map<string, UpstreamMiner>();
    for (const m of shared.miners) {
      if (m.githubId) minersByGithubId.set(m.githubId, m);
      minersByLogin.set(m.githubUsername.toLowerCase(), m);
    }

    // OSS Contributions: sum of merged PR scores per author for this repo.
    interface OssAgg { githubId: string; githubUsername: string; prCount: number; score: number }
    const ossMap = new Map<string, OssAgg>();
    for (const p of shared.prs) {
      if (!repoNamesMatch(p.repository, fullName)) continue;
      const id = p.githubId || p.author;
      if (!id) continue;
      let row = ossMap.get(id);
      if (!row) {
        row = { githubId: p.githubId || '', githubUsername: p.author || id, prCount: 0, score: 0 };
        ossMap.set(id, row);
      }
      // Count only merged PRs and their official PR scores.
      if (p.mergedAt) {
        row.prCount += 1;
        row.score += num(p.score);
      }
    }
    const ossContributions = [...ossMap.values()]
      .filter((r) => r.prCount > 0 || r.score > 0)
      .sort((a, b) => b.score - a.score || b.prCount - a.prCount)
      .slice(0, TOP_MINERS_LIMIT)
      .map((r) => {
        const m = r.githubId ? minersByGithubId.get(r.githubId) : undefined;
        const username = m?.githubUsername || r.githubUsername;
        return {
          githubId: r.githubId,
          githubUsername: username,
          prCount: r.prCount,
          score: Number(r.score.toFixed(2)),
          ossRank: r.githubId ? shared.ossRankByGithubId.get(r.githubId) ?? null : null,
          globalScore: m ? Number(num(m.totalScore).toFixed(2)) : null,
          avatarUrl: `https://github.com/${username}.png?size=48`,
        };
      });

    // Issue Discoveries: upstream miners who authored issues in this repo (local cache).
    const issueDiscoveries = buildIssueDiscoveriesForRepo(
      fullName,
      shared.miners,
      shared.issueRankByGithubId,
    );

    const body: RepoMinersResponse = {
      fullName,
      issueDiscoveryEnabled,
      ossContributions,
      issueDiscoveries,
      fetched_at: shared.fetched_at,
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 502 });
  }
}
