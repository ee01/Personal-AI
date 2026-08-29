import BetterSqlite3, { type Database as SQLiteDatabase, type Statement, type RunResult } from 'better-sqlite3';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getConfig } from '../config.js';
import { isSqliteCorruptError } from '../utils/sqliteErrors.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

function parseOptionalBooleanEnv(name: string): boolean | null {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return null;
  const normalized = raw.trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(normalized)) return true;
  if (['0', 'false', 'no', 'off'].includes(normalized)) return false;
  return null;
}

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
 * configurable journal mode, and optional sqlite-vec extension loading.
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

    // WAL is the default for local/dev read concurrency. Some bind-mounted
    // production filesystems are safer with DELETE + FULL.
    this.db.pragma(`journal_mode = ${appConfig.sqliteJournalMode}`);
    this.db.pragma(`synchronous = ${appConfig.sqliteSynchronous}`);

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

  /**
   * Verify `chunks_fts` and rebuild it if the index is corrupt.
   *
   * A damaged FTS index is silent: recall just returns nothing, so an outage
   * can run for days before anyone connects it to a broken search. `chunks_fts`
   * is an external-content table (`content='chunks'`), so the index is fully
   * derivable and rebuilding costs nothing but time.
   *
   * Returns what happened so callers can log it. Never throws: a repair failure
   * must not stop the user context from loading, since everything other than
   * keyword recall still works.
   */
  verifyAndRepairFtsIndex(): 'clean' | 'repaired' | 'repair_failed' | 'skipped' {
    if (parseOptionalBooleanEnv('SQLITE_FTS_AUTO_REPAIR_ENABLED') === false) {
      return 'skipped';
    }

    try {
      this.db
        .prepare("INSERT INTO chunks_fts(chunks_fts) VALUES('integrity-check')")
        .run();
      return 'clean';
    } catch (error) {
      if (!isSqliteCorruptError(error)) return 'skipped';
    }

    // The content table is the only irreplaceable input. If it is also damaged
    // a rebuild would bake the damage into the index, so leave it alone and let
    // the corruption stay visible.
    try {
      this.db.prepare('SELECT chunk_id FROM chunks LIMIT 1').get();
    } catch {
      console.error(
        `[Database] chunks_fts is corrupt in ${this.dbPath} but chunks is unreadable; skipping rebuild`,
      );
      return 'repair_failed';
    }

    try {
      const started = Date.now();
      this.db
        .prepare("INSERT INTO chunks_fts(chunks_fts) VALUES('delete-all')")
        .run();
      this.db.prepare("INSERT INTO chunks_fts(chunks_fts) VALUES('rebuild')").run();
      this.db
        .prepare("INSERT INTO chunks_fts(chunks_fts) VALUES('integrity-check')")
        .run();
      console.warn(
        `[Database] Rebuilt corrupt chunks_fts in ${this.dbPath} (${Date.now() - started}ms)`,
      );
      return 'repaired';
    } catch (error) {
      console.error(
        `[Database] Failed to rebuild corrupt chunks_fts in ${this.dbPath}:`,
        error instanceof Error ? error.message : String(error),
      );
      return 'repair_failed';
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

    this.ensureSchemaCompatibility();

    if (newlyApplied.length === 0) {
      console.log('[Database] All migrations already applied');
    }

    return newlyApplied;
  }

  /**
   * Repair schema drift caused by older CREATE TABLE IF NOT EXISTS migrations.
   *
   * Some early migrations were expanded after they had already run on the
   * long-lived personal database. SQLite does not add those new columns when
   * the original CREATE TABLE IF NOT EXISTS statement is skipped, so keep this
   * small compatibility pass for known legacy gaps.
   */
  private ensureSchemaCompatibility(): void {
    this.ensureColumn(
      'relationship_radar_people',
      'data_quality',
      "TEXT NOT NULL DEFAULT 'indexed'",
    );
    this.ensureColumn(
      'relationship_radar_people',
      'projection_source',
      "TEXT NOT NULL DEFAULT 'lazy'",
    );
    this.ensureColumn(
      'relationship_radar_people',
      'evidence_refs_json',
      "TEXT NOT NULL DEFAULT '[]'",
    );
    this.ensureColumn(
      'relationship_radar_people',
      'summary',
      'TEXT',
    );
    this.ensureColumn(
      'relationship_radar_people',
      'dirty_since',
      'INTEGER',
    );
    this.ensureColumn(
      'relationship_radar_people',
      'last_consolidated_at',
      'INTEGER',
    );
  }

  private ensureColumn(table: string, column: string, definition: string): void {
    if (!this.tableExists(table) || this.columnExists(table, column)) {
      return;
    }

    console.warn(
      `[Database] Adding missing legacy column ${table}.${column}`,
    );
    this.db.exec(
      `ALTER TABLE ${this.quoteIdentifier(table)} ADD COLUMN ${this.quoteIdentifier(column)} ${definition}`,
    );
  }

  private tableExists(table: string): boolean {
    const row = this.db
      .prepare(
        `SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?`,
      )
      .get(table) as { name: string } | undefined;
    return Boolean(row);
  }

  private columnExists(table: string, column: string): boolean {
    const rows = this.db.pragma(
      `table_info(${this.quoteIdentifier(table)})`,
    ) as Array<{ name: string }>;
    return rows.some((row) => row.name === column);
  }

  private quoteIdentifier(identifier: string): string {
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(identifier)) {
      throw new Error(`Unsafe SQL identifier: ${identifier}`);
    }
    return `"${identifier}"`;
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
