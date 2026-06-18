/**
 * Tests for P1-6 slice A: chunk-level merge decision apply semantics
 * (UPDATE / MERGE / NOOP), plus the decideAndApply ADD fallback.
 */

import { getTestDb, cleanupTestDb } from './setup.js';
import { MergeDecisionService } from '../core/MergeDecisionService.js';
import { now } from '../utils/time.js';
import type Database from 'better-sqlite3';

let db: Database.Database;

function insertChunk(content: string): number {
  const info = db
    .prepare(
      `INSERT INTO chunks
         (file_path, line_start, line_end, content, content_hash, scope, source,
          source_type, related_entity_id, token_count, created_at)
       VALUES ('m/1', 0, 0, ?, ?, 'work', 'web', 'webpage', 'm1', 10, ?)`,
    )
    .run(content, `h-${content}`, now());
  return Number(info.lastInsertRowid);
}

function tierOf(chunkId: number): string | undefined {
  const row = db
    .prepare(`SELECT retrieval_tier FROM memory_metadata WHERE target_type='chunk' AND target_id=?`)
    .get(String(chunkId)) as { retrieval_tier: string } | undefined;
  return row?.retrieval_tier;
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
});

describe('MergeDecisionService.applyDecision', () => {
  it('UPDATE marks the neighbor superseded and downgrades it', () => {
    const oldId = insertChunk('MTR-148115 BE 估 3 人天');
    const newId = insertChunk('MTR-148115 改估 5 人天');
    new MergeDecisionService(db).applyDecision(newId, {
      op: 'UPDATE',
      neighborIds: [oldId],
      reason: '同一 issue 的新估值',
    });
    const old = db.prepare(`SELECT superseded_by, merge_reason FROM chunks WHERE chunk_id=?`).get(oldId) as {
      superseded_by: number | null;
      merge_reason: string | null;
    };
    expect(old.superseded_by).toBe(newId);
    expect(old.merge_reason).toContain('新估值');
    expect(tierOf(oldId)).toBe('weak');
  });

  it('MERGE folds neighbors into the new chunk', () => {
    const a = insertChunk('客户要求导出改 XLSX');
    const b = insertChunk('FE 需要重估导出格式');
    const merged = insertChunk('导出格式改 XLSX，FE 重估（合并）');
    new MergeDecisionService(db).applyDecision(merged, {
      op: 'MERGE',
      neighborIds: [a, b],
      reason: '互补合并',
    });
    for (const id of [a, b]) {
      const row = db.prepare(`SELECT merged_into FROM chunks WHERE chunk_id=?`).get(id) as { merged_into: number };
      expect(row.merged_into).toBe(merged);
      expect(tierOf(id)).toBe('weak');
    }
  });

  it('NOOP downgrades the new chunk and reinforces the neighbor', () => {
    const oldId = insertChunk('既有结论');
    db.prepare(
      `INSERT INTO memory_metadata (target_type, target_id, access_count, retrieval_tier, created_at)
       VALUES ('chunk', ?, 0, 'active', ?)`,
    ).run(String(oldId), now());
    const dupId = insertChunk('既有结论（重复）');
    new MergeDecisionService(db).applyDecision(dupId, {
      op: 'NOOP',
      neighborIds: [oldId],
      reason: '纯重复',
    });
    expect(tierOf(dupId)).toBe('weak');
    const dup = db.prepare(`SELECT merged_into FROM chunks WHERE chunk_id=?`).get(dupId) as { merged_into: number };
    expect(dup.merged_into).toBe(oldId);
    const acc = db
      .prepare(`SELECT access_count FROM memory_metadata WHERE target_type='chunk' AND target_id=?`)
      .get(String(oldId)) as { access_count: number };
    expect(acc.access_count).toBe(1);
  });

  it('decideAndApply falls back to ADD with no neighbors (no vec match)', async () => {
    const id = insertChunk('完全独立的一条新记忆 zzz');
    const decision = await new MergeDecisionService(db, async () => ({
      op: 'MERGE',
      neighborIds: [],
      reason: 'should-not-be-used',
    })).decideAndApply(id, '完全独立的一条新记忆 zzz');
    expect(decision.op).toBe('ADD');
  });
});
