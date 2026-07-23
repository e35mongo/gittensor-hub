'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { formatRelativeTime } from '@/lib/format';
import type { PollerHealth, PollerSnapshot } from '@/lib/poller-health';
import { pollerHealth } from '@/lib/poller-health';
import styles from './status.module.css';

type PublicPollerPayload = PollerSnapshot & {
  ok?: boolean;
  health?: PollerHealth;
};

const HEALTH_LABEL: Record<PollerHealth, string> = {
  healthy: 'Healthy',
  degraded: 'Degraded',
  unknown: 'Unknown',
};

type Props = {
  initial: PublicPollerPayload;
};

export default function StatusPanel({ initial }: Props) {
  const [data, setData] = useState<PublicPollerPayload>(initial);
  const [refreshing, setRefreshing] = useState(false);

  const health = data.health ?? pollerHealth(data);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const res = await fetch('/api/public/poller-status', { credentials: 'same-origin' });
      if (!res.ok) return;
      const json = (await res.json()) as PublicPollerPayload;
      setData(json);
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    const id = window.setInterval(() => {
      void refresh();
    }, 30_000);
    return () => window.clearInterval(id);
  }, [refresh]);

  return (
    <div className={styles.panel}>
      <div className={styles.healthRow}>
        <span className={`${styles.badge} ${styles[`badge_${health}`]}`} data-health={health}>
          {HEALTH_LABEL[health]}
        </span>
        <button type="button" className={styles.refresh} onClick={() => void refresh()} disabled={refreshing}>
          {refreshing ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>

      <p className={styles.lede}>
        Last successful issues fetch:{' '}
        <strong>{data.last_fetch ? formatRelativeTime(data.last_fetch) : 'never'}</strong>
        {data.last_fetch ? (
          <span className={styles.muted}> ({new Date(data.last_fetch).toISOString()})</span>
        ) : null}
      </p>

      <dl className={styles.metrics}>
        <div>
          <dt>Repos cached</dt>
          <dd>
            {data.repos_cached}
            <span className={styles.muted}> / {data.repos_total}</span>
          </dd>
        </div>
        <div>
          <dt>Issues indexed</dt>
          <dd>{data.issues_cached.toLocaleString()}</dd>
        </div>
        <div>
          <dt>Pulls indexed</dt>
          <dd>{data.pulls_cached.toLocaleString()}</dd>
        </div>
        <div>
          <dt>Recent fetch errors</dt>
          <dd>{data.recent_errors.length}</dd>
        </div>
      </dl>

      {data.recent_errors.length > 0 ? (
        <div className={styles.errors}>
          <h2 className={styles.errorsTitle}>Recent errors</h2>
          <ul>
            {data.recent_errors.map((row) => (
              <li key={row.full_name}>
                <span className={styles.repo}>{row.full_name}</span>
                <span className={styles.errMsg}>{row.last_fetch_error || 'unknown error'}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className={styles.hint}>No recent fetch errors in the live repo set.</p>
      )}
    </div>
  );
}
