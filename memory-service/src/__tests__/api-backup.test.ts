import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';

import { buildApp } from '../server.js';
import { UserContextManager } from '../core/UserContextManager.js';
import { resetExportJobsForTests } from '../core/ExportJobService.js';
import { decryptBackupFile } from '../core/backup/backupCrypto.js';
import { previewMemoryBackupImportZip } from '../core/MemoryBackupService.js';
import { LocalDirProvider } from '../integrations/backupStorage/LocalDirProvider.js';
import { runAutoBackupOnce } from '../core/AutoBackupService.js';
import { resetConfigForTests } from '../config.js';

async function waitForJob(
  app: FastifyInstance,
  jobId: string,
  userId: string,
): Promise<Record<string, unknown>> {
  for (let i = 0; i < 40; i += 1) {
    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/export/jobs/${jobId}`,
      headers: { 'x-user-id': userId },
    });
    const body = res.json();
    if (body.status === 'ready' || body.status === 'failed') return body;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error('export job did not finish');
}

describe('backup export jobs and auto backup', () => {
  let app: FastifyInstance;
  let userContextManager: UserContextManager;
  let tempDir: string;
  const prevEnv: Record<string, string | undefined> = {};

  beforeAll(async () => {
    for (const key of ['API_KEY', 'BOOTSTRAP_API_KEY']) {
      prevEnv[key] = process.env[key];
      delete process.env[key];
    }
    resetConfigForTests();
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'api-backup-'));
    userContextManager = new UserContextManager(tempDir);
    const result = await buildApp({ userContextManager });
    app = result.app;
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
    userContextManager.closeAll();
    fs.rmSync(tempDir, { recursive: true, force: true });
    resetExportJobsForTests();
    for (const [key, value] of Object.entries(prevEnv)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    resetConfigForTests();
  });

  it('creates a streaming export job and downloads a valid backup zip', async () => {
    const userId = 'backup-job-user';
    const createRes = await app.inject({
      method: 'POST',
      url: '/api/v1/export/jobs',
      headers: { 'x-user-id': userId },
      payload: { includeDerived: true },
    });
    expect(createRes.statusCode).toBe(202);
    const created = createRes.json();
    const done = await waitForJob(app, created.id, userId);
    expect(done.status).toBe('ready');
    expect(done.archiveSha256).toMatch(/^[a-f0-9]{64}$/);

    const download = await app.inject({
      method: 'GET',
      url: `/api/v1/export/jobs/${created.id}/download`,
      headers: { 'x-user-id': userId },
    });
    expect(download.statusCode).toBe(200);
    expect(download.headers['content-type']).toContain('zip');
    expect(download.headers['x-personal-ai-backup-archive-sha256']).toBe(
      done.archiveSha256,
    );
    expect(download.rawPayload.length).toBeGreaterThan(100);

    const zipPath = path.join(tempDir, 'downloaded.zip');
    fs.writeFileSync(zipPath, download.rawPayload);
    const ctx = userContextManager.getContext(userId);
    const preview = await previewMemoryBackupImportZip(ctx, zipPath, 'merge');
    expect(preview.backup.userId).toBe(userId);
    expect(preview.restoredLayers).toEqual(['A', 'B']);
  });

  it('sanitizes auto backup secrets on GET /config', async () => {
    const userId = 'backup-config-user';
    const putRes = await app.inject({
      method: 'PUT',
      url: '/api/v1/config',
      headers: { 'x-user-id': userId },
      payload: {
        autoBackupEnabled: true,
        autoBackupProvider: 'webdav',
        autoBackupWebdavUrl: 'https://dav.example.com/dav/personal-ai/',
        autoBackupWebdavUsername: 'esone',
        autoBackupWebdavPassword: 'app-password-secret',
        autoBackupEncryptionPassphrase: 'never-return-this',
        autoBackupS3SecretAccessKey: 's3-secret',
      },
    });
    expect(putRes.statusCode).toBe(200);
    const body = JSON.stringify(putRes.json());
    expect(body).not.toContain('app-password-secret');
    expect(body).not.toContain('never-return-this');
    expect(body).not.toContain('s3-secret');
    expect(putRes.json().autoBackupWebdavPasswordConfigured).toBe(true);
    expect(putRes.json().autoBackupEncryptionPassphraseConfigured).toBe(true);
    expect(putRes.json().autoBackupEnabled).toBe(true);
  });

  it('pushes an encrypted snapshot through LocalDirProvider and keeps retention', async () => {
    const userId = 'backup-push-user';
    const ctx = userContextManager.getContext(userId);
    const remoteDir = path.join(tempDir, 'remote');
    fs.mkdirSync(remoteDir, { recursive: true });
    ctx.userDataManager.writeFile(
      'config.json',
      JSON.stringify({
        autoBackupEnabled: true,
        autoBackupProvider: 'webdav',
        autoBackupEncryptionEnabled: true,
        autoBackupEncryptionPassphrase: 'unit-test-pass',
        autoBackupRetentionCount: 1,
        autoBackupPrefix: 'personal-ai-backups',
      }),
    );

    const provider = new LocalDirProvider(remoteDir);
    const first = await runAutoBackupOnce(ctx, {
      trigger: 'manual',
      testProvider: provider,
    });
    expect(first.status).toBe('success');
    const second = await runAutoBackupOnce(ctx, {
      trigger: 'manual',
      testProvider: provider,
    });
    expect(second.status).toBe('success');

    const listed = await provider.list(`personal-ai-backups/${userId}`);
    expect(listed.length).toBe(1);
    expect(listed[0].key.endsWith('.zip.enc')).toBe(true);

    const encPath = path.join(remoteDir, listed[0].key);
    const zipPath = path.join(tempDir, 'restored.zip');
    await decryptBackupFile(encPath, zipPath, 'unit-test-pass');
    const preview = await previewMemoryBackupImportZip(ctx, zipPath, 'merge');
    expect(preview.backup.userId).toBe(userId);

    const statusRes = await app.inject({
      method: 'GET',
      url: '/api/v1/backup/status',
      headers: { 'x-user-id': userId },
    });
    expect(statusRes.statusCode).toBe(200);
    expect(statusRes.json().consecutiveFailures).toBe(0);
    expect(statusRes.json().history[0].status).toBe('success');
    expect(JSON.stringify(statusRes.json())).not.toContain('unit-test-pass');
  });
});
