import fs from 'node:fs';
import path from 'node:path';
import { renderMarkdownToHtml } from '@/lib/markdown';

export type ChangelogEntry = {
  slug: string;
  date: string;
  title: string;
  bodyHtml: string;
};

const CHANGELOG_DIR = path.join(process.cwd(), 'content', 'changelog');

function parseFrontmatter(raw: string): { meta: Record<string, string>; body: string } {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (!match) return { meta: {}, body: raw.trim() };

  const meta: Record<string, string> = {};
  for (const line of match[1].split(/\r?\n/)) {
    const idx = line.indexOf(':');
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    const value = line
      .slice(idx + 1)
      .trim()
      .replace(/^["']|["']$/g, '');
    if (key) meta[key] = value;
  }
  return { meta, body: match[2].trim() };
}

function isIsoDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value));
}

export function getChangelogEntries(): ChangelogEntry[] {
  if (!fs.existsSync(CHANGELOG_DIR)) return [];

  const files = fs
    .readdirSync(CHANGELOG_DIR)
    .filter((name) => name.endsWith('.md'))
    .sort((a, b) => b.localeCompare(a));

  const entries: ChangelogEntry[] = [];
  for (const file of files) {
    const raw = fs.readFileSync(path.join(CHANGELOG_DIR, file), 'utf8');
    const { meta, body } = parseFrontmatter(raw);
    const date = meta.date?.trim() ?? '';
    const title = meta.title?.trim() ?? '';
    if (!isIsoDate(date) || !title || !body) continue;

    entries.push({
      slug: file.replace(/\.md$/, ''),
      date,
      title,
      bodyHtml: renderMarkdownToHtml(body, { repoFullName: 'e35mongo/gittensor-hub' }),
    });
  }

  return entries.sort((a, b) => b.date.localeCompare(a.date) || b.slug.localeCompare(a.slug));
}

export function formatChangelogDate(isoDate: string): string {
  const d = new Date(`${isoDate}T12:00:00Z`);
  if (!Number.isFinite(d.getTime())) return isoDate;
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'UTC',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(d);
}
