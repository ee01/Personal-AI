import { createReadStream } from 'node:fs';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

import {
  encryptBackupFile,
} from './backup/backupCrypto.js';
import { ExportLockBusyError, isUserExportLocked, withUserExportLock } from './backup/exportLock.js';
import {
  exportMemoryBackupToFile,
  sha256File,
  type MemoryBackupExportFileOptions,
  type MemoryBackupManifest,
} from './MemoryBackupService.js';
import type { UserContext } from './UserContextManager.js';

export type ExportJobStatus =
  | 'queued'
  | 'exporting'
  | 'packaging'
  | 'encrypting'
  | 'ready'
  | 'failed';

export interface ExportJob {
  id: string;
  userId: string;
  status: ExportJobStatus;
  createdAt: string;
  updatedAt: string;
  expiresAt: string;
  fileName: string;
  filePath?: string;
  sizeBytes?: number;
  bytesWritten?: number;
  archiveSha256?: string;
  encrypted: boolean;
  error?: string;
  manifest?: MemoryBackupManifest;
}

const JOB_TTL_MS = 60 * 60 * 1000;
const jobs = new Map<string, ExportJob>();

function jobDir(userId: string, jobId: string): string {
  return path.join(os.tmpdir(), 'personal-ai-export-jobs', userId, jobId);
}

function publicJob(job: ExportJob): Omit<ExportJob, 'filePath'> {
  const { filePath: _filePath, ...rest } = job;
  return rest;
}

function touch(job: ExportJob, patch: Partial<ExportJob>): ExportJob {
  const next = { ...job, ...patch, updatedAt: new Date().toISOString() };
  jobs.set(job.id, next);
  return next;
}

async function removeJobFiles(job: ExportJob): Promise<void> {
  await fs.rm(jobDir(job.userId, job.id), { recursive: true, force: true });
}

export async function createExportJob(
  userContext: UserContext,
  options: MemoryBackupExportFileOptions & {
    encrypt?: boolean;
    passphrase?: string;
  } = {},
): Promise<Omit<ExportJob, 'filePath'>> {
  if (isUserExportLocked(userContext.userId)) {
    throw new ExportLockBusyError(userContext.userId);
  }

  const id = randomUUID();
  const createdAt = new Date().toISOString();
  const job: ExportJob = {
    id,
    userId: userContext.userId,
    status: 'queued',
    createdAt,
    updatedAt: createdAt,
    expiresAt: new Date(Date.now() + JOB_TTL_MS).toISOString(),
    fileName: `personal-ai-memory-${userContext.userId}.zip`,
    encrypted: Boolean(options.encrypt),
  };
  jobs.set(id, job);

  void runExportJob(userContext, id, options).catch((error) => {
    const current = jobs.get(id);
    if (!current) return;
    touch(current, {
      status: 'failed',
      error: error instanceof Error ? error.message : String(error),
    });
  });

  return publicJob(job);
}

async function runExportJob(
  userContext: UserContext,
  jobId: string,
  options: MemoryBackupExportFileOptions & {
    encrypt?: boolean;
    passphrase?: string;
  },
): Promise<void> {
  await withUserExportLock(userContext.userId, async () => {
    const current = jobs.get(jobId);
    if (!current) return;
    const dir = jobDir(userContext.userId, jobId);
    await fs.mkdir(dir, { recursive: true });
    const zipPath = path.join(dir, 'archive.zip');
    touch(current, { status: 'exporting' });

    const exported = await exportMemoryBackupToFile(
      userContext,
      zipPath,
      {
        includeDerived: options.includeDerived,
        includeVectors: options.includeVectors,
      },
      (stage, bytesWritten) => {
        const live = jobs.get(jobId);
        if (!live) return;
        touch(live, {
          status: stage === 'ready' ? 'packaging' : stage,
          bytesWritten,
        });
      },
    );

    let finalPath = zipPath;
    let fileName = exported.fileName;
    let archiveSha256 = exported.archiveSha256;
    let sizeBytes = exported.sizeBytes;

    if (options.encrypt) {
      if (!options.passphrase) {
        throw new Error('encrypt=true requires a passphrase');
      }
      const live = jobs.get(jobId);
      if (live) touch(live, { status: 'encrypting' });
      const encPath = path.join(dir, 'archive.zip.enc');
      await encryptBackupFile(zipPath, encPath, options.passphrase);
      await fs.rm(zipPath, { force: true });
      finalPath = encPath;
      fileName = `${exported.fileName}.enc`;
      archiveSha256 = await sha256File(encPath);
      sizeBytes = (await fs.stat(encPath)).size;
    }

    const live = jobs.get(jobId);
    if (!live) {
      await fs.rm(dir, { recursive: true, force: true });
      return;
    }
    touch(live, {
      status: 'ready',
      fileName,
      filePath: finalPath,
      sizeBytes,
      bytesWritten: sizeBytes,
      archiveSha256,
      manifest: exported.manifest,
      encrypted: Boolean(options.encrypt),
    });
  });
}

export function getExportJob(
  userId: string,
  jobId: string,
): Omit<ExportJob, 'filePath'> | null {
  const job = jobs.get(jobId);
  if (!job || job.userId !== userId) return null;
  return publicJob(job);
}

export function getExportJobRecord(userId: string, jobId: string): ExportJob | null {
  const job = jobs.get(jobId);
  if (!job || job.userId !== userId) return null;
  return job;
}

export function openExportJobDownload(
  userId: string,
  jobId: string,
): {
  stream: ReturnType<typeof createReadStream>;
  job: ExportJob;
} {
  const job = getExportJobRecord(userId, jobId);
  if (!job) {
    const error = new Error('Export job not found');
    (error as Error & { statusCode?: number }).statusCode = 404;
    throw error;
  }
  if (job.status !== 'ready' || !job.filePath) {
    const error = new Error(
      job.status === 'failed'
        ? `Export job failed: ${job.error || 'unknown error'}`
        : 'Export job is not ready',
    );
    (error as Error & { statusCode?: number }).statusCode = 409;
    throw error;
  }
  return {
    stream: createReadStream(job.filePath),
    job,
  };
}

export async function sweepExpiredExportJobs(now = Date.now()): Promise<number> {
  let removed = 0;
  for (const job of [...jobs.values()]) {
    if (new Date(job.expiresAt).getTime() > now) continue;
    jobs.delete(job.id);
    await removeJobFiles(job);
    removed += 1;
  }
  return removed;
}

export function resetExportJobsForTests(): void {
  jobs.clear();
}

export { ExportLockBusyError };
