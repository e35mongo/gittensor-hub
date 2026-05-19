'use client';

export const dynamic = 'force-dynamic';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { PageLayout, Heading, Text, Box, Label, Link as PrimerLink, TextInput } from '@primer/react';
import { RepoIcon, IssueOpenedIcon, GitPullRequestIcon, TriangleUpIcon, TriangleDownIcon, SearchIcon, StarIcon, StarFillIcon, ChevronLeftIcon, ChevronRightIcon } from '@primer/octicons-react';
import { PullStatusBadge } from '@/components/StatusBadge';
import { formatRelativeTime, isRecent } from '@/lib/format';
import Spinner from '@/components/Spinner';
import { TableRowsSkeleton } from '@/components/Skeleton';
import Dropdown from '@/components/Dropdown';
import AuthorFilter from '@/components/AuthorFilter';
import AuthorSidebar from '@/components/AuthorSidebar';
import type { PullDto } from '@/lib/api-types';
import ContentViewer from '@/components/ContentViewer';
import { useSettings } from '@/lib/settings';
import { useSn74Repos, lookupWeight } from '@/lib/use-sn74-repos';
import { useTrackedRepos } from '@/lib/tracked-repos';

interface AggPull extends PullDto {
  linked_issues: Array<{ repo: string; number: number }>;
}

interface PullsResp {
  count: number;
  repo_count: number;
  page: number;
  page_size: number;
  total_pages: number;
  authors: Array<{ login: string; count: number }>;
  author_count: number;
  pulls: AggPull[];
}

interface UserReposResp {
  count: number;
  repos: Array<{ full_name: string; weight: number }>;
}

type StateFilter = 'all' | 'open' | 'draft' | 'merged' | 'closed';
type CloseFilter = 'all' | 'merged' | 'closed' | 'still_open';
type SortKey = 'updated' | 'opened' | 'closed' | 'repo' | 'weight' | 'number';
type SortDir = 'asc' | 'desc';
type AuthorTarget = { owner: string; name: string; repoFullName: string; login: string; association: string | null };

const PULLS_CONTENT_MAX_WIDTH = 1480;

export default function AllPullsPage() {
  const { repos: sn74Repos, weights: repoWeights, isSuccess: sn74ReposReady } = useSn74Repos();
  const [query, setQuery] = useState('');
  const [stateFilter, setStateFilter] = useState<StateFilter>('all');
  const [sortKey, setSortKey] = useState<SortKey>('updated');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [trackedOnly, setTrackedOnly] = useState(false);
  const [page, setPage] = useState(1);
  const [authorFilter, setAuthorFilter] = useState<string>('all');
  const [openPull, setOpenPull] = useState<AggPull | null>(null);
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const [authorTarget, setAuthorTarget] = useState<AuthorTarget | null>(null);

  const { settings, update } = useSettings();
  const { tracked, toggle: toggleTrackedRepo } = useTrackedRepos();
  const pageSize = settings.pageSize > 0 ? settings.pageSize : 50;

  const { data: userReposData, isSuccess: userReposReady } = useQuery<UserReposResp>({
    queryKey: ['user-repos'],
    queryFn: async ({ signal }) => {
      const r = await fetch('/api/user-repos', { signal });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.json();
    },
    refetchInterval: 5 * 60 * 1000,
    staleTime: 4 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const currentRepoNames = useMemo(() => {
    const names = new Map<string, string>();
    for (const repo of sn74Repos) names.set(repo.fullName.toLowerCase(), repo.fullName);
    for (const repo of userReposData?.repos ?? []) {
      if (!names.has(repo.full_name.toLowerCase())) names.set(repo.full_name.toLowerCase(), repo.full_name);
    }
    return names;
  }, [sn74Repos, userReposData]);

  const scopedTracked = useMemo(() => {
    const trackedNames = Array.from(tracked);
    if (!sn74ReposReady || !userReposReady) return trackedNames;
    return trackedNames.filter((name) => currentRepoNames.has(name.toLowerCase()));
  }, [currentRepoNames, sn74ReposReady, tracked, userReposReady]);

  const scopedTrackedSet = useMemo(
    () => new Set(scopedTracked.map((name) => name.toLowerCase())),
    [scopedTracked],
  );

  const displayWeights = useMemo(() => {
    const weights = new Map(repoWeights);
    for (const repo of userReposData?.repos ?? []) weights.set(repo.full_name.toLowerCase(), repo.weight);
    return weights;
  }, [repoWeights, userReposData]);

  const trackedRepoParam = useMemo(() => {
    if (!trackedOnly) return null;
    return scopedTracked
      .map((name) => currentRepoNames.get(name.toLowerCase()) ?? name)
      .sort((a, b) => a.localeCompare(b))
      .join(',');
  }, [currentRepoNames, scopedTracked, trackedOnly]);

  const handleRowClick = (pr: AggPull) => {
    if (settings.contentDisplay === 'modal' || settings.contentDisplay === 'side') {
      setOpenPull(pr);
    } else {
      const k = `${pr.repo_full_name}#${pr.number}`;
      setExpandedKey((prev) => (prev === k ? null : k));
    }
  };

  const openAuthorDetails = (pr: AggPull) => {
    if (!pr.author_login) return;
    const [owner, name] = pr.repo_full_name.split('/');
    setOpenPull(null);
    setExpandedKey(null);
    setAuthorTarget({
      owner,
      name,
      repoFullName: pr.repo_full_name,
      login: pr.author_login,
      association: pr.author_association ?? null,
    });
  };

  const openPullFromAuthor = (pr: AggPull) => {
    setAuthorTarget(null);
    const key = `${pr.repo_full_name}#${pr.number}`;
    if (settings.contentDisplay === 'accordion' && rows.some((row) => `${row.repo_full_name}#${row.number}` === key)) {
      setOpenPull(null);
      setExpandedKey(key);
      return;
    }
    setExpandedKey(null);
    setOpenPull(pr);
  };

  const pullsParams = useMemo(() => {
    const sp = new URLSearchParams();
    sp.set('page', String(page));
    sp.set('pageSize', String(pageSize));
    sp.set('sort', sortKey);
    sp.set('dir', sortDir);
    if (query.trim()) sp.set('q', query.trim());
    if (stateFilter !== 'all') sp.set('state', stateFilter);
    if (authorFilter !== 'all') sp.set('author', authorFilter);
    if (trackedRepoParam !== null) sp.set('repos', trackedRepoParam);
    return sp.toString();
  }, [authorFilter, page, pageSize, query, sortDir, sortKey, stateFilter, trackedRepoParam]);

  const { data, isLoading, isFetching } = useQuery<PullsResp>({
    queryKey: ['all-pulls', pullsParams],
    queryFn: async ({ signal }) => {
      const r = await fetch(`/api/pulls?${pullsParams}`, { signal });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.json();
    },
    refetchInterval: 15000,
    placeholderData: keepPreviousData,
  });
  const rows = data?.pulls ?? [];
  const totalItems = data?.count ?? 0;
  const totalPages = data?.total_pages ?? page;
  const safePage = Math.min(page, totalPages);
  const authorOptions = data?.authors ?? [];

  useEffect(() => {
    setPage(1);
  }, [query, stateFilter, sortKey, sortDir, trackedOnly, trackedRepoParam, authorFilter, pageSize]);

  useEffect(() => {
    if (data && page > data.total_pages) setPage(data.total_pages);
  }, [data, page]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir(key === 'opened' || key === 'closed' || key === 'updated' || key === 'weight' ? 'desc' : 'asc');
    }
  };

  return (
    <PageLayout containerWidth="full" padding="normal">
      <PageLayout.Header>
        <Box sx={{ width: '100%', maxWidth: PULLS_CONTENT_MAX_WIDTH, mx: 'auto' }}>
          <Heading sx={{ fontSize: 4, mb: 1 }}>Pull Requests</Heading>
          <Text sx={{ color: 'fg.muted' }}>
            Live aggregated view across current SN74 and custom repositories. Star a repo to highlight its PRs; toggle{' '}
            <strong>Tracked only</strong> to filter to your watchlist.
          </Text>
        </Box>
      </PageLayout.Header>
      <PageLayout.Content>
        <Box sx={{ width: '100%', maxWidth: PULLS_CONTENT_MAX_WIDTH, mx: 'auto' }}>
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 3,
            mb: 3,
            p: 2,
            border: '1px solid',
            borderColor: 'var(--border-default)',
            borderRadius: 2,
            bg: 'var(--bg-subtle)',
            flexWrap: 'wrap',
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap', minWidth: 0 }}>
            <TextInput
              leadingVisual={SearchIcon}
              placeholder="Filter by title, repo, #, author…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              sx={{ width: [280, 360, 380], maxWidth: '100%' }}
            />
            <Dropdown
              value={stateFilter}
              onChange={(v) => setStateFilter(v as StateFilter)}
              options={[
                { value: 'all', label: 'All states' },
                { value: 'open', label: 'Open' },
                { value: 'draft', label: 'Draft' },
                { value: 'merged', label: 'Merged' },
                { value: 'closed', label: 'Closed (unmerged)' },
              ]}
              width={180}
              ariaLabel="Filter by state"
            />
            <Box
              onClick={() => setTrackedOnly((v) => !v)}
              sx={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 1,
                px: '12px',
                py: '5px',
                borderRadius: '6px',
                border: '1px solid',
                borderColor: trackedOnly ? 'var(--attention-emphasis)' : 'var(--border-default)',
                bg: trackedOnly ? 'var(--attention-subtle, rgba(242, 201, 76, 0.14))' : 'var(--bg-emphasis)',
                color: trackedOnly ? 'var(--attention-emphasis)' : 'var(--fg-default)',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: 500,
                lineHeight: '20px',
                userSelect: 'none',
                '&:hover': { borderColor: 'var(--border-strong)' },
              }}
            >
              {trackedOnly ? <StarFillIcon size={14} /> : <StarIcon size={14} />}
              Tracked only ({scopedTracked.length})
            </Box>
          </Box>
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: ['space-between', null, 'flex-end'],
              gap: 2,
              color: 'fg.muted',
              fontSize: 0,
              flex: ['1 1 100%', null, '0 1 auto'],
              minWidth: ['100%', null, 'auto'],
              flexWrap: 'wrap',
            }}
          >
            <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 2, whiteSpace: 'nowrap' }}>
              {isFetching && <Spinner size="sm" tone="muted" />}
              {data && (
                <Text>
                  {data.count} PRs across {data.repo_count} repos · live
                </Text>
              )}
            </Box>
            {data && data.count > 0 && (
              <PullsPagination
                page={safePage}
                totalPages={totalPages}
                totalItems={totalItems}
                pageSize={pageSize}
                onChange={setPage}
                onPageSizeChange={(n) => {
                  update('pageSize', n);
                  setPage(1);
                }}
                rawPageSize={settings.pageSize}
              />
            )}
          </Box>
        </Box>

        <Box sx={{ border: '1px solid', borderColor: 'border.default', borderRadius: 2, overflowX: 'auto', overflowY: 'hidden', bg: 'canvas.default' }}>
          <Box as="table" sx={{ width: '100%', minWidth: 1100, borderCollapse: 'collapse', fontSize: 1 }}>
            <Box as="thead" sx={{ bg: 'canvas.subtle', borderBottom: '1px solid', borderColor: 'border.default' }}>
              <Box as="tr">
                <Box as="th" sx={{ ...headerCellSx, width: 44, textAlign: 'center' }} aria-label="Tracked repository" />
                <HeaderCell label="State" />
                <HeaderCell label="Pull Request" />
                <HeaderCell label="Repository" onClick={() => toggleSort('repo')} active={sortKey === 'repo'} dir={sortDir} />
                <HeaderCell label="Weight" onClick={() => toggleSort('weight')} active={sortKey === 'weight'} dir={sortDir} align="right" />
                <Box as="th" sx={{ ...headerCellSx, py: '4px' }}>
                  <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 1 }}>
                    <Box sx={{ color: authorFilter !== 'all' ? 'accent.fg' : 'inherit' }}>Author</Box>
                    <AuthorFilter
                      value={authorFilter}
                      onChange={setAuthorFilter}
                      authors={authorOptions}
                      totalAuthors={data?.author_count ?? authorOptions.length}
                      width={260}
                      ariaLabel="Filter by author"
                    />
                  </Box>
                </Box>
                <HeaderCell label="Linked issue" />
                <HeaderCell label="Opened" onClick={() => toggleSort('opened')} active={sortKey === 'opened'} dir={sortDir} />
                <HeaderCell label="Updated" onClick={() => toggleSort('updated')} active={sortKey === 'updated'} dir={sortDir} />
                <HeaderCell label="Merged / Closed" onClick={() => toggleSort('closed')} active={sortKey === 'closed'} dir={sortDir} />
              </Box>
            </Box>
            <Box as="tbody">
              {isLoading && rows.length === 0 && (
                <Box as="tr">
                  <Box as="td" colSpan={10} sx={{ p: 0 }}>
                    <TableRowsSkeleton
                      rows={12}
                      cols={[
                        { width: 32 },
                        { width: 60 },
                        { flex: 1 },
                        { width: 120 },
                        { width: 60 },
                        { width: 100 },
                        { width: 60 },
                        { width: 60 },
                        { width: 60 },
                        { width: 60 },
                      ]}
                    />
                  </Box>
                </Box>
              )}
              {!isLoading && rows.length === 0 && (
                <Box as="tr">
                  <Box as="td" colSpan={10} sx={{ p: 4, textAlign: 'center', color: 'fg.muted' }}>
                    {data && data.count === 0
                      ? 'No PRs cached for current repositories yet. Visit a repo page or run the poller to populate.'
                      : 'No PRs match these filters.'}
                  </Box>
                </Box>
              )}
              {rows.map((pr) => {
                const [o, n] = pr.repo_full_name.split('/');
                const k = `${pr.repo_full_name}#${pr.number}`;
                const expanded = expandedKey === k;
                return (
                  <React.Fragment key={k}>
                    <PullTableRow
                      pr={pr}
                      tracked={scopedTrackedSet.has(pr.repo_full_name.toLowerCase())}
                      onToggleTrack={() => toggleTrackedRepo(pr.repo_full_name)}
                      onRowClick={() => handleRowClick(pr)}
                      onAuthorClick={() => openAuthorDetails(pr)}
                      expanded={expanded}
                      weight={lookupWeight(displayWeights, pr.repo_full_name) ?? 0}
                    />
                    {expanded && settings.contentDisplay === 'accordion' && (
                      <Box as="tr">
                        <Box as="td" colSpan={10} sx={{ p: 0 }}>
                          <ContentViewer
                            target={{ kind: 'pull', owner: o, name: n, number: pr.number, preloaded: pr }}
                            mode="inline"
                            onClose={() => setExpandedKey(null)}
                          />
                        </Box>
                      </Box>
                    )}
                  </React.Fragment>
                );
              })}
            </Box>
          </Box>
        </Box>

        {data && data.count > 0 && (
          <Box sx={{ mt: 3, display: 'flex', justifyContent: 'flex-end' }}>
            <PullsPagination
              page={safePage}
              totalPages={totalPages}
              totalItems={totalItems}
              pageSize={pageSize}
              onChange={setPage}
              onPageSizeChange={(n) => {
                update('pageSize', n);
                setPage(1);
              }}
              rawPageSize={settings.pageSize}
            />
          </Box>
        )}
      </Box>
      </PageLayout.Content>

      {authorTarget && (
        <>
          <Box
            onMouseDown={() => setAuthorTarget(null)}
            sx={{
              position: 'fixed',
              inset: 0,
              zIndex: 109,
              bg: 'rgba(1, 4, 9, 0.28)',
            }}
          />
          <Box
            sx={{
              position: 'fixed',
              top: 'var(--header-height)',
              right: 0,
              bottom: 0,
              width: ['calc(100vw - 24px)', null, 'min(760px, 52vw)'],
              maxWidth: 'calc(100vw - 24px)',
              borderLeft: '1px solid',
              borderColor: 'var(--border-default)',
              bg: 'var(--bg-canvas)',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              boxShadow: '-18px 0 36px rgba(1, 4, 9, 0.36)',
              zIndex: 110,
            }}
          >
            <AuthorSidebar
              owner={authorTarget.owner}
              name={authorTarget.name}
              repoFullName={authorTarget.repoFullName}
              login={authorTarget.login}
              initialAssociation={authorTarget.association}
              onClose={() => setAuthorTarget(null)}
              onIssueClick={(issue) => openPullFromAuthor(issue as unknown as AggPull)}
            />
          </Box>
        </>
      )}

      {openPull && settings.contentDisplay === 'modal' && (() => {
        const [o, n] = openPull.repo_full_name.split('/');
        return (
          <ContentViewer
            target={{ kind: 'pull', owner: o, name: n, number: openPull.number, preloaded: openPull }}
            mode="modal"
            onClose={() => setOpenPull(null)}
          />
        );
      })()}

      {openPull && settings.contentDisplay === 'side' && (() => {
        const [o, n] = openPull.repo_full_name.split('/');
        return (
          <Box
            sx={{
              position: 'fixed',
              top: 'var(--header-height)',
              right: 0,
              bottom: 0,
              width: 480,
              maxWidth: '50vw',
              borderLeft: '1px solid',
              borderColor: 'var(--border-default)',
              bg: 'var(--bg-canvas)',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              zIndex: 90,
            }}
          >
            <ContentViewer
              target={{ kind: 'pull', owner: o, name: n, number: openPull.number, preloaded: openPull }}
              mode="side"
              onClose={() => setOpenPull(null)}
            />
          </Box>
        );
      })()}
    </PageLayout>
  );
}

const headerCellSx = {
  px: 3,
  py: 2,
  textAlign: 'left' as const,
  fontWeight: 600,
  fontSize: '11px',
  color: 'fg.muted',
  textTransform: 'uppercase' as const,
  letterSpacing: '0.5px',
  whiteSpace: 'nowrap' as const,
};

function FilterHeaderCell({
  label,
  value,
  onChange,
  options,
  width,
  rightSort,
}: {
  label: string;
  value: string;
  onChange: (next: string) => void;
  options: { value: string; label: string }[];
  width: number;
  rightSort?: { active: boolean; dir: SortDir; onClick: () => void };
}) {
  const isFiltered = value !== 'all';
  return (
    <Box as="th" sx={{ ...headerCellSx, py: '4px' }}>
      <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 1 }}>
        <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 1, color: isFiltered ? 'accent.fg' : 'inherit' }}>
          {label}
          {isFiltered && (
            <Box
              sx={{
                width: 6,
                height: 6,
                borderRadius: '50%',
                bg: 'accent.emphasis',
                display: 'inline-block',
              }}
              title="Filter active"
            />
          )}
        </Box>
        <Dropdown
          value={value}
          onChange={onChange}
          options={options}
          width={width}
          size="small"
          ariaLabel={`Filter by ${label}`}
        />
        {rightSort && (
          <Box
            as="button"
            onClick={rightSort.onClick}
            sx={{
              cursor: 'pointer',
              border: 'none',
              bg: 'transparent',
              color: rightSort.active ? 'fg.default' : 'fg.muted',
              p: '2px',
              ml: 1,
              display: 'inline-flex',
              alignItems: 'center',
              borderRadius: 1,
              '&:hover': { color: 'fg.default' },
            }}
            aria-label="Toggle sort"
          >
            {rightSort.dir === 'asc' ? <TriangleUpIcon size={12} /> : <TriangleDownIcon size={12} />}
          </Box>
        )}
      </Box>
    </Box>
  );
}

function HeaderCell({
  label,
  onClick,
  active,
  dir,
  align = 'left',
}: {
  label: string;
  onClick?: () => void;
  active?: boolean;
  dir?: SortDir;
  align?: 'left' | 'right';
}) {
  return (
    <Box
      as="th"
      onClick={onClick}
      sx={{
        ...headerCellSx,
        textAlign: align,
        cursor: onClick ? 'pointer' : 'default',
        userSelect: 'none',
        '&:hover': onClick ? { color: 'fg.default' } : undefined,
      }}
    >
      <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 1 }}>
        {label}
        {active && (dir === 'asc' ? <TriangleUpIcon size={12} /> : <TriangleDownIcon size={12} />)}
      </Box>
    </Box>
  );
}

function PullsPagination({
  page,
  totalPages,
  totalItems,
  pageSize,
  onChange,
  onPageSizeChange,
  rawPageSize,
}: {
  page: number;
  totalPages: number;
  totalItems: number;
  pageSize: number;
  onChange: (next: number) => void;
  onPageSizeChange?: (size: number) => void;
  rawPageSize?: number;
}) {
  const start = totalItems === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, totalItems);
  const canPrev = page > 1;
  const canNext = page < totalPages;

  const navBtn = (label: React.ReactNode, target: number, disabled: boolean, aria: string) => (
    <button
      key={aria}
      type="button"
      onClick={() => onChange(target)}
      disabled={disabled}
      aria-label={aria}
      title={aria}
      className="gt-pag-btn"
      data-disabled={disabled ? 'true' : 'false'}
    >
      {label}
    </button>
  );

  return (
    <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 2, fontSize: 0, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
      <Text sx={{ color: 'var(--fg-muted)', whiteSpace: 'nowrap' }}>
        <strong>{start}</strong>–<strong>{end}</strong> of <strong>{totalItems}</strong>
      </Text>
      {onPageSizeChange && (
        <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 1 }}>
          <Text sx={{ color: 'var(--fg-muted)', whiteSpace: 'nowrap' }}>Rows</Text>
          <Dropdown
            value={String(rawPageSize && rawPageSize > 0 ? rawPageSize : pageSize)}
            onChange={(v) => onPageSizeChange(parseInt(v, 10))}
            options={[
              { value: '10', label: '10' },
              { value: '25', label: '25' },
              { value: '50', label: '50' },
              { value: '100', label: '100' },
            ]}
            width={72}
            size="small"
            ariaLabel="Rows per page"
          />
        </Box>
      )}
      <Box className="gt-pag-group">
        {navBtn(<DoubleChevron dir="left" />, 1, !canPrev, 'First page')}
        {navBtn(<ChevronLeftIcon size={14} />, page - 1, !canPrev, 'Previous page')}
        <Box className="gt-pag-label">
          <Text sx={{ color: 'var(--fg-default)', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
            {page}
          </Text>
          <Text sx={{ color: 'var(--fg-muted)', mx: '4px' }}>/</Text>
          <Text sx={{ color: 'var(--fg-muted)', fontVariantNumeric: 'tabular-nums' }}>
            {totalPages}
          </Text>
        </Box>
        {navBtn(<ChevronRightIcon size={14} />, page + 1, !canNext, 'Next page')}
        {navBtn(<DoubleChevron dir="right" />, totalPages, !canNext, 'Last page')}
      </Box>
    </Box>
  );
}

function DoubleChevron({ dir }: { dir: 'left' | 'right' }) {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true">
      {dir === 'left' ? (
        <>
          <path d="M9.78 4.22a.75.75 0 0 1 0 1.06L7.06 8l2.72 2.72a.75.75 0 1 1-1.06 1.06L5.47 8.53a.75.75 0 0 1 0-1.06l3.25-3.25a.75.75 0 0 1 1.06 0Z" fill="currentColor" />
          <path d="M5.78 4.22a.75.75 0 0 1 0 1.06L3.06 8l2.72 2.72a.75.75 0 1 1-1.06 1.06L1.47 8.53a.75.75 0 0 1 0-1.06l3.25-3.25a.75.75 0 0 1 1.06 0Z" fill="currentColor" />
        </>
      ) : (
        <>
          <path d="M6.22 4.22a.75.75 0 0 1 1.06 0l3.25 3.25a.75.75 0 0 1 0 1.06l-3.25 3.25a.75.75 0 1 1-1.06-1.06L8.94 8 6.22 5.28a.75.75 0 0 1 0-1.06Z" fill="currentColor" />
          <path d="M10.22 4.22a.75.75 0 0 1 1.06 0l3.25 3.25a.75.75 0 0 1 0 1.06l-3.25 3.25a.75.75 0 1 1-1.06-1.06L12.94 8l-2.72-2.72a.75.75 0 0 1 0-1.06Z" fill="currentColor" />
        </>
      )}
    </svg>
  );
}

function PullTableRow({
  pr,
  tracked,
  onToggleTrack,
  onRowClick,
  onAuthorClick,
  expanded,
  weight,
}: {
  pr: AggPull;
  tracked: boolean;
  onToggleTrack?: () => void;
  onRowClick?: () => void;
  onAuthorClick?: () => void;
  expanded?: boolean;
  weight: number;
}) {
  const [owner, name] = pr.repo_full_name.split('/');

  return (
    <Box
      as="tr"
      onClick={onRowClick}
      data-explorer-row="true"
      sx={{
        borderBottom: '1px solid',
        borderColor: 'border.muted',
        bg: expanded ? 'accent.muted' : tracked ? 'accent.subtle' : 'canvas.default',
        borderLeft: '3px solid',
        borderLeftColor: tracked ? 'accent.emphasis' : 'transparent',
        cursor: 'pointer',
        '&:hover': { bg: tracked ? 'accent.muted' : 'canvas.subtle' },
      }}
    >
      <Box as="td" sx={{ px: 2, py: '6px', width: 44, textAlign: 'center', verticalAlign: 'middle' }}>
        <Box
          as="button"
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onToggleTrack?.();
          }}
          aria-label={tracked ? `Unstar ${pr.repo_full_name}` : `Star ${pr.repo_full_name}`}
          title={tracked ? `Unstar ${pr.repo_full_name}` : `Star ${pr.repo_full_name}`}
          sx={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 24,
            height: 24,
            p: 0,
            border: 'none',
            borderRadius: 1,
            bg: 'transparent',
            color: tracked ? 'attention.fg' : 'fg.muted',
            cursor: 'pointer',
            '&:hover': {
              bg: 'canvas.subtle',
              color: tracked ? 'attention.fg' : 'attention.emphasis',
            },
          }}
        >
          {tracked ? <StarFillIcon size={14} /> : <StarIcon size={14} />}
        </Box>
      </Box>
      <Box as="td" sx={{ px: 2, py: '6px', verticalAlign: 'middle' }}>
        <PullStatusBadge pr={pr} />
      </Box>
      <Box as="td" sx={{ px: 2, py: '6px', maxWidth: 320, verticalAlign: 'middle' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, minWidth: 0 }}>
          <PrimerLink
            href={pr.html_url ?? '#'}
            target="_blank"
            rel="noreferrer"
            onClick={(e) => e.stopPropagation()}
            sx={{
              fontWeight: 500,
              color: 'fg.default',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              '&:hover': { color: 'accent.fg' },
            }}
            title={pr.title}
          >
            {pr.title}
          </PrimerLink>
          <Text sx={{ color: 'fg.muted', fontSize: 0, flexShrink: 0 }}>#{pr.number}</Text>
        </Box>
      </Box>
      <Box as="td" sx={{ px: 2, py: '6px', verticalAlign: 'middle' }}>
        <Link href={`/?repo=${encodeURIComponent(pr.repo_full_name)}&tab=pulls`} prefetch={false} style={{ textDecoration: 'none' }} onClick={(e) => e.stopPropagation()}>
          <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 1, color: 'accent.fg', '&:hover': { textDecoration: 'underline' } }}>
            <RepoIcon size={12} />
            <Text>{pr.repo_full_name}</Text>
          </Box>
        </Link>
      </Box>
      <Box
        as="td"
        sx={{
          p: 2,
          textAlign: 'right',
          fontFamily: 'mono',
          fontVariantNumeric: 'tabular-nums',
          fontSize: 1,
          fontWeight: weight >= 0.3 ? 700 : weight >= 0.15 ? 600 : weight >= 0.05 ? 500 : 400,
          color:
            weight >= 0.5 ? 'success.fg' : weight >= 0.3 ? 'accent.fg' : weight >= 0.15 ? 'attention.fg' : weight >= 0.05 ? 'fg.default' : 'fg.muted',
          verticalAlign: 'middle',
        }}
      >
        {weight.toFixed(4)}
      </Box>
      <Box as="td" sx={{ px: 2, py: '6px', fontSize: 0, verticalAlign: 'middle' }}>
        {pr.author_login ? (
          <Box
            as="button"
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onAuthorClick?.();
            }}
            sx={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 1,
              px: 1,
              py: '2px',
              border: 'none',
              borderRadius: 1,
              bg: 'transparent',
              color: 'inherit',
              cursor: 'pointer',
              '&:hover': { bg: 'canvas.subtle' },
            }}
            title={`View ${pr.author_login}'s activity`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`https://github.com/${pr.author_login}.png?size=40`}
              alt={pr.author_login}
              loading="lazy"
              style={{ width: 20, height: 20, borderRadius: '50%', border: '1px solid var(--border-muted)', flexShrink: 0 }}
            />
            <Text sx={{ fontWeight: 500, color: 'fg.default' }}>
              {pr.author_login}
            </Text>
            {pr.author_association && pr.author_association !== 'NONE' && (
              <Label variant="secondary" sx={{ fontSize: '10px', flexShrink: 0 }}>
                {pr.author_association.toLowerCase()}
              </Label>
            )}
          </Box>
        ) : (
          <Text sx={{ color: 'fg.muted' }}>—</Text>
        )}
      </Box>
      <Box as="td" sx={{ px: 2, py: '6px', fontSize: 0, verticalAlign: 'middle' }}>
        {pr.linked_issues.length > 0 ? (
          <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
            {pr.linked_issues.slice(0, 3).map((li) => {
              const sameRepo = li.repo === pr.repo_full_name;
              const target = sameRepo
                ? `/?repo=${encodeURIComponent(pr.repo_full_name)}&tab=issues&issue=${li.number}`
                : `/?repo=${encodeURIComponent(li.repo)}&tab=issues&issue=${li.number}`;
              return (
                <Link key={`${li.repo}#${li.number}`} href={target} prefetch={false} style={{ textDecoration: 'none' }} onClick={(e) => e.stopPropagation()}>
                  <Box
                    sx={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 1,
                      px: '6px',
                      py: '1px',
                      bg: 'var(--bg-emphasis)',
                      border: '1px solid',
                      borderColor: 'border.default',
                      borderRadius: 999,
                      color: 'accent.fg',
                      '&:hover': { borderColor: 'accent.emphasis' },
                    }}
                  >
                    <IssueOpenedIcon size={11} />
                    <Text>
                      {sameRepo ? '' : `${li.repo} `}#{li.number}
                    </Text>
                  </Box>
                </Link>
              );
            })}
            {pr.linked_issues.length > 3 && (
              <Text sx={{ color: 'fg.muted', fontSize: 0 }}>+{pr.linked_issues.length - 3}</Text>
            )}
          </Box>
        ) : (
          <Text sx={{ color: 'fg.muted' }}>—</Text>
        )}
      </Box>
      <Box as="td" sx={{ px: 2, py: '6px', fontSize: 0, color: 'fg.muted', verticalAlign: 'middle', whiteSpace: 'nowrap' }} title={pr.created_at ?? undefined}>
        {pr.created_at && isRecent(pr.created_at) ? (
          <Text sx={{ color: 'success.fg', fontWeight: 700 }}>{formatRelativeTime(pr.created_at)}</Text>
        ) : (
          formatRelativeTime(pr.created_at)
        )}
      </Box>
      <Box as="td" sx={{ px: 2, py: '6px', fontSize: 0, color: 'fg.muted', verticalAlign: 'middle', whiteSpace: 'nowrap' }} title={pr.updated_at ?? undefined}>
        {pr.updated_at && isRecent(pr.updated_at) ? (
          <Text sx={{ color: 'success.fg', fontWeight: 700 }}>{formatRelativeTime(pr.updated_at)}</Text>
        ) : (
          formatRelativeTime(pr.updated_at)
        )}
      </Box>
      <Box as="td" sx={{ px: 2, py: '6px', fontSize: 0, verticalAlign: 'middle', whiteSpace: 'nowrap' }} title={pr.merged_at ?? pr.closed_at ?? undefined}>
        {pr.merged_at ? (
          <Text sx={{ color: 'success.fg', fontWeight: isRecent(pr.merged_at) ? 700 : 400 }}>
            merged {formatRelativeTime(pr.merged_at)}
          </Text>
        ) : pr.closed_at ? (
          <Text sx={{ color: 'danger.fg', fontWeight: isRecent(pr.closed_at) ? 700 : 400 }}>
            closed {formatRelativeTime(pr.closed_at)}
          </Text>
        ) : (
          <Text sx={{ color: 'fg.muted' }}>—</Text>
        )}
      </Box>
    </Box>
  );
}
