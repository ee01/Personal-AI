/**
 * Statistics route.
 *
 * GET /stats - returns aggregate counts across all major tables
 * in the memory service database.
 */

import type { FastifyInstance } from 'fastify';

import { now, daysAgo } from '../utils/time.js';

// ---------------------------------------------------------------------------
// Helper types for SQL result rows
// ---------------------------------------------------------------------------

interface CountRow {
  count: number;
}

interface TypeCountRow {
  type: string;
  count: number;
}

interface LevelCountRow {
  consolidation_level: string;
  count: number;
}

interface RetrievalTierCountRow {
  retrieval_tier: string;
  count: number;
}

type UserWriteBoundaryMode =
  | 'explicit_read_write'
  | 'default_read_only_fallback';

interface UserWriteBoundary {
  mode: UserWriteBoundaryMode;
  canRead: boolean;
  canWrite: boolean;
  blockedOperations: string[];
  reason: 'explicit_x_user_id' | 'missing_or_blank_x_user_id';
  recoveryAction: 'none' | 'restore_userinfo_username_or_set_user_id';
}

// ---------------------------------------------------------------------------
// Response type
// ---------------------------------------------------------------------------

interface StatsResponse {
  user: {
    id: string;
    isolation: 'per_user_sqlite';
    identitySource: 'header' | 'default_fallback';
    storageKey: string;
    fallbackToDefault: boolean;
    writeBoundary: UserWriteBoundary;
  };
  messages: {
    total: number;
    today: number;
    thisWeek: number;
    last90Days: number;
  };
  entities: {
    total: number;
    byType: Record<string, number>;
  };
  chunks: {
    total: number;
  };
  relationships: {
    total: number;
  };
  watchedProjects: {
    active: number;
  };
  notifications: {
    pending: number;
    sentToday: number;
  };
  confirmRequests: {
    pending: number;
  };
  memory: {
    temporary: number;
    working: number;
    consolidated: number;
    core: number;
    forgotten: number;
    archived: number;
    retrievalTiers?: Record<string, number>;
  };
}

// ---------------------------------------------------------------------------
// Route plugin
// ---------------------------------------------------------------------------

export async function statsRoutes(app: FastifyInstance): Promise<void> {
  app.get(
    '/stats',
    {
      schema: {
        description: 'Aggregate statistics for the memory service',
        response: {
          200: {
            type: 'object',
            properties: {
              user: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  isolation: { type: 'string' },
                  identitySource: { type: 'string' },
                  storageKey: { type: 'string' },
                  fallbackToDefault: { type: 'boolean' },
                  writeBoundary: {
                    type: 'object',
                    properties: {
                      mode: { type: 'string' },
                      canRead: { type: 'boolean' },
                      canWrite: { type: 'boolean' },
                      blockedOperations: {
                        type: 'array',
                        items: { type: 'string' },
                      },
                      reason: { type: 'string' },
                      recoveryAction: { type: 'string' },
                    },
                  },
                },
              },
              messages: {
                type: 'object',
                properties: {
                  total: { type: 'number' },
                  today: { type: 'number' },
                  thisWeek: { type: 'number' },
                  last90Days: { type: 'number' },
                },
              },
              entities: {
                type: 'object',
                properties: {
                  total: { type: 'number' },
                  byType: {
                    type: 'object',
                    additionalProperties: { type: 'number' },
                  },
                },
              },
              chunks: {
                type: 'object',
                properties: {
                  total: { type: 'number' },
                },
              },
              relationships: {
                type: 'object',
                properties: {
                  total: { type: 'number' },
                },
              },
              watchedProjects: {
                type: 'object',
                properties: {
                  active: { type: 'number' },
                },
              },
              notifications: {
                type: 'object',
                properties: {
                  pending: { type: 'number' },
                  sentToday: { type: 'number' },
                },
              },
              confirmRequests: {
                type: 'object',
                properties: {
                  pending: { type: 'number' },
                },
              },
              memory: {
                type: 'object',
                properties: {
                  temporary: { type: 'number' },
                  working: { type: 'number' },
                  consolidated: { type: 'number' },
                  core: { type: 'number' },
                  forgotten: { type: 'number' },
                  archived: { type: 'number' },
                  retrievalTiers: {
                    type: 'object',
                    additionalProperties: { type: 'number' },
                  },
                },
              },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const { db } = request.userContext;
      const userId = request.userId ?? 'default';
      const rawHeaderUserId = request.headers['x-user-id'];
      const headerMissingOrBlank =
        rawHeaderUserId == null ||
        (typeof rawHeaderUserId === 'string' &&
          rawHeaderUserId.trim() === '');
      const fallbackToDefault = userId === 'default' && headerMissingOrBlank;
      const writeBoundary: UserWriteBoundary = fallbackToDefault
        ? {
            mode: 'default_read_only_fallback',
            canRead: true,
            canWrite: false,
            blockedOperations: [
              'write',
              'import',
              'restore',
              'profile_update',
            ],
            reason: 'missing_or_blank_x_user_id',
            recoveryAction: 'restore_userinfo_username_or_set_user_id',
          }
        : {
            mode: 'explicit_read_write',
            canRead: true,
            canWrite: true,
            blockedOperations: [],
            reason: 'explicit_x_user_id',
            recoveryAction: 'none',
          };
      const todayStart = now() - (now() % 86400); // midnight UTC today (epoch seconds)
      const weekStart = daysAgo(7);
      const last90DaysStart = daysAgo(90);

      // ---- Messages ----
      const messagesTotal = (
        db
          .prepare('SELECT COUNT(*) AS count FROM messages_raw')
          .get() as CountRow
      ).count;
      const messagesToday = (
        db
          .prepare(
            'SELECT COUNT(*) AS count FROM messages_raw WHERE timestamp >= ?',
          )
          .get(todayStart) as CountRow
      ).count;
      const messagesThisWeek = (
        db
          .prepare(
            'SELECT COUNT(*) AS count FROM messages_raw WHERE timestamp >= ?',
          )
          .get(weekStart) as CountRow
      ).count;
      const messagesLast90Days = (
        db
          .prepare(
            'SELECT COUNT(*) AS count FROM messages_raw WHERE timestamp >= ?',
          )
          .get(last90DaysStart) as CountRow
      ).count;

      // ---- Entities ----
      const entitiesTotal = (
        db.prepare('SELECT COUNT(*) AS count FROM entities').get() as CountRow
      ).count;

      const entityTypeRows = db
        .prepare('SELECT type, COUNT(*) AS count FROM entities GROUP BY type')
        .all() as TypeCountRow[];

      const byType: Record<string, number> = {};
      for (const row of entityTypeRows) {
        byType[row.type] = row.count;
      }

      // ---- Chunks ----
      const chunksTotal = (
        db.prepare('SELECT COUNT(*) AS count FROM chunks').get() as CountRow
      ).count;

      // ---- Relationships ----
      const relationshipsTotal = (
        db
          .prepare('SELECT COUNT(*) AS count FROM relationships')
          .get() as CountRow
      ).count;

      // ---- Watched Projects ----
      const watchedActive = (
        db
          .prepare(
            'SELECT COUNT(*) AS count FROM watched_projects WHERE is_active = 1',
          )
          .get() as CountRow
      ).count;

      // ---- Notifications ----
      const notificationsPending = (
        db
          .prepare(
            'SELECT COUNT(*) AS count FROM notification_records WHERE sent_at IS NULL',
          )
          .get() as CountRow
      ).count;
      const notificationsSentToday = (
        db
          .prepare(
            'SELECT COUNT(*) AS count FROM notification_records WHERE sent_at >= ?',
          )
          .get(todayStart) as CountRow
      ).count;

      // ---- Confirm Requests ----
      const confirmPending = (
        db
          .prepare(
            "SELECT COUNT(*) AS count FROM confirm_requests WHERE state = 'pending' AND COALESCE(routing, 'decision') = 'decision'",
          )
          .get() as CountRow
      ).count;

      // ---- Memory Metadata by consolidation level ----
      const memoryLevelRows = db
        .prepare(
          'SELECT consolidation_level, COUNT(*) AS count FROM memory_metadata GROUP BY consolidation_level',
        )
        .all() as LevelCountRow[];

      const memoryLevels: Record<string, number> = {};
      for (const row of memoryLevelRows) {
        memoryLevels[row.consolidation_level] = row.count;
      }

      const retrievalTierRows = db
        .prepare(
          'SELECT retrieval_tier, COUNT(*) AS count FROM memory_metadata GROUP BY retrieval_tier',
        )
        .all() as RetrievalTierCountRow[];

      const retrievalTiers: Record<string, number> = {};
      for (const row of retrievalTierRows) {
        retrievalTiers[row.retrieval_tier] = row.count;
      }

      const response: StatsResponse = {
        user: {
          id: userId,
          isolation: 'per_user_sqlite',
          identitySource: headerMissingOrBlank ? 'default_fallback' : 'header',
          storageKey: `data/users/${userId}/memory.db`,
          fallbackToDefault,
          writeBoundary,
        },
        messages: {
          total: messagesTotal,
          today: messagesToday,
          thisWeek: messagesThisWeek,
          last90Days: messagesLast90Days,
        },
        entities: {
          total: entitiesTotal,
          byType,
        },
        chunks: {
          total: chunksTotal,
        },
        relationships: {
          total: relationshipsTotal,
        },
        watchedProjects: {
          active: watchedActive,
        },
        notifications: {
          pending: notificationsPending,
          sentToday: notificationsSentToday,
        },
        confirmRequests: {
          pending: confirmPending,
        },
        memory: {
          temporary: memoryLevels['temporary'] ?? 0,
          working: memoryLevels['working'] ?? 0,
          consolidated: memoryLevels['consolidated'] ?? 0,
          core: memoryLevels['core'] ?? 0,
          forgotten: memoryLevels['forgotten'] ?? 0,
          archived: memoryLevels['archived'] ?? 0,
          retrievalTiers,
        },
      };

      return reply.status(200).send(response);
    },
  );

  // -------------------------------------------------------------------------
  // P0a-6 (memory-foundation plan §11.2 item 6): supply diagnostics.
  // Read-only telemetry that answers the incident question directly —
  // "are new episodes still entering the lexical/vector projections, and
  // which runtime gate is currently limiting supply?"
  // -------------------------------------------------------------------------
  app.get('/diagnostics/supply', async (request, reply) => {
    const db = request.userContext?.db;
    if (!db) {
      return reply.status(503).send({ error: 'user context unavailable' });
    }

    const since24h = now() - 86400;
    const count = (sql: string): number =>
      (db.prepare(sql).get() as CountRow | undefined)?.count ?? 0;

    const messagesTotal = count('SELECT COUNT(*) AS count FROM messages_raw');
    const messagesLast24h = count(
      `SELECT COUNT(*) AS count FROM messages_raw WHERE created_at >= ${since24h}`,
    );
    // Live gap: eligible (non-empty) messages without a legacy lexical chunk.
    const eligibleMissingChunks = count(
      `SELECT COUNT(*) AS count FROM messages_raw m
       WHERE m.content IS NOT NULL AND TRIM(m.content) != ''
         AND NOT EXISTS (
           SELECT 1 FROM chunks c WHERE c.file_path = 'messages/' || m.id
         )`,
    );
    const eligibleMissingLast24h = count(
      `SELECT COUNT(*) AS count FROM messages_raw m
       WHERE m.content IS NOT NULL AND TRIM(m.content) != ''
         AND m.created_at >= ${since24h}
         AND NOT EXISTS (
           SELECT 1 FROM chunks c WHERE c.file_path = 'messages/' || m.id
         )`,
    );
    const messageChunks = count(
      `SELECT COUNT(*) AS count FROM chunks WHERE file_path LIKE 'messages/%'`,
    );
    const messageChunksLast24h = count(
      `SELECT COUNT(*) AS count FROM chunks
       WHERE file_path LIKE 'messages/%' AND created_at >= ${since24h}`,
    );

    let messageChunksMissingVec: number | null = null;
    try {
      messageChunksMissingVec = count(
        `SELECT COUNT(*) AS count FROM chunks c
         WHERE c.file_path LIKE 'messages/%'
           AND NOT EXISTS (
             SELECT 1 FROM chunks_vec v WHERE v.chunk_id = c.chunk_id
           )`,
      );
    } catch {
      // vec0 extension not loaded — report null instead of failing.
    }

    const rehearsalActivationsTotal = (() => {
      try {
        return count('SELECT COUNT(*) AS count FROM rehearsal_activations');
      } catch {
        return null;
      }
    })();
    const rehearsalActivationsLast24h = (() => {
      try {
        return count(
          `SELECT COUNT(*) AS count FROM rehearsal_activations WHERE created_at >= ${since24h}`,
        );
      } catch {
        return null;
      }
    })();

    // Runtime gate readout — the incident root cause was only visible by
    // correlating these three flags with the missing-chunk gap.
    const readBool = (name: string): boolean | null => {
      const raw = process.env[name]?.trim().toLowerCase();
      if (raw === undefined) return null;
      if (['1', 'true', 'yes', 'on'].includes(raw)) return true;
      if (['0', 'false', 'no', 'off'].includes(raw)) return false;
      return null;
    };

    return reply.status(200).send({
      generatedAt: now(),
      flags: {
        memorySupplyDecoupled: readBool('MEMORY_SUPPLY_DECOUPLED') ?? false,
        ingestLlmExtractionEnabled: readBool('INGEST_LLM_EXTRACTION_ENABLED'),
        ingestEmbeddingEnabled: readBool('INGEST_EMBEDDING_ENABLED'),
      },
      supply: {
        messages: {
          total: messagesTotal,
          last24h: messagesLast24h,
        },
        lexical: {
          messageChunks,
          messageChunksLast24h,
          eligibleMissingChunks,
          eligibleMissingLast24h,
        },
        vector: {
          messageChunksMissingVec,
        },
      },
      amplification: {
        rehearsalActivations: {
          total: rehearsalActivationsTotal,
          last24h: rehearsalActivationsLast24h,
        },
      },
    });
  });
}
