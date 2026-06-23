'use client';

import React from 'react';
import { StarFillIcon, StarIcon } from '@primer/octicons-react';
import styles from '../page.module.css';
import Avatar from './Avatar';
import { StreamBar, LangPills, MultCell } from './RepoCells';
import { formatLookbackDays, formatTAO, lookbackPolicyTitle, repoDailyTAO, type RepoRow, type StrategyKey } from '../_lib/incentives';

interface RepoListRowProps {
  row: RepoRow;
  subnetTAO: number;
  strategy: StrategyKey;
  isSelected: boolean;
  isBest: boolean;
  isWarn: boolean;
  isTracked: boolean;
  /** Lets the langs cell show "loading…" instead of an empty pill row
   *  while /api/repos/metadata is in flight. */
  metadataLoaded?: boolean;
  onOpen: () => void;
  onToggleCompare: () => void;
  onToggleTrack: () => void;
}

export default function RepoListRow({
  row,
  subnetTAO,
  strategy,
  isSelected,
  isBest,
  isWarn,
  isTracked,
  metadataLoaded = false,
  onOpen,
  onToggleCompare,
  onToggleTrack,
}: RepoListRowProps) {
  const r = row;
  const dailyTAO = repoDailyTAO(r, subnetTAO);

  // Mini sparkline
  const maxSpark = Math.max(...r.activity.spark, 1);
  const sparkSlice = r.activity.spark.slice(-12);
  const hasSpark = sparkSlice.some((v) => v > 0);
  const sparkHtml = sparkSlice.map((v, i) => (
    <div
      key={i}
      className={styles.miniSparkBar}
      style={{ height: `${Math.max(2, (v / maxSpark) * 100)}%`, opacity: hasSpark ? 1 : 0.3 }}
    />
  ));

  const cls = [
    styles.repoListRow,
    r.isSelf ? styles.isSelf : '',
    isSelected ? styles.isSelected : '',
    isBest && !isSelected ? styles.isBest : '',
    isWarn && !isSelected && !isBest ? styles.isWarn : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div
      className={cls}
      role="button"
      tabIndex={0}
      onClick={(e) => {
        if ((e.target as HTMLElement).closest(`.${styles.compareBtn}`)) return;
        onOpen();
      }}
      onKeyDown={(e) => {
        if (e.key !== 'Enter' && e.key !== ' ') return;
        if ((e.target as HTMLElement).closest(`.${styles.compareBtn}`)) return;
        e.preventDefault();
        onOpen();
      }}
    >
      <div className={styles.rowActions}>
        <button
          type="button"
          className={`${styles.compareBtn} ${isTracked ? styles.on : ''}`}
          aria-label={isTracked ? `Untrack ${r.fullName}` : `Track ${r.fullName}`}
          title={isTracked ? 'Remove from tracked repos' : 'Track this repo'}
          onClick={(e) => {
            e.stopPropagation();
            onToggleTrack();
          }}
          style={{ position: 'relative', top: 'auto', right: 'auto' }}
        >
          {isTracked ? <StarFillIcon size={12} /> : <StarIcon size={12} />}
        </button>
        <button
          type="button"
          className={`${styles.compareBtn} ${isSelected ? styles.on : ''}`}
          aria-label={isSelected ? `Remove ${r.fullName} from compare` : `Add ${r.fullName} to compare`}
          title={isSelected ? 'Remove from compare' : 'Add to compare'}
          onClick={(e) => {
            e.stopPropagation();
            onToggleCompare();
          }}
          style={{ position: 'relative', top: 'auto', right: 'auto' }}
        >
          {isSelected ? (
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          ) : (
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
              <path d="M12 5v14M5 12h14" />
            </svg>
          )}
        </button>
      </div>

      <div className={styles.rowName} style={{ minWidth: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
        <Avatar fullName={r.fullName} size="sm" />
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            {isBest ? (
              <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor" style={{ color: 'var(--color-feat)' }}>
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
              </svg>
            ) : null}
            <span style={{ fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              <span className={styles.textFgDim}>{r.owner}/</span>
              <span style={{ fontWeight: 500 }}>{r.name}</span>
            </span>
            {r.isSelf ? <span className={`${styles.badge} ${styles.badgeSelf}`} style={{ fontSize: 9.5, padding: '0 4px' }}>you</span> : null}
            {r.trusted ? <span className={`${styles.badge} ${styles.badgeTrusted}`} style={{ fontSize: 9.5, padding: '0 4px' }}>trusted</span> : null}
            {r.share === 0 ? <span className={`${styles.badge} ${styles.badgeZero}`} style={{ fontSize: 9.5, padding: '0 4px' }}>benchmark</span> : null}
            {r.issue === 1 ? <span className={`${styles.badge} ${styles.badgeIssue}`} style={{ fontSize: 9.5, padding: '0 4px' }}>issues only</span> : null}
            {r.issue > 0 && r.issue < 1 ? <span className={`${styles.badge} ${styles.badgeMixed}`} style={{ fontSize: 9.5, padding: '0 4px' }}>mixed</span> : null}
            {r.prLookbackDays != null ? (
              <span
                className={styles.badge}
                style={{ fontSize: 9.5, padding: '0 4px' }}
                title={lookbackPolicyTitle(r.prLookbackDays)}
              >
                PR lookback {formatLookbackDays(r.prLookbackDays)}
              </span>
            ) : null}
            {r.eligibility ? <span className={`${styles.badge} ${styles.badgeOverrides}`} style={{ fontSize: 9.5, padding: '0 4px' }}>elig</span> : null}
            {(r.maintCut || 0) > 0 ? (
              <span
                className={`${styles.badge} ${styles.badgeMaint}`}
                style={{ fontSize: 9.5, padding: '0 4px' }}
                title={`${(r.maintCut * 100).toFixed(0)}% maintainer cut`}
              >
                {(r.maintCut * 100).toFixed(0)}% cut
              </span>
            ) : null}
          </div>
          {r.description ? (
            <div style={{ fontSize: 11, color: 'var(--fg-subtle)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {r.description}
            </div>
          ) : null}
        </div>
      </div>

      <div style={{ textAlign: 'right' }}>
        <div className={`${styles.numM} mono tnum ${r.share === 0 ? styles.textFgFaint : styles.textTao}`}>
          {formatTAO(dailyTAO)}
        </div>
        <div style={{ fontSize: 9.5, color: 'var(--fg-subtle)', marginTop: 2 }}>{(r.share * 100).toFixed(2)}% pool</div>
      </div>

      <div className={styles.listColMult}><MultCell row={r} strategy={strategy} /></div>

      <div className={styles.listColStream}>
        <StreamBar row={r} showLabel />
      </div>

      <div
        className={styles.listColLangs}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          flexWrap: 'wrap',
          minWidth: 0,
        }}
      >
        <LangPills langs={r.langs} metadataLoaded={metadataLoaded} />
      </div>

      <div className={styles.listColAct} style={{ textAlign: 'right' }}>
        <div className="mono tnum" style={{ fontSize: 13, color: 'var(--fg-default)' }}>{r.activity.merged30d}</div>
        <div
          style={{ fontSize: 9.5, color: 'var(--fg-subtle)', marginTop: 2 }}
          title={`${r.activity.contribs} contributors in the last 30 days`}
        >
          {r.activity.contribs} contribs
        </div>
      </div>

      <div className={styles.listColRate} style={{ textAlign: 'right' }}>
        {(() => {
          const resolved = r.activity.merged30d + r.activity.closed30d;
          if (resolved === 0) {
            return <div className="mono" style={{ fontSize: 13, color: 'var(--border-strong)' }}>—</div>;
          }
          const rate = r.activity.merged30d / resolved;
          const rateColor =
            rate >= 0.85 ? 'var(--color-moss-400)' :
            rate >= 0.7  ? 'var(--color-enh)' :
            rate > 0     ? 'var(--color-refact)' :
            'var(--fg-subtle)';
          return (
            <>
              <div className="mono tnum" style={{ fontSize: 13, color: rateColor }} title="Merged ÷ (merged + closed) over the last 30 days.">
                {(rate * 100).toFixed(0)}%
              </div>
              <div style={{ fontSize: 9.5, color: 'var(--fg-subtle)', marginTop: 2 }}>{resolved} resolved</div>
            </>
          );
        })()}
      </div>

      <div className={styles.listColSpark}>
        <div className={styles.miniSpark}>{sparkHtml}</div>
      </div>
    </div>
  );
}
