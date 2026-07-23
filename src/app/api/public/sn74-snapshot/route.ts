import { NextResponse } from 'next/server';
import { getSn74Snapshot } from '@/lib/sn74-snapshot';

export const dynamic = 'force-dynamic';

/** Public SN74 snapshot for the landing proof strip. No auth. */
export async function GET() {
  const snapshot = await getSn74Snapshot();
  if (!snapshot.ok) {
    return NextResponse.json(snapshot, { status: 503 });
  }
  return NextResponse.json(snapshot);
}
