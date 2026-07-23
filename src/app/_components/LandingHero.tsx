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
  const primaryLabel = authed ? 'Open dashboard' : 'Sign in with GitHub';

  return (
    <div className={`${styles.root} ${syne.variable} ${dmSans.variable}`}>
      {/* Abstract dashboard chrome — shapes only, no readable UI text under the copy. */}
      <div className={styles.stage} aria-hidden>
        <div className={styles.rail} />
        <div className={styles.panels}>
          <div className={styles.panelTop} />
          <div className={styles.panelRow}>
            <span />
            <span />
            <span />
          </div>
          <div className={styles.panelList}>
            <i />
            <i />
            <i />
            <i />
            <i />
            <i />
            <i />
            <i />
          </div>
        </div>
        <div className={styles.scrim} />
      </div>

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
          <div className={styles.ctaLinks}>
            <a href={DOCS_URL} className={styles.ctaLink} target="_blank" rel="noreferrer">
              Explore docs
            </a>
            <span className={styles.ctaSep} aria-hidden>
              ·
            </span>
            <a href={WANTED_URL} className={styles.ctaLink} target="_blank" rel="noreferrer">
              Wanted board
            </a>
          </div>
        </div>
      </main>
    </div>
  );
}
