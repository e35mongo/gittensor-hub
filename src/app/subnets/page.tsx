'use client';

export const dynamic = 'force-dynamic';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { Box, Heading, Text } from '@primer/react';
import {
  listSubnets,
  type SubnetEntry,
  type SubnetStatus,
} from '@/lib/subnets/registry';

type StatusFilter = 'all' | SubnetStatus;

const FILTERS: Array<{ value: StatusFilter; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'live', label: 'Live' },
  { value: 'inactive', label: 'Inactive' },
  { value: 'unknown', label: 'Unknown' },
];

const PAGE_SIZE = 32;

/** SN74 opens the existing hub; others go to the generic metagraph shell (#275). */
export function subnetDestination(entry: SubnetEntry): { href: string; label: string } {
  if (entry.netuid === 74) {
    return { href: '/dashboard', label: 'Open hub dashboard' };
  }
  return { href: `/subnet/${entry.netuid}/metagraph`, label: 'Metagraph' };
}

function statusTone(status: SubnetStatus): { bg: string; fg: string; border: string } {
  if (status === 'live') {
    return { bg: 'var(--success-subtle)', fg: 'var(--success-fg)', border: 'var(--success-muted)' };
  }
  if (status === 'inactive') {
    return { bg: 'var(--attention-subtle)', fg: 'var(--attention-fg)', border: 'var(--attention-muted)' };
  }
  return { bg: 'var(--bg-muted)', fg: 'var(--fg-muted)', border: 'var(--border-muted)' };
}

export default function SubnetsPage() {
  const all = useMemo(() => listSubnets(), []);
  const [filter, setFilter] = useState<StatusFilter>('all');
  const [page, setPage] = useState(0);

  const filtered = useMemo(() => {
    if (filter === 'all') return all;
    return all.filter((entry) => entry.status === filter);
  }, [all, filter]);

  const liveCount = useMemo(() => all.filter((e) => e.status === 'live').length, [all]);
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const slice = filtered.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);

  return (
    <Box sx={{ maxWidth: 960, mx: 'auto', px: [3, 4], py: [3, 4] }}>
      <Heading as="h1" sx={{ fontSize: 4, mb: 1 }}>
        Subnets
      </Heading>
      <Text as="p" sx={{ color: 'fg.muted', mb: 3, maxWidth: 640 }}>
        Registry of Bittensor netuids 1–128. Curated <strong>live</strong> subnets are named; the rest are honest{' '}
        <strong>unknown</strong> stubs until we verify them. SN74 opens this hub&apos;s dashboard; other netuids link to
        the generic metagraph page (<code>/subnet/[netuid]/metagraph</code>).
      </Text>

      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, alignItems: 'center', mb: 3 }}>
        <Box
          role="group"
          aria-label="Status filter"
          sx={{ display: 'inline-flex', border: '1px solid', borderColor: 'border.default', borderRadius: 2, overflow: 'hidden' }}
        >
          {FILTERS.map((opt) => {
            const active = filter === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => {
                  setFilter(opt.value);
                  setPage(0);
                }}
                style={{
                  padding: '6px 12px',
                  border: 'none',
                  borderRight: '1px solid var(--border-default)',
                  background: active ? 'var(--bg-emphasis)' : 'var(--bg-canvas)',
                  color: active ? 'var(--fg-default)' : 'var(--fg-muted)',
                  fontWeight: active ? 600 : 500,
                  fontSize: 13,
                  fontFamily: 'inherit',
                  cursor: 'pointer',
                }}
              >
                {opt.label}
              </button>
            );
          })}
        </Box>
        <Text sx={{ color: 'fg.muted', fontSize: 1 }}>
          {filtered.length} shown · {liveCount} live curated
        </Text>
      </Box>

      <Box
        as="table"
        sx={{
          width: '100%',
          borderCollapse: 'separate',
          borderSpacing: 0,
          border: '1px solid',
          borderColor: 'border.default',
          borderRadius: 2,
          overflow: 'hidden',
          bg: 'canvas.default',
          fontSize: 1,
        }}
      >
        <thead>
          <tr>
            {['Netuid', 'Name', 'Status', 'Tagline', ''].map((label) => (
              <th
                key={label || 'link'}
                style={{
                  textAlign: 'left',
                  padding: '10px 12px',
                  borderBottom: '1px solid var(--border-default)',
                  background: 'var(--bg-subtle)',
                  color: 'var(--fg-muted)',
                  fontWeight: 600,
                  fontSize: 12,
                }}
              >
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {slice.map((entry) => (
            <SubnetRow key={entry.netuid} entry={entry} />
          ))}
        </tbody>
      </Box>

      {pageCount > 1 && (
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mt: 3, gap: 2 }}>
          <Text sx={{ color: 'fg.muted', fontSize: 1 }}>
            Page {safePage + 1} of {pageCount}
          </Text>
          <Box sx={{ display: 'flex', gap: 2 }}>
            <PagerButton disabled={safePage <= 0} onClick={() => setPage((p) => Math.max(0, p - 1))}>
              Previous
            </PagerButton>
            <PagerButton disabled={safePage >= pageCount - 1} onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}>
              Next
            </PagerButton>
          </Box>
        </Box>
      )}
    </Box>
  );
}

function SubnetRow({ entry }: { entry: SubnetEntry }) {
  const live = entry.status === 'live';
  const dest = subnetDestination(entry);
  const tone = statusTone(entry.status);
  const title = entry.name ?? `Subnet ${entry.netuid}`;

  return (
    <tr
      style={{
        background: live ? 'var(--success-subtle)' : undefined,
      }}
    >
      <td style={cellStyle}>
        <Text sx={{ fontFamily: 'mono', fontWeight: live ? 700 : 500 }}>SN{entry.netuid}</Text>
      </td>
      <td style={cellStyle}>
        <Text sx={{ fontWeight: live ? 700 : 500, color: entry.name ? 'fg.default' : 'fg.muted' }}>
          {title}
        </Text>
      </td>
      <td style={cellStyle}>
        <span
          style={{
            display: 'inline-block',
            padding: '2px 8px',
            borderRadius: 999,
            border: `1px solid ${tone.border}`,
            background: tone.bg,
            color: tone.fg,
            fontSize: 11,
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
          }}
        >
          {entry.status}
        </span>
      </td>
      <td style={{ ...cellStyle, color: 'var(--fg-muted)', maxWidth: 360 }}>
        {entry.tagline ?? '—'}
      </td>
      <td style={{ ...cellStyle, textAlign: 'right', whiteSpace: 'nowrap' }}>
        <Link
          href={dest.href}
          prefetch={false}
          style={{
            color: 'var(--accent-fg)',
            fontWeight: 600,
            textDecoration: 'none',
            fontSize: 13,
          }}
        >
          {dest.label} →
        </Link>
      </td>
    </tr>
  );
}

const cellStyle: React.CSSProperties = {
  padding: '10px 12px',
  borderBottom: '1px solid var(--border-muted)',
  verticalAlign: 'top',
};

function PagerButton({
  children,
  disabled,
  onClick,
}: {
  children: React.ReactNode;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      style={{
        padding: '6px 12px',
        border: '1px solid var(--border-default)',
        borderRadius: 6,
        background: disabled ? 'var(--bg-muted)' : 'var(--bg-canvas)',
        color: disabled ? 'var(--fg-subtle)' : 'var(--fg-default)',
        fontSize: 13,
        fontWeight: 500,
        fontFamily: 'inherit',
        cursor: disabled ? 'not-allowed' : 'pointer',
      }}
    >
      {children}
    </button>
  );
}
