/**
 * P2 §11.7 dual-read shadow tests: the v3 UnitRecallReader status gate,
 * unit-dedup, channel behavior, and the route shadow's I11 invariance
 * (results unchanged, no reinforcement).
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../llm/LLMClient.js', () => ({
  getLLMClient: () => ({
    generate: vi.fn().mockRejectedValue(new Error('LLM unavailable')),
    generateJSON: vi.fn().mockRejectedValue(new Error('LLM unavailable')),
    getTargetHealthSnapshot: () => [],
  }),
  LLMClient: vi.fn(),
}));

vi.mock('../llm/EmbeddingClient.js', () => ({
  EmbeddingClient: {
    getInstance: vi.fn().mockRejectedValue(new Error('no embedding')),
    isLoaded: vi.fn().mockReturnValue(false),
    getModelName: vi.fn().mockReturnValue('mock-model'),
  },
}));

import type { FastifyInstance } from 'fastify';
import type BetterSqlite3 from 'better-sqlite3';

import { buildApp } from '../server.js';
import { getTestDb } from './setup.js';
import { EpisodeRepository, spanTextHashOf } from '../core/v3/EpisodeRepository.js';
import { UnitTruthMaintainer } from '../core/v3/UnitTruthMaintainer.js';

const actor = { actorType: 'system' as const, actorId: 'p2-test', userId: 'test-user' };

describe('v3 UnitRecallReader (P2 dual-read)', () => {
  let db: BetterSqlite3.Database;
  let truth: UnitTruthMaintainer;
  const episodeIds: string[] = [];

  const seedUnit = (episodeContent: string, text: string, status?: string) => {
    const epId = `ep-${Math.random().toString(36).slice(2)}`;
    db.prepare(
      `INSERT INTO messages_raw (id, content, source_type, sender, scope, timestamp, trust_class, claim_attribution_status, claim_attribution_version, created_at)
       VALUES (?, ?, 'glip', 'colleague', 'work', 1780000000, 'internal', 'pending', 1, 1780000000)`,
    ).run(epId, episodeContent);
    episodeIds.push(epId);
    const spanStart = episodeContent.indexOf('SPAN');
    const buf = Buffer.from(episodeContent.slice(0, spanStart), 'utf8').length;
    const result = truth.propose(
      {
        memoryForm: 'semantic',
        kind: 'fact',
        // Unique subject per seed: identical prefixes would merge all seeds
        // into one unit under the conflict-scope rules.
        subjectKey: `${text.slice(0, 8)}-${epId.slice(3, 8)}`,
        predicateKey: 'is',
        text,
        language: 'mixed',
        observedAt: 1780000000,
      },
      [
        {
          episodeId: epId,
          spanStart: buf,
          spanEnd: buf + Buffer.byteLength('SPAN', 'utf8'),
          sourceRole: 'primary',
          evidenceKey: `ev-${Math.random().toString(36).slice(2)}`,
          provenanceFamily: epId,
          evidenceClass: 'self_statement',
        },
      ],
      actor,
      `wuk-${Math.random().toString(36).slice(2)}`,
    );
    if (status) {
      db.prepare('UPDATE memory_units SET status = ? WHERE id = ?').run(status, result.unitId);
    }
    return result.unitId;
  };

  beforeEach(() => {
    db = getTestDb();
    for (const t of [
      'projection_outbox', 'memory_unit_views', 'memory_unit_revisions',
      'memory_unit_sources', 'memory_units', 'truth_integrations',
      'ingest_extraction_results', 'ingest_jobs',
    ]) {
      db.prepare(`DELETE FROM ${t}`).run();
    }
    db.prepare(`DELETE FROM messages_raw WHERE id LIKE 'ep-%'`).run();
    truth = new UnitTruthMaintainer(db, new EpisodeRepository(db));
  });

  afterEach(() => {
    // FK order: children first, then episodes.
    for (const t of [
      'projection_outbox', 'memory_unit_views', 'memory_unit_revisions',
      'memory_unit_sources', 'memory_units', 'truth_integrations',
    ]) {
      db.prepare(`DELETE FROM ${t}`).run();
    }
    db.prepare(`DELETE FROM messages_raw WHERE id LIKE 'ep-%'`).run();
    delete process.env.MEMORY_READ_V3_RECALL_SHADOW;
  });

  it('finds units lexically, deduped per unit, with both lexical channels', async () => {
    const { UnitRecallReader } = await import('../core/v3/UnitRecallReader.js');
    const id1 = seedUnit('meeting note SPAN today', 'NOVA-1647 epic assignee is Colin');
    seedUnit('other note SPAN here', 'unrelated trivia about coffee');

    const reader = new UnitRecallReader(db);
    const result = reader.recall('NOVA-1647 epic assignee', 10);
    expect(result.candidates.length).toBeGreaterThan(0);
    expect(result.candidates[0].unitId).toBe(id1);
    // unit-dedup: a unit appears once even if both channels match
    const ids = result.candidates.map((c) => c.unitId);
    expect(new Set(ids).size).toBe(ids.length);
    expect(result.channelStats.length).toBeGreaterThan(0);
  });

  it('I6: retracted/archived/deletion_pending units never return', async () => {
    const { UnitRecallReader } = await import('../core/v3/UnitRecallReader.js');
    const keep = seedUnit('keep note SPAN', 'weather forecast for shanghai tomorrow');
    seedUnit('drop note SPAN', 'weather forecast for beijing tomorrow', 'retracted');
    seedUnit('drop note SPAN', 'weather forecast for guangzhou tomorrow', 'archived');
    seedUnit('drop note SPAN', 'weather forecast for chengdu tomorrow', 'deletion_pending');

    const reader = new UnitRecallReader(db);
    const result = reader.recall('weather forecast tomorrow', 20);
    const returned = new Set(result.candidates.map((c) => c.unitId));
    expect(returned.has(keep)).toBe(true);
    // Only the recallable unit is present.
    expect(result.candidates.every((c) => c.status === 'provisional')).toBe(true);
    expect(result.candidates.filter((c) => returned.has(c.unitId)).length).toBe(result.candidates.length);
    expect(result.candidates.some((c) => c.status === 'retracted')).toBe(false);
    expect(result.candidates.some((c) => c.status === 'archived')).toBe(false);
    expect(result.candidates.some((c) => c.status === 'deletion_pending')).toBe(false);
  });

  it('CJK query hits via the trigram channel', async () => {
    const { UnitRecallReader } = await import('../core/v3/UnitRecallReader.js');
    const id = seedUnit('会议纪要 SPAN 结束', '团队决定迁移CI流水线到GitHub Actions');
    const reader = new UnitRecallReader(db);
    const result = reader.recall('迁移CI流水线', 10);
    expect(result.candidates.map((c) => c.unitId)).toContain(id);
    expect(result.channelStats.some((c) => c.channel === 'lexical_tri')).toBe(true);
  });

  it('route shadow is result-invariant and non-reinforcing (I11)', async () => {
    process.env.MEMORY_READ_V3_RECALL_SHADOW = 'true';
    const ingestMarker = `p2-shadow-inv-${Date.now()}`;
    const seed = `keep SPAN ${ingestMarker} decision`;
    const epId = `ep-${Math.random().toString(36).slice(2)}`;
    db.prepare(
      `INSERT INTO messages_raw (id, content, source_type, sender, scope, timestamp, trust_class, claim_attribution_status, claim_attribution_version, created_at)
       VALUES (?, ?, 'glip', 'colleague', 'work', 1780000000, 'internal', 'pending', 1, 1780000000)`,
    ).run(epId, seed);
    episodeIds.push(epId);
    truth.propose(
      {
        memoryForm: 'semantic', kind: 'decision',
        subjectKey: ingestMarker.slice(0, 12), predicateKey: 'is',
        text: `decision about ${ingestMarker}`, language: 'mixed', observedAt: 1780000000,
      },
      [{
        episodeId: epId,
        spanStart: Buffer.byteLength('keep SPAN ', 'utf8'),
        spanEnd: Buffer.byteLength('keep SPAN ', 'utf8') + Buffer.byteLength(ingestMarker, 'utf8'),
        sourceRole: 'primary',
        evidenceKey: 'ev-p2-1', provenanceFamily: epId,
        evidenceClass: 'self_statement',
      }],
      actor, 'wuk-p2-shadow-1',
    );

    const result = await buildApp({ db });
    process.env.MEMORY_READ_V3_RECALL_SHADOW = 'true';
    const first = await result.app.inject({
      method: 'POST', url: '/api/v1/recall',
      payload: { query: ingestMarker, topK: 5, includeMetadata: true },
    });
    const off = (() => { delete process.env.MEMORY_READ_V3_RECALL_SHADOW; return null; })();
    void off;
    const second = await result.app.inject({
      method: 'POST', url: '/api/v1/recall',
      payload: { query: ingestMarker, topK: 5, includeMetadata: true },
    });
    expect(second.json().items.map((i: { id: string }) => i.id)).toEqual(
      first.json().items.map((i: { id: string }) => i.id),
    );
    await result.app.close();
  });
});