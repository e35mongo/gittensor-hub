'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  listSubnets,
  type SubnetEntry,
  type SubnetStatus,
} from '@/lib/subnets/registry';
import { listSubnetsForSidebar, parseNetuidFromPath, subnetPath } from '@/lib/subnets/paths';

type StatusFilter = 'all' | 'live' | 'unknown';

const FILTERS: Array<{ value: StatusFilter; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'live', label: 'Live' },
  { value: 'unknown', label: 'Unknown' },
];

export default function NetworkSubnetList() {
  const pathname = usePathname();
  const selected = parseNetuidFromPath(pathname);
  const [filter, setFilter] = useState<StatusFilter>('all');
  const [query, setQuery] = useState('');

  const rows = useMemo(() => {
    const base = filter === 'all' ? listSubnetsForSidebar() : listSubnets().filter((e) => e.status === filter);
    const q = query.trim().toLowerCase();
    if (!q) return base;
    return base.filter((e) => {
      const name = (e.name ?? '').toLowerCase();
      const tag = (e.tagline ?? '').toLowerCase();
      return (
        String(e.netuid).includes(q) ||
        `sn${e.netuid}`.includes(q) ||
        name.includes(q) ||
        tag.includes(q)
      );
    });
  }, [filter, query]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: 0, flex: 1, gap: 8 }}>
      <div style={{ padding: '0 10px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search netuid or name"
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
          aria-label="Subnet status filter"
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
                  borderLeft: i === 0 ? 'none' : '1px solid var(--border-default)',
                  background: active ? 'var(--bg-emphasis)' : 'var(--bg-canvas)',
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
        <div style={{ fontSize: 11, color: 'var(--fg-subtle)', padding: '0 2px' }}>
          {rows.length} subnet{rows.length === 1 ? '' : 's'}
        </div>
      </div>

      <nav
        aria-label="Subnets"
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 1,
          overflowY: 'auto',
          minHeight: 0,
          flex: 1,
          padding: '0 6px 8px',
        }}
      >
        {rows.map((entry) => (
          <SubnetRow key={entry.netuid} entry={entry} active={selected === entry.netuid} />
        ))}
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
        margin: '0 0',
        borderRadius: 6,
        textDecoration: 'none',
        background: active ? 'var(--menu-item-hover-bg)' : 'transparent',
        border: '1px solid',
        borderColor: active ? 'var(--border-default)' : 'transparent',
        color: 'var(--fg-default)',
      }}
    >
      <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <span style={{ fontWeight: live || active ? 700 : 500, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          SN{entry.netuid}
          {entry.name ? ` · ${title}` : ''}
        </span>
        <StatusDot status={entry.status} />
      </span>
      {entry.tagline && (
        <span
          style={{
            fontSize: 11,
            color: 'var(--fg-muted)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {entry.tagline}
        </span>
      )}
    </Link>
  );
}

function StatusDot({ status }: { status: SubnetStatus }) {
  const color =
    status === 'live' ? 'var(--success-fg)' : status === 'inactive' ? 'var(--attention-fg)' : 'var(--fg-subtle)';
  return (
    <span
      title={status}
      style={{
        width: 8,
        height: 8,
        borderRadius: '50%',
        background: color,
        flexShrink: 0,
      }}
    />
  );
}
