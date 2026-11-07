/** Escapes a single CSV cell (RFC 4180 style). */
export function csvCell(value) {
  if (value === null || value === undefined) return '';
  const text = String(value);
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function toCsv(headers, rows) {
  const lines = [headers.map((h) => csvCell(h.label)).join(',')];
  for (const row of rows) {
    lines.push(headers.map((h) => csvCell(typeof h.value === 'function' ? h.value(row) : row[h.key])).join(','));
  }
  return `\uFEFF${lines.join('\r\n')}`;
}
