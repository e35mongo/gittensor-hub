import { NextResponse } from 'next/server';
import { retrieveChatAnswer } from '@/lib/chat-retrieval';

export const dynamic = 'force-dynamic';

/**
 * Public chat retrieval over docs/chat (no auth).
 * Extractive MVP — no LLM; answers only from retrieved chunks + citations.
 *
 * POST JSON: { "question": string }
 */
export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      {
        ok: false,
        error: 'Expected JSON body with a `question` string.',
        disclaimer:
          'Answers are retrieved from the Hub knowledge pack only. Per-repo Gittensor configs vary — verify live docs and the master registry.',
      },
      { status: 400 }
    );
  }

  const question =
    body && typeof body === 'object' && 'question' in body
      ? (body as { question: unknown }).question
      : undefined;

  const result = retrieveChatAnswer(question);
  return NextResponse.json({
    ok: true,
    ...result,
  });
}
