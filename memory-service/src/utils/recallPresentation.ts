import { normalizeContentForDedup } from './contentNormalize.js';
import type { RecallPresentationHint } from '../types/index.js';

export type { RecallPresentationHint } from '../types/index.js';

export interface RecallPresentation {
  displayTitle?: string;
  displayText: string;
  previewText: string;
}

interface BuildRecallPresentationInput {
  content: string;
  query?: string;
  source?: string;
  sourceTitle?: string;
  presentationHint?: RecallPresentationHint;
  previewMaxLength?: number;
}

const GENERIC_SOURCE_LABELS = new Set([
  'meeting',
  'manual',
  'web',
  'glip',
  'jira',
  'memory-service',
  'memory service',
  'chunk',
  'message',
]);

function stripMarkup(value: string): string {
  let text = normalizeContentForDedup(value || '');
  text = text.replace(/<a\b[^>]*>(.*?)<\/a>/gis, '$1');
  text = text.replace(/<br\s*\/?>/gi, '\n');
  text = text.replace(/<\/?(?:p|div|li|ul|ol|blockquote|span|strong|em|b|i|code|pre)[^>]*>/gi, ' ');
  text = text.replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g, '$1');
  text = text.replace(/https?:\/\/\S+/g, ' ');
  text = text.replace(/[*_`>#]+/g, ' ');
  text = text.replace(/<[^>]+>/g, ' ');
  text = text.replace(/@person-[a-z0-9._-]+/gi, ' ');
  return text;
}

function normalizeWhitespace(value: string): string {
  return value
    .replace(/\r/g, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

function isNoiseLine(line: string): boolean {
  const compact = line.replace(/\s+/g, ' ').trim();
  if (!compact) return true;
  if (/^(summary|discussion points)$/i.test(compact)) return true;
  if (/^__?回复建议__?/i.test(compact)) return true;
  if (/^🔗\s*点击查看原消息/i.test(compact)) return true;
  if (/^\*?以上是 Personal AI/i.test(compact)) return true;
  if (/^click to view/i.test(compact)) return true;
  if (/^[•*-]\s*$/.test(compact)) return true;
  return false;
}

function cleanDisplayText(content: string): string {
  const text = normalizeWhitespace(stripMarkup(content));
  const lines = text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => !isNoiseLine(line));
  return normalizeWhitespace(lines.join('\n'));
}

function tokenizeQuery(query: string): string[] {
  const matches = query
    .toLowerCase()
    .match(/[\p{Script=Han}]{2,}|[a-z0-9][a-z0-9._-]{1,}/gu);
  if (!matches) return [];
  return Array.from(new Set(matches.filter((token) => token.length >= 2)));
}

function splitSegments(text: string): string[] {
  const segments: string[] = [];
  text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .forEach((line) => {
      const parts = line
        .split(/(?<=[。！？!?；;])\s*|(?<=\.)\s+(?=[A-Z0-9])/g)
        .map((part) => part.trim())
        .filter(Boolean);
      segments.push(...parts);
    });
  return segments;
}

function scoreSegment(segment: string, tokens: string[], index: number): number {
  const normalized = segment.toLowerCase();
  let score = 0;

  if (segment.length >= 8 && segment.length <= 140) {
    score += 2;
  } else if (segment.length <= 220) {
    score += 1;
  }

  if (index === 0) score += 0.5;
  if (/[0-9]/.test(segment)) score += 0.4;
  if (/[：:]/.test(segment)) score += 0.3;
  if (/决定|行动|风险|评审|deadline|owner|follow[- ]?up|screen|speaker|meeting|share|architecture|review/i.test(segment)) {
    score += 0.8;
  }

  for (const token of tokens) {
    if (normalized.includes(token)) {
      score += token.length >= 4 ? 2.2 : 1.4;
    }
  }

  if (/personal ai|回复建议|点击查看原消息/i.test(normalized)) {
    score -= 4;
  }
  if ((segment.match(/@/g) || []).length >= 3) {
    score -= 2;
  }
  if ((segment.match(/https?:\/\//g) || []).length >= 1) {
    score -= 1.5;
  }

  return score;
}

function clipText(value: string, maxLength: number): string {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, maxLength).trimEnd()}...`;
}

function cleanDisplayTitle(value?: string): string | undefined {
  if (!value) return undefined;
  const cleaned = normalizeWhitespace(stripMarkup(value))
    .replace(/\s+(?:—|-)\s+Meeting Memory$/i, '')
    .replace(/\s+(?:—|-)\s+Meeting$/i, '')
    .trim();
  if (!cleaned) return undefined;
  const firstPart = cleaned
    .split(/\s+(?:—|-|｜|\|)\s+/)
    .map((part) => part.trim())
    .find(Boolean);
  const candidate = firstPart || cleaned;
  if (!candidate || candidate.length > 80) return undefined;
  return candidate;
}

function deriveTitle(
  sourceTitle: string | undefined,
  bestSegment: string | undefined,
  source: string | undefined,
): string | undefined {
  const titleFromSource = cleanDisplayTitle(sourceTitle);
  if (titleFromSource) return titleFromSource;

  if (bestSegment) {
    const colonMatch = bestSegment.match(/^([^:：]{2,28})[:：]\s*(.+)$/);
    if (colonMatch) {
      return colonMatch[1].trim();
    }
  }

  const sourceLabel = (source || '').trim().toLowerCase();
  if (!sourceLabel || GENERIC_SOURCE_LABELS.has(sourceLabel)) {
    return undefined;
  }
  return source?.trim();
}

function defaultPreviewLength(hint: RecallPresentationHint): number {
  switch (hint) {
    case 'meeting_pilot':
      return 72;
    case 'compact':
      return 96;
    default:
      return 140;
  }
}

export function buildRecallPresentation(
  input: BuildRecallPresentationInput,
): RecallPresentation {
  const presentationHint = input.presentationHint || 'default';
  const displayText = cleanDisplayText(input.content);
  const queryTokens = tokenizeQuery(input.query || '');
  const segments = splitSegments(displayText);
  const rankedSegments = segments
    .map((segment, index) => ({
      segment,
      score: scoreSegment(segment, queryTokens, index),
    }))
    .sort((left, right) => right.score - left.score);
  const bestSegment = rankedSegments[0]?.segment || displayText;

  const displayTitle = deriveTitle(
    input.sourceTitle,
    bestSegment,
    input.source,
  );

  let previewSeed = bestSegment;
  if (
    displayTitle &&
    previewSeed &&
    previewSeed.toLowerCase() === displayTitle.toLowerCase()
  ) {
    previewSeed =
      rankedSegments.find(
        (entry) =>
          entry.segment &&
          entry.segment.toLowerCase() !== displayTitle.toLowerCase(),
      )?.segment || previewSeed;
  }

  const previewMaxLength =
    input.previewMaxLength || defaultPreviewLength(presentationHint);

  return {
    displayTitle,
    displayText,
    previewText: clipText(previewSeed || displayText, previewMaxLength),
  };
}
