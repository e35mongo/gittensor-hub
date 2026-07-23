'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { DM_Sans } from 'next/font/google';
import styles from './landing.module.css';

const dmSans = DM_Sans({
  subsets: ['latin'],
  display: 'swap',
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-landing',
});

const WANTED_URL =
  'https://github.com/e35mongo/gittensor-hub/labels/gittensor-hub%3Awanted';
const DOCS_URL =
  'https://github.com/e35mongo/gittensor-hub/blob/main/CONTRIBUTING.md';

export default function LandingHero() {
  const [authed, setAuthed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/whoami', { credentials: 'same-origin' })
      .then((r) => {
        if (!cancelled) setAuthed(r.ok);
      })
      .catch(() => {
        if (!cancelled) setAuthed(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const primaryHref = authed ? '/dashboard' : '/sign-in?next=/dashboard';
  const primaryLabel = 'Dashboard';

  return (
    <div className={`${styles.root} ${dmSans.variable}`}>
      <div className={styles.mesh} aria-hidden />

      <main className={styles.hero}>
        <p className={styles.brand}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/gt-logo-white.png" alt="" width={48} height={48} className={styles.brandMark} />
          Gittensor Hub
        </p>

        <h1 className={styles.headline}>See SN74 clearly. Ship real work.</h1>

        <p className={styles.support}>
          The Bittensor Subnet 74 ops dashboard — track miners, repos, and wanted issues without the AI slop.
        </p>

        <div className={styles.ctas}>
          <Link href={primaryHref} className={styles.ctaPrimary} prefetch={false}>
            {primaryLabel}
          </Link>
          <a href={DOCS_URL} className={styles.ctaSecondary} target="_blank" rel="noreferrer">
            Explore docs
          </a>
          <a href={WANTED_URL} className={styles.ctaSecondary} target="_blank" rel="noreferrer">
            Wanted board
          </a>
        </div>
      </main>
    </div>
  );
}
