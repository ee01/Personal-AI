/**
 * P0a-1 supply decoupling tests (memory-foundation re-architecture plan §11.2).
 *
 * Hard gate under test:
 *   "extraction=false 且 salience 低于旧阈值时，eligible 非空 episode 仍产生 chunk
 *    和 FTS" — with MEMORY_SUPPLY_DECOUPLED enabled.
 * Rollback gate under test:
 *   flag off → byte-identical legacy behavior (extraction skip ⇒ no chunks).
 */

import { describe, it, expect, afterEach, vi } from 'vitest';

// Mock the LLM client — extraction fails so the pipeline runs with extraction=null
vi.mock('../llm/LLMClient.js', () => ({
  getLLMClient: () => ({
    generate: vi
      .fn()
      .mockRejectedValue(new Error('LLM not available in tests')),
    generateJSON: vi
      .fn()
      .mockRejectedValue(new Error('LLM not available in tests')),
  }),
  LLMClient: vi.fn(),
}));

// Mock the embedding client — fails immediately so embeddings are skipped
vi.mock('../llm/EmbeddingClient.js', () => ({
  EmbeddingClient: {
    getInstance: vi
      .fn()
      .mockRejectedValue(new Error('Embedding not available in tests')),
    isLoaded: vi.fn().mockReturnValue(false),
    getModelName: vi.fn().mockReturnValue('mock-model'),
  },
}));

import type BetterSqlite3 from 'better-sqlite3';
import { IngestionPipeline } from '../core/IngestionPipeline.js';
import { SalienceScorer } from '../core/SalienceScorer.js';
import { getTestDb } from './setup.js';

function setEnv(name: string, value: string | undefined) {
  if (value === undefined) delete process.env[name];
  else process.env[name] = value;
}

describe('Ingestion supply decoupling (P0a-1)', () => {
  let db: BetterSqlite3.Database;
  const savedEnv: Record<string, string | undefined> = {};

  const stashAndSet = (overrides: Record<string, string | undefined>) => {
    for (const [name, value] of Object.entries(overrides)) {
      savedEnv[name] = process.env[name];
      setEnv(name, value);
    }
  };

  const restoreEnv = () => {
    for (const [name, value] of Object.entries(savedEnv)) {
      setEnv(name, value);
    }
  };

  afterEach(() => {
    restoreEnv();
    vi.restoreAllMocks();
  });

  const ingestOne = async (content: string, ts?: number) => {
    const pipeline = new IngestionPipeline(db);
    return pipeline.ingest({
      content,
      sourceType: 'glip',
      sender: 'tester',
      timestamp: ts ?? Math.floor(Date.now() / 1000),
    });
  };

  const chunksFor = (messageId: string) =>
    db
      .prepare(`SELECT chunk_id FROM chunks WHERE file_path = ?`)
      .all(`messages/${messageId}`) as Array<{ chunk_id: number }>;

  it('extraction disabled + flag ON → eligible episode still gets chunk + FTS', async () => {
    db = getTestDb();
    stashAndSet({
      INGEST_LLM_EXTRACTION_ENABLED: 'false',
      INGEST_EMBEDDING_ENABLED: 'false',
      MEMORY_SUPPLY_DECOUPLED: 'true',
    });

    const marker = `supply-decoupled-fts-marker-${Date.now()}`;
    const result = await ingestOne(
      `This message arrives while LLM extraction is off. ${marker}`,
    );

    expect(result.status).toBe('created');
    expect(result.decision?.extractionStatus).toBe('skipped');
    // Salience is still computed under skip (rank input only).
    expect(typeof result.decision?.salienceScore).toBe('number');
    // The message is indexed and the chunk + FTS supply exists even though
    // extraction was disabled. With fresh content the deterministic salience
    // often passes the legacy gate too, so accept either indexed receipt; the
    // low-salience decoupled receipt is asserted precisely in the test below.
    expect(result.decision?.indexed).toBe(true);
    expect(result.decision?.storage).toBe('indexed');
    expect([
      'salience_indexed',
      'supply_decoupled_indexed',
    ]).toContain(result.decision?.reason);

    const chunks = chunksFor(result.id);
    expect(chunks.length).toBeGreaterThan(0);
    // FTS (external-content trigger) contains the chunk.
    const escaped = JSON.stringify(marker);
    expect(db.prepare(
      `SELECT COUNT(*) AS c FROM chunks_fts WHERE chunks_fts MATCH ?`,
    ).get(escaped)).toMatchObject({ c: chunks.length });
  });

  it('flag OFF (default) → legacy behavior: extraction skip ⇒ no chunk', async () => {
    db = getTestDb();
    stashAndSet({
      INGEST_LLM_EXTRACTION_ENABLED: 'false',
      INGEST_EMBEDDING_ENABLED: 'false',
      MEMORY_SUPPLY_DECOUPLED: undefined,
    });

    const result = await ingestOne(
      `legacy coupled path message ${Date.now()}`,
    );

    expect(result.decision?.extractionStatus).toBe('skipped');
    expect(result.decision?.reason).toBe('extraction_skipped');
    expect(result.decision?.indexed).toBe(false);
    expect(chunksFor(result.id)).toHaveLength(0);
  });

  it('flag ON + empty content → typed skip receipt, no chunk', async () => {
    db = getTestDb();
    stashAndSet({
      INGEST_LLM_EXTRACTION_ENABLED: 'false',
      INGEST_EMBEDDING_ENABLED: 'false',
      MEMORY_SUPPLY_DECOUPLED: 'true',
    });

    const result = await ingestOne('   ');

    expect(result.status).toBe('created');
    expect(result.decision?.reason).toBe('skipped_empty_content');
    expect(result.decision?.indexed).toBe(false);
    expect(result.decision?.storage).toBe('stored_unindexed');
    expect(chunksFor(result.id)).toHaveLength(0);
  });

  it('flag ON + extraction enabled but salience below legacy threshold → still chunked', async () => {
    db = getTestDb();
    stashAndSet({
      INGEST_LLM_EXTRACTION_ENABLED: 'true',
      INGEST_EMBEDDING_ENABLED: 'false',
      MEMORY_SUPPLY_DECOUPLED: 'true',
    });
    const lowScore = vi
      .spyOn(SalienceScorer.prototype, 'scoreMessage')
      .mockResolvedValue({
        score: 0.05,
        components: {
          importance: 0.1,
          frequency: 0,
          recency: 0,
          surprise: 0,
          redundancy: 0,
        },
      } as any);

    const result = await ingestOne(
      `low salience but must stay lexically searchable ${Date.now()}`,
    );

    expect(lowScore).toHaveBeenCalled();
    expect(result.decision?.salienceScore).toBe(0.05);
    // Salience no longer gates indexing: shouldIndex is false but chunks exist.
    expect(result.decision?.shouldIndex).toBe(false);
    expect(result.decision?.indexed).toBe(true);
    expect(result.decision?.reason).toBe('supply_decoupled_indexed');
    expect(chunksFor(result.id).length).toBeGreaterThan(0);
  });

  it('flag ON + duplicate ingest stays idempotent for supply (no duplicate chunks)', async () => {
    db = getTestDb();
    stashAndSet({
      INGEST_LLM_EXTRACTION_ENABLED: 'false',
      INGEST_EMBEDDING_ENABLED: 'false',
      MEMORY_SUPPLY_DECOUPLED: 'true',
    });

    const content = `dup supply marker ${Date.now()}`;
    const first = await ingestOne(content);
    const second = await ingestOne(content);

    expect(first.status).toBe('created');
    // Dedup path (content+source+sender) short-circuits before supply — same
    // id returned, no second chunk set created.
    expect(second.status).toBe('duplicate');
    expect(second.id).toBe(first.id);
    expect(chunksFor(first.id).length).toBe(1);
  });
});
