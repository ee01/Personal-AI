import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from '../config.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

let db: Database.Database | null = null;

type Db = Database.Database;

interface Migration {
  id: string;
  up: (db: Db) => void;
}

function hasColumn(db: Db, table: string, column: string): boolean {
  const rows = db.pragma(`table_info(${table})`) as Array<{ name: string }>;
  return rows.some((row) => row.name === column);
}

/** Idempotent ALTER TABLE — schema.sql already carries the column for fresh databases. */
function addColumn(db: Db, table: string, column: string, definition: string): void {
  if (hasColumn(db, table, column)) return;
  db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
}

/**
 * Migrations run on every boot; each one must be safe to re-run because the
 * remote deployments already hold live data that cannot be rebuilt from schema.sql.
 */
const MIGRATIONS: Migration[] = [
  {
    id: '002_items_manual_source',
    up: (database) => {
      addColumn(database, 'items', 'source', `TEXT NOT NULL DEFAULT 'jira'`);
      addColumn(database, 'items', 'jira_key', 'TEXT');
      addColumn(database, 'items', 'project_key', 'TEXT');
    },
  },
  {
    id: '003_items_jira_key_index',
    up: (database) => {
      database.exec(
        `CREATE INDEX IF NOT EXISTS idx_items_jira_key ON items(team_id, jira_key)`,
      );
    },
  },
  {
    id: '004_items_backfill_jira_key',
    up: (database) => {
      // Every pre-existing row came from a Jira import, so its synthetic key IS the Jira key.
      database.exec(
        `UPDATE items SET jira_key = key
         WHERE source = 'jira' AND jira_key IS NULL AND instr(key, '-') > 1`,
      );
      database.exec(
        `UPDATE items SET project_key = substr(key, 1, instr(key, '-') - 1)
         WHERE source = 'jira' AND project_key IS NULL AND instr(key, '-') > 1`,
      );
    },
  },
];

function runMigrations(database: Db): void {
  const applied = new Set(
    (
      database.prepare(`SELECT id FROM _migrations`).all() as Array<{ id: string }>
    ).map((row) => row.id),
  );
  const record = database.prepare(
    `INSERT OR IGNORE INTO _migrations (id, applied_at) VALUES (?, ?)`,
  );
  record.run('001_initial', Date.now());
  for (const migration of MIGRATIONS) {
    if (applied.has(migration.id)) continue;
    database.transaction(() => {
      migration.up(database);
      record.run(migration.id, Date.now());
    })();
  }
}

export function getDb(): Database.Database {
  if (db) return db;

  fs.mkdirSync(config.dataDir, { recursive: true });
  const dbPath = path.join(config.dataDir, 'roadmap.db');
  db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  const schemaPath = path.join(__dirname, 'schema.sql');
  const schema = fs.readFileSync(schemaPath, 'utf8');
  db.exec(schema);

  runMigrations(db);

  return db;
}

export function closeDb(): void {
  if (db) {
    db.close();
    db = null;
  }
}
