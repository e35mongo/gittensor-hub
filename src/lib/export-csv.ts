/**
 * Minimal CSV helpers for client-side table exports. Pure string building plus
 * a browser download trigger — no dependencies and no server access, so these
 * are safe to import from client components.
 */

/** A single exportable cell. */
export type CsvCell = string | number | boolean | null | undefined;

function escapeCell(value: CsvCell): string {
  if (value === null || value === undefined) return '';
  const text = String(value);
  // RFC 4180: quote any field containing a comma, quote, or newline, and escape
  // embedded quotes by doubling them.
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** Build an RFC-4180 CSV string from a header row and body rows. */
export function toCsv(headers: string[], rows: CsvCell[][]): string {
  return [headers, ...rows].map((row) => row.map(escapeCell).join(',')).join('\r\n');
}

/** Trigger a client-side download of `csv` as `filename`. No-op on the server. */
export function downloadCsv(filename: string, csv: string): void {
  if (typeof document === 'undefined') return;
  // Prepend a UTF-8 BOM so spreadsheet apps read non-ASCII correctly.
  const bom = String.fromCharCode(0xfeff);
  const blob = new Blob([bom, csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
