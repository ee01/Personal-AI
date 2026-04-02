/**
 * Ask route — Natural language Q&A over the memory store.
 *
 * POST /ask - Combines recall + LLM generation to answer questions
 *             using the user's stored memories as context.
 */

import { randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';

import type { RecallItem } from '../types/index.js';
import { RecallEngine } from '../core/RecallEngine.js';
import { QueryIntentParser } from '../core/QueryIntentParser.js';
import type { ParsedQueryIntent } from '../core/QueryIntentParser.js';
import type { ProfileManager } from '../core/ProfileManager.js';
import { OnlineReflection } from '../core/OnlineReflection.js';
import { LLMClient } from '../llm/LLMClient.js';
import { getConfig } from '../config.js';
import type { UserDataManager } from '../storage/UserDataManager.js';
import type Database from 'better-sqlite3';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AskBody {
  query: string;
  context?: string;
  includeEvidence?: boolean;
}

interface StructuredTimelineItem {
  date: string;
  event: string;
}

interface StructuredRelatedEntity {
  name: string;
  type: string;
  relevance: string;
}

interface StructuredAskAnswer {
  timeline?: StructuredTimelineItem[];
  keyFindings?: string[];
  insights?: string[];
  relatedEntities?: StructuredRelatedEntity[];
  confidence?: number;
}

interface AskResponse {
  answer: string;
  evidence?: RecallItem[];
  queryTimeMs: number;
  structuredAnswer?: StructuredAskAnswer;
}

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

const askBodySchema = {
  type: 'object' as const,
  required: ['query'],
  properties: {
    query: { type: 'string' as const, minLength: 1 },
    context: { type: 'string' as const },
    includeEvidence: { type: 'boolean' as const },
  },
  additionalProperties: false,
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const SYSTEM_PROMPT = `You are a personal AI assistant with access to the user's memory.

Answer only from the provided context. If the context is insufficient, say so clearly.

Return a JSON object with this shape:
{
  "answer": "markdown answer",
  "timeline": [{ "date": "YYYY-MM-DD or relative time", "event": "what happened" }],
  "keyFindings": ["important finding"],
  "insights": ["higher-level insight"],
  "relatedEntities": [{ "name": "entity", "type": "Person|Project|Topic|Other", "relevance": "why it matters" }],
  "confidence": 0.0
}

Rules:
- "answer" is required
- Omit optional fields when there is no useful data
- Keep "confidence" between 0 and 1
- Do not invent evidence that is not supported by the provided context`;

const STREAMING_SYSTEM_PROMPT = `You are a personal AI assistant with access to the user's memory.

Answer only from the provided context. If the context is insufficient, say so clearly.

Respond in concise markdown only.
Do not return JSON.
Do not wrap the answer in code fences.`;

/**
 * Load the USER_CORE.md file via the per-user UserDataManager.
 * Returns the file content, or an empty string if the file does not exist.
 */
function loadUserCore(userDataManager?: UserDataManager | null): string {
  if (!userDataManager) return '';
  try {
    return userDataManager.readFile('USER_CORE.md') ?? '';
  } catch {
    return '';
  }
}

/**
 * Load the active IDENTITY and SOUL agent profiles from the database.
 * Returns a formatted persona string, or an empty string if no profiles exist.
 */
function loadAgentPersona(profileManager: ProfileManager): string {
  const identity = profileManager.getActiveProfile('identity');
  const soul = profileManager.getActiveProfile('soul');

  const parts: string[] = [];

  if (identity) {
    parts.push(`--- AI Identity ---\n${identity}`);
  }

  if (soul) {
    parts.push(`--- AI Values & Boundaries ---\n${soul}`);
  }

  return parts.join('\n\n');
}

/**
 * Load active user preferences from the database.
 * Returns a formatted string of preferences, or empty string if none found.
 */
function loadUserPreferences(db: Database.Database): string {
  try {
    const rows = db
      .prepare(
        `SELECT item_key, item_value
         FROM user_profile_items
         WHERE item_type = 'preference' AND status = 'active'
         ORDER BY salience_score DESC
         LIMIT 10`,
      )
      .all() as Array<{ item_key: string; item_value: string }>;

    if (rows.length === 0) return '';

    return rows.map((r) => `- ${r.item_key}: ${r.item_value}`).join('\n');
  } catch {
    return '';
  }
}

/**
 * Format recalled items as bullet-point context for the LLM prompt.
 */
function formatRecalledContext(items: RecallItem[]): string {
  if (items.length === 0) {
    return '(No relevant memories found)';
  }

  return items
    .map((item, index) => {
      const parts: string[] = [];
      parts.push(`[${index + 1}]`);

      if (item.source) {
        parts.push(`(${item.source})`);
      }

      if (item.timestamp) {
        const date = new Date(item.timestamp * 1000).toISOString().slice(0, 10);
        parts.push(`[${date}]`);
      }

      parts.push(item.content.slice(0, 500)); // Truncate very long content

      return `- ${parts.join(' ')}`;
    })
    .join('\n');
}

function formatIntentContext(intent: ParsedQueryIntent): string {
  const parts: string[] = [];

  if (intent.intent !== 'search') {
    parts.push(`- intent: ${intent.intent}`);
  }
  if (intent.filters.senderNames?.length) {
    parts.push(`- sender filter: ${intent.filters.senderNames.join(', ')}`);
  }
  if (intent.filters.groupNames?.length) {
    parts.push(`- group filter: ${intent.filters.groupNames.join(', ')}`);
  }
  if (intent.filters.projectNames?.length) {
    parts.push(`- project filter: ${intent.filters.projectNames.join(', ')}`);
  }
  if (intent.filters.sourceTypes?.length) {
    parts.push(`- source filter: ${intent.filters.sourceTypes.join(', ')}`);
  }
  if (intent.filters.minImportance != null) {
    parts.push(`- minimum importance: ${intent.filters.minImportance}`);
  }
  if (intent.filters.timeRange) {
    parts.push(
      `- time range: ${new Date(intent.filters.timeRange.start * 1000).toISOString()} -> ` +
        `${new Date(intent.filters.timeRange.end * 1000).toISOString()}`,
    );
  }

  return parts.join('\n');
}

function parseStructuredAnswer(raw: string): {
  answer: string;
  structuredAnswer?: StructuredAskAnswer;
} {
  const trimmed = raw.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  const candidate = fenced ? fenced[1].trim() : trimmed;

  try {
    const parsed = JSON.parse(candidate) as Record<string, unknown>;
    const structuredAnswer: StructuredAskAnswer = {};

    if (Array.isArray(parsed.timeline)) {
      const timeline = parsed.timeline
        .filter((item): item is Record<string, unknown> => !!item && typeof item === 'object')
        .map((item) => ({
          date: String(item.date ?? ''),
          event: String(item.event ?? ''),
        }))
        .filter((item) => item.date && item.event);
      if (timeline.length > 0) structuredAnswer.timeline = timeline;
    }

    if (Array.isArray(parsed.keyFindings)) {
      const keyFindings = parsed.keyFindings.map((item) => String(item)).filter(Boolean);
      if (keyFindings.length > 0) structuredAnswer.keyFindings = keyFindings;
    }

    if (Array.isArray(parsed.insights)) {
      const insights = parsed.insights.map((item) => String(item)).filter(Boolean);
      if (insights.length > 0) structuredAnswer.insights = insights;
    }

    if (Array.isArray(parsed.relatedEntities)) {
      const relatedEntities = parsed.relatedEntities
        .filter((item): item is Record<string, unknown> => !!item && typeof item === 'object')
        .map((item) => ({
          name: String(item.name ?? ''),
          type: String(item.type ?? ''),
          relevance: String(item.relevance ?? ''),
        }))
        .filter((item) => item.name && item.type && item.relevance);
      if (relatedEntities.length > 0) structuredAnswer.relatedEntities = relatedEntities;
    }

    if (typeof parsed.confidence === 'number' && parsed.confidence >= 0 && parsed.confidence <= 1) {
      structuredAnswer.confidence = parsed.confidence;
    }

    const answer = typeof parsed.answer === 'string' && parsed.answer.trim()
      ? parsed.answer.trim()
      : raw;

    return {
      answer,
      structuredAnswer: Object.keys(structuredAnswer).length > 0 ? structuredAnswer : undefined,
    };
  } catch {
    return { answer: raw };
  }
}

function buildAugmentedSystemPrompt(
  db: Database.Database,
  profileManager: ProfileManager,
  userDataManager: UserDataManager | null | undefined,
  basePrompt: string,
): string {
  let enhancedPrompt = basePrompt;
  const agentPersona = loadAgentPersona(profileManager);
  if (agentPersona) enhancedPrompt += '\n\n' + agentPersona;
  const userCore = loadUserCore(userDataManager);
  if (userCore) enhancedPrompt += '\n\n--- User Context ---\n' + userCore;
  const preferences = loadUserPreferences(db);
  if (preferences) {
    enhancedPrompt += '\n\n--- User Preferences (apply these silently when relevant) ---\n' + preferences;
  }
  return enhancedPrompt;
}

function buildPromptEnvelope(
  query: string,
  memoryContext: string,
  userContext: string | undefined,
  intentContext: string,
  instruction: string,
): string {
  let fullPrompt = `Context:\n${memoryContext}`;

  if (userContext) {
    fullPrompt += `\n\nAdditional context from user:\n${userContext}`;
  }

  if (intentContext) {
    fullPrompt += `\n\nDetected query constraints:\n${intentContext}`;
  }

  fullPrompt += `\n\nQuestion: ${query}`;
  fullPrompt += `\n\n${instruction}`;
  return fullPrompt;
}

async function recallForAsk(
  db: Database.Database,
  query: string,
  includeEvidence?: boolean,
): Promise<{
  parsedIntent: ParsedQueryIntent;
  recalledItems: RecallItem[];
  memoryContext: string;
  intentContext: string;
}> {
  const parser = new QueryIntentParser(db);
  const parsedIntent = parser.parse(query);
  const recallQueryText = parsedIntent.cleanedQuery || query;
  const recallEngine = new RecallEngine(db);
  const recallResult = await recallEngine.recall({
    query: recallQueryText,
    topK: parsedIntent.intent === 'profile' || Object.keys(parsedIntent.filters).length > 0 ? 15 : 10,
    includeMetadata: Boolean(includeEvidence),
    timeRange: parsedIntent.filters.timeRange,
    projectFilter: parsedIntent.filters.projectNames?.[0],
    senderFilter: parsedIntent.filters.senderNames,
    groupFilter: parsedIntent.filters.groupNames,
    minImportance: parsedIntent.filters.minImportance,
    sourceTypes: parsedIntent.filters.sourceTypes,
  });

  const recalledItems = recallResult.items;
  return {
    parsedIntent,
    recalledItems,
    memoryContext: formatRecalledContext(recalledItems),
    intentContext: formatIntentContext(parsedIntent),
  };
}

function writeSseEvent(
  reply: { raw: NodeJS.WritableStream & { writeHead?: Function; flushHeaders?: Function; end: Function } },
  event: string,
  payload: Record<string, unknown>,
) {
  const enrichedPayload = {
    type: event,
    ...payload,
  };
  reply.raw.write(`event: ${event}\n`);
  reply.raw.write(`data: ${JSON.stringify(enrichedPayload)}\n\n`);
}

// ---------------------------------------------------------------------------
// Route plugin
// ---------------------------------------------------------------------------

export async function askRoutes(
  app: FastifyInstance,
): Promise<void> {
  const config = getConfig();
  const llmClient = new LLMClient(config);

  app.post<{ Body: AskBody }>(
    '/ask',
    {
      schema: {
        body: askBodySchema,
        response: {
          200: {
            type: 'object',
            properties: {
              answer: { type: 'string' },
              evidence: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    id: { type: 'string' },
                    type: { type: 'string' },
                    content: { type: 'string' },
                    score: { type: 'number' },
                    source: { type: 'string' },
                    timestamp: { type: 'number' },
                    metadata: { type: 'object', additionalProperties: true },
                  },
                },
              },
              queryTimeMs: { type: 'number' },
              structuredAnswer: {
                type: 'object',
                nullable: true,
                properties: {
                  timeline: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        date: { type: 'string' },
                        event: { type: 'string' },
                      },
                    },
                  },
                  keyFindings: { type: 'array', items: { type: 'string' } },
                  insights: { type: 'array', items: { type: 'string' } },
                  relatedEntities: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        name: { type: 'string' },
                        type: { type: 'string' },
                        relevance: { type: 'string' },
                      },
                    },
                  },
                  confidence: { type: 'number' },
                },
              },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const { db, profileManager, userDataManager } = request.userContext;
      const startMs = Date.now();
      const { query, context: userContext, includeEvidence } = request.body;

      try {
        const { recalledItems, memoryContext, intentContext } = await recallForAsk(
          db,
          query,
          includeEvidence,
        );
        const fullPrompt = buildPromptEnvelope(
          query,
          memoryContext,
          userContext,
          intentContext,
          'Return JSON only. Required key: "answer". Optional keys: "timeline", "keyFindings", "insights", "relatedEntities", "confidence". Do not wrap the JSON in prose.',
        );
        const systemPrompt = buildAugmentedSystemPrompt(db, profileManager, userDataManager, SYSTEM_PROMPT);

        const llmResponse = await llmClient.generate(fullPrompt, {
          systemPrompt,
          temperature: 0.3,
          maxTokens: 1800,
        });

        // Step 4: Build the response
        const queryTimeMs = Date.now() - startMs;
        const parsedAnswer = parseStructuredAnswer(llmResponse.content);

        const response: AskResponse = {
          answer: parsedAnswer.answer,
          queryTimeMs,
          structuredAnswer: parsedAnswer.structuredAnswer,
        };

        if (includeEvidence) {
          response.evidence = recalledItems;
        }

        const usedItemIds = recalledItems.slice(0, 5).map((item) => item.id);
        const onlineReflection = new OnlineReflection(db, userDataManager);
        void onlineReflection.reflect({
          query,
          recalledItems,
          llmResponse: parsedAnswer.answer,
          usedItemIds,
        });

        return reply.status(200).send(response);
      } catch (err) {
        request.log.error(err, 'Ask endpoint failed');

        const queryTimeMs = Date.now() - startMs;
        return reply.status(500).send({
          answer: 'Sorry, I was unable to process your question. Please try again later.',
          queryTimeMs,
          error: (err as Error).message,
        });
      }
    },
  );

  app.post<{ Body: AskBody }>(
    '/ask/stream',
    {
      schema: {
        body: askBodySchema,
      },
    },
    async (request, reply) => {
      const { db, profileManager, userDataManager } = request.userContext;
      const startMs = Date.now();
      const { query, context: userContext, includeEvidence } = request.body;
      const requestId = randomUUID();

      reply.hijack();
      reply.raw.writeHead?.(200, {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no',
      });
      reply.raw.flushHeaders?.();

      try {
        const { recalledItems, memoryContext, intentContext } = await recallForAsk(
          db,
          query,
          includeEvidence,
        );
        const answerSystemPrompt = buildAugmentedSystemPrompt(
          db,
          profileManager,
          userDataManager,
          STREAMING_SYSTEM_PROMPT,
        );
        const enrichmentSystemPrompt = buildAugmentedSystemPrompt(
          db,
          profileManager,
          userDataManager,
          SYSTEM_PROMPT,
        );
        const answerPrompt = buildPromptEnvelope(
          query,
          memoryContext,
          userContext,
          intentContext,
          'Answer the question in markdown only. Do not return JSON.',
        );

        writeSseEvent(reply, 'start', { requestId });

        let streamedAnswer = '';
        const answerResponse = await llmClient.generateStream(
          answerPrompt,
          {
            systemPrompt: answerSystemPrompt,
            temperature: 0.3,
            maxTokens: 1400,
          },
          async (delta) => {
            if (!delta) return;
            streamedAnswer += delta;
            writeSseEvent(reply, 'delta', { text: delta });
          },
        );

        const finalAnswer = (answerResponse.content || streamedAnswer).trim() || streamedAnswer.trim();
        writeSseEvent(reply, 'answer_done', { answer: finalAnswer });

        let structuredAnswer: StructuredAskAnswer | undefined;
        try {
          const enrichmentPrompt = buildPromptEnvelope(
            query,
            memoryContext,
            userContext,
            intentContext,
            [
              'Return JSON only.',
              'Required key: "answer".',
              'Set "answer" to the best final markdown answer for the question.',
              'Optional keys: "timeline", "keyFindings", "insights", "relatedEntities", "confidence".',
              `Existing answer draft:\n${finalAnswer}`,
            ].join('\n'),
          );
          const enrichmentResponse = await llmClient.generate(enrichmentPrompt, {
            systemPrompt: enrichmentSystemPrompt,
            temperature: 0.2,
            maxTokens: 1200,
          });
          structuredAnswer = parseStructuredAnswer(enrichmentResponse.content).structuredAnswer;
        } catch (error) {
          request.log.warn(error, 'Ask stream enrichment failed');
        }

        const result: AskResponse = {
          answer: finalAnswer,
          queryTimeMs: Date.now() - startMs,
          structuredAnswer,
        };
        if (includeEvidence) {
          result.evidence = recalledItems;
        }

        writeSseEvent(reply, 'result', result as unknown as Record<string, unknown>);
        reply.raw.end();

        const usedItemIds = recalledItems.slice(0, 5).map((item) => item.id);
        const onlineReflection = new OnlineReflection(db, userDataManager);
        void onlineReflection.reflect({
          query,
          recalledItems,
          llmResponse: finalAnswer,
          usedItemIds,
        });
      } catch (err) {
        request.log.error(err, 'Ask stream endpoint failed');
        writeSseEvent(reply, 'error', {
          message: (err as Error).message || 'Unable to process the question.',
        });
        reply.raw.end();
      }
    },
  );
}
