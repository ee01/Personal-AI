import BetterSqlite3 from 'better-sqlite3';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import { Database } from '../storage/Database.js';

describe('relationship radar schema compatibility', () => {
  const tempRoots: string[] = [];

  afterEach(() => {
    while (tempRoots.length > 0) {
      const tempRoot = tempRoots.pop();
      if (tempRoot) {
        fs.rmSync(tempRoot, { recursive: true, force: true });
      }
    }
  });

  it('adds relationship_radar_people.summary when 020 already ran before the column existed', () => {
    const tempRoot = fs.mkdtempSync(
      path.join(os.tmpdir(), 'relationship-radar-compat-'),
    );
    tempRoots.push(tempRoot);
    const dbPath = path.join(tempRoot, 'memory.db');
    const rawDb = new BetterSqlite3(dbPath);

    rawDb.exec(`
      CREATE TABLE _migrations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        filename TEXT NOT NULL UNIQUE,
        applied_at INTEGER NOT NULL
      );

      CREATE TABLE relationship_radar_people (
        entity_id TEXT PRIMARY KEY,
        radar_state TEXT NOT NULL DEFAULT 'watch',
        data_quality TEXT NOT NULL DEFAULT 'indexed',
        projection_source TEXT NOT NULL DEFAULT 'lazy',
        score REAL NOT NULL DEFAULT 0,
        interaction_count INTEGER NOT NULL DEFAULT 0,
        active_days INTEGER NOT NULL DEFAULT 0,
        last_interaction_at INTEGER,
        evidence_refs_json TEXT NOT NULL DEFAULT '[]',
        dirty_since INTEGER,
        last_consolidated_at INTEGER,
        generated_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );
    `);
    rawDb
      .prepare('INSERT INTO _migrations (filename, applied_at) VALUES (?, ?)')
      .run('020_relationship_radar.sql', Date.now());
    rawDb.close();

    const database = new Database({ dbPath, dataDir: tempRoot });
    database.migrate();

    const columns = database.raw
      .pragma('table_info("relationship_radar_people")')
      .map((row: any) => row.name);
    expect(columns).toContain('summary');

    database.raw
      .prepare(
        `INSERT INTO relationship_radar_people
          (entity_id, radar_state, score, interaction_count, active_days,
           evidence_refs_json, summary, generated_at, updated_at)
         VALUES (?, 'active', 0.8, 3, 2, '[]', ?, ?, ?)`,
      )
      .run('entity-1', 'compat summary', 1_700_000_000, 1_700_000_000);

    expect(
      database.raw
        .prepare(
          'SELECT summary FROM relationship_radar_people WHERE entity_id = ?',
        )
        .get('entity-1'),
    ).toEqual({ summary: 'compat summary' });

    database.close();
  });
});
