#!/usr/bin/env node
/**
 * Parse a PR comment for @jagtensor slash commands (maintainer-only).
 *
 *   node scripts/jagtensor-commands.mjs \
 *     --association OWNER --login e35mongo --pr 291 --repo owner/name [--write]
 *
 * Comment body: --body "..." or env COMMENT_BODY (preferred for multiline).
 * Prints JSON: { ok, command, authorized, action }
 */
import { execFileSync } from 'node:child_process';

function arg(name, fallback = '') {
  const i = process.argv.indexOf(`--${name}`);
  if (i === -1) return fallback;
  return process.argv[i + 1] ?? fallback;
}

const BODY = arg('body', process.env.COMMENT_BODY || '');
const ASSOCIATION = String(arg('association', process.env.COMMENT_ASSOCIATION || '')).toUpperCase();
const LOGIN = arg('login', process.env.COMMENT_LOGIN || '');
const PR = Number(arg('pr', process.env.PR_NUMBER || '0'));
const REPO = arg('repo', process.env.GITHUB_REPOSITORY || '');
const COMMENT_ID = arg('comment-id', process.env.COMMENT_ID || '');
const WRITE = process.argv.includes('--write');

const MAINTAINER_ASSOCIATIONS = new Set(['OWNER', 'MEMBER', 'COLLABORATOR']);

const COMMANDS = {
  review: 'Re-run jagtensor policy on this PR (sticky comment + labels).',
  policy: 'Alias for /review.',
  help: 'List maintainer-only jagtensor commands.',
};

/** @returns {string | null} */
function parseCommand(body) {
  const text = String(body || '').replace(/\r\n/g, '\n').trim();
  if (!text) return null;

  const mention = text.match(/@jagtensor\b[\s,]*(?:\/)?([a-z][\w-]*)/i);
  if (mention) return mention[1].toLowerCase();

  const firstLine = text.split('\n')[0].trim();
  const bare = firstLine.match(/^\/([a-z][\w-]*)\b/i);
  if (bare) return bare[1].toLowerCase();

  return null;
}

function gh(args) {
  return execFileSync('gh', args, {
    encoding: 'utf8',
    env: process.env,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

function reply(body) {
  if (!WRITE || !REPO || !PR) return;
  gh(['pr', 'comment', String(PR), '--repo', REPO, '--body', body]);
}

function react(content) {
  if (!WRITE || !REPO || !COMMENT_ID) return;
  try {
    gh([
      'api',
      '-X',
      'POST',
      `repos/${REPO}/issues/comments/${COMMENT_ID}/reactions`,
      '-f',
      `content=${content}`,
    ]);
  } catch {
    // best-effort
  }
}

function emit(obj) {
  process.stdout.write(JSON.stringify(obj) + '\n');
}

const raw = parseCommand(BODY);
if (!raw) {
  emit({ ok: true, command: null, authorized: null, action: 'ignore' });
  process.exit(0);
}

const known = raw in COMMANDS;
const normalized = raw === 'policy' ? 'review' : raw;
const authorized = MAINTAINER_ASSOCIATIONS.has(ASSOCIATION);

if (!known) {
  if (WRITE && authorized) {
    react('confused');
    reply(
      [
        '<!-- gittensor-hub:jagtensor-command -->',
        `Unknown command \`/${raw}\`. Maintainer commands:`,
        '',
        ...Object.entries(COMMANDS).map(([k, v]) => `- \`@jagtensor /${k}\` — ${v}`),
      ].join('\n')
    );
  }
  emit({ ok: false, command: raw, authorized, action: 'unknown' });
  process.exit(0);
}

if (!authorized) {
  if (WRITE) {
    react('-1');
    reply(
      [
        '<!-- gittensor-hub:jagtensor-command -->',
        `@${LOGIN || 'there'} jagtensor slash commands are **maintainer-only** (\`OWNER\` / \`MEMBER\` / \`COLLABORATOR\`).`,
        '',
        `Your association here is \`${ASSOCIATION || 'NONE'}\`. Ask a maintainer to run \`@jagtensor /review\` if you need a re-check.`,
      ].join('\n')
    );
  }
  emit({ ok: false, command: normalized, authorized: false, action: 'denied' });
  process.exit(0);
}

if (normalized === 'help') {
  if (WRITE) {
    react('+1');
    reply(
      [
        '<!-- gittensor-hub:jagtensor-command -->',
        '## jagtensor commands (maintainers)',
        '',
        ...Object.entries(COMMANDS).map(([k, v]) => `- \`@jagtensor /${k}\` — ${v}`),
        '',
        '_Community contributors cannot invoke these; policy still runs automatically on every PR push._',
      ].join('\n')
    );
  }
  emit({ ok: true, command: 'help', authorized: true, action: 'help' });
  process.exit(0);
}

// /review — workflow runs policy after this script authorizes
if (WRITE) react('eyes');
emit({ ok: true, command: 'review', authorized: true, action: 'review' });
