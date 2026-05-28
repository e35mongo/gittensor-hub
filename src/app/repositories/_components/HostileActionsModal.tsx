'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ShieldSlashIcon, CheckCircleIcon, GitPullRequestIcon, LinkExternalIcon, XIcon } from '@primer/octicons-react';
import Spinner from '@/components/Spinner';
import { formatRelativeTime } from '@/lib/format';
import styles from '../page.module.css';

interface PullSignal {
  kind: 'label_action' | 'close_action' | 'maintainer_comment' | 'maintainer_review' | 'current_label' | 'closed_unmerged';
  title: string;
  detail: string;
  tone: 'danger' | 'attention' | 'muted';
  confidence: 'high' | 'medium' | 'low';
  label?: string;
}

interface WatchPull {
  number: number;
  title: string;
  state: string;
  author_login: string | null;
  labels: string[];
  html_url: string;
  updated_at: string;
  closed_at: string | null;
  merged_at: string | null;
  signals: PullSignal[];
  score: number;
}

interface CountItem {
  name: string;
  count: number;
}

interface WatchedRepo {
  full_name: string;
  html_url: string;
  description: string | null;
  score: number;
  severity: 'high' | 'watch' | 'quiet' | 'error';
  signal_count: number;
  high_confidence: number;
  label_actions: number;
  closed_unmerged: number;
  flagged_pull_count?: number;
  pulls_scanned: number;
  evidence_pulls_scanned?: number;
  top_labels?: CountItem[];
  top_signal_types?: CountItem[];
  primary_actors?: string[];
  activity_start?: string | null;
  activity_end?: string | null;
  pulls: WatchPull[];
  error: string | null;
}

interface HostileActionsResponse {
  generated_at: string;
  repos: WatchedRepo[];
}

const TOP_RANK_COUNT = 3;
const HOSTILE_QUERY_STALE_MS = 5 * 60 * 1000;
const HOSTILE_QUERY_GC_MS = 15 * 60 * 1000;

function signalTypeLabel(kind: PullSignal['kind']): string {
  if (kind === 'label_action') return 'Actor label';
  if (kind === 'close_action') return 'Actor close';
  if (kind === 'maintainer_comment') return 'Comment';
  if (kind === 'maintainer_review') return 'Review';
  if (kind === 'current_label') return 'Current label';
  return 'Closed PR';
}

function formatDayLabel(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function dayKey(iso: string): string {
  return (iso ?? '').slice(0, 10);
}

function formatActorList(actors: string[]): string {
  if (actors.length === 0) return 'Repository actors';
  if (actors.length === 1) return actors[0];
  if (actors.length === 2) return actors[0] + ' and ' + actors[1];
  const otherCount = actors.length - 2;
  return actors[0] + ', ' + actors[1] + ' and ' + otherCount + ' other' + (otherCount === 1 ? '' : 's');
}

function formatDateRange(earliest: string | null, latest: string | null): string | null {
  if (!earliest || !latest) return null;
  if (earliest === latest) return formatDayLabel(earliest);
  return formatDayLabel(earliest) + ' - ' + formatDayLabel(latest);
}

export default function HostileActionsModal({ repoFullName, open, onClose }: { repoFullName: string | null; open: boolean; onClose: () => void }) {
  const [labelFilter, setLabelFilter] = useState<string | null>(null);

  const { data, isLoading, isFetching, isError, error } = useQuery<HostileActionsResponse>({
    queryKey: ['hostile-actions', repoFullName],
    queryFn: async ({ signal }) => {
      const params = new URLSearchParams({ repos: repoFullName ?? '' });
      const response = await fetch('/api/hostile-actions?' + params.toString(), { signal });
      if (!response.ok) throw new Error('HTTP ' + response.status);
      return response.json() as Promise<HostileActionsResponse>;
    },
    enabled: open && Boolean(repoFullName),
    staleTime: HOSTILE_QUERY_STALE_MS,
    gcTime: HOSTILE_QUERY_GC_MS,
    refetchOnWindowFocus: false,
    retry: 0,
  });

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose, open]);

  useEffect(() => {
    if (!open) setLabelFilter(null);
  }, [open, repoFullName]);

  const repo = data?.repos?.[0] ?? null;
  const topLabels = repo?.top_labels ?? [];
  const topSignalTypes = repo?.top_signal_types ?? [];
  const primaryActors = repo?.primary_actors ?? [];
  const dateRange = repo ? formatDateRange(repo.activity_start ?? null, repo.activity_end ?? null) : null;

  const filteredPulls = useMemo(() => {
    if (!repo) return [];
    if (!labelFilter) return repo.pulls;
    const needle = labelFilter.toLowerCase();
    return repo.pulls.filter((pr) => {
      return pr.labels.some((l) => l.toLowerCase() === needle)
        || pr.signals.some((signal) => signal.label?.toLowerCase() === needle);
    });
  }, [repo, labelFilter]);

  const topRankNumbers = useMemo(() => {
    return new Set(
      [...filteredPulls]
        .sort((a, b) => b.score - a.score || b.updated_at.localeCompare(a.updated_at))
        .slice(0, TOP_RANK_COUNT)
        .map((pr) => pr.number),
    );
  }, [filteredPulls]);

  const groupedPulls = useMemo(() => {
    const groups = new Map<string, WatchPull[]>();
    for (const pr of filteredPulls) {
      const key = dayKey(pr.updated_at);
      const bucket = groups.get(key);
      if (bucket) bucket.push(pr);
      else groups.set(key, [pr]);
    }
    return Array.from(groups.entries())
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([key, prs]) => ({ key, prs: prs.sort((a, b) => b.score - a.score || b.updated_at.localeCompare(a.updated_at)) }));
  }, [filteredPulls]);

  const visiblePullCount = repo?.pulls.length ?? 0;
  const flaggedCount = repo?.flagged_pull_count ?? visiblePullCount;
  const moreFlaggedCount = Math.max(0, flaggedCount - visiblePullCount);
  const evidenceSignalCount = repo?.signal_count ?? 0;
  const evidenceCheckedCount = repo?.evidence_pulls_scanned ?? visiblePullCount;
  const labelActionCount = repo?.label_actions ?? 0;
  const verdictText = flaggedCount === 0
    ? 'No repository risk signals found in the latest pull-request window.'
    : formatActorList(primaryActors) + ' matched repository risk signals' + (dateRange ? ' · ' + dateRange : '') + '.';

  if (!open) return null;

  return (
    <>
      <div className={styles.hostileBackdrop + ' ' + styles.open} onClick={onClose} aria-hidden="true" />
      <section className={styles.hostileModal + ' ' + styles.open} role="dialog" aria-modal="true" aria-label="Repository risk signals">
        <header className={styles.hostileHeader}>
          <div className={styles.hostileTitleBlock}>
            <span className={styles.hostileIcon}><ShieldSlashIcon size={15} /></span>
            <div style={{ minWidth: 0 }}>
              <div className={styles.hostileEyebrow}>Repository risk signals</div>
              <h2 className={styles.hostileTitle}>{repoFullName ?? 'Repository'}</h2>
            </div>
          </div>
          <button type="button" className={styles.ghostBtn} onClick={onClose} aria-label="Close repository risk signals">
            <XIcon size={16} />
          </button>
        </header>

        <div className={styles.hostileBody}>
          {isLoading && !repo ? (
            <div className={styles.hostileEmpty}>{isFetching ? <Spinner size="sm" tone="muted" /> : null} Scanning recent pull requests...</div>
          ) : isError ? (
            <div className={styles.hostileError}>{error instanceof Error ? error.message : 'Could not scan this repository.'}</div>
          ) : repo ? (
            repo.error ? (
              <div className={styles.hostileError}>{repo.error}</div>
            ) : (
              <>
                {flaggedCount === 0 ? (
                  <section className={styles.hostileQuiet} data-severity={repo.severity}>
                    <div className={styles.hostileQuietBadge}>
                      <CheckCircleIcon size={20} />
                    </div>
                    <div className={styles.hostileQuietBody}>
                      <h3>All clear</h3>
                      <p>No repository risk signals found in the latest pull-request window.</p>
                      <div className={styles.hostileQuietStats}>
                        <span><em>{repo.pulls_scanned}</em> PRs screened</span>
                        <span><em>{evidenceCheckedCount}</em> histories checked</span>
                        <span className={styles.hostileStatStripStamp}>
                          {data?.generated_at ? 'Updated ' + formatRelativeTime(data.generated_at) : 'Live scan'}
                          {isFetching ? <Spinner size="sm" tone="muted" /> : null}
                        </span>
                      </div>
                    </div>
                  </section>
                ) : (
                  <section className={styles.hostileLede} data-severity={repo.severity}>
                    <div className={styles.hostileLedeNumbers}>
                      <strong>{evidenceSignalCount}</strong>
                      <span>evidence signal{evidenceSignalCount === 1 ? '' : 's'} across {flaggedCount} PR{flaggedCount === 1 ? '' : 's'}</span>
                    </div>
                    <p className={styles.hostileLedeVerdict}>{verdictText}</p>
                    <div className={styles.hostileStatStrip}>
                      <span><em>{repo.pulls_scanned}</em> screened</span>
                      <span><em>{evidenceCheckedCount}</em> histories checked</span>
                      <span><em>{labelActionCount}</em> label action{labelActionCount === 1 ? '' : 's'}</span>
                      {repo.closed_unmerged > 0 ? <span><em>{repo.closed_unmerged}</em> closed unmerged</span> : null}
                      {moreFlaggedCount > 0 ? <span><em>{visiblePullCount}</em> shown of {flaggedCount}</span> : null}
                      <span className={styles.hostileStatStripStamp}>
                        {data?.generated_at ? 'Updated ' + formatRelativeTime(data.generated_at) : 'Live scan'}
                        {isFetching ? <Spinner size="sm" tone="muted" /> : null}
                      </span>
                    </div>
                  </section>
                )}

                {(topLabels.length > 0 || topSignalTypes.length > 0) ? (
                  <section className={styles.hostilePatternBand} aria-label="Pattern">
                    {topLabels.length > 0 ? (
                      <div className={styles.hostilePatternGroup}>
                        <div className={styles.hostilePatternLabel}>Labels</div>
                        <div className={styles.hostilePatternChips}>
                          {topLabels.map((item) => {
                            const active = labelFilter?.toLowerCase() === item.name.toLowerCase();
                            return (
                              <button
                                key={item.name}
                                type="button"
                                className={styles.hostileChip}
                                data-active={active ? 'true' : undefined}
                                onClick={() => setLabelFilter(active ? null : item.name)}
                              >
                                <span>{item.name}</span>
                                <em>{item.count}</em>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ) : null}
                    {topSignalTypes.length > 0 ? (
                      <div className={styles.hostilePatternGroup}>
                        <div className={styles.hostilePatternLabel}>Evidence</div>
                        <div className={styles.hostilePatternChips}>
                          {topSignalTypes.map((item) => (
                            <span key={item.name} className={styles.hostileChip} data-static="true">
                              <span>{item.name}</span>
                              <em>{item.count}</em>
                            </span>
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </section>
                ) : null}

                {flaggedCount === 0 ? null : (
                  <section className={styles.hostileEvidence}>
                    <div className={styles.hostileSectionHeader}>
                      <span>Evidence</span>
                      <em>
                        {labelFilter ? (
                          <>
                            Filtered by <strong>{labelFilter}</strong> · {filteredPulls.length} visible of {flaggedCount}
                            <button type="button" className={styles.hostileFilterClear} onClick={() => setLabelFilter(null)} aria-label="Clear label filter">
                              <XIcon size={10} />
                            </button>
                          </>
                        ) : moreFlaggedCount > 0 ? (
                          'Showing ' + visiblePullCount + ' of ' + flaggedCount + ' pull requests'
                        ) : (
                          filteredPulls.length + ' pull request' + (filteredPulls.length === 1 ? '' : 's')
                        )}
                      </em>
                    </div>

                    {filteredPulls.length === 0 ? (
                      <div className={styles.hostileEmpty}>No PRs match this label.</div>
                    ) : (
                      groupedPulls.map((group) => (
                        <div key={group.key} className={styles.hostileDateGroup}>
                          <div className={styles.hostileDateGroupHead}>
                            <span>{formatDayLabel(group.key)}</span>
                            <em>{group.prs.length} PR{group.prs.length === 1 ? '' : 's'}</em>
                          </div>
                          <div className={styles.hostileList}>
                            {group.prs.map((pr) => (
                              <HostilePullRow key={pr.number} pr={pr} ranked={topRankNumbers.has(pr.number)} />
                            ))}
                          </div>
                        </div>
                      ))
                    )}
                  </section>
                )}

                {flaggedCount > 0 ? (
                  <p className={styles.hostileNote}>
                    High-confidence risk evidence requires a repo-side label action, close paired with risk evidence, or maintainer language.
                  </p>
                ) : null}
              </>
            )
          ) : null}
        </div>
      </section>
    </>
  );
}

function HostilePullRow({ pr, ranked }: { pr: WatchPull; ranked: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const confidence: 'high' | 'medium' | 'low' = pr.signals.some((s) => s.confidence === 'high')
    ? 'high'
    : pr.signals.some((s) => s.confidence === 'medium') ? 'medium' : 'low';
  const status = pr.merged_at ? 'merged' : pr.closed_at ? 'closed unmerged' : pr.state;
  const detail = pr.signals[0]?.detail ?? null;

  return (
    <article
      className={styles.hostilePullRow}
      data-confidence={confidence}
      data-ranked={ranked ? 'true' : undefined}
      data-expanded={expanded ? 'true' : undefined}
    >
      <span className={styles.hostilePullIcon} aria-hidden="true">
        <GitPullRequestIcon size={14} />
      </span>

      <div className={styles.hostilePullContent}>
        <div className={styles.hostilePullHead}>
          <a
            href={pr.html_url}
            target="_blank"
            rel="noreferrer"
            className={styles.hostilePullTitle}
            title={pr.title}
          >
            <span className={styles.hostilePullNum}>#{pr.number}</span>
            <span className={styles.hostilePullTitleText}>{pr.title}</span>
            <LinkExternalIcon size={11} />
          </a>
          <span className={styles.hostilePullConfidence} data-confidence={confidence}>{confidence}</span>
        </div>

        <div className={styles.hostilePullMeta}>
          <span className={styles.hostilePullAuthor}>{pr.author_login ?? 'unknown'}</span>
          <span>{status}</span>
          <span>{formatRelativeTime(pr.updated_at)}</span>
          {pr.labels.slice(0, 3).map((label) => (
            <span key={label} className={styles.hostilePullLabel}>{label}</span>
          ))}
          {pr.labels.length > 3 ? <span className={styles.hostilePullLabel}>+{pr.labels.length - 3}</span> : null}
        </div>

        {detail ? (
          <button
            type="button"
            className={styles.hostilePullDetail}
            onClick={() => setExpanded((v) => !v)}
            aria-expanded={expanded}
          >
            <span>{detail}</span>
            {pr.signals.length > 1 ? <em>+{pr.signals.length - 1} more</em> : null}
          </button>
        ) : null}

        {expanded && pr.signals.length > 1 ? (
          <div className={styles.hostilePullExpanded}>
            {pr.signals.slice(1).map((signal, i) => (
              <div key={signal.kind + '-' + i} className={styles.hostilePullExpandedRow} data-tone={signal.tone}>
                <strong>{signalTypeLabel(signal.kind)}</strong>
                <span>{signal.detail}</span>
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </article>
  );
}
