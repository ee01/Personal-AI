#!/usr/bin/env node
/**
 * P0b incident snapshot helper (memory-foundation plan §11.3 / §2.3).
 *
 * Captures a timestamped, body-free evidence bundle when an incident is
 * suspected: runtime flags (secret values redacted), supply diagnostics,
 * embedding/LLM/budget readiness, index coverage, FK integrity, and recent
 * backend LLM error kinds. Written to /app/data/backups/incidents/.
 *
 * A retention pass keeps only the newest N bundles (default 30) — the
 * "incident snapshot retention policy cleanup" from §11.3.
 *
 * Usage (inside memory-service container):
 *   node scripts/incident-snapshot.mjs --db-path /app/data/users/esone.qiu/memory.db
 *   node scripts/incident-snapshot.mjs --db-path ... --reason "recall outage"
 */

import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';

const require = createRequire(import.meta.url);
const Database = require('better-sqlite3');

const REDACTED_FLAG_PARTS = /(key|token|secret|password|credential)/i;
const DEFAULT_RETENTION = 30;

function parseArgs(argv) {
  const opts = { dbPath: '', reason: 'manual', outDir: '', retention: DEFAULT_RETENTION };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--db-path' && argv[i + 1]) opts.dbPath = argv[++i];
    else if (argv[i] === '--reason' && argv[i + 1]) opts.reason = argv[++i];
    else if (argv[i] === '--out-dir' && argv[i + 1]) opts.outDir = argv[++i];
    else if (argv[i] === '--retention' && argv[i + 1]) opts.retention = Number(argv[++i]);
  }
  if (!opts.dbPath || !fs.existsSync(opts.dbPath)) {
    throw new Error('--db-path must point to an existing SQLite database');
  }
  return opts;
}

function loadVec(db) {
  try {
    const sqliteVec = require('sqlite-vec');
    db.loadExtension(sqliteVec.getLoadablePath());
    return true;
  } catch {
    return false;
  }
}

function flagsRedacted() {
  const flags = {};
  for (const [key, value] of Object.entries(process.env)) {
    if (key === undefined || value === undefined) continue;
    if (!/^(MEMORY_|INGEST_|EMBEDDING_|LLM_|CONTEXT_)/.test(key)) continue;
    flags[key] = REDACTED_FLAG_PARTS.test(key) ? '<redacted>' : value;
  }
  return flags;
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  const outDir = opts.outDir || path.join(path.dirname(path.dirname(path.dirname(opts.dbPath))), 'backups', 'incidents');
  fs.mkdirSync(outDir, { recursive: true });

  const db = new Database(opts.dbPath, { readonly: true });
  const vec = loadVec(db);
  const count = (sql) => {
    try {
      return db.prepare(sql).get().c;
    } catch {
      return null;
    }
  };

  const bundle = {
    generatedAt: new Date().toISOString(),
    reason: opts.reason,
    dbPath: opts.dbPath,
    schemaVersion: (() => {
      try {
        return db.prepare('SELECT version FROM schema_version ORDER BY version DESC LIMIT 1').get()?.version ?? null;
      } catch {
        return null;
      }
    })(),
    runtimeFlags: flagsRedacted(),
    supply: {
      messagesTotal: count('SELECT COUNT(*) c FROM messages_raw'),
      messageChunks: count(`SELECT COUNT(*) c FROM chunks WHERE file_path LIKE 'messages/%'`),
      eligibleMissingChunks: count(
        `SELECT COUNT(*) c FROM messages_raw m
         WHERE m.content IS NOT NULL AND TRIM(m.content) != ''
           AND NOT EXISTS (
             SELECT 1 FROM chunks c WHERE c.file_path = 'messages/' || m.id
           )`,
      ),
      messageChunksMissingVec: vec
        ? count(
            `SELECT COUNT(*) c FROM chunks c
             WHERE c.file_path LIKE 'messages/%'
               AND NOT EXISTS (
                 SELECT 1 FROM chunks_vec v WHERE v.chunk_id = c.chunk_id
               )`,
          )
        : 'vec-unavailable',
      ftsRows: count(`SELECT COUNT(*) c FROM chunks_fts`),
    },
    integrity: {
      quickCheck: (() => {
        try { return db.pragma('quick_check', { simple: true }); } catch { return null; }
      })(),
      foreignKeyViolations: (() => {
        try { return db.pragma('foreign_key_check').length; } catch { return null; }
      })(),
    },
    amplification: {
      rehearsalActivations: count('SELECT COUNT(*) c FROM rehearsal_activations'),
      rehearsalActivationsLast24h: count(
        `SELECT COUNT(*) c FROM rehearsal_activations WHERE created_at >= ${Math.floor(Date.now() / 1000) - 86400}`,
      ),
    },
    recentBackendErrorKinds: (() => {
      try {
        const { getAnalyticsStore } = require('/app/dist/analytics/AnalyticsStore.js');
        const store = getAnalyticsStore?.();
        return store
          ? 'analytics-store-available-but-omitted' // keep bundle body-free; query via usage dashboard
          : 'analytics-store-unavailable';
      } catch {
        return 'analytics-store-unavailable';
      }
    })(),
  };

  db.close();

  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const file = path.join(outDir, `incident-${stamp}.json`);
  fs.writeFileSync(file, JSON.stringify(bundle, null, 2));
  console.log(JSON.stringify(bundle, null, 2));
  console.log(`[incident-snapshot] written: ${file}`);

  // Retention: keep newest N bundles.
  const files = fs
    .readdirSync(outDir)
    .filter((f) => f.startsWith('incident-') && f.endsWith('.json'))
    .sort();
  const excess = files.length - opts.retention;
  if (excess > 0) {
    for (const victim of files.slice(0, excess)) {
      fs.unlinkSync(path.join(outDir, victim));
    }
    console.log(`[incident-snapshot] retention: removed ${excess} old snapshot(s) (keep ${opts.retention})`);
  }
}

main();
