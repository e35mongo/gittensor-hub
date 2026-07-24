'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { listSubnets, type SubnetEntry, type SubnetStatus } from '@/lib/subnets/registry';
import { parseSubnetNetuid, subnetPath } from '@/lib/nav';

type StatusFilter = 'all' | SubnetStatus;

const FILTERS: Array<{ value: StatusFilter; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'live', label: 'Live' },
  { value: 'unknown', label: 'Unknown' },
  { value: 'inactive', label: 'Inactive' },
];

function statusColor(status: SubnetStatus): string {
  if (status === 'live') return 'var(--success-fg)';
  if (status === 'inactive') return 'var(--attention-fg)';
  return 'var(--fg-subtle)';
}

/** Live first (ascending), then the rest ascending — matches explore-style scanning. */
function listForSidebar(): SubnetEntry[] {
  const all = listSubnets();
  const live = all.filter((e) => e.status === 'live');
  const rest = all.filter((e) => e.status !== 'live');
  return [...live, ...rest];
}

export default function SubnetListPanel() {
  const pathname = usePathname();
  const selected = parseSubnetNetuid(pathname);
  const [filter, setFilter] = useState<StatusFilter>('all');
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const base = filter === 'all' ? listForSidebar() : listSubnets().filter((e) => e.status === filter);
    const q = query.trim().toLowerCase();
    if (!q) return base;
    return base.filter((entry) => {
      const name = (entry.name ?? `subnet ${entry.netuid}`).toLowerCase();
      const tag = (entry.tagline ?? '').toLowerCase();
      return (
        name.includes(q) ||
        tag.includes(q) ||
        String(entry.netuid).includes(q) ||
        `sn${entry.netuid}`.includes(q)
      );
    });
  }, [filter, query]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: 0, flex: 1 }}>
      <div style={{ padding: '0 10px 8px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search name or netuid…"
          aria-label="Search subnets"
          style={{
            width: '100%',
            height: 32,
            padding: '0 10px',
            borderRadius: 6,
            border: '1px solid var(--border-default)',
            background: 'var(--bg-canvas)',
            color: 'var(--fg-default)',
            fontSize: 13,
            fontFamily: 'inherit',
          }}
        />
        <div
          role="group"
          aria-label="Status filter"
          style={{
            display: 'flex',
            border: '1px solid var(--border-default)',
            borderRadius: 6,
            overflow: 'hidden',
          }}
        >
          {FILTERS.map((opt, i) => {
            const active = filter === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => setFilter(opt.value)}
                style={{
                  flex: 1,
                  padding: '5px 0',
                  border: 'none',
                  borderRight: i < FILTERS.length - 1 ? '1px solid var(--border-default)' : 'none',
                  background: active ? 'var(--bg-emphasis)' : 'var(--bg-subtle)',
                  color: active ? 'var(--fg-default)' : 'var(--fg-muted)',
                  fontSize: 11,
                  fontWeight: active ? 700 : 500,
                  fontFamily: 'inherit',
                  cursor: 'pointer',
                }}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
        <div style={{ fontSize: 11, color: 'var(--fg-subtle)' }}>
          {filtered.length} subnet{filtered.length === 1 ? '' : 's'}
        </div>
      </div>

      <nav
        aria-label="Subnet registry"
        style={{
          flex: 1,
          minHeight: 0,
          overflowY: 'auto',
          padding: '0 6px 8px',
          display: 'flex',
          flexDirection: 'column',
          gap: 2,
        }}
      >
        {filtered.map((entry) => (
          <SubnetRow key={entry.netuid} entry={entry} active={selected === entry.netuid} />
        ))}
        {filtered.length === 0 && (
          <div style={{ padding: '12px 10px', fontSize: 12, color: 'var(--fg-muted)' }}>No matches</div>
        )}
      </nav>
    </div>
  );
}

function SubnetRow({ entry, active }: { entry: SubnetEntry; active: boolean }) {
  const live = entry.status === 'live';
  const title = entry.name ?? `Subnet ${entry.netuid}`;
  return (
    <Link
      href={subnetPath(entry.netuid)}
      prefetch={false}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 2,
        padding: '8px 10px',
        margin: '0 2px',
        borderRadius: 6,
        textDecoration: 'none',
        background: active
          ? 'var(--menu-item-hover-bg)'
          : live
            ? 'color-mix(in srgb, var(--success-subtle) 70%, transparent)'
            : 'transparent',
        border: active ? '1px solid var(--border-default)' : '1px solid transparent',
        color: 'var(--fg-default)',
      }}
    >
      <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <span style={{ display: 'inline-flex', alignItems: 'baseline', gap: 6, minWidth: 0 }}>
          <span
            style={{
              fontFamily: 'var(--font-mono), ui-monospace, monospace',
              fontSize: 11,
              fontWeight: 700,
              color: 'var(--fg-muted)',
              flexShrink: 0,
            }}
          >
            {String(entry.netuid).padStart(3, '0')}
          </span>
          <span
            style={{
              fontSize: 13,
              fontWeight: live ? 700 : 500,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {title}
          </span>
        </span>
        <span
          style={{
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: '0.04em',
            textTransform: 'uppercase',
            color: statusColor(entry.status),
            flexShrink: 0,
          }}
        >
          {entry.status}
        </span>
      </span>
      {entry.tagline && (
        <span
          style={{
            fontSize: 11,
            color: 'var(--fg-muted)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            paddingLeft: 28,
          }}
        >
          {entry.tagline}
        </span>
      )}
    </Link>
  );
}
