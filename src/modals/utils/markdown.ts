/**
 * Simple markdown-to-HTML for AI answer display.
 * Handles: **bold**, *italic*, [link](url), line breaks.
 * Escapes HTML to prevent XSS.
 */
export function markdownToHtml(text: string): string {
  if (!text || typeof text !== 'string') return '';
  let html = escapeHtml(text);
  // **bold** and __bold__
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/__(.+?)__/g, '<strong>$1</strong>');
  // *italic* and _italic_
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
  html = html.replace(/_(.+?)_/g, '<em>$1</em>');
  // [text](url) - only allow http/https
  html = html.replace(
    /\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g,
    (_, label, url) => `<a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(label)}</a>`
  );
  // Line breaks: \n\n -> paragraph, \n -> <br>
  html = html
    .split(/\n\n+/)
    .filter((p) => p.trim())
    .map((p) => `<p>${p.replace(/\n/g, '<br>')}</p>`)
    .join('');
  return html || '<p></p>';
}

function escapeHtml(s: string): string {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  };
  return s.replace(/[&<>"']/g, (c) => map[c] ?? c);
}
