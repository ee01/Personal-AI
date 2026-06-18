/**
 * Tests for P1-6 slice C: TTL probation state machine + LifecycleService
 * (forget / compress, downgrade-not-delete).
 */

import { getTestDb, cleanupTestDb } from './setup.js';
import { ProbationService } from '../core/ProbationService.js';
import { LifecycleService } from '../core/LifecycleService.js';
import { now } from '../utils/time.js';
import type Database from 'better-sqlite3';

let db: Database.Database;

function insertMessage(id: string): void {
  db.prepare(
    `INSERT INTO messages_raw (id, content, source_type, timestamp, created_at)
     VALUES (?, ?, 'webpage', ?, ?)`,
  ).run(id, `content for ${id}`, now(), now());
}

function insertChunk(messageId: string, content: string, scope = 'work', source = 'web'): number {
  const info = db
    .prepare(
      `INSERT INTO chunks
         (file_path, line_start, line_end, content, content_hash, scope, source,
          source_type, related_entity_id, token_count, created_at)
       VALUES (?, 0, 0, ?, ?, ?, ?, 'webpage', ?, 10, ?)`,
    )
    .run(`messages/${messageId}`, content, `h-${content}-${messageId}`, scope, source, messageId, now());
  return Number(info.lastInsertRowid);
}

beforeAll(() => {
  db = getTestDb();
});

afterAll(() => {
  cleanupTestDb();
});

beforeEach(() => {
  db.prepare('DELETE FROM memory_metadata').run();
  db.prepare('DELETE FROM chunks').run();
  db.prepare('DELETE FROM messages_raw').run();
});

describe('ProbationService.shouldProbate', () => {
  it('probates low-confidence and untrusted captures, never trusted ones', () => {
    expect(ProbationService.shouldProbate(0.35, 'internal')).toBe(true); // low-confidence band
    expect(ProbationService.shouldProbate(0.2, 'untrusted')).toBe(true); // untrusted always
    expect(ProbationService.shouldProbate(0.35, 'trusted')).toBe(false); // user_manual exempt
    expect(ProbationService.shouldProbate(0.6, 'internal')).toBe(false); // high-confidence
  });
});

describe('ProbationService state machine', () => {
  it('caps a probation capture to weak tier and graduates it once accessed', () => {
    insertMessage('m1');
    const chunkId = insertChunk('m1', 'low confidence note');
    const svc = new ProbationService(db);

    const applied = svc.applyOnIngest('m1', 0.4, 'untrusted');
    expect(applied).toBe(true);

    const msgMeta = db
      .prepare(`SELECT retrieval_tier, probation_until FROM memory_metadata WHERE target_type='message' AND target_id='m1'`)
      .get() as { retrieval_tier: string; probation_until: number | null };
    expect(msgMeta.retrieval_tier).toBe('weak');
    expect(msgMeta.probation_until).toBeGreaterThan(now());

    const chunkMeta = db
      .prepare(`SELECT retrieval_tier FROM memory_metadata WHERE target_type='chunk' AND target_id=?`)
      .get(String(chunkId)) as { retrieval_tier: string };
    expect(chunkMeta.retrieval_tier).toBe('weak');

    // Simulate the item being recalled (access_count bumped).
    db.prepare(`UPDATE memory_metadata SET access_count = 2 WHERE target_type='message' AND target_id='m1'`).run();
    const res = svc.processProbation();
    expect(res.graduated).toBeGreaterThanOrEqual(1);

    const after = db
      .prepare(`SELECT retrieval_tier, probation_until FROM memory_metadata WHERE target_type='message' AND target_id='m1'`)
      .get() as { retrieval_tier: string; probation_until: number | null };
    expect(after.probation_until).toBeNull();
    expect(after.retrieval_tier).toBe('active'); // salience 0.4 >= 0.35
  });

  it('archives an expired probation capture that was never touched', () => {
    insertMessage('m2');
    const svc = new ProbationService(db);
    svc.applyOnIngest('m2', 0.4, 'untrusted');

    // Expire the probation window.
    db.prepare(`UPDATE memory_metadata SET probation_until = ? WHERE target_type='message' AND target_id='m2'`).run(now() - 10);

    const res = svc.processProbation();
    expect(res.expired).toBeGreaterThanOrEqual(1);

    const after = db
      .prepare(`SELECT retrieval_tier, probation_until, consolidation_level FROM memory_metadata WHERE target_type='message' AND target_id='m2'`)
      .get() as { retrieval_tier: string; probation_until: number | null; consolidation_level: string };
    expect(after.probation_until).toBeNull();
    expect(after.retrieval_tier).toBe('archive_only');
    expect(after.consolidation_level).toBe('archived');
  });
});

describe('LifecycleService.forget', () => {
  it('dryRun previews matches without changing tiers; real run downgrades', () => {
    insertMessage('m3');
    const c1 = insertChunk('m3', 'private chunk a', 'personal', 'ringcentral:private-x');
    const c2 = insertChunk('m3', 'private chunk b', 'personal', 'ringcentral:private-x');
    // metadata rows so we can observe downgrade
    db.prepare(`INSERT INTO memory_metadata (target_type, target_id, salience_score, retrieval_tier, created_at) VALUES ('chunk', ?, 0.5, 'active', ?)`).run(String(c1), now());
    db.prepare(`INSERT INTO memory_metadata (target_type, target_id, salience_score, retrieval_tier, created_at) VALUES ('chunk', ?, 0.5, 'active', ?)`).run(String(c2), now());

    const svc = new LifecycleService(db);
    const preview = svc.forget({ source: 'ringcentral:private-x', scope: 'personal', dryRun: true });
    expect(preview.dryRun).toBe(true);
    expect(preview.matchedChunks).toBe(2);
    expect(preview.downgraded).toBe(0);

    const real = svc.forget({ source: 'ringcentral:private-x', scope: 'personal' });
    expect(real.downgraded).toBeGreaterThanOrEqual(2);

    const tier = db
      .prepare(`SELECT retrieval_tier FROM memory_metadata WHERE target_type='chunk' AND target_id=?`)
      .get(String(c1)) as { retrieval_tier: string };
    expect(tier.retrieval_tier).toBe('archive_only');

    // Original content is never deleted.
    const stillThere = db.prepare(`SELECT COUNT(*) AS c FROM chunks WHERE related_entity_id='m3'`).get() as { c: number };
    expect(stillThere.c).toBe(2);
  });
});
