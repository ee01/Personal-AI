/**
 * Markdown Git Mirror runner (plan §4.1/§4.3/§4.4).
 *
 * Nightly flow:
 *   1. render the deterministic projection (Phase 0)
 *   2. egress-filter per file (Phase 2) — done inside the renderer
 *   3. optionally package + encrypt the whole projection (Phase 2)
 *   4. push one commit with hash-based increment (Phase 1)
 *   5. verify, record the manifest, write the run receipt
 */

import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { createWriteStream } from 'node:fs';

import yazl from 'yazl';

import type { ResolvedGithubMirrorConfig } from './AutoBackupService.js';
import type { UserContext } from './UserContextManager.js';
import { encryptBackupFile } from './backup/backupCrypto.js';
import { appendBackupHistory } from './backup/backupState.js';
import { withUserExportLock } from './backup/exportLock.js';
import {
  GitHubProvider,
  type GitHubProviderOptions,
  type MirrorPushResult,
} from '../integrations/backupStorage/GitHubProvider.js';
import { MirrorManifestStore } from './mirror/MirrorManifestStore.js';
import {
  renderMirrorProjection,
  type MirrorFile,
  type MirrorRenderResult,
  type MirrorScope,
} from './mirror/MirrorProjectionService.js';

export interface MirrorPusher {
  putTree(
    files: Array<{ path: string; content: string; hash: string; encoding?: 'utf-8' | 'base64' }>,
    message: string,
    options?: {
      manifest?: Map<string, { contentHash: string; remoteSha: string | null; lastCommitSha: string | null }>;
      now?: Date;
      allowDeletions?: boolean;
    },
  ): Promise<MirrorPushResult>;
}

export interface MirrorRunResult {
  status: 'success' | 'failed' | 'skipped';
  filesTotal: number;
  filesChanged: number;
  excludedByPolicy: number;
  commitSha?: string;
  commitUrl?: string | null;
  conflictPaths: string[];
  error?: string;
  durationMs: number;
}

export interface MirrorPreview {
  files: Array<{ path: string; bytes: number; hash: string }>;
  receipt: MirrorRenderResult['receipt'];
}

const ENCRYPTED_MIRROR_FILE = 'mirror/personal-ai-mirror.zip.enc';

function prefixed(files: MirrorFile[], prefix: string): MirrorFile[] {
  if (!prefix) return files;
  const normalized = prefix.replace(/\/+$/, '');
  return files.map((file) => ({
    ...file,
    path: `${normalized}/${file.path}`,
  }));
}

/**
 * Write the projection to the local mirror directory (Phase 0 deliverable).
 * Returns the directory path.
 */
export async function writeMirrorProjectionToDisk(
  userContext: UserContext,
  result: MirrorRenderResult,
): Promise<string> {
  const root = path.join(userContext.userDataManager.rootDir, 'mirror');
  await fs.rm(root, { recursive: true, force: true });
  for (const file of result.files) {
    const target = path.join(root, file.path);
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, file.content, 'utf-8');
  }
  return root;
}

export function previewMirror(
  db: Parameters<typeof renderMirrorProjection>[0],
  userId: string,
  options: { scope?: MirrorScope; prefix?: string; now?: Date } = {},
): MirrorPreview {
  const result = renderMirrorProjection(db, userId, {
    scope: options.scope,
    now: options.now,
  });
  const files = prefixed(result.files, options.prefix || '');
  return {
    files: files.map((file) => ({
      path: file.path,
      bytes: Buffer.byteLength(file.content, 'utf-8'),
      hash: file.hash,
    })),
    receipt: result.receipt,
  };
}

async function zipDirectory(dir: string, zipPath: string): Promise<void> {
  const zip = new yazl.ZipFile();
  const addDir = async (current: string, relative: string): Promise<void> => {
    for (const entry of await fs.readdir(current, { withFileTypes: true })) {
      const full = path.join(current, entry.name);
      const rel = relative ? `${relative}/${entry.name}` : entry.name;
      if (entry.isDirectory()) {
        await addDir(full, rel);
      } else if (entry.isFile()) {
        zip.addFile(full, rel);
      }
    }
  };
  await addDir(dir, '');
  await new Promise<void>((resolve, reject) => {
    zip.outputStream
      .pipe(createWriteStream(zipPath))
      .on('close', () => resolve())
      .on('error', reject);
    zip.end();
  });
}

async function buildEncryptedPayload(
  tempDir: string,
  projectionDir: string,
  passphrase: string,
): Promise<{ file: MirrorFile; sizeBytes: number }> {
  if (!passphrase) {
    throw new Error('GitHub 镜像已选择加密包模式，但未配置加密口令');
  }
  const zipPath = path.join(tempDir, 'mirror.zip');
  const encPath = path.join(tempDir, 'mirror.zip.enc');
  await zipDirectory(projectionDir, zipPath);
  await encryptBackupFile(zipPath, encPath, passphrase);
  const buffer = await fs.readFile(encPath);
  const base64 = buffer.toString('base64');
  return {
    file: {
      path: ENCRYPTED_MIRROR_FILE,
      content: base64,
      hash: createHash('sha256').update(buffer).digest('hex'),
      encoding: 'base64',
    },
    sizeBytes: buffer.byteLength,
  };
}

export function createGitHubMirrorProvider(
  config: ResolvedGithubMirrorConfig,
  overrides: Partial<GitHubProviderOptions> = {},
): GitHubProvider {
  return new GitHubProvider({
    repo: config.repo,
    branch: config.branch,
    token: config.token,
    ...overrides,
  });
}

export async function runMirrorOnce(
  userContext: UserContext,
  github: ResolvedGithubMirrorConfig,
  options: {
    trigger?: 'scheduled' | 'manual';
    pusher?: MirrorPusher;
    now?: Date;
    writeLocal?: boolean;
  } = {},
): Promise<MirrorRunResult> {
  const started = Date.now();
  const scope: MirrorScope = github.scope === 'self_only' ? 'self_only' : 'all';
  const now = options.now ?? new Date();
  const manifestStore = new MirrorManifestStore(userContext.db, userContext.userId);
  const runId = manifestStore.startRun({
    mode: github.mode,
    scope,
    trigger: options.trigger ?? 'scheduled',
  });

  const finish = (
    result: MirrorRunResult,
    extra: { conflictPaths?: string[]; filesChanged?: number; commitSha?: string | null } = {},
  ): MirrorRunResult => {
    if (runId) {
      manifestStore.finishRun(runId, {
        status: result.status,
        filesTotal: result.filesTotal,
        filesChanged: extra.filesChanged ?? result.filesChanged,
        excludedByPolicy: result.excludedByPolicy,
        conflictPaths: extra.conflictPaths ?? result.conflictPaths,
        commitSha: extra.commitSha ?? result.commitSha ?? null,
        commitUrl: result.commitUrl ?? null,
        error: result.error ?? null,
      });
    }
    return result;
  };

  if (!github.repo || !github.token) {
    return finish({
      status: 'skipped',
      filesTotal: 0,
      filesChanged: 0,
      excludedByPolicy: 0,
      conflictPaths: [],
      error: 'GitHub 镜像未配置仓库或 token',
      durationMs: Date.now() - started,
    });
  }

  return withUserExportLock(userContext.userId, async () => {
    let tempDir: string | null = null;
    try {
      const projection = renderMirrorProjection(userContext.db, userContext.userId, {
        scope,
        now,
      });

      if (options.writeLocal !== false) {
        await writeMirrorProjectionToDisk(userContext, projection);
      }

      const pusher =
        options.pusher ??
        createGitHubMirrorProvider(github, {
          authorName: 'Personal AI',
          authorEmail: 'memory-mirror@personal-ai.local',
        });

      let files: Array<{ path: string; content: string; hash: string; encoding?: 'utf-8' | 'base64' }>;
      let sizeBytes = projection.files.reduce(
        (sum, file) => sum + Buffer.byteLength(file.content, 'utf-8'),
        0,
      );

      if (github.mode === 'encrypted') {
        tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'pai-mirror-'));
        const projectionDir = path.join(
          userContext.userDataManager.rootDir,
          'mirror',
        );
        const payload = await buildEncryptedPayload(
          tempDir,
          projectionDir,
          github.passphrase,
        );
        files = [payload.file];
        sizeBytes = payload.sizeBytes;
      } else {
        files = prefixed(projection.files, github.prefix).map((file) => ({
          path: file.path,
          content: file.content,
          hash: file.hash,
        }));
      }

      const manifest = new Map(
        [...manifestStore.load()].map(([key, entry]) => [key, entry]),
      );
      const push = await pusher.putTree(files, projection.receipt.commitMessage, {
        manifest,
        now,
      });

      if (push.status === 'success' && push.commitSha) {
        manifestStore.applyCommit(
          files.filter((file) => push.changedPaths.includes(file.path)),
          push.commitSha,
          push.remoteShas,
        );
        // Keep the recorded remote state for conflict paths we preserved.
        for (const conflictPath of push.conflictPaths) {
          manifestStore.markRemoteState(
            conflictPath,
            push.remoteShas.get(conflictPath) ?? null,
            push.commitSha,
          );
        }
        if (push.deletedPaths.length > 0) {
          manifestStore.removePaths(push.deletedPaths);
        }
      }

      const durationMs = Date.now() - started;
      await appendBackupHistory(userContext.userDataManager.rootDir, {
        at: new Date().toISOString(),
        channel: 'github_mirror',
        status: 'success',
        durationMs,
        sizeBytes,
        objectKey: push.commitSha ?? undefined,
        trigger: options.trigger ?? 'scheduled',
      });

      return finish(
        {
          status: push.status === 'skipped' ? 'skipped' : 'success',
          filesTotal: projection.files.length,
          filesChanged: push.changedPaths.length,
          excludedByPolicy: projection.receipt.excludedByPolicy,
          commitSha: push.commitSha ?? undefined,
          commitUrl: push.commitUrl,
          conflictPaths: push.conflictPaths,
          durationMs,
        },
        { conflictPaths: push.conflictPaths, commitSha: push.commitSha },
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const durationMs = Date.now() - started;
      await appendBackupHistory(userContext.userDataManager.rootDir, {
        at: new Date().toISOString(),
        channel: 'github_mirror',
        status: 'failed',
        durationMs,
        error: message,
        trigger: options.trigger ?? 'scheduled',
      });
      return finish({
        status: 'failed',
        filesTotal: 0,
        filesChanged: 0,
        excludedByPolicy: 0,
        conflictPaths: [],
        error: message,
        durationMs,
      });
    } finally {
      if (tempDir) await fs.rm(tempDir, { recursive: true, force: true });
    }
  });
}
