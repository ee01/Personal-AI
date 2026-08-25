import type { FastifyInstance } from 'fastify';

import { ExportLockBusyError } from '../core/backup/exportLock.js';
import { appendBackupHistory, readBackupState } from '../core/backup/backupState.js';
import {
  collectDbVolume,
  createProviderFromConfig,
  nextBackupIso,
  readAutoBackupConfig,
  resolveAutoBackupConfig,
  runAutoBackupOnce,
} from '../core/AutoBackupService.js';

interface PullReceiptBody {
  jobId?: string;
  deviceName?: string;
  localPath?: string;
  sizeBytes?: number;
  sha256?: string;
  status?: 'success' | 'failed';
  error?: string;
}

export async function backupRoutes(app: FastifyInstance): Promise<void> {
  app.get('/backup/status', async (request, reply) => {
    const raw = readAutoBackupConfig(request.userContext.userDataManager);
    const config = resolveAutoBackupConfig(raw);
    const state = await readBackupState(request.userContext.userDataManager.rootDir);
    const volume = collectDbVolume(request.userContext.db);
    return reply.send({
      enabled: config.enabled,
      provider: config.provider,
      scheduleType: config.scheduleType,
      preferredHour: config.preferredHour,
      intervalHours: config.intervalHours,
      retentionCount: config.retentionCount,
      encryptionEnabled: config.encryptionEnabled,
      encryptionConfigured: Boolean(config.passphrase),
      includeDerived: config.includeDerived,
      includeVectors: config.includeVectors,
      prefix: config.prefix,
      lastBackup: state.lastSuccessAt
        ? {
            at: state.lastSuccessAt,
            sizeBytes: state.lastSizeBytes,
            channel: state.lastChannel,
            status: state.lastStatus,
            objectKey: state.lastObjectKey,
          }
        : null,
      lastAttemptAt: state.lastAttemptAt || null,
      nextEstimatedAt: nextBackupIso(raw, state.lastSuccessAt),
      consecutiveFailures: state.consecutiveFailures,
      history: state.history,
      volume,
    });
  });

  app.post('/backup/run', async (request, reply) => {
    try {
      const result = await runAutoBackupOnce(request.userContext, {
        trigger: 'manual',
      });
      const status = result.status === 'failed' ? 500 : 200;
      return reply.status(status).send(result);
    } catch (error) {
      if (error instanceof ExportLockBusyError) {
        return reply.status(409).send({ error: error.message });
      }
      throw error;
    }
  });

  app.post('/backup/test-connection', async (request, reply) => {
    try {
      const raw = readAutoBackupConfig(request.userContext.userDataManager);
      const provider = createProviderFromConfig(raw);
      const result = await provider.test();
      return reply.send(result);
    } catch (error) {
      return reply.status(400).send({
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });

  app.post<{ Body: PullReceiptBody }>('/backup/pull-receipt', async (request, reply) => {
    const body = request.body || {};
    const status = body.status === 'failed' ? 'failed' : 'success';
    const state = await appendBackupHistory(
      request.userContext.userDataManager.rootDir,
      {
        at: new Date().toISOString(),
        channel: 'desktop_pull',
        status,
        sizeBytes: typeof body.sizeBytes === 'number' ? body.sizeBytes : undefined,
        localPath: body.localPath,
        deviceName: body.deviceName,
        jobId: body.jobId,
        error: body.error,
        trigger: 'pull',
      },
    );
    return reply.send({ ok: true, consecutiveFailures: state.consecutiveFailures });
  });

  app.get('/backup/remote', async (request, reply) => {
    try {
      const raw = readAutoBackupConfig(request.userContext.userDataManager);
      const config = resolveAutoBackupConfig(raw);
      const provider = createProviderFromConfig(raw);
      const objects = await provider.list(
        `${config.prefix}/${request.userId}`,
      );
      return reply.send({
        provider: config.provider,
        objects: objects.map((item) => ({
          key: item.key,
          sizeBytes: item.sizeBytes,
          lastModified: item.lastModified,
          encrypted: item.key.endsWith('.enc'),
        })),
      });
    } catch (error) {
      return reply.status(400).send({
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });
}
