#!/usr/bin/env node
/**
 * §9.5-compliant VACUUM INTO + atomic replace (memory-foundation plan §9.5).
 *
 * Flow (must run with the service STOPPED — no other DB connections):
 *   VACUUM INTO new file
 *   → quick_check + integrity_check + foreign_key_check + FTS integrity
 *   → vec/projection row invariants + count parity vs source snapshot
 *   → fsync file and parent directory
 *   → rename original to rollback file
 *   → atomic rename new file into place
 *   → (caller restarts the service and runs smoke checks)
 *
 * The rollback file is kept until the observation window ends. Any failure
 * before the final rename leaves the original untouched; a rename failure
 * restores the original.
 *
 * Usage (one-off container against the mounted data volume):
 *   node scripts/vacuum-replace.mjs --db-path /app/data/users/esone.qiu/memory.db
 */

import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';

const require = createRequire(import.meta.url);
const Database = require('better-sqlite3');

function parseArgs(argv) {
  const opts = { dbPath: '', keepRollback: true };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--db-path' && argv[i + 1]) opts.dbPath = argv[++i];
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

function main() {
  const opts = parseArgs(process.argv.slice(2));
  const dbPath = opts.dbPath;
  const dir = path.dirname(dbPath);
  const base = path.basename(dbPath);
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const newPath = path.join(dir, `${base}.vacuum-new`);
  const rollbackPath = path.join(dir, `${base}.rollback-${stamp}`);

  const sizeBefore = fs.statSync(dbPath).size;
  console.log(`[vacuum-replace] source: ${dbPath} (${(sizeBefore / 1e9).toFixed(2)} GB)`);

  // Refuse to run while the service may be writing: an exclusive-style open
  // plus a write transaction proves we hold the only connection.
  const src = new Database(dbPath);
  src.pragma('busy_timeout = 5000');
  try {
    src.prepare('BEGIN IMMEDIATE').run();
    src.prepare('ROLLBACK').run();
  } catch (err) {
    console.error('[vacuum-replace] another connection appears active; aborting:', err.message);
    src.close();
    process.exit(1);
  }

  const snapCounts = {};
  for (const t of ['messages_raw', 'chunks', 'chunks_vec', 'rehearsal_activations', 'entities']) {
    try {
      snapCounts[t] = src.prepare(`SELECT COUNT(*) c FROM ${t}`).get().c;
    } catch {
      snapCounts[t] = null;
    }
  }

  // ---- 1. VACUUM INTO ----
  if (fs.existsSync(newPath)) fs.unlinkSync(newPath);
  const started = Date.now();
  src.prepare('VACUUM INTO ?').run(newPath);
  src.close();
  console.log(`[vacuum-replace] VACUUM INTO completed in ${((Date.now() - started) / 1000).toFixed(1)}s`);

  const cleanupNew = () => {
    try { fs.unlinkSync(newPath); } catch { /* ignore */ }
  };

  try {
    // ---- 2. validate the new file ----
    const vecOk = (() => {
      try {
        const sqliteVec = require('sqlite-vec');
        return { loaded: true, load: (d) => d.loadExtension(sqliteVec.getLoadablePath()) };
      } catch {
        return { loaded: false, load: () => {} };
      }
    })();

    const dst = new Database(newPath);
    dst.pragma('busy_timeout = 30000');
    if (vecOk.loaded) vecOk.load(dst);

    const quick = dst.pragma('quick_check', { simple: true });
    const integrity = dst.pragma('integrity_check', { simple: true });
    const fk = dst.pragma('foreign_key_check');
    if (quick !== 'ok') throw new Error(`quick_check failed: ${quick}`);
    if (integrity !== 'ok') throw new Error(`integrity_check failed: ${integrity}`);
    if (fk.length !== 0) throw new Error(`foreign_key_check violations: ${fk.length}`);

    try {
      dst.prepare(`INSERT INTO chunks_fts(chunks_fts) VALUES ('integrity-check')`).run();
    } catch (err) {
      throw new Error(`fts integrity failed: ${err.message}`);
    }

    // count parity: VACUUM INTO preserves the exact snapshot
    for (const [t, n] of Object.entries(snapCounts)) {
      if (n === null) continue;
      const c = dst.prepare(`SELECT COUNT(*) c FROM ${t}`).get().c;
      if (c !== n) throw new Error(`row count mismatch for ${t}: src=${n} new=${c}`);
    }
    dst.close();

    // ---- 3. fsync file + directory ----
    fsyncFile(newPath);
    fsyncDir(dir);

    // ---- 4. rename dance ----
    if (fs.existsSync(rollbackPath)) throw new Error('stale rollback file exists; resolve manually first');
    fs.renameSync(dbPath, rollbackPath);
    try {
      fs.renameSync(newPath, dbPath);
    } catch (err) {
      // restore the original on failure
      fs.renameSync(rollbackPath, dbPath);
      throw err;
    }
    fsyncDir(dir);
  } catch (err) {
    console.error('[vacuum-replace] FAILED, original preserved:', err.message);
    if (fs.existsSync(newPath)) {
      try { fs.unlinkSync(newPath); } catch { /* ignore */ }
    }
    process.exit(1);
  }

  const sizeAfter = fs.statSync(dbPath).size;
  console.log(
    JSON.stringify(
      {
        ok: true,
        sizeBefore,
        sizeAfter,
        savedBytes: sizeBefore - sizeAfter,
        rollback: rollbackPath,
        snapshotCounts: snapCounts,
        durationMs: Date.now() - started,
      },
      null,
      2,
    ),
  );
  console.log('[vacuum-replace] done. Keep the rollback file until the observation window ends.');
}

function fsyncFile(p) {
  const fd = fs.openSync(p, fs.constants.O_RDONLY);
  try {
    fs.fsyncSync(fd);
  } finally {
    fs.closeSync(fd);
  }
}

function fsyncDir(p) {
  try {
    const fd = fs.openSync(p, fs.constants.O_RDONLY);
    try {
      fs.fsyncSync(fd);
    } finally {
      fs.closeSync(fd);
    }
  } catch {
    // directory fsync is best-effort on non-Linux hosts
  }
}

main();
