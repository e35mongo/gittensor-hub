import type { Metadata } from 'next';
import LandingHero from './_components/LandingHero';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Gittensor Hub',
  description:
    'SN74 ops dashboard for Bittensor — miners, repositories, and curated wanted work without AI slop.',
};

export default function HomePage() {
  return <LandingHero />;
}
