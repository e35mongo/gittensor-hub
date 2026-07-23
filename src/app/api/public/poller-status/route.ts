import { NextResponse } from 'next/server';
import { getPollerSnapshot, pollerHealth } from '@/lib/poller-snapshot';

export const dynamic = 'force-dynamic';

/** Public poller freshness (no auth) for /status. */
export async function GET() {
  const snapshot = await getPollerSnapshot();
  return NextResponse.json({
    ok: true,
    health: pollerHealth(snapshot),
    ...snapshot,
  });
}
