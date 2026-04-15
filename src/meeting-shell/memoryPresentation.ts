import type { RecallItem, RecallOptions } from '../services/MemoryServiceClient';
import type { MeetingPilotMemoryRef } from './protocol';

const GENERIC_SOURCE_LABELS = new Set([
  'meeting',
  'manual',
  'web',
  'glip',
  'jira',
  'memory-service',
  'memory service',
]);

function stripMarkup(value: string): string {
  return String(value || '')
    .replace(/<a\b[^>]*>(.*?)<\/a>/gis, '$1')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/?(?:p|div|li|ul|ol|blockquote|span|strong|em|b|i|code|pre)[^>]*>/gi, ' ')
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g, '$1')
    .replace(/https?:\/\/\S+/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/&#34;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/gi, "'")
    .replace(/&gt;/g, '>')
    .replace(/&lt;/g, '<')
    .replace(/&amp;/g, '&')
    .replace(/&nbsp;/g, ' ')
    .replace(/[*_`>#]+/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/@person-[a-z0-9._-]+/gi, ' ');
}

function sanitizeMemoryText(value: string): string {
  const text = stripMarkup(value)
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => {
      if (!line) return false;
      if (/^__?回复建议__?/i.test(line)) return false;
      if (/^🔗\s*点击查看原消息/i.test(line)) return false;
      if (/^\*?以上是 Personal AI/i.test(line)) return false;
      return true;
    })
    .join('\n');

  return text
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

function truncateWithEllipsis(value: string, maxLength: number): string {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, maxLength).trimEnd()}...`;
}

function cleanTitle(value?: string): string | undefined {
  if (!value) return undefined;
  const cleaned = sanitizeMemoryText(value)
    .replace(/\s+(?:—|-)\s+Meeting Memory$/i, '')
    .replace(/\s+(?:—|-)\s+Meeting$/i, '')
    .trim();
  if (!cleaned) return undefined;
  const firstPart = cleaned
    .split(/\s+(?:—|-|｜|\|)\s+/)
    .map((part) => part.trim())
    .find(Boolean);
  return firstPart || cleaned;
}

function fallbackPreview(fullText: string, maxLength = 72): string {
  const firstLine = fullText
    .split('\n')
    .map((line) => line.trim())
    .find(Boolean);
  return truncateWithEllipsis(firstLine || fullText, maxLength);
}

function resolveTitle(item: RecallItem, snippet: string): string {
  const preferred =
    cleanTitle(item.displayTitle) || cleanTitle(item.sourceTitle) || '';
  if (preferred && preferred !== snippet) {
    return preferred;
  }
  const sourceLabel = (item.source || '').trim();
  if (!sourceLabel || GENERIC_SOURCE_LABELS.has(sourceLabel.toLowerCase())) {
    return '';
  }
  return sourceLabel;
}

export function buildMeetingPilotRecallOptions(): RecallOptions {
  return {
    topK: 3,
    channels: ['fts', 'time'],
    includeMetadata: true,
    sourceTypes: ['meeting', 'manual', 'web', 'glip'],
    presentationHint: 'meeting_pilot',
    previewMaxLength: 72,
  };
}

export function recallItemToMeetingPilotMemoryRef(
  item: RecallItem,
): MeetingPilotMemoryRef {
  const fullSnippet = sanitizeMemoryText(
    item.displayText || item.content || '',
  );
  const snippet = (item.previewText || '').trim() || fallbackPreview(fullSnippet);
  const title = resolveTitle(item, snippet);

  return {
    id: item.id,
    title,
    snippet,
    fullSnippet,
    score: item.score,
    sourceLabel: item.source || 'memory-service',
    sourceUrl: item.sourceUrl,
  };
}
