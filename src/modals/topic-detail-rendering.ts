const HTML_ESCAPE_MAP: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

const HIGHLIGHT_STYLE =
  'background: rgba(251, 191, 36, 0.3); color: #fbbf24; padding: 0.125rem 0.25rem; border-radius: 0.25rem; font-weight: 600;';

export const escapeHtml = (value: unknown): string => {
  return String(value ?? '').replace(
    /[&<>"']/g,
    (character) => HTML_ESCAPE_MAP[character],
  );
};

const escapeRegExp = (value: string): string => {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};

export const renderHighlightedText = (
  text: unknown,
  searchQuery: string,
): string => {
  const escapedText = escapeHtml(text);
  const trimmedQuery = searchQuery.trim();
  if (!trimmedQuery) return escapedText;

  const escapedQuery = escapeHtml(trimmedQuery);
  const regex = new RegExp(`(${escapeRegExp(escapedQuery)})`, 'gi');
  return escapedText.replace(
    regex,
    `<mark style="${HIGHLIGHT_STYLE}">$1</mark>`,
  );
};
