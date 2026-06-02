'use client';

import React from 'react';
import { Box } from '@primer/react';
import { downloadCsv } from '@/lib/export-csv';

/**
 * Small toolbar button that downloads a pre-built CSV string as a file. The
 * caller supplies the filename and the CSV (built with `toCsv`) so this stays
 * presentation-only and reusable across every table view.
 */
export default function ExportButton({
  filename,
  csv,
  disabled = false,
  label = 'Export CSV',
}: {
  filename: string;
  csv: string;
  disabled?: boolean;
  label?: string;
}) {
  return (
    <Box
      as="button"
      type="button"
      onClick={() => downloadCsv(filename, csv)}
      disabled={disabled}
      title={disabled ? 'Nothing to export' : `Download ${filename}`}
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 1,
        height: 28,
        px: 2,
        fontSize: 1,
        fontWeight: 500,
        color: disabled ? 'fg.muted' : 'fg.default',
        bg: 'canvas.subtle',
        border: '1px solid',
        borderColor: 'border.default',
        borderRadius: 2,
        cursor: disabled ? 'default' : 'pointer',
        opacity: disabled ? 0.6 : 1,
        '&:hover': disabled ? {} : { bg: 'canvas.inset', borderColor: 'border.muted' },
      }}
    >
      {label}
    </Box>
  );
}
