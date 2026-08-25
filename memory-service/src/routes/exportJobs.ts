import type { FastifyInstance } from 'fastify';

import { ExportLockBusyError } from '../core/backup/exportLock.js';
import {
  createExportJob,
  getExportJob,
  openExportJobDownload,
} from '../core/ExportJobService.js';
import { readAutoBackupConfig } from '../core/AutoBackupService.js';

interface ExportJobBody {
  includeDerived?: boolean;
  includeVectors?: boolean;
  encrypt?: boolean;
}

const exportJobBodySchema = {
  type: 'object' as const,
  properties: {
    includeDerived: { type: 'boolean' as const },
    includeVectors: { type: 'boolean' as const },
    encrypt: { type: 'boolean' as const },
  },
  additionalProperties: false,
};

export async function exportJobRoutes(app: FastifyInstance): Promise<void> {
  app.post<{ Body: ExportJobBody }>(
    '/export/jobs',
    {
      schema: { body: exportJobBodySchema },
      preValidation: async (request) => {
        if (request.body == null) {
          request.body = {};
        }
      },
    },
    async (request, reply) => {
      try {
        const encrypt = request.body?.encrypt === true;
        const persisted = readAutoBackupConfig(request.userContext.userDataManager);
        const passphrase =
          typeof persisted.autoBackupEncryptionPassphrase === 'string'
            ? persisted.autoBackupEncryptionPassphrase
            : '';
        if (encrypt && !passphrase) {
          return reply.status(400).send({
            error: 'encrypt=true requires autoBackupEncryptionPassphrase in config',
          });
        }
        const job = await createExportJob(request.userContext, {
          includeDerived: request.body?.includeDerived,
          includeVectors: request.body?.includeVectors,
          encrypt,
          passphrase: encrypt ? passphrase : undefined,
        });
        return reply.status(202).send(job);
      } catch (error) {
        if (error instanceof ExportLockBusyError) {
          return reply.status(409).send({ error: error.message });
        }
        throw error;
      }
    },
  );

  app.get<{ Params: { id: string } }>('/export/jobs/:id', async (request, reply) => {
    const job = getExportJob(request.userId, request.params.id);
    if (!job) {
      return reply.status(404).send({ error: 'Export job not found' });
    }
    return reply.send(job);
  });

  app.get<{ Params: { id: string } }>(
    '/export/jobs/:id/download',
    async (request, reply) => {
      try {
        const { stream, job } = openExportJobDownload(
          request.userId,
          request.params.id,
        );
        const manifest = job.manifest;
        reply.header(
          'Content-Type',
          job.encrypted ? 'application/octet-stream' : 'application/zip',
        );
        reply.header(
          'Content-Disposition',
          `attachment; filename="${job.fileName}"`,
        );
        reply.header('Cache-Control', 'no-store');
        if (job.sizeBytes !== undefined) {
          reply.header('Content-Length', String(job.sizeBytes));
        }
        if (job.archiveSha256) {
          reply.header('X-Personal-AI-Backup-Archive-SHA256', job.archiveSha256);
        }
        if (manifest) {
          reply.header('X-Personal-AI-Backup-User-Id', manifest.userId);
          reply.header('X-Personal-AI-Backup-Exported-At', manifest.exportedAt);
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
        }
        return reply.send(stream);
      } catch (error) {
        const status = (error as { statusCode?: number }).statusCode || 500;
        return reply.status(status).send({
          error: error instanceof Error ? error.message : String(error),
        });
      }
    },
  );
}
