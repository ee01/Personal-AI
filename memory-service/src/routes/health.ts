/**
 * Health check route.
 *
 * GET /health - returns HealthResponse with database stats,
 * uptime, version, and embedding model status.
 */

import type { FastifyInstance } from 'fastify';
import { createRequire } from 'node:module';

import type { HealthResponse } from '../types/index.js';
import { EmbeddingClient } from '../llm/EmbeddingClient.js';

const require = createRequire(import.meta.url);

interface CountRow {
  count: number;
}

const startTime = Date.now();

export async function healthRoutes(
  app: FastifyInstance,
): Promise<void> {

  app.get('/health', async (request, reply) => {
    const db = request.userContext?.db;

    let messageCount = 0;
    let entityCount = 0;
    let chunkCount = 0;
    let dbConnected = !!db;

    if (db) {
      try {
        messageCount =
          (db.prepare('SELECT COUNT(*) AS count FROM messages_raw').get() as CountRow).count;
        entityCount =
          (db.prepare('SELECT COUNT(*) AS count FROM entities').get() as CountRow).count;
        chunkCount =
          (db.prepare('SELECT COUNT(*) AS count FROM chunks').get() as CountRow).count;
      } catch {
        dbConnected = false;
      }
    }

    // Read version from package.json
    let version = '0.0.0';
    try {
      const pkg = require('../../package.json') as { version: string };
      version = pkg.version;
    } catch {
      // In bundled environments the require may fail; fall back.
    }

    const uptimeMs = Date.now() - startTime;
    const embeddingLoaded = EmbeddingClient.isLoaded();
    const embeddingModel = EmbeddingClient.getModelName();

    // When no user context is available (top-level /health without auth),
    // report 'degraded' instead of 'error' since the service is still running.
    const status: HealthResponse['status'] = dbConnected
      ? embeddingLoaded
        ? 'ok'
        : 'degraded'
      : db
        ? 'error'       // db was provided but queries failed
        : 'degraded';   // no user context (unauthenticated health check)

    const body: HealthResponse = {
      status,
      version,
      uptime: Math.floor(uptimeMs / 1000),
      database: {
        connected: dbConnected,
        messageCount,
        entityCount,
        chunkCount,
      },
      embedding: {
        loaded: embeddingLoaded,
        model: embeddingModel,
      },
    };

    return reply.status(200).send(body);
  });
}
