/**
 * P1 v3 truth-core tests (memory-foundation plan §5.3/§5.6, §11.6):
 * schema invariants, idempotent integration receipts, evidence dedup,
 * conflict policy v1, span validation, and replay hard-errors.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import type BetterSqlite3 from 'better-sqlite3';
import { getTestDb } from './setup.js';
import { EpisodeRepository, spanTextHashOf } from '../core/v3/EpisodeRepository.js';
import {
  UnitTruthMaintainer,
  type UnitCandidate,
  type UnitSourceInput,
  type ProposeActor,
} from '../core/v3/UnitTruthMaintainer.js';

describe('v3 UnitTruthMaintainer (P1 truth core)', () => {
  let db: BetterSqlite3.Database;
  let maintainer: UnitTruthMaintainer;
  let episodeId: string;

  const actor: ProposeActor = {
    actorType: 'system',
    actorId: 'p1-shadow-worker',
    userId: 'test-user',
  };

  const seedEpisode = (content: string): string => {
    const id = `episode-${Math.random().toString(36).slice(2)}`;
    db.prepare(
      `INSERT INTO messages_raw (id, content, source_type, timestamp, trust_class, claim_attribution_status, claim_attribution_version, created_at)
       VALUES (?, ?, 'glip', 1780000000, 'internal', 'pending', 1, 1780000000)`,
    ).run(id, content);
    return id;
  };

  const candidate = (text: string, overrides: Partial<UnitCandidate> = {}): UnitCandidate => ({
    memoryForm: 'semantic',
    kind: 'fact',
    subjectKey: 'cursor-license',
    predicateKey: 'policy',
    text,
    ...overrides,
  });

  const source = (
    epId: string,
    content: string,
    overrides: Partial<UnitSourceInput> = {},
  ): UnitSourceInput => {
    const start = content.indexOf('CURSOR_POLICY_SPAN');
    const buf = Buffer.from(content, 'utf8');
    const startByte = Buffer.from(content.slice(0, start), 'utf8').length;
    const spanText = content.slice(start, start + 'CURSOR_POLICY_SPAN'.length);
    const endByte = startByte + Buffer.from(spanText, 'utf8').length;
    void buf;
    return {
      episodeId: epId,
      spanStart: startByte,
      spanEnd: endByte,
      sourceRole: 'primary',
      evidenceKey: `ev-${Math.random().toString(36).slice(2)}`,
      provenanceFamily: `fam-${Math.random().toString(36).slice(2)}`,
      evidenceClass: 'first_party_record',
      ...overrides,
    };
  };

  beforeEach(() => {
    db = getTestDb();
    const episodes = new EpisodeRepository(db);
    maintainer = new UnitTruthMaintainer(db, episodes);
    episodeId = seedEpisode('前置文本 CURSOR_POLICY_SPAN 后置文本');
  });

  afterEach(() => {
    db.prepare('DELETE FROM projection_outbox').run();
    db.prepare('DELETE FROM memory_unit_views').run();
    db.prepare('DELETE FROM memory_unit_revisions').run();
    db.prepare('DELETE FROM memory_unit_sources').run();
    db.prepare('DELETE FROM memory_units').run();
    db.prepare('DELETE FROM truth_integrations').run();
    db.prepare(`DELETE FROM messages_raw WHERE id LIKE 'episode-%'`).run();
  });

  it('propose → created: unit + sources + revision + body view + outbox, atomically', () => {
    const src = source(episodeId, '前置文本 CURSOR_POLICY_SPAN 后置文本');
    const result = maintainer.propose(
      candidate('Cursor 许可政策按用量计费'),
      [src],
      actor,
      'job-1:hash-a:0',
    );

    expect(result.decision).toBe('created');
    const unit = db
      .prepare('SELECT * FROM memory_units WHERE id = ?')
      .get(result.unitId) as any;
    expect(unit.status).toBe('provisional');
    expect(unit.current_revision).toBe(1);
    expect(unit.source_independence_count_cached).toBe(1);
    expect(unit.normalized_text).toBe('cursor 许可政策按用量计费');

    const sources = db
      .prepare('SELECT * FROM memory_unit_sources WHERE unit_id = ?')
      .all(result.unitId) as any[];
    expect(sources).toHaveLength(1);
    // Span hash matches the actual persisted span (I4 span discipline).
    expect(sources[0].span_text_hash).toBe(spanTextHashOf('CURSOR_POLICY_SPAN'));

    const revision = db
      .prepare('SELECT * FROM memory_unit_revisions WHERE unit_id = ?')
      .get(result.unitId) as any;
    expect(revision.operation).toBe('created');
    expect(JSON.parse(revision.after_snapshot_json).text).toBe('Cursor 许可政策按用量计费');
    expect(revision.truth_policy_version).toBe('truth-policies-v1');

    const view = db
      .prepare(`SELECT * FROM memory_unit_views WHERE unit_id = ? AND view_kind = 'body'`)
      .get(result.unitId) as any;
    expect(view.raw_text).toBe('Cursor 许可政策按用量计费');

    const outbox = db
      .prepare('SELECT * FROM projection_outbox WHERE unit_id = ?')
      .all(result.unitId) as any[];
    expect(outbox).toHaveLength(1);
    expect(outbox[0].status).toBe('pending');

    const receipt = db
      .prepare('SELECT * FROM truth_integrations WHERE work_unit_key = ?')
      .get('job-1:hash-a:0') as any;
    expect(receipt.decision).toBe('created');
  });

  it('I5: same work_unit_key + same candidate replays the receipt without side effects', () => {
    const src = source(episodeId, '前置文本 CURSOR_POLICY_SPAN 后置文本');
    const first = maintainer.propose(candidate('同一事实'), [src], actor, 'wuk-1');
    const counts = () => ({
      units: (db.prepare('SELECT COUNT(*) c FROM memory_units').get() as any).c,
      sources: (db.prepare('SELECT COUNT(*) c FROM memory_unit_sources').get() as any).c,
      receipts: (db.prepare('SELECT COUNT(*) c FROM truth_integrations').get() as any).c,
    });
    const before = counts();
    const replay = maintainer.propose(candidate('同一事实'), [src], actor, 'wuk-1');
    const after = counts();

    expect(replay.unitId).toBe(first.unitId);
    expect(replay.revision).toBe(first.revision);
    expect(after).toEqual(before);
  });

  it('I5 hard error: same work_unit_key with a DIFFERENT candidate is rejected', () => {
    const src = source(episodeId, '前置文本 CURSOR_POLICY_SPAN 后置文本');
    maintainer.propose(candidate('事实甲'), [src], actor, 'wuk-2');
    expect(() =>
      maintainer.propose(candidate('事实乙'), [src], actor, 'wuk-2'),
    ).toThrow(/different candidate hash/);
    // The original receipt is preserved.
    const receipt = db
      .prepare('SELECT decision FROM truth_integrations WHERE work_unit_key = ?')
      .get('wuk-2') as any;
    expect(receipt.decision).toBe('created');
  });

  it('I6: same evidence_key replay corroborates without reinforcing confidence', () => {
    const src = source(episodeId, '前置文本 CURSOR_POLICY_SPAN 后置文本');
    const first = maintainer.propose(candidate('稳定事实'), [src], actor, 'wuk-3');
    const confidenceBefore = (db
      .prepare('SELECT confidence FROM memory_units WHERE id = ?')
      .get(first.unitId) as any).confidence;

    // A different job re-integrating the SAME evidence_key.
    const replaySource = { ...src, evidenceKey: src.evidenceKey };
    const second = maintainer.propose(
      candidate('稳定事实'),
      [replaySource],
      actor,
      'wuk-3b',
    );

    expect(second.decision).toBe('corroborated');
    expect(second.revision).toBe(first.revision); // no revision bump on pure replay
    const confidenceAfter = (db
      .prepare('SELECT confidence FROM memory_units WHERE id = ?')
      .get(first.unitId) as any).confidence;
    expect(confidenceAfter).toBe(confidenceBefore);
  });

  it('independent families corroborate and raise confidence by 0.08 each', () => {
    const ep1 = seedEpisode('前 CURSOR_POLICY_SPAN 后');
    const ep2 = seedEpisode('前 CURSOR_POLICY_SPAN 后');
    const first = maintainer.propose(
      candidate('共同事实'),
      [source(ep1, '前 CURSOR_POLICY_SPAN 后', { provenanceFamily: 'fam-a' })],
      actor,
      'wuk-4',
    );
    const conf1 = (db.prepare('SELECT confidence, source_independence_count_cached c2 FROM memory_units WHERE id = ?').get(first.unitId) as any).confidence;
    const second = maintainer.propose(
      candidate('共同事实'),
      [source(ep2, '前 CURSOR_POLICY_SPAN 后', { provenanceFamily: 'fam-b' })],
      actor,
      'wuk-4b',
    );
    const unit = db
      .prepare('SELECT confidence, source_independence_count_cached FROM memory_units WHERE id = ?')
      .get(second.unitId) as any;
    expect(second.decision).toBe('corroborated');
    expect(unit.source_independence_count_cached).toBe(2);
    expect(unit.confidence).toBeCloseTo(conf1 + 0.08, 6);
  });

  it('conflicting text → disputed (never auto-superseded, policy v1)', () => {
    const ep1 = seedEpisode('前 CURSOR_POLICY_SPAN 后');
    const ep2 = seedEpisode('前 CURSOR_POLICY_SPAN 后');
    maintainer.propose(
      candidate('Cursor 按订阅计费'),
      [source(ep1, '前 CURSOR_POLICY_SPAN 后')],
      actor,
      'wuk-5',
    );
    const conflict = maintainer.propose(
      candidate('Cursor 按用量计费'),
      [source(ep2, '前 CURSOR_POLICY_SPAN 后')],
      actor,
      'wuk-5b',
    );
    expect(conflict.decision).toBe('disputed');
    const unit = db.prepare('SELECT status FROM memory_units WHERE id = ?').get(conflict.unitId) as any;
    expect(unit.status).toBe('disputed');
  });

  it('system_inference-only candidates cannot dispute-resolve against a disputed unit', () => {
    const ep1 = seedEpisode('前 CURSOR_POLICY_SPAN 后');
    const ep2 = seedEpisode('前 CURSOR_POLICY_SPAN 后');
    maintainer.propose(
      candidate('断言甲'),
      [source(ep1, '前 CURSOR_POLICY_SPAN 后', { evidenceClass: 'self_statement' })],
      actor,
      'wuk-6',
    );
    maintainer.propose(
      candidate('断言乙'),
      [source(ep2, '前 CURSOR_POLICY_SPAN 后', { evidenceClass: 'third_party_report' })],
      actor,
      'wuk-6b',
    );
    // Inference tries to break the tie — policy v1: rejected.
    const inference = maintainer.propose(
      candidate('断言乙'),
      [source(ep2, '前 CURSOR_POLICY_SPAN 后', { evidenceClass: 'system_inference', evidenceKey: 'inf-1' })],
      actor,
      'wuk-6c',
    );
    expect(inference.decision).toBe('rejected');
    expect(inference.unitId).toBe('');
  });

  it('span hash drift is a hard error and leaves nothing written', () => {
    const src = source(episodeId, '前置文本 CURSOR_POLICY_SPAN 后置文本');
    const tampered = { ...src, spanTextHash: 'deadbeef'.repeat(8) };
    expect(() =>
      maintainer.propose(candidate('事实'), [tampered], actor, 'wuk-7'),
    ).toThrow(/span hash drift/);
    expect(
      (db.prepare('SELECT COUNT(*) c FROM memory_units').get() as any).c,
    ).toBe(0);
    expect(
      (db.prepare('SELECT COUNT(*) c FROM truth_integrations').get() as any).c,
    ).toBe(0);
  });

  it('out-of-range span is rejected with nothing written', () => {
    const src: UnitSourceInput = {
      episodeId: episodeId,
      spanStart: 999_999,
      spanEnd: 1_000_000,
      sourceRole: 'primary',
      evidenceKey: 'ev-x',
      provenanceFamily: 'fam-x',
      evidenceClass: 'first_party_record',
    };
    expect(() => maintainer.propose(candidate('事实'), [src], actor, 'wuk-8')).toThrow(
      /span invalid/,
    );
  });
});
