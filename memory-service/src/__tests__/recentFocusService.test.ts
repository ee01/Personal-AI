import BetterSqlite3 from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';

import { buildRecentFocusBlock } from '../core/RecentFocusService.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** Build a fresh, isolated in-memory DB with all migrations applied. */
function freshDb(): BetterSqlite3.Database {
  const db = new BetterSqlite3(':memory:');
  db.pragma('journal_mode = WAL');
  const migrationsDir = path.resolve(__dirname, '..', 'storage', 'migrations');
  const files = fs
    .readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .sort();
  for (const file of files) {
    const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf-8');
    for (const stmt of sql.split(';').map((s) => s.trim()).filter(Boolean)) {
      try {
        db.exec(stmt);
      } catch {
        // tolerate virtual-table statements without the extension
      }
    }
  }
  return db;
}

const NOW = Math.floor(Date.now() / 1000);
const HOUR = 3600;
const DAY = 86400;

function insertMessage(
  db: BetterSqlite3.Database,
  opts: {
    id: string;
    content: string;
    summary?: string | null;
    timestamp: number;
    importance: number;
    salience?: number | null;
    sender?: string;
    group?: string;
  },
): void {
  db.prepare(
    `INSERT INTO messages_raw
       (id, content, summary, source_type, sender, group_name, timestamp,
        importance, scope, created_at, updated_at)
     VALUES (@id, @content, @summary, 'ringcentral', @sender, @group, @timestamp,
        @importance, 'work', @timestamp, @timestamp)`,
  ).run({
    id: opts.id,
    content: opts.content,
    summary: opts.summary ?? null,
    sender: opts.sender ?? 'Alice',
    group: opts.group ?? 'Project X',
    timestamp: opts.timestamp,
    importance: opts.importance,
  });
  if (opts.salience != null) {
    db.prepare(
      `INSERT INTO memory_metadata
         (target_type, target_id, salience_score, consolidation_level,
          created_at, updated_at)
       VALUES ('message', ?, ?, 'working', ?, ?)`,
    ).run(opts.id, opts.salience, opts.timestamp, opts.timestamp);
  }
}

describe('buildRecentFocusBlock', () => {
  let db: BetterSqlite3.Database | null = null;
  afterEach(() => {
    db?.close();
    db = null;
  });

  it('returns empty block (itemCount 0) when there is no recent signal', () => {
    db = freshDb();
    const block = buildRecentFocusBlock(db);
    expect(block.itemCount).toBe(0);
    expect(block.bodyMd).toBe('');
    expect(block.sourceRefs).toEqual([]);
  });

  it('includes recent high-signal messages and emits provenance refs', () => {
    db = freshDb();
    insertMessage(db, {
      id: 'm-high',
      content: 'Customer asked to change export format from CSV to XLSX',
      summary: 'Export format change request',
      timestamp: NOW - 2 * HOUR,
      importance: 0.8,
      salience: 0.82,
    });
    const block = buildRecentFocusBlock(db);
    expect(block.itemCount).toBe(1);
    expect(block.bodyMd).toContain('Active Focus Digest');
    expect(block.bodyMd).toContain('Export format change request');
    expect(block.sourceRefs).toContain('message:m-high');
  });

  it('excludes low-signal messages below the salience floor', () => {
    db = freshDb();
    insertMessage(db, {
      id: 'm-low',
      content: 'lol ok',
      timestamp: NOW - 1 * HOUR,
      importance: 0.1,
      salience: 0.12,
    });
    const block = buildRecentFocusBlock(db);
    expect(block.itemCount).toBe(0);
  });

  it('excludes messages outside the freshness window', () => {
    db = freshDb();
    insertMessage(db, {
      id: 'm-old',
      content: 'High signal but stale',
      timestamp: NOW - 40 * DAY,
      importance: 0.9,
      salience: 0.9,
    });
    const block = buildRecentFocusBlock(db, { windowDays: 14 });
    expect(block.itemCount).toBe(0);
    // Widening the window brings it back.
    const wide = buildRecentFocusBlock(db, { windowDays: 60 });
    expect(wide.itemCount).toBe(1);
  });

  it('clamps output to the configured token budget', () => {
    db = freshDb();
    for (let i = 0; i < 10; i++) {
      insertMessage(db, {
        id: `m-${i}`,
        content: 'x'.repeat(400) + ` item ${i}`,
        timestamp: NOW - (i + 1) * HOUR,
        importance: 0.7,
        salience: 0.7,
      });
    }
    const block = buildRecentFocusBlock(db, { tokenBudget: 100 });
    // maxChars = max(400, 100*4) = 400, plus the truncation note.
    expect(block.bodyMd).toContain('Truncated to fit token budget');
    expect(block.bodyMd.length).toBeLessThan(600);
  });
});
