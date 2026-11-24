/**
 * Currency display for every screen and printable document. Values are stored
 * as two-decimal PostgreSQL numerics; this helper only formats them.
 */
export function money(value: number | null | undefined): string {
  return (value ?? 0).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}
