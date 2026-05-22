import type React from 'react';
import type { Miner, MinerView, Mode } from './types';

// Tolerant numeric coercion: scores come as decimal strings; garbage → 0, never NaN.
export function num(v: unknown): number {
  const n = typeof v === 'string' ? parseFloat(v) : typeof v === 'number' ? v : 0;
  return Number.isFinite(n) ? n : 0;
}

export function ghKey(name: string | null | undefined): string {
  return (name ?? '').toLowerCase();
}

export function ghName(m: Pick<Miner, 'githubUsername' | 'uid'>): string {
  return m.githubUsername || `uid-${m.uid}`;
}

export function ghAvatar(m: Pick<Miner, 'githubUsername' | 'uid'>, size: number): string {
  return `https://github.com/${ghName(m)}.png?size=${size}`;
}

// Splits usdPerDay between OSS and Discovery proportional to score, eligible tracks only.
export function splitEarnings(
  usdPerDay: number,
  ossScore: number,
  issueScore: number,
  ossEligible: boolean,
  issueEligible: boolean,
): { oss: number; disc: number } {
  const combined = ossScore + issueScore;
  let ossShare = 0;
  let discShare = 0;
  if (ossEligible && issueEligible) {
    ossShare = combined > 0 ? ossScore / combined : 0.5;
    discShare = 1 - ossShare;
  } else if (ossEligible) {
    ossShare = 1;
  } else if (issueEligible) {
    discShare = 1;
  }
  return { oss: usdPerDay * ossShare, disc: usdPerDay * discShare };
}

// Upstream `credibility` uses a weighted formula that can disagree with visible counts.
function acceptanceRate(positive: number, closed: number): number {
  const denom = positive + closed;
  return denom > 0 ? positive / denom : 0;
}

// All three modes share the same shape so callers can swap tracks without changing render code.
export function viewOf(m: Miner, mode: Mode): MinerView {
  const ossScore = num(m.totalScore);
  const issueScore = num(m.issueDiscoveryScore);
  const { oss: ossUsd, disc: discUsd } = splitEarnings(
    num(m.usdPerDay), ossScore, issueScore, !!m.isEligible, !!m.isIssueEligible,
  );

  const ossEligible = !!m.isEligible;
  const issueEligible = !!m.isIssueEligible;
  const combinedScore = ossScore + issueScore;

  const merged = m.totalMergedPrs ?? 0;
  const closedPr = m.totalClosedPrs ?? 0;
  const solved = m.totalSolvedIssues ?? 0;
  const closedIssue = m.totalClosedIssues ?? 0;
  const ossCred = acceptanceRate(merged, closedPr);
  const issueCred = acceptanceRate(solved, closedIssue);

  if (mode === 'discovery') {
    return {
      mode,
      score: issueScore,
      cred: issueCred,
      eligible: issueEligible,
      usd: discUsd,
      counts: {
        primaryLabel: 'Solved',
        primary: solved,
        open: m.totalOpenIssues ?? 0,
        closed: closedIssue,
      },
    };
  }
  if (mode === 'oss') {
    return {
      mode,
      score: ossScore,
      cred: ossCred,
      eligible: ossEligible,
      usd: ossUsd,
      counts: {
        primaryLabel: 'Merged',
        primary: merged,
        open: m.totalOpenPrs ?? 0,
        closed: closedPr,
      },
    };
  }
  const combinedCred = acceptanceRate(merged + solved, closedPr + closedIssue);
  return {
    mode,
    score: combinedScore,
    cred: combinedCred,
    eligible: ossEligible || issueEligible,
    usd: ossUsd + discUsd,
    counts: {
      primaryLabel: 'Done',
      primary: merged + solved,
      open: (m.totalOpenPrs ?? 0) + (m.totalOpenIssues ?? 0),
      closed: closedPr + closedIssue,
    },
  };
}

// API compat — no longer colors per tone.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function credColor(_v: number): string {
  return 'var(--fg-default)';
}

// ──────────────────────────────────────────────────────────────────────────
// Row-level summary helpers
//
// These collapse inline arithmetic that LeaderRow, the sort comparator in
// page.tsx, and the Insights spotlights would otherwise repeat. Centralizing
// here keeps eligibility/credibility math consistent across the surface.
// ──────────────────────────────────────────────────────────────────────────

export interface MinerCounts {
  merged: number;
  solved: number;
  closedTotal: number;
}

export interface MinerCredibility {
  rate: number;
  pct: number;
  denom: number;
}

export interface MinerRowSummary {
  ossScore: number;
  discScore: number;
  combinedScore: number;
  combinedUsd: number;
  counts: MinerCounts;
  credibility: MinerCredibility;
  lastActiveIso: string | null;
}

export function countsFor(m: Miner): MinerCounts {
  return {
    merged: m.totalMergedPrs ?? 0,
    solved: m.totalSolvedIssues ?? 0,
    closedTotal: (m.totalClosedPrs ?? 0) + (m.totalClosedIssues ?? 0),
  };
}

export function credibilityFor(counts: MinerCounts): MinerCredibility {
  const denom = counts.merged + counts.solved + counts.closedTotal;
  const rate = denom > 0 ? (counts.merged + counts.solved) / denom : 0;
  return { rate, pct: clampedPct(rate), denom };
}

// Prefer the validator-reported "valid" merged count when present, falling
// back to the raw total. Used wherever miner activity is summarized.
export function validMergedCount(m: Pick<Miner, 'totalValidMergedPrs' | 'totalMergedPrs'>): number {
  return m.totalValidMergedPrs ?? m.totalMergedPrs ?? 0;
}

// Headline OSS + Discovery score sum. Cheaper than `summarizeRow(m).combinedScore`
// when callers don't need the per-track breakdown — used by the sort comparator,
// Insights derivers, and any "total score" cell.
export function combinedScore(m: Pick<Miner, 'totalScore' | 'issueDiscoveryScore'>): number {
  return num(m.totalScore) + num(m.issueDiscoveryScore);
}

// Track eligibility shape — common to Miner (list) and MinerProfile (detail).
export interface EligibilityFlags {
  isEligible?: boolean | null;
  isIssueEligible?: boolean | null;
}

// Dual-track eligibility predicate — used wherever a row, deriver, or filter
// needs to know whether a miner counts in both OSS and Discovery.
export function isDualEligible(m: EligibilityFlags): boolean {
  return !!m.isEligible && !!m.isIssueEligible;
}

// At-least-one-track eligibility predicate.
export function isAnyEligible(m: EligibilityFlags): boolean {
  return !!m.isEligible || !!m.isIssueEligible;
}

// Most recent OSS/Discovery activity timestamp, lexically compared on ISO 8601.
// Both timestamps are Z-terminated upstream, so lexical max == chronological max.
export function latestActivity(m: Pick<Miner, 'lastOssActivityAt' | 'lastDiscoveryActivityAt'>): string | null {
  const a = m.lastOssActivityAt ?? null;
  const b = m.lastDiscoveryActivityAt ?? null;
  if (a && b) return a > b ? a : b;
  return a ?? b ?? null;
}

// Integer percentage for a numerator/denominator pair, guarded against
// zero/negative denominators. Returns 0 when the denominator is unusable —
// use `ratePctOrNull` when callers need to distinguish "no data" from "0%".
export function ratePct(numerator: number, denominator: number): number {
  if (denominator <= 0) return 0;
  return Math.round((numerator / denominator) * 100);
}

export function ratePctOrNull(numerator: number, denominator: number): number | null {
  if (denominator <= 0) return null;
  return Math.round((numerator / denominator) * 100);
}

// Clamp a fraction to [0, 1] and round to an integer percent (0..100).
// Used by credibility, decay, and any UI that displays a 0..1 ratio as %.
export function clampedPct(fraction: number): number {
  return Math.round(Math.max(0, Math.min(1, fraction)) * 100);
}

// Score-weighted average of OSS and Discovery credibilities. Falls back to
// the simple mean when neither track has any score yet — used by the
// per-miner detail header to summarize a single credibility figure.
export function blendedCredibility(
  ossScore: number,
  ossCred: number,
  discScore: number,
  discCred: number,
): number {
  const total = ossScore + discScore;
  if (total > 0) return (ossScore * ossCred + discScore * discCred) / total;
  return (ossCred + discCred) / 2;
}

// Click handler for nested clickable children inside a row that itself has
// onClick. Stops the outer row handler from firing without preventing the
// default navigation/anchor behavior of the inner element.
export const stopPropagation: React.MouseEventHandler<HTMLElement> = (e) => {
  e.stopPropagation();
};

export function summarizeRow(m: Miner): MinerRowSummary {
  const ossScore = viewOf(m, 'oss').score;
  const discScore = viewOf(m, 'discovery').score;
  const counts = countsFor(m);
  return {
    ossScore,
    discScore,
    combinedScore: ossScore + discScore,
    combinedUsd: num(m.usdPerDay),
    counts,
    credibility: credibilityFor(counts),
    lastActiveIso: latestActivity(m),
  };
}
