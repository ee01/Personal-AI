/**
 * Memory import route.
 *
 * POST /import - accepts a multipart zip backup and restores A+B layers.
 */

import { createWriteStream } from 'node:fs';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';

import type { FastifyInstance } from 'fastify';

import {
  importMemoryBackupZip,
  MemoryBackupValidationError,
} from '../core/MemoryBackupService.js';

type ImportMode = 'merge' | 'replace';

function normalizeImportMode(value: unknown): ImportMode {
  return value === 'replace' ? 'replace' : 'merge';
}

export async function importRoutes(app: FastifyInstance): Promise<void> {
  app.post('/import', async (request, reply) => {
    const uploadDir = await fs.mkdtemp(
      path.join(os.tmpdir(), 'personal-ai-memory-import-upload-'),
    );
    const uploadPath = path.join(uploadDir, 'memory-backup.zip');

    try {
      let mode: ImportMode = 'merge';
      let uploadedFileName = '';
      let fileSaved = false;

      for await (const part of request.parts()) {
        if (part.type === 'file') {
          if (fileSaved) {
            throw new MemoryBackupValidationError(
              'Import accepts exactly one zip file',
            );
          }

          uploadedFileName = part.filename;
          if (!uploadedFileName.toLowerCase().endsWith('.zip')) {
            throw new MemoryBackupValidationError(
              'Imported file must be a .zip backup',
            );
          }

          await pipeline(part.file, createWriteStream(uploadPath));
          fileSaved = true;
          continue;
        }

        if (part.fieldname === 'mode') {
          mode = normalizeImportMode(part.value);
        }
      }

      if (!fileSaved) {
        return reply.status(400).send({ error: 'Missing multipart file upload' });
      }

      const result = await importMemoryBackupZip(
        app,
        request.userContext,
        uploadPath,
        mode,
      );

      return reply.status(200).send(result);
    } catch (error) {
      if (error instanceof MemoryBackupValidationError) {
        return reply.status(error.statusCode).send({ error: error.message });
      }

      throw error;
    } finally {
      await fs.rm(uploadDir, { recursive: true, force: true });
    }
  });
}
