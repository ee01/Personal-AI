function escapeHtml(text) {
  return String(text || '').replace(/[&<>"']/g, (char) => {
    if (char === '&') return '&amp;';
    if (char === '<') return '&lt;';
    if (char === '>') return '&gt;';
    if (char === '"') return '&quot;';
    return '&#39;';
  });
}

export function formatInlineMarkdown(text) {
  let html = escapeHtml(text);
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/__(.+?)__/g, '<strong>$1</strong>');
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
  html = html.replace(/_(.+?)_/g, '<em>$1</em>');
  html = html.replace(/`([^`\n]+?)`/g, '<code>$1</code>');
  html = html.replace(
    /\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g,
    (_, label, url) =>
      `<a href="${escapeHtml(url)}" data-external-link="${escapeHtml(url)}">${escapeHtml(label)}</a>`,
  );
  return html;
}

function isBlankLine(line) {
  return !String(line || '').trim();
}

function isBlockStart(line) {
  const trimmed = String(line || '').trim();
  return (
    /^#{1,3}\s/.test(trimmed) ||
    trimmed.startsWith('>') ||
    /^[-*]\s+/.test(trimmed) ||
    /^\d+\.\s+/.test(trimmed)
  );
}

export function markdownToHtml(text) {
  if (!text || typeof text !== 'string') return '';

  const lines = text.replace(/\r\n/g, '\n').split('\n');
  const blocks = [];
  let index = 0;

  while (index < lines.length) {
    if (isBlankLine(lines[index])) {
      index += 1;
      continue;
    }

    const trimmed = lines[index].trim();

    const headingMatch = trimmed.match(/^(#{1,3})\s+(.+)$/);
    if (headingMatch) {
      const level = headingMatch[1].length;
      const tag = level === 1 ? 'h2' : level === 2 ? 'h3' : 'h4';
      blocks.push(
        `<${tag}>${formatInlineMarkdown(headingMatch[2])}</${tag}>`,
      );
      index += 1;
      continue;
    }

    if (trimmed.startsWith('>')) {
      const quoteLines = [];
      while (index < lines.length && lines[index].trim().startsWith('>')) {
        quoteLines.push(lines[index].trim().replace(/^>\s?/, ''));
        index += 1;
      }
      blocks.push(
        `<blockquote>${quoteLines
          .map((line) => formatInlineMarkdown(line))
          .join('<br>')}</blockquote>`,
      );
      continue;
    }

    if (/^[-*]\s+/.test(trimmed)) {
      const items = [];
      while (index < lines.length && /^[-*]\s+/.test(lines[index].trim())) {
        items.push(
          formatInlineMarkdown(lines[index].trim().replace(/^[-*]\s+/, '')),
        );
        index += 1;
      }
      blocks.push(
        `<ul>${items.map((item) => `<li>${item}</li>`).join('')}</ul>`,
      );
      continue;
    }

    if (/^\d+\.\s+/.test(trimmed)) {
      const items = [];
      while (index < lines.length && /^\d+\.\s+/.test(lines[index].trim())) {
        items.push(
          formatInlineMarkdown(lines[index].trim().replace(/^\d+\.\s+/, '')),
        );
        index += 1;
      }
      blocks.push(
        `<ol>${items.map((item) => `<li>${item}</li>`).join('')}</ol>`,
      );
      continue;
    }

    const paragraphLines = [];
    while (index < lines.length && !isBlankLine(lines[index])) {
      if (isBlockStart(lines[index])) break;
      paragraphLines.push(lines[index]);
      index += 1;
    }
    const paragraph = paragraphLines.join('\n').trim();
    if (paragraph) {
      blocks.push(
        `<p>${formatInlineMarkdown(paragraph).replace(/\n/g, '<br>')}</p>`,
      );
    }
  }

  return blocks.join('');
}
