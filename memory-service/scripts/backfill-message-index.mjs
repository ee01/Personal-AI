#!/usr/bin/env node
/**
 * Memory index backfill for messages_raw → chunks + chunks_vec.
 * See docs/progressing/memory-index-backfill-plan.md
 *
 * Usage (inside memory-service container):
 *   node scripts/backfill-message-index.mjs --db-path /app/data/users/esone.qiu/memory.db
 *   node scripts/backfill-message-index.mjs --db-path ... --apply --tier all
 */

import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import Database from 'better-sqlite3';

import { chunkText } from '../dist/utils/chunking.js';
import { EmbeddingClient } from '../dist/llm/EmbeddingClient.js';

const require = createRequire(import.meta.url);

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const EPOCH_FLOOR = 946684800; // 2000-01-01

function contentHash(text) {
  return createHash('sha256').update(text, 'utf8').digest('hex');
}

function now() {
  return Math.floor(Date.now() / 1000);
}

function parseArgs(argv) {
  const opts = {
    dbPath: '',
    apply: false,
    tier: 'all',
    batchSize: 300,
    pauseMs: 200,
    skipBackup: false,
    sequentialEmbed: false,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const next = argv[i + 1];
    if (arg === '--db-path' && next) {
      opts.dbPath = path.resolve(next);
      i += 1;
    } else if (arg === '--apply') {
      opts.apply = true;
    } else if (arg === '--tier' && next) {
      opts.tier = next;
      i += 1;
    } else if (arg === '--batch-size' && next) {
      opts.batchSize = Number(next);
      i += 1;
    } else if (arg === '--pause-ms' && next) {
      opts.pauseMs = Number(next);
      i += 1;
    } else if (arg === '--skip-backup') {
      opts.skipBackup = true;
    } else if (arg === '--sequential-embed') {
      opts.sequentialEmbed = true;
    } else if (arg === '--help') {
      printHelp();
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  if (!opts.dbPath || !fs.existsSync(opts.dbPath)) {
    throw new Error('--db-path must point to an existing SQLite database');
  }
  if (!['tier3', 'tier0', 'tier1', 'all'].includes(opts.tier)) {
    throw new Error('--tier must be tier3, tier0, tier1, or all');
  }
  return opts;
}

function printHelp() {
  console.log(`Usage: node scripts/backfill-message-index.mjs --db-path <path> [--apply] [--tier all|tier3|tier0|tier1]`);
}

function openDb(dbPath, readonly) {
  const db = new Database(dbPath, readonly ? { readonly: true } : undefined);
  db.pragma('foreign_keys = ON');
  db.pragma('busy_timeout = 30000');
  try {
    const sqliteVec = require('sqlite-vec');
    db.loadExtension(sqliteVec.getLoadablePath());
  } catch (err) {
    console.warn('[backfill] sqlite-vec not loaded:', err instanceof Error ? err.message : String(err));
  }
  if (readonly) db.pragma('query_only = ON');
  return db;
}

function collectStats(db) {
  const msgChunks = db
    .prepare(`SELECT COUNT(*) AS c FROM chunks WHERE file_path LIKE 'messages/%'`)
    .get().c;
  const totalMsgs = db.prepare(`SELECT COUNT(*) AS c FROM messages_raw`).get().c;
  const missingChunks = db
    .prepare(
      `SELECT COUNT(*) AS c FROM messages_raw m
       WHERE m.content IS NOT NULL AND TRIM(m.content) != ''
         AND NOT EXISTS (
           SELECT 1 FROM chunks c WHERE c.file_path = 'messages/' || m.id
         )`,
    )
    .get().c;
  const chunksVec = db.prepare(`SELECT COUNT(*) AS c FROM chunks_vec`).get().c;
  const msgChunksMissingVec = db
    .prepare(
      `SELECT COUNT(*) AS c FROM chunks c
       WHERE c.file_path LIKE 'messages/%'
         AND NOT EXISTS (
           SELECT 1 FROM chunks_vec v WHERE v.chunk_id = c.chunk_id
         )`,
    )
    .get().c;
  const badTs = db
    .prepare(`SELECT COUNT(*) AS c FROM messages_raw WHERE timestamp < ?`)
    .get(EPOCH_FLOOR).c;
  const badMeta = db
    .prepare(
      `SELECT COUNT(*) AS c FROM messages_raw
       WHERE metadata_json IS NOT NULL AND TRIM(metadata_json) != ''
         AND json_valid(metadata_json) = 0`,
    )
    .get().c;
  const monthly = db
    .prepare(
      `SELECT strftime('%Y-%m', datetime(m.timestamp, 'unixepoch')) AS month,
              COUNT(*) AS total,
              SUM(CASE WHEN EXISTS (
                SELECT 1 FROM chunks c WHERE c.file_path = 'messages/' || m.id
              ) THEN 1 ELSE 0 END) AS chunked
       FROM messages_raw m
       GROUP BY month
       ORDER BY month`,
    )
    .all();
  return {
    msgChunks,
    totalMsgs,
    missingChunks,
    chunksVec,
    msgChunksMissingVec,
    badTimestamps: badTs,
    badMetadata: badMeta,
    monthly,
  };
}

function ensureProgressTable(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS backfill_progress (
      tier TEXT NOT NULL,
      last_message_id TEXT,
      done_count INTEGER NOT NULL DEFAULT 0,
      updated_at INTEGER NOT NULL,
      PRIMARY KEY (tier)
    );
  `);
}

function getCheckpoint(db, tier) {
  return db
    .prepare(`SELECT last_message_id, done_count FROM backfill_progress WHERE tier = ?`)
    .get(tier);
}

function setCheckpoint(db, tier, lastMessageId, doneCount) {
  db.prepare(
    `INSERT INTO backfill_progress (tier, last_message_id, done_count, updated_at)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(tier) DO UPDATE SET
       last_message_id = excluded.last_message_id,
       done_count = excluded.done_count,
       updated_at = excluded.updated_at`,
  ).run(tier, lastMessageId, doneCount, now());
}

function backupDatabase(dbPath) {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupPath = `${dbPath}.backfill-backup-${stamp}.db`;
  const db = openDb(dbPath, false);
  try {
    db.exec(`VACUUM INTO '${backupPath.replace(/'/g, "''")}'`);
    const check = db.prepare('PRAGMA quick_check').all();
    const failed = check.some((row) => row.quick_check !== 'ok');
    if (failed) throw new Error(`quick_check failed: ${JSON.stringify(check)}`);
    const stats = collectStats(db);
    console.log(`[backup] wrote ${backupPath}`);
    console.log(`[backup] baseline stats: ${JSON.stringify(stats, null, 2)}`);
    return { backupPath, stats };
  } finally {
    db.close();
  }
}

function recoverTimestamp(row) {
  const candidates = [];
  for (const raw of [row.updated_at, row.created_at]) {
    const ts = Number(raw);
    if (Number.isFinite(ts) && ts >= EPOCH_FLOOR) candidates.push(ts);
  }
  if (row.metadata_json && jsonValid(row.metadata_json)) {
    try {
      const meta = JSON.parse(row.metadata_json);
      for (const key of [
        'timestamp',
        'creationTime',
        'createdTime',
        'lastModifiedTime',
        'dateCreated',
        'dateSent',
        'sentAt',
        'time',
      ]) {
        const raw = meta[key];
        if (raw == null) continue;
        let ts = Number(raw);
        if (!Number.isFinite(ts)) {
          const parsed = Date.parse(String(raw));
          if (Number.isFinite(parsed)) ts = Math.floor(parsed / 1000);
        } else if (ts > 1e12) {
          ts = Math.floor(ts / 1000);
        }
        if (ts >= EPOCH_FLOOR) candidates.push(ts);
      }
    } catch {
      // ignore parse errors
    }
  }
  if (candidates.length === 0) return null;
  return Math.max(...candidates);
}

function resolveTimestamp(row) {
  const recovered = recoverTimestamp(row);
  if (recovered != null) return { ts: recovered, source: 'recovered' };
  if (Number(row.updated_at) >= EPOCH_FLOOR) {
    return { ts: Number(row.updated_at), source: 'updated_at' };
  }
  if (Number(row.created_at) >= EPOCH_FLOOR) {
    return { ts: Number(row.created_at), source: 'created_at' };
  }
  return { ts: now(), source: 'now' };
}

function jsonValid(value) {
  try {
    JSON.parse(value);
    return true;
  } catch {
    return false;
  }
}

function repairMetadataJson(raw) {
  if (!raw || raw.trim() === '') return { value: '{}', repaired: true };
  if (jsonValid(raw)) return { value: raw, repaired: false };
  const trimmed = raw.trim();
  // Common truncation: try closing braces
  for (const suffix of ['"}', '}', ']}', '"}]}', '"}]}'] ) {
    const attempt = trimmed + suffix;
    if (jsonValid(attempt)) return { value: attempt, repaired: true };
  }
  return { value: '{}', repaired: true };
}

function runTier3(db, opts) {
  const badTsRows = db
    .prepare(
      `SELECT id, timestamp, created_at, updated_at, metadata_json
       FROM messages_raw
       WHERE timestamp < ?
       ORDER BY id`,
    )
    .all(EPOCH_FLOOR);
  const badMetaRows = db
    .prepare(
      `SELECT id, metadata_json
       FROM messages_raw
       WHERE metadata_json IS NOT NULL AND TRIM(metadata_json) != ''
         AND json_valid(metadata_json) = 0
       ORDER BY id`,
    )
    .all();

  console.log(`[tier3] bad timestamps: ${badTsRows.length}, bad metadata: ${badMetaRows.length}`);
  if (!opts.apply) return { timestampsFixed: 0, metadataFixed: 0, dryRun: true };

  const updateTs = db.prepare(
    `UPDATE messages_raw
     SET timestamp = ?, metadata_json = ?, updated_at = ?
     WHERE id = ?`,
  );
  const updateMeta = db.prepare(
    `UPDATE messages_raw SET metadata_json = ?, updated_at = ? WHERE id = ?`,
  );

  let timestampsFixed = 0;
  const fixTs = db.transaction(() => {
    for (const row of badTsRows) {
      const { ts, source } = resolveTimestamp(row);
      let meta = {};
      if (row.metadata_json && jsonValid(row.metadata_json)) {
        meta = JSON.parse(row.metadata_json);
      }
      meta.timestamp_recovered = true;
      meta.timestamp_fallback = source;
      updateTs.run(ts, JSON.stringify(meta), now(), row.id);
      timestampsFixed += 1;
    }
  });
  fixTs();

  const syncChunkTs = db.prepare(
    `UPDATE chunks
     SET created_at = (
       SELECT m.timestamp FROM messages_raw m
       WHERE m.id = chunks.related_entity_id
     )
     WHERE file_path LIKE 'messages/%'
       AND created_at < ?
       AND related_entity_id IS NOT NULL`,
  );
  const chunksSynced = opts.apply ? syncChunkTs.run(EPOCH_FLOOR).changes : 0;

  let metadataFixed = 0;
  const fixMeta = db.transaction(() => {
    for (const row of badMetaRows) {
      const { value, repaired } = repairMetadataJson(row.metadata_json);
      if (!repaired) continue;
      let meta = {};
      try {
        meta = JSON.parse(value);
      } catch {
        meta = {};
      }
      meta.metadata_repaired = true;
      updateMeta.run(JSON.stringify(meta), now(), row.id);
      metadataFixed += 1;
    }
  });
  fixMeta();

  return { timestampsFixed, metadataFixed, chunksSynced, dryRun: false };
}

function selectMissingMessages(db, afterId, limit) {
  return db
    .prepare(
      `SELECT m.id, m.content, m.scope, m.source, m.source_type, m.trust_class, m.timestamp
       FROM messages_raw m
       WHERE m.content IS NOT NULL AND TRIM(m.content) != ''
         AND NOT EXISTS (
           SELECT 1 FROM chunks c WHERE c.file_path = 'messages/' || m.id
         )
         AND (? IS NULL OR m.id > ?)
       ORDER BY m.id
       LIMIT ?`,
    )
    .all(afterId, afterId, limit);
}

function runTier0(db, opts) {
  if (!opts.apply) {
    const sample = selectMissingMessages(db, null, opts.batchSize * 3);
    return {
      messagesProcessed: sample.length,
      chunksCreated: 0,
      doneCount: 0,
      dryRun: true,
      sampleWouldProcess: sample.length,
    };
  }

  ensureProgressTable(db);
  const checkpoint = getCheckpoint(db, 'tier0');
  let afterId = checkpoint?.last_message_id ?? null;
  let doneCount = checkpoint?.done_count ?? 0;

  const deleteChunks = db.prepare(`DELETE FROM chunks WHERE file_path = ?`);
  const insertChunk = db.prepare(
    `INSERT INTO chunks
      (file_path, line_start, line_end, content, content_hash,
       scope, source, source_type, related_entity_id, trust_class, token_count, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );

  let batchNum = 0;
  let chunksCreated = 0;
  let messagesProcessed = 0;

  while (true) {
    const batch = selectMissingMessages(db, afterId, opts.batchSize);
    if (batch.length === 0) break;
    batchNum += 1;

    const processBatch = db.transaction(() => {
      for (const row of batch) {
        const filePath = `messages/${row.id}`;
        deleteChunks.run(filePath);
        const chunks = chunkText(row.content, 400, 80);
        for (const chunk of chunks) {
          insertChunk.run(
            filePath,
            chunk.lineStart,
            chunk.lineEnd,
            chunk.content,
            contentHash(chunk.content),
            row.scope ?? 'work',
            row.source ?? null,
            row.source_type ?? 'glip',
            row.id,
            row.trust_class ?? null,
            chunk.tokenCount,
            row.timestamp ?? now(),
          );
          chunksCreated += 1;
        }
        messagesProcessed += 1;
        afterId = row.id;
        doneCount += 1;
      }
      setCheckpoint(db, 'tier0', afterId, doneCount);
    });
    processBatch();

    console.log(
      `[tier0] batch ${batchNum}: +${batch.length} msgs, total done ${doneCount}, chunks +${chunksCreated}`,
    );
    if (opts.pauseMs > 0) {
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, opts.pauseMs);
    }
  }

  // Gap-fill: messages ingested during backfill may have ids lexicographically
  // before the checkpoint cursor and would be skipped by id > afterId.
  let gapFillBatches = 0;
  while (true) {
    const gapBatch = selectMissingMessages(db, null, opts.batchSize);
    if (gapBatch.length === 0) break;
    gapFillBatches += 1;
    const processGap = db.transaction(() => {
      for (const row of gapBatch) {
        const filePath = `messages/${row.id}`;
        deleteChunks.run(filePath);
        const chunks = chunkText(row.content, 400, 80);
        for (const chunk of chunks) {
          insertChunk.run(
            filePath,
            chunk.lineStart,
            chunk.lineEnd,
            chunk.content,
            contentHash(chunk.content),
            row.scope ?? 'work',
            row.source ?? null,
            row.source_type ?? 'glip',
            row.id,
            row.trust_class ?? null,
            chunk.tokenCount,
            row.timestamp ?? now(),
          );
          chunksCreated += 1;
        }
        messagesProcessed += 1;
        doneCount += 1;
      }
      setCheckpoint(db, 'tier0', gapBatch[gapBatch.length - 1].id, doneCount);
    });
    processGap();
    console.log(
      `[tier0] gap-fill batch ${gapFillBatches}: +${gapBatch.length} msgs, total done ${doneCount}`,
    );
  }

  return { messagesProcessed, chunksCreated, doneCount, dryRun: !opts.apply, gapFillBatches };
}

async function runTier1(db, opts) {
  const selectMissing = db.prepare(
    `SELECT c.chunk_id, c.content
     FROM chunks c
     WHERE c.file_path LIKE 'messages/%'
       AND c.chunk_id > ?
       AND NOT EXISTS (
         SELECT 1 FROM chunks_vec v WHERE v.chunk_id = c.chunk_id
       )
     ORDER BY c.chunk_id
     LIMIT ?`,
  );

  if (!opts.apply) {
    const sample = selectMissing.all(0, opts.batchSize * 3);
    return {
      embedded: sample.length,
      doneCount: 0,
      failures: [],
      dryRun: true,
      sampleWouldEmbed: sample.length,
    };
  }

  ensureProgressTable(db);
  const insertVec = db.prepare(
    `INSERT INTO chunks_vec (chunk_id, embedding) VALUES (CAST(? AS INTEGER), ?)`,
  );

  const checkpoint = getCheckpoint(db, 'tier1');
  let afterChunkId = checkpoint?.last_message_id
    ? Number(checkpoint.last_message_id)
    : 0;
  let doneCount = checkpoint?.done_count ?? 0;

  let embeddingClient = null;
  embeddingClient = await EmbeddingClient.getInstance();
  console.log(`[tier1] embedding model: ${EmbeddingClient.getModelName()}`);

  let batchNum = 0;
  let embedded = 0;
  const failures = [];

  while (true) {
    console.log(`[tier1] selecting batch after chunk_id=${afterChunkId}...`);
    const batch = selectMissing.all(afterChunkId, opts.batchSize);
    console.log(`[tier1] selected ${batch.length} chunks`);
    if (batch.length === 0) break;
    batchNum += 1;

    const texts = batch.map((row) => row.content);
    let vectors;
    try {
      console.log(`[tier1] embedding batch ${batchNum}...`);
      if (opts.sequentialEmbed) {
        vectors = [];
        for (const text of texts) {
          vectors.push(await embeddingClient.embed(text));
        }
      } else {
        vectors = await embeddingClient.embedBatch(texts);
      }
      console.log(`[tier1] embedded batch ${batchNum}, dim=${vectors[0]?.length}`);
    } catch (err) {
      console.error(`[tier1] embedBatch failed at chunk_id>${afterChunkId}:`, err);
      failures.push({ afterChunkId, error: String(err) });
      break;
    }

    const writeBatch = db.transaction(() => {
      for (let i = 0; i < batch.length; i += 1) {
        const row = batch[i];
        insertVec.run(row.chunk_id, JSON.stringify(vectors[i]));
        embedded += 1;
        afterChunkId = row.chunk_id;
        doneCount += 1;
        setCheckpoint(db, 'tier1', String(afterChunkId), doneCount);
      }
    });
    writeBatch();

    console.log(`[tier1] batch ${batchNum}: embedded ${batch.length}, total ${doneCount}`);
    if (opts.pauseMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, opts.pauseMs));
    }
  }

  const selectMissingAny = db.prepare(
    `SELECT c.chunk_id, c.content
     FROM chunks c
     WHERE c.file_path LIKE 'messages/%'
       AND NOT EXISTS (
         SELECT 1 FROM chunks_vec v WHERE v.chunk_id = c.chunk_id
       )
     ORDER BY c.chunk_id
     LIMIT ?`,
  );

  let gapFillBatches = 0;
  while (true) {
    const gapBatch = selectMissingAny.all(opts.batchSize);
    if (gapBatch.length === 0) break;
    gapFillBatches += 1;
    const texts = gapBatch.map((row) => row.content);
    let vectors;
    try {
      if (opts.sequentialEmbed) {
        vectors = [];
        for (const text of texts) {
          vectors.push(await embeddingClient.embed(text));
        }
      } else {
        vectors = await embeddingClient.embedBatch(texts);
      }
    } catch (err) {
      console.error(`[tier1] gap-fill embed failed:`, err);
      failures.push({ gapFillBatches, error: String(err) });
      break;
    }
    const writeGap = db.transaction(() => {
      for (let i = 0; i < gapBatch.length; i += 1) {
        const row = gapBatch[i];
        insertVec.run(row.chunk_id, JSON.stringify(vectors[i]));
        embedded += 1;
        doneCount += 1;
        setCheckpoint(db, 'tier1', String(row.chunk_id), doneCount);
      }
    });
    writeGap();
    console.log(`[tier1] gap-fill batch ${gapFillBatches}: embedded ${gapBatch.length}, total ${doneCount}`);
  }

  return { embedded, doneCount, failures, dryRun: !opts.apply, gapFillBatches };
}

process.on('uncaughtException', (err) => {
  console.error('[backfill] uncaughtException:', err);
  process.exit(1);
});
process.on('unhandledRejection', (err) => {
  console.error('[backfill] unhandledRejection:', err);
  process.exit(1);
});

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const tiers =
    opts.tier === 'all' ? ['tier3', 'tier0', 'tier1'] : [opts.tier];

  console.log(
    JSON.stringify(
      {
        mode: opts.apply ? 'APPLY' : 'DRY_RUN',
        dbPath: opts.dbPath,
        tiers,
        batchSize: opts.batchSize,
        script: path.join(__dirname, 'backfill-message-index.mjs'),
      },
      null,
      2,
    ),
  );

  const readDb = openDb(opts.dbPath, true);
  const before = collectStats(readDb);
  readDb.close();
  console.log('[stats] before:', JSON.stringify(before, null, 2));

  if (opts.apply && !opts.skipBackup) {
    backupDatabase(opts.dbPath);
  }

  const db = openDb(opts.dbPath, !opts.apply);
  const results = {};

  try {
    if (tiers.includes('tier3')) {
      results.tier3 = runTier3(db, opts);
      console.log('[tier3] result:', results.tier3);
    }
    if (tiers.includes('tier0')) {
      results.tier0 = runTier0(db, opts);
      console.log('[tier0] result:', results.tier0);
    }
    if (tiers.includes('tier1')) {
      db.pragma('query_only = OFF');
      results.tier1 = await runTier1(db, opts);
      console.log('[tier1] result:', results.tier1);
    }
  } finally {
    db.close();
  }

  const afterDb = openDb(opts.dbPath, true);
  const after = collectStats(afterDb);
  afterDb.close();
  console.log('[stats] after:', JSON.stringify(after, null, 2));
  console.log('[done]', JSON.stringify({ results, before, after }, null, 2));
}

main().catch((err) => {
  console.error('[backfill-message-index] failed:', err);
  if (err && err.stack) console.error(err.stack);
  process.exit(1);
});
