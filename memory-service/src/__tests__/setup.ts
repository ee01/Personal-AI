/**
 * Test setup module.
 *
 * Provides an in-memory SQLite database with migrations applied,
 * plus mock factory functions for test data.
 */

import BetterSqlite3 from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { v4 as uuidv4 } from 'uuid';

import type {
  Entity,
  EntityType,
  IngestPayload,
  SourceType,
} from '../types/index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Eagerly attempt to import sqlite-vec at module load time so
// getTestDb() can remain synchronous.
let sqliteVecModule: { load: (db: BetterSqlite3.Database) => void } | null = null;
try {
  sqliteVecModule = await import('sqlite-vec') as any;
} catch {
  // sqlite-vec not available in this environment
}

// ---------------------------------------------------------------------------
// Shared test database
// ---------------------------------------------------------------------------

let _testDb: BetterSqlite3.Database | null = null;

/**
 * Create (or return the existing) in-memory SQLite test database
 * with all migrations applied.
 *
 * sqlite-vec is loaded if the native extension is available.
 * Tests that require vector search should check for its presence
 * or mock those calls.
 */
export function getTestDb(): BetterSqlite3.Database {
  if (_testDb) return _testDb;

  const db = new BetterSqlite3(':memory:');
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  // Load sqlite-vec if available
  if (sqliteVecModule) {
    try {
      sqliteVecModule.load(db);
    } catch {
      // Tolerate load failure
    }
  }

  // Apply migrations
  const migrationsDir = path.resolve(__dirname, '..', 'storage', 'migrations');
  if (fs.existsSync(migrationsDir)) {
    const files = fs
      .readdirSync(migrationsDir)
      .filter((f) => f.endsWith('.sql'))
      .sort();

    for (const file of files) {
      const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf-8');
      // Execute each statement individually so that IF NOT EXISTS
      // and virtual table statements that may fail do not abort
      // the whole migration.
      const statements = sql
        .split(';')
        .map((s) => s.trim())
        .filter((s) => s.length > 0);

      for (const stmt of statements) {
        try {
          db.exec(stmt);
        } catch {
          // Tolerate failures (e.g. virtual tables without the extension)
        }
      }
    }
  }

  _testDb = db;
  return db;
}

/**
 * Close and discard the shared test database.
 * Call this in an afterAll hook.
 */
export function cleanupTestDb(): void {
  if (_testDb) {
    _testDb.close();
    _testDb = null;
  }
}

// ---------------------------------------------------------------------------
// Mock factories
// ---------------------------------------------------------------------------

/**
 * Create a mock IngestPayload with sensible defaults.
 * Override any field by passing a partial object.
 */
export function createMockIngestPayload(
  overrides: Partial<IngestPayload> = {},
): IngestPayload {
  return {
    content: `Test message ${Date.now()}`,
    sourceType: 'manual' as SourceType,
    sender: 'test-user',
    groupId: 'test-group',
    groupName: 'Test Group',
    timestamp: Math.floor(Date.now() / 1000),
    ...overrides,
  };
}

/**
 * Create a mock Entity with sensible defaults.
 * Override any field by passing a partial object.
 */
export function createMockEntity(
  overrides: Partial<Entity> = {},
): Entity {
  const id = overrides.id ?? uuidv4();
  return {
    id,
    type: 'Person' as EntityType,
    name: `Test Entity ${id.slice(0, 6)}`,
    importance: 0.5,
    accessCount: 0,
    mentionCount: 0,
    status: 'active',
    createdAt: Math.floor(Date.now() / 1000),
    ...overrides,
  };
}
