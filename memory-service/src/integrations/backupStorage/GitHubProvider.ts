/**
 * GitHub storage provider for the Markdown Git Mirror (plan §4.3).
 *
 * Unlike the object-store providers (webdav / s3), the mirror pushes a *tree*
 * of files as one commit using the Git Data API:
 *
 *   create blobs → create tree (base_tree) → create commit → update ref
 *
 * Guarantees (plan §4.3, §4.7):
 *   - one commit per night, not N requests
 *   - content-hash increment: unchanged files are never re-uploaded
 *   - post-commit verification: read the ref back and compare
 *   - never force-push; a non-fast-forward update fails the run
 *   - remote hand-edits are preserved and copied to conflict-<date>/
 */

import { createReadStream } from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';

import type {
  BackupObjectInfo,
  BackupPutInput,
  BackupStorageProvider,
} from './types.js';

export type GitHubPushEncoding = 'utf-8' | 'base64';

export interface MirrorPushFile {
  path: string;
  content: string;
  hash: string;
  encoding?: GitHubPushEncoding;
}

export interface MirrorManifestLike {
  contentHash: string;
  remoteSha: string | null;
  lastCommitSha: string | null;
}

export interface MirrorConflictFile {
  path: string;
  remoteContent: string;
  localContent?: string;
}

export interface MirrorPushResult {
  status: 'success' | 'skipped';
  commitSha: string | null;
  commitUrl: string | null;
  changedPaths: string[];
  deletedPaths: string[];
  conflictPaths: string[];
  remoteShas: Map<string, string>;
  commitDate: string;
}

export interface GitHubProviderOptions {
  repo: string;
  branch: string;
  token: string;
  apiBaseUrl?: string;
  conflictPrefix?: string;
  authorName?: string;
  authorEmail?: string;
  fetchImpl?: typeof fetch;
}

interface GitHubBlobResponse {
  sha: string;
}

interface GitHubTreeEntry {
  path: string;
  mode: string;
  type: 'blob' | 'tree' | 'commit';
  sha: string;
  size?: number;
}

function parseRepo(repo: string): string {
  const trimmed = repo.trim().replace(/\.git$/, '').replace(/\/+$/, '');
  const match = trimmed.match(
    /^(?:https?:\/\/github\.com\/|git@github\.com:)?([^/\s]+)\/([^/\s]+)$/,
  );
  if (!match) {
    throw new Error(`Invalid GitHub repository: ${repo} (expected owner/name)`);
  }
  return `${match[1]}/${match[2]}`;
}

function base64OfUtf8(text: string): string {
  return Buffer.from(text, 'utf-8').toString('base64');
}

export class GitHubProvider implements BackupStorageProvider {
  readonly kind = 'github' as const;
  readonly repo: string;
  readonly branch: string;

  private readonly apiBaseUrl: string;
  private readonly token: string;
  private readonly fetchImpl: typeof fetch;
  private readonly conflictPrefix: string;
  private readonly authorName?: string;
  private readonly authorEmail?: string;

  constructor(options: GitHubProviderOptions) {
    if (!options.token || !options.token.trim()) {
      throw new Error('GitHub token is required');
    }
    this.repo = parseRepo(options.repo || '');
    this.branch = (options.branch || 'main').trim() || 'main';
    this.token = options.token.trim();
    this.apiBaseUrl = (options.apiBaseUrl || 'https://api.github.com').replace(
      /\/+$/,
      '',
    );
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.conflictPrefix = options.conflictPrefix || 'conflict';
    this.authorName = options.authorName;
    this.authorEmail = options.authorEmail;
  }

  // ---------------------------------------------------------------------
  // low-level Git Data API
  // ---------------------------------------------------------------------

  private async request<T>(
    method: string,
    urlPath: string,
    body?: unknown,
    allow404 = false,
  ): Promise<T | null> {
    const response = await this.fetchImpl(`${this.apiBaseUrl}${urlPath}`, {
      method,
      headers: {
        Authorization: `Bearer ${this.token}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'User-Agent': 'personal-ai-memory-mirror',
        ...(body ? { 'Content-Type': 'application/json' } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    if (allow404 && response.status === 404) return null;
    if (!response.ok) {
      const text = await response.text().catch(() => '');
      throw new Error(
        `GitHub ${method} ${urlPath} failed (${response.status}): ${text.slice(0, 300)}`,
      );
    }
    if (response.status === 204) return null;
    return (await response.json()) as T;
  }

  async getRefSha(): Promise<string | null> {
    const data = await this.request<{ object: { sha: string } }>(
      'GET',
      `/repos/${this.repo}/git/ref/heads/${encodeURIComponent(this.branch)}`,
      undefined,
      true,
    );
    return data?.object?.sha ?? null;
  }

  private async getCommit(sha: string): Promise<{ treeSha: string; parents: string[] }> {
    const data = await this.request<{
      tree: { sha: string };
      parents: Array<{ sha: string }>;
    }>('GET', `/repos/${this.repo}/git/commits/${sha}`);
    if (!data) throw new Error(`GitHub commit ${sha} not found`);
    return {
      treeSha: data.tree.sha,
      parents: (data.parents ?? []).map((parent) => parent.sha),
    };
  }

  private async getTreeRecursive(treeSha: string): Promise<Map<string, GitHubTreeEntry>> {
    const data = await this.request<{ tree: GitHubTreeEntry[]; truncated?: boolean }>(
      'GET',
      `/repos/${this.repo}/git/trees/${treeSha}?recursive=1`,
    );
    const map = new Map<string, GitHubTreeEntry>();
    for (const entry of data?.tree ?? []) {
      if (entry.type === 'blob') map.set(entry.path, entry);
    }
    return map;
  }

  private async createBlob(content: string, encoding: GitHubPushEncoding): Promise<string> {
    const data = await this.request<GitHubBlobResponse>(
      'POST',
      `/repos/${this.repo}/git/blobs`,
      { content, encoding: encoding === 'base64' ? 'base64' : 'utf-8' },
    );
    if (!data?.sha) throw new Error('GitHub blob creation returned no sha');
    return data.sha;
  }

  private async getBlobContent(sha: string): Promise<string> {
    const data = await this.request<{ content: string; encoding: string }>(
      'GET',
      `/repos/${this.repo}/git/blobs/${sha}`,
    );
    if (!data) throw new Error(`GitHub blob ${sha} not found`);
    return data.encoding === 'base64'
      ? Buffer.from(data.content, 'base64').toString('utf-8')
      : data.content;
  }

  private async createTree(
    baseTreeSha: string | null,
    entries: Array<Record<string, unknown>>,
  ): Promise<string> {
    const data = await this.request<{ sha: string }>(
      'POST',
      `/repos/${this.repo}/git/trees`,
      { ...(baseTreeSha ? { base_tree: baseTreeSha } : {}), tree: entries },
    );
    if (!data?.sha) throw new Error('GitHub tree creation returned no sha');
    return data.sha;
  }

  private async createCommit(
    message: string,
    treeSha: string,
    parents: string[],
  ): Promise<{ sha: string; htmlUrl: string | null; date: string }> {
    const data = await this.request<{
      sha: string;
      html_url?: string;
      committer?: { date?: string };
    }>('POST', `/repos/${this.repo}/git/commits`, {
      message,
      tree: treeSha,
      parents,
      ...(this.authorName && this.authorEmail
        ? { author: { name: this.authorName, email: this.authorEmail } }
        : {}),
    });
    if (!data?.sha) throw new Error('GitHub commit creation returned no sha');
    return {
      sha: data.sha,
      htmlUrl: data.html_url ?? null,
      date: data.committer?.date ?? new Date().toISOString(),
    };
  }

  private async updateRef(sha: string): Promise<void> {
    // force=false: a moved ref rejects the update rather than clobbering it.
    await this.request(
      'PATCH',
      `/repos/${this.repo}/git/refs/heads/${encodeURIComponent(this.branch)}`,
      { sha, force: false },
    );
  }

  // ---------------------------------------------------------------------
  // tree push
  // ---------------------------------------------------------------------

  /**
   * Push a set of files as a single commit with hash-based increment and
   * conflict preservation.
   */
  async putTree(
    files: MirrorPushFile[],
    message: string,
    options: {
      manifest?: Map<string, MirrorManifestLike>;
      now?: Date;
      allowDeletions?: boolean;
    } = {},
  ): Promise<MirrorPushResult> {
    const manifest = options.manifest ?? new Map<string, MirrorManifestLike>();
    const now = options.now ?? new Date();
    const allowDeletions = options.allowDeletions !== false;

    const refSha = await this.getRefSha();
    const emptyRepo = refSha === null;
    const parentCommit = emptyRepo ? null : await this.getCommit(refSha!);
    const remoteTree = parentCommit
      ? await this.getTreeRecursive(parentCommit.treeSha)
      : new Map<string, GitHubTreeEntry>();

    const localByPath = new Map(files.map((file) => [file.path, file]));
    const changed: MirrorPushFile[] = [];
    const conflictPaths: string[] = [];
    const conflictFiles: MirrorConflictFile[] = [];
    const remoteShas = new Map<string, string>();
    const deletedPaths: string[] = [];

    // Detect remote hand-edits and determine which files actually changed.
    for (const file of files) {
      const entry = manifest.get(file.path);
      const remote = remoteTree.get(file.path);
      if (entry && remote && entry.remoteSha && remote.sha !== entry.remoteSha) {
        // User edited this path on GitHub. Preserve it and record a conflict.
        conflictPaths.push(file.path);
        conflictFiles.push({
          path: file.path,
          remoteContent: await this.getBlobContent(remote.sha),
          localContent: file.encoding && file.encoding !== 'utf-8' ? undefined : file.content,
        });
        remoteShas.set(file.path, remote.sha);
        continue;
      }
      if (entry && entry.contentHash === file.hash && remote) {
        remoteShas.set(file.path, remote.sha);
        continue; // unchanged — never re-upload
      }
      if (entry && entry.contentHash === file.hash && !remote) {
        // recorded but missing remotely (deleted by user) → re-create
      }
      changed.push(file);
    }

    // Deletions: only remove paths we recorded and that the user has not edited.
    if (allowDeletions) {
      for (const [pathKey, entry] of manifest) {
        if (localByPath.has(pathKey)) continue;
        const remote = remoteTree.get(pathKey);
        if (!remote) continue;
        if (entry.remoteSha && remote.sha !== entry.remoteSha) {
          // user edited a file we no longer track → preserve, record conflict
          conflictPaths.push(pathKey);
          conflictFiles.push({
            path: pathKey,
            remoteContent: await this.getBlobContent(remote.sha),
          });
          continue;
        }
        deletedPaths.push(pathKey);
      }
    }

    // Materialize conflict copies under conflict-<date>/.
    const conflictEntries: Array<Record<string, unknown>> = [];
    const conflictDate = now.toISOString().slice(0, 10);
    for (const conflict of conflictFiles) {
      const remotePath = `${this.conflictPrefix}-${conflictDate}/${conflict.path}`;
      const remoteBlob = await this.createBlob(conflict.remoteContent, 'utf-8');
      conflictEntries.push({ path: remotePath, mode: '100644', type: 'blob', sha: remoteBlob });
      remoteShas.set(remotePath, remoteBlob);
      if (conflict.localContent !== undefined) {
        const localPath = `${remotePath}.local`;
        const localBlob = await this.createBlob(conflict.localContent, 'utf-8');
        conflictEntries.push({ path: localPath, mode: '100644', type: 'blob', sha: localBlob });
        remoteShas.set(localPath, localBlob);
      }
    }

    const treeEntries: Array<Record<string, unknown>> = [...conflictEntries];
    for (const file of changed) {
      const sha = await this.createBlob(file.content, file.encoding ?? 'utf-8');
      treeEntries.push({
        path: file.path,
        mode: '100644',
        type: 'blob',
        sha,
      });
      remoteShas.set(file.path, sha);
    }
    for (const deleted of deletedPaths) {
      treeEntries.push({ path: deleted, mode: '100644', type: 'blob', sha: null });
    }

    if (treeEntries.length === 0) {
      return {
        status: 'skipped',
        commitSha: parentCommit ? refSha : null,
        commitUrl: null,
        changedPaths: [],
        deletedPaths: [],
        conflictPaths,
        remoteShas,
        commitDate: now.toISOString(),
      };
    }

    const treeSha = await this.createTree(
      parentCommit?.treeSha ?? null,
      treeEntries,
    );
    const commit = await this.createCommit(
      message,
      treeSha,
      parentCommit ? [refSha!] : [],
    );
    await this.updateRef(commit.sha);

    // Verification: read the ref back. A mismatch fails the run.
    const verified = await this.getRefSha();
    if (verified !== commit.sha) {
      throw new Error(
        `GitHub mirror verification failed: ref=${verified}, expected=${commit.sha}`,
      );
    }

    return {
      status: 'success',
      commitSha: commit.sha,
      commitUrl: commit.htmlUrl,
      changedPaths: changed.map((file) => file.path),
      deletedPaths,
      conflictPaths,
      remoteShas,
      commitDate: commit.date,
    };
  }

  // ---------------------------------------------------------------------
  // BackupStorageProvider (object) surface
  // ---------------------------------------------------------------------

  async put(input: BackupPutInput): Promise<void> {
    const content = await fs.readFile(input.filePath);
    const existing = await this.contentsGet(input.key);
    await this.request('PUT', `/repos/${this.repo}/contents/${input.key}`, {
      message: `backup ${path.basename(input.key)}`,
      content: content.toString('base64'),
      branch: this.branch,
      ...(existing?.sha ? { sha: existing.sha } : {}),
    });
  }

  private async contentsGet(
    key: string,
  ): Promise<{ sha: string; size: number } | null> {
    const data = await this.request<{ sha?: string; size?: number }>(
      'GET',
      `/repos/${this.repo}/contents/${key}?ref=${encodeURIComponent(this.branch)}`,
      undefined,
      true,
    );
    if (!data?.sha) return null;
    return { sha: data.sha, size: Number(data.size ?? 0) };
  }

  async head(key: string): Promise<BackupObjectInfo> {
    const data = await this.contentsGet(key);
    if (!data) throw new Error(`GitHub object not found: ${key}`);
    return { key, sizeBytes: data.size, lastModified: undefined };
  }

  async list(prefix: string): Promise<BackupObjectInfo[]> {
    const dir = prefix.replace(/\/+$/, '');
    const data = await this.request<Array<{ name: string; size: number; type: string }>>(
      'GET',
      `/repos/${this.repo}/contents/${dir}?ref=${encodeURIComponent(this.branch)}`,
      undefined,
      true,
    );
    if (!Array.isArray(data)) return [];
    return data
      .filter((item) => item.type === 'file')
      .map((item) => ({
        key: `${dir}/${item.name}`,
        sizeBytes: Number(item.size ?? 0),
        lastModified: undefined,
      }));
  }

  async delete(key: string): Promise<void> {
    const existing = await this.contentsGet(key);
    if (!existing) return;
    await this.request('DELETE', `/repos/${this.repo}/contents/${key}`, {
      message: `delete ${path.basename(key)}`,
      sha: existing.sha,
      branch: this.branch,
    });
  }

  async test(): Promise<{ ok: true; detail: string }> {
    const response = await this.fetchImpl(`${this.apiBaseUrl}/repos/${this.repo}`, {
      headers: {
        Authorization: `Bearer ${this.token}`,
        Accept: 'application/vnd.github+json',
        'User-Agent': 'personal-ai-memory-mirror',
      },
    });
    if (response.status === 401) {
      throw new Error('GitHub token 无效或已过期');
    }
    if (response.status === 403) {
      throw new Error('GitHub token 权限不足（需要 Contents: Read and write）');
    }
    if (response.status === 404) {
      throw new Error('GitHub 仓库不存在或 token 无权访问');
    }
    if (!response.ok) {
      throw new Error(`GitHub 连接失败 (${response.status})`);
    }
    const refSha = await this.getRefSha();
    return {
      ok: true,
      detail: refSha
        ? `连接正常，${this.branch} 当前 ${refSha.slice(0, 7)}`
        : `连接正常，${this.branch} 为空仓库（首次推送将创建初始 commit）`,
    };
  }
}
