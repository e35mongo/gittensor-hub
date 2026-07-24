'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Box, Text } from '@primer/react';
import { KebabHorizontalIcon } from '@primer/octicons-react';
import type { Icon } from '@primer/octicons-react';
import ThemeToggle from '@/components/ThemeToggle';
import PriceTicker from '@/components/PriceTicker';
import { isChromelessPath } from '@/lib/marketing-routes';
import {
  SN74_NAV,
  NETWORK_NAV,
  UTILITY_NAV,
  isNavActive,
  isNetworkScope,
  type NavItem,
} from '@/lib/nav';

const mobilePrimaryHrefs = ['/dashboard', '/explorer', '/miners', '/repositories'];
const mobilePrimaryHrefSet = new Set(mobilePrimaryHrefs);
const mobilePrimaryItems = mobilePrimaryHrefs
  .map((href) => SN74_NAV.find((item) => item.href === href))
  .filter((item): item is NavItem => Boolean(item));
const mobileOverflowItems: NavItem[] = [
  ...NETWORK_NAV,
  ...SN74_NAV.filter((item) => !mobilePrimaryHrefSet.has(item.href)),
  ...UTILITY_NAV,
];

export default function AppHeader() {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);
  const moreButtonRef = useRef<HTMLButtonElement>(null);
  const moreMenuRef = useRef<HTMLDivElement>(null);
  const hideChrome = isChromelessPath(pathname);

  const networkScope = isNetworkScope(pathname);
  const contextualNav = networkScope ? NETWORK_NAV : SN74_NAV;
  const moreActive = mobileOverflowItems.some((item) => isNavActive(pathname, item.href));

  useEffect(() => {
    setMoreOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!moreOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMoreOpen(false);
    };
    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (moreMenuRef.current?.contains(target)) return;
      if (moreButtonRef.current?.contains(target)) return;
      setMoreOpen(false);
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onPointerDown);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onPointerDown);
    };
  }, [moreOpen]);

  if (hideChrome) return null;

  return (
    <div data-app-header="" style={{ position: 'sticky', top: 0, zIndex: 170, userSelect: 'none' }}>
      <Box
        as="header"
        sx={{
          bg: 'var(--header-bg)',
          borderBottom: '1px solid',
          borderColor: 'var(--border-default)',
          minHeight: ['96px', null, '64px', null, '64px'],
          px: [2, 3],
          py: ['10px', null, 0, null, 0],
          display: 'grid',
          gridTemplateColumns: ['minmax(0, 1fr) auto', null, 'auto minmax(0, 1fr) auto', null, 'auto minmax(0, 1fr) auto'],
          gridTemplateAreas: [
            "'brand actions' 'ticker ticker'",
            null,
            "'brand ticker actions'",
            null,
            "'brand nav actions'",
          ],
          alignItems: 'center',
          columnGap: [2, 3],
          rowGap: ['6px', null, 0],
        }}
      >
        <Box sx={{ gridArea: 'brand', minWidth: 0, display: 'flex', alignItems: 'center', gap: 2 }}>
          <a href="https://gittensor-hub.io" style={{ minWidth: 0, textDecoration: 'none' }}>
            <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 2, minWidth: 0, color: 'var(--fg-default)' }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/gt-logo.png" alt="Gittensor Hub" width={28} height={28} style={{ display: 'block', flexShrink: 0 }} />
              <Text sx={{ fontWeight: 600, fontSize: 2, letterSpacing: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                Gittensor Hub
              </Text>
            </Box>
          </a>
        </Box>

        <Box
          as="nav"
          aria-label="Primary navigation"
          sx={{
            gridArea: 'nav',
            minWidth: 0,
            display: ['none', null, null, null, 'flex'],
            alignItems: 'center',
            gap: 2,
            overflowX: 'auto',
            overflowY: 'hidden',
            scrollbarWidth: 'none',
            '&::-webkit-scrollbar': { display: 'none' },
          }}
        >
          <ScopeSwitch networkScope={networkScope} />
          <Box sx={{ width: '1px', height: 20, bg: 'border.muted', flexShrink: 0 }} aria-hidden />
          {contextualNav.map((item) => {
            const active = isNavActive(pathname, item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                prefetch={false}
                aria-current={active ? 'page' : undefined}
                style={{ textDecoration: 'none', flexShrink: 0 }}
              >
                <Box
                  sx={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 2,
                    height: 32,
                    px: 2,
                    borderRadius: 2,
                    color: active ? 'var(--fg-default)' : 'var(--fg-muted)',
                    bg: active ? 'var(--bg-inset)' : 'transparent',
                    border: '1px solid',
                    borderColor: active ? 'var(--border-default)' : 'transparent',
                    fontSize: 1,
                    fontWeight: active ? 600 : 500,
                    whiteSpace: 'nowrap',
                    '&:hover': { color: 'var(--fg-default)', bg: 'var(--bg-inset)' },
                  }}
                >
                  <Icon size={16} />
                  {item.label}
                </Box>
              </Link>
            );
          })}
          {UTILITY_NAV.map((item) => {
            const active = isNavActive(pathname, item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                prefetch={false}
                aria-current={active ? 'page' : undefined}
                style={{ textDecoration: 'none', flexShrink: 0 }}
              >
                <Box
                  sx={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 2,
                    height: 32,
                    px: 2,
                    borderRadius: 2,
                    color: active ? 'var(--fg-default)' : 'var(--fg-muted)',
                    bg: active ? 'var(--bg-inset)' : 'transparent',
                    border: '1px solid',
                    borderColor: active ? 'var(--border-default)' : 'transparent',
                    fontSize: 1,
                    fontWeight: active ? 600 : 500,
                    whiteSpace: 'nowrap',
                    opacity: 0.9,
                    '&:hover': { color: 'var(--fg-default)', bg: 'var(--bg-inset)', opacity: 1 },
                  }}
                >
                  <Icon size={16} />
                  {item.label}
                </Box>
              </Link>
            );
          })}
        </Box>

        <Box
          sx={{
            gridArea: 'ticker',
            minWidth: 0,
            overflow: 'hidden',
            pt: ['2px', null, 0],
            display: ['block', null, 'flex', null, 'none'],
            justifyContent: ['stretch', null, 'flex-end'],
          }}
        >
          <Box sx={{ display: ['block', null, 'none'] }}>
            <PriceTicker variant="mobile-strip" />
          </Box>
          <Box sx={{ display: ['none', null, 'block'] }}>
            <PriceTicker />
          </Box>
        </Box>

        <Box sx={{ gridArea: 'actions', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 2, minWidth: 0 }}>
          <Box sx={{ display: ['none', null, null, null, 'block'] }}>
            <PriceTicker />
          </Box>
          <ThemeToggle />
        </Box>
      </Box>

      <Box
        as="nav"
        aria-label="Mobile primary navigation"
        sx={{
          position: 'fixed',
          left: 'var(--sidebar-width, 0px)',
          right: 0,
          bottom: 0,
          height: 'var(--bottom-nav-height)',
          px: 3,
          pt: '9px',
          pb: 'calc(9px + env(safe-area-inset-bottom))',
          bg: 'var(--bottom-nav-bg)',
          borderTop: '1px solid var(--border-default)',
          borderRadius: 0,
          backdropFilter: 'blur(14px)',
          display: ['grid', null, null, null, 'none'],
          gridTemplateColumns: 'repeat(5, minmax(0, 1fr))',
          alignItems: 'stretch',
          gap: 1,
          zIndex: 180,
          boxShadow: 'var(--bottom-nav-shadow)',
        }}
      >
        {mobilePrimaryItems.map((item) => (
          <MobileNavLink
            key={item.href}
            href={item.href}
            label={item.label}
            icon={item.icon}
            active={isNavActive(pathname, item.href)}
          />
        ))}
        {mobileOverflowItems.length > 0 && (
          <Box sx={{ position: 'relative', minWidth: 0 }}>
            <button
              ref={moreButtonRef}
              type="button"
              aria-haspopup="menu"
              aria-expanded={moreOpen}
              aria-label="More navigation"
              onClick={() => setMoreOpen((open) => !open)}
              style={{
                width: '100%',
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 5,
                border: 'none',
                borderRadius: 10,
                background: 'transparent',
                color: moreActive || moreOpen ? 'var(--fg-default)' : 'var(--fg-muted)',
                font: 'inherit',
                fontSize: 10,
                fontWeight: moreActive || moreOpen ? 700 : 600,
                lineHeight: 1,
                cursor: 'pointer',
              }}
            >
              <span
                style={{
                  width: 32,
                  height: 28,
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: moreActive || moreOpen ? 'var(--accent-fg)' : 'var(--fg-muted)',
                }}
              >
                <KebabHorizontalIcon size={20} />
              </span>
              <span>More</span>
            </button>
            {moreOpen && (
              <div
                ref={moreMenuRef}
                role="menu"
                style={{
                  position: 'fixed',
                  right: 12,
                  bottom: 'calc(var(--bottom-nav-height) + 10px)',
                  minWidth: 220,
                  padding: 6,
                  border: '1px solid var(--border-default)',
                  borderRadius: 8,
                  background: 'var(--bg-subtle)',
                  boxShadow: 'var(--shadow-overlay)',
                  zIndex: 130,
                }}
              >
                <MenuGroupLabel>Network</MenuGroupLabel>
                {NETWORK_NAV.map((item) => (
                  <MobileMenuItem key={item.href} item={item} active={isNavActive(pathname, item.href)} />
                ))}
                <MenuGroupLabel>SN74</MenuGroupLabel>
                {SN74_NAV.filter((item) => !mobilePrimaryHrefSet.has(item.href)).map((item) => (
                  <MobileMenuItem key={item.href} item={item} active={isNavActive(pathname, item.href)} />
                ))}
                <MenuGroupLabel>Utility</MenuGroupLabel>
                {UTILITY_NAV.map((item) => (
                  <MobileMenuItem key={item.href} item={item} active={isNavActive(pathname, item.href)} />
                ))}
              </div>
            )}
          </Box>
        )}
      </Box>
    </div>
  );
}

function ScopeSwitch({ networkScope }: { networkScope: boolean }) {
  return (
    <Box
      role="group"
      aria-label="Navigation scope"
      sx={{
        display: 'inline-flex',
        flexShrink: 0,
        border: '1px solid',
        borderColor: 'border.default',
        borderRadius: 2,
        overflow: 'hidden',
        bg: 'canvas.subtle',
      }}
    >
      <ScopeLink href="/dashboard" active={!networkScope} label="SN74" />
      <ScopeLink href="/subnets" active={networkScope} label="Network" />
    </Box>
  );
}

function ScopeLink({ href, active, label }: { href: string; active: boolean; label: string }) {
  return (
    <Link href={href} prefetch={false} style={{ textDecoration: 'none' }}>
      <Box
        sx={{
          px: 3,
          height: 32,
          display: 'inline-flex',
          alignItems: 'center',
          fontSize: 1,
          fontWeight: active ? 700 : 500,
          color: active ? 'fg.default' : 'fg.muted',
          bg: active ? 'canvas.default' : 'transparent',
          borderRight: label === 'SN74' ? '1px solid' : 'none',
          borderColor: 'border.default',
          '&:hover': { color: 'fg.default' },
        }}
      >
        {label}
      </Box>
    </Link>
  );
}

function MenuGroupLabel({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        padding: '8px 10px 4px',
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: '0.06em',
        textTransform: 'uppercase',
        color: 'var(--fg-subtle)',
      }}
    >
      {children}
    </div>
  );
}

function MobileMenuItem({ item, active }: { item: NavItem; active: boolean }) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      prefetch={false}
      role="menuitem"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '9px 10px',
        borderRadius: 6,
        color: active ? 'var(--fg-default)' : 'var(--fg-muted)',
        background: active ? 'var(--bg-emphasis)' : 'transparent',
        fontSize: 13,
        fontWeight: active ? 700 : 600,
        textDecoration: 'none',
      }}
    >
      <Icon size={16} />
      {item.label}
    </Link>
  );
}

function MobileNavLink({
  href,
  label,
  icon: Icon,
  active,
}: {
  href: string;
  label: string;
  icon: Icon;
  active: boolean;
}) {
  return (
    <Link href={href} prefetch={false} aria-current={active ? 'page' : undefined} style={{ minWidth: 0, textDecoration: 'none' }}>
      <Box
        sx={{
          height: '100%',
          minWidth: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '5px',
          borderRadius: 2,
          color: active ? 'var(--fg-default)' : 'var(--fg-muted)',
          bg: 'transparent',
          fontSize: '10px',
          fontWeight: active ? 700 : 600,
          lineHeight: 1,
          '&:hover': {
            color: active ? 'var(--accent-fg)' : 'var(--fg-default)',
            bg: 'transparent',
          },
        }}
      >
        <span
          style={{
            width: active ? 36 : 32,
            height: active ? 32 : 28,
            transform: active ? 'translateY(-8px)' : 'none',
            borderRadius: 999,
            border: active ? '1px solid var(--border-strong)' : '1px solid transparent',
            background: active ? 'var(--bg-inset)' : 'transparent',
            boxShadow: active ? '0 0 0 2px var(--bg-canvas), 0 8px 18px rgba(0, 0, 0, 0.35)' : 'none',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: active ? 'var(--accent-fg)' : 'var(--fg-muted)',
            transition: 'background 120ms, border-color 120ms, color 120ms, transform 120ms',
          }}
        >
          <Icon size={active ? 18 : 20} />
        </span>
        <span style={{ maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {label === 'Repositories' ? 'Repos' : label}
        </span>
      </Box>
    </Link>
  );
}
