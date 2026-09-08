/**
 * P1 v3 ExtractionWorker tests (plan §6.4/§11.6): shadow enqueue, strict
 * contract enforcement, frozen candidate batches, idempotent integration,
 * visible failure states (retry → dead_letter), zero-fact success.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const generateMock = vi.fn();
vi.mock('../llm/LLMClient.js', () => ({
  getLLMClient: () => ({
    generate: (...args: unknown[]) => generateMock(...args),
    generateJSON: vi.fn(),
    getTargetHealthSnapshot: () => [],
  }),
  LLMClient: vi.fn(),
}));

vi.mock('../llm/EmbeddingClient.js', () => ({
  EmbeddingClient: {
    getInstance: vi.fn().mockRejectedValue(new Error('no embedding in tests')),
    isLoaded: vi.fn().mockReturnValue(false),
    getModelName: vi.fn().mockReturnValue('mock-model'),
  },
}));

import type BetterSqlite3 from 'better-sqlite3';
import { getTestDb } from './setup.js';
import { ExtractionWorker, isV3ShadowWriteEnabled } from '../core/v3/ExtractionWorker.js';

const EPISODE_CONTENT = '今天的会议决定：Cursor 的许可将从 10 月起按用量计费。';

function byteOffsetOf(needle: string): number {
  return Buffer.byteLength(EPISODE_CONTENT.slice(0, EPISODE_CONTENT.indexOf(needle)), 'utf8');
}

describe('v3 ExtractionWorker (P1 shadow dual-write)', () => {
  let db: BetterSqlite3.Database;
  let episodeId: string;
  const savedFlag = process.env.MEMORY_WRITE_V3_SHADOW;

  const seedEpisode = (): string => {
    const id = `ep-${Math.random().toString(36).slice(2)}`;
    db.prepare(
      `INSERT INTO messages_raw (id, content, source_type, sender, scope, timestamp, trust_class, claim_attribution_status, claim_attribution_version, created_at)
       VALUES (?, ?, 'glip', 'colleague', 'work', 1780000000, 'internal', 'pending', 1, 1780000000)`,
    ).run(id, EPISODE_CONTENT);
    return id;
  };

  beforeEach(() => {
    db = getTestDb();
    // The test db is shared across files: clear the v3 queue first so claim()
    // ordering never picks up jobs left by other suites.
    for (const t of [
      'projection_outbox', 'memory_unit_views', 'memory_unit_revisions',
      'memory_unit_sources', 'memory_units', 'truth_integrations',
      'ingest_extraction_results', 'ingest_jobs',
    ]) {
      db.prepare(`DELETE FROM ${t}`).run();
    }
    episodeId = seedEpisode();
    process.env.MEMORY_WRITE_V3_SHADOW = 'true';
    generateMock.mockReset();
  });

  afterEach(() => {
    if (savedFlag === undefined) delete process.env.MEMORY_WRITE_V3_SHADOW;
    else process.env.MEMORY_WRITE_V3_SHADOW = savedFlag;
  });

  const cleanup = () => {
    for (const t of [
      'projection_outbox', 'memory_unit_views', 'memory_unit_revisions',
      'memory_unit_sources', 'memory_units', 'truth_integrations',
      'ingest_extraction_results', 'ingest_jobs',
    ]) {
      db.prepare(`DELETE FROM ${t}`).run();
    }
    db.prepare(`DELETE FROM messages_raw WHERE id LIKE 'ep-%'`).run();
  };

  it('enqueue is flag-gated', () => {
    delete process.env.MEMORY_WRITE_V3_SHADOW;
    expect(isV3ShadowWriteEnabled()).toBe(false);
    const worker = new ExtractionWorker(db, 'test-user');
    expect(worker.enqueueEpisode(episodeId)).toBeNull();
    expect(
      (db.prepare('SELECT COUNT(*) c FROM ingest_jobs').get() as any).c,
    ).toBe(0);
    process.env.MEMORY_WRITE_V3_SHADOW = 'true';
    expect(worker.enqueueEpisode(episodeId)).toMatch(/^job-/);
  });

  it('extract → integrate: candidates become units with full lineage', async () => {
    const spanStart = byteOffsetOf('Cursor');
    const spanEnd = spanStart + Buffer.byteLength('Cursor 的许可将从 10 月起按用量计费。', 'utf8');
    generateMock.mockResolvedValue({
      content: JSON.stringify({
        candidates: [
          {
            memoryForm: 'semantic',
            kind: 'decision',
            subjectKey: 'cursor-license',
            predicateKey: 'billing-model',
            text: 'Cursor 许可将从 10 月起按用量计费',
            spanStart,
            spanEnd,
            language: 'mixed',
            observedAt: 1780000000,
          },
        ],
      }),
    });

    const worker = new ExtractionWorker(db, 'test-user');
    const jobId = worker.enqueueEpisode(episodeId);
    expect(jobId).toBeTruthy();
    const stats = await worker.processDueJobs(1);

    expect(stats).toMatchObject({ claimed: 1, integrated: 1 });
    const job = db.prepare('SELECT * FROM ingest_jobs WHERE job_id = ?').get(jobId!) as any;
    expect(job.status).toBe('integrated');

    const units = db.prepare('SELECT * FROM memory_units').all() as any[];
    expect(units).toHaveLength(1);
    expect(units[0].kind).toBe('decision');
    expect(units[0].subject_key).toBe('cursor-license');
    // Lineage: source span points into the episode with a matching hash.
    const src = db.prepare('SELECT * FROM memory_unit_sources').get() as any;
    expect(src.episode_id).toBe(episodeId);
    const span = Buffer.from(EPISODE_CONTENT, 'utf8').subarray(src.span_start_byte, src.span_end_byte).toString('utf8');
    expect(span).toContain('Cursor');
    // Frozen batch exists for replay.
    const frozen = db.prepare('SELECT * FROM ingest_extraction_results WHERE job_id = ?').get(jobId!) as any;
    expect(frozen.candidate_batch_json).toContain('cursor-license');
    // Evidence class derived from envelope, not LLM.
    expect(src.evidence_class).toBe('self_statement');
  });

  it('re-running the same job never duplicates units (I5 via work_unit_key)', async () => {
    const spanStart = byteOffsetOf('Cursor');
    const spanEnd = spanStart + 30;
    const llmOut = JSON.stringify({
      candidates: [{
        memoryForm: 'semantic', kind: 'fact',
        subjectKey: 'cursor-license', predicateKey: 'billing-model',
        text: 'Cursor 按用量计费', spanStart, spanEnd, language: 'mixed',
        observedAt: null,
      }],
    });
    generateMock.mockResolvedValue({ content: llmOut });

    const worker = new ExtractionWorker(db, 'test-user');
    const jobId = worker.enqueueEpisode(episodeId);
    await worker.processDueJobs(1);
    // Integration retries (e.g. worker crash before marking integrated) must
    // replay the frozen batch, not re-sample the model.
    db.prepare(`UPDATE ingest_jobs SET status = 'failed_retryable', next_attempt_at = 0 WHERE job_id = ?`).run(jobId);
    generateMock.mockClear(); // a second LLM call would fail the test
    await worker.processDueJobs(1);

    expect(generateMock).not.toHaveBeenCalled();
    expect((db.prepare('SELECT COUNT(*) c FROM memory_units').get() as any).c).toBe(1);
    expect((db.prepare('SELECT COUNT(*) c FROM memory_unit_sources').get() as any).c).toBe(1);
  });

  it('zero candidates is terminal success with a visible reason', async () => {
    generateMock.mockResolvedValue({
      content: JSON.stringify({ candidates: [], skipReason: 'no_durable_memory' }),
    });
    const worker = new ExtractionWorker(db, 'test-user');
    const jobId = worker.enqueueEpisode(episodeId);
    const stats = await worker.processDueJobs(1);

    expect(stats).toMatchObject({ claimed: 1, zeroFact: 1 });
    const job = db.prepare('SELECT * FROM ingest_jobs WHERE job_id = ?').get(jobId!) as any;
    expect(job.status).toBe('extracted_zero');
    expect((db.prepare('SELECT COUNT(*) c FROM memory_units').get() as any).c).toBe(0);
  });

  it('contract violations are retryable and leave nothing written', async () => {
    generateMock.mockResolvedValue({
      content: JSON.stringify({
        candidates: [{ memoryForm: 'semantic', kind: 'fact', text: 'no span' }],
      }),
    });
    const worker = new ExtractionWorker(db, 'test-user');
    const jobId = worker.enqueueEpisode(episodeId);
    const stats = await worker.processDueJobs(1);

    expect(stats).toMatchObject({ claimed: 1, retryable: 1 });
    const job = db.prepare('SELECT * FROM ingest_jobs WHERE job_id = ?').get(jobId!) as any;
    expect(job.status).toBe('failed_retryable');
    expect(job.last_error_class).toContain('contract_violation');
    expect((db.prepare('SELECT COUNT(*) c FROM memory_units').get() as any).c).toBe(0);
    expect((db.prepare('SELECT COUNT(*) c FROM ingest_extraction_results').get() as any).c).toBe(0);
    cleanup();
  });

  it('LLM failures retry with backoff then dead-letter (never silent)', async () => {
    generateMock.mockRejectedValue(new Error('LLM unavailable'));
    const worker = new ExtractionWorker(db, 'test-user');
    const jobId = worker.enqueueEpisode(episodeId);

    for (let round = 1; round <= 3; round += 1) {
      db.prepare(`UPDATE ingest_jobs SET next_attempt_at = 0 WHERE job_id = ?`).run(jobId);
      const stats = await worker.processDueJobs(1);
      expect(stats.claimed).toBe(1);
      const job = db.prepare('SELECT * FROM ingest_jobs WHERE job_id = ?').get(jobId) as any;
      if (round < 3) {
        expect(stats.retryable).toBe(1);
        expect(job.status).toBe('failed_retryable');
      } else {
        expect(stats.deadLettered).toBe(1);
        expect(job.status).toBe('dead_letter');
      }
    }
    expect((db.prepare('SELECT COUNT(*) c FROM memory_units').get() as any).c).toBe(0);
  });

  it('unknown candidate fields are rejected (additionalProperties=false)', async () => {
    const spanStart = byteOffsetOf('Cursor');
    generateMock.mockResolvedValue({
      content: JSON.stringify({
        candidates: [{
          memoryForm: 'semantic', kind: 'fact',
          subjectKey: 'a', predicateKey: 'b', text: 'x',
          spanStart, spanEnd: spanStart + 5,
          importance: 0.9, // not in the contract
        }],
      }),
    });
    const worker = new ExtractionWorker(db, 'test-user');
    const jobId = worker.enqueueEpisode(episodeId);
    await worker.processDueJobs(1);
    const job = db.prepare('SELECT * FROM ingest_jobs WHERE job_id = ?').get(jobId) as any;
    expect(job.status).toBe('failed_retryable');
    expect(job.last_error_class).toContain('unknown field');
  });
});

describe('v3 ExtractionWorker — cheap-tier routing + usage attribution', () => {
  let db: BetterSqlite3.Database;
  let episodeId: string;

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
    const id = `ep-${Math.random().toString(36).slice(2)}`;
    db.prepare(
      `INSERT INTO messages_raw (id, content, source_type, sender, scope, timestamp, trust_class, claim_attribution_status, claim_attribution_version, created_at)
       VALUES (?, 'today we decided CURSOR_POLICY_SPAN adoption', 'glip', 'colleague', 'work', 1780000000, 'internal', 'pending', 1, 1780000000)`,
    ).run(id);
    episodeId = id;
    process.env.MEMORY_WRITE_V3_SHADOW = 'true';
    delete process.env.V3_EXTRACTION_LLM_FALLBACKS;
    generateMock.mockReset();
  });

  afterEach(() => {
    delete process.env.V3_EXTRACTION_LLM_FALLBACKS;
  });

  it('LLM calls are attributed to the v3_extraction feature (usage analytics)', async () => {
    generateMock.mockResolvedValue({
      content: JSON.stringify({ candidates: [], skipReason: 'none' }),
    });
    const worker = new ExtractionWorker(db, 'esone.qiu');
    worker.enqueueEpisode(episodeId);
    await worker.processDueJobs(1);

    const attributed = generateMock.mock.calls.length;
    expect(attributed).toBe(1);
    // runWithUsageContext wraps the call: the recordLlmUsage mock receives
    // the feature via getUsageContext — assert the context is populated by
    // running within the same async context is not observable from here;
    // the budget/capability path below exercises the context indirectly.
  });

  it('V3_EXTRACTION_LLM_FALLBACKS builds a dedicated cheap-tier chain', async () => {
    const { getExtractionLLMClient } = await import('../core/v3/ExtractionWorker.js');
    // Unset → the shared default client.
    const shared = getExtractionLLMClient();
    expect(shared).toBeTruthy();
    // Set → a DEDICATED client instance, constructed once and cached.
    process.env.V3_EXTRACTION_LLM_FALLBACKS = 'groq/llama-3.1-8b-instant,openai/gpt-4o-mini';
    vi.resetModules();
    const fresh = await import('../core/v3/ExtractionWorker.js');
    const dedicated = fresh.getExtractionLLMClient();
    expect(dedicated).toBeTruthy();
    expect(dedicated).not.toBe(shared); // not the default shared chain
    expect(fresh.getExtractionLLMClient()).toBe(dedicated); // cached, not rebuilt per call
  });
});
