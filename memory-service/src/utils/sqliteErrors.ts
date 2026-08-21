/**
 * Detect SQLite failures that poison a long-lived better-sqlite3 connection.
 * After SQLITE_CORRUPT the same connection keeps failing until it is closed.
 */
export function isSqliteCorruptError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const code = String((error as { code?: unknown }).code || '');
  const message = String((error as { message?: unknown }).message || '');
  return (
    code === 'SQLITE_CORRUPT' ||
    code === 'SQLITE_CORRUPT_VTAB' ||
    code === 'SQLITE_NOTADB' ||
    /database disk image is malformed/i.test(message)
  );
}
