import type {
  ContextRecallMatch,
  ContextRecallRequest,
  RecallItem,
} from '../services/MemoryServiceClient';
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

export interface BuildMeetingPilotContextRecallArgs {
  /** Current meeting id to exclude from recall (self-echo protection). */
  excludeMeetingId?: string;
  meetingTitle: string;
  currentTopic?: string;
  summary?: string;
  transcriptSummary?: string;
  meetingMetadata?: string;
}

const BOILERPLATE_BLOCKLIST = [
  'no active screen share is detected.',
  'meeting pilot is recording this meeting.',
  '决议 - 暂无',
  '行动项 - 暂无',
  'open the panel to start capture or follow the live map.',
  'a shared application is minimized.',
  'current speaker:',
];

function isBoilerplate(text: string): boolean {
  if (!text) return true;
  const lower = text.toLowerCase().trim();
  if (!lower) return true;
  return BOILERPLATE_BLOCKLIST.some((entry) => lower.includes(entry));
}

function dropBoilerplateLines(text: string): string {
  return text
    .split('\n')
    .filter((line) => !isBoilerplate(line))
    .join('\n')
    .trim();
}

/**
 * Build a ContextRecallRequest body for Meeting Pilot's passive memory hint
 * surface. The body avoids self-echo by trimming meeting boilerplate before
 * sending it to the backend.
 */
export function buildMeetingPilotContextRecallRequest(
  args: BuildMeetingPilotContextRecallArgs,
): ContextRecallRequest {
  const cleanedPrimary = dropBoilerplateLines(
    sanitizeMemoryText(args.transcriptSummary ?? ''),
  );
  const secondary = [
    args.currentTopic,
    args.summary,
    args.meetingMetadata,
  ]
    .map((part) => (part ? dropBoilerplateLines(sanitizeMemoryText(part)) : ''))
    .filter(Boolean) as string[];

  return {
    surface: 'meeting_passive',
    contextType: 'meeting',
    title: args.meetingTitle,
    primaryText: cleanedPrimary || args.meetingTitle,
    secondaryTexts: secondary,
    sourceTypes: ['meeting', 'manual', 'web', 'glip'],
    limit: 3,
  };
}

export function contextMatchToMeetingPilotMemoryRef(
  match: ContextRecallMatch,
): MeetingPilotMemoryRef {
  const fullSnippet = dropBoilerplateLines(sanitizeMemoryText(match.snippet));
  const previewClean = isBoilerplate(match.snippet) ? '' : match.snippet;
  const snippet = previewClean || fallbackPreview(fullSnippet);
  const title =
    cleanTitle(match.title) ||
    cleanTitle(match.sourceTitle) ||
    (match.sourceLabel || 'memory-service');

  return {
    id: match.id,
    title,
    snippet: isBoilerplate(snippet) ? '' : snippet,
    fullSnippet,
    score: match.score,
    sourceLabel: match.sourceLabel || 'memory-service',
    sourceUrl: match.sourceUrl,
    exploreLink: match.exploreLink,
    whyMatched: match.whyMatched,
  };
}

/** Kept for legacy explorer surfaces that still convert RecallItems. */
export function recallItemToMeetingPilotMemoryRef(
  item: RecallItem,
): MeetingPilotMemoryRef {
  const fullSnippet = dropBoilerplateLines(
    sanitizeMemoryText(item.displayText || item.content || ''),
  );
  const rawPreview = (item.previewText || '').trim();
  const previewClean = isBoilerplate(rawPreview) ? '' : rawPreview;
  const snippet = previewClean || fallbackPreview(fullSnippet);
  const title = resolveTitle(item, snippet);

  return {
    id: item.id,
    title,
    snippet: isBoilerplate(snippet) ? '' : snippet,
    fullSnippet,
    score: item.score,
    sourceLabel: item.source || 'memory-service',
    sourceUrl: item.sourceUrl,
    exploreLink: item.exploreLink,
  };
}
