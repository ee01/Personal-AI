#!/usr/bin/env node
/**
 * Standalone migration runner for the memory-service database.
 *
 * Usage:
 *   npm run migrate
 *   tsx src/storage/migrate.ts
 */

import { getConfig } from '../config.js';
import { Database } from './Database.js';

function main(): void {
  console.log('[migrate] Starting database migration...');

  const config = getConfig();
  console.log(`[migrate] Data directory: ${config.dataDir}`);

  let db: Database | null = null;

  try {
    db = new Database({ dataDir: config.dataDir });
    console.log(`[migrate] Database path: ${db.filePath}`);
    console.log(`[migrate] sqlite-vec support: ${db.hasVecSupport ? 'yes' : 'no'}`);

    const applied = db.migrate();

    if (applied.length > 0) {
      console.log(`[migrate] Applied ${applied.length} migration(s):`);
      for (const filename of applied) {
        console.log(`  - ${filename}`);
      }
    } else {
      console.log('[migrate] No new migrations to apply.');
    }

    console.log('[migrate] Migration complete.');
  } catch (err) {
    console.error('[migrate] Migration failed:', err);
    process.exitCode = 1;
  } finally {
    if (db) {
      db.close();
    }
  }
}

main();
