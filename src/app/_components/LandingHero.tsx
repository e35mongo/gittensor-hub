'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Outfit, IBM_Plex_Mono } from 'next/font/google';
import styles from './landing.module.css';
import type { Sn74Snapshot } from '@/lib/sn74-snapshot';

const outfit = Outfit({
  subsets: ['latin'],
  display: 'swap',
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-landing',
});

const plexMono = IBM_Plex_Mono({
  subsets: ['latin'],
  display: 'swap',
  weight: ['500', '600'],
  variable: '--font-landing-mono',
});

const WANTED_URL =
  'https://github.com/e35mongo/gittensor-hub/labels/gittensor-hub%3Awanted';
const DOCS_URL =
  'https://github.com/e35mongo/gittensor-hub/blob/main/CONTRIBUTING.md';

function formatCount(n: number | null): string {
  if (n == null || !Number.isFinite(n)) return '—';
  return Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(n);
}

function formatFreshness(iso: string | null): string {
  if (!iso) return 'waiting for first poll';
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return 'waiting for first poll';
  const mins = Math.max(0, Math.round((Date.now() - t) / 60_000));
  if (mins < 1) return 'just now';
  if (mins === 1) return '1 min ago';
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours === 1) return '1 hour ago';
  if (hours < 48) return `${hours} hours ago`;
  return `${Math.round(hours / 24)} days ago`;
}

export default function LandingHero({ snapshot }: { snapshot: Sn74Snapshot }) {
  const [data, setData] = useState<Sn74Snapshot>(snapshot);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/public/sn74-snapshot', { credentials: 'same-origin' })
      .then(async (r) => {
        const json = (await r.json()) as Sn74Snapshot;
        if (!cancelled && json) setData(json);
      })
      .catch(() => {
        /* keep server-rendered values */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const failed = data.ok === false;

  return (
    <div className={`${styles.root} ${outfit.variable} ${plexMono.variable}`}>
      <div className={styles.visual} aria-hidden>
        <div className={styles.mesh} />
        <div className={styles.glow} />
        <div className={styles.shade} />
      </div>

      <div className={styles.stage}>
        <div className={styles.hero}>
          <p className={styles.brand}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/gt-logo-white.png"
              alt=""
              width={56}
              height={56}
              className={styles.brandMark}
            />
            <span className={styles.brandText}>Gittensor Hub</span>
          </p>

          <h1 className={styles.headline}>See SN74 clearly. Ship real work.</h1>

          <p className={styles.support}>
            Ops dashboard for Bittensor Subnet 74 — miners, repos, and wanted issues without the AI
            slop.
          </p>

          <div className={styles.ctas}>
            <Link href="/dashboard" className={styles.ctaPrimary} prefetch={false}>
              Dashboard
            </Link>
            <div className={styles.ctaLinks}>
              <Link href="/changelog" prefetch={false}>
                Changelog
              </Link>
              <span aria-hidden className={styles.ctaDot}>
                ·
              </span>
              <Link href="/presence" prefetch={false}>
                Presence
              </Link>
              <span aria-hidden className={styles.ctaDot}>
                ·
              </span>
              <a href={DOCS_URL} target="_blank" rel="noreferrer">
                Docs
              </a>
              <span aria-hidden className={styles.ctaDot}>
                ·
              </span>
              <a href={WANTED_URL} target="_blank" rel="noreferrer">
                Wanted board
              </a>
            </div>
          </div>
        </div>

        <aside className={styles.proof} aria-label="Live SN74 snapshot">
          <p className={styles.proofLabel}>
            {failed ? 'SN74 unavailable' : 'Live on SN74'}
            {!failed ? (
              <span className={styles.proofFresh}>{formatFreshness(data.last_fetch)}</span>
            ) : null}
          </p>

          <div className={styles.proofMetrics}>
            <div className={styles.proofMetric}>
              <span className={styles.proofMetricValue}>{formatCount(data.repos)}</span>
              <span className={styles.proofMetricLabel}>repos tracked</span>
            </div>
            <div className={styles.proofMetric}>
              <span className={styles.proofMetricValue}>{formatCount(data.issues)}</span>
              <span className={styles.proofMetricLabel}>issues indexed</span>
            </div>
            <div className={styles.proofMetric}>
              <span className={styles.proofMetricValue}>{formatCount(data.pulls)}</span>
              <span className={styles.proofMetricLabel}>pulls indexed</span>
            </div>
          </div>

          {failed ? (
            <p className={styles.proofNote}>Poller or registry data is not reachable right now.</p>
          ) : null}
        </aside>
      </div>
    </div>
  );
}
