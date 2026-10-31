/**
 * Supermemory auto-detects URL-shaped content and tries HTTP extraction.
 * Benchmark events must be stored as verbatim text (same bytes A/B/C see).
 */
export function documentContentForIngest(text: string): string {
  const trimmed = text.trim();
  if (/^https?:\/\/\S+$/i.test(trimmed)) {
    return `benchmark-plaintext:\n${text}`;
  }
  const firstLine = text.split(/\r?\n/, 1)[0]?.trim() ?? "";
  if (
    (firstLine.startsWith("http://") || firstLine.startsWith("https://")) &&
    firstLine.length <= 2048 &&
    trimmed.length <= 4096
  ) {
    return `benchmark-plaintext:\n${text}`;
  }
  return text;
}
