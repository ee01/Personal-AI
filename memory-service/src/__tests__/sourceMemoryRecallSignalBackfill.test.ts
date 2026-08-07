import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import BetterSqlite3 from 'better-sqlite3';
import { afterEach, describe, expect, it } from 'vitest';

import { SourceMemoryRecallSignalBackfillService } from '../core/SourceMemoryRecallSignalBackfillService.js';

const temporaryDirectories: string[] = [];

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

describe('SourceMemoryRecallSignalBackfillService', () => {
  it('dry-runs, restores missing messages transactionally, and is idempotent', () => {
    const fixture = createFixture();
    insertCapsule(fixture.db, {
      id: 'capsule-with-chunk',
      messageId: 'message-with-chunk',
      title: 'Existing chunk source',
      createdAt: 100,
      captureMode: 'manual',
    });
    insertCapsule(fixture.db, {
      id: 'capsule-without-chunk',
      messageId: 'message-without-chunk',
      title: 'Missing chunk source',
      createdAt: 200,
      captureMode: 'auto',
    });
    const existingSnapshot =
      '# Existing chunk source\n\nExisting evidence text.\n';
    fs.writeFileSync(
      path.join(fixture.sourceMemoryDir, 'capsule-with-chunk.md'),
      existingSnapshot,
    );
    fs.writeFileSync(
      path.join(fixture.sourceMemoryDir, 'capsule-without-chunk.md'),
      '# Missing chunk source\n\nRestored evidence text for recall.',
    );
    fixture.db
      .prepare(
        `INSERT INTO chunks (
           file_path, line_start, line_end, content, content_hash, scope,
           source, source_type, related_entity_id, token_count, trust_class,
           injection_flags_json, created_at, updated_at
         ) VALUES (?, 1, 3, ?, ?, 'work', ?, 'web', ?, 12, 'untrusted', NULL, 100, 100)`,
      )
      .run(
        'source-memory/capsule-with-chunk.md',
        'Existing evidence text.',
        'existing-hash',
        'source-memory:capsule-with-chunk',
        'message-with-chunk',
      );
    fixture.db
      .prepare(
        `INSERT INTO memory_metadata (
           target_type, target_id, salience_score, importance,
           consolidation_level, created_at, updated_at
         ) VALUES ('message', 'message-with-chunk', 0.91, 0.91, 'core', 100, 100)`,
      )
      .run();
    fixture.db
      .prepare(
        `UPDATE source_memory_capsules
         SET metadata_json = ?
         WHERE id = 'capsule-with-chunk'`,
      )
      .run(JSON.stringify({ customEvidence: 'preserved', distillation: { status: 'ready' } }));

    const service = new SourceMemoryRecallSignalBackfillService(
      fixture.db,
      fixture.sourceMemoryDir,
    );
    const dryRun = service.run({
      runId: 'test-dry-run',
      includeTargetIds: true,
    });
    expect(dryRun).toMatchObject({
      mode: 'dry_run',
      targetCount: 2,
      canApply: true,
      blockers: [],
      planned: {
        messageRows: 2,
        messageMetadataRows: 1,
        chunkMetadataRows: 2,
      },
      integrityBefore: {
        missingMessageRows: 2,
        capsulesWithoutChunks: 1,
      },
    });
    expect(dryRun.planned.newChunks).toBeGreaterThan(0);

    expect(() =>
      service.run({
        apply: true,
        expectedTargets: 1,
        runId: 'test-stale-plan',
      }),
    ).toThrow(/Expected 1 targets, but the current transaction would repair 2/);
    expect(
      fixture.db.prepare('SELECT COUNT(*) AS count FROM messages_raw').get(),
    ).toEqual({ count: 0 });

    const applied = service.run({
      apply: true,
      expectedTargets: 2,
      runId: 'test-apply',
      includeTargetIds: true,
    });
    expect(applied.applied.messageRows).toBe(2);
    expect(applied.applied.newChunks).toBeGreaterThan(0);
    expect(applied.integrityAfter).toMatchObject({
      healthy: true,
      missingMessageRows: 0,
      capsulesWithoutChunks: 0,
      missingMessageMetadata: 0,
      missingChunkMetadata: 0,
    });
    expect(
      fixture.db
        .prepare(
          `SELECT COUNT(*) AS count FROM chunks
           WHERE file_path = 'source-memory/capsule-with-chunk.md'`,
        )
        .get(),
    ).toEqual({ count: 1 });
    expect(
      fixture.db
        .prepare(
          `SELECT salience_score, consolidation_level
           FROM memory_metadata
           WHERE target_type = 'message' AND target_id = 'message-with-chunk'`,
        )
        .get(),
    ).toEqual({ salience_score: 0.91, consolidation_level: 'core' });
    const restoredMessage = fixture.db
      .prepare(
        `SELECT content, metadata_json, created_at, updated_at
         FROM messages_raw
         WHERE id = 'message-with-chunk'`,
      )
      .get() as {
      content: string;
      metadata_json: string;
      created_at: number;
      updated_at: number;
    };
    expect(restoredMessage.content).toBe(existingSnapshot);
    expect(restoredMessage.created_at).toBe(100);
    expect(restoredMessage.updated_at).toBe(100);
    const restoredMetadata = JSON.parse(restoredMessage.metadata_json);
    expect(restoredMetadata).toMatchObject({
      customEvidence: 'preserved',
      sourceMemoryCapsuleId: 'capsule-with-chunk',
      captureLayer: 'memory_capture',
      sourceMemoryRecallSignalBackfill: {
        version: 1,
        runId: 'test-apply',
      },
    });
    expect(restoredMetadata).not.toHaveProperty('distillation');
    expect(
      fixture.db
        .prepare(
          `SELECT claim_attribution_status AS status,
                  claim_attribution_version AS version
           FROM messages_raw
           WHERE id = 'message-with-chunk'`,
        )
        .get(),
    ).toEqual({ status: 'resolved', version: 1 });
    expect(
      fixture.db
        .prepare(
          `SELECT COUNT(*) AS count
           FROM memory_claims
           WHERE source_message_id IN ('message-with-chunk', 'message-without-chunk')
             AND status = 'active'`,
        )
        .get(),
    ).toEqual({ count: 4 });
    const rebuiltChunkTimestamps = fixture.db
      .prepare(
        `SELECT DISTINCT created_at, updated_at
         FROM chunks
         WHERE file_path = 'source-memory/capsule-without-chunk.md'`,
      )
      .all();
    expect(rebuiltChunkTimestamps).toEqual([{ created_at: 200, updated_at: 200 }]);
    expect(
      fixture.db
        .prepare(
          `SELECT COUNT(*) AS count
           FROM chunks_fts
           WHERE rowid IN (
             SELECT chunk_id FROM chunks
             WHERE file_path = 'source-memory/capsule-without-chunk.md'
           )`,
        )
        .get(),
    ).toEqual({ count: applied.applied.newChunks });

    const secondRun = service.run({
      apply: true,
      expectedTargets: 0,
      runId: 'test-idempotent',
    });
    expect(secondRun.targetCount).toBe(0);
    expect(secondRun.applied.messageRows).toBe(0);
    expect(secondRun.integrityAfter?.healthy).toBe(true);
    fixture.db.close();
  });

  it('blocks apply when a target snapshot is missing', () => {
    const fixture = createFixture();
    insertCapsule(fixture.db, {
      id: 'capsule-no-snapshot',
      messageId: 'message-no-snapshot',
      title: 'Missing snapshot',
      createdAt: 300,
      captureMode: 'suggested',
    });
    const service = new SourceMemoryRecallSignalBackfillService(
      fixture.db,
      fixture.sourceMemoryDir,
    );
    const dryRun = service.run({ runId: 'missing-snapshot-dry-run' });
    expect(dryRun.canApply).toBe(false);
    expect(dryRun.blockers).toContain(
      'Capsule capsule-no-snapshot has no Markdown snapshot.',
    );
    expect(() =>
      service.run({
        apply: true,
        expectedTargets: 0,
        runId: 'missing-snapshot-apply',
      }),
    ).toThrow(/Backfill blocked/);
    expect(
      fixture.db.prepare('SELECT COUNT(*) AS count FROM messages_raw').get(),
    ).toEqual({ count: 0 });
    fixture.db.close();
  });
});

function createFixture(): {
  db: BetterSqlite3.Database;
  sourceMemoryDir: string;
} {
  const directory = fs.mkdtempSync(
    path.join(os.tmpdir(), 'source-memory-recall-backfill-'),
  );
  temporaryDirectories.push(directory);
  const sourceMemoryDir = path.join(directory, 'source-memory');
  fs.mkdirSync(sourceMemoryDir);
  const db = new BetterSqlite3(':memory:');
  db.exec(`
    CREATE TABLE source_memory_capsules (
      id TEXT PRIMARY KEY,
      source_kind TEXT NOT NULL,
      source_url TEXT,
      source_title TEXT NOT NULL,
      source_host TEXT,
      capture_mode TEXT NOT NULL,
      status TEXT NOT NULL,
      scope TEXT NOT NULL,
      summary TEXT,
      message_id TEXT,
      metadata_json TEXT,
      created_at INTEGER NOT NULL,
      saved_at INTEGER
    );
    CREATE TABLE messages_raw (
      id TEXT PRIMARY KEY,
      content TEXT NOT NULL,
      summary TEXT,
      scope TEXT,
      source TEXT,
      source_type TEXT NOT NULL,
      source_url TEXT,
      source_title TEXT,
      sender TEXT,
      group_id TEXT,
      group_name TEXT,
      timestamp INTEGER NOT NULL,
      importance REAL,
      sentiment TEXT,
      metadata_json TEXT,
      trust_class TEXT,
      injection_flags_json TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER
    );
    CREATE TABLE chunks (
      chunk_id INTEGER PRIMARY KEY AUTOINCREMENT,
      file_path TEXT NOT NULL,
      line_start INTEGER NOT NULL,
      line_end INTEGER NOT NULL,
      content TEXT NOT NULL,
      content_hash TEXT NOT NULL,
      scope TEXT,
      source TEXT,
      source_type TEXT,
      related_entity_id TEXT,
      token_count INTEGER,
      trust_class TEXT,
      injection_flags_json TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER
    );
    CREATE TABLE memory_metadata (
      target_type TEXT NOT NULL,
      target_id TEXT NOT NULL,
      salience_score REAL,
      importance REAL,
      consolidation_level TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER,
      UNIQUE(target_type, target_id)
    );
    CREATE VIRTUAL TABLE chunks_fts USING fts5(
      content,
      content='chunks',
      content_rowid='chunk_id'
    );
    CREATE TRIGGER chunks_ai AFTER INSERT ON chunks BEGIN
      INSERT INTO chunks_fts(rowid, content) VALUES (new.chunk_id, new.content);
    END;
  `);
  db.exec(
    fs.readFileSync(
      new URL('../storage/migrations/058_memory_claim_attribution.sql', import.meta.url),
      'utf8',
    ),
  );
  return { db, sourceMemoryDir };
}

function insertCapsule(
  db: BetterSqlite3.Database,
  input: {
    id: string;
    messageId: string;
    title: string;
    createdAt: number;
    captureMode: string;
  },
): void {
  db.prepare(
    `INSERT INTO source_memory_capsules (
       id, source_kind, source_url, source_title, source_host, capture_mode,
       status, scope, summary, message_id, metadata_json, created_at, saved_at
     ) VALUES (?, 'webpage', ?, ?, 'docs.example.com', ?, 'saved', 'work', ?, ?, '{}', ?, ?)`,
  ).run(
    input.id,
    `https://docs.example.com/${input.id}`,
    input.title,
    input.captureMode,
    input.title,
    input.messageId,
    input.createdAt,
    input.createdAt,
  );
}
