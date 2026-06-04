import { NextResponse } from 'next/server';
import { cachedWithRotation, withRotation } from '@/lib/github';
import { assertTrackedRepo } from '@/lib/assert-tracked-repo';

export const dynamic = 'force-dynamic';

const CANDIDATES = [
  'CONTRIBUTING.md',
  'CONTRIBUTING.MD',
  'docs/CONTRIBUTING.md',
  '.github/CONTRIBUTING.md',
  'contributing.md',
];

export async function GET(_req: Request, ctx: { params: Promise<{ owner: string; name: string }> }) {
  const params = await ctx.params;
  const denied = await assertTrackedRepo(params.owner, params.name);
  if (denied) return denied;
  const { owner, name } = params;

  // Cache the whole probe sequence as one unit — keyed on repo so repeated
  // opens of the same repo's Contributing tab don't each walk CANDIDATES.
  try {
    const result = await cachedWithRotation(`contributing:${owner}/${name}`, async () => {
      for (const path of CANDIDATES) {
        try {
          const r = await withRotation((octokit) =>
            octokit.rest.repos.getContent({
              owner,
              repo: name,
              path,
              mediaType: { format: 'raw' },
            }),
          );
          const content = typeof r.data === 'string' ? r.data : '';
          if (content) return { content, path };
        } catch (err) {
          const status = (err as { status?: number })?.status ?? 0;
          if (status === 404) continue;
          throw err;
        }
      }
      return { content: null, missing: true };
    });
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 502 });
  }
}
