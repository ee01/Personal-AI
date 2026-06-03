import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type BetterSqlite3 from 'better-sqlite3';

import { RecallEngine } from '../core/RecallEngine.js';
import { cleanupTestDb, getTestDb } from './setup.js';

let db: BetterSqlite3.Database;

function insertMessage(id: string, content: string, timestamp: number): void {
  db.prepare(
    `INSERT INTO messages_raw
      (id, content, source_type, sender, group_id, group_name, timestamp,
       importance, sentiment, metadata_json, created_at)
     VALUES (?, ?, 'manual', 'tester', 'lifecycle', 'Lifecycle', ?, 0.8,
       'neutral', '{}', ?)`,
  ).run(id, content, timestamp, timestamp);
}

function insertMetadata(
  targetId: string,
  retrievalTier: string,
  salience: number,
  consolidationLevel = 'working',
): void {
  const ts = Math.floor(Date.now() / 1000);
  db.prepare(
    `INSERT INTO memory_metadata
      (target_type, target_id, salience_score, effective_salience,
       retrieval_tier, consolidation_level, last_accessed, created_at, updated_at)
     VALUES ('message', ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    targetId,
    salience,
    salience,
    retrievalTier,
    consolidationLevel,
    ts,
    ts,
    ts,
  );
}

describe('RecallEngine lifecycle filtering', () => {
  beforeAll(() => {
    db = getTestDb();
  });

  beforeEach(() => {
    db.prepare('DELETE FROM memory_feedback_events').run();
    db.prepare('DELETE FROM memory_metadata').run();
    db.prepare('DELETE FROM messages_raw').run();
  });

  afterAll(() => {
    cleanupTestDb();
  });

  it('excludes archive-only memories from default recall but includes them for historical recall', async () => {
    const currentTime = Math.floor(Date.now() / 1000);
    insertMessage('active-memory', 'Active Falcon launch context', currentTime - 60);
    insertMessage('archived-memory', 'Archived Falcon launch context', currentTime - 120);
    insertMetadata('active-memory', 'active', 0.8);
    insertMetadata('archived-memory', 'archive_only', 0.1, 'archived');

    const engine = new RecallEngine(db);
    const baseQuery = {
      query: 'Falcon launch context',
      channels: ['time' as const],
      timeRange: { start: currentTime - 3600, end: currentTime },
      topK: 10,
      includeMetadata: true,
    };

    const active = await engine.recall(
      { ...baseQuery, lifecycleMode: 'active_default' },
      { reinforceAccess: false },
    );
    expect(active.items.map((item) => item.id)).toEqual(['active-memory']);

    const historical = await engine.recall(
      { ...baseQuery, lifecycleMode: 'historical' },
      { reinforceAccess: false },
    );
    expect(historical.items.map((item) => item.id)).toContain('archived-memory');
  });

  it('suppresses negative-feedback memories on composer surfaces', async () => {
    const currentTime = Math.floor(Date.now() / 1000);
    insertMessage('negative-memory', 'Composer Falcon reply context', currentTime - 60);
    insertMetadata('negative-memory', 'active', 0.8);
    db.prepare(
      `INSERT INTO memory_feedback_events
        (feedback_type, target_type, target_id, action, created_at, updated_at)
       VALUES ('recall_quality', 'message', 'negative-memory', 'negative', ?, ?)`,
    ).run(currentTime, currentTime);

    const engine = new RecallEngine(db);
    const result = await engine.recall(
      {
        query: 'Composer Falcon reply context',
        channels: ['time'],
        timeRange: { start: currentTime - 3600, end: currentTime },
        lifecycleMode: 'composer_surface',
        topK: 10,
      },
      { reinforceAccess: false },
    );

    expect(result.items).toHaveLength(0);
  });

  it('uses virtual tiers for memories without metadata', async () => {
    const currentTime = Math.floor(Date.now() / 1000);
    const oldTime = currentTime - 420 * 86400;
    insertMessage('old-untracked-memory', 'Very old untracked Falcon context', oldTime);

    const engine = new RecallEngine(db);
    const passive = await engine.recall(
      {
        query: 'Very old Falcon context',
        channels: ['time'],
        timeRange: { start: oldTime - 60, end: oldTime + 60 },
        lifecycleMode: 'passive_surface',
        topK: 10,
      },
      { reinforceAccess: false },
    );
    const explicit = await engine.recall(
      {
        query: 'Very old Falcon context',
        channels: ['time'],
        timeRange: { start: oldTime - 60, end: oldTime + 60 },
        lifecycleMode: 'explicit_search',
        topK: 10,
        includeMetadata: true,
      },
      { reinforceAccess: false },
    );

    expect(passive.items).toHaveLength(0);
    expect(explicit.items[0]?.id).toBe('old-untracked-memory');
    expect(explicit.items[0]?.metadata?.retrievalTier).toBe('historical');
  });
});
