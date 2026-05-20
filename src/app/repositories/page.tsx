'use client';

export const dynamic = 'force-dynamic';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { PageLayout, Heading, Text, Box, TextInput, Label } from '@primer/react';
import {
  SearchIcon,
  StarIcon,
  StarFillIcon,
  TriangleDownIcon,
  TriangleUpIcon,
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ArrowDownIcon,
  ArrowUpIcon,
  GitPullRequestIcon,
} from '@primer/octicons-react';
import { TableRowsSkeleton, SkeletonBar } from '@/components/Skeleton';
import { isTracked as repoIsTracked, useTrackedRepos } from '@/lib/tracked-repos';
import { formatRelativeTime, formatCount, formatPercent, formatUsd, formatTao } from '@/lib/format';
import type { GtRepo, GtReposResponse, RepoMinersResponse, GtRepoPrsResponse } from '@/types/entities';

const STALE_PR_MS = 14 * 24 * 60 * 60 * 1000;
const STALE_MIN_WEIGHT = 0.01;
const OPPORTUNITY_LIMIT = 5;
const DEFAULT_OPEN_PR_THRESHOLD = 999;

function emissionForWeight(
  weight: number,
  prices: PricesResponse | undefined,
): { tao: number | null; usd: number | null } {
  const tao = weight > 0 && prices && prices.tao_per_day > 0 ? weight * prices.tao_per_day : null;
  const usd = tao != null && prices && prices.tao_usd > 0 ? tao * prices.tao_usd : null;
  return { tao, usd };
}

interface PricesResponse {
  tao_usd: number;
  alpha_tao: number;
  alpha_usd: number;
  tao_per_day: number;
  fetched_at: number;
}

type SortKey = 'weight' | 'emission' | 'capacity' | 'openIssues' | 'discovery' | 'lastMerge' | 'fullName';
type StatusFilter = 'all' | 'active' | 'inactive';

const PAGE_SIZES = [10, 12, 25, 50, 100];

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: 'weight', label: 'Weight' },
  { key: 'emission', label: 'Emission/day' },
  { key: 'capacity', label: 'Capacity' },
  { key: 'openIssues', label: 'Open Work' },
  { key: 'discovery', label: 'Issue Discovery' },
  { key: 'lastMerge', label: 'Last merge' },
  { key: 'fullName', label: 'Repository' },
];

function capacityUtilization(r: GtRepo): number {
  // The threshold is per-author (one contributor can hold up to N open PRs
  // before the penalty applies), so the meaningful repo-level signal is
  // avg-open-PRs-per-known-contributor, NOT the raw openPrCount.
  const thr = r.excessivePrPenaltyThreshold ?? 0;
  if (thr <= 0 || r.contributorCount <= 0) return 0;
  return r.openPrCount / r.contributorCount / thr;
}

function avatarUrl(owner: string): string {
  return `https://github.com/${owner}.png?size=48`;
}

export default function RepositoriesPage() {
  const { tracked, toggle } = useTrackedRepos();
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<StatusFilter>('all');
  const [sortKey, setSortKey] = useState<SortKey>('weight');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [pageSize, setPageSize] = useState<number>(10);
  const [expandedRepo, setExpandedRepo] = useState<string | null>(null);
  const [page, setPage] = useState<number>(1);

  const { data, isLoading, isError } = useQuery<GtReposResponse>({
    queryKey: ['gt-repositories'],
    queryFn: async () => {
      const r = await fetch('/api/gt/repositories');
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.json();
    },
    refetchInterval: 30_000,
    refetchIntervalInBackground: true,
  });

  const { data: prices } = useQuery<PricesResponse>({
    queryKey: ['prices'],
    queryFn: async () => {
      const r = await fetch('/api/prices');
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.json();
    },
    refetchInterval: 60_000,
    staleTime: 30_000,
  });

  const onSortChange = (k: SortKey) => {
    if (k === sortKey) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else {
      setSortKey(k);
      setSortDir('desc');
    }
    setPage(1);
  };

  const filtered = useMemo(() => {
    if (!data?.repos) return [] as GtRepo[];
    const q = query.trim().toLowerCase();
    let list = data.repos.filter((r) => {
      if (status === 'active' && !r.isActive) return false;
      if (status === 'inactive' && r.isActive) return false;
      if (q && !r.fullName.toLowerCase().includes(q)) return false;
      return true;
    });
    list = [...list].sort((a, b) => {
      let cmp = 0;
      if (sortKey === 'weight') cmp = a.weight - b.weight;
      else if (sortKey === 'emission') cmp = a.weight - b.weight;
      else if (sortKey === 'capacity') cmp = capacityUtilization(a) - capacityUtilization(b);
      else if (sortKey === 'openIssues') cmp = a.openIssueCount - b.openIssueCount;
      else if (sortKey === 'discovery') cmp = (a.issueDiscoveryShare ?? 0) - (b.issueDiscoveryShare ?? 0);
      else if (sortKey === 'lastMerge') {
        const at = a.lastPrAt ? Date.parse(a.lastPrAt) : 0;
        const bt = b.lastPrAt ? Date.parse(b.lastPrAt) : 0;
        cmp = at - bt;
      } else if (sortKey === 'fullName') cmp = a.fullName.localeCompare(b.fullName);
      if (cmp === 0) cmp = sortKey === 'fullName' ? 0 : a.weight - b.weight;
      return sortDir === 'desc' ? -cmp : cmp;
    });
    return list;
  }, [data, query, status, sortKey, sortDir]);

  const { underutilized, openWork, goingStale } = useMemo(() => {
    const empty = { underutilized: [] as GtRepo[], openWork: [] as GtRepo[], goingStale: [] as GtRepo[] };
    if (!data?.repos) return empty;
    const active = data.repos.filter((r) => r.isActive);

    const underutilized = active
      .filter(
        (r) =>
          r.weight > 0 &&
          r.openPrCount < (r.excessivePrPenaltyThreshold ?? DEFAULT_OPEN_PR_THRESHOLD),
      )
      .sort((a, b) => b.weight / Math.max(b.openPrCount, 1) - a.weight / Math.max(a.openPrCount, 1))
      .slice(0, OPPORTUNITY_LIMIT);

    const openWork = [...active]
      .filter((r) => r.openIssueCount > 0)
      .sort((a, b) => b.openIssueCount - a.openIssueCount)
      .slice(0, OPPORTUNITY_LIMIT);

    const staleCutoff = Date.now() - STALE_PR_MS;
    const goingStale = active
      .filter((r) => {
        if (r.weight <= STALE_MIN_WEIGHT) return false;
        if (!r.lastPrAt) return true;
        return Date.parse(r.lastPrAt) < staleCutoff;
      })
      .sort((a, b) => {
        const at = a.lastPrAt ? Date.parse(a.lastPrAt) : 0;
        const bt = b.lastPrAt ? Date.parse(b.lastPrAt) : 0;
        return at - bt;
      })
      .slice(0, OPPORTUNITY_LIMIT);

    return { underutilized, openWork, goingStale };
  }, [data]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const pageStart = (safePage - 1) * pageSize;
  const pageItems = filtered.slice(pageStart, pageStart + pageSize);

  return (
    <PageLayout containerWidth="full" padding="normal">
      <PageLayout.Header>
        <Heading sx={{ fontSize: 4, mb: 1 }}>Repositories</Heading>
        <Text sx={{ color: 'fg.muted' }}>
          SN74 tracked repositories — weight, scoring, and contributor activity.
        </Text>
      </PageLayout.Header>
      <PageLayout.Content>
        <NetworkKpiStrip data={data} prices={prices} />

        <Box
          sx={{
            display: 'flex',
            flexDirection: ['column', null, null, 'row'],
            alignItems: 'flex-start',
            gap: 3,
          }}
        >
          {/* Main column */}
          <Box sx={{ flex: 1, minWidth: 0, width: '100%' }}>
        {/* Toolbar — detached card, matching /pulls visual rhythm. */}
        <Box
          sx={{
            border: '1px solid',
            borderColor: 'border.default',
            borderRadius: 2,
            bg: 'canvas.subtle',
            p: 2,
            mb: 3,
          }}
        >
          <Box sx={{ display: 'flex', flexDirection: ['column', null, 'row'], alignItems: ['stretch', null, 'center'], gap: 3, flexWrap: 'wrap' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, maxWidth: '100%', overflowX: 'auto', pb: ['2px', null, 0] }}>
              <StatusTab active={status === 'all'} onClick={() => { setStatus('all'); setPage(1); }} label="All" count={data?.count} />
              <StatusTab active={status === 'active'} onClick={() => { setStatus('active'); setPage(1); }} label="Active" count={data?.activeCount} />
              <StatusTab active={status === 'inactive'} onClick={() => { setStatus('inactive'); setPage(1); }} label="Inactive" count={data?.inactiveCount} />
            </Box>

            <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 1, color: 'fg.muted', fontSize: 1 }}>
              <Text sx={{ color: 'fg.muted' }}>Rows:</Text>
              <Box
                as="select"
                value={pageSize}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) => {
                  setPageSize(Number(e.target.value));
                  setPage(1);
                }}
                sx={{
                  bg: 'canvas.default',
                  color: 'fg.default',
                  border: '1px solid',
                  borderColor: 'border.default',
                  borderRadius: 1,
                  px: 1,
                  py: '2px',
                  fontSize: 1,
                  cursor: 'pointer',
                }}
              >
                {PAGE_SIZES.map((n) => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </Box>
            </Box>

            <Box sx={{ flex: 1, minWidth: [0, null, 240], width: ['100%', null, 'auto'] }}>
              <TextInput
                leadingVisual={SearchIcon}
                placeholder="Search or enter owner/name…"
                value={query}
                onChange={(e) => { setQuery(e.target.value); setPage(1); }}
                sx={{ width: '100%' }}
              />
            </Box>

          </Box>

          {/* When the table's headers scroll off-screen on narrow viewports, expose the same sort here. */}
          <Box
            sx={{
              display: ['flex', null, null, 'none'],
              flexDirection: ['column', null, 'row'],
              alignItems: ['stretch', null, 'center'],
              justifyContent: 'flex-end',
              gap: 2,
              mt: 3,
              color: 'fg.muted',
              fontSize: 1,
            }}
          >
            <Text sx={{ color: 'fg.muted' }}>Sort:</Text>
            <Box
              as="select"
              value={sortKey}
              onChange={(e: React.ChangeEvent<HTMLSelectElement>) => { setSortKey(e.target.value as SortKey); setPage(1); }}
              sx={{
                bg: 'canvas.default',
                color: 'fg.default',
                border: '1px solid',
                borderColor: 'border.default',
                borderRadius: 1,
                px: 2,
                py: '4px',
                fontSize: 1,
                fontFamily: 'inherit',
                cursor: 'pointer',
                minWidth: [0, null, 140],
              }}
            >
              {SORT_OPTIONS.map((o) => (
                <option key={o.key} value={o.key}>{o.label}</option>
              ))}
            </Box>
            <Box
              as="button"
              onClick={() => setSortDir((d) => (d === 'desc' ? 'asc' : 'desc'))}
              aria-label={sortDir === 'desc' ? 'Sort descending' : 'Sort ascending'}
              title={sortDir === 'desc' ? 'Descending' : 'Ascending'}
              sx={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: ['100%', null, 28],
                height: 28,
                bg: 'canvas.default',
                color: 'fg.default',
                border: '1px solid',
                borderColor: 'border.default',
                borderRadius: 1,
                cursor: 'pointer',
                '&:hover': { borderColor: 'border.muted' },
              }}
            >
              {sortDir === 'desc' ? <ArrowDownIcon size={14} /> : <ArrowUpIcon size={14} />}
            </Box>
          </Box>
        </Box>

        {isError && (
          <Box sx={{ p: 3, border: '1px solid', borderColor: 'danger.emphasis', bg: 'danger.subtle', borderRadius: 2, mb: 2 }}>
            <Text sx={{ color: 'danger.fg' }}>Failed to load repositories.</Text>
          </Box>
        )}
        {isLoading && !data && (
          <TableRowsSkeleton
            rows={12}
            cols={[
              { width: 24 },
              { flex: 1 },
              { width: 80 },
              { width: 90 },
              { width: 90 },
              { width: 90 },
              { width: 60 },
              { width: 80 },
              { width: 80 },
              { width: 120 },
              { width: 36 },
            ]}
          />
        )}

        {data && (
          <RepoTable
            rows={pageItems}
            startRank={pageStart + 1}
            sortKey={sortKey}
            sortDir={sortDir}
            onSort={onSortChange}
            tracked={tracked}
            onToggleTrack={toggle}
            prices={prices}
            expandedRepo={expandedRepo}
            onToggleExpand={(fullName) =>
              setExpandedRepo((cur) => (cur === fullName ? null : fullName))
            }
          />
        )}

        {data && (
          <Box
            sx={{
              mt: 2,
              px: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: ['space-between', null, 'flex-end'],
              gap: 2,
              flexWrap: 'wrap',
              color: 'fg.muted',
              fontSize: 1,
            }}
          >
            <Text>
              {filtered.length === 0
                ? '0 of 0'
                : `${pageStart + 1}-${Math.min(pageStart + pageSize, filtered.length)} of ${filtered.length}`}
            </Text>
            <PageBtn onClick={() => setPage(1)} disabled={safePage <= 1} aria="First page">|‹</PageBtn>
            <PageBtn onClick={() => setPage(safePage - 1)} disabled={safePage <= 1} aria="Previous page">
              <ChevronLeftIcon size={14} />
            </PageBtn>
            <PageBtn onClick={() => setPage(safePage + 1)} disabled={safePage >= totalPages} aria="Next page">
              <ChevronRightIcon size={14} />
            </PageBtn>
            <PageBtn onClick={() => setPage(totalPages)} disabled={safePage >= totalPages} aria="Last page">›|</PageBtn>
          </Box>
        )}
          </Box>

          {/* Right sidebar — Opportunities */}
          <Box
            sx={{
              width: ['100%', null, null, 320],
              flexShrink: 0,
              position: ['static', null, null, 'sticky'],
              top: 16,
              display: 'flex',
              flexDirection: 'column',
              gap: 3,
            }}
          >
            <OpportunityCard
              title="Underutilized capacity"
              hint="High weight, room for more PRs"
              accent="success"
              rows={underutilized}
              empty="No repos with open capacity right now."
              renderRight={(r) => (
                <Box sx={{ textAlign: 'right' }}>
                  <Text sx={{ fontFamily: 'mono', fontVariantNumeric: 'tabular-nums', fontWeight: 700, color: 'fg.default' }}>
                    {r.weight.toFixed(2)}
                  </Text>
                  <Text sx={{ display: 'block', fontSize: 0, color: 'fg.muted' }}>
                    {r.openPrCount}/{r.excessivePrPenaltyThreshold ?? '∞'} PRs
                  </Text>
                </Box>
              )}
            />
            <OpportunityCard
              title="Open work available"
              hint="Issues waiting for an owner"
              accent="accent"
              rows={openWork}
              empty="No open issues across tracked repos."
              renderRight={(r) => (
                <Box sx={{ textAlign: 'right' }}>
                  <Text sx={{ fontFamily: 'mono', fontVariantNumeric: 'tabular-nums', fontWeight: 700, color: 'fg.default' }}>
                    {formatCount(r.openIssueCount)}
                  </Text>
                  <Text sx={{ display: 'block', fontSize: 0, color: 'fg.muted' }}>w {r.weight.toFixed(2)}</Text>
                </Box>
              )}
            />
            <OpportunityCard
              title="Going stale"
              hint="No recent merges, still weighted"
              accent="attention"
              rows={goingStale}
              empty="No stale repos — nice."
              renderRight={(r) => (
                <Box sx={{ textAlign: 'right' }}>
                  <Text sx={{ fontFamily: 'mono', fontVariantNumeric: 'tabular-nums', fontWeight: 700, color: 'fg.default' }}>
                    {r.weight.toFixed(2)}
                  </Text>
                  <Text sx={{ display: 'block', fontSize: 0, color: 'fg.muted' }}>
                    {r.lastPrAt ? formatRelativeTime(r.lastPrAt) : 'never'}
                  </Text>
                </Box>
              )}
            />
          </Box>
        </Box>
      </PageLayout.Content>
    </PageLayout>
  );
}

type AccentTone = 'success' | 'accent' | 'attention' | 'danger';

function OpportunityCard({
  title,
  hint,
  accent,
  rows,
  empty,
  renderRight,
}: {
  title: string;
  hint: string;
  accent: AccentTone;
  rows: GtRepo[];
  empty: string;
  renderRight: (r: GtRepo) => React.ReactNode;
}) {
  return (
    <Box
      sx={{
        border: '1px solid',
        borderColor: 'border.default',
        borderRadius: 2,
        bg: 'canvas.subtle',
        minWidth: 0,
        overflow: 'hidden',
      }}
    >
      <Box
        sx={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: 2,
          px: 3,
          pt: 2,
          pb: 2,
          borderBottom: '1px solid',
          borderColor: 'border.muted',
        }}
      >
        <Box
          aria-hidden
          sx={{
            width: 6,
            height: 6,
            borderRadius: '50%',
            bg: `${accent}.emphasis`,
            mt: '6px',
            flexShrink: 0,
          }}
        />
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Text
            sx={{
              display: 'block',
              fontSize: 1,
              fontWeight: 600,
              color: 'fg.default',
              lineHeight: 1.3,
            }}
          >
            {title}
          </Text>
          <Text sx={{ display: 'block', fontSize: 0, color: 'fg.muted', mt: '2px' }}>{hint}</Text>
        </Box>
      </Box>
      <Box sx={{ px: 2, py: 1 }}>
        {rows.length === 0 ? (
          <EmptyHint>{empty}</EmptyHint>
        ) : (
          rows.map((r) => <SidebarRepoRow key={r.fullName} repo={r} right={renderRight(r)} />)
        )}
      </Box>
    </Box>
  );
}

function SidebarRepoRow({ repo, right }: { repo: GtRepo; right: React.ReactNode }) {
  return (
    <Link
      href={`/repos/${repo.owner}/${repo.name}`}
      prefetch={false}
      style={{ display: 'block', minWidth: 0, textDecoration: 'none' }}
    >
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 2,
          minWidth: 0,
          py: '6px',
          px: 1,
          borderRadius: 1,
          '&:hover': { bg: 'canvas.default' },
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={avatarUrl(repo.owner)}
          alt={repo.owner}
          loading="lazy"
          style={{ width: 18, height: 18, borderRadius: '50%', border: '1px solid var(--border-muted)', flexShrink: 0 }}
        />
        <Text
          sx={{
            flex: 1,
            minWidth: 0,
            color: 'fg.default',
            fontWeight: 500,
            fontSize: 0,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
          title={repo.fullName}
        >
          {repo.fullName}
        </Text>
        <Box sx={{ flexShrink: 0 }}>{right}</Box>
      </Box>
    </Link>
  );
}

function NetworkKpiStrip({
  data,
  prices,
}: {
  data: GtReposResponse | undefined;
  prices: PricesResponse | undefined;
}) {
  const activeCount = data?.activeCount ?? 0;
  const totalCount = data?.count ?? 0;
  const weight = data?.totalEmissionWeight ?? 0;
  const merged7d = data?.prsMergedThisWeek ?? 0;
  const mergedPrev = data?.prsMergedLastWeek ?? 0;
  const delta = merged7d - mergedPrev;
  const contributors7d = data?.uniqueContributors7d ?? 0;
  const contributorsPrev = data?.uniqueContributorsPriorWeek ?? 0;
  const contributorsDelta = contributors7d - contributorsPrev;
  const score7d = data?.scoreEarnedThisWeek ?? 0;
  const scorePrev = data?.scoreEarnedPriorWeek ?? 0;
  const scoreDelta = score7d - scorePrev;

  const { tao: taoPerDay, usd: usdPerDay } = emissionForWeight(weight, prices);

  return (
    <Box
      sx={{
        display: 'grid',
        // 6 tiles: stack at xs, 2 wide at sm, 3 wide (2×3) at md/lg,
        // all 6 on one row at xl (≥1280px → covers the spec's ≥1400px wide-viewport target).
        gridTemplateColumns: [
          '1fr',
          'repeat(2, minmax(0, 1fr))',
          'repeat(3, minmax(0, 1fr))',
          null,
          'repeat(6, minmax(0, 1fr))',
        ],
        gap: 3,
        mb: 3,
      }}
    >
      <KpiTile label="ACTIVE REPOS">
        <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 2 }}>
          <Box
            sx={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              bg: activeCount > 0 ? 'success.emphasis' : 'fg.subtle',
              alignSelf: 'center',
              flexShrink: 0,
            }}
          />
          <KpiValue>{activeCount}</KpiValue>
          <Text sx={{ color: 'fg.muted', fontFamily: 'mono', fontVariantNumeric: 'tabular-nums', fontSize: 1 }}>
            / {totalCount}
          </Text>
        </Box>
      </KpiTile>

      <KpiTile label="WEIGHT ALLOCATED">
        <KpiValue>{formatPercent(weight, { scale: 100 })}</KpiValue>
      </KpiTile>

      <KpiTile label="EMISSION / DAY">
        {taoPerDay == null ? (
          <Box>
            <KpiValue>{formatPercent(weight, { scale: 100 })}</KpiValue>
            <Text sx={{ display: 'block', fontSize: 0, color: 'fg.muted' }}>weight share</Text>
          </Box>
        ) : (
          <Box>
            <KpiValue>{formatTao(taoPerDay)}</KpiValue>
            <Text sx={{ display: 'block', fontSize: 0, color: 'fg.muted' }}>
              {usdPerDay != null ? `${formatUsd(usdPerDay)}/day` : 'TAO/day'}
            </Text>
          </Box>
        )}
      </KpiTile>

      <KpiTile label="PRS MERGED 7D">
        <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 2 }}>
          <KpiValue>{formatCount(merged7d, { fallback: '0' })}</KpiValue>
          {(merged7d > 0 || mergedPrev > 0) && <WowDelta delta={delta} />}
        </Box>
      </KpiTile>

      <KpiTile label="CONTRIBUTORS 7D">
        <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 2 }}>
          <KpiValue>{formatCount(contributors7d, { fallback: '0' })}</KpiValue>
          {contributorsDelta !== 0 && <WowDelta delta={contributorsDelta} />}
        </Box>
      </KpiTile>

      <KpiTile label="SCORE EARNED 7D">
        <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 2 }}>
          <KpiValue>{formatCount(Math.round(score7d), { fallback: '0' })}</KpiValue>
          {Math.round(scoreDelta) !== 0 && <WowDelta delta={Math.round(scoreDelta)} />}
        </Box>
      </KpiTile>
    </Box>
  );
}

function KpiValue({ children }: { children: React.ReactNode }) {
  return (
    <Text sx={{ fontFamily: 'mono', fontVariantNumeric: 'tabular-nums', fontWeight: 700, fontSize: 4, color: 'fg.default' }}>
      {children}
    </Text>
  );
}

function KpiTile({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <Box
      sx={{
        border: '1px solid',
        borderColor: 'border.default',
        borderRadius: 2,
        bg: 'canvas.subtle',
        p: 3,
        display: 'flex',
        flexDirection: 'column',
        gap: 1,
        minWidth: 0,
        overflow: 'hidden',
      }}
    >
      <Text
        sx={{
          fontSize: '11px',
          fontWeight: 600,
          letterSpacing: '0.5px',
          color: 'fg.muted',
          textTransform: 'uppercase',
        }}
      >
        {label}
      </Text>
      {children}
    </Box>
  );
}

function WowDelta({ delta }: { delta: number }) {
  if (delta === 0) {
    return (
      <Text sx={{ color: 'fg.muted', fontFamily: 'mono', fontVariantNumeric: 'tabular-nums', fontSize: 0, fontWeight: 600 }}>
        ±0
      </Text>
    );
  }
  const positive = delta > 0;
  const Icon = positive ? ArrowUpIcon : ArrowDownIcon;
  return (
    <Box
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '2px',
        color: positive ? 'success.fg' : 'danger.fg',
        fontFamily: 'mono',
        fontVariantNumeric: 'tabular-nums',
        fontSize: 0,
        fontWeight: 700,
      }}
    >
      <Icon size={12} />
      {Math.abs(delta)}
    </Box>
  );
}

function EmptyHint({ children }: { children: React.ReactNode }) {
  return (
    <Box sx={{ py: 3, textAlign: 'center', color: 'fg.muted', fontSize: 1 }}>{children}</Box>
  );
}

function StatusTab({
  active,
  onClick,
  label,
  count,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  count?: number;
}) {
  return (
    <Box
      as="button"
      onClick={onClick}
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 1,
        px: 2,
        py: '4px',
        border: '1px solid',
        borderColor: active ? 'border.default' : 'transparent',
        borderRadius: 1,
        bg: active ? 'canvas.default' : 'transparent',
        color: active ? 'fg.default' : 'fg.muted',
        fontSize: 1,
        fontWeight: active ? 600 : 500,
        flexShrink: 0,
        cursor: 'pointer',
        fontFamily: 'inherit',
        '&:hover': { color: 'fg.default' },
      }}
    >
      <Text>{label}</Text>
      {count !== undefined && (
        <Text sx={{ color: active ? 'fg.muted' : 'fg.subtle', fontWeight: 500 }}>{count}</Text>
      )}
    </Box>
  );
}

function PageBtn({
  onClick,
  disabled,
  aria,
  children,
}: {
  onClick: () => void;
  disabled?: boolean;
  aria: string;
  children: React.ReactNode;
}) {
  return (
    <Box
      as="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={aria}
      title={aria}
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        minWidth: 24,
        height: 24,
        px: 1,
        bg: 'transparent',
        border: '1px solid',
        borderColor: 'transparent',
        borderRadius: 1,
        color: disabled ? 'fg.subtle' : 'fg.muted',
        cursor: disabled ? 'default' : 'pointer',
        opacity: disabled ? 0.4 : 1,
        fontFamily: 'mono',
        fontSize: 1,
        '&:hover': disabled ? undefined : { color: 'fg.default', bg: 'canvas.default' },
      }}
    >
      {children}
    </Box>
  );
}

function RepoTable({
  rows,
  startRank,
  sortKey,
  sortDir,
  onSort,
  tracked,
  onToggleTrack,
  prices,
  expandedRepo,
  onToggleExpand,
}: {
  rows: GtRepo[];
  startRank: number;
  sortKey: SortKey;
  sortDir: 'asc' | 'desc';
  onSort: (k: SortKey) => void;
  tracked: Set<string>;
  onToggleTrack: (fullName: string) => void;
  prices: PricesResponse | undefined;
  expandedRepo: string | null;
  onToggleExpand: (fullName: string) => void;
}) {
  return (
    <Box
      sx={{
        border: '1px solid',
        borderColor: 'border.default',
        borderRadius: 2,
        bg: 'canvas.default',
        overflowX: 'auto',
        overflowY: 'hidden',
      }}
    >
      <Box as="table" sx={{ width: '100%', minWidth: 1220, borderCollapse: 'collapse', fontSize: 1 }}>
        <Box as="thead" sx={{ bg: 'canvas.subtle', borderBottom: '1px solid', borderColor: 'border.default' }}>
          <Box as="tr">
            <Th width={56}>RANK</Th>
            <Th sortKey="fullName" current={sortKey} dir={sortDir} onSort={onSort}>REPOSITORY</Th>
            <Th align="right" sortKey="weight" current={sortKey} dir={sortDir} onSort={onSort}>WEIGHT</Th>
            <Th align="right" sortKey="emission" current={sortKey} dir={sortDir} onSort={onSort}>EMISSION/DAY</Th>
            <Th align="left">ACTIVITY (14D)</Th>
            <Th align="left" sortKey="capacity" current={sortKey} dir={sortDir} onSort={onSort}>CAPACITY</Th>
            <Th align="right" sortKey="openIssues" current={sortKey} dir={sortDir} onSort={onSort}>OPEN WORK</Th>
            <Th align="right" sortKey="discovery" current={sortKey} dir={sortDir} onSort={onSort}>ISSUE DISCOVERY</Th>
            <Th align="right" sortKey="lastMerge" current={sortKey} dir={sortDir} onSort={onSort}>LAST MERGE</Th>
            <Th align="left">POLICY</Th>
            <Th align="center" width={36}>★</Th>
          </Box>
        </Box>
        <Box as="tbody">
          {rows.map((r, i) => {
            const rank = startRank + i;
            const isTracked = repoIsTracked(tracked, r.fullName);
            const { tao: taoPerDay, usd: usdPerDay } = emissionForWeight(r.weight, prices);
            const lastMergeMs = r.lastPrAt ? Date.parse(r.lastPrAt) : 0;
            const lastMergeStale = lastMergeMs > 0 && Date.now() - lastMergeMs > STALE_PR_MS;
            const isExpanded = expandedRepo === r.fullName;
            const detailId = `repo-detail-${r.owner}-${r.name}`;
            return (
              <React.Fragment key={r.fullName}>
              <Box
                as="tr"
                tabIndex={0}
                role="button"
                aria-expanded={isExpanded}
                aria-controls={detailId}
                onClick={() => onToggleExpand(r.fullName)}
                onKeyDown={(e: React.KeyboardEvent<HTMLTableRowElement>) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onToggleExpand(r.fullName);
                  } else if (e.key === 'Escape' && isExpanded) {
                    e.preventDefault();
                    onToggleExpand(r.fullName);
                  }
                }}
                sx={{
                  borderBottom: '1px solid',
                  borderColor: 'border.muted',
                  '&:hover': { bg: 'canvas.default' },
                  '&:last-child': { borderBottom: isExpanded ? undefined : 'none' },
                  opacity: r.isActive ? 1 : 0.55,
                  cursor: 'pointer',
                  bg: isExpanded ? 'canvas.default' : undefined,
                  outline: 'none',
                  '&:focus-visible': { boxShadow: 'inset 0 0 0 2px var(--accent-emphasis)' },
                }}
              >
                <Box as="td" sx={{ p: 2, verticalAlign: 'middle' }}>
                  <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 1 }}>
                    <Box
                      sx={{
                        color: 'fg.muted',
                        display: 'inline-flex',
                        transition: 'transform 120ms ease',
                        transform: isExpanded ? 'rotate(0deg)' : 'rotate(-90deg)',
                      }}
                      aria-hidden
                    >
                      <ChevronDownIcon size={12} />
                    </Box>
                    <Text
                      sx={{
                        display: 'inline-block',
                        minWidth: 22,
                        textAlign: 'right',
                        fontFamily: 'mono',
                        fontVariantNumeric: 'tabular-nums',
                        fontWeight: rank <= 3 ? 700 : 500,
                        fontSize: 1,
                        color: rank <= 3 ? 'attention.fg' : 'fg.muted',
                      }}
                    >
                      {rank}
                    </Text>
                  </Box>
                </Box>
                <Box as="td" sx={{ p: 2, verticalAlign: 'middle' }}>
                  <Link
                    href={`/repos/${r.owner}/${r.name}`}
                    prefetch={false}
                    onClick={(e) => e.stopPropagation()}
                    style={{ textDecoration: 'none' }}
                  >
                    <Box
                      sx={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 2,
                        color: 'fg.default',
                        '&:hover': { color: 'accent.fg' },
                      }}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={avatarUrl(r.owner)}
                        alt={r.owner}
                        loading="lazy"
                        style={{ width: 20, height: 20, borderRadius: '50%', border: '1px solid var(--border-muted)' }}
                      />
                      <Text sx={{ fontWeight: 600 }}>{r.fullName}</Text>
                      {r.stars != null && r.stars > 0 && (
                        <Text sx={{ color: 'fg.muted', fontSize: 0, fontVariantNumeric: 'tabular-nums' }}>
                          ★ {formatCount(r.stars)}
                        </Text>
                      )}
                      {!r.isActive && (
                        <Label variant="secondary" sx={{ fontSize: '10px' }}>
                          INACTIVE
                        </Label>
                      )}
                    </Box>
                  </Link>
                </Box>
                <Box as="td" sx={{ p: 2, textAlign: 'right', verticalAlign: 'middle', minWidth: 90 }}>
                  <Box sx={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'stretch', minWidth: 70, gap: '4px' }}>
                    <Text sx={{ fontFamily: 'mono', fontVariantNumeric: 'tabular-nums', fontWeight: 700, color: 'fg.default' }}>
                      {r.weight.toFixed(2)}
                    </Text>
                    <Box sx={{ width: '100%', height: 3, bg: 'canvas.inset', borderRadius: 999, overflow: 'hidden' }}>
                      <Box sx={{ height: '100%', bg: 'accent.emphasis' }} style={{ width: `${Math.min(100, Math.max(0, r.weight * 100))}%` }} />
                    </Box>
                  </Box>
                </Box>
                <Box as="td" sx={{ p: 2, textAlign: 'right', verticalAlign: 'middle' }}>
                  {taoPerDay == null ? (
                    <Text sx={{ color: 'fg.muted', fontFamily: 'mono', fontVariantNumeric: 'tabular-nums' }}>—</Text>
                  ) : (
                    <Box>
                      <Text sx={{ display: 'block', fontFamily: 'mono', fontVariantNumeric: 'tabular-nums', fontWeight: 700, color: 'fg.default' }}>
                        {formatTao(taoPerDay)}
                      </Text>
                      <Text sx={{ display: 'block', fontFamily: 'mono', fontVariantNumeric: 'tabular-nums', fontSize: 0, color: 'fg.muted' }}>
                        {usdPerDay != null ? formatUsd(usdPerDay) : ''}
                      </Text>
                    </Box>
                  )}
                </Box>
                <Box as="td" sx={{ p: 2, verticalAlign: 'middle' }}>
                  <Sparkline series={r.mergedPrSeries14d} />
                </Box>
                <Box as="td" sx={{ p: 2, verticalAlign: 'middle' }}>
                  <CapacityGauge
                    open={r.openPrCount}
                    threshold={r.excessivePrPenaltyThreshold}
                    contributors={r.contributorCount}
                  />
                </Box>
                <Box as="td" sx={{ p: 2, textAlign: 'right', verticalAlign: 'middle' }}>
                  <Text sx={{ fontFamily: 'mono', fontVariantNumeric: 'tabular-nums', color: r.openIssueCount > 0 ? 'fg.default' : 'fg.muted' }}>
                    {formatCount(r.openIssueCount)}
                  </Text>
                </Box>
                <Box as="td" sx={{ p: 2, textAlign: 'right', verticalAlign: 'middle' }}>
                  <DiscoveryCell repo={r} />
                </Box>
                <Box as="td" sx={{ p: 2, textAlign: 'right', verticalAlign: 'middle' }}>
                  {!r.lastPrAt ? (
                    <Text sx={{ color: 'fg.muted', fontSize: 0 }}>Never</Text>
                  ) : (
                    <Text sx={{ color: lastMergeStale ? 'danger.fg' : 'fg.default', fontSize: 0, fontVariantNumeric: 'tabular-nums' }}>
                      {formatRelativeTime(r.lastPrAt)}
                    </Text>
                  )}
                </Box>
                <Box as="td" sx={{ p: 2, verticalAlign: 'middle' }}>
                  <PolicyChips repo={r} />
                </Box>
                <Box as="td" sx={{ p: 2, textAlign: 'center', verticalAlign: 'middle' }}>
                  <Box
                    as="button"
                    onClick={(e: React.MouseEvent<HTMLButtonElement>) => {
                      e.stopPropagation();
                      onToggleTrack(r.fullName);
                    }}
                    aria-label={isTracked ? 'Untrack' : 'Track'}
                    sx={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: 24,
                      height: 24,
                      bg: 'transparent',
                      border: 'none',
                      borderRadius: 1,
                      color: isTracked ? 'attention.fg' : 'fg.muted',
                      cursor: 'pointer',
                      '&:hover': { bg: 'canvas.inset', color: 'attention.fg' },
                    }}
                  >
                    {isTracked ? <StarFillIcon size={14} /> : <StarIcon size={14} />}
                  </Box>
                </Box>
              </Box>
              {isExpanded && (
                <Box
                  as="tr"
                  id={detailId}
                  sx={{
                    borderBottom: '1px solid',
                    borderColor: 'border.muted',
                    bg: 'canvas.inset',
                    '&:last-child': { borderBottom: 'none' },
                  }}
                >
                  <Box as="td" colSpan={11} sx={{ p: 0 }}>
                    <ExpandedRowDetail repo={r} />
                  </Box>
                </Box>
              )}
              </React.Fragment>
            );
          })}
          {rows.length === 0 && (
            <Box as="tr">
              <Box as="td" colSpan={11} sx={{ p: 4, textAlign: 'center', color: 'fg.muted' }}>
                No repositories match.
              </Box>
            </Box>
          )}
        </Box>
      </Box>
    </Box>
  );
}

function Sparkline({ series }: { series: number[] }) {
  const w = 80;
  const h = 24;
  const max = Math.max(1, ...series);
  const barW = w / Math.max(series.length, 1);
  const gap = 1;
  const total = series.reduce((s, n) => s + n, 0);
  if (total === 0) {
    return (
      <Box sx={{ color: 'fg.muted', fontSize: 0 }} title="No merged PRs in the last 14 days">
        —
      </Box>
    );
  }
  return (
    <Box title={`${total} merged PR${total === 1 ? '' : 's'} in the last 14 days`} sx={{ display: 'inline-block', lineHeight: 0 }}>
      <svg width={w} height={h} role="img" aria-label={`Activity sparkline, ${total} merged in 14 days`}>
        {series.map((v, i) => {
          const bh = v === 0 ? 1 : (v / max) * (h - 2);
          return (
            <rect
              key={i}
              x={i * barW + gap / 2}
              y={h - bh}
              width={Math.max(0, barW - gap)}
              height={bh}
              fill={v === 0 ? 'var(--border-muted)' : 'var(--accent-emphasis)'}
              rx={0.5}
            />
          );
        })}
      </svg>
    </Box>
  );
}

function CapacityGauge({
  open,
  threshold,
  contributors,
}: {
  open: number;
  threshold: number | null;
  contributors: number;
}) {
  if (threshold == null || threshold <= 0) {
    return (
      <Box sx={{ color: 'fg.muted', fontSize: 0 }} title="No threshold configured">
        —
      </Box>
    );
  }
  if (contributors <= 0) {
    // No merged contributors yet — comparing total openPrCount against a
    // per-author threshold is meaningless. Render an em-dash with an
    // explanatory tooltip rather than a misleading full-red bar.
    return (
      <Box
        sx={{ color: 'fg.muted', fontSize: 0 }}
        title={`${open} open PR${open === 1 ? '' : 's'}, no merged contributors yet — capacity ratio not meaningful`}
      >
        —
      </Box>
    );
  }
  const avg = open / contributors;
  const pct = Math.min(100, (avg / threshold) * 100);
  // 0–49% green, 50–80% amber, >80% red.
  const tone = pct > 80 ? 'danger' : pct >= 50 ? 'attention' : 'success';
  return (
    <Box
      sx={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'stretch', gap: '3px', minWidth: 80 }}
      title={`${open} open PR${open === 1 ? '' : 's'} across ${contributors} contributor${contributors === 1 ? '' : 's'} — avg ${avg.toFixed(2)} / ${threshold} per-author limit`}
    >
      <Box sx={{ width: '100%', height: 6, bg: 'canvas.inset', borderRadius: 999, overflow: 'hidden' }}>
        <Box sx={{ height: '100%', bg: `${tone}.emphasis` }} style={{ width: `${pct}%` }} />
      </Box>
      <Text sx={{ fontFamily: 'mono', fontVariantNumeric: 'tabular-nums', fontSize: 0, color: `${tone}.fg` }}>
        {avg.toFixed(1)} / {threshold}
      </Text>
    </Box>
  );
}

function DiscoveryCell({ repo }: { repo: GtRepo }) {
  // `issueDiscoveryShare` is a 0..1 fraction of this repo's emission allocated
  // to issue discovery (vs OSS PR rewards).
  const share = repo.issueDiscoveryShare;
  if (share == null) {
    return (
      <Text sx={{ color: 'fg.muted', fontSize: 0 }} title="Not configured upstream">
        —
      </Text>
    );
  }
  return (
    <Text
      sx={{
        fontFamily: 'mono',
        fontVariantNumeric: 'tabular-nums',
        fontWeight: share > 0 ? 700 : 500,
        color: share > 0 ? 'fg.default' : 'fg.muted',
      }}
      title="Fraction of this repo's emission allocated to issue discovery"
    >
      {formatPercent(share, { scale: 100 })}
    </Text>
  );
}

function PolicyChips({ repo }: { repo: GtRepo }) {
  type Chip = { label: string; title: string };
  const chips: Chip[] = [];
  if (repo.trustedLabelPipeline === true) chips.push({ label: 'trusted-label', title: 'Scoring-label pipeline is trusted' });
  if (repo.issueDiscoveryShare != null && repo.issueDiscoveryShare > 0) {
    chips.push({
      label: `discovery ${Math.round(repo.issueDiscoveryShare * 100)}%`,
      title: 'Share of emission allocated to issue discovery',
    });
  }
  if (repo.maintainerCut != null && repo.maintainerCut > 0) {
    chips.push({
      label: `maintainer ${Math.round(repo.maintainerCut * 100)}%`,
      title: 'Share of emission reserved for registered maintainers',
    });
  }
  if (repo.minCredibility != null) {
    chips.push({
      label: `min-cred ${repo.minCredibility.toFixed(1)}`,
      title: 'Minimum PR credibility required for rewards',
    });
  }
  if (chips.length === 0) {
    return (
      <Text sx={{ color: 'fg.muted', fontSize: 0 }}>—</Text>
    );
  }
  const visible = chips.slice(0, 3);
  const overflow = chips.slice(3);
  return (
    <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
      {visible.map((c) => (
        <Chip key={c.label} label={c.label} title={c.title} />
      ))}
      {overflow.length > 0 && (
        <Chip
          label={`+${overflow.length}`}
          title={overflow.map((c) => c.label).join(', ')}
        />
      )}
    </Box>
  );
}

function Chip({ label, title }: { label: string; title: string }) {
  return (
    <Box
      title={title}
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        px: 1,
        py: '1px',
        border: '1px solid',
        borderColor: 'border.muted',
        borderRadius: 999,
        bg: 'canvas.default',
        color: 'fg.muted',
        fontSize: '10px',
        fontWeight: 600,
        letterSpacing: '0.2px',
        whiteSpace: 'nowrap',
      }}
    >
      {label}
    </Box>
  );
}

function ExpandedRowDetail({ repo }: { repo: GtRepo }) {
  const { data: miners, isLoading: minersLoading } = useQuery<RepoMinersResponse>({
    queryKey: ['repo-miners', repo.fullName],
    queryFn: async () => {
      const r = await fetch(`/api/gt/repos/${repo.owner}/${repo.name}/miners`);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.json();
    },
    staleTime: 60_000,
    refetchOnMount: false,
  });

  const { data: prsResp, isLoading: prsLoading } = useQuery<GtRepoPrsResponse>({
    queryKey: ['repo-prs', repo.fullName],
    queryFn: async () => {
      const r = await fetch(`/api/gt/repos/${repo.owner}/${repo.name}/prs`);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.json();
    },
    staleTime: 60_000,
    refetchOnMount: false,
  });

  const topContributors = (miners?.ossContributions ?? []).slice(0, 5);
  const openPrs = useMemo(() => {
    const list = prsResp?.prs ?? [];
    return list
      .filter((p) => p.prState === 'OPEN')
      .sort((a, b) => Date.parse(a.prCreatedAt) - Date.parse(b.prCreatedAt))
      .slice(0, 5);
  }, [prsResp]);

  const labelEntries = useMemo(() => {
    const m = repo.labelMultipliers;
    if (!m) return [] as Array<[string, number]>;
    return Object.entries(m).sort((a, b) => b[1] - a[1]);
  }, [repo.labelMultipliers]);
  const labelsTop = labelEntries.slice(0, 6);
  const labelsOverflow = labelEntries.slice(6);

  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: ['1fr', null, null, 'repeat(3, minmax(0, 1fr))'],
        gap: 3,
        p: 3,
      }}
    >
      {/* Column 1 — Top contributors */}
      <DetailColumn title="TOP CONTRIBUTORS · LAST 90D">
        {minersLoading ? (
          <DetailListSkeleton rows={5} />
        ) : topContributors.length === 0 ? (
          <EmptyHint>No contributor activity yet.</EmptyHint>
        ) : (
          topContributors.map((m) => {
            const share = repo.totalScore > 0 ? (m.score / repo.totalScore) * 100 : 0;
            return (
              <Link
                key={`${m.githubId}-${m.githubUsername}`}
                href={`https://github.com/${m.githubUsername}`}
                target="_blank"
                rel="noopener noreferrer"
                prefetch={false}
                onClick={(e) => e.stopPropagation()}
                style={{ display: 'block', textDecoration: 'none' }}
              >
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 2,
                    py: '6px',
                    borderTop: '1px solid',
                    borderColor: 'border.muted',
                    '&:first-of-type': { borderTop: 'none' },
                    '&:hover': { bg: 'canvas.default' },
                    mx: -2,
                    px: 2,
                    borderRadius: 1,
                  }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={m.avatarUrl}
                    alt={m.githubUsername}
                    loading="lazy"
                    style={{ width: 22, height: 22, borderRadius: '50%', border: '1px solid var(--border-muted)' }}
                  />
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Text
                      sx={{
                        display: 'block',
                        color: 'fg.default',
                        fontWeight: 600,
                        fontSize: 1,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {m.githubUsername}
                    </Text>
                    <Text sx={{ display: 'block', color: 'fg.muted', fontSize: 0 }}>
                      {m.prCount} PR{m.prCount === 1 ? '' : 's'}
                    </Text>
                  </Box>
                  <Box sx={{ textAlign: 'right' }}>
                    <Text sx={{ display: 'block', fontFamily: 'mono', fontVariantNumeric: 'tabular-nums', fontWeight: 700, color: 'fg.default' }}>
                      {m.score.toFixed(2)}
                    </Text>
                    <Text sx={{ display: 'block', fontFamily: 'mono', fontVariantNumeric: 'tabular-nums', fontSize: 0, color: 'fg.muted' }}>
                      {share >= 1 ? `${share.toFixed(0)}%` : share > 0 ? `${share.toFixed(1)}%` : '—'}
                    </Text>
                  </Box>
                </Box>
              </Link>
            );
          })
        )}
      </DetailColumn>

      {/* Column 2 — Open PRs (oldest first) */}
      <DetailColumn title="OPEN PRS · OLDEST FIRST">
        {prsLoading ? (
          <DetailListSkeleton rows={5} />
        ) : openPrs.length === 0 ? (
          <EmptyHint>No open PRs right now.</EmptyHint>
        ) : (
          openPrs.map((p) => (
            <Link
              key={p.pullRequestNumber}
              href={`https://github.com/${repo.fullName}/pull/${p.pullRequestNumber}`}
              target="_blank"
              rel="noopener noreferrer"
              prefetch={false}
              onClick={(e) => e.stopPropagation()}
              style={{ display: 'block', textDecoration: 'none' }}
            >
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 2,
                  py: '6px',
                  borderTop: '1px solid',
                  borderColor: 'border.muted',
                  '&:first-of-type': { borderTop: 'none' },
                  '&:hover': { bg: 'canvas.default' },
                  mx: -2,
                  px: 2,
                  borderRadius: 1,
                }}
              >
                <Box sx={{ color: 'success.fg', display: 'inline-flex', mt: '2px', flexShrink: 0 }}>
                  <GitPullRequestIcon size={12} />
                </Box>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Text
                    sx={{
                      display: 'block',
                      color: 'fg.default',
                      fontWeight: 500,
                      fontSize: 1,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                    title={p.title}
                  >
                    <Text as="span" sx={{ color: 'fg.muted', fontFamily: 'mono' }}>
                      #{p.pullRequestNumber}
                    </Text>{' '}
                    {p.title}
                  </Text>
                  <Text sx={{ display: 'block', color: 'fg.muted', fontSize: 0 }}>
                    {p.author} · {formatRelativeTime(p.prCreatedAt)}
                  </Text>
                </Box>
                {p.score > 0 && (
                  <Box
                    sx={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      px: 1,
                      py: '1px',
                      border: '1px solid',
                      borderColor: 'border.muted',
                      borderRadius: 999,
                      bg: 'canvas.default',
                      fontFamily: 'mono',
                      fontVariantNumeric: 'tabular-nums',
                      fontSize: 0,
                      fontWeight: 700,
                      color: 'fg.default',
                      flexShrink: 0,
                    }}
                  >
                    {p.score.toFixed(2)}
                  </Box>
                )}
              </Box>
            </Link>
          ))
        )}
      </DetailColumn>

      {/* Column 3 — Label multiplier breakdown */}
      <DetailColumn title="LABEL MULTIPLIERS">
        {labelsTop.length === 0 ? (
          <Box sx={{ pt: 1 }}>
            <Chip label="default labels" title="No per-label multipliers configured — default 1.0 applies" />
          </Box>
        ) : (
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, pt: 1 }}>
            {labelsTop.map(([name, mult]) => (
              <Chip
                key={name}
                label={`${name} ×${mult.toFixed(2)}`}
                title={`${name}: scoring multiplier ${mult.toFixed(2)}`}
              />
            ))}
            {labelsOverflow.length > 0 && (
              <Chip
                label={`+${labelsOverflow.length} more`}
                title={labelsOverflow.map(([n, m]) => `${n} ×${m.toFixed(2)}`).join(', ')}
              />
            )}
          </Box>
        )}
      </DetailColumn>
    </Box>
  );
}

function DetailColumn({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
      <Text
        sx={{
          fontSize: '11px',
          fontWeight: 600,
          letterSpacing: '0.5px',
          color: 'fg.muted',
          textTransform: 'uppercase',
          mb: 2,
        }}
      >
        {title}
      </Text>
      <Box sx={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>{children}</Box>
    </Box>
  );
}

function DetailListSkeleton({ rows }: { rows: number }) {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
      {Array.from({ length: rows }).map((_, i) => (
        <Box key={i} sx={{ display: 'flex', alignItems: 'center', gap: 2, opacity: Math.max(0.25, 1 - i * 0.15) }}>
          <SkeletonBar width={22} height={22} rounded={999} />
          <SkeletonBar flex={1} height={10} />
          <SkeletonBar width={40} height={10} />
        </Box>
      ))}
    </Box>
  );
}

function Th({
  children,
  align = 'left',
  width,
  sortKey,
  current,
  dir,
  onSort,
}: {
  children?: React.ReactNode;
  align?: 'left' | 'right' | 'center';
  width?: number;
  sortKey?: SortKey;
  current?: SortKey;
  dir?: 'asc' | 'desc';
  onSort?: (k: SortKey) => void;
}) {
  const isSortable = !!sortKey && !!onSort;
  const active = isSortable && current === sortKey;
  return (
    <Box
      as="th"
      onClick={isSortable && sortKey ? () => onSort!(sortKey) : undefined}
      sx={{
        p: 2,
        textAlign: align,
        width,
        fontWeight: 600,
        fontSize: '11px',
        color: active ? 'fg.default' : 'fg.muted',
        textTransform: 'uppercase',
        letterSpacing: '0.5px',
        whiteSpace: 'nowrap',
        cursor: isSortable ? 'pointer' : 'default',
        userSelect: 'none',
        '&:hover': isSortable ? { color: 'fg.default' } : undefined,
      }}
    >
      <Box
        sx={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 1,
          justifyContent: align === 'right' ? 'flex-end' : align === 'center' ? 'center' : 'flex-start',
        }}
      >
        {active && (dir === 'desc' ? <TriangleDownIcon size={12} /> : <TriangleUpIcon size={12} />)}
        {children}
      </Box>
    </Box>
  );
}
