/**
 * MarkdownManager — Central manager for all Markdown file operations
 * with chunk indexing.
 *
 * The key difference from UserDataManager: MarkdownManager handles
 * content-level operations (writing structured content, reindexing
 * chunks, syncing with the database), while UserDataManager handles
 * filesystem operations (directory creation, file paths).
 *
 * Phase 5 — Consolidation & Markdown Persistence.
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import type Database from 'better-sqlite3';

import { chunkText } from '../utils/chunking.js';
import { contentHash } from '../utils/hashing.js';
import { now, formatDate, formatDateTime } from '../utils/time.js';
import { EmbeddingClient } from '../llm/EmbeddingClient.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TimelineEntry {
  timestamp: number;
  key: string;
  oldValue?: string;
  newValue: string;
  sourceAuthor?: string;
  actionType?: string;
}

// ---------------------------------------------------------------------------
// Entity type to subdirectory mapping
// ---------------------------------------------------------------------------

const ENTITY_TYPE_DIRS: Record<string, string> = {
  Person: 'people',
  person: 'people',
  Topic: 'topics',
  topic: 'topics',
  Organization: 'organizations',
  organization: 'organizations',
  Technology: 'technologies',
  technology: 'technologies',
  Project: 'projects',
  project: 'projects',
  Document: 'documents',
  document: 'documents',
  Task: 'tasks',
  task: 'tasks',
};

// ---------------------------------------------------------------------------
// MarkdownManager
// ---------------------------------------------------------------------------

export class MarkdownManager {
  private db: Database.Database;
  private dataDir: string;

  constructor(db: Database.Database, dataDir: string) {
    this.db = db;
    this.dataDir = dataDir;
  }

  // ========================================================================
  // Writing operations
  // ========================================================================

  /**
   * Append content to a daily log file.
   * Creates the file with a date header if it does not exist.
   *
   * Path: daily/{YYYY-MM-DD}.md
   */
  async writeDailyLog(date: Date, content: string): Promise<void> {
    const dateStr = this.formatDateStr(date);
    const relPath = `daily/${dateStr}.md`;
    const absPath = this.abs(relPath);

    await this.ensureDir(path.dirname(absPath));

    const exists = await this.fileExists(absPath);
    if (!exists) {
      const header = `# ${dateStr} Memory Log\n\n`;
      await fs.writeFile(absPath, header + content, 'utf-8');
    } else {
      await fs.appendFile(absPath, content, 'utf-8');
    }

    await this.reindexFile(relPath);
  }

  /**
   * Overwrite a project summary file (project summaries are regenerated).
   *
   * Path: projects/{slug}.md
   */
  async updateProjectSummary(projectSlug: string, summary: string): Promise<void> {
    const relPath = `projects/${projectSlug}.md`;
    const absPath = this.abs(relPath);

    await this.ensureDir(path.dirname(absPath));

    const dateTimeStr = formatDateTime(now());
    const header = `# Project: ${projectSlug}\n\nLast updated: ${dateTimeStr}\n\n`;
    await fs.writeFile(absPath, header + summary, 'utf-8');

    await this.reindexFile(relPath);
  }

  /**
   * Append timeline entries to a project timeline file.
   *
   * Path: projects/{slug}-timeline.md
   */
  async appendToTimeline(projectSlug: string, entries: TimelineEntry[]): Promise<void> {
    if (entries.length === 0) return;

    const relPath = `projects/${projectSlug}-timeline.md`;
    const absPath = this.abs(relPath);

    await this.ensureDir(path.dirname(absPath));

    // Format each entry as a markdown list item
    const formatted = entries.map((entry) => {
      const dateTimeStr = formatDateTime(entry.timestamp);
      const oldPart = entry.oldValue != null ? ` from "${entry.oldValue}"` : '';
      const author = entry.sourceAuthor ?? 'unknown';
      const action = entry.actionType ?? 'update';
      return `- **${dateTimeStr}**: ${entry.key} changed${oldPart} to "${entry.newValue}" (source: ${author}, ${action})`;
    });

    const block = formatted.join('\n') + '\n';

    const exists = await this.fileExists(absPath);
    if (!exists) {
      const header = `# Timeline: ${projectSlug}\n\n`;
      await fs.writeFile(absPath, header + block, 'utf-8');
    } else {
      await fs.appendFile(absPath, block, 'utf-8');
    }

    await this.reindexFile(relPath);
  }

  /**
   * Write a reflection file for the given date.
   *
   * Path: reflections/{YYYY-MM-DD}.md
   */
  async writeReflection(date: Date, content: string): Promise<void> {
    const dateStr = this.formatDateStr(date);
    const relPath = `reflections/${dateStr}.md`;
    const absPath = this.abs(relPath);

    await this.ensureDir(path.dirname(absPath));

    const header = `# Reflection: ${dateStr}\n\n`;
    await fs.writeFile(absPath, header + content, 'utf-8');

    await this.reindexFile(relPath);
  }

  /**
   * Write a dream/consolidation output file.
   *
   * Path: dreams/{topicSlug}-{YYYY-MM-DD}.md
   */
  async writeDream(topicSlug: string, date: Date, content: string): Promise<void> {
    const dateStr = this.formatDateStr(date);
    const relPath = `dreams/${topicSlug}-${dateStr}.md`;
    const absPath = this.abs(relPath);

    await this.ensureDir(path.dirname(absPath));

    const header = `# Dream: ${topicSlug} (${dateStr})\n\n`;
    await fs.writeFile(absPath, header + content, 'utf-8');

    await this.reindexFile(relPath);
  }

  /**
   * Write an entity profile markdown file.
   *
   * Path: entities/{typeFolder}/{slug}.md
   * where typeFolder maps: Person -> people, Topic -> topics, etc.
   */
  async writeEntityProfile(
    entityType: string,
    entitySlug: string,
    content: string,
  ): Promise<void> {
    const typeFolder = ENTITY_TYPE_DIRS[entityType] ?? entityType.toLowerCase();
    const relPath = `entities/${typeFolder}/${entitySlug}.md`;
    const absPath = this.abs(relPath);

    await this.ensureDir(path.dirname(absPath));

    const header = `# ${entityType}: ${entitySlug}\n\n`;
    await fs.writeFile(absPath, header + content, 'utf-8');

    await this.reindexFile(relPath);
  }

  /**
   * Append content to the core memory file. Never overwrites.
   *
   * Path: CORE_MEMORY.md
   */
  async appendToCoreMemory(content: string): Promise<void> {
    const relPath = 'CORE_MEMORY.md';
    const absPath = this.abs(relPath);

    const exists = await this.fileExists(absPath);
    if (!exists) {
      // Should have been seeded by UserDataManager, but create a minimal
      // one if missing.
      const header = `# Core Memory\n\n`;
      await fs.writeFile(absPath, header + content + '\n', 'utf-8');
    } else {
      await fs.appendFile(absPath, content + '\n', 'utf-8');
    }

    // Core memory is not chunk-indexed (it's a living document);
    // callers can reindex explicitly if desired.
  }

  // ========================================================================
  // Indexing operations
  // ========================================================================

  /**
   * Core indexing method: read a markdown file, delete its old chunks,
   * split the content into chunks, and insert them into the database.
   *
   * @param relativeFilePath  Path relative to the data directory.
   * @returns Number of chunks created.
   */
  async reindexFile(relativeFilePath: string): Promise<number> {
    const absPath = this.abs(relativeFilePath);

    // 1. Read file content
    let content: string;
    try {
      content = await fs.readFile(absPath, 'utf-8');
    } catch {
      console.warn(`[MarkdownManager] Cannot read file for reindex: ${relativeFilePath}`);
      return 0;
    }

    // 2. Get existing chunk IDs for this file path
    const existingChunks = this.db
      .prepare(`SELECT chunk_id FROM chunks WHERE file_path = ?`)
      .all(relativeFilePath) as Array<{ chunk_id: number }>;

    const existingIds = existingChunks.map((r) => r.chunk_id);

    // 3. Delete from chunks_vec first (foreign-key-like dependency)
    if (existingIds.length > 0) {
      // sqlite-vec virtual tables don't support IN(...) with variable
      // placeholders well, so delete one-by-one for safety.
      const deleteVec = this.db.prepare(
        `DELETE FROM chunks_vec WHERE chunk_id = ?`,
      );
      for (const id of existingIds) {
        try {
          deleteVec.run(id);
        } catch {
          // Ignore: vec row may not exist if embedding failed earlier.
        }
      }
    }

    // 4. Delete existing chunks for this file (FTS triggers will fire)
    this.db
      .prepare(`DELETE FROM chunks WHERE file_path = ?`)
      .run(relativeFilePath);

    // 5. Split content into chunks
    const chunks = chunkText(content, 400, 80);
    if (chunks.length === 0) {
      return 0;
    }

    // 6. Determine metadata from file path
    const sourceType = this.inferSourceType(relativeFilePath);
    const relatedProject = this.inferProject(relativeFilePath);
    const timestamp = now();

    // 7. Insert each chunk
    const insertChunk = this.db.prepare(
      `INSERT INTO chunks
        (file_path, line_start, line_end, content, content_hash,
         source_type, related_project, token_count, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    );

    const insertVec = this.db.prepare(
      `INSERT INTO chunks_vec (chunk_id, embedding)
       VALUES (?, ?)`,
    );

    let embeddingClient: EmbeddingClient | null = null;
    try {
      embeddingClient = await EmbeddingClient.getInstance();
    } catch {
      // Embedding model not available; we'll skip vector inserts.
    }

    let chunksCreated = 0;

    for (const chunk of chunks) {
      const hash = contentHash(chunk.content);

      const result = insertChunk.run(
        relativeFilePath,
        chunk.lineStart,
        chunk.lineEnd,
        chunk.content,
        hash,
        sourceType,
        relatedProject,
        chunk.tokenCount,
        timestamp,
      );

      const chunkId = Number(result.lastInsertRowid);
      chunksCreated++;

      // Generate embedding and insert into chunks_vec
      if (embeddingClient) {
        try {
          const embedding = await embeddingClient.embed(chunk.content);
          insertVec.run(chunkId, JSON.stringify(embedding));
        } catch (err) {
          console.warn(
            `[MarkdownManager] Embedding failed for chunk ${chunkId}:`,
            (err as Error).message,
          );
        }
      }
    }

    return chunksCreated;
  }

  /**
   * Find files modified since the given timestamp and reindex each.
   *
   * @param since  Unix timestamp in seconds.
   * @returns Total number of chunks created across all reindexed files.
   */
  async reindexModifiedFiles(since: number): Promise<number> {
    const sinceMs = since * 1000; // fs.stat uses milliseconds
    const mdFiles = await this.walkMarkdownFiles(this.dataDir);

    let totalChunks = 0;

    for (const absPath of mdFiles) {
      try {
        const stat = await fs.stat(absPath);
        if (stat.mtimeMs >= sinceMs) {
          const relPath = path.relative(this.dataDir, absPath);
          const count = await this.reindexFile(relPath);
          totalChunks += count;
        }
      } catch {
        // File may have been deleted between walk and stat; skip it.
      }
    }

    return totalChunks;
  }

  /**
   * Infer the source type from a file path.
   */
  inferSourceType(filePath: string): string {
    const normalized = filePath.replace(/\\/g, '/');

    if (normalized.startsWith('daily/')) return 'daily_log';
    if (normalized.startsWith('projects/')) return 'project_summary';
    if (normalized.startsWith('reflections/')) return 'reflection';
    if (normalized.startsWith('dreams/')) return 'dream';
    if (normalized.startsWith('entities/')) return 'entity_profile';

    return 'markdown';
  }

  /**
   * Extract project slug from a file path if it lives in the projects/ directory.
   */
  inferProject(filePath: string): string | null {
    const normalized = filePath.replace(/\\/g, '/');

    if (!normalized.startsWith('projects/')) return null;

    // Path is projects/{slug}.md or projects/{slug}-timeline.md
    const basename = path.basename(normalized, '.md');

    // Strip -timeline suffix if present
    const slug = basename.replace(/-timeline$/, '');
    return slug || null;
  }

  // ========================================================================
  // Private helpers
  // ========================================================================

  /** Build an absolute path from a relative data path. */
  private abs(relativePath: string): string {
    return path.join(this.dataDir, relativePath);
  }

  /** Ensure a directory exists, creating it recursively if needed. */
  private async ensureDir(dirPath: string): Promise<void> {
    await fs.mkdir(dirPath, { recursive: true });
  }

  /** Check if a file exists. */
  private async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  /** Format a Date as YYYY-MM-DD. */
  private formatDateStr(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  /**
   * Recursively walk a directory and collect all .md file paths.
   */
  private async walkMarkdownFiles(dir: string): Promise<string[]> {
    const results: string[] = [];
    await this.walkDirRecursive(dir, results, true);
    return results;
  }

  /**
   * Recursive directory walker that collects file paths.
   *
   * @param dir        Directory to walk.
   * @param results    Accumulator array for discovered file paths.
   * @param mdOnly     When true, only .md files are collected.
   */
  private async walkDirRecursive(
    dir: string,
    results: string[],
    mdOnly = false,
  ): Promise<void> {
    let entries;
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        await this.walkDirRecursive(fullPath, results, mdOnly);
      } else if (entry.isFile()) {
        if (!mdOnly || entry.name.endsWith('.md')) {
          results.push(fullPath);
        }
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Factory (per-dataDir instances)
// ---------------------------------------------------------------------------

const _instances = new Map<string, MarkdownManager>();

/**
 * Get (or create) a MarkdownManager instance for the given dataDir.
 *
 * Uses a Map keyed by dataDir so that each user's data directory gets its
 * own MarkdownManager instance, avoiding cross-user contamination.
 *
 * @param db       better-sqlite3 database handle (required on first call per dataDir).
 * @param dataDir  Root data directory path (required on first call per dataDir).
 */
export function getMarkdownManager(
  db?: Database.Database,
  dataDir?: string,
): MarkdownManager {
  if (!db || !dataDir) {
    throw new Error(
      '[MarkdownManager] getMarkdownManager() requires both db and dataDir.',
    );
  }

  const existing = _instances.get(dataDir);
  if (existing) {
    return existing;
  }

  const instance = new MarkdownManager(db, dataDir);
  _instances.set(dataDir, instance);
  return instance;
}
