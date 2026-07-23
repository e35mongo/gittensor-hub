import type { Metadata } from 'next';
import LandingHero from './_components/LandingHero';
import { getSn74Snapshot } from '@/lib/sn74-snapshot';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Gittensor Hub',
  description:
    'SN74 ops dashboard for Bittensor — miners, repositories, and curated wanted work without AI slop.',
};

export default async function HomePage() {
  const snapshot = await getSn74Snapshot();
  return <LandingHero snapshot={snapshot} />;
}
