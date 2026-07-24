import React from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Box, Heading, Text } from '@primer/react';
import { getSubnet, isValidNetuid } from '@/lib/subnets/registry';
import { SN74_NETUID } from '@/lib/nav';

export const dynamic = 'force-dynamic';

export default async function SubnetDetailPage({
  params,
}: {
  params: Promise<{ netuid: string }>;
}) {
  const { netuid: raw } = await params;
  const netuid = Number(raw);
  if (!isValidNetuid(netuid)) notFound();
  const subnet = getSubnet(netuid);
  if (!subnet) notFound();

  const isSn74 = netuid === SN74_NETUID;

  return (
    <Box sx={{ maxWidth: 720, mx: 'auto', px: [3, 4], py: [3, 4] }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap', mb: 2 }}>
        <Heading as="h1" sx={{ fontSize: 4, m: 0 }}>
          SN{netuid}
          {subnet.name ? ` · ${subnet.name}` : ''}
        </Heading>
        <StatusBadge status={subnet.status} />
      </Box>

      <Text as="p" sx={{ color: 'fg.muted', mb: 4, fontSize: 2, maxWidth: 560 }}>
        {subnet.tagline ??
          'This netuid is an unknown stub in the hub registry. Name and ops surfaces will appear once curated.'}
      </Text>

      <Box
        sx={{
          border: '1px solid',
          borderColor: 'border.default',
          borderRadius: 2,
          bg: 'canvas.subtle',
          p: 3,
          display: 'flex',
          flexDirection: 'column',
          gap: 3,
        }}
      >
        <DetailRow label="Netuid" value={`SN${netuid}`} />
        <DetailRow label="Status" value={subnet.status} />
        <DetailRow label="Name" value={subnet.name ?? '—'} />
        <DetailRow label="Tagline" value={subnet.tagline ?? '—'} />
      </Box>

      <Box sx={{ mt: 4, display: 'flex', flexWrap: 'wrap', gap: 2 }}>
        {isSn74 ? (
          <Link href="/dashboard" prefetch={false} style={ctaStyle}>
            Open SN74 hub dashboard →
          </Link>
        ) : (
          <Text sx={{ color: 'fg.muted', fontSize: 1 }}>
            Metagraph for this netuid ships in a follow-up (#275). Use the Network sidebar to browse other subnets.
          </Text>
        )}
      </Box>
    </Box>
  );
}

function StatusBadge({ status }: { status: string }) {
  const live = status === 'live';
  return (
    <span
      style={{
        display: 'inline-block',
        padding: '2px 8px',
        borderRadius: 999,
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: '0.04em',
        textTransform: 'uppercase',
        color: live ? 'var(--success-fg)' : 'var(--fg-muted)',
        background: live ? 'var(--success-subtle)' : 'var(--bg-muted)',
        border: `1px solid ${live ? 'var(--success-muted)' : 'var(--border-muted)'}`,
      }}
    >
      {status}
    </span>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <Box sx={{ display: 'flex', gap: 3, alignItems: 'baseline' }}>
      <Text sx={{ width: 88, flexShrink: 0, color: 'fg.muted', fontSize: 1, fontWeight: 600 }}>{label}</Text>
      <Text sx={{ fontSize: 1, color: 'fg.default' }}>{value}</Text>
    </Box>
  );
}

const ctaStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  padding: '8px 14px',
  borderRadius: 6,
  border: '1px solid var(--border-default)',
  background: 'var(--bg-canvas)',
  color: 'var(--accent-fg)',
  fontWeight: 600,
  fontSize: 14,
  textDecoration: 'none',
};
