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
          fallbackToDefault: userId === 'default' && headerMissingOrBlank,
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
}
