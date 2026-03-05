#!/usr/bin/env tsx
/**
 * One-time data migration script: single-tenant → multi-user layout.
 *
 * Moves all existing top-level data files/directories into
 *   data/users/{DEFAULT_USER_ID}/
 *
 * Usage:
 *   npx tsx scripts/migrate-to-multiuser.ts [--user-id <id>] [--dry-run] [--data-dir <path>]
 *
 * Options:
 *   --user-id   The user ID for the migrated data (default: "default")
 *   --dry-run   Print what would happen without making changes
 *   --data-dir  Path to the data directory (default: ./data)
 */

import fs from 'node:fs';
import path from 'node:path';

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

interface MigrateOptions {
  dataDir: string;
  userId: string;
  dryRun: boolean;
}

/** Directories/files that belong to a user and should be moved. */
const USER_ITEMS = [
  'CORE_MEMORY.md',
  'WATCHED_PROJECTS.md',
  'daily',
  'projects',
  'entities',
  'skills',
  'reflections',
  'dreams',
  'agent',
  'memory.db',
  'memory.db-wal',
  'memory.db-shm',
  'config.json',
] as const;

/** Items that should NOT be moved (they belong at the top level). */
const SKIP_ITEMS = new Set(['users']);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function log(msg: string): void {
  console.log(`[migrate] ${msg}`);
}

function warn(msg: string): void {
  console.warn(`[migrate] ⚠ ${msg}`);
}

function moveItem(src: string, dest: string, dryRun: boolean): boolean {
  if (!fs.existsSync(src)) return false;

  const destDir = path.dirname(dest);
  if (!dryRun && !fs.existsSync(destDir)) {
    fs.mkdirSync(destDir, { recursive: true });
  }

  if (dryRun) {
    log(`  [DRY-RUN] move ${src} → ${dest}`);
  } else {
    fs.renameSync(src, dest);
    log(`  moved ${src} → ${dest}`);
  }
  return true;
}

// ---------------------------------------------------------------------------
// Main migration logic (exported for testing)
// ---------------------------------------------------------------------------

export function migrateToMultiUser(options: MigrateOptions): {
  moved: string[];
  skipped: string[];
  alreadyMigrated: boolean;
} {
  const { dataDir, userId, dryRun } = options;
  const result = { moved: [] as string[], skipped: [] as string[], alreadyMigrated: false };

  // 1. Validate data directory exists
  if (!fs.existsSync(dataDir)) {
    log(`Data directory does not exist: ${dataDir} — nothing to migrate.`);
    return result;
  }

  const usersDir = path.join(dataDir, 'users');
  const targetDir = path.join(usersDir, userId);

  // 2. Check if migration has already been done
  //    If `users/{userId}/` exists AND has content AND there are no top-level
  //    user items, consider it already migrated.
  if (fs.existsSync(targetDir)) {
    const topLevelUserItems = USER_ITEMS.filter((item) =>
      fs.existsSync(path.join(dataDir, item)),
    );
    if (topLevelUserItems.length === 0) {
      log(`Already migrated — no top-level user data found and ${targetDir} exists.`);
      result.alreadyMigrated = true;
      return result;
    }
    warn(`Target directory ${targetDir} already exists but top-level data also present. Merging.`);
  }

  // 3. Ensure users/ and target directory exist
  if (!dryRun) {
    if (!fs.existsSync(usersDir)) {
      fs.mkdirSync(usersDir, { recursive: true });
    }
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }
  }

  log(`Migrating data from ${dataDir} to ${targetDir}`);
  if (dryRun) log('  (dry-run mode — no changes will be made)');

  // 4. Move each user item
  for (const item of USER_ITEMS) {
    const src = path.join(dataDir, item);
    const dest = path.join(targetDir, item);

    if (!fs.existsSync(src)) {
      result.skipped.push(item);
      continue;
    }

    // Don't overwrite existing files in target during merge
    if (fs.existsSync(dest)) {
      warn(`${item} already exists at destination, skipping.`);
      result.skipped.push(item);
      continue;
    }

    if (moveItem(src, dest, dryRun)) {
      result.moved.push(item);
    }
  }

  // 5. Clean up empty top-level directories that were moved
  if (!dryRun) {
    const entries = fs.readdirSync(dataDir, { withFileTypes: true });
    for (const entry of entries) {
      if (SKIP_ITEMS.has(entry.name)) continue;
      if (entry.name.startsWith('.')) continue;

      const fullPath = path.join(dataDir, entry.name);
      if (entry.isDirectory()) {
        // Remove only if empty (some might have been partially moved)
        try {
          const contents = fs.readdirSync(fullPath);
          if (contents.length === 0) {
            fs.rmdirSync(fullPath);
            log(`  removed empty directory: ${entry.name}/`);
          }
        } catch {
          // ignore
        }
      }
    }
  }

  // 6. Summary
  log('');
  log(`Migration complete:`);
  log(`  Moved:   ${result.moved.length} items (${result.moved.join(', ') || 'none'})`);
  log(`  Skipped: ${result.skipped.length} items (${result.skipped.join(', ') || 'none'})`);
  log(`  User ID: ${userId}`);
  log(`  Target:  ${targetDir}`);

  return result;
}

// ---------------------------------------------------------------------------
// CLI entry point
// ---------------------------------------------------------------------------

function parseArgs(args: string[]): MigrateOptions {
  let userId = 'default';
  let dryRun = false;
  let dataDir = path.resolve(process.cwd(), 'data');

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--user-id':
        userId = args[++i];
        if (!userId || !/^[a-zA-Z0-9._-]+$/.test(userId)) {
          console.error('Invalid user ID. Must match /^[a-zA-Z0-9._-]+$/');
          process.exit(1);
        }
        break;
      case '--dry-run':
        dryRun = true;
        break;
      case '--data-dir':
        dataDir = path.resolve(args[++i]);
        break;
    }
  }

  return { dataDir, userId, dryRun };
}

// Only run CLI when executed directly
const isMain =
  process.argv[1] &&
  (process.argv[1].endsWith('/migrate-to-multiuser.ts') ||
    process.argv[1].endsWith('/migrate-to-multiuser.js'));

if (isMain) {
  const options = parseArgs(process.argv.slice(2));
  log(`Data dir: ${options.dataDir}`);
  log(`User ID:  ${options.userId}`);
  log(`Dry run:  ${options.dryRun}`);
  log('');

  migrateToMultiUser(options);
}
