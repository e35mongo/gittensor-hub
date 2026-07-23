import { NextResponse } from 'next/server';
import { getPollerSnapshot } from '@/lib/poller-snapshot';

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json(await getPollerSnapshot());
}
