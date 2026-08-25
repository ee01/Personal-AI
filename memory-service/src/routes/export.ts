/**
 * Memory export route.
 *
 * POST /export - synchronous zip download. Suitable for small libraries only;
 * large databases should use POST /export/jobs (async, streaming).
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
      const manifest = result.manifest;

      reply.header('Content-Type', 'application/zip');
      reply.header(
        'Content-Disposition',
        `attachment; filename="${result.fileName}"`,
      );
      reply.header('Cache-Control', 'no-store');
      reply.header('X-Personal-AI-Backup-User-Id', manifest.userId);
      reply.header('X-Personal-AI-Backup-Exported-At', manifest.exportedAt);
      reply.header('X-Personal-AI-Backup-Archive-SHA256', result.archiveSha256);
      reply.header(
        'X-Personal-AI-Backup-Format-Version',
        String(manifest.formatVersion),
      );
      reply.header(
        'X-Personal-AI-Backup-Include-Count',
        String(manifest.includes.length),
      );
      reply.header(
        'X-Personal-AI-Backup-Layer-A-Count',
        String(manifest.layers.A.paths.length),
      );
      reply.header(
        'X-Personal-AI-Backup-Layer-B-Count',
        String(manifest.layers.B.paths.length),
      );
      reply.header(
        'X-Personal-AI-Backup-Layer-C-Generated-Count',
        String(manifest.layers.C.generated.length),
      );
      reply.header(
        'X-Personal-AI-Backup-Layer-C-Failed-Count',
        String(manifest.layers.C.failed.length),
      );
      reply.header(
        'X-Personal-AI-Backup-Layer-C-Skipped-Count',
        String(manifest.layers.C.skipped.length),
      );

      return reply.send(result.buffer);
    },
  );
}
