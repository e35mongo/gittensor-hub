import { NextResponse } from 'next/server';
import { getLiveReposAsyncServer } from '@/lib/repos-server';

export async function assertTrackedRepo(owner: string, name: string): Promise<NextResponse | null> {
  const { repos } = await getLiveReposAsyncServer();
  const fullName = `${owner}/${name}`.toLowerCase();
  const allowed = repos.some((r) => r.fullName.toLowerCase() === fullName);
  if (!allowed) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return null;
}
