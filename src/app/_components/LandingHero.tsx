'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Syne, DM_Sans } from 'next/font/google';
import styles from './landing.module.css';

const syne = Syne({
  subsets: ['latin'],
  display: 'swap',
  weight: ['600', '700', '800'],
  variable: '--font-landing-display',
});

const dmSans = DM_Sans({
  subsets: ['latin'],
  display: 'swap',
  weight: ['400', '500', '600'],
  variable: '--font-landing-body',
});

const WANTED_URL =
  'https://github.com/e35mongo/gittensor-hub/labels/gittensor-hub%3Awanted';
const DOCS_URL =
  'https://github.com/e35mongo/gittensor-hub/blob/main/CONTRIBUTING.md';

export default function LandingHero() {
  const [authed, setAuthed] = useState<boolean | null>(null);

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
  const primaryLabel = authed ? 'Open dashboard' : 'Sign in with GitHub';

  return (
    <div className={`${styles.root} ${syne.variable} ${dmSans.variable}`}>
      <div className={styles.grid} aria-hidden />

      <main className={styles.hero}>
        <p className={styles.brand}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/gt-logo-white.png" alt="" width={40} height={40} className={styles.brandMark} />
          Gittensor Hub
        </p>

        <h1 className={styles.headline}>See SN74 clearly. Ship real work.</h1>

        <p className={styles.support}>
          The Bittensor Subnet 74 ops dashboard — track miners, repos, and wanted issues without the AI slop.
        </p>

        <div className={styles.ctas}>
          <Link href={primaryHref} className={styles.ctaPrimary} prefetch={false}>
            {authed === null ? 'Continue' : primaryLabel}
          </Link>
          <a href={DOCS_URL} className={styles.ctaGhost} target="_blank" rel="noreferrer">
            Explore docs
          </a>
          <a href={WANTED_URL} className={styles.ctaGhost} target="_blank" rel="noreferrer">
            Wanted board
          </a>
        </div>
      </main>
    </div>
  );
}
