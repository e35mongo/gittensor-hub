#!/usr/bin/env node
/**
 * Automated PR review for unrelated UI work.
 *
 * Flags when a PR changes UI surfaces (pages/components/styles) that are
 * outside the linked issue's labeled scope (e.g. backend/docs-only wanted
 * issue), or when UI changes land with no linked issue / no frontend label.
 *
 * Usage (CI):
 *   node scripts/pr-ui-scope-review.mjs --pr <n> --repo owner/name [--write]
 */
import { execFileSync } from 'node:child_process';

const WRITE = process.argv.includes('--write');
const args = process.argv.slice(2);
function flag(name) {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : null;
}

const PR = flag('--pr') || process.env.PR_NUMBER;
const REPO = flag('--repo') || process.env.GITHUB_REPOSITORY;
const MARKER = '<!-- gittensor-hub:pr-ui-scope-review -->';

if (!PR || !REPO) {
  console.error('Usage: node scripts/pr-ui-scope-review.mjs --pr <n> --repo owner/name [--write]');
  process.exit(2);
}

function ghJson(ghArgs) {
  const out = execFileSync('gh', ghArgs, {
    encoding: 'utf8',
    env: process.env,
    maxBuffer: 10 * 1024 * 1024,
  });
  return JSON.parse(out || 'null');
}

function gh(ghArgs) {
  return execFileSync('gh', ghArgs, {
    encoding: 'utf8',
    env: process.env,
    maxBuffer: 10 * 1024 * 1024,
  });
}

/** Paths that count as UI / visual product surface. */
function isUiPath(file) {
  const f = file.replace(/\\/g, '/');
  if (f.startsWith('src/app/api/')) return false;
  if (f.startsWith('src/components/')) return true;
  if (f.startsWith('src/app/') && /\.(tsx|jsx|css|module\.css)$/.test(f)) return true;
  if (f === 'src/app/globals.css') return true;
  if (f.startsWith('public/') && /\.(png|jpg|jpeg|gif|svg|webp|ico)$/i.test(f)) return true;
  if (/\.module\.css$/.test(f)) return true;
  return false;
}

function isDocPath(file) {
  const f = file.replace(/\\/g, '/');
  return (
    f.startsWith('docs/') ||
    f === 'README.md' ||
    f === 'CONTRIBUTING.md' ||
    f === 'SECURITY.md' ||
    f.startsWith('.github/ISSUE_TEMPLATE/') ||
    f === '.github/PULL_REQUEST_TEMPLATE.md'
  );
}

function extractIssueNumbers(text) {
  const nums = new Set();
  const re =
    /(?:close[sd]?|fix(?:e[sd])?|resolve[sd]?)\s*:?\s*#(\d+)|(?:^|[^a-zA-Z0-9])#(\d+)\b/gi;
  let m;
  while ((m = re.exec(text || ''))) {
    const n = parseInt(m[1] || m[2], 10);
    if (Number.isFinite(n)) nums.add(n);
  }
  return [...nums];
}

const pr = ghJson([
  'pr', 'view', String(PR),
  '--repo', REPO,
  '--json', 'number,title,body,files,labels,author',
]);

const files = (pr.files || []).map((f) => f.path);
const uiFiles = files.filter(isUiPath);
const docFiles = files.filter(isDocPath);
const otherFiles = files.filter((f) => !isUiPath(f) && !isDocPath(f));

const issueNums = extractIssueNumbers(`${pr.title || ''}\n${pr.body || ''}`);
const issues = issueNums.map((n) => {
  try {
    return ghJson([
      'issue', 'view', String(n),
      '--repo', REPO,
      '--json', 'number,title,state,labels',
    ]);
  } catch {
    return null;
  }
}).filter(Boolean);

const openIssues = issues.filter((i) => i.state === 'OPEN');
const labelNames = new Set(
  openIssues.flatMap((i) => (i.labels || []).map((l) => l.name)),
);

const hasFrontendScope = labelNames.has('frontend');
const hasBackendScope = labelNames.has('backend');
const hasDocsScope = labelNames.has('docs') || labelNames.has('documentation');
const hasWanted = labelNames.has('gittensor-hub:wanted');
const isMaintainerOnly = labelNames.has('maintainer-only') || labelNames.has('roadmap');

const findings = [];

if (uiFiles.length > 0 && issueNums.length === 0) {
  findings.push({
    severity: 'major',
    code: 'ui-without-issue',
    message:
      'This PR changes UI files but does not reference a GitHub issue. Link an open `gittensor-hub:wanted` issue with the `frontend` label, or drop the UI files.',
  });
}

if (uiFiles.length > 0 && openIssues.length > 0 && !hasFrontendScope && (hasBackendScope || hasDocsScope)) {
  findings.push({
    severity: 'major',
    code: 'ui-outside-issue-scope',
    message:
      'Linked open issue(s) are scoped to backend/docs (no `frontend` label), but this PR changes UI surfaces. That is unrelated UI work — remove those files or retarget a `frontend` wanted issue.',
  });
}

if (uiFiles.length > 0 && openIssues.length > 0 && !hasFrontendScope && !hasBackendScope && !hasDocsScope && hasWanted) {
  findings.push({
    severity: 'minor',
    code: 'ui-wanted-missing-frontend-label',
    message:
      'Linked wanted issue has no `frontend` label. Maintainers should label scope; until then, UI diffs need explicit justification in the PR body.',
  });
}

if (uiFiles.length > 0 && isMaintainerOnly && !hasWanted) {
  findings.push({
    severity: 'major',
    code: 'ui-on-maintainer-epic',
    message:
      'Linked issue looks like a roadmap/maintainer-only epic. Open/use a sliced `gittensor-hub:wanted` child issue instead of landing UI on the epic.',
  });
}

const bodyLower = `${pr.body || ''}`.toLowerCase();
const hasVisualProof =
  /screenshot|before\s*\/\s*after|user-images\.githubusercontent|github\.com\/user-attachments|\.png|\.jpg|imgur|loom\.com|video/.test(
    bodyLower,
  );

if (uiFiles.length > 0 && !hasVisualProof) {
  findings.push({
    severity: 'minor',
    code: 'ui-missing-screenshot',
    message:
      'UI changes detected but the PR body has no screenshot / before-after proof. Add visual proof for any user-visible change.',
  });
}

// Drive-by UI mixed into a mostly-backend PR
if (uiFiles.length > 0 && otherFiles.length > 0 && hasBackendScope && !hasFrontendScope) {
  findings.push({
    severity: 'major',
    code: 'ui-mixed-into-backend-pr',
    message:
      'Backend-scoped issue with mixed UI file changes. Split UI into a separate PR against a frontend wanted issue, or remove the UI diff.',
  });
}

const major = findings.filter((f) => f.severity === 'major');
const summary = {
  repo: REPO,
  pr: Number(PR),
  write: WRITE,
  files: { ui: uiFiles, docs: docFiles, other: otherFiles },
  issues: openIssues.map((i) => ({
    number: i.number,
    title: i.title,
    labels: (i.labels || []).map((l) => l.name),
  })),
  findings,
  action: major.length > 0 ? 'flag' : findings.length > 0 ? 'nudge' : 'ok',
};

process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);

if (!WRITE) process.exit(0);

const existing = ghJson([
  'api',
  `repos/${REPO}/issues/${PR}/comments`,
  '--paginate',
]) || [];

const prior = existing.find(
  (c) => c.user?.type === 'Bot' && typeof c.body === 'string' && c.body.includes(MARKER),
);

let commentBody;
if (findings.length === 0) {
  commentBody = `${MARKER}
## PR UI scope review — clear

No unrelated UI-scope problems detected for the linked issue labels and changed paths.

_UI files:_ ${uiFiles.length ? uiFiles.map((f) => `\`${f}\``).join(', ') : '_none_'}
`;
} else {
  const lines = findings.map((f) => `- **${f.severity}** (\`${f.code}\`): ${f.message}`);
  const uiList = uiFiles.map((f) => `- \`${f}\``).join('\n') || '_none_';
  commentBody = `${MARKER}
## PR UI scope review

Automated check for **unrelated UI work** (pages/components/styles outside the linked issue’s scope).

### Findings
${lines.join('\n')}

### UI paths in this PR
${uiList}

### What to do
1. Keep the PR focused on the linked \`gittensor-hub:wanted\` issue.
2. If UI is intentional, the issue must include the \`frontend\` label (or open the correct frontend child issue).
3. For user-visible UI, add a screenshot / before-after in the PR body.
4. Drive-by UI polish on backend/docs issues may be labeled \`slop\` / \`pr:flagged\` and closed.

See [CONTRIBUTING.md](https://github.com/${REPO}/blob/main/CONTRIBUTING.md) and [docs/github-os.md](https://github.com/${REPO}/blob/main/docs/github-os.md).
`;
}

if (prior) {
  const payload = JSON.stringify({ body: commentBody });
  execFileSync('gh', ['api', '-X', 'PATCH', `repos/${REPO}/issues/comments/${prior.id}`, '--input', '-'], {
    encoding: 'utf8',
    env: process.env,
    input: payload,
  });
} else {
  gh(['pr', 'comment', String(PR), '--repo', REPO, '--body', commentBody]);
}

if (major.length > 0) {
  try {
    gh(['pr', 'edit', String(PR), '--repo', REPO, '--add-label', 'pr:flagged']);
  } catch {
    /* label may already exist on PR */
  }
  try {
    gh(['pr', 'edit', String(PR), '--repo', REPO, '--add-label', 'manual-review']);
  } catch {
    /* ignore */
  }
}

process.exit(0);
