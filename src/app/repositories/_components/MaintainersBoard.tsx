'use client';

// Maintainer leaderboard — every tracked repo's maintainer graded and ranked in
// one sortable table, so you can see and compare all maintainers at a glance.
// Carries the repo's identity + economics (avatar, TAO/day, ×mult, emission
// stream, languages) alongside the maintainer-performance metrics, with the
// composite grade leading. Any metric column sorts; thin-sample repos are
// flagged "provisional" and sink below confident grades on grade/metric sorts.
import React, { useMemo, useState } from 'react';
import { useQueries } from '@tanstack/react-query';
import {
  maintainerGrade,
  headlineReviewSpeed,
  headlineIssueResponse,
  reviewSpeedVerdict,
  issueResponseVerdict,
  type MaintainerStats,
  type MaintainerGrade,
} from '@/lib/api-types';
import styles from '../page.module.css';
import Avatar from './Avatar';
import { StreamBar, LangPills, MultCell } from './RepoCells';
import { formatDurationHours } from '@/lib/format';
import { formatTAO, repoDailyTAO, type RepoRow, type StrategyKey } from '../_lib/incentives';
import { maintainerStatsQuery } from '../_lib/maintainer-stats-query';

const LETTER_COLOR: Record<string, string> = {
  A: '#22c55e', B: '#86efac', C: '#9eb872', D: '#eab308', F: '#c5503a', '—': '#62666d',
};

// Shared column grid — header and every row use this so cells stay aligned.
const GRID = '54px minmax(180px,1.3fr) 96px 64px 120px minmax(104px,0.9fr) 88px 80px 72px 64px 34px';
const MIN_WIDTH = 1060;

const pct = (v: number | null | undefined): string => (v == null ? '—' : `${Math.round(v)}%`);

type SortKey = 'grade' | 'speed' | 'accept' | 'backlog' | 'sample' | 'tao';
// Sorts where a thin-sample (provisional) grade should sink to the bottom.
const GRADE_SORTS = new Set<SortKey>(['grade', 'speed', 'accept', 'backlog', 'sample']);

interface Entry {
  row: RepoRow;
  stat: MaintainerStats | null;
  loading: boolean;
  grade: MaintainerGrade | null;
  mode: 'PR' | 'issue' | 'mixed';
  speedHours: number | null;
  speedColor: string;
  speedScore: number | null;
  acceptVal: number | null; // merge rate (PR) or completion rate (issue), 0–100
  backlogScore: number | null;
  openCount: number | null;
  dailyTAO: number;
}

function buildEntry(row: RepoRow, stat: MaintainerStats | null, loading: boolean, subnetTAO: number): Entry {
  const dailyTAO = repoDailyTAO(row, subnetTAO);
  if (!stat || !stat.hasData) {
    return { row, stat, loading, grade: null, mode: 'PR', speedHours: null, speedColor: '#62666d', speedScore: null, acceptVal: null, backlogScore: null, openCount: null, dailyTAO };
  }
  const g = maintainerGrade(stat);
  const share = stat.issueDiscoveryShare;
  const mode: Entry['mode'] = share >= 1 ? 'issue' : share > 0 ? 'mixed' : 'PR';
  // Dominant side drives the single speed column; mixed repos follow their share.
  const issueSide = share >= 0.5;
  const speedHours = issueSide ? headlineIssueResponse(stat).hours : headlineReviewSpeed(stat).hours;
  const verdict = issueSide ? issueResponseVerdict(speedHours) : reviewSpeedVerdict(speedHours);
  const speedScore = issueSide ? g.issue?.speed ?? null : g.pr?.speed ?? null;
  const acceptVal = issueSide ? g.issue?.completion ?? null : g.pr?.acceptance ?? null;
  const openCount = mode === 'issue' ? stat.backlog.openIssues : stat.backlog.openPrs;
  return {
    row, stat, loading, grade: g, mode,
    speedHours, speedColor: verdict.color, speedScore,
    acceptVal, backlogScore: g.pr?.backlog ?? null, openCount, dailyTAO,
  };
}

const SORT_VAL: Record<SortKey, (e: Entry) => number | null> = {
  grade: (e) => e.grade?.score ?? null,
  speed: (e) => e.speedScore,
  accept: (e) => e.acceptVal,
  backlog: (e) => e.backlogScore,
  sample: (e) => e.grade?.sample ?? null,
  tao: (e) => e.dailyTAO,
};

export default function MaintainersBoard({
  rows,
  compare,
  subnetTAO,
  strategy,
  metadataLoaded = false,
  onOpen,
  onToggleCompare,
}: {
  rows: RepoRow[];
  compare: Set<string>;
  subnetTAO: number;
  strategy: StrategyKey;
  metadataLoaded?: boolean;
  onOpen: (fullName: string) => void;
  onToggleCompare: (fullName: string) => void;
}) {
  const [sortKey, setSortKey] = useState<SortKey>('grade');

  const results = useQueries({
    queries: rows.map((r) => maintainerStatsQuery(r.owner, r.name)),
  });

  const entries = useMemo(
    () => rows.map((r, i) => buildEntry(r, (results[i]?.data as MaintainerStats) ?? null, results[i]?.isLoading ?? false, subnetTAO)),
    [rows, results, subnetTAO],
  );

  const sorted = useMemo(() => {
    const get = SORT_VAL[sortKey];
    const sink = GRADE_SORTS.has(sortKey);
    return [...entries].sort((a, b) => {
      if (sink) {
        const aP = a.grade ? (a.grade.provisional ? 1 : 0) : 2;
        const bP = b.grade ? (b.grade.provisional ? 1 : 0) : 2;
        if (aP !== bP) return aP - bP;
      }
      const av = get(a), bv = get(b);
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      return bv - av; // all sort metrics: higher is better
    });
  }, [entries, sortKey]);

  const loadedCount = entries.filter((e) => !e.loading).length;
  const allLoading = loadedCount === 0 && rows.length > 0;

  return (
    <div style={{ overflowX: 'auto' }}>
      <div style={{ minWidth: MIN_WIDTH, border: '1px solid var(--soft-border, rgba(255,255,255,0.07))', borderRadius: 8, overflow: 'hidden' }}>
        {/* header */}
        <div
          style={{
            display: 'grid', gridTemplateColumns: GRID, alignItems: 'center', gap: 8,
            padding: '8px 14px', fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '0.06em',
            color: 'var(--fg-subtle)', borderBottom: '1px solid var(--soft-border, rgba(255,255,255,0.07))',
            background: 'rgba(255,255,255,0.015)',
          }}
        >
          <HeaderCell label="Grade" active={sortKey === 'grade'} onClick={() => setSortKey('grade')} title="Composite maintainer grade" />
          <span style={{ fontWeight: 500 }}>Repository</span>
          <HeaderCell label="TAO / day" active={sortKey === 'tao'} onClick={() => setSortKey('tao')} title="Daily emission to this repo" align="right" />
          <span style={{ textAlign: 'right' }} title="Label multiplier under the current strategy">{strategy === 'issue' ? 'Issue %' : strategy === 'none' ? '×Best' : `×${strategy}`}</span>
          <span>Stream</span>
          <span>Languages</span>
          <HeaderCell label="Response" active={sortKey === 'speed'} onClick={() => setSortKey('speed')} title="Typical time to merge a miner PR (or solve a discovered issue) — responsiveness to miners' work" align="right" />
          <HeaderCell label="Accept" active={sortKey === 'accept'} onClick={() => setSortKey('accept')} title="Acceptance — share of miner PRs merged (or discovered issues completed)" align="right" />
          <HeaderCell label="Queue" active={sortKey === 'backlog'} onClick={() => setSortKey('backlog')} title="Open queue — miner work waiting (queue health: size, age, stale)" align="right" />
          <HeaderCell label="Work" active={sortKey === 'sample'} onClick={() => setSortKey('sample')} title="Miner work — resolved miner PRs + closed issues behind the grade" align="right" />
          <span />
        </div>

        {allLoading ? (
          <div style={{ padding: 28, textAlign: 'center', fontSize: 12.5, color: 'var(--fg-subtle)' }}>Grading maintainers…</div>
        ) : (
          sorted.map((e) => (
            <Row key={e.row.fullName} e={e} strategy={strategy} metadataLoaded={metadataLoaded} compared={compare.has(e.row.fullName)} onOpen={onOpen} onToggleCompare={onToggleCompare} />
          ))
        )}
      </div>
    </div>
  );
}

function Row({
  e, strategy, metadataLoaded, compared, onOpen, onToggleCompare,
}: {
  e: Entry; strategy: StrategyKey; metadataLoaded: boolean; compared: boolean;
  onOpen: (f: string) => void; onToggleCompare: (f: string) => void;
}) {
  const r = e.row;
  const g = e.grade;
  const letter = g?.letter ?? (e.loading ? '·' : '—');
  const dim = !g || g.provisional;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onOpen(r.fullName)}
      onKeyDown={(ev) => { if (ev.key === 'Enter') onOpen(r.fullName); }}
      style={{
        display: 'grid', gridTemplateColumns: GRID, alignItems: 'center', gap: 8,
        padding: '10px 14px', fontSize: 12.5, cursor: 'pointer',
        borderBottom: '1px solid var(--soft-border, rgba(255,255,255,0.045))',
      }}
    >
      {/* grade */}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 5, opacity: dim ? 0.7 : 1 }}>
        <span style={{ fontSize: 18, fontWeight: 700, lineHeight: 1, color: LETTER_COLOR[letter] ?? '#62666d' }}>{letter}</span>
        <span className="tnum" style={{ fontSize: 11, color: 'var(--fg-muted)' }}>{g?.score != null ? Math.round(g.score) : ''}</span>
      </div>

      {/* repository: avatar + name + mode/provisional */}
      <div style={{ minWidth: 0, display: 'flex', alignItems: 'center', gap: 9 }}>
        <Avatar fullName={r.fullName} size="sm" />
        <div style={{ minWidth: 0 }}>
          <div style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            <span className={styles.textFgDim}>{r.owner}/</span>
            <span style={{ fontWeight: 500 }}>{r.name}</span>
          </div>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 2 }}>
            <ModeTag mode={e.mode} />
            {g?.provisional ? <span style={{ fontSize: 9.5, color: '#eab308', textTransform: 'uppercase', letterSpacing: '0.04em' }}>provisional</span> : null}
          </div>
        </div>
      </div>

      {/* TAO / day */}
      <div style={{ textAlign: 'right' }}>
        <div className={`${styles.numM} mono tnum ${r.share === 0 ? styles.textFgFaint : styles.textTao}`}>{formatTAO(e.dailyTAO)}</div>
        <div style={{ fontSize: 9.5, color: 'var(--fg-subtle)', marginTop: 2 }}>{(r.share * 100).toFixed(2)}% pool</div>
      </div>

      {/* ×Mult */}
      <MultCell row={r} strategy={strategy} />

      {/* Stream */}
      <div><StreamBar row={r} /></div>

      {/* Languages */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap', minWidth: 0 }}>
        <LangPills langs={r.langs} metadataLoaded={metadataLoaded} />
      </div>

      {/* Review speed */}
      <span className="tnum" style={{ textAlign: 'right', color: e.speedColor }}>{formatDurationHours(e.speedHours)}</span>
      {/* Acceptance */}
      <span className="tnum" style={{ textAlign: 'right', color: 'var(--fg-default)' }}>{pct(e.acceptVal)}</span>
      {/* Open queue */}
      <span className="tnum" style={{ textAlign: 'right', color: 'var(--fg-muted)' }}>{e.openCount == null ? '—' : `${e.openCount} open`}</span>
      {/* Miner work */}
      <span className="tnum" style={{ textAlign: 'right', color: 'var(--fg-subtle)' }}>{g ? g.sample : '—'}</span>

      {/* compare */}
      <button
        type="button"
        onClick={(ev) => { ev.stopPropagation(); onToggleCompare(r.fullName); }}
        title={compared ? 'Remove from compare' : 'Add to compare'}
        style={{
          justifySelf: 'end', width: 22, height: 22, borderRadius: 5, lineHeight: 1,
          border: '1px solid var(--soft-border, rgba(255,255,255,0.12))',
          background: compared ? 'var(--accent-subtle, rgba(99,102,241,0.18))' : 'transparent',
          color: compared ? 'var(--accent-fg, #a5b4fc)' : 'var(--fg-subtle)', cursor: 'pointer', fontSize: 13,
        }}
      >
        {compared ? '✓' : '+'}
      </button>
    </div>
  );
}

function HeaderCell({ label, active, onClick, title, align }: { label: string; active: boolean; onClick: () => void; title: string; align?: 'right' }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      style={{
        background: 'none', border: 'none', padding: 0, cursor: 'pointer', font: 'inherit',
        textTransform: 'inherit', letterSpacing: 'inherit',
        textAlign: align ?? 'left', justifySelf: align === 'right' ? 'end' : 'start',
        color: active ? 'var(--fg-default)' : 'var(--fg-subtle)', fontWeight: active ? 600 : 500,
        display: 'inline-flex', alignItems: 'center', gap: 3,
      }}
    >
      {label}{active ? <span style={{ fontSize: 8 }}>▼</span> : null}
    </button>
  );
}

function ModeTag({ mode }: { mode: 'PR' | 'issue' | 'mixed' }) {
  const c = mode === 'issue' ? '#6366f1' : mode === 'mixed' ? '#a78bfa' : '#22c55e';
  const label = mode === 'PR' ? 'PR review' : mode === 'issue' ? 'issue discovery' : 'mixed';
  return <span style={{ fontSize: 9.5, color: c, textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 500 }}>{label}</span>;
}
