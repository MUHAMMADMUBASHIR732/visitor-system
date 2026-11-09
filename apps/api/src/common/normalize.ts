/**
 * One canonical form (+<country><number>) so "0300-123 4567", "03001234567" and
 * "+92 300 1234567" are the same person for visitor records and the blacklist.
 * Local numbers starting with 0 use DEFAULT_COUNTRY_CODE (92 = Pakistan).
 */
export function normalizePhone(input: string): string {
  const cc = process.env.DEFAULT_COUNTRY_CODE ?? '92';
  const raw = input.trim();
  const digits = raw.replace(/\D/g, '');
  if (raw.startsWith('+')) return `+${digits}`;
  if (digits.startsWith('00')) return `+${digits.slice(2)}`;
  if (digits.startsWith('0')) return `+${cc}${digits.slice(1)}`;
  if (digits.startsWith(cc) && digits.length >= cc.length + 9) return `+${digits}`;
  return `+${cc}${digits}`;
}

export function normalizeIdNumber(input: string): string {
  return input.replace(/[\s-]/g, '').toUpperCase();
}

export function escapeLike(input: string): string {
  return input.replace(/[\\%_]/g, (c) => `\\${c}`);
}

export function escapeHtml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
