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

import type { FastifyInstance, FastifyRequest } from 'fastify';

import {
  importMemoryBackupZip,
  MemoryBackupValidationError,
  previewMemoryBackupImportZip,
} from '../core/MemoryBackupService.js';
import {
  SmartMemoryImportService,
  SmartMemoryImportValidationError,
  type SmartMemoryImportInput,
} from '../core/SmartMemoryImportService.js';

type ImportMode = 'merge' | 'replace';
type ImportScope = 'work' | 'personal';

const MAX_SMART_IMPORT_FILE_BYTES = 128 * 1024 * 1024;

function normalizeImportMode(value: unknown): ImportMode {
  if (value === undefined || value === null || value === '') {
    return 'merge';
  }

  const normalized = String(value).trim().toLowerCase();
  if (normalized === 'merge' || normalized === 'replace') {
    return normalized;
  }

  throw new MemoryBackupValidationError('Import mode must be merge or replace');
}

function normalizeDryRun(value: unknown): boolean {
  if (value === undefined || value === null || value === '') {
    return false;
  }

  const normalized = String(value).trim().toLowerCase();
  if (['1', 'true', 'yes', 'y'].includes(normalized)) {
    return true;
  }
  if (['0', 'false', 'no', 'n'].includes(normalized)) {
    return false;
  }

  throw new MemoryBackupValidationError('dryRun must be true or false');
}

function normalizeImportScope(value: unknown): ImportScope {
  if (value === undefined || value === null || value === '') {
    return 'work';
  }

  const normalized = String(value).trim().toLowerCase();
  if (normalized === 'work' || normalized === 'personal') {
    return normalized;
  }

  throw new SmartMemoryImportValidationError('Import scope must be work or personal');
}

function isMultipartRequest(request: { headers: Record<string, any> }): boolean {
  const contentType = String(request.headers['content-type'] || '').toLowerCase();
  return contentType.includes('multipart/form-data');
}

async function readSmartImportMultipart(
  request: FastifyRequest,
): Promise<SmartMemoryImportInput> {
  let text = '';
  let scope: ImportScope = 'work';
  let fileName = '';
  let mimeType = '';
  let buffer: Buffer | undefined;

  for await (const part of request.parts()) {
    if (part.type === 'file') {
      if (buffer) {
        throw new SmartMemoryImportValidationError(
          'Smart import accepts exactly one file',
        );
      }
      fileName = part.filename || 'import-source';
      mimeType = part.mimetype || '';
      buffer = await readFilePartToBuffer(part.file);
      continue;
    }

    if (part.fieldname === 'text') {
      text = String(part.value || '');
      continue;
    }

    if (part.fieldname === 'scope') {
      scope = normalizeImportScope(part.value);
    }
  }

  if (buffer) {
    return {
      inputKind: 'file',
      fileName,
      mimeType,
      buffer,
      scope,
    };
  }

  return {
    inputKind: 'paste',
    text,
    scope,
  };
}

async function readFilePartToBuffer(stream: AsyncIterable<Buffer | string>): Promise<Buffer> {
  const chunks: Buffer[] = [];
  let totalBytes = 0;

  for await (const chunk of stream) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    totalBytes += buffer.length;
    if (totalBytes > MAX_SMART_IMPORT_FILE_BYTES) {
      throw new SmartMemoryImportValidationError(
        `Import file is larger than ${MAX_SMART_IMPORT_FILE_BYTES} bytes`,
      );
    }
    chunks.push(buffer);
  }

  return Buffer.concat(chunks);
}

async function readSmartImportInput(request: any): Promise<SmartMemoryImportInput> {
  if (isMultipartRequest(request)) {
    return readSmartImportMultipart(request);
  }

  const body = (request.body ?? {}) as {
    text?: unknown;
    scope?: unknown;
  };

  return {
    inputKind: 'paste',
    text: String(body.text ?? ''),
    scope: normalizeImportScope(body.scope),
  };
}

export async function importRoutes(app: FastifyInstance): Promise<void> {
  app.post('/import/inspect', async (request, reply) => {
    try {
      const input = await readSmartImportInput(request);
      const service = new SmartMemoryImportService(request.userContext);
      const result = service.inspect(input);
      return reply.status(200).send(result);
    } catch (error) {
      if (error instanceof SmartMemoryImportValidationError) {
        return reply.status(error.statusCode).send({ error: error.message });
      }

      throw error;
    }
  });

  app.post('/import/commit', async (request, reply) => {
    try {
      const input = await readSmartImportInput(request);
      const service = new SmartMemoryImportService(request.userContext);
      const result = service.commit(input);
      return reply.status(200).send(result);
    } catch (error) {
      if (error instanceof SmartMemoryImportValidationError) {
        return reply.status(error.statusCode).send({ error: error.message });
      }

      throw error;
    }
  });

  app.post('/import', async (request, reply) => {
    const uploadDir = await fs.mkdtemp(
      path.join(os.tmpdir(), 'personal-ai-memory-import-upload-'),
    );
    const uploadPath = path.join(uploadDir, 'memory-backup.zip');

    try {
      let mode: ImportMode = 'merge';
      let dryRun = false;
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
          continue;
        }

        if (part.fieldname === 'dryRun') {
          dryRun = normalizeDryRun(part.value);
        }
      }

      if (!fileSaved) {
        return reply.status(400).send({ error: 'Missing multipart file upload' });
      }

      if (dryRun) {
        const result = await previewMemoryBackupImportZip(
          request.userContext,
          uploadPath,
          mode,
        );

        return reply.status(200).send(result);
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
