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
import { projectRoutes } from './routes/projects.js';
import { askRoutes } from './routes/ask.js';
import { notificationRoutes } from './routes/notifications.js';
import { eventsRoutes } from './routes/events.js';
import { ingestBatchRoutes } from './routes/ingestBatch.js';
import { exportRoutes } from './routes/export.js';
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
import { contextMatchRoutes } from './routes/contextMatch.js';
import { userFilesRoutes } from './routes/userFiles.js';
import { dreamDigestRoutes } from './routes/dreamDigest.js';
import { weeklyReportRoutes } from './routes/weeklyReport.js';
import { reflectionThreadRoutes } from './routes/reflectionThreads.js';
import { actionRoutes } from './routes/actions.js';
import { concernedItemsRoutes } from './routes/concernedItems.js';
import { followThreadHitRoutes } from './routes/followThreadHits.js';
import { outreachRoutes } from './routes/outreach.js';
import { providerRoutes } from './routes/providers.js';
import { ProactiveScheduler } from './core/ProactiveScheduler.js';

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

  // ---- Plugins ----
  await app.register(cors, {
    origin: true, // 允许所有跨域来源（反射请求的 Origin）
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS', 'HEAD'],
    allowedHeaders: ['Content-Type', 'Accept', 'Authorization', 'X-User-Id'],
    exposedHeaders: [],
    credentials: false,
  });

  await app.register(multipart, {
    limits: {
      files: 1,
      fileSize: 512 * 1024 * 1024,
    },
  });

  await app.register(swagger, {
    openapi: {
      info: {
        title: 'Personal AI Memory Service',
        description: 'API for the Personal AI memory and knowledge graph backend',
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
    app.addHook('onRequest', createAuthMiddleware(userContextManager));
    app.addHook('onRequest', writeGuardMiddleware);
  }

  // ---- Routes ----
  // Routes now get db from request.userContext.db (set by auth middleware)
  await app.register(
    async (instance) => {
      await instance.register(healthRoutes);
      await instance.register(ingestRoutes);
      await instance.register(recallRoutes);
      await instance.register(projectRoutes);
      await instance.register(askRoutes);
      await instance.register(notificationRoutes);
      await instance.register(eventsRoutes);
      await instance.register(ingestBatchRoutes);
      await instance.register(exportRoutes);
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
      await instance.register(contextMatchRoutes);
      await instance.register(userFilesRoutes);
      await instance.register(dreamDigestRoutes);
      await instance.register(weeklyReportRoutes);
      await instance.register(reflectionThreadRoutes);
      await instance.register(actionRoutes);
      await instance.register(outreachRoutes);
      await instance.register(concernedItemsRoutes);
      await instance.register(followThreadHitRoutes);
      await instance.register(providerRoutes);
    },
    { prefix: '/api/v1' },
  );

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
  console.log('[server] Proactive scheduler started (heartbeat + cron)');

  // ---- Graceful shutdown ----
  const shutdown = async (signal: string) => {
    console.log(`\n[server] Received ${signal}, shutting down ...`);
    scheduler.stop();
    await app.close();
    userContextManager.closeAll();
    console.log('[server] Closed all user contexts and server. Goodbye.');
    process.exit(0);
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));

  // ---- Start listening ----
  try {
    await app.listen({ port: config.port, host: config.host });
    console.log(`[server] Listening on http://${config.host}:${config.port}`);
    console.log(`[server] Swagger docs at http://${config.host}:${config.port}/docs`);
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
