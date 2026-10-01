// CSV writing (RFC 4180 quoting) for Admin → Directory → Export CSV (a backup download).

const cell = (v: unknown) => {
  const s = v == null ? "" : String(v);
  // Neutralize spreadsheet formulas (CSV injection) and quote when needed.
  const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
};

export function toCsv(header: string[], rows: unknown[][]) {
  return [header, ...rows].map((r) => r.map(cell).join(",")).join("\r\n") + "\r\n";
}
