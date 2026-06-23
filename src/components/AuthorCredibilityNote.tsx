'use client';

import type { AuthorCredibility } from '@/types/entities';

function percent(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return '-';
  return `${Math.round(value * 100)}%`;
}

function count(value: number | null | undefined): string {
  return value === null || value === undefined || !Number.isFinite(value) ? '-' : `${Math.round(value)}`;
}

function lookbackText(days: number | null | undefined): string {
  return days === null || days === undefined || !Number.isFinite(days)
    ? 'the current Gittensor lookback window'
    : `the last ${Math.round(days)} days`;
}

function tone(value: number | null): string {
  if (value === null) return 'var(--neutral-emphasis)';
  if (value >= 0.8) return 'var(--success-emphasis)';
  if (value >= 0.5) return '#d4a72c';
  return 'var(--danger-emphasis)';
}

export default function AuthorCredibilityNote({
  credibility,
  variant,
}: {
  credibility: AuthorCredibility | null | undefined;
  variant: 'issues' | 'pulls';
}) {
  if (!credibility) return null;

  const value = variant === 'issues'
    ? credibility.issue_credibility ?? credibility.credibility
    : credibility.credibility ?? credibility.issue_credibility;
  if (value === null) return null;
  const color = tone(value);
  const issueDiscoveryDisabled = variant === 'issues' && credibility.issue_discovery_disabled;
  const windowText = lookbackText(credibility.pr_lookback_days);
  const title = variant === 'pulls'
    ? `Repo PR credibility ${percent(credibility.credibility)} over ${windowText} · ${count(credibility.total_merged_prs)} merged / ${count(credibility.total_closed_prs)} closed in window · ${count(credibility.total_open_prs)} open · Older PRs do not count toward this badge.`
    : issueDiscoveryDisabled
      ? `Issue discovery is disabled for this repo · PR credibility ${percent(credibility.credibility)} over ${windowText} · Issue credibility ${percent(credibility.issue_credibility)}`
      : `Issue credibility ${percent(credibility.issue_credibility)} · PR credibility ${percent(credibility.credibility)} over ${windowText}`;

  return (
    <span
      title={title}
      aria-label={title}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: 18,
        minWidth: 34,
        padding: '0 5px',
        border: '1px solid',
        borderColor: color,
        borderRadius: '999px',
        background: 'transparent',
        color,
        fontFamily: 'var(--font-mono), ui-monospace, SFMono-Regular, monospace',
        fontVariantNumeric: 'tabular-nums',
        fontSize: '10px',
        fontWeight: 700,
        lineHeight: '18px',
        textDecoration: issueDiscoveryDisabled ? 'line-through' : 'none',
        textDecorationThickness: issueDiscoveryDisabled ? '1.5px' : undefined,
        whiteSpace: 'nowrap',
        flexShrink: 0,
      }}
    >
      {percent(value)}
    </span>
  );
}
