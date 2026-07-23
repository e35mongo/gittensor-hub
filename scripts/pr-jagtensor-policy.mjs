#!/usr/bin/env node
/**
 * jagtensor policy review — deterministic hub PR gates.
 *
 * Checks: linked issue, UI scope, screenshots, size, protected paths,
 * concurrent open PRs, and src-without-tests nudges.
 *
 * Usage (CI):
 *   node scripts/pr-jagtensor-policy.mjs --pr <n> --repo owner/name [--write]
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
const MARKER = '<!-- gittensor-hub:jagtensor-policy -->';
const LEGACY_MARKERS = [
  MARKER,
  '<!-- gittensor-hub:jaguar-policy -->',
  '<!-- gittensor-hub:pr-ui-scope-review -->',
];
const MAX_OPEN_PRS = 5;
const SIZE_WARN_FILES = 25;
const SIZE_WARN_LINES = 600;
const SIZE_HOLD_FILES = 45;
const SIZE_HOLD_LINES = 1200;

if (!PR || !REPO) {
  console.error('Usage: node scripts/pr-jagtensor-policy.mjs --pr <n> --repo owner/name [--write]');
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

function isProtectedPath(file) {
  const f = file.replace(/\\/g, '/');
  return (
    f.startsWith('.github/workflows/') ||
    f.startsWith('.github/actions/') ||
    f === '.github/dependabot.yml' ||
    f.startsWith('scripts/') ||
    f === 'package.json' ||
    f === 'pnpm-lock.yaml' ||
    f === 'pnpm-workspace.yaml' ||
    f.startsWith('next.config.') ||
    f === 'tsconfig.json' ||
    f === 'eslint.config.mjs'
  );
}

function isSrcCodePath(file) {
  const f = file.replace(/\\/g, '/');
  if (!f.startsWith('src/')) return false;
  if (/\.(css|scss|sass|md|svg)$/i.test(f)) return false;
  return /\.(ts|tsx|js|jsx|mjs|cjs)$/.test(f);
}

function isTestPath(file) {
  const f = file.replace(/\\/g, '/');
  return (
    /(^|\/)(__tests__|tests|test)\//.test(f) ||
    /\.(test|spec)\.(ts|tsx|js|jsx|mjs)$/.test(f) ||
    f.startsWith('e2e/') ||
    f.startsWith('playwright/')
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
  '--json', 'number,title,body,files,labels,author,additions,deletions,changedFiles',
]);

let association = '';
try {
  const rest = ghJson(['api', `repos/${REPO}/pulls/${PR}`]);
  association = String(rest?.author_association || '').toUpperCase();
} catch {
  association = '';
}

const authorLogin = pr.author?.login || '';
const filesMeta = pr.files || [];
const files = filesMeta.map((f) => f.path);
const uiFiles = files.filter(isUiPath);
const docFiles = files.filter(isDocPath);
const protectedFiles = files.filter(isProtectedPath);
const srcCodeFiles = files.filter(isSrcCodePath);
const testFiles = files.filter(isTestPath);
const otherFiles = files.filter((f) => !isUiPath(f) && !isDocPath(f));

const lineDelta =
  Number(pr.additions || 0) + Number(pr.deletions || 0) ||
  filesMeta.reduce((n, f) => n + Number(f.additions || 0) + Number(f.deletions || 0), 0);
const fileCount = Number(pr.changedFiles || files.length);

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
const writer = ['OWNER', 'MEMBER', 'COLLABORATOR'].includes(association);

const findings = [];

if (!writer && issueNums.length === 0) {
  findings.push({
    severity: 'major',
    code: 'missing-linked-issue',
    message:
      'No GitHub issue reference (`#N` / `Closes #N`). Score-eligible work must link a currently-open `gittensor-hub:wanted` (or help wanted) issue.',
  });
} else if (!writer && issueNums.length > 0 && openIssues.length === 0) {
  findings.push({
    severity: 'major',
    code: 'linked-issue-not-open',
    message:
      'Referenced issue(s) are closed or missing. Link a **currently-open** issue for Hub Score eligibility.',
  });
}

if (uiFiles.length > 0 && issueNums.length === 0) {
  findings.push({
    severity: 'major',
    code: 'ui-without-issue',
    message:
      'UI files changed with no linked issue. Link an open `gittensor-hub:wanted` issue with the `frontend` label, or drop the UI files.',
  });
}

if (uiFiles.length > 0 && openIssues.length > 0 && !hasFrontendScope && (hasBackendScope || hasDocsScope)) {
  findings.push({
    severity: 'major',
    code: 'ui-outside-issue-scope',
    message:
      'Linked open issue(s) are scoped to backend/docs (no `frontend` label), but this PR changes UI surfaces. Remove those files or retarget a `frontend` wanted issue.',
  });
}

if (uiFiles.length > 0 && openIssues.length > 0 && !hasFrontendScope && !hasBackendScope && !hasDocsScope && hasWanted) {
  findings.push({
    severity: 'minor',
    code: 'ui-wanted-missing-frontend-label',
    message:
      'Linked wanted issue has no `frontend` label. Maintainers should label scope; until then, justify UI diffs in the PR body.',
  });
}

if (uiFiles.length > 0 && isMaintainerOnly && !hasWanted) {
  findings.push({
    severity: 'major',
    code: 'ui-on-maintainer-epic',
    message:
      'Linked issue looks like a roadmap/maintainer-only epic. Use a sliced `gittensor-hub:wanted` child issue instead.',
  });
}

const bodyLower = `${pr.body || ''}`.toLowerCase();
const hasVisualProof =
  /screenshot|before\s*\/\s*after|user-images\.githubusercontent|github\.com\/user-attachments|\.png|\.jpg|imgur|loom\.com|video/.test(
    bodyLower,
  );

if (uiFiles.length > 0 && !hasVisualProof) {
  findings.push({
    severity: hasFrontendScope || uiFiles.length >= 3 ? 'major' : 'minor',
    code: 'ui-missing-screenshot',
    message:
      'UI changes detected but the PR body has no screenshot / before-after proof. Add visual proof for user-visible changes.',
  });
}

if (uiFiles.length > 0 && otherFiles.length > 0 && hasBackendScope && !hasFrontendScope) {
  findings.push({
    severity: 'major',
    code: 'ui-mixed-into-backend-pr',
    message:
      'Backend-scoped issue with mixed UI file changes. Split UI into a separate PR against a frontend wanted issue.',
  });
}

if (protectedFiles.length > 0 && !writer && !isMaintainerOnly) {
  findings.push({
    severity: 'major',
    code: 'protected-paths',
    message:
      `This PR touches protected maintainer paths (${protectedFiles.map((f) => `\`${f}\``).join(', ')}). Community PRs should not change workflows, scripts, lockfiles, or app config unless a maintainer-only issue explicitly asks for it.`,
  });
}

if (fileCount >= SIZE_HOLD_FILES || lineDelta >= SIZE_HOLD_LINES) {
  findings.push({
    severity: 'major',
    code: 'oversized-pr',
    message:
      `PR is large (${fileCount} files, ${lineDelta} lines changed). Split into focused PRs against sliced wanted issues; oversized diffs are held for \`manual-review\`.`,
  });
} else if (fileCount >= SIZE_WARN_FILES || lineDelta >= SIZE_WARN_LINES) {
  findings.push({
    severity: 'minor',
    code: 'large-pr',
    message:
      `PR is getting large (${fileCount} files, ${lineDelta} lines). Prefer smaller, reviewable slices.`,
  });
}

if (srcCodeFiles.length > 0 && testFiles.length === 0) {
  const onlyApiOrLib = srcCodeFiles.every(
    (f) => f.startsWith('src/lib/') || f.startsWith('src/app/api/') || f.startsWith('src/server/'),
  );
  findings.push({
    severity: onlyApiOrLib ? 'minor' : 'minor',
    code: 'src-without-tests',
    message:
      'Source files changed with no test / e2e files in the diff. Add coverage when practical, or note why tests are N/A in the PR body.',
  });
}

let openByAuthor = [];
try {
  openByAuthor = ghJson([
    'pr', 'list',
    '--repo', REPO,
    '--author', authorLogin,
    '--state', 'open',
    '--json', 'number,title',
    '--limit', '20',
  ]) || [];
} catch {
  openByAuthor = [];
}

if (!writer && authorLogin && openByAuthor.length > MAX_OPEN_PRS) {
  findings.push({
    severity: 'major',
    code: 'too-many-open-prs',
    message:
      `Author \`@${authorLogin}\` has ${openByAuthor.length} open PRs (max ${MAX_OPEN_PRS}). Close or merge existing work before opening more — see CONTRIBUTING.md.`,
  });
}

const major = findings.filter((f) => f.severity === 'major');
const findingCodes = new Set(findings.map((f) => f.code));

const FINDING_LABELS = {
  'missing-linked-issue': 'pr:missing-issue',
  'linked-issue-not-open': 'pr:issue-closed',
  'ui-without-issue': 'pr:ui-scope',
  'ui-outside-issue-scope': 'pr:ui-scope',
  'ui-on-maintainer-epic': 'pr:ui-scope',
  'ui-mixed-into-backend-pr': 'pr:ui-scope',
  'ui-wanted-missing-frontend-label': 'pr:needs-frontend-label',
  'ui-missing-screenshot': 'pr:needs-screenshot',
  'protected-paths': 'pr:protected-paths',
  'oversized-pr': 'pr:oversized',
  'large-pr': 'pr:large',
  'too-many-open-prs': 'pr:too-many-open',
  'src-without-tests': 'pr:needs-tests',
};

const MANAGED_FINDING_LABELS = [
  ...new Set(Object.values(FINDING_LABELS)),
  'pr:needs-work',
  'pr:flagged',
  'manual-review',
];

const SIZE_LABELS = ['pr:size/xs', 'pr:size/s', 'pr:size/m', 'pr:size/l', 'pr:size/xl'];
const SURFACE_LABELS = ['pr:ui', 'pr:api', 'pr:ci', 'pr:deps', 'pr:docs-only'];

function sizeLabelFor(filesN, linesN) {
  if (filesN <= 2 && linesN <= 50) return 'pr:size/xs';
  if (filesN <= 8 && linesN <= 200) return 'pr:size/s';
  if (filesN <= SIZE_WARN_FILES && linesN <= SIZE_WARN_LINES) return 'pr:size/m';
  if (filesN <= SIZE_HOLD_FILES && linesN <= SIZE_HOLD_LINES) return 'pr:size/l';
  return 'pr:size/xl';
}

function surfaceLabelsFor(paths) {
  const out = new Set();
  let onlyDocs = paths.length > 0;
  for (const f of paths) {
    const p = f.replace(/\\/g, '/');
    if (isUiPath(p)) out.add('pr:ui');
    if (p.startsWith('src/app/api/') || p.startsWith('src/server/')) out.add('pr:api');
    if (p.startsWith('.github/workflows/') || p.startsWith('.github/actions/')) out.add('pr:ci');
    if (p === 'package.json' || p === 'pnpm-lock.yaml' || p.startsWith('package-lock')) out.add('pr:deps');
    if (!isDocPath(p)) onlyDocs = false;
  }
  if (onlyDocs) out.add('pr:docs-only');
  return [...out];
}

const desiredSize = sizeLabelFor(fileCount, lineDelta);
const desiredSurface = surfaceLabelsFor(files);
const desiredFinding = new Set(
  [...findingCodes].map((c) => FINDING_LABELS[c]).filter(Boolean),
);
if (findings.length > 0) desiredFinding.add('pr:needs-work');
if (major.length > 0) {
  desiredFinding.add('pr:flagged');
  desiredFinding.add('manual-review');
}

const summary = {
  bot: 'jagtensor',
  repo: REPO,
  pr: Number(PR),
  write: WRITE,
  author: authorLogin,
  authorAssociation: association || null,
  size: { files: fileCount, lines: lineDelta, label: desiredSize },
  surfaceLabels: desiredSurface,
  findingLabels: [...desiredFinding],
  openPrsByAuthor: openByAuthor.map((p) => p.number),
  files: {
    ui: uiFiles,
    docs: docFiles,
    protected: protectedFiles,
    src: srcCodeFiles,
    tests: testFiles,
    other: otherFiles,
  },
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
  (c) => typeof c.body === 'string' && LEGACY_MARKERS.some((m) => c.body.includes(m)),
);

let commentBody;
if (findings.length === 0) {
  commentBody = `${MARKER}
## jagtensor policy — clear

No policy findings for linked-issue, UI scope, size, protected paths, or open-PR limits.

_Files:_ ${fileCount} · _Δ lines:_ ${lineDelta} · _size:_ \`${desiredSize}\`
`;
} else {
  const lines = findings.map((f) => `- **${f.severity}** (\`${f.code}\`): ${f.message}`);
  const labelList = [...desiredFinding, desiredSize, ...desiredSurface].map((l) => `\`${l}\``).join(', ');
  commentBody = `${MARKER}
## jagtensor policy review

Deterministic hub gates. Fix majors before asking for merge.

### Findings
${lines.join('\n')}

### Snapshot
| | |
| --- | --- |
| Files / lines | ${fileCount} / ${lineDelta} (\`${desiredSize}\`) |
| UI paths | ${uiFiles.length ? uiFiles.map((f) => `\`${f}\``).join(', ') : '_none_'} |
| Protected paths | ${protectedFiles.length ? protectedFiles.map((f) => `\`${f}\``).join(', ') : '_none_'} |
| Open PRs by author | ${openByAuthor.length} (max ${MAX_OPEN_PRS}) |
| Linked open issues | ${openIssues.length ? openIssues.map((i) => `#${i.number}`).join(', ') : '_none_'} |
| Labels applied | ${labelList || '_none_'} |

### What to do
1. Link an open \`gittensor-hub:wanted\` issue and keep the diff on-scope.
2. No unrelated UI on backend/docs issues; UI needs screenshots.
3. Leave workflows / \`scripts/*\` / lockfiles / Next config to maintainers unless asked.
4. Stay at ≤ ${MAX_OPEN_PRS} open PRs; split oversized diffs.

See [CONTRIBUTING.md](https://github.com/${REPO}/blob/main/CONTRIBUTING.md) · [docs/bots.md](https://github.com/${REPO}/blob/main/docs/bots.md) · [docs/pr-labels.md](https://github.com/${REPO}/blob/main/docs/pr-labels.md).
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

function addLabel(name) {
  try {
    gh(['pr', 'edit', String(PR), '--repo', REPO, '--add-label', name]);
  } catch {
    /* already present or missing */
  }
}

function removeLabel(name) {
  try {
    gh(['pr', 'edit', String(PR), '--repo', REPO, '--remove-label', name]);
  } catch {
    /* not present */
  }
}

const desiredAll = new Set([...desiredFinding, desiredSize, ...desiredSurface]);

for (const name of MANAGED_FINDING_LABELS) {
  if (desiredFinding.has(name)) addLabel(name);
  else removeLabel(name);
}

for (const name of SIZE_LABELS) {
  if (name === desiredSize) addLabel(name);
  else removeLabel(name);
}

for (const name of SURFACE_LABELS) {
  if (desiredSurface.includes(name)) addLabel(name);
  else removeLabel(name);
}

// keep summary accurate for operators reading stdout already printed
void desiredAll;

process.exit(0);
