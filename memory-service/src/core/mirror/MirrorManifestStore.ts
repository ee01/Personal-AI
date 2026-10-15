/**
 * Incremental manifest for the Markdown Git Mirror (plan §5).
 *
 * Records the last pushed content hash + remote blob sha per path so the next
 * nightly run can skip unchanged files and detect remote hand-edits without
 * ever force-pushing.
 */

import { randomUUID } from 'node:crypto';
import type BetterSqlite3 from 'better-sqlite3';

import type { MirrorFile, MirrorScope } from './MirrorProjectionService.js';

export interface MirrorManifestEntry {
  path: string;
  contentHash: string;
  remoteSha: string | null;
  lastCommitSha: string | null;
  updatedAt: number;
}

export interface MirrorRunRecord {
  id: string;
  status: 'running' | 'success' | 'failed' | 'skipped';
  mode: 'markdown' | 'encrypted';
  scope: MirrorScope;
  filesTotal: number;
  filesChanged: number;
  bytesTotal: number;
  excludedByPolicy: number;
  conflictPaths: string[];
  commitSha: string | null;
  commitUrl: string | null;
  error: string | null;
  startedAt: number;
  finishedAt: number | null;
  trigger: 'scheduled' | 'manual';
}

export class MirrorManifestStore {
  constructor(
    private readonly db: BetterSqlite3.Database,
    private readonly userId: string,
  ) {}

  private ensureTable(): boolean {
    try {
      this.db
        .prepare(`SELECT 1 AS ok FROM mirror_manifest LIMIT 1`)
        .get();
      return true;
    } catch {
      return false;
    }
  }

  load(): Map<string, MirrorManifestEntry> {
    if (!this.ensureTable()) return new Map();
    const rows = this.db
      .prepare(
        `SELECT path, content_hash, remote_sha, last_commit_sha, updated_at
           FROM mirror_manifest WHERE owner_user_id=?`,
      )
      .all(this.userId) as Array<{
      path: string;
      content_hash: string;
      remote_sha: string | null;
      last_commit_sha: string | null;
      updated_at: number;
    }>;
    const map = new Map<string, MirrorManifestEntry>();
    for (const row of rows) {
      map.set(row.path, {
        path: row.path,
        contentHash: row.content_hash,
        remoteSha: row.remote_sha,
        lastCommitSha: row.last_commit_sha,
        updatedAt: row.updated_at,
      });
    }
    return map;
  }

  lastCommitSha(): string | null {
    const entry = [...this.load().values()].sort(
      (a, b) => b.updatedAt - a.updatedAt,
    )[0];
    return entry?.lastCommitSha ?? null;
  }

  /**
   * Persist the post-commit state for the given files. `remoteShas` maps path
   * to the blob sha GitHub returned for it.
   */
  applyCommit(
    files: MirrorFile[],
    commitSha: string,
    remoteShas: Map<string, string>,
    now = Math.floor(Date.now() / 1000),
  ): void {
    if (!this.ensureTable()) return;
    const upsert = this.db.prepare(
      `INSERT INTO mirror_manifest
         (owner_user_id, path, content_hash, remote_sha, last_commit_sha, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(owner_user_id, path) DO UPDATE SET
         content_hash=excluded.content_hash,
         remote_sha=excluded.remote_sha,
         last_commit_sha=excluded.last_commit_sha,
         updated_at=excluded.updated_at`,
    );
    const tx = this.db.transaction(() => {
      for (const file of files) {
        upsert.run(
          this.userId,
          file.path,
          file.hash,
          remoteShas.get(file.path) ?? null,
          commitSha,
          now,
        );
      }
    });
    tx();
  }

  /** Update the recorded remote sha for a path we deliberately did not overwrite. */
  markRemoteState(
    path: string,
    remoteSha: string | null,
    commitSha: string | null,
    now = Math.floor(Date.now() / 1000),
  ): void {
    if (!this.ensureTable()) return;
    const existing = this.db
      .prepare(
        `SELECT content_hash FROM mirror_manifest WHERE owner_user_id=? AND path=?`,
      )
      .get(this.userId, path) as { content_hash: string } | undefined;
    if (!existing) return;
    this.db
      .prepare(
        `UPDATE mirror_manifest SET remote_sha=?, last_commit_sha=?, updated_at=?
          WHERE owner_user_id=? AND path=?`,
      )
      .run(remoteSha, commitSha, now, this.userId, path);
  }

  removePaths(paths: string[]): void {
    if (!this.ensureTable() || paths.length === 0) return;
    const del = this.db.prepare(
      `DELETE FROM mirror_manifest WHERE owner_user_id=? AND path=?`,
    );
    const tx = this.db.transaction(() => {
      for (const path of paths) del.run(this.userId, path);
    });
    tx();
  }

  // -- run receipts -------------------------------------------------------

  startRun(input: {
    mode: 'markdown' | 'encrypted';
    scope: MirrorScope;
    trigger: 'scheduled' | 'manual';
  }): string | null {
    try {
      const id = randomUUID();
      this.db
        .prepare(
          `INSERT INTO mirror_runs
             (id, owner_user_id, started_at, status, mode, scope, trigger)
           VALUES (?, ?, ?, 'running', ?, ?, ?)`,
        )
        .run(
          id,
          this.userId,
          Math.floor(Date.now() / 1000),
          input.mode,
          input.scope,
          input.trigger,
        );
      return id;
    } catch {
      return null;
    }
  }

  finishRun(
    id: string,
    patch: Partial<
      Pick<
        MirrorRunRecord,
        | 'status'
        | 'filesTotal'
        | 'filesChanged'
        | 'bytesTotal'
        | 'excludedByPolicy'
        | 'conflictPaths'
        | 'commitSha'
        | 'commitUrl'
        | 'error'
      >
    >,
  ): void {
    try {
      this.db
        .prepare(
          `UPDATE mirror_runs SET
             finished_at=?,
             status=coalesce(?, status),
             files_total=coalesce(?, files_total),
             files_changed=coalesce(?, files_changed),
             bytes_total=coalesce(?, bytes_total),
             excluded_by_policy=coalesce(?, excluded_by_policy),
             conflict_paths_json=coalesce(?, conflict_paths_json),
             commit_sha=coalesce(?, commit_sha),
             commit_url=coalesce(?, commit_url),
             error=coalesce(?, error)
           WHERE id=?`,
        )
        .run(
          Math.floor(Date.now() / 1000),
          patch.status ?? null,
          patch.filesTotal ?? null,
          patch.filesChanged ?? null,
          patch.bytesTotal ?? null,
          patch.excludedByPolicy ?? null,
          patch.conflictPaths ? JSON.stringify(patch.conflictPaths) : null,
          patch.commitSha ?? null,
          patch.commitUrl ?? null,
          patch.error ?? null,
          id,
        );
    } catch {
      // run receipts are best-effort
    }
  }

  lastRun(): MirrorRunRecord | null {
    try {
      const row = this.db
        .prepare(
          `SELECT * FROM mirror_runs WHERE owner_user_id=?
            ORDER BY started_at DESC LIMIT 1`,
        )
        .get(this.userId) as Record<string, unknown> | undefined;
      if (!row) return null;
      return {
        id: String(row.id),
        status: row.status as MirrorRunRecord['status'],
        mode: row.mode as MirrorRunRecord['mode'],
        scope: row.scope as MirrorRunRecord['scope'],
        filesTotal: Number(row.files_total ?? 0),
        filesChanged: Number(row.files_changed ?? 0),
        bytesTotal: Number(row.bytes_total ?? 0),
        excludedByPolicy: Number(row.excluded_by_policy ?? 0),
        conflictPaths: parseStringArray(row.conflict_paths_json),
        commitSha: (row.commit_sha as string | null) ?? null,
        commitUrl: (row.commit_url as string | null) ?? null,
        error: (row.error as string | null) ?? null,
        startedAt: Number(row.started_at ?? 0),
        finishedAt: row.finished_at ? Number(row.finished_at) : null,
        trigger: row.trigger as MirrorRunRecord['trigger'],
      };
    } catch {
      return null;
    }
  }
}

function parseStringArray(raw: unknown): string[] {
  if (typeof raw !== 'string') return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === 'string')
      : [];
  } catch {
    return [];
  }
}
