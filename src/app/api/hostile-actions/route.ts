import { NextRequest, NextResponse } from 'next/server';
import type { Octokit } from '@octokit/rest';
import { withRotation } from '@/lib/github';

export const dynamic = 'force-dynamic';

type RawLabel = string | { name?: string | null; color?: string | null; description?: string | null };

type WatchPull = {
  number: number;
  title: string;
  body: string | null;
  state: string;
  draft?: boolean;
  user: { login?: string | null } | null;
  author_association?: string | null;
  labels?: RawLabel[] | null;
  created_at: string;
  updated_at: string;
  closed_at: string | null;
  merged_at: string | null;
  html_url: string;
};

type RawIssueEvent = {
  event?: string;
  actor?: { login?: string | null } | null;
  label?: RawLabel | null;
  created_at?: string | null;
};

type RawComment = {
  body?: string | null;
  html_url?: string | null;
  user?: { login?: string | null } | null;
  author_association?: string | null;
  created_at?: string | null;
};

type RawReview = {
  body?: string | null;
  html_url?: string | null;
  user?: { login?: string | null } | null;
  author_association?: string | null;
  submitted_at?: string | null;
};

type SignalTone = 'danger' | 'attention' | 'muted';
type SignalConfidence = 'high' | 'medium' | 'low';

type PullSignal = {
  kind: 'label_action' | 'close_action' | 'maintainer_comment' | 'maintainer_review' | 'current_label' | 'closed_unmerged';
  title: string;
  detail: string;
  tone: SignalTone;
  confidence: SignalConfidence;
  label?: string;
};

const DEFAULT_REPOS = ['we-promise/sure'];
const MAX_REPOS = 8;
const MAX_PULLS_PER_REPO = 100;
const MAX_EVIDENCE_PULLS_PER_REPO = 20;
const DEFAULT_SCAN_CACHE_TTL_MS = 10 * 60 * 1000;
const SCAN_CACHE_TTL_MS = Math.max(
  30_000,
  Number(process.env.GITTENSOR_HOSTILE_CACHE_TTL_MS ?? DEFAULT_SCAN_CACHE_TTL_MS) || DEFAULT_SCAN_CACHE_TTL_MS,
);
const RESPONSE_HEADERS = {
  'Cache-Control': 'private, max-age=60, stale-while-revalidate=300',
};
const MAINTAINER_ASSOCIATIONS = new Set(['OWNER', 'MEMBER', 'COLLABORATOR']);
const GITTENSOR_PATTERN = /\b(gittensor|bittensor|sn74|subnet\s*74|subnet-74|tao)\b/i;
const HOSTILE_LABEL_PATTERN = /(?:^|[-_\s])(no|non|not|anti|ban|blocked|rejected)[-_\s]?(gittensor|bittensor)(?:$|[-_\s])|(?:gittensor|bittensor)[-_\s]?(ban|blocked|rejected|spam)/i;
const HOSTILE_LANGUAGE_PATTERN = /(?:reject(?:ed|ing)?|ban(?:ned|ning)?|block(?:ed|ing)?|not welcome|do not accept|won't accept|spam|abuse).{0,90}(?:gittensor|bittensor)|(?:gittensor|bittensor).{0,90}(?:reject(?:ed|ing)?|ban(?:ned|ning)?|block(?:ed|ing)?|not welcome|do not accept|won't accept|spam|abuse)/i;

function normalizeRepo(raw: string): string | null {
  const trimmed = raw.trim().replace(/^https?:\/\/github\.com\//i, '').replace(/\/pulls?\/?$/i, '').replace(/\/$/, '');
  const match = trimmed.match(/^([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)$/);
  return match ? `${match[1]}/${match[2]}` : null;
}

function reposFromRequest(req: NextRequest): string[] {
  const url = new URL(req.url);
  const raw = url.searchParams.get('repos') || process.env.GITTENSOR_HOSTILE_REPOS || DEFAULT_REPOS.join(',');
  const seen = new Set<string>();
  const repos: string[] = [];
  for (const part of raw.split(/[\n,\s]+/)) {
    const repo = normalizeRepo(part);
    if (!repo) continue;
    const key = repo.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    repos.push(repo);
    if (repos.length >= MAX_REPOS) break;
  }
  return repos.length > 0 ? repos : DEFAULT_REPOS;
}

function labelName(label: RawLabel | null | undefined): string {
  if (!label) return '';
  return typeof label === 'string' ? label : label.name ?? '';
}

function pullLabels(pr: WatchPull): string[] {
  return (pr.labels ?? []).map(labelName).filter(Boolean);
}

function pullText(pr: WatchPull, labels = pullLabels(pr)): string {
  return `${pr.title}\n${pr.body ?? ''}\n${labels.join(' ')}`;
}

function loginDiffers(actor: string | null | undefined, author: string | null | undefined): boolean {
  if (!actor) return false;
  if (!author) return true;
  return actor.toLowerCase() !== author.toLowerCase();
}

function isMaintainerAssociation(association: string | null | undefined): boolean {
  return MAINTAINER_ASSOCIATIONS.has(String(association ?? '').toUpperCase());
}

function currentLabelSignals(hostileLabels: string[]): PullSignal[] {
  return hostileLabels.map((label) => ({
    kind: 'current_label',
    title: 'Hostile label present',
    detail: `Current GitHub label "${label}" matches the Gittensor-hostile label pattern`,
    tone: 'attention',
    confidence: 'medium',
    label,
  }));
}

async function fetchPullActionSignals(octokit: Octokit, owner: string, repo: string, pr: WatchPull, hostileLabels: string[], mentionsGittensor: boolean): Promise<PullSignal[]> {
  const signals: PullSignal[] = [];
  const closeEvents: Array<{ actor: string | null; createdAt: string | null }> = [];
  const author = pr.user?.login ?? null;
  const isClosedUnmerged = pr.state === 'closed' && !pr.merged_at;

  const [eventsResult, commentsResult, reviewsResult] = await Promise.allSettled([
    octokit.issues.listEvents({ owner, repo, issue_number: pr.number, per_page: 100 }),
    isClosedUnmerged ? octokit.issues.listComments({ owner, repo, issue_number: pr.number, per_page: 50 }) : Promise.resolve({ data: [] }),
    isClosedUnmerged ? octokit.pulls.listReviews({ owner, repo, pull_number: pr.number, per_page: 50 }) : Promise.resolve({ data: [] }),
  ]);

  if (eventsResult.status === 'fulfilled') {
    const events = eventsResult.value.data as unknown as RawIssueEvent[];
    for (const event of events) {
      const actor = event.actor?.login ?? null;
      if (!loginDiffers(actor, author)) continue;
      if (event.event === 'labeled' || event.event === 'unlabeled') {
        const label = labelName(event.label);
        if (label && HOSTILE_LABEL_PATTERN.test(label)) {
          const removed = event.event === 'unlabeled';
          signals.push({
            kind: 'label_action',
            title: removed ? 'Repository actor removed hostile label' : 'Repository actor labeled PR',
            detail: `${actor} ${removed ? 'removed' : 'applied'} "${label}"${event.created_at ? ` on ${event.created_at.slice(0, 10)}` : ''}`,
            tone: 'danger',
            confidence: 'high',
            label,
          });
        }
      }
      if (event.event === 'closed' && isClosedUnmerged && mentionsGittensor) {
        closeEvents.push({ actor, createdAt: event.created_at ?? null });
      }
    }
  }

  if (isClosedUnmerged && commentsResult.status === 'fulfilled') {
    const comments = commentsResult.value.data as unknown as RawComment[];
    for (const comment of comments) {
      if (!isMaintainerAssociation(comment.author_association)) continue;
      const body = comment.body ?? '';
      if (!HOSTILE_LANGUAGE_PATTERN.test(body)) continue;
      signals.push({
        kind: 'maintainer_comment',
        title: 'Maintainer comment matched',
        detail: `${comment.user?.login ?? 'maintainer'} commented with rejection/blocking language${comment.created_at ? ` on ${comment.created_at.slice(0, 10)}` : ''}`,
        tone: 'danger',
        confidence: 'high',
      });
    }
  }

  if (isClosedUnmerged && reviewsResult.status === 'fulfilled') {
    const reviews = reviewsResult.value.data as unknown as RawReview[];
    for (const review of reviews) {
      if (!isMaintainerAssociation(review.author_association)) continue;
      const body = review.body ?? '';
      if (!HOSTILE_LANGUAGE_PATTERN.test(body)) continue;
      signals.push({
        kind: 'maintainer_review',
        title: 'Maintainer review matched',
        detail: `${review.user?.login ?? 'maintainer'} left a review with rejection/blocking language${review.submitted_at ? ` on ${review.submitted_at.slice(0, 10)}` : ''}`,
        tone: 'danger',
        confidence: 'high',
      });
    }
  }

  if (!signals.some((signal) => signal.kind === 'label_action')) {
    signals.push(...currentLabelSignals(hostileLabels));
  }

  const strongHostileEvidence = signals.some((signal) => signal.confidence === 'high');
  const anyHostileEvidence = signals.some((signal) => signal.confidence === 'high' || signal.confidence === 'medium');
  if (closeEvents.length > 0 && strongHostileEvidence) {
    for (const event of closeEvents) {
      signals.push({
        kind: 'close_action',
        title: 'Repository actor closed PR',
        detail: `${event.actor ?? 'repo actor'} closed a Gittensor-related PR with hostile evidence${event.createdAt ? ` on ${event.createdAt.slice(0, 10)}` : ''}`,
        tone: 'danger',
        confidence: 'high',
      });
    }
  } else if (isClosedUnmerged && mentionsGittensor && anyHostileEvidence) {
    signals.push({
      kind: 'closed_unmerged',
      title: 'Closed without merge',
      detail: closeEvents[0]?.actor
        ? `${closeEvents[0].actor} closed the PR; hostile evidence is shown above`
        : 'PR is closed without a merge; hostile evidence is shown above',
      tone: 'attention',
      confidence: 'low',
    });
  }

  return signals;
}

function fallbackSignals(pr: WatchPull, hostileLabels: string[], mentionsGittensor: boolean): PullSignal[] {
  const signals = currentLabelSignals(hostileLabels);
  if (pr.state === 'closed' && !pr.merged_at && mentionsGittensor) {
    signals.push({
      kind: 'closed_unmerged',
      title: 'Closed without merge',
      detail: 'PR mentions Gittensor/Bittensor and is closed without a merge',
      tone: hostileLabels.length > 0 ? 'attention' : 'muted',
      confidence: 'low',
    });
  }
  return signals;
}

function signalScore(signals: PullSignal[]): number {
  return signals.reduce((sum, signal) => {
    if (signal.confidence === 'high') return sum + 5;
    if (signal.confidence === 'medium') return sum + 3;
    return sum;
  }, 0);
}

function signalTypeLabel(kind: PullSignal['kind']): string {
  if (kind === 'label_action') return 'Actor label';
  if (kind === 'close_action') return 'Actor close';
  if (kind === 'maintainer_comment') return 'Comment';
  if (kind === 'maintainer_review') return 'Review';
  if (kind === 'current_label') return 'Current label';
  return 'Closed PR';
}

function topCounts(values: string[], limit: number): Array<{ name: string; count: number }> {
  const counts = new Map<string, number>();
  for (const value of values) {
    if (!value) continue;
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
    .slice(0, limit);
}

function actorFromSignal(signal: PullSignal): string | null {
  if (signal.kind === 'current_label' || signal.kind === 'closed_unmerged') return null;
  const first = signal.detail.split(/\s+/, 1)[0] ?? '';
  if (!first || /^[^\w.\-[\]]/.test(first)) return null;
  return first;
}

function topActors(signals: PullSignal[], limit: number): string[] {
  const counts = new Map<string, number>();
  for (const signal of signals) {
    const actor = actorFromSignal(signal);
    if (!actor) continue;
    counts.set(actor, (counts.get(actor) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([name]) => name);
}

async function scanRepo(fullName: string) {
  const [owner, repo] = fullName.split('/');
  try {
    return await withRotation(async (octokit) => {
      const pullsResp = await octokit.pulls.list({ owner, repo, state: 'all', sort: 'updated', direction: 'desc', per_page: MAX_PULLS_PER_REPO });
      const pulls = pullsResp.data as unknown as WatchPull[];

      // Current hostile labels are observable from the PR list, so they are
      // screened across the full recent window. Event/comment/review history is
      // deeper and rate-limit sensitive, so it is checked on the highest-priority
      // candidates first.
      const indexed = pulls.map((pr, index) => {
        const labels = pullLabels(pr);
        const text = pullText(pr, labels);
        const hostileLabels = labels.filter((label) => HOSTILE_LABEL_PATTERN.test(label));
        const mentionsGittensor = GITTENSOR_PATTERN.test(text);
        const baseSignals = fallbackSignals(pr, hostileLabels, mentionsGittensor);
        return { pr, index, labels, hostileLabels, mentionsGittensor, baseSignals, baseScore: signalScore(baseSignals) };
      });

      const candidates = indexed
        .filter((entry) => entry.baseSignals.length > 0 || entry.index < MAX_EVIDENCE_PULLS_PER_REPO)
        .sort((a, b) => b.baseScore - a.baseScore || b.pr.updated_at.localeCompare(a.pr.updated_at))
        .slice(0, MAX_EVIDENCE_PULLS_PER_REPO);

      const evidence = await Promise.all(
        candidates.map(async (entry) => ({
          number: entry.pr.number,
          signals: await fetchPullActionSignals(octokit, owner, repo, entry.pr, entry.hostileLabels, entry.mentionsGittensor),
        })),
      );
      const evidenceByNumber = new Map(evidence.map((entry) => [entry.number, entry.signals]));

      const flagged = indexed
        .map((entry) => {
          const checkedSignals = evidenceByNumber.get(entry.pr.number);
          const signals = checkedSignals ?? currentLabelSignals(entry.hostileLabels);
          return {
            number: entry.pr.number,
            title: entry.pr.title,
            state: entry.pr.state,
            author_login: entry.pr.user?.login ?? null,
            author_association: entry.pr.author_association ?? null,
            labels: entry.labels,
            html_url: entry.pr.html_url,
            updated_at: entry.pr.updated_at,
            closed_at: entry.pr.closed_at,
            merged_at: entry.pr.merged_at,
            signals,
            score: signalScore(signals),
          };
        })
        .filter((pr) => pr.signals.length > 0)
        .sort((a, b) => b.score - a.score || b.updated_at.localeCompare(a.updated_at));

      const labelActions = flagged.reduce((sum, pr) => sum + pr.signals.filter((s) => s.kind === 'label_action' || s.kind === 'current_label').length, 0);
      const closedUnmerged = flagged.filter((pr) => pr.signals.some((s) => s.kind === 'close_action' || s.kind === 'closed_unmerged')).length;
      const highConfidence = flagged.reduce((sum, pr) => sum + pr.signals.filter((s) => s.confidence === 'high').length, 0);
      const score = flagged.reduce((sum, pr) => sum + pr.score, 0);
      const allSignals = flagged.flatMap((pr) => pr.signals);
      const activityDates = flagged.map((pr) => pr.updated_at).filter(Boolean).sort();

      return {
        full_name: fullName,
        html_url: `https://github.com/${fullName}`,
        description: null,
        stars: 0,
        scanned_at: new Date().toISOString(),
        score,
        severity: highConfidence > 0 || score >= 9 ? 'high' : score > 0 ? 'watch' : 'quiet',
        signal_count: flagged.reduce((sum, pr) => sum + pr.signals.length, 0),
        high_confidence: highConfidence,
        label_actions: labelActions,
        closed_unmerged: closedUnmerged,
        flagged_pull_count: flagged.length,
        pulls_scanned: pulls.length,
        evidence_pulls_scanned: candidates.length,
        top_labels: topCounts(allSignals.map((signal) => signal.label).filter((label): label is string => Boolean(label)), 6),
        top_signal_types: topCounts(allSignals.map((signal) => signalTypeLabel(signal.kind)), 4),
        primary_actors: topActors(allSignals, 3),
        activity_start: activityDates[0] ?? null,
        activity_end: activityDates[activityDates.length - 1] ?? null,
        pulls: flagged,
        error: null,
      };
    });
  } catch (err) {
    return {
      full_name: fullName,
      html_url: `https://github.com/${fullName}`,
      description: null,
      stars: 0,
      scanned_at: new Date().toISOString(),
      score: 0,
      severity: 'error',
      signal_count: 0,
      high_confidence: 0,
      label_actions: 0,
      closed_unmerged: 0,
      flagged_pull_count: 0,
      pulls_scanned: 0,
      evidence_pulls_scanned: 0,
      top_labels: [],
      top_signal_types: [],
      primary_actors: [],
      activity_start: null,
      activity_end: null,
      pulls: [],
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

type ScannedRepo = Awaited<ReturnType<typeof scanRepo>>;

type ScanCacheEntry = {
  expiresAt: number;
  promise: Promise<ScannedRepo>;
};

const scanCache = new Map<string, ScanCacheEntry>();

function cachedScanRepo(fullName: string, forceRefresh: boolean): Promise<ScannedRepo> {
  const key = fullName.toLowerCase();
  const now = Date.now();
  const cached = scanCache.get(key);
  if (!forceRefresh && cached && cached.expiresAt > now) return cached.promise;

  const promise = scanRepo(fullName).then((result) => {
    if (result.error) scanCache.delete(key);
    return result;
  }, (err) => {
    scanCache.delete(key);
    throw err;
  });
  scanCache.set(key, { expiresAt: now + SCAN_CACHE_TTL_MS, promise });
  return promise;
}

function newestScanTime(scanned: ScannedRepo[]): string {
  return scanned.reduce((latest, repo) => repo.scanned_at > latest ? repo.scanned_at : latest, scanned[0]?.scanned_at ?? new Date().toISOString());
}

export async function GET(req: NextRequest) {
  const repos = reposFromRequest(req);
  const url = new URL(req.url);
  const forceRefresh = url.searchParams.get('refresh') === '1';
  const scanned = await Promise.all(repos.map((repo) => cachedScanRepo(repo, forceRefresh)));
  scanned.sort((a, b) => b.score - a.score || a.full_name.localeCompare(b.full_name));

  return NextResponse.json({
    generated_at: newestScanTime(scanned),
    cache_ttl_ms: SCAN_CACHE_TTL_MS,
    repo_count: scanned.length,
    signal_count: scanned.reduce((sum, repo) => sum + repo.signal_count, 0),
    high_confidence: scanned.reduce((sum, repo) => sum + repo.high_confidence, 0),
    label_actions: scanned.reduce((sum, repo) => sum + repo.label_actions, 0),
    closed_unmerged: scanned.reduce((sum, repo) => sum + repo.closed_unmerged, 0),
    repos: scanned,
  }, { headers: RESPONSE_HEADERS });
}
