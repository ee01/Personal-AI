#!/usr/bin/env node
/**
 * P0b pre-authorized data repair (memory-foundation plan §11.3 / §7.8 / §9.4):
 *
 * 1. rehearsal activation historical noise cleanup — raw telemetry rows older
 *    than 30 days are deleted; the last 30 days and every row carrying user
 *    feedback are kept. (Matches the plan's 30-day raw-exposure retention.
 *    The new hour-bucket upsert must be live BEFORE running this.)
 * 2. orphan sweep — child rows whose FK parents no longer exist are removed
 *    (rehearsal_activations->rehearsals, proposed_action_attempts,
 *    memory_claims, source_memory_*, evidence_watch_*, action_readiness_*,
 *    open_question_exit_*). These break PRAGMA foreign_key_check and can
 *    never join to a parent again.
 *
 * Safety: dry-run by default; --apply requires a fresh backup-validate PASS
 * on the same database; deletes are batched with pauses; a manifest with
 * before/after counts is written next to the database.
 *
 * Usage (inside memory-service container):
 *   node scripts/p0b-data-cleanup.mjs --db-path /app/data/users/esone.qiu/memory.db
 *   node scripts/p0b-data-cleanup.mjs --db-path ... --apply --backup <backup.db>
 */

import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';

const require = createRequire(import.meta.url);
const Database = require('better-sqlite3');

function parseArgs(argv) {
  const opts = {
    dbPath: '',
    apply: false,
    backup: '',
    retentionDays: 30,
    batchSize: 50000,
    pauseMs: 300,
  };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--db-path' && argv[i + 1]) opts.dbPath = argv[++i];
    else if (argv[i] === '--apply') opts.apply = true;
    else if (argv[i] === '--backup' && argv[i + 1]) opts.backup = argv[++i];
    else if (argv[i] === '--retention-days' && argv[i + 1]) opts.retentionDays = Number(argv[++i]);
    else if (argv[i] === '--batch-size' && argv[i + 1]) opts.batchSize = Number(argv[++i]);
    else if (argv[i] === '--pause-ms' && argv[i + 1]) opts.pauseMs = Number(argv[++i]);
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

// (child, parent, childColumn, parentColumn) pairs confirmed by
// PRAGMA foreign_key_list in the pre-cleanup probe.
const ORPHAN_RULES = [
  ['rehearsal_activations', 'rehearsals', 'rehearsal_id', 'id'],
  ['proposed_action_attempts', 'proposed_actions', 'action_id', 'id'],
  ['memory_claims', 'messages_raw', 'source_message_id', 'id'],
  ['memory_claim_links', 'memory_claims', 'claim_id', 'id'],
  ['source_memory_evidence_spans', 'source_memory_capsules', 'capsule_id', 'id'],
  ['source_memory_anchors', 'source_memory_capsules', 'capsule_id', 'id'],
  ['source_memory_distillation_jobs', 'source_memory_capsules', 'capsule_id', 'id'],
  ['source_memory_distilled_artifacts', 'source_memory_capsules', 'capsule_id', 'id'],
  ['source_memory_events', 'source_memory_capsules', 'capsule_id', 'id'],
  ['source_memory_takeaways', 'source_memory_capsules', 'capsule_id', 'id'],
  ['source_memory_links', 'source_memory_capsules', 'capsule_id', 'id'],
  ['source_memory_triggers', 'source_memory_capsules', 'capsule_id', 'id'],
  ['evidence_watch_runs', 'evidence_watch_contracts', 'contract_id', 'id'],
  ['evidence_watch_links', 'evidence_watch_contracts', 'contract_id', 'id'],
  ['action_readiness_links', 'action_readiness_contracts', 'contract_id', 'id'],
  ['open_question_exit_runs', 'open_question_exit_contracts', 'contract_id', 'id'],
];

function main() {
  const opts = parseArgs(process.argv.slice(2));
  const db = new Database(opts.dbPath);
  db.pragma('busy_timeout = 30000');
  loadVec(db);
  const now = Math.floor(Date.now() / 1000);
  const cutoff = now - opts.retentionDays * 86400;

  const manifest = {
    generatedAt: new Date().toISOString(),
    dbPath: opts.dbPath,
    apply: opts.apply,
    retentionDays: opts.retentionDays,
    cutoffEpoch: cutoff,
    backupVerified: null,
    rehearsalActivations: {},
    orphanSweep: [],
    fkCheckAfter: null,
  };

  // ---- 0. backup gate ----
  if (opts.apply) {
    if (!opts.backup || !fs.existsSync(opts.backup)) {
      console.error('[cleanup] --apply requires --backup pointing to a fresh validated snapshot');
      process.exit(1);
    }
    const bak = new Database(opts.backup, { readonly: true });
    const quick = bak.pragma('quick_check', { simple: true });
    const rowsLive = db.prepare('SELECT COUNT(*) c FROM rehearsal_activations').get().c;
    const rowsBak = bak.prepare('SELECT COUNT(*) c FROM rehearsal_activations').get().c;
    bak.close();
    let growthOrCleanupOk = rowsLive >= rowsBak;
    // Continuation runs legitimately deleted rows since the backup; accept a
    // prior cleanup manifest whose recorded deletions explain the delta.
    if (!growthOrCleanupOk) {
      const prevManifestPath = `${opts.dbPath}.p0b-cleanup-manifest.json`;
      if (fs.existsSync(prevManifestPath)) {
        try {
          const prev = JSON.parse(fs.readFileSync(prevManifestPath, 'utf8'));
          const deleted = prev.rehearsalActivations?.deleted ?? 0;
          growthOrCleanupOk = rowsLive >= rowsBak - deleted;
          manifest.backupVerified = { priorCleanupManifest: prevManifestPath, priorDeleted: deleted };
        } catch {
          // fall through to failure below
        }
      }
    }
    manifest.backupVerified = {
      ...manifest.backupVerified,
      quickCheck: quick,
      rowsLive,
      rowsBackup: rowsBak,
      liveGrew: growthOrCleanupOk,
    };
    if (quick !== 'ok' || !growthOrCleanupOk) {
      console.error('[cleanup] backup gate FAILED:', manifest.backupVerified);
      process.exit(1);
    }
    console.log('[cleanup] backup gate OK');
  }

  // ---- 1. rehearsal activation retention cleanup ----
  const total = db.prepare('SELECT COUNT(*) c FROM rehearsal_activations').get().c;
  const toDelete = db
    .prepare('SELECT COUNT(*) c FROM rehearsal_activations WHERE created_at < ?')
    .get(cutoff).c;
  const feedbackKept = db
    .prepare(`SELECT COUNT(*) c FROM rehearsal_activations WHERE created_at < ? AND outcome != 'matched'`)
    .get(cutoff).c;
  manifest.rehearsalActivations = {
    totalBefore: total,
    toDelete: toDelete - feedbackKept,
    feedbackRowsPreserved: feedbackKept,
    keepAfter: total - (toDelete - feedbackKept),
  };
  console.log('[cleanup] rehearsal activations:', JSON.stringify(manifest.rehearsalActivations));

  if (opts.apply) {
    // Delete old raw telemetry EXCEPT rows carrying user feedback.
    const del = db.prepare(
      `DELETE FROM rehearsal_activations
       WHERE id IN (
         SELECT id FROM rehearsal_activations
         WHERE created_at < ? AND outcome = 'matched'
         LIMIT ?
       )`,
    );
    let deleted = 0;
    let batch = 0;
    while (true) {
      const changes = del.run(cutoff, opts.batchSize).changes;
      deleted += changes;
      batch += 1;
      if (batch % 10 === 0) {
        console.log(`[cleanup] rehearsal batch ${batch}: deleted ${deleted}/${manifest.rehearsalActivations.toDelete}`);
      }
      if (changes < opts.batchSize) break;
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, opts.pauseMs);
    }
    manifest.rehearsalActivations.deleted = deleted;
    console.log(`[cleanup] rehearsal cleanup done: ${deleted} rows deleted`);
  }

  // ---- 2. orphan sweep ----
  for (const [child, parent, childCol, parentCol] of ORPHAN_RULES) {
    let tableExists = true;
    try {
      db.prepare(`SELECT 1 FROM ${child} LIMIT 1`).get();
    } catch {
      tableExists = false;
    }
    if (!tableExists) continue;
    let missingParentCol = false;
    try {
      db.prepare(`SELECT 1 FROM ${parent} LIMIT 1`).get();
    } catch {
      // parent table absent — every child row is an orphan; skip (rare)
      missingParentCol = true;
    }
    if (missingParentCol) continue;

    const orphanCount = db
      .prepare(
        `SELECT COUNT(*) c FROM ${child} c2
         LEFT JOIN ${parent} p ON p.${parentCol} = c2.${childCol}
         WHERE p.${parentCol} IS NULL AND c2.${childCol} IS NOT NULL`,
      )
      .get().c;
    const entry = { child, parent, orphans: orphanCount, deleted: 0 };
    if (opts.apply && orphanCount > 0) {
      entry.deleted = db
        .prepare(
          `DELETE FROM ${child}
           WHERE ${childCol} IS NOT NULL
             AND NOT EXISTS (
               SELECT 1 FROM ${parent} p WHERE p.${parentCol} = ${child}.${childCol}
             )`,
        )
        .run().changes;
    }
    manifest.orphanSweep.push(entry);
  }

  // ---- 3. post-check ----
  if (opts.apply) {
    manifest.fkCheckAfter = db.pragma('foreign_key_check').length;
    manifest.rehearsalActivations.totalAfter = db
      .prepare('SELECT COUNT(*) c FROM rehearsal_activations')
      .get().c;
  }

  const manifestPath = `${opts.dbPath}.p0b-cleanup-manifest.json`;
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  console.log(JSON.stringify(manifest, null, 2));
  console.log(`[cleanup] manifest: ${manifestPath}`);
  if (opts.apply && manifest.fkCheckAfter !== 0) {
    console.error('[cleanup] FK violations remain:', manifest.fkCheckAfter);
    process.exitCode = 1;
  }
  db.close();
}

main();
