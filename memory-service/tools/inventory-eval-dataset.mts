#!/usr/bin/env node
/**
 * Phase 0 (T0) eval dataset inventory — read-only manifest, counts, hashes.
 * Does not export message text (Phase 1 waits on privacy decisions).
 *
 * Usage:
 *   npx tsx tools/inventory-eval-dataset.mts --user esone.qiu --db /path/to/memory.db
 *   npx tsx tools/inventory-eval-dataset.mts --user esone.qiu \
 *     --ssh rcadmin@10.32.56.212 --db /Users/rcadmin/personal-ai/memory-service/data/users/esone.qiu/memory.db
 *
 * Output: JSON to stdout; optional --out manifest.json
 */

import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import Database from 'better-sqlite3';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_MIGRATIONS_DIR = path.join(__dirname, '../src/storage/migrations');

interface CliOptions {
  userId: string;
  dbPath: string;
  sshTarget: string | null;
  outPath: string | null;
  userDataDir: string | null;
}

interface TableCount {
  table: string;
  count: number;
  note?: string;
}

interface SourceTypeRow {
  source_type: string;
  count: number;
  min_ts: number | null;
  max_ts: number | null;
}

interface StorylineRow {
  storyline_key: string;
  message_count: number;
  min_ts: number | null;
  max_ts: number | null;
}

interface MarkdownDirStat {
  dir: string;
  file_count: number;
  min_mtime_iso: string | null;
  max_mtime_iso: string | null;
}

export interface InventoryManifest {
  phase: 'T0';
  capturedAt: string;
  userId: string;
  database: {
    path: string;
    access: 'local_readonly' | 'remote_sqlite3_via_ssh';
    sshTarget: string | null;
    sizeBytes: number | null;
    mtimeIso: string | null;
    sha256: string | null;
  };
  migrations: {
    latestApplied: string | null;
    latestAppliedId: number | null;
    repoHeadMigration: string | null;
    behindRepo: number | null;
  };
  schemaNotes: string[];
  tableCounts: TableCount[];
  messagesRawBySource: SourceTypeRow[];
  glip: {
    total: number;
    withPlausibleTimestamp: number;
    plausibleTimestampFloor: number;
    minTimestampIso: string | null;
    maxTimestampIso: string | null;
    distinctGroups: number;
    storylines: {
      definition: string;
      total: number;
      withAtLeast2Messages: number;
      withAtLeast5Messages: number;
      withAtLeast10Messages: number;
      topStorylinesByCount: StorylineRow[];
    };
    evalSamplingHint: {
      targetIndependentStorylinesFor160Cases: number;
      storylinesMeetingMin2Messages: number;
      sufficientFor160PointDesign: boolean;
      note: string;
    };
  };
  chunks: {
    total: number;
    bySourceType: Array<{ source_type: string; count: number }>;
  };
  memoryMetadata: {
    total: number;
    byConsolidationLevel: Array<{ consolidation_level: string; count: number }>;
  };
  v3: {
    tablesPresent: string[];
    memoryUnits: number | null;
    ingestJobs: number | null;
  };
  sourceMemory: {
    capsules: number | null;
  };
  markdownDirs: MarkdownDirStat[];
  contentHashes: {
    databaseSha256: string | null;
    manifestSelfSha256: string | null;
  };
}

function parseArgs(argv: string[]): CliOptions & { skipDbHash: boolean } {
  let userId = 'esone.qiu';
  let dbPath = '';
  let sshTarget: string | null = null;
  let outPath: string | null = null;
  let userDataDir: string | null = null;
  let skipDbHash = false;

  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--user' && argv[i + 1]) {
      userId = argv[++i];
    } else if (arg === '--db' && argv[i + 1]) {
      dbPath = argv[++i];
    } else if (arg === '--ssh' && argv[i + 1]) {
      sshTarget = argv[++i];
    } else if (arg === '--out' && argv[i + 1]) {
      outPath = argv[++i];
    } else if (arg === '--user-data-dir' && argv[i + 1]) {
      userDataDir = argv[++i];
    } else if (arg === '--skip-db-hash') {
      skipDbHash = true;
    } else if (arg === '--help' || arg === '-h') {
      console.error(
        `Usage: inventory-eval-dataset.mts --user <id> --db <path> [--ssh user@host] [--user-data-dir dir] [--out file.json] [--skip-db-hash]`,
      );
      process.exit(0);
    }
  }

  if (!dbPath) {
    console.error('Missing required --db <path>');
    process.exit(1);
  }

  return { userId, dbPath, sshTarget, outPath, userDataDir, skipDbHash };
}

function tsToIso(ts: number | null | undefined): string | null {
  if (ts === null || ts === undefined || !Number.isFinite(ts)) return null;
  if (ts < 1_000_000_000) return null;
  return new Date(ts * 1000).toISOString();
}

function listRepoMigrations(): string[] {
  if (!fs.existsSync(REPO_MIGRATIONS_DIR)) return [];
  return fs
    .readdirSync(REPO_MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort();
}

function tableExists(db: DbLike, name: string): boolean {
  const row = db
    .prepare(`SELECT 1 AS ok FROM sqlite_master WHERE type='table' AND name='${name.replace(/'/g, "''")}'`)
    .get() as { ok: number } | undefined;
  return Boolean(row?.ok);
}

function columnExists(db: DbLike, table: string, column: string): boolean {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
  return cols.some((c) => c.name === column);
}

function safeCount(db: DbLike, table: string): TableCount {
  if (!tableExists(db, table)) {
    return { table, count: 0, note: 'missing' };
  }
  const row = db.prepare(`SELECT COUNT(*) AS c FROM ${table}`).get() as { c: number };
  return { table, count: row.c };
}

function runRemoteQuery(sshTarget: string, dbPath: string, sql: string): string {
  return execFileSync('ssh', ['-o', 'BatchMode=yes', '-o', 'ConnectTimeout=15', sshTarget, 'sqlite3', '-json', dbPath], {
    encoding: 'utf8',
    input: `${sql.trim()};\n`,
    maxBuffer: 64 * 1024 * 1024,
  }).trim();
}

function openRemoteDb(sshTarget: string, dbPath: string): {
  exec: (sql: string) => unknown[];
  close: () => void;
} {
  return {
    exec: (sql: string) => {
      const raw = runRemoteQuery(sshTarget, dbPath, sql);
      if (!raw) return [];
      return JSON.parse(raw) as unknown[];
    },
    close: () => {},
  };
}

/** Minimal Database-like wrapper for shared inventory SQL. */
interface DbLike {
  prepare: (sql: string) => {
    all: (...params: unknown[]) => unknown[];
    get: (...params: unknown[]) => unknown;
  };
}

function wrapRemote(sshTarget: string, dbPath: string): DbLike {
  const remote = openRemoteDb(sshTarget, dbPath);
  return {
    prepare(sql: string) {
      return {
        all(...params: unknown[]) {
          const bound = params.length
            ? sql.replace(/\?/g, () => {
                const p = params.shift();
                if (typeof p === 'string') return `'${p.replace(/'/g, "''")}'`;
                return String(p);
              })
            : sql;
          return remote.exec(bound);
        },
        get(...params: unknown[]) {
          const rows = this.all(...params);
          return rows[0] ?? undefined;
        },
      };
    },
  };
}

function remoteFileStat(
  sshTarget: string,
  dbPath: string,
  skipHash: boolean,
): { sizeBytes: number; mtimeIso: string; sha256: string | null } {
  const escapedPath = dbPath.replace(/'/g, "'\\''");
  const statCmd = `stat -f '%z %m' '${escapedPath}'`;
  const statOut = execFileSync(
    'ssh',
    ['-o', 'BatchMode=yes', sshTarget, statCmd],
    { encoding: 'utf8' },
  ).trim();
  const statParts = statOut.split(/\s+/);
  const sizeBytes = Number(statParts[0]);
  const mtimeSec = Number(statParts[1]);
  if (!Number.isFinite(sizeBytes) || !Number.isFinite(mtimeSec)) {
    throw new Error(`Failed to parse remote stat output: ${JSON.stringify(statOut)}`);
  }
  let sha256: string | null = null;
  if (!skipHash) {
    const hashOut = execFileSync(
      'ssh',
      ['-o', 'BatchMode=yes', sshTarget, `shasum -a 256 '${escapedPath}'`],
      { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 },
    ).trim();
    sha256 = hashOut.split(/\s+/)[0] ?? null;
  }
  return { sizeBytes, mtimeIso: new Date(mtimeSec * 1000).toISOString(), sha256 };
}

function scanMarkdownDirs(userDataDir: string | null): MarkdownDirStat[] {
  if (!userDataDir || !fs.existsSync(userDataDir)) return [];
  const subdirs = ['daily', 'projects', 'reflection-threads', 'dreams', 'reports', 'agent', 'entities'];
  const stats: MarkdownDirStat[] = [];
  for (const dir of subdirs) {
    const full = path.join(userDataDir, dir);
    if (!fs.existsSync(full)) {
      stats.push({ dir, file_count: 0, min_mtime_iso: null, max_mtime_iso: null });
      continue;
    }
    let count = 0;
    let minM = Infinity;
    let maxM = -Infinity;
    const stack = [full];
    while (stack.length) {
      const cur = stack.pop()!;
      for (const ent of fs.readdirSync(cur, { withFileTypes: true })) {
        const p = path.join(cur, ent.name);
        if (ent.isDirectory()) stack.push(p);
        else if (ent.isFile() && ent.name.endsWith('.md')) {
          count++;
          const m = fs.statSync(p).mtimeMs;
          minM = Math.min(minM, m);
          maxM = Math.max(maxM, m);
        }
      }
    }
    stats.push({
      dir,
      file_count: count,
      min_mtime_iso: count ? new Date(minM).toISOString() : null,
      max_mtime_iso: count ? new Date(maxM).toISOString() : null,
    });
  }
  return stats;
}

function buildInventory(
  db: DbLike & { close?: () => void },
  opts: CliOptions,
  dbMeta: InventoryManifest['database'],
): InventoryManifest {
  const schemaNotes: string[] = [];
  const repoMigs = listRepoMigrations();
  const repoHead = repoMigs[repoMigs.length - 1] ?? null;

  const migRow = db
    .prepare(`SELECT id, filename FROM _migrations ORDER BY id DESC LIMIT 1`)
    .get() as { id: number; filename: string } | undefined;

  const latestApplied = migRow?.filename ?? null;
  const latestId = migRow?.id ?? null;
  let behindRepo: number | null = null;
  if (latestApplied && repoMigs.length) {
    const idx = repoMigs.indexOf(latestApplied);
    behindRepo = idx >= 0 ? repoMigs.length - 1 - idx : null;
  }

  const coreTables = [
    'messages_raw',
    'chunks',
    'memory_metadata',
    'entities',
    'reflection_threads',
    'source_memory_capsules',
    'memory_units',
    'ingest_jobs',
    'memory_import_batches',
    'calendar_events',
  ];
  const tableCounts = coreTables.map((t) => safeCount(db, t));

  const messagesRawBySource = db
    .prepare(
      `SELECT source_type, COUNT(*) AS count,
              MIN(timestamp) AS min_ts, MAX(timestamp) AS max_ts
       FROM messages_raw GROUP BY source_type ORDER BY count DESC`,
    )
    .all() as SourceTypeRow[];

  const PLAUSIBLE_FLOOR = 1_577_836_800; // 2020-01-01 UTC
  const glipTotalRow = db
    .prepare(`SELECT COUNT(*) AS c FROM messages_raw WHERE source_type='glip'`)
    .get() as { c: number };
  const glipPlausibleRow = db
    .prepare(
      `SELECT COUNT(*) AS c, MIN(timestamp) AS min_ts, MAX(timestamp) AS max_ts
       FROM messages_raw WHERE source_type='glip' AND timestamp >= ${PLAUSIBLE_FLOOR}`,
    )
    .get() as { c: number; min_ts: number; max_ts: number };

  const distinctGroupsRow = db
    .prepare(
      `SELECT COUNT(DISTINCT COALESCE(NULLIF(group_id,''), 'unknown')) AS c
       FROM messages_raw WHERE source_type='glip'`,
    )
    .get() as { c: number };

  // Storyline: group_id + thread root from metadata (fallback post id / row id)
  const storylineSql = `
    SELECT storyline_key, COUNT(*) AS message_count,
           MIN(timestamp) AS min_ts, MAX(timestamp) AS max_ts
    FROM (
      SELECT id,
             COALESCE(NULLIF(group_id,''), 'unknown') AS gid,
             timestamp,
             (COALESCE(NULLIF(group_id,''), 'unknown') || ':' || COALESCE(
               CASE WHEN json_valid(COALESCE(metadata_json,''))
                 THEN NULLIF(json_extract(metadata_json, '$.threadRootPostId'), '')
               END,
               CASE WHEN json_valid(COALESCE(metadata_json,''))
                 THEN NULLIF(json_extract(metadata_json, '$.postId'), '')
               END,
               id
             )) AS storyline_key
      FROM messages_raw
      WHERE source_type='glip'
    )
    GROUP BY storyline_key
    ORDER BY message_count DESC
  `;
  const storylineRows = db.prepare(storylineSql).all() as StorylineRow[];
  const with2 = storylineRows.filter((r) => r.message_count >= 2).length;
  const with5 = storylineRows.filter((r) => r.message_count >= 5).length;
  const with10 = storylineRows.filter((r) => r.message_count >= 10).length;

  const TARGET_STORYLINES = 20;
  const sufficient = with2 >= TARGET_STORYLINES;

  if (!columnExists(db, 'messages_raw', 'origin_class')) {
    schemaNotes.push('messages_raw.origin_class 未迁移（074+）；promotion 视图统计跳过');
  }

  const chunksTotal = safeCount(db, 'chunks');
  const chunksBySource = tableExists(db, 'chunks')
    ? (db
        .prepare(
          `SELECT COALESCE(source_type, 'null') AS source_type, COUNT(*) AS count
           FROM chunks GROUP BY source_type ORDER BY count DESC LIMIT 20`,
        )
        .all() as Array<{ source_type: string; count: number }>)
    : [];

  const metaTotal = safeCount(db, 'memory_metadata');
  const metaByLevel = tableExists(db, 'memory_metadata')
    ? (db
        .prepare(
          `SELECT consolidation_level, COUNT(*) AS count
           FROM memory_metadata GROUP BY consolidation_level`,
        )
        .all() as Array<{ consolidation_level: string; count: number }>)
    : [];

  const v3Tables = ['memory_units', 'ingest_jobs', 'memory_unit_sources'].filter((t) =>
    tableExists(db, t),
  );
  const memoryUnits = v3Tables.includes('memory_units')
    ? (db.prepare(`SELECT COUNT(*) AS c FROM memory_units`).get() as { c: number }).c
    : null;
  const ingestJobs = v3Tables.includes('ingest_jobs')
    ? (db.prepare(`SELECT COUNT(*) AS c FROM ingest_jobs`).get() as { c: number }).c
    : null;

  const capsules = tableExists(db, 'source_memory_capsules')
    ? (db.prepare(`SELECT COUNT(*) AS c FROM source_memory_capsules`).get() as { c: number }).c
    : null;

  const markdownDirs = scanMarkdownDirs(opts.userDataDir);

  const manifest: InventoryManifest = {
    phase: 'T0',
    capturedAt: new Date().toISOString(),
    userId: opts.userId,
    database: dbMeta,
    migrations: {
      latestApplied,
      latestAppliedId: latestId,
      repoHeadMigration: repoHead,
      behindRepo,
    },
    schemaNotes,
    tableCounts,
    messagesRawBySource,
    glip: {
      total: glipTotalRow.c,
      withPlausibleTimestamp: glipPlausibleRow.c,
      plausibleTimestampFloor: PLAUSIBLE_FLOOR,
      minTimestampIso: tsToIso(glipPlausibleRow.min_ts),
      maxTimestampIso: tsToIso(glipPlausibleRow.max_ts),
      distinctGroups: distinctGroupsRow.c,
      storylines: {
        definition:
          'group_id : coalesce(metadata.threadRootPostId, metadata.postId, messages_raw.id)',
        total: storylineRows.length,
        withAtLeast2Messages: with2,
        withAtLeast5Messages: with5,
        withAtLeast10Messages: with10,
        topStorylinesByCount: storylineRows.slice(0, 15),
      },
      evalSamplingHint: {
        targetIndependentStorylinesFor160Cases: TARGET_STORYLINES,
        storylinesMeetingMin2Messages: with2,
        sufficientFor160PointDesign: sufficient,
        note: sufficient
          ? '独立 storyline（≥2 条 glip）数量达到 LongMemEval/本项 160 点设计对「≥20 条故事线」的下限；仍需按场景分层抽样，不能假设每线可产 8 个判定点。'
          : '独立 storyline 不足 20 条（≥2 消息/线）；160 判定点需放宽单线采样、降低每线判定点数，或扩大导出时间窗/补历史回填。',
      },
    },
    chunks: {
      total: chunksTotal.count,
      bySourceType: chunksBySource,
    },
    memoryMetadata: {
      total: metaTotal.count,
      byConsolidationLevel: metaByLevel,
    },
    v3: {
      tablesPresent: v3Tables,
      memoryUnits,
      ingestJobs,
    },
    sourceMemory: { capsules },
    markdownDirs,
    contentHashes: {
      databaseSha256: dbMeta.sha256,
      manifestSelfSha256: null,
    },
  };

  return manifest;
}

async function hashFileSha256(filePath: string): Promise<string> {
  const hash = createHash('sha256');
  const fd = fs.createReadStream(filePath);
  await new Promise<void>((resolve, reject) => {
    fd.on('data', (chunk) => hash.update(chunk));
    fd.on('error', reject);
    fd.on('end', () => resolve());
  });
  return hash.digest('hex');
}

async function main(): Promise<void> {
  const opts = parseArgs(process.argv);

  if (!opts.userDataDir && !opts.sshTarget) {
    opts.userDataDir = path.join(path.dirname(opts.dbPath), '..');
    if (!fs.existsSync(opts.userDataDir)) opts.userDataDir = null;
  }

  let manifest: InventoryManifest;

  if (opts.sshTarget) {
    const stat = remoteFileStat(opts.sshTarget, opts.dbPath, opts.skipDbHash);
    const db = wrapRemote(opts.sshTarget, opts.dbPath);
    manifest = buildInventory(db, opts, {
      path: opts.dbPath,
      access: 'remote_sqlite3_via_ssh',
      sshTarget: opts.sshTarget,
      sizeBytes: stat.sizeBytes,
      mtimeIso: stat.mtimeIso,
      sha256: stat.sha256,
    });
  } else {
    if (!fs.existsSync(opts.dbPath)) {
      console.error(`Database not found: ${opts.dbPath}`);
      process.exit(1);
    }
    const st = fs.statSync(opts.dbPath);
    const sha256 = opts.skipDbHash ? null : await hashFileSha256(opts.dbPath);
    const db = new Database(opts.dbPath, { readonly: true, fileMustExist: true });
    try {
      manifest = buildInventory(db, opts, {
        path: opts.dbPath,
        access: 'local_readonly',
        sshTarget: null,
        sizeBytes: st.size,
        mtimeIso: st.mtime.toISOString(),
        sha256,
      });
    } finally {
      db.close();
    }
  }

  const json = JSON.stringify(manifest, null, 2);
  manifest.contentHashes.manifestSelfSha256 = createHash('sha256').update(json).digest('hex');
  const finalJson = JSON.stringify(manifest, null, 2);

  if (opts.outPath) {
    fs.mkdirSync(path.dirname(opts.outPath), { recursive: true });
    fs.writeFileSync(opts.outPath, finalJson, 'utf8');
  }
  process.stdout.write(finalJson);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
