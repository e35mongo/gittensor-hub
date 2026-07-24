'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import ThemeToggle from '@/components/ThemeToggle';
import PriceTicker from '@/components/PriceTicker';
import SubnetListPanel from '@/components/SubnetListPanel';
import { isChromelessPath } from '@/lib/marketing-routes';
import {
  SN74_NAV,
  UTILITY_NAV,
  defaultNetworkPath,
  isNavActive,
  isNetworkScope,
  type NavItem,
} from '@/lib/nav';

function NavLink({ item, active }: { item: NavItem; active: boolean }) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      prefetch={false}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        height: 30,
        padding: '0 10px',
        margin: '0 6px',
        borderRadius: 6,
        textDecoration: 'none',
        background: active ? 'var(--menu-item-hover-bg)' : 'transparent',
        color: active ? 'var(--fg-default)' : 'var(--fg-muted)',
        fontSize: 13,
        fontWeight: 500,
        lineHeight: '20px',
        transition: 'background 80ms, color 80ms',
      }}
      onMouseEnter={(e) => {
        if (active) return;
        (e.currentTarget as HTMLAnchorElement).style.background = 'var(--menu-item-hover-bg)';
        (e.currentTarget as HTMLAnchorElement).style.color = 'var(--fg-default)';
      }}
      onMouseLeave={(e) => {
        if (active) return;
        (e.currentTarget as HTMLAnchorElement).style.background = 'transparent';
        (e.currentTarget as HTMLAnchorElement).style.color = 'var(--fg-muted)';
      }}
    >
      <span
        style={{
          display: 'inline-flex',
          flexShrink: 0,
          color: active ? 'var(--accent-fg)' : 'var(--fg-subtle)',
        }}
      >
        <Icon size={16} />
      </span>
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.label}</span>
    </Link>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        padding: '10px 16px 4px',
        fontSize: 11,
        fontWeight: 600,
        letterSpacing: '0.06em',
        textTransform: 'uppercase',
        color: 'var(--fg-subtle)',
      }}
    >
      {children}
    </div>
  );
}

export default function AppSidebar() {
  const pathname = usePathname();
  if (isChromelessPath(pathname)) return null;

  const networkActive = isNetworkScope(pathname);
  const sn74Active = !networkActive;

  return (
    <aside
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        bottom: 0,
        width: networkActive ? 280 : 240,
        background: 'var(--bg-canvas)',
        borderRight: '1px solid var(--border-muted)',
        zIndex: 60,
        userSelect: 'none',
      }}
      aria-label="Primary navigation"
      data-app-sidebar=""
      data-network-sidebar={networkActive ? '' : undefined}
    >
      {/* Inner flex column — keep `display` off the aside so CSS can hide it in top-nav mode. */}
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
        <a
          href="https://gittensor-hub.io"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '16px 16px 12px',
            textDecoration: 'none',
            color: 'var(--fg-default)',
            flexShrink: 0,
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/gt-logo.png" alt="" width={28} height={28} style={{ display: 'block' }} />
          <span style={{ fontWeight: 600, fontSize: 16, letterSpacing: '-0.015em' }}>Gittensor Hub</span>
        </a>

        <div style={{ padding: '0 10px 10px', display: 'flex', flexDirection: 'column', gap: 6, flexShrink: 0 }}>
          <Link
            href="/dashboard"
            prefetch={false}
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 2,
              padding: '10px 12px',
              borderRadius: 8,
              textDecoration: 'none',
              border: '1px solid',
              borderColor: sn74Active ? 'var(--border-default)' : 'var(--border-muted)',
              background: sn74Active ? 'var(--bg-emphasis)' : 'var(--bg-subtle)',
              color: 'var(--fg-default)',
            }}
          >
            <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
              <span style={{ fontWeight: 700, fontSize: 13 }}>SN74 · Gittensor</span>
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: '0.04em',
                  textTransform: 'uppercase',
                  color: 'var(--success-fg)',
                }}
              >
                Live
              </span>
            </span>
            <span style={{ fontSize: 12, color: 'var(--fg-muted)' }}>Ops hub — issues, PRs, miners</span>
          </Link>
          <Link
            href={defaultNetworkPath()}
            prefetch={false}
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 2,
              padding: '10px 12px',
              borderRadius: 8,
              textDecoration: 'none',
              border: '1px solid',
              borderColor: networkActive ? 'var(--border-default)' : 'var(--border-muted)',
              background: networkActive ? 'var(--bg-emphasis)' : 'transparent',
              color: 'var(--fg-default)',
            }}
          >
            <span style={{ fontWeight: 600, fontSize: 13 }}>Network</span>
            <span style={{ fontSize: 12, color: 'var(--fg-muted)' }}>All subnets · netuid 1–128</span>
          </Link>
        </div>

        {sn74Active && (
          <nav aria-label="SN74" style={{ display: 'flex', flexDirection: 'column', gap: 2, flexShrink: 0 }}>
            <SectionLabel>SN74</SectionLabel>
            {SN74_NAV.map((item) => (
              <NavLink key={item.href} item={item} active={isNavActive(pathname, item.href)} />
            ))}
          </nav>
        )}

        {networkActive && (
          <>
            <SectionLabel>Subnets</SectionLabel>
            <SubnetListPanel />
          </>
        )}

        {!networkActive && <div style={{ flex: 1 }} />}

        <nav
          aria-label="Utility"
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 2,
            flexShrink: 0,
            marginTop: networkActive ? 6 : 0,
          }}
        >
          {UTILITY_NAV.map((item) => (
            <NavLink key={item.href} item={item} active={isNavActive(pathname, item.href)} />
          ))}
        </nav>

        <div
          style={{
            borderTop: '1px solid var(--border-muted)',
            padding: '10px 12px',
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
            marginTop: 6,
            flexShrink: 0,
          }}
        >
          <PriceTicker />
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8, minWidth: 0 }}>
            <ThemeToggle />
          </div>
        </div>
      </div>
    </aside>
  );
}
