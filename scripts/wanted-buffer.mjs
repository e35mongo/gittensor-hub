#!/usr/bin/env node
/**
 * Ensure open gittensor-hub:wanted issues meet the floor defined in
 * .github/wanted-backlog.json. Creates missing issues (by exact title match).
 *
 * Usage:
 *   node scripts/wanted-buffer.mjs           # dry-run
 *   node scripts/wanted-buffer.mjs --write   # create missing issues
 *
 * Requires: gh auth, GH_TOKEN or default gh credentials.
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const WRITE = process.argv.includes('--write');
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const BACKLOG_PATH = path.join(ROOT, '.github', 'wanted-backlog.json');
const REPO = process.env.GITHUB_REPOSITORY || 'MkDev11/gittensor-hub';

function ghJson(args) {
  const out = execFileSync('gh', args, {
    encoding: 'utf8',
    env: process.env,
    maxBuffer: 10 * 1024 * 1024,
  });
  return JSON.parse(out || 'null');
}

function gh(args) {
  return execFileSync('gh', args, {
    encoding: 'utf8',
    env: process.env,
    maxBuffer: 10 * 1024 * 1024,
  });
}

const backlog = JSON.parse(fs.readFileSync(BACKLOG_PATH, 'utf8'));
const minOpen = Number(backlog.min_open || 5);
const items = Array.isArray(backlog.items) ? backlog.items : [];

const openWanted = (ghJson([
  'issue', 'list',
  '--repo', REPO,
  '--state', 'open',
  '--limit', '100',
  '--json', 'number,title,labels',
]) || []).filter((i) => (i.labels || []).some((l) => l.name === 'gittensor-hub:wanted'));

const openTitles = new Set(openWanted.map((i) => i.title));
const milestones = ghJson([
  'api', `repos/${REPO}/milestones?state=open&per_page=50`,
]) || [];
const milestoneByTitle = new Map(milestones.map((m) => [m.title, m.number]));

const missing = items.filter((item) => !openTitles.has(item.title));
const created = [];

for (const item of missing) {
  if (!WRITE) {
    created.push({ dry_run: true, title: item.title, id: item.id });
    continue;
  }
  const args = [
    'issue', 'create',
    '--repo', REPO,
    '--title', item.title,
    '--body', item.body || `Wanted backlog item \`${item.id}\`.`,
  ];
  for (const label of item.labels || ['gittensor-hub:wanted', 'help wanted']) {
    args.push('--label', label);
  }
  if (item.milestone && milestoneByTitle.has(item.milestone)) {
    args.push('--milestone', item.milestone);
  }
  const url = gh(args).trim();
  created.push({ title: item.title, id: item.id, url });
}

const openAfter = WRITE
  ? ((ghJson([
      'issue', 'list',
      '--repo', REPO,
      '--state', 'open',
      '--limit', '100',
      '--json', 'number,title,labels',
    ]) || []).filter((i) => (i.labels || []).some((l) => l.name === 'gittensor-hub:wanted')))
  : openWanted;

const projectedOpen = WRITE ? openAfter.length : openWanted.length + missing.length;
const summary = {
  repo: REPO,
  write: WRITE,
  min_open: minOpen,
  open_wanted_before: openWanted.length,
  open_wanted_after: openAfter.length,
  backlog_items: items.length,
  missing_before: missing.length,
  created,
  floor_met: projectedOpen >= minOpen,
};

process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);

if (WRITE && openAfter.length < minOpen) {
  console.error(
    `[wanted-buffer] open gittensor-hub:wanted (${openAfter.length}) still below min_open (${minOpen}). Add more backlog items.`,
  );
  process.exitCode = 1;
}
