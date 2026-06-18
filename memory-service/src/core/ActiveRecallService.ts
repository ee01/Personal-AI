/**
 * Active Recall — research-grade recall.
 *
 * Used by `/ask` and "web ask / app ask" surfaces. Key responsibilities:
 *
 *   1. Run multi-channel recall via `RecallEngine` with relaxed budgets
 *      (more candidates, all channels enabled).
 *   2. Build deterministic UI blocks (timeline, evidence list, media)
 *      so the frontend can render structured information immediately.
 *   3. Optionally run an LLM second-stage to synthesize an `analysis` block
 *      with summary, key findings and ranking rationale.
 *
 * The shape of the response is driven entirely by the caller's `blockTypes`:
 *   - omit `blockTypes` → evidence-only (cheap, no LLM)
 *   - pass `blockTypes` → deterministic blocks; if `'summary'` is included
 *     and `skipAnalysis` is not set, the LLM analysis stage runs.
 *
 * Streaming is intentionally not part of this service. Callers that want SSE
 * (`/ask/stream`, web ask UI) build their own SSE envelope around this
 * service's outputs.
 */

import type Database from 'better-sqlite3';

import type {
  RecallAnalysis,
  RecallBlock,
  RecallBlockType,
  RecallEvidenceCard,
  RecallItem,
  RecallMediaItem,
  RecallQuery,
  RecallResult,
  RecallScopeReceipt,
  RecallTimelineEvent,
} from '../types/index.js';
import { RecallEngine } from './RecallEngine.js';
import { LLMClient } from '../llm/LLMClient.js';
import { getConfig } from '../config.js';
import {
  buildRecallScopeReceiptFromCounts,
  countRecallScopes,
} from '../utils/recallScopeReceipt.js';

const ACTIVE_OVER_FETCH_FACTOR = 1.5;

const ANALYSIS_SYSTEM_PROMPT = `You are a research assistant analyzing memory snippets.

Return a single JSON object with this shape:
{
  "summary": "1-3 sentence synthesis of what was found",
  "keyFindings": ["concrete fact backed by an evidence id"],
  "insights": ["higher-level pattern that emerges across multiple items"],
  "rankingRationale": "why the top items are most relevant",
  "openQuestions": ["question this corpus does not answer"],
  "confidence": 0.0
}

Rules:
- Be terse and concrete; no padding.
- Reference evidence by their [n] index when useful.
- Omit optional fields when there is no useful data.
- "confidence" must be between 0 and 1.
- Do not invent evidence.`;

export interface ActiveRecallOptions {
  /** Provide a shared LLMClient (so callers can reuse a configured instance). */
  llmClient?: LLMClient;
  /**
   * Skip LLM analysis even when blockTypes includes 'summary'. Used by callers
   * that already pay the LLM cost downstream (e.g. /ask).
   */
  skipAnalysis?: boolean;
}

export class ActiveRecallService {
  private engine: RecallEngine;
  private llmClient: LLMClient;

  constructor(
    private db: Database.Database,
    options: ActiveRecallOptions = {},
  ) {
    this.engine = new RecallEngine(db);
    this.llmClient = options.llmClient ?? new LLMClient(getConfig());
  }

  async recall(
    query: RecallQuery,
    options: ActiveRecallOptions = {},
  ): Promise<RecallResult> {
    const startedAt = Date.now();
    const wantedBlocks = new Set<RecallBlockType>(query.blockTypes ?? []);
    const wantsBlocks = wantedBlocks.size > 0;

    // Over-fetch a bit so block builders have material to choose from.
    const baseTopK = query.topK ?? 10;
    const baseQuery: RecallQuery = {
      ...query,
      topK: wantsBlocks
        ? Math.ceil(baseTopK * ACTIVE_OVER_FETCH_FACTOR)
        : baseTopK,
      includeMetadata: query.includeMetadata ?? wantsBlocks,
      blockTypes: undefined, // engine never needs blockTypes; only items.
    };

    const baseResult = await this.engine.recall(baseQuery);
    const items = baseResult.items.slice(0, baseTopK);
    const scopeReceipt = adjustScopeReceiptForReturnedItems(
      baseResult.scopeReceipt,
      query,
      items,
    );

    // Evidence-only mode: no blocks requested → cheap, fast, no LLM.
    if (!wantsBlocks) {
      return {
        items,
        totalFound: baseResult.totalFound,
        queryTimeMs: Date.now() - startedAt,
        channels: baseResult.channels,
        channelDiagnostics: baseResult.channelDiagnostics,
        scopeReceipt,
      };
    }

    const blocks: RecallBlock[] = [];

    // Deterministic blocks (no LLM):
    if (wantedBlocks.has('evidence_list') && items.length > 0) {
      blocks.push({
        type: 'evidence_list',
        title: '相关证据',
        payload: { cards: buildEvidenceCards(items) },
      });
    }

    if (wantedBlocks.has('timeline')) {
      const events = buildTimelineEvents(items);
      if (events.length >= 2) {
        blocks.push({
          type: 'timeline',
          title: '事件时间线',
          payload: { events },
        });
      }
    }

    if (wantedBlocks.has('media')) {
      const mediaItems = buildMediaItems(items);
      if (mediaItems.length > 0) {
        blocks.push({
          type: 'media',
          title: '关联资料',
          payload: { items: mediaItems },
        });
      }
    }

    // LLM second-stage: only when 'summary' is explicitly requested AND
    // the caller has not opted out via skipAnalysis (e.g. /ask handles its
    // own LLM downstream).
    let analysis: RecallAnalysis | undefined;
    if (
      !options.skipAnalysis &&
      items.length > 0 &&
      wantedBlocks.has('summary')
    ) {
      analysis = await this.runAnalysis(query.query, items);
      if (analysis) {
        blocks.unshift({
          type: 'summary',
          title: '检索综述',
          payload: {
            text: analysis.summary,
            bullets: analysis.keyFindings,
            confidence: analysis.confidence,
          },
        });
      }
    }

    return {
      items,
      totalFound: baseResult.totalFound,
      queryTimeMs: Date.now() - startedAt,
      channels: baseResult.channels,
      channelDiagnostics: baseResult.channelDiagnostics,
      scopeReceipt,
      blocks,
      analysis,
    };
  }

  private async runAnalysis(
    queryText: string,
    items: RecallItem[],
  ): Promise<RecallAnalysis | undefined> {
    const evidenceContext = items
      .map((item, index) => {
        const date = item.timestamp
          ? new Date(item.timestamp * 1000).toISOString().slice(0, 10)
          : '';
        const head = [
          `[${index + 1}]`,
          item.source ? `(${item.source})` : '',
          date ? `[${date}]` : '',
        ]
          .filter(Boolean)
          .join(' ');
        const body = (item.displayText || item.content || '').slice(0, 480);
        return `${head}\n${body}`;
      })
      .join('\n\n');

    const prompt = `Question: ${queryText}\n\nEvidence:\n${evidenceContext}\n\nReturn JSON only.`;

    try {
      const llmResponse = await this.llmClient.generate(prompt, {
        systemPrompt: ANALYSIS_SYSTEM_PROMPT,
        temperature: 0.2,
        maxTokens: 800,
      });
      return parseAnalysisJson(llmResponse.content);
    } catch (err) {
      console.warn('[ActiveRecallService] analysis failed:', err);
      return undefined;
    }
  }
}

// ---------------------------------------------------------------------------
// Block builders
// ---------------------------------------------------------------------------

function adjustScopeReceiptForReturnedItems(
  receipt: RecallScopeReceipt | undefined,
  query: RecallQuery,
  returnedItems: RecallItem[],
): RecallScopeReceipt | undefined {
  if (!receipt) return undefined;
  return buildRecallScopeReceiptFromCounts({
    scope: query.scope,
    returned: countRecallScopes(returnedItems),
    candidates: receipt.candidates,
  });
}

function buildEvidenceCards(items: RecallItem[]): RecallEvidenceCard[] {
  return items.slice(0, 12).map((item) => ({
    itemId: item.id,
    title:
      item.displayTitle ||
      item.sourceTitle ||
      item.source ||
      `${item.type}-${item.id.slice(0, 8)}`,
    snippet:
      item.previewText ||
      (item.displayText || item.content || '').slice(0, 160),
    source: item.source,
    sourceUrl: item.sourceUrl,
    sourceTitle: item.sourceTitle,
    exploreLink: item.exploreLink,
    score: item.score,
    timestamp: item.timestamp,
    whyMatched:
      Array.isArray(item.metadata?.channels) && item.metadata.channels.length
        ? `命中通道: ${(item.metadata.channels as string[]).join('+')}`
        : undefined,
  }));
}

function buildTimelineEvents(items: RecallItem[]): RecallTimelineEvent[] {
  const dated = items.filter((item) => typeof item.timestamp === 'number');
  if (dated.length < 2) return [];
  const sorted = [...dated].sort(
    (a, b) => (a.timestamp ?? 0) - (b.timestamp ?? 0),
  );
  return sorted.slice(0, 10).map((item) => ({
    id: item.id,
    timestamp: item.timestamp,
    date: new Date((item.timestamp ?? 0) * 1000).toISOString().slice(0, 10),
    title:
      item.displayTitle || item.sourceTitle || item.source || '记忆事件',
    description:
      item.previewText || (item.displayText || item.content || '').slice(0, 140),
    sourceItemId: item.id,
    exploreLink: item.exploreLink,
  }));
}

function buildMediaItems(items: RecallItem[]): RecallMediaItem[] {
  const out: RecallMediaItem[] = [];
  const seen = new Set<string>();
  for (const item of items) {
    if (!item.sourceUrl) continue;
    if (seen.has(item.sourceUrl)) continue;
    seen.add(item.sourceUrl);
    const ext = (item.sourceUrl.split('.').pop() || '').toLowerCase();
    const kind: RecallMediaItem['kind'] =
      ext === 'pdf'
        ? 'pdf'
        : /(png|jpe?g|gif|webp|svg)/.test(ext)
          ? 'image'
          : 'link';
    out.push({
      kind,
      title: item.sourceTitle || item.displayTitle || item.source,
      url: item.sourceUrl,
      itemId: item.id,
      description: item.previewText,
    });
    if (out.length >= 8) break;
  }
  return out;
}

// ---------------------------------------------------------------------------
// Analysis JSON parsing (tolerant of fenced code blocks)
// ---------------------------------------------------------------------------

function parseAnalysisJson(raw: string): RecallAnalysis | undefined {
  if (!raw) return undefined;
  const trimmed = raw.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  const candidate = fenced ? fenced[1].trim() : trimmed;
  try {
    const parsed = JSON.parse(candidate) as Record<string, unknown>;
    const analysis: RecallAnalysis = {
      summary: typeof parsed.summary === 'string' ? parsed.summary.trim() : '',
    };
    if (Array.isArray(parsed.keyFindings)) {
      analysis.keyFindings = parsed.keyFindings
        .map((v) => String(v))
        .filter(Boolean);
    }
    if (Array.isArray(parsed.insights)) {
      analysis.insights = parsed.insights.map((v) => String(v)).filter(Boolean);
    }
    if (typeof parsed.rankingRationale === 'string') {
      analysis.rankingRationale = parsed.rankingRationale.trim();
    }
    if (Array.isArray(parsed.openQuestions)) {
      analysis.openQuestions = parsed.openQuestions
        .map((v) => String(v))
        .filter(Boolean);
    }
    if (
      typeof parsed.confidence === 'number' &&
      parsed.confidence >= 0 &&
      parsed.confidence <= 1
    ) {
      analysis.confidence = parsed.confidence;
    }
    if (!analysis.summary) return undefined;
    return analysis;
  } catch {
    return undefined;
  }
}
