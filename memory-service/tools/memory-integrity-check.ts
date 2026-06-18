/**
 * memory-integrity-check (P2-10): reconcile residual provenance after deletions.
 *
 * Scans for orphan entity_properties (source_message_id pointing at a deleted
 * message), dirty relationship evidence arrays, and chunks_vec rows with no
 * owning chunk. Exits non-zero when residuals are found so it can gate a clean
 * deletability guarantee. Read-only.
 *
 * Usage: tsx memory-service/tools/memory-integrity-check.ts <path-to-db.sqlite>
 */

import BetterSqlite3 from 'better-sqlite3';
import process from 'node:process';

import { MemoryLineageService } from '../src/core/MemoryLineageService.js';

function main(): void {
  const dbPath = process.argv[2];
  if (!dbPath) {
    console.error('usage: memory-integrity-check <path-to-db.sqlite>');
    process.exit(2);
  }
  const db = new BetterSqlite3(dbPath, { readonly: true });
  const scan = new MemoryLineageService(db).integrityScan();
  const total =
    scan.orphanEntityProperties + scan.dirtyRelationshipEvidence + scan.vecOrphans;

  console.log('memory-integrity-check');
  console.log(`  orphan entity_properties     : ${scan.orphanEntityProperties}`);
  console.log(`  dirty relationship evidence  : ${scan.dirtyRelationshipEvidence}`);
  console.log(`  chunks_vec orphans           : ${scan.vecOrphans}`);
  console.log(`  total residuals              : ${total}`);
  db.close();
  process.exit(total === 0 ? 0 : 1);
}

main();
