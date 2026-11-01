/**
 * Supermemory auto-detects URL-shaped content and tries HTTP extraction.
 * Benchmark events must be stored as verbatim text (same bytes A/B/C see).
 */
export function documentContentForIngest(text: string): string {
  const trimmed = text.trim();
  if (trimmed.startsWith("benchmark-plaintext:")) {
    return text;
  }
  // Always wrap so the server treats payload as plaintext, not a fetchable URL.
  return `benchmark-plaintext:\n${text}`;
}
