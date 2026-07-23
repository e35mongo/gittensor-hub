import fs from 'node:fs';
import path from 'node:path';

export type ChatCitation = {
  id: string;
  path: string;
  title: string;
};

export type ChatRetrieveResult = {
  answer: string;
  citations: ChatCitation[];
  refused: boolean;
  disclaimer: string;
};

type ManifestDoc = {
  id: string;
  path: string;
  title: string;
  tags?: string[];
};

type Manifest = {
  version: number;
  documents: ManifestDoc[];
};

type Chunk = {
  id: string;
  path: string;
  title: string;
  tags: string[];
  heading: string;
  text: string;
};

const DISCLAIMER =
  'Answers are retrieved from the Hub knowledge pack only. Per-repo Gittensor configs vary — verify live docs and the master registry. This is not financial advice and does not invent emission figures.';

const MANIFEST_PATH = path.join(process.cwd(), 'docs', 'chat', 'manifest.json');
const MIN_SCORE = 2.5;
const TOP_K = 3;
const MAX_QUESTION_LEN = 500;

const STOPWORDS = new Set([
  'a',
  'an',
  'the',
  'and',
  'or',
  'to',
  'of',
  'in',
  'on',
  'for',
  'is',
  'are',
  'was',
  'were',
  'be',
  'as',
  'at',
  'by',
  'from',
  'with',
  'that',
  'this',
  'it',
  'how',
  'what',
  'why',
  'when',
  'where',
  'do',
  'does',
  'did',
  'can',
  'could',
  'should',
  'would',
  'me',
  'my',
  'you',
  'your',
  'about',
  'into',
  'than',
  'then',
  'there',
  'their',
  'them',
  'these',
  'those',
  'any',
  'all',
  'if',
  'so',
  'not',
  'no',
  'yes',
]);

let cachedChunks: Chunk[] | null = null;

function tokenize(input: string): string[] {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9_./%-]+/g, ' ')
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 2 && !STOPWORDS.has(t));
}

function loadManifest(): Manifest {
  const raw = fs.readFileSync(MANIFEST_PATH, 'utf8');
  const data = JSON.parse(raw) as Manifest;
  if (!Array.isArray(data.documents) || data.documents.length === 0) {
    throw new Error('docs/chat/manifest.json has no documents');
  }
  return data;
}

function stripMarkdownNoise(text: string): string {
  return text
    .replace(/^#+\s+/gm, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\*\*?/g, '')
    .replace(/^[-*]\s+/gm, '')
    .replace(/\|/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function chunkDocument(doc: ManifestDoc, body: string): Chunk[] {
  const withoutSources = body.replace(/\n## Sources\s*\n[\s\S]*$/i, '\n');
  const parts = withoutSources.split(/\n(?=##\s+)/);
  const chunks: Chunk[] = [];

  for (let i = 0; i < parts.length; i++) {
    const part = parts[i].trim();
    if (!part) continue;
    const headingMatch = part.match(/^##\s+(.+)$/m);
    const heading = headingMatch?.[1]?.trim() || (i === 0 ? 'Overview' : `Section ${i + 1}`);
    if (/^sources$/i.test(heading)) continue;
    const text = stripMarkdownNoise(part);
    if (text.length < 40) continue;
    chunks.push({
      id: doc.id,
      path: doc.path,
      title: doc.title,
      tags: doc.tags ?? [],
      heading,
      text,
    });
  }

  if (chunks.length === 0) {
    const text = stripMarkdownNoise(withoutSources);
    if (text) {
      chunks.push({
        id: doc.id,
        path: doc.path,
        title: doc.title,
        tags: doc.tags ?? [],
        heading: 'Overview',
        text,
      });
    }
  }

  return chunks;
}

function getChunks(): Chunk[] {
  if (cachedChunks) return cachedChunks;
  const manifest = loadManifest();
  const chunks: Chunk[] = [];
  for (const doc of manifest.documents) {
    const abs = path.join(process.cwd(), doc.path);
    if (!fs.existsSync(abs)) continue;
    const body = fs.readFileSync(abs, 'utf8');
    chunks.push(...chunkDocument(doc, body));
  }
  cachedChunks = chunks;
  return chunks;
}

function scoreChunk(chunk: Chunk, queryTokens: string[]): number {
  if (queryTokens.length === 0) return 0;
  const hay = `${chunk.title} ${chunk.heading} ${chunk.tags.join(' ')} ${chunk.text}`.toLowerCase();
  const hayTokens = new Set(tokenize(hay));
  let score = 0;
  for (const token of queryTokens) {
    if (hayTokens.has(token)) score += 1.2;
    else if (hay.includes(token)) score += 0.6;
    if (chunk.tags.some((t) => t.toLowerCase() === token || t.toLowerCase().includes(token))) {
      score += 1.5;
    }
    if (chunk.title.toLowerCase().includes(token)) score += 1.0;
    if (chunk.heading.toLowerCase().includes(token)) score += 0.8;
  }
  return score;
}

function pickSentences(text: string, queryTokens: string[], limit = 4): string[] {
  const sentences = text
    .split(/(?<=[.!?])\s+|\n+/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 30 && s.length <= 420)
    .filter((s) => !/^sources$/i.test(s))
    .filter((s) => !/^https?:\/\//i.test(s));

  const ranked = sentences
    .map((s) => {
      const lower = s.toLowerCase();
      let score = 0;
      for (const t of queryTokens) {
        if (lower.includes(t)) score += 1;
      }
      return { s, score };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score || a.s.length - b.s.length);

  const out: string[] = [];
  for (const item of ranked) {
    if (out.includes(item.s)) continue;
    out.push(item.s);
    if (out.length >= limit) break;
  }

  if (out.length === 0) {
    const fallback = sentences.slice(0, Math.min(2, sentences.length));
    return fallback;
  }
  return out;
}

function buildAnswer(chunks: Chunk[], queryTokens: string[]): string {
  const lines: string[] = [];
  for (const chunk of chunks) {
    const sentences = pickSentences(chunk.text, queryTokens, chunk === chunks[0] ? 4 : 2);
    if (sentences.length === 0) continue;
    lines.push(`From “${chunk.title}” (${chunk.heading}):`);
    for (const s of sentences) {
      lines.push(`- ${s}`);
    }
  }
  return lines.join('\n');
}

function refuse(message: string): ChatRetrieveResult {
  return {
    answer: message,
    citations: [],
    refused: true,
    disclaimer: DISCLAIMER,
  };
}

/** Retrieve extractive answer + citations from docs/chat. No LLM. */
export function retrieveChatAnswer(rawQuestion: unknown): ChatRetrieveResult {
  if (typeof rawQuestion !== 'string') {
    return refuse('Ask a question as a string in the `question` field.');
  }
  const question = rawQuestion.trim().replace(/\s+/g, ' ');
  if (!question) {
    return refuse('Ask a non-empty question about Gittensor or Gittensor Hub.');
  }
  if (question.length > MAX_QUESTION_LEN) {
    return refuse(`Keep questions under ${MAX_QUESTION_LEN} characters.`);
  }

  const queryTokens = tokenize(question);
  if (queryTokens.length === 0) {
    return refuse('I could not extract searchable terms from that question.');
  }

  const scored = getChunks()
    .map((chunk) => ({ chunk, score: scoreChunk(chunk, queryTokens) }))
    .filter((x) => x.score >= MIN_SCORE)
    .sort((a, b) => b.score - a.score);

  if (scored.length === 0) {
    return refuse(
      'I do not have enough grounded material in the Hub knowledge pack to answer that. Try asking about SN74 emissions, mining/registration, Hub contributions, or Hub Score vs TAO.'
    );
  }

  const top = scored.slice(0, TOP_K).map((x) => x.chunk);
  const seen = new Set<string>();
  const citations: ChatCitation[] = [];
  for (const chunk of top) {
    if (seen.has(chunk.path)) continue;
    seen.add(chunk.path);
    citations.push({ id: chunk.id, path: chunk.path, title: chunk.title });
  }

  const answer = buildAnswer(top, queryTokens);
  if (!answer.trim()) {
    return refuse(
      'I found related docs but could not extract a grounded answer. Try a more specific question about emissions, mining, or Hub contribution rules.'
    );
  }

  return {
    answer,
    citations,
    refused: false,
    disclaimer: DISCLAIMER,
  };
}

/** Test helper — clear in-memory corpus cache. */
export function __resetChatRetrievalCacheForTests(): void {
  cachedChunks = null;
}
