/**
 * Main Fastify server entry point for the Personal AI Memory Service.
 *
 * - Loads environment variables via dotenv
 * - Creates and configures the Fastify instance
 * - Registers CORS, Swagger, and application routes
 * - Creates a UserContextManager for per-user database/storage isolation
 * - Handles graceful shutdown on SIGINT / SIGTERM
 */

import dotenv from 'dotenv';
dotenv.config();

import Fastify, { type FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import multipart from '@fastify/multipart';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import type BetterSqlite3 from 'better-sqlite3';

import { getConfig } from './config.js';
import { UserContextManager } from './core/UserContextManager.js';
import { createAuthMiddleware } from './middleware/auth.js';
import { writeGuardMiddleware } from './middleware/writeGuard.js';
import { ProfileManager } from './core/ProfileManager.js';
import { healthRoutes } from './routes/health.js';
import { ingestRoutes } from './routes/ingest.js';
import { recallRoutes } from './routes/recall.js';
import { lifecycleRoutes } from './routes/lifecycle.js';
import { projectRoutes } from './routes/projects.js';
import { askRoutes } from './routes/ask.js';
import { notificationRoutes } from './routes/notifications.js';
import { eventsRoutes } from './routes/events.js';
import { ingestBatchRoutes } from './routes/ingestBatch.js';
import { memoryRoutes } from './routes/memories.js';
import { exportRoutes } from './routes/export.js';
import { exportJobRoutes } from './routes/exportJobs.js';
import { importRoutes } from './routes/import.js';
import { statsRoutes } from './routes/stats.js';
import { entityRoutes } from './routes/entities.js';
import { confirmRequestRoutes } from './routes/confirmRequests.js';
import { consolidateRoutes } from './routes/consolidate.js';
import { configRoutes } from './routes/config.js';
import { feedbackRoutes } from './routes/feedback.js';
import { profileRoutes } from './routes/profile.js';
import { agentRoutes } from './routes/agent.js';
import { migrateRoutes } from './routes/migrate.js';
import { contextRecallRoutes } from './routes/contextRecall.js';
import { keystoneBriefRoutes } from './routes/keystoneBriefs.js';
import { contextAssistRoutes } from './routes/contextAssist.js';
import { composerAssistRoutes } from './routes/composerAssist.js';
import { calendarEventRoutes } from './routes/calendarEvents.js';
import { userFilesRoutes } from './routes/userFiles.js';
import { dreamDigestRoutes } from './routes/dreamDigest.js';
import { weeklyReportRoutes } from './routes/weeklyReport.js';
import { reflectionThreadRoutes } from './routes/reflectionThreads.js';
import { actionRoutes } from './routes/actions.js';
import { agentTaskRoutes } from './routes/agentTasks.js';
import { agentExecutorRoutes } from './routes/agentExecutors.js';
import { agentWorkerRoutes } from './routes/agentWorkers.js';
import { concernedItemsRoutes } from './routes/concernedItems.js';
import { followThreadHitRoutes } from './routes/followThreadHits.js';
import { messageRuleRoutes } from './routes/messageRules.js';
import { outreachRoutes } from './routes/outreach.js';
import { notificationCenterRoutes } from './routes/notificationCenter.js';
import { outcomeRoutes } from './routes/outcomes.js';
import { providerRoutes } from './routes/providers.js';
import { meetingRoutes } from './routes/meetings.js';
import { meetingOutcomeRoutes } from './routes/meetingOutcomes.js';
import { extractorRoutes } from './routes/extractor.js';
import { publicSkillRoutes, skillRoutes } from './routes/skills.js';
import { relationshipRoutes } from './routes/relationships.js';
import { dayPilotRoutes } from './routes/dayPilot.js';
import { coverageRoutes } from './routes/coverage.js';
import { backupRoutes } from './routes/backup.js';
import { rehearsalRoutes } from './routes/rehearsals.js';
import { storylineRoutes } from './routes/storylines.js';
import { sourceMemoryRoutes } from './routes/sourceMemory.js';
import { ambientCalibrationRoutes } from './routes/ambientCalibration.js';
import { recallRelevanceRoutes } from './routes/recallRelevance.js';
import { evidenceWatchContractRoutes } from './routes/evidenceWatchContracts.js';
import { usageRoutes } from './routes/usage.js';
import { memoryClaimRoutes } from './routes/memoryClaims.js';
import { userKeyRoutes } from './routes/userKeys.js';
import { contextPackRoutes } from './routes/contextPack.js';
import { mcpHttpRoutes } from './routes/mcp.js';
import { a2aRoutes } from './routes/a2a.js';
import { ProactiveScheduler } from './core/ProactiveScheduler.js';
import {
  initAnalyticsStore,
  getAnalyticsStore,
  closeAnalyticsStore,
} from './analytics/AnalyticsStore.js';
import {
  capabilityForRoute,
  normalizeRoutePath,
} from './analytics/capabilityMap.js';
import { enterUsageContext } from './analytics/usageContext.js';
import { isSqliteCorruptError } from './utils/sqliteErrors.js';

// ---------------------------------------------------------------------------
// App builder (exported for testing)
// ---------------------------------------------------------------------------

export interface BuildAppOptions {
  /** For tests: supply a pre-built UserContextManager */
  userContextManager?: UserContextManager;
  /** DEPRECATED: For backward compatibility with existing tests that pass raw db */
  db?: BetterSqlite3.Database;
}

/**
 * Build and configure the Fastify application.
 *
 * Exported so integration tests can create an app instance without
 * actually listening on a port.
 */
export async function buildApp(
  options: BuildAppOptions = {},
): Promise<{ app: FastifyInstance; userContextManager: UserContextManager }> {
  const config = getConfig();

  // ---- Usage analytics store (standalone central DB) ----
  initAnalyticsStore(config.dataDir);

  // ---- UserContextManager ----
  let userContextManager: UserContextManager;

  if (options.userContextManager) {
    userContextManager = options.userContextManager;
  } else {
    userContextManager = new UserContextManager(config.dataDir);
  }

  // ---- Fastify ----
  const app = Fastify({
    logger: {
      level: config.logLevel,
    },
  });
  app.decorate('userContextManager', userContextManager);

  app.setErrorHandler((error, request, reply) => {
    if (isSqliteCorruptError(error) && request.userId) {
      try {
        userContextManager.resetContext(request.userId);
        request.log.error(
          { err: error, userId: request.userId },
          'sqlite corrupt; user context reset so the next request reopens the database',
        );
      } catch (resetError) {
        request.log.warn(
          { err: resetError, userId: request.userId },
          'sqlite corrupt; failed to reset user context',
        );
      }
    }
    reply.send(error);
  });

  // ---- Plugins ----
  const allowedOrigins = (process.env.ALLOWED_ORIGINS || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
  const corsOrigin =
    allowedOrigins.length === 0
      ? false
      : allowedOrigins.includes('*')
        ? true
        : allowedOrigins;
  await app.register(cors, {
    // Empty ALLOWED_ORIGINS → deny browser CORS (extension SW / chrome-extension
    // pages do not need CORS). Explicit list allows only those origins.
    // ALLOWED_ORIGINS=* reflects any Origin (legacy / emergency).
    origin: corsOrigin,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS', 'HEAD'],
    allowedHeaders: [
      'Content-Type',
      'Accept',
      'Authorization',
      'X-User-Id',
      'X-Personal-AI-Language',
      'Accept-Language',
    ],
    exposedHeaders: [
      'Content-Disposition',
      'X-Personal-AI-Backup-User-Id',
      'X-Personal-AI-Backup-Exported-At',
      'X-Personal-AI-Backup-Format-Version',
      'X-Personal-AI-Backup-Include-Count',
      'X-Personal-AI-Backup-Layer-A-Count',
      'X-Personal-AI-Backup-Layer-B-Count',
      'X-Personal-AI-Backup-Layer-C-Generated-Count',
      'X-Personal-AI-Backup-Layer-C-Failed-Count',
      'X-Personal-AI-Backup-Layer-C-Skipped-Count',
    ],
    credentials: false,
  });

  await app.register(multipart, {
    limits: {
      files: 1,
      fileSize: 4 * 1024 * 1024 * 1024,
    },
  });

  await app.register(swagger, {
    openapi: {
      info: {
        title: 'Personal AI Memory Service',
        description:
          'API for the Personal AI memory and knowledge graph backend',
        version: '0.1.0',
      },
    },
  });

  await app.register(swaggerUi, {
    routePrefix: '/docs',
  });

  // ---- Auth middleware ----
  if (options.db) {
    // Test mode: override auth middleware to always return a context with the test db
    app.addHook('onRequest', async (request) => {
      // Skip for health checks and docs (same logic as createAuthMiddleware)
      if (request.url === '/health' || request.url.startsWith('/docs')) {
        return;
      }
      request.userId = 'test';
      request.userContext = {
        userId: 'test',
        db: options.db!,
        database: null as any, // not used in tests
        userDataManager: null as any, // not used in tests
        profileManager: new ProfileManager(options.db!),
        lastAccessedAt: Date.now(),
        createdAt: Date.now(),
      };
    });
  } else {
    // Reject fallback writes before auth can lazily create a default user context.
    app.addHook('onRequest', writeGuardMiddleware);
    app.addHook('onRequest', createAuthMiddleware(userContextManager));
  }

  // ---- Usage analytics instrumentation ----
  // Registered AFTER auth so request.userId is resolved. Enters an async usage
  // context (side:'backend') that LLMClient reads to attribute token usage.
  app.addHook('onRequest', async (request) => {
    if (request.method === 'OPTIONS') return;
    const routePath = normalizeRoutePath(
      request.routeOptions?.url ?? request.url,
    );
    if (!routePath || routePath === '/health' || routePath.startsWith('/docs')) {
      return;
    }
    enterUsageContext({
      userId: request.userId,
      capability: capabilityForRoute(routePath),
      side: 'backend',
      route: routePath,
    });
  });

  // Record every /api/v1/* call into api_call_events (frequency), excluding
  // health, docs, and the usage endpoints themselves.
  app.addHook('onResponse', async (request, reply) => {
    try {
      const store = getAnalyticsStore();
      if (!store) return;
      if (request.method === 'OPTIONS') return;
      const rawUrl = request.url.split('?')[0];
      if (!rawUrl.startsWith('/api/v1/')) return;
      const routePath = normalizeRoutePath(
        request.routeOptions?.url ?? rawUrl,
      );
      if (
        routePath === '/health' ||
        routePath.startsWith('/docs') ||
        routePath.startsWith('/usage')
      ) {
        return;
      }
      store.recordApiCall({
        userId: request.userId ?? 'unknown',
        capability: capabilityForRoute(routePath),
        route: routePath,
        method: request.method,
        status: reply.statusCode,
      });
    } catch {
      // best-effort: analytics must never break the response path
    }
  });

  // ---- Routes ----
  // Routes now get db from request.userContext.db (set by auth middleware)
  await app.register(
    async (instance) => {
      await instance.register(healthRoutes);
      await instance.register(ingestRoutes);
      await instance.register(recallRoutes);
      await instance.register(lifecycleRoutes);
      await instance.register(projectRoutes);
      await instance.register(askRoutes);
      await instance.register(notificationRoutes);
      await instance.register(eventsRoutes);
      await instance.register(ingestBatchRoutes);
      await instance.register(memoryRoutes);
      await instance.register(exportRoutes);
      await instance.register(exportJobRoutes);
      await instance.register(importRoutes);
      await instance.register(statsRoutes);
      await instance.register(entityRoutes);
      await instance.register(confirmRequestRoutes);
      await instance.register(consolidateRoutes);
      await instance.register(configRoutes);
      await instance.register(feedbackRoutes);
      await instance.register(profileRoutes);
      await instance.register(agentRoutes);
      await instance.register(migrateRoutes);
      await instance.register(contextRecallRoutes);
      await instance.register(keystoneBriefRoutes);
      await instance.register(contextAssistRoutes);
      await instance.register(composerAssistRoutes);
      await instance.register(calendarEventRoutes);
      await instance.register(userFilesRoutes);
      await instance.register(dreamDigestRoutes);
      await instance.register(weeklyReportRoutes);
      await instance.register(reflectionThreadRoutes);
      await instance.register(actionRoutes);
      await instance.register(agentTaskRoutes);
      await instance.register(agentExecutorRoutes);
      await instance.register(agentWorkerRoutes);
      await instance.register(messageRuleRoutes);
      await instance.register(outreachRoutes);
      await instance.register(concernedItemsRoutes);
      await instance.register(followThreadHitRoutes);
      await instance.register(notificationCenterRoutes);
      await instance.register(outcomeRoutes);
      await instance.register(providerRoutes);
      await instance.register(meetingRoutes);
      await instance.register(meetingOutcomeRoutes);
      await instance.register(extractorRoutes);
      await instance.register(relationshipRoutes);
      await instance.register(skillRoutes);
      await instance.register(dayPilotRoutes);
      await instance.register(coverageRoutes);
      await instance.register(backupRoutes);
      await instance.register(rehearsalRoutes);
      await instance.register(storylineRoutes);
      await instance.register(sourceMemoryRoutes);
      await instance.register(ambientCalibrationRoutes);
      await instance.register(recallRelevanceRoutes);
      await instance.register(evidenceWatchContractRoutes);
      await instance.register(usageRoutes);
      await instance.register(memoryClaimRoutes);
      await instance.register(userKeyRoutes);
      await instance.register(contextPackRoutes);
    },
    { prefix: '/api/v1' },
  );

  // Tokenized, read-only skill share URLs for external agents.
  await app.register(publicSkillRoutes, { userContextManager });

  // Streamable HTTP MCP (Block F) — top-level /mcp, bearer + origin gated.
  await app.register(mcpHttpRoutes);

  // A2A Agent Card + JSON-RPC (Block G).
  await app.register(a2aRoutes);

  // Top-level health check (no prefix) for container orchestrators
  await app.register(healthRoutes);

  return { app, userContextManager };
}

// ---------------------------------------------------------------------------
// Main (only runs when executed directly, not when imported)
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const config = getConfig();
  const { app, userContextManager } = await buildApp();

  // ---- Start Proactive Scheduler ----
  const scheduler = new ProactiveScheduler(userContextManager);
  scheduler.start();
  if (scheduler.isRunning) {
    console.log('[server] Proactive scheduler started');
  } else {
    console.log('[server] Proactive scheduler loops not started');
  }

  // ---- Graceful shutdown ----
  const shutdown = async (signal: string) => {
    console.log(`\n[server] Received ${signal}, shutting down ...`);
    scheduler.stop();
    await app.close();
    userContextManager.closeAll();
    closeAnalyticsStore();
    console.log('[server] Closed all user contexts and server. Goodbye.');
    process.exit(0);
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));

  // ---- Start listening ----
  try {
    await app.listen({ port: config.port, host: config.host });
    console.log(`[server] Listening on http://${config.host}:${config.port}`);
    console.log(
      `[server] Swagger docs at http://${config.host}:${config.port}/docs`,
    );
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

// Detect if this module is the entry point
const isMain =
  process.argv[1] &&
  (process.argv[1].endsWith('/server.ts') ||
    process.argv[1].endsWith('/server.js'));

if (isMain) {
  main();
}
