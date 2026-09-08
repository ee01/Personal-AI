/**
 * Recall route — active research recall.
 *
 * POST /recall
 *
 * Active recall pipeline. Returns:
 *   - `items`     : evidence list (always)
 *   - `blocks`    : deterministic presentation and optional summary block
 *   - `analysis`  : grounded LLM synthesis when explicitly requested
 *   - receipts    : effective retrieval policy and synthesis outcome
 *
 * Retrieval, presentation, and synthesis are independent. `blockTypes` is
 * retained only for backward compatibility.
 *
 * For passive associative recall used by web/meeting bubbles, see
 * POST /context-recall instead.
 */

import type { FastifyInstance } from 'fastify';

import type { RecallQuery, RecallResult } from '../types/index.js';
import { ActiveRecallService } from '../core/ActiveRecallService.js';

const SAFE_EVIDENCE_CHANNELS: RecallQuery['channels'] = ['fts'];
const DEFAULT_SAFE_TOP_K = 10;
const DEFAULT_SAFE_MAX_TOP_K = 10;

const recallBodySchema = {
  type: 'object' as const,
  required: ['query'],
  properties: {
    query: { type: 'string' as const, minLength: 1 },
    scope: {
      type: 'string' as const,
      enum: ['work', 'personal', 'both', 'all'],
    },
    topK: { type: 'number' as const, minimum: 1, maximum: 100 },
    channels: {
      type: 'array' as const,
      items: {
        type: 'string' as const,
        enum: ['vector', 'fts', 'graph', 'time'],
      },
    },
    timeRange: {
      type: 'object' as const,
      properties: {
        start: { type: 'number' as const },
        end: { type: 'number' as const },
      },
    },
    entityTypes: {
      type: 'array' as const,
      items: {
        type: 'string' as const,
        enum: [
          'Person',
          'Project',
          'Task',
          'Organization',
          'Document',
          'Technology',
          'Topic',
        ],
      },
    },
    projectFilter: { type: 'string' as const },
    minSalience: { type: 'number' as const },
    includeMetadata: { type: 'boolean' as const },
    senderFilter: {
      type: 'array' as const,
      items: { type: 'string' as const },
    },
    groupFilter: {
      type: 'array' as const,
      items: { type: 'string' as const },
    },
    minImportance: { type: 'number' as const },
    sourceTypes: {
      type: 'array' as const,
      items: { type: 'string' as const },
    },
    presentationHint: {
      type: 'string' as const,
      enum: [
        'default',
        'compact',
        'meeting_pilot',
        'research',
        'dashboard',
      ],
    },
    lifecycleMode: {
      type: 'string' as const,
      enum: [
        'active_default',
        'passive_surface',
        'composer_surface',
        'historical',
        'explicit_search',
        'audit',
      ],
    },
    previewMaxLength: { type: 'number' as const, minimum: 16, maximum: 280 },
    analysisMode: {
      type: 'string' as const,
      enum: ['search', 'research', 'aggregate'],
    },
    retrievalMode: {
      type: 'string' as const,
      enum: ['fast', 'balanced', 'deep'],
    },
    presentationBlocks: {
      type: 'array' as const,
      uniqueItems: true,
      items: {
        type: 'string' as const,
        enum: ['timeline', 'evidence_list', 'media'],
      },
    },
    synthesis: {
      type: 'object' as const,
      required: ['mode'],
      properties: {
        mode: { type: 'string' as const, enum: ['none', 'summary'] },
        trigger: { type: 'string' as const, enum: ['user', 'api'] },
        maxTokens: { type: 'number' as const, minimum: 100, maximum: 1200 },
        minEvidenceItems: {
          type: 'number' as const,
          minimum: 1,
          maximum: 10,
        },
      },
      additionalProperties: false,
    },
    blockTypes: {
      type: 'array' as const,
      uniqueItems: true,
      items: {
        type: 'string' as const,
        enum: ['summary', 'timeline', 'evidence_list', 'media'],
      },
    },
  },
  additionalProperties: false,
};

export async function recallRoutes(app: FastifyInstance): Promise<void> {
  app.post<{ Body: RecallQuery }>(
    '/recall',
    {
      schema: {
        body: recallBodySchema,
      },
    },
    async (request, reply) => {
      const { db } = request.userContext;
      const service = new ActiveRecallService(db);
      const normalized = normalizeRecallQueryForRuntime(request.body);

      try {
        const result: RecallResult = await service.recall(normalized.query, {
          runtimePolicy: normalized.runtimePolicy,
        });

        // P0c §11.4: safe-mode shadow — measure what the full-channel
        // policy WOULD return without changing any user-visible result
        // (I11). Shadow runs are fire-and-forget structured logs so the
        // safe path never waits on the slow channels.
        if (normalized.runtimePolicy === 'safe_fts' && isSafeModeShadowEnabled()) {
          void runSafeModeShadow(db, request.body, result)
            .catch((err) =>
              request.log.warn({ err }, 'safe-mode shadow failed'),
            );
        }

        return reply.status(200).send(result);
      } catch (err) {
        request.log.error(err, 'Recall failed');
        return reply.status(500).send({
          items: [],
          totalFound: 0,
          queryTimeMs: 0,
          channels: [],
          error: (err as Error).message,
        });
      }
    },
  );
}

function normalizeRecallQueryForRuntime(body: RecallQuery): {
  query: RecallQuery;
  runtimePolicy: 'default' | 'safe_fts';
} {
  const query: RecallQuery = {
    ...body,
    scope: body.scope ?? 'work',
  };

  if (!isRecallRouteSafeModeEnabled() || areRecallSlowChannelsEnabled()) {
    return { query, runtimePolicy: 'default' };
  }

  return {
    query: {
      ...query,
      channels: SAFE_EVIDENCE_CHANNELS,
      topK: Math.min(
        query.topK ?? getRecallSafeTopK(),
        getRecallSafeMaxTopK(),
      ),
    },
    runtimePolicy: 'safe_fts',
  };
}

function isRecallRouteSafeModeEnabled(): boolean {
  const explicit = parseOptionalBooleanEnv('RECALL_ROUTE_SAFE_MODE_ENABLED');
  if (explicit !== undefined) {
    return explicit;
  }
  return !isTestRuntime();
}

function areRecallSlowChannelsEnabled(): boolean {
  const explicit =
    parseOptionalBooleanEnv('RECALL_SLOW_CHANNELS_ENABLED') ??
    parseOptionalBooleanEnv('ACTIVE_RECALL_SLOW_CHANNELS_ENABLED');
  if (explicit !== undefined) {
    return explicit;
  }
  return isTestRuntime();
}

function getRecallSafeTopK(): number {
  return parsePositiveIntEnv('RECALL_SAFE_TOP_K') ?? DEFAULT_SAFE_TOP_K;
}

function getRecallSafeMaxTopK(): number {
  return parsePositiveIntEnv('RECALL_SAFE_MAX_TOP_K') ?? DEFAULT_SAFE_MAX_TOP_K;
}

/**
 * P0c §11.4 safe-mode shadow: run the full-channel policy after the safe
 * result has been returned and log the diff (candidate counts, channel hits,
 * how many items the full policy would add that safe mode dropped).
 * Shadow only — never merged, never displayed (I11).
 */
function isSafeModeShadowEnabled(): boolean {
  const raw = process.env.RECALL_SAFE_MODE_SHADOW?.trim().toLowerCase();
  if (raw === '0' || raw === 'false' || raw === 'off') return false;
  return true;
}

async function runSafeModeShadow(
  db: import('better-sqlite3').Database,
  originalQuery: RecallQuery,
  safeResult: RecallResult,
): Promise<void> {
  const { RecallEngine } = await import('../core/RecallEngine.js');
  const engine = new RecallEngine(db);
  const started = Date.now();
  const shadow = await engine.recall(
    {
      ...originalQuery,
      channels: undefined, // engine defaults — the full-channel policy
      topK: Math.max(originalQuery.topK ?? 10, safeResult.items.length),
    },
    // I11 shadow invariants: no access reinforcement, no exposure effects.
    { reinforceAccess: false },
  );
  const safeIds = new Set(safeResult.items.map((i) => String(i.id)));
  const additions = shadow.items.filter((i) => !safeIds.has(String(i.id)));
  console.log(
    '[safe-mode-shadow]',
    JSON.stringify({
      query: String(originalQuery.query ?? '').slice(0, 120),
      safeChannels: safeResult.channels,
      safeCount: safeResult.items.length,
      shadowChannels: shadow.channels,
      shadowCount: shadow.items.length,
      shadowOnlyCount: additions.length,
      shadowOnlyTop: additions
        .slice(0, 5)
        .map((i) => ({ type: i.type, score: i.score, source: i.source })),
      shadowQueryTimeMs: Date.now() - started,
    }),
  );
}

function parsePositiveIntEnv(name: string): number | undefined {
  const raw = process.env[name];
  if (!raw) return undefined;
  const value = Number.parseInt(raw, 10);
  if (!Number.isFinite(value) || value < 1) return undefined;
  return value;
}

function parseOptionalBooleanEnv(name: string): boolean | undefined {
  const raw = process.env[name];
  if (raw === undefined) return undefined;
  const normalized = raw.trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(normalized)) return true;
  if (['0', 'false', 'no', 'off'].includes(normalized)) return false;
  return undefined;
}

function isTestRuntime(): boolean {
  return (
    process.env.NODE_ENV === 'test' ||
    process.env.VITEST === 'true' ||
    Boolean(process.env.VITEST_WORKER_ID)
  );
}
