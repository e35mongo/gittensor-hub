'use client';

import React, { useEffect, useState } from 'react';
import styles from './landing.module.css';

export type Sn74Snapshot = {
  ok: boolean;
  repos: number | null;
  issues: number | null;
  pulls: number | null;
  last_fetch: string | null;
  error?: string;
};

function formatCount(n: number | null): string {
  if (n == null || !Number.isFinite(n)) return '—';
  return Intl.NumberFormat(undefined, { notation: 'compact', maximumFractionDigits: 1 }).format(n);
}

function formatFreshness(iso: string | null): string {
  if (!iso) return 'waiting for first poll';
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return 'waiting for first poll';
  const mins = Math.max(0, Math.round((Date.now() - t) / 60_000));
  if (mins < 1) return 'updated just now';
  if (mins === 1) return 'updated 1 min ago';
  if (mins < 60) return `updated ${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours === 1) return 'updated 1 hour ago';
  if (hours < 48) return `updated ${hours} hours ago`;
  return `updated ${Math.round(hours / 24)} days ago`;
}

export default function LandingProofStrip() {
  const [data, setData] = useState<Sn74Snapshot | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/public/sn74-snapshot', { credentials: 'same-origin' })
      .then(async (r) => {
        const json = (await r.json()) as Sn74Snapshot;
        if (cancelled) return;
        if (!r.ok || json.ok === false) {
          setFailed(true);
          setData(json);
          return;
        }
        setFailed(false);
        setData(json);
      })
      .catch(() => {
        if (!cancelled) {
          setFailed(true);
          setData(null);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const loading = data === null && !failed;

  return (
    <section className={styles.proof} aria-label="Live SN74 snapshot">
      <div className={styles.proofInner}>
        <p className={styles.proofLabel}>
          {failed ? 'SN74 snapshot unavailable' : 'Live on SN74'}
          {!failed && data ? (
            <span className={styles.proofFresh}>{formatFreshness(data.last_fetch)}</span>
          ) : null}
        </p>

        <dl className={styles.proofMetrics}>
          <div>
            <dt>Repos tracked</dt>
            <dd>{loading ? '…' : formatCount(data?.repos ?? null)}</dd>
          </div>
          <div>
            <dt>Issues indexed</dt>
            <dd>{loading ? '…' : formatCount(data?.issues ?? null)}</dd>
          </div>
          <div>
            <dt>Pulls indexed</dt>
            <dd>{loading ? '…' : formatCount(data?.pulls ?? null)}</dd>
          </div>
        </dl>

        {failed ? (
          <p className={styles.proofNote}>Poller or registry data is not reachable right now.</p>
        ) : null}
      </div>
    </section>
  );
}
