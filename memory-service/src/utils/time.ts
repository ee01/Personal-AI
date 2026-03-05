/**
 * Time utilities.
 *
 * All timestamps are Unix epoch seconds (not milliseconds) to match
 * the SQLite schema and keep numeric values compact.
 */

/**
 * Current Unix timestamp in seconds.
 */
export function now(): number {
  return Math.floor(Date.now() / 1000);
}

/**
 * Format a Unix timestamp (seconds) as 'YYYY-MM-DD'.
 */
export function formatDate(ts: number): string {
  const d = new Date(ts * 1000);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Format a Unix timestamp (seconds) as 'YYYY-MM-DD HH:mm:ss'.
 */
export function formatDateTime(ts: number): string {
  const d = new Date(ts * 1000);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  const seconds = String(d.getSeconds()).padStart(2, '0');
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

/**
 * Return the Unix timestamp (seconds) for N days ago from now.
 */
export function daysAgo(days: number): number {
  return now() - days * 86400;
}

/**
 * Check whether a Unix timestamp (seconds) falls within the last N hours.
 */
export function isWithinHours(ts: number, hours: number): boolean {
  const cutoff = now() - hours * 3600;
  return ts >= cutoff;
}
