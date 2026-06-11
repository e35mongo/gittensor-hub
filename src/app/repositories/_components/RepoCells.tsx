'use client';

// Shared table-cell renderers for the repositories list-family views (the
// activity List rows and the maintainer-performance leaderboard). These were
// duplicated inline in RepoListRow and MaintainersBoard — which let the stream
// bar silently drift (the board dropped the maintainer-cut segment). One source
// each, so they can't diverge again.
import React from 'react';
import styles from '../page.module.css';
import LangIcon from './LangIcon';
import { LABEL_COLORS, LANG_COLORS, LANG_NAME_ICONS, formatLangPct } from '../_lib/colors';
import { effectiveLabelMult, type RepoRow, type StrategyKey } from '../_lib/incentives';

/** Emission stream split bar: maintainer cut · PR · issue discovery. With
 *  `showLabel`, the percentage breakdown is rendered beneath (list view); the
 *  compact bar alone is used on the leaderboard. */
export function StreamBar({ row, showLabel = false }: { row: RepoRow; showLabel?: boolean }) {
  if (row.share <= 0) return <div style={{ fontSize: 10, color: 'var(--border-strong)' }}>—</div>;
  const maintCut = row.maintCut || 0;
  const afterCut = 1 - maintCut;
  const maintPct = maintCut * 100;
  const prPct = afterCut * (1 - row.issue) * 100;
  const issPct = afterCut * row.issue * 100;

  const bar = (
    <div
      className={styles.miniStream}
      style={showLabel ? { marginBottom: 4 } : undefined}
      title="Emission split: maintainer cut · PR · issue discovery"
    >
      {maintPct > 0 ? <span className={styles.splitMaint} style={{ width: `${maintPct}%` }} /> : null}
      {prPct > 0 ? <span className={styles.splitPr} style={{ width: `${prPct}%` }} /> : null}
      {issPct > 0 ? <span className={styles.splitIss} style={{ width: `${issPct}%` }} /> : null}
    </div>
  );
  if (!showLabel) return bar;

  const parts: string[] = [];
  if (maintPct > 0) parts.push(`${maintPct.toFixed(0)}% maintainer cut`);
  if (prPct > 0) parts.push(`${prPct.toFixed(0)}% PR`);
  if (issPct > 0) parts.push(`${issPct.toFixed(0)}% issue discovery`);
  return (
    <>
      {bar}
      <div
        style={{ fontSize: 10, color: 'var(--fg-subtle)' }}
        className="mono"
        title="Repo emission split (protocol terms: maintainer_cut + PR + issue_discovery)."
      >
        {parts.join(' · ')}
      </div>
    </>
  );
}

/** Top-N language pills with Devicon chrome. Falls back to "loading…" until
 *  metadata resolves, then "—" when the repo genuinely has no languages. */
export function LangPills({ langs, metadataLoaded, max = 2 }: { langs: RepoRow['langs']; metadataLoaded: boolean; max?: number }) {
  if (langs.length === 0) {
    return metadataLoaded ? (
      <span style={{ fontSize: 10, color: 'var(--border-strong)' }}>—</span>
    ) : (
      <span style={{ fontSize: 10, color: 'var(--border-strong)', fontStyle: 'italic' }}>loading…</span>
    );
  }
  return (
    <>
      {langs.slice(0, max).map(([n, p]) => (
        <span key={n} className={styles.langPill} style={{ fontSize: 10, padding: '1px 5px', flexShrink: 0 }}>
          <LangIcon
            spec={LANG_NAME_ICONS[n.toLowerCase()]}
            color={LANG_COLORS[n] ?? 'var(--fg-subtle)'}
            fallbackLetter={n.slice(0, n.length <= 2 ? 1 : 2).toUpperCase()}
            size={11}
            title={n}
          />
          {n} <span className={styles.textFgMute}>{formatLangPct(p)}</span>
        </span>
      ))}
    </>
  );
}

/** Label-multiplier cell — strategy-aware: issue% under the issue strategy, the
 *  effective multiplier under a label strategy, else the repo's top configured
 *  label multiplier (with its label name beneath). Right-aligned. */
export function MultCell({ row, strategy }: { row: RepoRow; strategy: StrategyKey }) {
  const r = row;
  if (strategy === 'issue') {
    return r.issue > 0 ? (
      <div style={{ textAlign: 'right' }}>
        <span className={`mono ${styles.numM} tnum ${styles.textIssue}`}>{(r.issue * 100).toFixed(0)}%</span>
      </div>
    ) : (
      <div style={{ textAlign: 'right', color: 'var(--border-strong)' }} className="mono">—</div>
    );
  }
  if (strategy !== 'none') {
    const m = effectiveLabelMult(r, strategy);
    const color =
      m >= 1.3 ? 'var(--color-feat)' :
      m >= 1.0 ? 'var(--color-enh)' :
      m >= 0.5 ? 'var(--fg-subtle)' :
      'var(--color-refact)';
    return (
      <div style={{ textAlign: 'right' }}>
        <span className={`mono ${styles.numM} tnum`} style={{ color }}>×{m.toFixed(2)}</span>
      </div>
    );
  }
  if (r.labels && Object.keys(r.labels).length > 0) {
    const [topLabel, topVal] = Object.entries(r.labels).reduce((a, b) => (a[1] >= b[1] ? a : b));
    const c = LABEL_COLORS[topLabel] ?? { fg: 'var(--fg-subtle)', soft: '' };
    return (
      <div style={{ textAlign: 'right' }}>
        <div className="mono tnum" style={{ fontSize: 13, color: c.fg }}>×{topVal.toFixed(2)}</div>
        <div style={{ fontSize: 9.5, color: 'var(--border-strong)', marginTop: 2 }}>{topLabel.slice(0, 8)}</div>
      </div>
    );
  }
  return <div style={{ textAlign: 'right', color: 'var(--border-strong)', fontSize: 12 }} className="mono">—</div>;
}
