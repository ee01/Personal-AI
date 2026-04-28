/**
 * Context Recall — passive associative recall.
 *
 * Used by web/meeting/popup surfaces to surface "you've seen this before" style
 * memory bubbles. Hard requirements:
 *
 *   - Fast (target: < 250ms p50, < 500ms p95, no LLM in the path).
 *   - Few results (default 3, hard cap 5).
 *   - Each result carries `exploreLink` pointing to memory-exploring (Vue UI)
 *     and at most 2 direct "open source" links.
 *   - Defensive against weak input (raw DOM dumps, very short queries).
 *
 * The service composes the existing multi-channel `RecallEngine` but pins the
 * channel set to `vector + fts` (no graph traversal, no time window) to keep
 * latency low and signal high.
 */

import type Database from 'better-sqlite3';

import type {
  ContextRecallMatch,
  ContextRecallRequest,
  ContextRecallResponse,
  ContextRecallScope,
  RecallItem,
  RecallQuery,
} from '../types/index.js';
import { RecallEngine } from './RecallEngine.js';
import { buildExploreLink } from '../utils/exploreLink.js';
import { buildRecallPresentation } from '../utils/recallPresentation.js';

const DEFAULT_LIMIT_BY_SURFACE: Record<string, number> = {
  web_passive: 3,
  meeting_passive: 3,
  popup_passive: 1,
};

const HARD_LIMIT = 5;
const PREVIEW_MAX = 140;
const MIN_QUERY_CHARS = 8;
const MAX_QUERY_CHARS = 600;
// Reject obviously low-signal payloads where text is mostly markup/whitespace.
const MIN_SIGNAL_RATIO = 0.45;

export class ContextRecallService {
  private engine: RecallEngine;

  constructor(private db: Database.Database) {
    this.engine = new RecallEngine(db);
  }

  async recall(request: ContextRecallRequest): Promise<ContextRecallResponse> {
    const startedAt = Date.now();
    const limit = Math.min(
      Math.max(request.limit ?? DEFAULT_LIMIT_BY_SURFACE[request.surface] ?? 3, 1),
      HARD_LIMIT,
    );

    const normalized = normalizeContextQuery(request);
    const debug = request.debug
      ? {
          normalizedQuery: normalized.query,
          channelsHit: [] as string[],
        }
      : undefined;

    if (!normalized.usable) {
      return {
        matches: [],
        topMatch: null,
        queryTimeMs: Date.now() - startedAt,
        debug: debug
          ? { ...debug, rejectedReason: normalized.rejectedReason }
          : undefined,
      };
    }

    // Pin to vector + fts. Graph & time would slow us down without much win
    // for purely associative cases.
    const recallQuery: RecallQuery = {
      query: normalized.query,
      scope: (request.scope ?? 'all') as ContextRecallScope,
      topK: limit * 3, // over-fetch a bit so MMR + filtering have room
      channels: ['vector', 'fts'],
      sourceTypes: request.sourceTypes,
      includeMetadata: true,
      presentationHint: 'compact',
      previewMaxLength: PREVIEW_MAX,
      // No blockTypes → engine returns evidence-only, fast path.
    };

    const result = await this.engine.recall(recallQuery);
    if (debug) debug.channelsHit = result.channels;

    const matches = result.items
      .slice(0, limit * 2)
      .map((item) => toContextMatch(item, request))
      .filter((m): m is ContextRecallMatch => m != null)
      .slice(0, limit);

    return {
      matches,
      topMatch: matches[0] ?? null,
      queryTimeMs: Date.now() - startedAt,
      debug,
    };
  }
}

interface NormalizedContextQuery {
  usable: boolean;
  query: string;
  rejectedReason?: string;
}

function normalizeContextQuery(req: ContextRecallRequest): NormalizedContextQuery {
  const parts: string[] = [];
  if (req.title) parts.push(req.title.trim());
  if (req.primaryText) parts.push(takeMeaningful(req.primaryText, 360));
  if (req.secondaryTexts?.length) {
    for (const txt of req.secondaryTexts) {
      const cleaned = takeMeaningful(txt, 160);
      if (cleaned) parts.push(cleaned);
    }
  }
  if (req.entityHints?.length) {
    parts.push(req.entityHints.map((h) => h.value).join(' '));
  }

  const raw = parts.filter(Boolean).join(' ');
  const compact = raw.replace(/\s+/g, ' ').trim().slice(0, MAX_QUERY_CHARS);

  if (compact.length < MIN_QUERY_CHARS) {
    return { usable: false, query: compact, rejectedReason: 'query_too_short' };
  }

  // Signal ratio = (alphanumeric+CJK) / total length
  const signal = (compact.match(/[\p{Letter}\p{Number}]/gu) || []).length;
  if (signal / compact.length < MIN_SIGNAL_RATIO) {
    return {
      usable: false,
      query: compact,
      rejectedReason: 'low_signal_payload',
    };
  }

  return { usable: true, query: compact };
}

function takeMeaningful(value: string, maxLen: number): string {
  if (!value) return '';
  // Strip basic HTML if a caller forgot to.
  const noHtml = value.replace(/<[^>]+>/g, ' ');
  // Drop URLs (they bias the embedding) and excess whitespace.
  const noUrls = noHtml.replace(/https?:\/\/\S+/g, ' ');
  const compact = noUrls.replace(/\s+/g, ' ').trim();
  if (compact.length <= maxLen) return compact;
  return `${compact.slice(0, maxLen).trimEnd()}…`;
}

function toContextMatch(
  item: RecallItem,
  req: ContextRecallRequest,
): ContextRecallMatch | null {
  const presentation = buildRecallPresentation({
    content: item.displayText || item.content || '',
    query: req.title || req.primaryText || '',
    source: item.source,
    sourceTitle: item.sourceTitle,
    presentationHint: 'compact',
    previewMaxLength: PREVIEW_MAX,
  });

  const exploreLink =
    item.exploreLink ||
    buildExploreLink({
      type: item.type,
      id: item.id,
      conversationId:
        (item.metadata?.conversationId as string | undefined) ||
        (item.metadata?.conversation_id as string | undefined),
      entityType: item.entity?.type,
      entity: item.entity,
    });

  if (!presentation.previewText && !item.displayTitle) {
    return null;
  }

  const links: Array<{ label: string; url: string }> = [];
  if (item.sourceUrl) {
    links.push({ label: '打开来源', url: item.sourceUrl });
  }

  return {
    id: item.id,
    type: item.type,
    score: item.score,
    title: item.displayTitle || presentation.displayTitle,
    snippet: presentation.previewText || (item.displayText ?? '').slice(0, PREVIEW_MAX),
    sourceLabel: item.source,
    sourceUrl: item.sourceUrl,
    sourceTitle: item.sourceTitle,
    exploreLink,
    links,
    whyMatched: explainMatch(item, req),
    timestamp: item.timestamp,
  };
}

function explainMatch(item: RecallItem, req: ContextRecallRequest): string {
  const channels = (item.metadata?.channels as string[] | undefined) || [];
  const channelLabel = channels.length
    ? channels
        .map((c) => (c === 'vector' ? '向量' : c === 'fts' ? '关键词' : c))
        .join('+')
    : '匹配';
  const surfaceLabel =
    req.surface === 'web_passive'
      ? '网页上下文'
      : req.surface === 'meeting_passive'
        ? '会议上下文'
        : '当前上下文';
  return `${channelLabel} 命中 ${surfaceLabel}`;
}
