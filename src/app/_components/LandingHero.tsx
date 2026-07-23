'use client';

import React from 'react';
import Link from 'next/link';
import { DM_Sans } from 'next/font/google';
import styles from './landing.module.css';
import LandingProofStrip from './LandingProofStrip';

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
          <Link href="/dashboard" className={styles.ctaPrimary} prefetch={false}>
            Dashboard
          </Link>
          <a href={DOCS_URL} className={styles.ctaSecondary} target="_blank" rel="noreferrer">
            Explore docs
          </a>
          <a href={WANTED_URL} className={styles.ctaSecondary} target="_blank" rel="noreferrer">
            Wanted board
          </a>
        </div>
      </main>

      <LandingProofStrip />
    </div>
  );
}
