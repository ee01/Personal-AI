import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import AdmZip from 'adm-zip';
import BetterSqlite3 from 'better-sqlite3';
import type { FastifyInstance } from 'fastify';

import type { UserContext } from './UserContextManager.js';

const BACKUP_FORMAT = 'personal-ai-memory-backup';
const BACKUP_FORMAT_VERSION = 1;
const SQLITE_FILE_NAME = 'memory.db';
const CONFIG_FILE_NAME = 'config.json';

const ROOT_MARKDOWN_FILES = [
  'USER_CORE.md',
  'CORE_MEMORY.md',
  'WATCHED_PROJECTS.md',
] as const;

const MARKDOWN_DIRECTORIES = [
  'daily',
  'dreams',
  'entities',
  'reflections',
  'reflection-threads',
  'reports',
  'projects',
  'skills',
  'agent',
] as const;

const SQLITE_EPHEMERAL_FILES = new Set([
  SQLITE_FILE_NAME,
  `${SQLITE_FILE_NAME}-wal`,
  `${SQLITE_FILE_NAME}-shm`,
]);

const DERIVED_SNAPSHOTS = [
  'derived/messages/messages-overview.md',
  'derived/profile/profile-overview.md',
  'derived/timelines/entity-property-timeline.md',
  'derived/relationships/relationship-overview.md',
] as const;

type BackupLayer = 'A' | 'B' | 'C';

interface ManifestIncludeEntry {
  path: string;
  layer: BackupLayer;
  sizeBytes: number;
  modifiedAt: number;
  sha256: string;
  required: boolean;
}

interface ManifestGenerationFailure {
  path: string;
  reason: string;
}

export class MemoryBackupValidationError extends Error {
  statusCode = 400 as const;

  constructor(message: string) {
    super(message);
    this.name = 'MemoryBackupValidationError';
  }
}

export interface MemoryBackupManifest {
  format: typeof BACKUP_FORMAT;
  formatVersion: typeof BACKUP_FORMAT_VERSION;
  transport: 'zip';
  exportedAt: string;
  userId: string;
  includes: ManifestIncludeEntry[];
  layers: {
    A: {
      paths: string[];
    };
    B: {
      paths: string[];
    };
    C: {
      generated: string[];
      failed: ManifestGenerationFailure[];
      skipped: string[];
    };
  };
}

export interface MemoryBackupExportResult {
  fileName: string;
  buffer: Buffer;
  manifest: MemoryBackupManifest;
}

export interface MemoryImportResult {
  mode: 'merge' | 'replace';
  importedAt: string;
  restoredLayers: Array<'A' | 'B'>;
  database: {
    action: 'merged' | 'replaced';
    changedRows?: number;
    tableChanges?: Record<string, number>;
    skippedTables?: string[];
  };
  files: {
    written: number;
    overwritten: number;
    preserved: number;
    deleted: number;
    writtenPaths: string[];
    overwrittenPaths: string[];
    preservedPaths: string[];
    deletedPaths: string[];
  };
  warnings: string[];
}

interface DatabaseMergeSummary {
  changedRows: number;
  tableChanges: Record<string, number>;
  skippedTables: string[];
}

interface ExtractedBackupBundle {
  extractDir: string;
  manifest: MemoryBackupManifest;
  userDir: string;
}

const TABLES_TO_MERGE = [
  '_migrations',
  'messages_raw',
  'chunks',
  'entities',
  'entity_properties',
  'relationships',
  'memory_metadata',
  'watched_projects',
  'reflection_artifacts',
  'proposed_actions',
  'confirm_requests',
  'notification_records',
  'user_profile_items',
  'profile_sync_state',
  'social_edges',
  'opinion_items',
  'agent_profile_versions',
  'worker_checkpoints',
  'worker_leases',
  'reflection_threads',
  'reflection_runs',
  'dream_runs',
  'topic_memory_links',
  'proposed_action_attempts',
  'concerned_items_state',
  'follow_thread_hits',
] as const;

const VECTOR_TABLES = [
  {
    name: 'chunks_vec',
    columns: ['chunk_id', 'embedding'],
  },
  {
    name: 'messages_vec',
    columns: ['message_id', 'embedding'],
  },
] as const;

export async function exportMemoryBackupZip(
  userContext: UserContext,
): Promise<MemoryBackupExportResult> {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'personal-ai-memory-export-'));
  const packageRoot = path.join(tempRoot, 'package');
  const userExportDir = path.join(packageRoot, 'user');
  const derivedDir = path.join(packageRoot, 'derived');
  const userDir = userContext.userDataManager.rootDir;

  await fs.mkdir(userExportDir, { recursive: true });
  await fs.mkdir(derivedDir, { recursive: true });

  const layerAFiles: string[] = [];
  const layerBFiles: string[] = [];
  const layerCFiles: string[] = [];
  const derivedFailures: ManifestGenerationFailure[] = [];
  const derivedSkipped: string[] = [];

  try {
    await userContext.db.backup(path.join(userExportDir, SQLITE_FILE_NAME));
    layerAFiles.push(`user/${SQLITE_FILE_NAME}`);

    const sourceConfigPath = path.join(userDir, CONFIG_FILE_NAME);
    const targetConfigPath = path.join(userExportDir, CONFIG_FILE_NAME);
    if (await pathExists(sourceConfigPath)) {
      await copyFileWithMtime(sourceConfigPath, targetConfigPath);
    } else {
      await fs.writeFile(targetConfigPath, '{}\n', 'utf-8');
    }
    layerAFiles.push(`user/${CONFIG_FILE_NAME}`);

    for (const rootFile of ROOT_MARKDOWN_FILES) {
      const sourcePath = path.join(userDir, rootFile);
      if (!(await pathExists(sourcePath))) {
        continue;
      }
      await copyFileWithMtime(sourcePath, path.join(userExportDir, rootFile));
      layerBFiles.push(`user/${rootFile}`);
    }

    for (const directory of MARKDOWN_DIRECTORIES) {
      const sourceDirectory = path.join(userDir, directory);
      if (!(await pathExists(sourceDirectory))) {
        continue;
      }

      const relativeFiles = await listFilesRecursive(sourceDirectory);
      for (const relativeFile of relativeFiles) {
        if (!relativeFile.endsWith('.md')) {
          continue;
        }
        const sourcePath = path.join(sourceDirectory, relativeFile);
        const zipPath = `user/${toPosixPath(path.join(directory, relativeFile))}`;
        await copyFileWithMtime(sourcePath, path.join(packageRoot, zipPath));
        layerBFiles.push(zipPath);
      }
    }

    const derivedSnapshots = [
      {
        path: DERIVED_SNAPSHOTS[0],
        generator: () => generateMessagesOverview(userContext.db),
      },
      {
        path: DERIVED_SNAPSHOTS[1],
        generator: () => generateProfileOverview(userContext.db),
      },
      {
        path: DERIVED_SNAPSHOTS[2],
        generator: () => generateEntityTimelineOverview(userContext.db),
      },
      {
        path: DERIVED_SNAPSHOTS[3],
        generator: () => generateRelationshipOverview(userContext.db),
      },
    ] as const;

    for (const snapshot of derivedSnapshots) {
      try {
        const content = await snapshot.generator();
        await writeTextFile(path.join(packageRoot, snapshot.path), content);
        layerCFiles.push(snapshot.path);
      } catch (error) {
        derivedFailures.push({
          path: snapshot.path,
          reason: error instanceof Error ? error.message : String(error),
        });
      }
    }

    for (const snapshotPath of DERIVED_SNAPSHOTS) {
      if (!layerCFiles.includes(snapshotPath) && !derivedFailures.find((item) => item.path === snapshotPath)) {
        derivedSkipped.push(snapshotPath);
      }
    }

    const manifest = await buildManifest(packageRoot, {
      userId: userContext.userId,
      exportedAt: new Date().toISOString(),
      layerAFiles,
      layerBFiles,
      layerCFiles,
      derivedFailures,
      derivedSkipped,
    });

    await writeTextFile(
      path.join(packageRoot, 'manifest.json'),
      `${JSON.stringify(manifest, null, 2)}\n`,
    );

    const zipBuffer = await createZipBuffer(packageRoot);
    return {
      fileName: `personal-ai-memory-${userContext.userId}-${formatFileTimestamp(manifest.exportedAt)}.zip`,
      buffer: zipBuffer,
      manifest,
    };
  } finally {
    await fs.rm(tempRoot, { recursive: true, force: true });
  }
}

export async function importMemoryBackupZip(
  app: FastifyInstance,
  userContext: UserContext,
  zipFilePath: string,
  mode: 'merge' | 'replace',
): Promise<MemoryImportResult> {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'personal-ai-memory-import-'));
  const warnings: string[] = [];

  try {
    const extracted = await extractAndValidateBackup(zipFilePath, tempRoot);
    const currentUserDir = userContext.userDataManager.rootDir;
    const importedUserDir = extracted.userDir;
    const existingPaths = await listUserRuntimeFiles(currentUserDir);
    const importedPaths = await listUserRuntimeFiles(importedUserDir);
    const importedPathSet = new Set(importedPaths);

    const overwrittenPaths = existingPaths.filter((relativePath) => importedPathSet.has(relativePath));
    const preservedPaths =
      mode === 'merge'
        ? existingPaths.filter((relativePath) => !importedPathSet.has(relativePath))
        : [];
    const deletedPaths =
      mode === 'replace'
        ? existingPaths.filter((relativePath) => !importedPathSet.has(relativePath))
        : [];

    const stageUserDir = path.join(tempRoot, mode === 'merge' ? 'stage-merge-user' : 'stage-replace-user');

    let databaseSummary: DatabaseMergeSummary | undefined;

    if (mode === 'merge') {
      if (await pathExists(currentUserDir)) {
        await copyDirectoryRecursive(currentUserDir, stageUserDir);
      } else {
        await fs.mkdir(stageUserDir, { recursive: true });
      }

      await copyDirectoryRecursive(importedUserDir, stageUserDir, {
        excludeNames: new Set([SQLITE_FILE_NAME]),
      });

      const stagedDbPath = path.join(stageUserDir, SQLITE_FILE_NAME);
      const importedDbPath = path.join(importedUserDir, SQLITE_FILE_NAME);

      if (await pathExists(stagedDbPath)) {
        databaseSummary = mergeDatabaseFiles(stagedDbPath, importedDbPath, warnings);
      } else {
        await copyFileWithMtime(importedDbPath, stagedDbPath);
        databaseSummary = {
          changedRows: 0,
          tableChanges: {},
          skippedTables: [],
        };
      }
    } else {
      await copyDirectoryRecursive(importedUserDir, stageUserDir);
    }

    await commitUserDirectorySwap(
      app,
      userContext.userId,
      currentUserDir,
      stageUserDir,
    );

    return {
      mode,
      importedAt: new Date().toISOString(),
      restoredLayers: ['A', 'B'],
      database:
        mode === 'merge'
          ? {
              action: 'merged',
              changedRows: databaseSummary?.changedRows ?? 0,
              tableChanges: databaseSummary?.tableChanges ?? {},
              skippedTables: databaseSummary?.skippedTables ?? [],
            }
          : {
              action: 'replaced',
            },
      files: {
        written: importedPaths.length,
        overwritten: overwrittenPaths.length,
        preserved: preservedPaths.length,
        deleted: deletedPaths.length,
        writtenPaths: importedPaths,
        overwrittenPaths,
        preservedPaths,
        deletedPaths,
      },
      warnings,
    };
  } finally {
    await fs.rm(tempRoot, { recursive: true, force: true });
  }
}

async function buildManifest(
  packageRoot: string,
  options: {
    userId: string;
    exportedAt: string;
    layerAFiles: string[];
    layerBFiles: string[];
    layerCFiles: string[];
    derivedFailures: ManifestGenerationFailure[];
    derivedSkipped: string[];
  },
): Promise<MemoryBackupManifest> {
  const files = await listFilesRecursive(packageRoot);
  const includes: ManifestIncludeEntry[] = [];

  for (const relativePath of files) {
    if (relativePath === 'manifest.json') {
      continue;
    }

    const absolutePath = path.join(packageRoot, relativePath);
    const stat = await fs.stat(absolutePath);
    const buffer = await fs.readFile(absolutePath);
    let layer: BackupLayer = 'C';
    let required = false;

    if (options.layerAFiles.includes(relativePath)) {
      layer = 'A';
      required = true;
    } else if (options.layerBFiles.includes(relativePath)) {
      layer = 'B';
    }

    includes.push({
      path: relativePath,
      layer,
      sizeBytes: stat.size,
      modifiedAt: Math.floor(stat.mtimeMs),
      sha256: sha256(buffer),
      required,
    });
  }

  includes.sort((left, right) => left.path.localeCompare(right.path));

  return {
    format: BACKUP_FORMAT,
    formatVersion: BACKUP_FORMAT_VERSION,
    transport: 'zip',
    exportedAt: options.exportedAt,
    userId: options.userId,
    includes,
    layers: {
      A: {
        paths: [...options.layerAFiles].sort(),
      },
      B: {
        paths: [...options.layerBFiles].sort(),
      },
      C: {
        generated: [...options.layerCFiles].sort(),
        failed: [...options.derivedFailures].sort((left, right) => left.path.localeCompare(right.path)),
        skipped: [...options.derivedSkipped].sort(),
      },
    },
  };
}

async function createZipBuffer(packageRoot: string): Promise<Buffer> {
  const zip = new AdmZip();
  const files = await listFilesRecursive(packageRoot);

  for (const relativePath of files) {
    const absolutePath = path.join(packageRoot, relativePath);
    zip.addFile(relativePath, await fs.readFile(absolutePath));
  }

  return zip.toBuffer();
}

async function extractAndValidateBackup(
  zipFilePath: string,
  tempRoot: string,
): Promise<ExtractedBackupBundle> {
  const zip = new AdmZip(zipFilePath);

  for (const entry of zip.getEntries()) {
    const entryName = entry.entryName;
    if (!entryName) {
      throw new MemoryBackupValidationError('Zip contains an empty entry name');
    }
    if (entryName.startsWith('/') || entryName.includes('..')) {
      throw new MemoryBackupValidationError(
        `Zip contains an unsafe entry path: ${entryName}`,
      );
    }
  }

  const extractDir = path.join(tempRoot, 'unzipped');
  await fs.mkdir(extractDir, { recursive: true });
  zip.extractAllTo(extractDir, true);

  const manifestPath = path.join(extractDir, 'manifest.json');
  if (!(await pathExists(manifestPath))) {
    throw new MemoryBackupValidationError('Backup is missing manifest.json');
  }

  const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf-8')) as MemoryBackupManifest;
  validateManifest(manifest);

  const requiredPaths = new Set(['user/memory.db', 'user/config.json']);
  for (const requiredPath of requiredPaths) {
    if (!manifest.includes.find((entry) => entry.path === requiredPath)) {
      throw new MemoryBackupValidationError(
        `Backup manifest is missing required entry: ${requiredPath}`,
      );
    }
  }

  for (const include of manifest.includes) {
    const normalizedPath = normalizeRelativePath(include.path);
    const absolutePath = path.join(extractDir, normalizedPath);
    if (!(await pathExists(absolutePath))) {
      throw new MemoryBackupValidationError(
        `Backup is missing file: ${normalizedPath}`,
      );
    }

    const stat = await fs.stat(absolutePath);
    const buffer = await fs.readFile(absolutePath);
    if (include.sizeBytes !== stat.size) {
      throw new MemoryBackupValidationError(`Size mismatch for ${normalizedPath}`);
    }
    if (include.sha256 !== sha256(buffer)) {
      throw new MemoryBackupValidationError(
        `Checksum mismatch for ${normalizedPath}`,
      );
    }
  }

  const extractedUserDir = path.join(extractDir, 'user');
  if (!(await pathExists(path.join(extractedUserDir, SQLITE_FILE_NAME)))) {
    throw new MemoryBackupValidationError('Backup is missing user/memory.db');
  }
  if (!(await pathExists(path.join(extractedUserDir, CONFIG_FILE_NAME)))) {
    throw new MemoryBackupValidationError('Backup is missing user/config.json');
  }

  return {
    extractDir,
    manifest,
    userDir: extractedUserDir,
  };
}

function validateManifest(manifest: MemoryBackupManifest): void {
  if (!manifest || typeof manifest !== 'object') {
    throw new MemoryBackupValidationError('Invalid manifest payload');
  }
  if (manifest.format !== BACKUP_FORMAT) {
    throw new MemoryBackupValidationError(
      `Unsupported backup format: ${String(manifest.format)}`,
    );
  }
  if (manifest.formatVersion !== BACKUP_FORMAT_VERSION) {
    throw new MemoryBackupValidationError(
      `Unsupported backup format version: ${String(manifest.formatVersion)}`,
    );
  }
  if (manifest.transport !== 'zip') {
    throw new MemoryBackupValidationError(
      `Unsupported backup transport: ${String(manifest.transport)}`,
    );
  }
  if (!Array.isArray(manifest.includes)) {
    throw new MemoryBackupValidationError('Backup manifest is missing includes');
  }

  const seen = new Set<string>();
  for (const include of manifest.includes) {
    const normalizedPath = normalizeRelativePath(include.path);
    if (seen.has(normalizedPath)) {
      throw new MemoryBackupValidationError(
        `Backup manifest contains duplicate path: ${normalizedPath}`,
      );
    }
    seen.add(normalizedPath);
  }
}

function mergeDatabaseFiles(
  targetDbPath: string,
  importedDbPath: string,
  warnings: string[],
): DatabaseMergeSummary {
  const targetDb = new BetterSqlite3(targetDbPath);

  try {
    targetDb.pragma('journal_mode = WAL');
    targetDb.pragma('foreign_keys = ON');
    return mergeDatabaseBackup(targetDb, importedDbPath, warnings);
  } finally {
    targetDb.close();
  }
}

function mergeDatabaseBackup(
  targetDb: BetterSqlite3.Database,
  sourceDbPath: string,
  warnings: string[],
): DatabaseMergeSummary {
  const tableChanges: Record<string, number> = {};
  const skippedTables: string[] = [];
  let changedRows = 0;

  targetDb.prepare('ATTACH DATABASE ? AS importdb').run(sourceDbPath);

  try {
    targetDb.pragma('foreign_keys = OFF');

    const runMerge = targetDb.transaction(() => {
      for (const tableName of TABLES_TO_MERGE) {
        if (!tableExists(targetDb, 'main', tableName) || !tableExists(targetDb, 'importdb', tableName)) {
          continue;
        }

        const columns = getSharedColumns(targetDb, tableName);
        if (columns.length === 0) {
          skippedTables.push(tableName);
          warnings.push(`Skipped table ${tableName}: no shared columns`);
          continue;
        }

        const primaryKeys = getPrimaryKeyColumns(targetDb, tableName);
        const sql = buildMergeSql(tableName, columns, primaryKeys);
        const result = targetDb.prepare(sql).run();

        tableChanges[tableName] = result.changes;
        changedRows += result.changes;
      }

      for (const vectorTable of VECTOR_TABLES) {
        if (!tableExists(targetDb, 'main', vectorTable.name) || !tableExists(targetDb, 'importdb', vectorTable.name)) {
          continue;
        }

        try {
          const quotedColumns = vectorTable.columns.map(quoteIdentifier).join(', ');
          const result = targetDb
            .prepare(
              `INSERT OR REPLACE INTO ${quoteIdentifier(vectorTable.name)} (${quotedColumns})
               SELECT ${quotedColumns}
               FROM importdb.${quoteIdentifier(vectorTable.name)}`,
            )
            .run();

          tableChanges[vectorTable.name] = result.changes;
          changedRows += result.changes;
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          skippedTables.push(vectorTable.name);
          warnings.push(`Skipped table ${vectorTable.name}: ${message}`);
        }
      }

      if (tableExists(targetDb, 'main', 'chunks_fts')) {
        try {
          targetDb.prepare(`INSERT INTO chunks_fts(chunks_fts) VALUES ('rebuild')`).run();
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          warnings.push(`Failed to rebuild chunks_fts: ${message}`);
        }
      }
    });

    runMerge();
  } finally {
    try {
      targetDb.pragma('foreign_keys = ON');
    } catch {
      // best-effort cleanup
    }
    try {
      targetDb.prepare('DETACH DATABASE importdb').run();
    } catch {
      // best-effort cleanup
    }
  }

  return {
    changedRows,
    tableChanges,
    skippedTables,
  };
}

async function commitUserDirectorySwap(
  app: FastifyInstance,
  userId: string,
  currentUserDir: string,
  stageUserDir: string,
): Promise<void> {
  const parentDir = path.dirname(currentUserDir);
  const backupDir = `${currentUserDir}.backup-${Date.now()}`;
  const hadCurrentUserDir = await pathExists(currentUserDir);
  let backupCreated = false;

  app.userContextManager.resetContext(userId);

  try {
    await fs.mkdir(parentDir, { recursive: true });

    if (hadCurrentUserDir) {
      await fs.rm(backupDir, { recursive: true, force: true });
      await fs.rename(currentUserDir, backupDir);
      backupCreated = true;
    }

    await moveDirectory(stageUserDir, currentUserDir);
    app.userContextManager.getContext(userId);

    if (backupCreated) {
      await fs.rm(backupDir, { recursive: true, force: true });
    }
  } catch (error) {
    await fs.rm(currentUserDir, { recursive: true, force: true });

    if (backupCreated && (await pathExists(backupDir))) {
      await moveDirectory(backupDir, currentUserDir);
    }

    try {
      app.userContextManager.resetContext(userId);
      if (await pathExists(currentUserDir)) {
        app.userContextManager.getContext(userId);
      }
    } catch {
      // best-effort context restore
    }

    throw error;
  }
}

async function moveDirectory(sourceDir: string, targetDir: string): Promise<void> {
  try {
    await fs.rename(sourceDir, targetDir);
  } catch (error: unknown) {
    const code = (error as NodeJS.ErrnoException | undefined)?.code;
    if (code !== 'EXDEV') {
      throw error;
    }

    await copyDirectoryRecursive(sourceDir, targetDir);
    await fs.rm(sourceDir, { recursive: true, force: true });
  }
}

async function copyDirectoryRecursive(
  sourceDir: string,
  targetDir: string,
  options?: {
    excludeNames?: Set<string>;
  },
): Promise<void> {
  await fs.mkdir(targetDir, { recursive: true });
  const entries = await fs.readdir(sourceDir, { withFileTypes: true });

  for (const entry of entries) {
    if (options?.excludeNames?.has(entry.name)) {
      continue;
    }

    const sourcePath = path.join(sourceDir, entry.name);
    const targetPath = path.join(targetDir, entry.name);

    if (entry.isDirectory()) {
      await copyDirectoryRecursive(sourcePath, targetPath, options);
      continue;
    }

    await copyFileWithMtime(sourcePath, targetPath);
  }
}

async function copyFileWithMtime(sourcePath: string, targetPath: string): Promise<void> {
  await fs.mkdir(path.dirname(targetPath), { recursive: true });
  await fs.copyFile(sourcePath, targetPath);
  const stat = await fs.stat(sourcePath);
  await fs.utimes(targetPath, stat.atime, stat.mtime);
}

async function writeTextFile(targetPath: string, content: string): Promise<void> {
  await fs.mkdir(path.dirname(targetPath), { recursive: true });
  await fs.writeFile(targetPath, content, 'utf-8');
}

async function listFilesRecursive(rootDir: string): Promise<string[]> {
  if (!(await pathExists(rootDir))) {
    return [];
  }

  const files: string[] = [];

  async function visit(currentDir: string): Promise<void> {
    const entries = await fs.readdir(currentDir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        await visit(fullPath);
        continue;
      }
      files.push(toPosixPath(path.relative(rootDir, fullPath)));
    }
  }

  await visit(rootDir);
  files.sort();
  return files;
}

async function listUserRuntimeFiles(userDir: string): Promise<string[]> {
  if (!(await pathExists(userDir))) {
    return [];
  }

  const files = await listFilesRecursive(userDir);
  return files.filter((relativePath) => !SQLITE_EPHEMERAL_FILES.has(relativePath));
}

async function generateMessagesOverview(db: BetterSqlite3.Database): Promise<string> {
  const total = ((db.prepare('SELECT COUNT(*) AS cnt FROM messages_raw').get() as { cnt: number } | undefined)?.cnt) ?? 0;
  const rows = db
    .prepare(
      `SELECT id, timestamp, sender, source_type, group_name, summary, content
       FROM messages_raw
       ORDER BY timestamp DESC
       LIMIT 50`,
    )
    .all() as Array<{
      id: string;
      timestamp: number;
      sender: string | null;
      source_type: string;
      group_name: string | null;
      summary: string | null;
      content: string;
    }>;

  const lines = [
    '# Messages Overview',
    '',
    '> Derived from memory.db export',
    '',
    `- Total messages: ${total}`,
    `- Sampled messages: ${rows.length}`,
    '',
  ];

  for (const row of rows) {
    lines.push(`## ${formatTimestamp(row.timestamp)} | ${row.sender || 'Unknown sender'} | ${row.source_type}`);
    if (row.group_name) {
      lines.push(`- Group: ${row.group_name}`);
    }
    lines.push(`- Message ID: ${row.id}`);
    if (row.summary) {
      lines.push(`- Summary: ${escapeMarkdownLine(row.summary)}`);
    }
    lines.push('', truncateMarkdownBlock(row.content), '');
  }

  return `${lines.join('\n')}\n`;
}

async function generateProfileOverview(db: BetterSqlite3.Database): Promise<string> {
  const profileItems = db
    .prepare(
      `SELECT item_type, item_key, item_value, confidence, status, updated_at
       FROM user_profile_items
       ORDER BY updated_at DESC
       LIMIT 30`,
    )
    .all() as Array<{
      item_type: string;
      item_key: string;
      item_value: string;
      confidence: number;
      status: string;
      updated_at: number;
    }>;

  const socialEdges = db
    .prepare(
      `SELECT se.relation_type, se.strength, e.name AS target_name, se.updated_at
       FROM social_edges se
       LEFT JOIN entities e ON e.id = se.to_entity_id
       ORDER BY se.updated_at DESC
       LIMIT 20`,
    )
    .all() as Array<{
      relation_type: string;
      strength: number;
      target_name: string | null;
      updated_at: number;
    }>;

  const opinions = db
    .prepare(
      `SELECT oi.dimension, oi.valence, oi.intensity, oi.status, e.name AS target_name, oi.updated_at
       FROM opinion_items oi
       LEFT JOIN entities e ON e.id = oi.target_entity_id
       ORDER BY oi.updated_at DESC
       LIMIT 20`,
    )
    .all() as Array<{
      dimension: string;
      valence: number;
      intensity: number;
      status: string;
      target_name: string | null;
      updated_at: number;
    }>;

  const agentProfiles = db
    .prepare(
      `SELECT kind, author, is_active, created_at
       FROM agent_profile_versions
       ORDER BY created_at DESC
       LIMIT 10`,
    )
    .all() as Array<{
      kind: string;
      author: string;
      is_active: number;
      created_at: number;
    }>;

  const lines = [
    '# Profile Overview',
    '',
    '> Derived from memory.db export',
    '',
    '## User Profile Items',
    '',
  ];

  if (profileItems.length === 0) {
    lines.push('- No profile items found.', '');
  } else {
    for (const item of profileItems) {
      lines.push(
        `- [${item.item_type}] ${item.item_key}: ${escapeMarkdownLine(item.item_value)} ` +
          `(confidence=${item.confidence}, status=${item.status}, updated=${formatTimestamp(item.updated_at)})`,
      );
    }
    lines.push('');
  }

  lines.push('## Social Edges', '');
  if (socialEdges.length === 0) {
    lines.push('- No social edges found.', '');
  } else {
    for (const edge of socialEdges) {
      lines.push(
        `- ${edge.relation_type} -> ${edge.target_name || 'Unknown target'} ` +
          `(strength=${edge.strength}, updated=${formatTimestamp(edge.updated_at)})`,
      );
    }
    lines.push('');
  }

  lines.push('## Opinion Items', '');
  if (opinions.length === 0) {
    lines.push('- No opinion items found.', '');
  } else {
    for (const opinion of opinions) {
      lines.push(
        `- ${opinion.dimension} on ${opinion.target_name || 'Unknown target'} ` +
          `(valence=${opinion.valence}, intensity=${opinion.intensity}, status=${opinion.status}, updated=${formatTimestamp(opinion.updated_at)})`,
      );
    }
    lines.push('');
  }

  lines.push('## Agent Profiles', '');
  if (agentProfiles.length === 0) {
    lines.push('- No agent profile versions found.', '');
  } else {
    for (const profile of agentProfiles) {
      lines.push(
        `- ${profile.kind} by ${profile.author} ` +
          `(active=${profile.is_active === 1 ? 'yes' : 'no'}, created=${formatTimestamp(profile.created_at)})`,
      );
    }
    lines.push('');
  }

  return `${lines.join('\n')}\n`;
}

async function generateEntityTimelineOverview(db: BetterSqlite3.Database): Promise<string> {
  const rows = db
    .prepare(
      `SELECT ep.entity_id, e.name AS entity_name, ep.property_key, ep.property_value, ep.action_type, ep.tx_start, ep.status
       FROM entity_properties ep
       LEFT JOIN entities e ON e.id = ep.entity_id
       ORDER BY ep.tx_start DESC
       LIMIT 60`,
    )
    .all() as Array<{
      entity_id: string;
      entity_name: string | null;
      property_key: string;
      property_value: string;
      action_type: string | null;
      tx_start: number;
      status: string;
    }>;

  const lines = [
    '# Entity Property Timeline',
    '',
    '> Derived from memory.db export',
    '',
  ];

  if (rows.length === 0) {
    lines.push('- No entity property history found.', '');
  } else {
    for (const row of rows) {
      lines.push(
        `- ${formatTimestamp(row.tx_start)} | ${row.entity_name || row.entity_id} | ${row.property_key} ` +
          `= ${escapeMarkdownLine(row.property_value)} (action=${row.action_type || 'unknown'}, status=${row.status})`,
      );
    }
    lines.push('');
  }

  return `${lines.join('\n')}\n`;
}

async function generateRelationshipOverview(db: BetterSqlite3.Database): Promise<string> {
  const rows = db
    .prepare(
      `SELECT
         r.relation_type,
         r.strength,
         r.co_occurrence_count,
         r.created_at,
         from_entity.name AS from_name,
         to_entity.name AS to_name
       FROM relationships r
       LEFT JOIN entities from_entity ON from_entity.id = r.from_entity_id
       LEFT JOIN entities to_entity ON to_entity.id = r.to_entity_id
       ORDER BY r.co_occurrence_count DESC, r.strength DESC, r.created_at DESC
       LIMIT 60`,
    )
    .all() as Array<{
      relation_type: string;
      strength: number;
      co_occurrence_count: number;
      created_at: number;
      from_name: string | null;
      to_name: string | null;
    }>;

  const lines = [
    '# Relationship Overview',
    '',
    '> Derived from memory.db export',
    '',
  ];

  if (rows.length === 0) {
    lines.push('- No relationships found.', '');
  } else {
    for (const row of rows) {
      lines.push(
        `- ${row.from_name || 'Unknown'} -> ${row.to_name || 'Unknown'} | ${row.relation_type} ` +
          `(strength=${row.strength}, co_occurrence=${row.co_occurrence_count}, created=${formatTimestamp(row.created_at)})`,
      );
    }
    lines.push('');
  }

  return `${lines.join('\n')}\n`;
}

function buildMergeSql(
  tableName: string,
  columns: string[],
  primaryKeys: string[],
): string {
  const quotedColumns = columns.map(quoteIdentifier).join(', ');
  const conflictColumns = primaryKeys.map(quoteIdentifier).join(', ');
  const updatableColumns = columns.filter((column) => !primaryKeys.includes(column));

  if (primaryKeys.length === 0 || updatableColumns.length === 0) {
    return `
      INSERT OR IGNORE INTO ${quoteIdentifier(tableName)} (${quotedColumns})
      SELECT ${quotedColumns}
      FROM importdb.${quoteIdentifier(tableName)}
    `;
  }

  const updateAssignments = updatableColumns
    .map((column) => `${quoteIdentifier(column)} = excluded.${quoteIdentifier(column)}`)
    .join(', ');

  return `
    INSERT INTO ${quoteIdentifier(tableName)} (${quotedColumns})
    SELECT ${quotedColumns}
    FROM importdb.${quoteIdentifier(tableName)}
    WHERE 1 = 1
    ON CONFLICT (${conflictColumns}) DO UPDATE
    SET ${updateAssignments}
  `;
}

function getSharedColumns(
  db: BetterSqlite3.Database,
  tableName: string,
): string[] {
  const mainColumns = getTableColumns(db, 'main', tableName);
  const importColumns = new Set(getTableColumns(db, 'importdb', tableName));
  return mainColumns.filter((column) => importColumns.has(column));
}

function getTableColumns(
  db: BetterSqlite3.Database,
  schemaName: 'main' | 'importdb',
  tableName: string,
): string[] {
  const rows = db
    .prepare(`PRAGMA ${schemaName}.table_info(${quoteIdentifier(tableName)})`)
    .all() as Array<{ name: string }>;
  return rows.map((column) => column.name);
}

function getPrimaryKeyColumns(
  db: BetterSqlite3.Database,
  tableName: string,
): string[] {
  return (db
    .prepare(`PRAGMA main.table_info(${quoteIdentifier(tableName)})`)
    .all() as Array<{ name: string; pk: number }>)
    .filter((column) => column.pk > 0)
    .sort((left, right) => left.pk - right.pk)
    .map((column) => column.name);
}

function tableExists(
  db: BetterSqlite3.Database,
  schemaName: 'main' | 'importdb',
  tableName: string,
): boolean {
  const row = db
    .prepare(
      `SELECT name
       FROM ${schemaName}.sqlite_master
       WHERE type = 'table' AND name = ?`,
    )
    .get(tableName);

  return Boolean(row);
}

function quoteIdentifier(identifier: string): string {
  return `"${identifier.replace(/"/g, '""')}"`;
}

function formatFileTimestamp(isoTimestamp: string): string {
  return isoTimestamp.replace(/\.\d{3}Z$/, 'Z').replace(/:/g, '-');
}

function formatTimestamp(timestamp: number | null | undefined): string {
  if (!timestamp) {
    return 'Unknown time';
  }

  return new Date(timestamp).toISOString();
}

function escapeMarkdownLine(value: string): string {
  return value.replace(/\n+/g, ' ').trim();
}

function truncateMarkdownBlock(value: string, maxLength = 500): string {
  const normalized = value.trim();
  if (normalized.length <= maxLength) {
    return normalized;
  }
  return `${normalized.slice(0, maxLength).trimEnd()}...`;
}

function normalizeRelativePath(relativePath: string): string {
  const normalized = toPosixPath(relativePath).replace(/^\/+/, '');
  const segments = normalized.split('/').filter(Boolean);

  if (segments.length === 0) {
    throw new MemoryBackupValidationError('Path cannot be empty');
  }
  if (segments.some((segment) => segment === '.' || segment === '..')) {
    throw new MemoryBackupValidationError(
      `Unsafe path detected: ${relativePath}`,
    );
  }

  return segments.join('/');
}

function toPosixPath(value: string): string {
  return value.replace(/\\/g, '/');
}

async function pathExists(targetPath: string): Promise<boolean> {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

function sha256(content: Buffer | string): string {
  return createHash('sha256').update(content).digest('hex');
}
