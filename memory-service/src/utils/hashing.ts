import { createHash } from 'node:crypto';

/**
 * Compute a SHA-256 hex digest for the given text.
 *
 * @param text  Input string to hash.
 * @returns     Lowercase hex-encoded SHA-256 digest.
 */
export function contentHash(text: string): string {
  return createHash('sha256').update(text, 'utf8').digest('hex');
}
