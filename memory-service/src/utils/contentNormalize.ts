/**
 * Normalize message content for deduplication.
 *
 * Different code paths may send the same logical message with different encodings
 * (e.g. raw ">" vs HTML-encoded "&gt;"). This normalizes before dedup check
 * so that semantically identical messages are correctly detected as duplicates.
 */
export function normalizeContentForDedup(content: string): string {
  if (!content || typeof content !== 'string') return content;
  let s = content;
  // Decode common HTML entities (order: &amp; last to avoid double-decoding)
  s = s.replace(/&quot;/g, '"');
  s = s.replace(/&#34;/g, '"');
  s = s.replace(/&apos;/g, "'");
  s = s.replace(/&#39;/g, "'");
  s = s.replace(/&#x27;/gi, "'");
  s = s.replace(/&gt;/g, '>');
  s = s.replace(/&lt;/g, '<');
  s = s.replace(/&amp;/g, '&');
  s = s.replace(/&nbsp;/g, ' ');
  return s;
}
