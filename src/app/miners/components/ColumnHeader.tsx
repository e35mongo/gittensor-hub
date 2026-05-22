'use client';

import React from 'react';
import { Box, Text } from '@primer/react';
import { TriangleDownIcon, TriangleUpIcon } from '@primer/octicons-react';
import { LABEL } from './tokens';
import type { ColumnAlign, SortDir } from './types';

export interface ColumnHeaderProps {
  children: React.ReactNode;
  align?: ColumnAlign;
  title?: string;
  pl?: number | string;
  px?: number | string;
  // When `onClick` is provided the header renders as a sort button with an
  // active-direction indicator; otherwise it's a passive label.
  onClick?: () => void;
  active?: boolean;
  dir?: SortDir;
  iconSize?: number;
}

const JUSTIFY: Record<ColumnAlign, 'flex-start' | 'center' | 'flex-end'> = {
  left: 'flex-start',
  center: 'center',
  right: 'flex-end',
};

// Generic table column header used by the leaderboard and the per-repo
// breakdown table. Both surfaces previously reimplemented this with subtle
// drift in focus styles, icon sizes, and sx defaults.
export function ColumnHeader({
  children,
  align = 'right',
  title,
  pl,
  px,
  onClick,
  active = false,
  dir,
  iconSize = 10,
}: ColumnHeaderProps) {
  const baseSx = {
    ...LABEL,
    color: active ? 'fg.default' : 'fg.muted',
    textAlign: align,
    whiteSpace: 'nowrap',
    pl,
    px,
  } as const;

  if (!onClick) {
    return <Text title={title} sx={baseSx}>{children}</Text>;
  }

  return (
    <Box
      as="button"
      onClick={onClick}
      title={title}
      sx={{
        ...baseSx,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: JUSTIFY[align],
        gap: '3px',
        bg: 'transparent',
        border: 'none',
        cursor: 'pointer',
        fontFamily: 'inherit',
        p: 0,
        transition: 'color 100ms',
        '&:hover': { color: 'fg.default' },
        '&:focus': { outline: 'none' },
        '&:focus-visible': {
          outline: '1px solid var(--fg-default)',
          outlineOffset: '2px',
          borderRadius: '2px',
        },
      }}
    >
      {children}
      {active && (dir === 'desc' ? <TriangleDownIcon size={iconSize} /> : <TriangleUpIcon size={iconSize} />)}
    </Box>
  );
}
