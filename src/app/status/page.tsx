import type { Metadata } from 'next';
import Link from 'next/link';
import { Outfit } from 'next/font/google';
import { getPollerSnapshot, pollerHealth } from '@/lib/poller-snapshot';
import StatusPanel from './StatusPanel';
import styles from './status.module.css';

export const dynamic = 'force-dynamic';

const outfit = Outfit({
  subsets: ['latin'],
  display: 'swap',
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-landing',
});

export const metadata: Metadata = {
  title: 'Status · Gittensor Hub',
  description: 'Public poller / cache freshness for Gittensor Hub — repos, issues, pulls, last fetch.',
};

export default async function StatusPage() {
  const snapshot = await getPollerSnapshot();
  const initial = { ok: true as const, health: pollerHealth(snapshot), ...snapshot };

  return (
    <div className={`${styles.root} ${outfit.variable}`}>
      <div className={styles.visual} aria-hidden>
        <div className={styles.mesh} />
      </div>

      <div className={styles.shell}>
        <header className={styles.header}>
          <Link href="/" className={styles.brand} prefetch={false}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/gt-logo-white.png" alt="" width={36} height={36} className={styles.brandMark} />
            Gittensor Hub
          </Link>
          <nav className={styles.nav}>
            <Link href="/changelog" prefetch={false}>
              Changelog
            </Link>
            <Link href="/presence" prefetch={false}>
              Presence
            </Link>
            <Link href="/dashboard" prefetch={false}>
              Dashboard
            </Link>
          </nav>
        </header>

        <main className={styles.main}>
          <p className={styles.kicker}>Ops</p>
          <h1 className={styles.title}>Status</h1>
          <p className={styles.intro}>
            Live GitHub poller freshness for the SN74 cache. Healthy means a successful issues fetch within the
            last 30 minutes and no open fetch errors.
          </p>
          <StatusPanel initial={initial} />
        </main>
      </div>
    </div>
  );
}
