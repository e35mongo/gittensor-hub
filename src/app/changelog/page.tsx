import type { Metadata } from 'next';
import Link from 'next/link';
import { Outfit } from 'next/font/google';
import { formatChangelogDate, getChangelogEntries } from '@/lib/changelog';
import styles from './changelog.module.css';

export const dynamic = 'force-static';

const outfit = Outfit({
  subsets: ['latin'],
  display: 'swap',
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-landing',
});

export const metadata: Metadata = {
  title: 'Changelog · Gittensor Hub',
  description: 'Weekly ship notes for Gittensor Hub — what landed on SN74 ops and contributor rails.',
};

export default function ChangelogPage() {
  const entries = getChangelogEntries();

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
            <Link href="/presence" prefetch={false}>
              Presence
            </Link>
            <Link href="/dashboard" prefetch={false}>
              Dashboard
            </Link>
            <Link href="/" prefetch={false}>
              Home
            </Link>
          </nav>
        </header>

        <main className={styles.main}>
          <p className={styles.kicker}>Ship notes</p>
          <h1 className={styles.title}>Changelog</h1>
          <p className={styles.lede}>
            Weekly public notes on what shipped. Cadence starts during P0a presence proof — one entry
            per week, no filler.
          </p>

          {entries.length === 0 ? (
            <p className={styles.empty}>No ship notes published yet.</p>
          ) : (
            <ol className={styles.list}>
              {entries.map((entry) => (
                <li key={entry.slug} className={styles.entry} id={entry.slug}>
                  <time className={styles.date} dateTime={entry.date}>
                    {formatChangelogDate(entry.date)}
                  </time>
                  <h2 className={styles.entryTitle}>{entry.title}</h2>
                  <div
                    className={`md-content ${styles.body}`}
                    dangerouslySetInnerHTML={{ __html: entry.bodyHtml }}
                  />
                </li>
              ))}
            </ol>
          )}
        </main>
      </div>
    </div>
  );
}
