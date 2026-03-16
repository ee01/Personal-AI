import BetterSqlite3, { type Database as SQLiteDatabase, type Statement, type RunResult } from 'better-sqlite3';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getConfig } from '../config.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

export interface DatabaseConfig {
  /** Path to the SQLite database file. Defaults to {dataDir}/memory.db */
  dbPath?: string;
  /** Data directory from config. Used to derive default dbPath. */
  dataDir?: string;
}

export interface MigrationRecord {
  id: number;
  filename: string;
  applied_at: number;
}

/**
 * Database wrapper around better-sqlite3 with migration support,
 * WAL mode, and optional sqlite-vec extension loading.
 */
export class Database {
  private db: SQLiteDatabase;
  private readonly dbPath: string;
  private vecExtensionLoaded = false;

  constructor(config?: DatabaseConfig) {
    const appConfig = getConfig();
    const dataDir = config?.dataDir ?? appConfig.dataDir;
    this.dbPath = config?.dbPath ?? path.join(dataDir, 'memory.db');

    // Ensure the directory for the database file exists
    const dbDir = path.dirname(this.dbPath);
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }

    // Open the database
    this.db = new BetterSqlite3(this.dbPath);

    // Enable WAL mode for better concurrent read performance
    this.db.pragma('journal_mode = WAL');

    // Enable foreign key enforcement
    this.db.pragma('foreign_keys = ON');

    // Load sqlite-vec extension if available
    this.loadVecExtension();
  }

  /**
   * Attempt to load the sqlite-vec extension for vector search support.
   * Uses createRequire to load the CommonJS sqlite-vec package in ESM context.
   * Wrapped in try/catch because sqlite-vec may not be available on all platforms.
   */
  private loadVecExtension(): void {
    try {
      const sqliteVec = require('sqlite-vec');
      this.db.loadExtension(sqliteVec.getLoadablePath());
      this.vecExtensionLoaded = true;
      console.log('[Database] sqlite-vec extension loaded successfully');
    } catch (err) {
      console.warn(
        '[Database] sqlite-vec extension not available - vector search will be disabled.',
        err instanceof Error ? err.message : String(err)
      );
    }
  }

  /** Whether the sqlite-vec extension was loaded successfully */
  get hasVecSupport(): boolean {
    return this.vecExtensionLoaded;
  }

  /** The file path of the SQLite database */
  get filePath(): string {
    return this.dbPath;
  }

  /** The underlying better-sqlite3 database instance (for advanced use) */
  get raw(): SQLiteDatabase {
    return this.db;
  }

  // ---------------------------------------------------------------------------
  // Migration support
  // ---------------------------------------------------------------------------

  /**
   * Run all pending migrations from the migrations directory.
   * Returns the list of newly applied migration filenames.
   */
  migrate(): string[] {
    // Ensure _migrations table exists (bootstrap)
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS _migrations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        filename TEXT NOT NULL UNIQUE,
        applied_at INTEGER NOT NULL
      );
    `);

    // Read all .sql files from the migrations directory
    const candidateDirs = [
      path.join(__dirname, 'migrations'),
      path.resolve(__dirname, '../../src/storage/migrations'),
    ];
    const migrationsDir = candidateDirs.find((dir) => fs.existsSync(dir));
    if (!migrationsDir) {
      console.warn(
        `[Database] Migrations directory not found. Checked: ${candidateDirs.join(', ')}`,
      );
      return [];
    }

    const files = fs
      .readdirSync(migrationsDir)
      .filter((f) => f.endsWith('.sql'))
      .sort(); // Lexicographic sort ensures ordering by filename prefix (001_, 002_, etc.)

    // Get already-applied migrations
    const applied = new Set(
      this.all<MigrationRecord>('SELECT * FROM _migrations')
        .map((row) => row.filename)
    );

    const newlyApplied: string[] = [];

    for (const file of files) {
      if (applied.has(file)) {
        continue;
      }

      const filePath = path.join(migrationsDir, file);
      const sql = fs.readFileSync(filePath, 'utf-8');

      console.log(`[Database] Applying migration: ${file}`);

      // Split SQL into individual statements, respecting triggers that
      // contain internal semicolons, so we can selectively skip vec0
      // virtual table creation when sqlite-vec is not available.
      const statements = this.splitStatements(sql);

      const applyMigration = this.db.transaction(() => {
        for (const stmt of statements) {
          const trimmed = stmt.trim();
          if (!trimmed) continue;

          // Skip vec0 virtual table creation if sqlite-vec is not available
          if (!this.vecExtensionLoaded && trimmed.toUpperCase().includes('USING VEC0')) {
            console.warn(`[Database] Skipping vec0 statement (no sqlite-vec): ${trimmed.slice(0, 80)}...`);
            continue;
          }

          this.db.exec(trimmed);
        }

        // Record the migration
        this.run(
          'INSERT INTO _migrations (filename, applied_at) VALUES (?, ?)',
          file,
          Date.now()
        );
      });

      applyMigration();
      newlyApplied.push(file);
      console.log(`[Database] Migration applied: ${file}`);
    }

    if (newlyApplied.length === 0) {
      console.log('[Database] All migrations already applied');
    }

    return newlyApplied;
  }

  /**
   * Split a SQL string into individual statements, respecting triggers
   * and other multi-statement constructs that contain internal semicolons.
   */
  private splitStatements(sql: string): string[] {
    const statements: string[] = [];
    let current = '';
    let inTrigger = false;

    const lines = sql.split('\n');

    for (const line of lines) {
      const trimmedLine = line.trim();

      // Skip empty lines in accumulation but keep them in current block
      if (trimmedLine.startsWith('--')) {
        current += line + '\n';
        continue;
      }

      // Detect trigger start
      if (/CREATE\s+TRIGGER/i.test(trimmedLine)) {
        inTrigger = true;
      }

      current += line + '\n';

      // Detect trigger end (END;)
      if (inTrigger && /^END\s*;/i.test(trimmedLine)) {
        inTrigger = false;
        statements.push(current.trim());
        current = '';
        continue;
      }

      // For non-trigger statements, split on semicolons at end of line
      if (!inTrigger && trimmedLine.endsWith(';')) {
        statements.push(current.trim());
        current = '';
      }
    }

    // Push any remaining content
    if (current.trim()) {
      statements.push(current.trim());
    }

    return statements;
  }

  // ---------------------------------------------------------------------------
  // Query helpers
  // ---------------------------------------------------------------------------

  /**
   * Execute a SQL statement that modifies the database (INSERT, UPDATE, DELETE).
   * Returns the RunResult with changes and lastInsertRowid.
   */
  run(sql: string, ...params: unknown[]): RunResult {
    return this.db.prepare(sql).run(...params);
  }

  /**
   * Execute a SQL query and return the first matching row, or undefined.
   */
  get<T = Record<string, unknown>>(sql: string, ...params: unknown[]): T | undefined {
    return this.db.prepare(sql).get(...params) as T | undefined;
  }

  /**
   * Execute a SQL query and return all matching rows.
   */
  all<T = Record<string, unknown>>(sql: string, ...params: unknown[]): T[] {
    return this.db.prepare(sql).all(...params) as T[];
  }

  /**
   * Create a prepared statement for repeated use.
   */
  prepare(sql: string): Statement {
    return this.db.prepare(sql);
  }

  /**
   * Execute raw SQL (multiple statements allowed). Use for DDL or batch operations.
   */
  exec(sql: string): void {
    this.db.exec(sql);
  }

  /**
   * Wrap a function in a database transaction.
   * The function receives no arguments; use closures to pass data.
   * If the function throws, the transaction is rolled back.
   *
   * Usage:
   *   const doWork = db.transaction(() => {
   *     db.run('INSERT INTO ...', ...);
   *     db.run('UPDATE ...', ...);
   *   });
   *   doWork();
   *
   * Or use db.transact() for immediate execution.
   */
  transaction<T>(fn: () => T): () => T {
    return this.db.transaction(fn);
  }

  /**
   * Convenience: create and immediately execute a transaction.
   */
  transact<T>(fn: () => T): T {
    return this.db.transaction(fn)();
  }

  /**
   * Close the database connection. Should be called on process shutdown.
   */
  close(): void {
    try {
      this.db.close();
      console.log('[Database] Connection closed');
    } catch (err) {
      console.error('[Database] Error closing connection:', err);
    }
  }
}

// ---------------------------------------------------------------------------
// Singleton management
// ---------------------------------------------------------------------------
let _instance: Database | null = null;

/**
 * Get (or create) the singleton Database instance.
 * Pass config on the first call; subsequent calls return the same instance.
 */
export function getDatabase(config?: DatabaseConfig): Database {
  if (!_instance) {
    _instance = new Database(config);
  }
  return _instance;
}

/**
 * Close and discard the singleton instance. Useful for testing or shutdown.
 */
export function closeDatabaseInstance(): void {
  if (_instance) {
    _instance.close();
    _instance = null;
  }
}
