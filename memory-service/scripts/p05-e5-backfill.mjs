#!/usr/bin/env node
/**
 * P0.5 variant-D corpus build: embed all message chunks with
 * Xenova/multilingual-e5-small ("passage: " prefix) into chunks_vec_e5.
 *
 * This table is EXPERIMENT-ONLY (shadow): production retrieval never reads
 * it; it exists so the ablation runner can compare dense channels fairly.
 * e5 requires the `passage:`/`query:` prefixes — a model missing them is a
 * different configuration and never shares thresholds or indexes with
 * MiniLM (plan §5.5).
 *
 * Usage (inside container):
 *   node scripts/p05-e5-backfill.mjs --db-path /app/data/users/esone.qiu/memory.db
 */

import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const Database = require('better-sqlite3');

const BATCH = 40;
const PAUSE_MS = 200;

function parseArgs(argv) {
  const opts = { dbPath: '' };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--db-path' && argv[i + 1]) opts.dbPath = argv[++i];
  }
  if (!opts.dbPath) throw new Error('--db-path required');
  return opts;
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const db = new Database(opts.dbPath);
  db.pragma('busy_timeout = 30000');
  const sqliteVec = require('sqlite-vec');
  db.loadExtension(sqliteVec.getLoadablePath());

  db.exec(`DROP TABLE IF EXISTS chunks_vec_e5`);
  db.exec(`CREATE VIRTUAL TABLE chunks_vec_e5 USING vec0(chunk_id INTEGER PRIMARY KEY, embedding float[384])`);

  const { pipeline } = await import('@xenova/transformers');
  const extract = await pipeline('feature-extraction', 'Xenova/multilingual-e5-small', { quantized: true });
  const insert = db.prepare(`INSERT INTO chunks_vec_e5 (chunk_id, embedding) VALUES (CAST(? AS INTEGER), ?)`);

  const rows = db
    .prepare(`SELECT chunk_id, content FROM chunks WHERE file_path LIKE 'messages/%' ORDER BY chunk_id`)
    .all();

  console.log(`[e5-backfill] embedding ${rows.length} message chunks with passage prefix`);
  const started = Date.now();
  let done = 0;
  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH);
    const vectors = [];
    for (const row of batch) {
      const out = await extract(`passage: ${row.content}`, { pooling: 'mean', normalize: true });
      vectors.push(out.tolist()[0]);
    }
    const tx = db.transaction(() => {
      for (let j = 0; j < batch.length; j += 1) {
        insert.run(batch[j].chunk_id, JSON.stringify(vectors[j]));
        done += 1;
      }
    });
    tx();
    if ((i / BATCH) % 20 === 0) {
      const rate = done / Math.max(1, (Date.now() - started) / 1000);
      console.log(`[e5-backfill] ${done}/${rows.length} (${rate.toFixed(1)}/s)`);
    }
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, PAUSE_MS);
  }
  console.log(`[e5-backfill] done: ${done} rows in ${((Date.now() - started) / 1000).toFixed(0)}s`);
  db.close();
}

main().catch((err) => {
  console.error('[e5-backfill] failed:', err);
  process.exit(1);
});
