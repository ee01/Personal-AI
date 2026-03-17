/**
 * Memory export route.
 *
 * POST /export - returns a zip backup that contains:
 * - manifest.json
 * - user/*
 * - derived/*
 */

import type { FastifyInstance } from 'fastify';

import { exportMemoryBackupZip } from '../core/MemoryBackupService.js';

interface ExportBody {
  format?: 'backup_zip';
}

const exportBodySchema = {
  type: 'object' as const,
  properties: {
    format: {
      type: 'string' as const,
      enum: ['backup_zip'],
      default: 'backup_zip',
    },
  },
  additionalProperties: false,
};

export async function exportRoutes(app: FastifyInstance): Promise<void> {
  app.post<{ Body: ExportBody }>(
    '/export',
    {
      schema: {
        body: exportBodySchema,
      },
    },
    async (request, reply) => {
      const result = await exportMemoryBackupZip(request.userContext);

      reply.header('Content-Type', 'application/zip');
      reply.header(
        'Content-Disposition',
        `attachment; filename="${result.fileName}"`,
      );
      reply.header('Cache-Control', 'no-store');

      return reply.send(result.buffer);
    },
  );
}
