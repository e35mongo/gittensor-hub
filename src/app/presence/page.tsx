import type { Metadata } from 'next';
import Link from 'next/link';
import { Outfit } from 'next/font/google';
import {
  channelIsLive,
  formatPresenceDate,
  getPresenceConfig,
} from '@/lib/presence';
import styles from './presence.module.css';

export const dynamic = 'force-static';

const outfit = Outfit({
  subsets: ['latin'],
  display: 'swap',
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-landing',
});

export const metadata: Metadata = {
  title: 'Presence · Gittensor Hub',
  description:
    'Where to reach Gittensor Hub maintainers — chat/social channels and the ≤48h reply SLA.',
};

export default function PresencePage() {
  const presence = getPresenceConfig();
  const liveCount = presence.channels.filter(channelIsLive).length;

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
            <Link href="/status" prefetch={false}>
              Status
            </Link>
            <Link href="/dashboard" prefetch={false}>
              Dashboard
            </Link>
          </nav>
        </header>

        <main className={styles.main}>
          <p className={styles.kicker}>Community</p>
          <h1 className={styles.title}>Presence</h1>
          <p className={styles.lede}>
            Maintainers answer community questions within{' '}
            <strong>{presence.sla_hours} hours</strong>. SLA clock started{' '}
            {formatPresenceDate(presence.sla_started)}. Active hours: {presence.active_hours}.
          </p>

          <section className={styles.section} aria-labelledby="channels-heading">
            <h2 id="channels-heading" className={styles.sectionTitle}>
              Channels
            </h2>
            <p className={styles.meta}>
              {liveCount} of {presence.channels.length} published
            </p>
            <ul className={styles.channelList}>
              {presence.channels.map((channel) => {
                const live = channelIsLive(channel);
                return (
                  <li key={channel.id} className={styles.channel}>
                    <div className={styles.channelHead}>
                      <span className={styles.channelLabel}>{channel.label}</span>
                      <span className={live ? styles.badgeLive : styles.badgePending}>
                        {live ? 'live' : 'pending'}
                      </span>
                    </div>
                    <p className={styles.channelRole}>{channel.role}</p>
                    {live ? (
                      <a href={channel.url!} className={styles.channelLink} target="_blank" rel="noreferrer">
                        {channel.handle}
                      </a>
                    ) : (
                      <p className={styles.channelPending}>Handle not published yet.</p>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>

          <section className={styles.section} aria-labelledby="evidence-heading">
            <h2 id="evidence-heading" className={styles.sectionTitle}>
              Evidence log
            </h2>
            <p className={styles.meta}>Public crumbs for the presence streak — posts, replies, ops notes.</p>
            <ol className={styles.evidenceList}>
              {presence.evidence.map((item, idx) => (
                <li key={`${item.date}-${idx}`} className={styles.evidence}>
                  <time className={styles.date} dateTime={item.date}>
                    {formatPresenceDate(item.date)}
                  </time>
                  <span className={styles.kind}>{item.kind}</span>
                  <p className={styles.summary}>
                    {item.url ? (
                      <a href={item.url} target="_blank" rel="noreferrer">
                        {item.summary}
                      </a>
                    ) : (
                      item.summary
                    )}
                  </p>
                </li>
              ))}
            </ol>
          </section>

          <p className={styles.foot}>
            Maintainer guide:{' '}
            <a
              href="https://github.com/e35mongo/gittensor-hub/blob/main/docs/presence.md"
              target="_blank"
              rel="noreferrer"
            >
              docs/presence.md
            </a>
            .
          </p>
        </main>
      </div>
    </div>
  );
}
