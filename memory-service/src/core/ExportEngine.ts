/**
 * ExportEngine — Export engine for packaging memory data.
 *
 * Provides facilities to list exportable files, export database
 * contents as structured JSON, and produce a high-level manifest
 * of the data store.
 *
 * Phase 5 — Data Export & Portability.
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import type Database from 'better-sqlite3';

import { now, formatDateTime } from '../utils/time.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ExportOptions {
  format: 'markdown_zip' | 'json';
  scope: 'all' | 'project' | 'time_range';
  projectId?: string;
  timeRange?: { start: number; end: number };
}

export interface ExportResult {
  files: ExportFileEntry[];
  totalFiles: number;
  totalSizeBytes: number;
}

export interface ExportFileEntry {
  path: string;
  sizeBytes: number;
  lastModified: number;
}

// ---------------------------------------------------------------------------
// ExportEngine
// ---------------------------------------------------------------------------

export class ExportEngine {
  private db: Database.Database;
  private dataDir: string;

  constructor(db: Database.Database, dataDir: string) {
    this.db = db;
    this.dataDir = dataDir;
  }

  /**
   * Walk the data directory and return a filtered list of exportable files.
   *
   * Filtering by scope:
   *   - 'all': include all markdown files.
   *   - 'project': only files in projects/{projectId}* and chunks
   *     whose related_project matches.
   *   - 'time_range': only files whose mtime falls within the range.
   */
  async listExportFiles(options: ExportOptions): Promise<ExportResult> {
    const allFiles = await this.walkFiles(this.dataDir);
    const entries: ExportFileEntry[] = [];

    for (const absPath of allFiles) {
      try {
        const stat = await fs.stat(absPath);
        const relPath = path.relative(this.dataDir, absPath);
        const mtimeSec = Math.floor(stat.mtimeMs / 1000);

        let include = false;

        switch (options.scope) {
          case 'all':
            include = true;
            break;

          case 'project': {
            if (!options.projectId) break;
            const normalized = relPath.replace(/\\/g, '/');
            // Match project files and any chunk files referencing this project
            include =
              normalized.startsWith(`projects/${options.projectId}`) ||
              normalized.includes(options.projectId);
            break;
          }

          case 'time_range': {
            if (!options.timeRange) break;
            include =
              mtimeSec >= options.timeRange.start &&
              mtimeSec <= options.timeRange.end;
            break;
          }
        }

        if (include) {
          entries.push({
            path: relPath,
            sizeBytes: stat.size,
            lastModified: mtimeSec,
          });
        }
      } catch {
        // File may have been deleted between walk and stat; skip.
      }
    }

    const totalSizeBytes = entries.reduce((sum, e) => sum + e.sizeBytes, 0);

    return {
      files: entries,
      totalFiles: entries.length,
      totalSizeBytes,
    };
  }

  /**
   * Export database contents as a structured JSON object.
   *
   * Includes:
   *   - entities (with current active properties)
   *   - relationships
   *   - watched_projects
   *   - reflection_artifacts
   *   - recent messages (last 30 days or within time_range)
   *
   * Results are filtered by scope when applicable.
   */
  async exportToJSON(options: ExportOptions): Promise<object> {
    // --- Entities ---
    let entitiesQuery = `SELECT * FROM entities WHERE status = 'active'`;
    const entitiesParams: unknown[] = [];

    if (options.scope === 'project' && options.projectId) {
      entitiesQuery += ` AND (id LIKE ? OR name LIKE ?)`;
      entitiesParams.push(`%${options.projectId}%`, `%${options.projectId}%`);
    }

    const entities = this.db.prepare(entitiesQuery).all(...entitiesParams) as Record<string, unknown>[];

    // Attach active properties to each entity
    const propsStmt = this.db.prepare(
      `SELECT property_key, property_value, value_type, confidence, action_type
       FROM entity_properties
       WHERE entity_id = ? AND status = 'active' AND tx_end IS NULL
       ORDER BY tx_start DESC`,
    );

    const entitiesWithProps = entities.map((entity) => {
      const props = propsStmt.all(entity.id as string) as Record<string, unknown>[];
      return { ...entity, properties: props };
    });

    // --- Relationships ---
    let relsQuery = `SELECT * FROM relationships`;
    const relsParams: unknown[] = [];

    if (options.scope === 'project' && options.projectId) {
      relsQuery += ` WHERE from_entity_id LIKE ? OR to_entity_id LIKE ?`;
      relsParams.push(`%${options.projectId}%`, `%${options.projectId}%`);
    }

    const relationships = this.db.prepare(relsQuery).all(...relsParams);

    // --- Watched projects ---
    const watchedProjects = this.db
      .prepare(`SELECT * FROM watched_projects`)
      .all();

    // --- Reflection artifacts ---
    let reflectionsQuery = `SELECT * FROM reflection_artifacts`;
    const reflectionsParams: unknown[] = [];

    if (options.scope === 'project' && options.projectId) {
      reflectionsQuery += ` WHERE scope_ref = ?`;
      reflectionsParams.push(options.projectId);
    } else if (options.scope === 'time_range' && options.timeRange) {
      reflectionsQuery += ` WHERE created_at >= ? AND created_at <= ?`;
      reflectionsParams.push(options.timeRange.start, options.timeRange.end);
    }

    const reflectionArtifacts = this.db
      .prepare(reflectionsQuery)
      .all(...reflectionsParams);

    // --- Messages ---
    let messagesQuery: string;
    const messagesParams: unknown[] = [];

    if (options.scope === 'time_range' && options.timeRange) {
      messagesQuery = `SELECT * FROM messages_raw WHERE timestamp >= ? AND timestamp <= ? ORDER BY timestamp DESC`;
      messagesParams.push(options.timeRange.start, options.timeRange.end);
    } else if (options.scope === 'project' && options.projectId) {
      messagesQuery = `SELECT * FROM messages_raw WHERE matched_projects_json LIKE ? ORDER BY timestamp DESC`;
      messagesParams.push(`%${options.projectId}%`);
    } else {
      // Default: last 30 days
      const thirtyDaysAgo = now() - 30 * 86400;
      messagesQuery = `SELECT * FROM messages_raw WHERE timestamp >= ? ORDER BY timestamp DESC`;
      messagesParams.push(thirtyDaysAgo);
    }

    const messages = this.db.prepare(messagesQuery).all(...messagesParams);

    return {
      exportedAt: formatDateTime(now()),
      scope: options.scope,
      projectId: options.projectId ?? null,
      timeRange: options.timeRange ?? null,
      entities: entitiesWithProps,
      relationships,
      watchedProjects,
      reflectionArtifacts,
      messages,
    };
  }

  /**
   * Return a high-level manifest / stats overview of the data store.
   *
   * Includes:
   *   - Total entities, messages, chunks, relationships
   *   - Date range of data
   *   - List of watched projects
   *   - Disk usage estimate
   */
  async getExportManifest(): Promise<object> {
    const entityCount = (
      this.db.prepare(`SELECT COUNT(*) AS cnt FROM entities`).get() as { cnt: number }
    ).cnt;

    const messageCount = (
      this.db.prepare(`SELECT COUNT(*) AS cnt FROM messages_raw`).get() as { cnt: number }
    ).cnt;

    const chunkCount = (
      this.db.prepare(`SELECT COUNT(*) AS cnt FROM chunks`).get() as { cnt: number }
    ).cnt;

    const relationshipCount = (
      this.db.prepare(`SELECT COUNT(*) AS cnt FROM relationships`).get() as { cnt: number }
    ).cnt;

    // Date range of messages
    const dateRange = this.db
      .prepare(
        `SELECT MIN(timestamp) AS earliest, MAX(timestamp) AS latest
         FROM messages_raw`,
      )
      .get() as { earliest: number | null; latest: number | null };

    // Watched projects list
    const watchedProjects = this.db
      .prepare(`SELECT id, name, is_active FROM watched_projects`)
      .all() as Array<{ id: string; name: string; is_active: number }>;

    // Disk usage: estimate from walking the data directory
    let diskUsageBytes = 0;
    try {
      const files = await this.walkFiles(this.dataDir);
      for (const f of files) {
        try {
          const stat = await fs.stat(f);
          diskUsageBytes += stat.size;
        } catch {
          // skip
        }
      }
    } catch {
      // Cannot walk directory; leave at 0.
    }

    return {
      generatedAt: formatDateTime(now()),
      counts: {
        entities: entityCount,
        messages: messageCount,
        chunks: chunkCount,
        relationships: relationshipCount,
      },
      dateRange: {
        earliest: dateRange.earliest != null ? formatDateTime(dateRange.earliest) : null,
        latest: dateRange.latest != null ? formatDateTime(dateRange.latest) : null,
        earliestTs: dateRange.earliest,
        latestTs: dateRange.latest,
      },
      watchedProjects: watchedProjects.map((p) => ({
        id: p.id,
        name: p.name,
        active: Boolean(p.is_active),
      })),
      diskUsageBytes,
      diskUsageMB: Number((diskUsageBytes / (1024 * 1024)).toFixed(2)),
    };
  }

  // ========================================================================
  // Private helpers
  // ========================================================================

  /**
   * Recursively walk a directory and collect all file paths.
   */
  private async walkFiles(dir: string): Promise<string[]> {
    const results: string[] = [];
    await this.walkDirRecursive(dir, results);
    return results;
  }

  /**
   * Recursive directory walker that collects file paths.
   */
  private async walkDirRecursive(dir: string, results: string[]): Promise<void> {
    let entries;
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        await this.walkDirRecursive(fullPath, results);
      } else if (entry.isFile()) {
        results.push(fullPath);
      }
    }
  }
}
