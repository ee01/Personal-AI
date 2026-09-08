/**
 * P0c trigram shadow index tests (memory-foundation plan §11.4 / backfill
 * plan A3): chunks_fts_tri triggers, rebuild parity, CJK substring recall
 * that the porter tokenizer misses, and the recall shadow probe that never
 * changes results.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import type BetterSqlite3 from 'better-sqlite3';
import { RecallEngine } from '../core/RecallEngine.js';
import { getTestDb } from './setup.js';

describe('chunks_fts_tri shadow index (P0c §11.4)', () => {
  let db: BetterSqlite3.Database;

  const insertChunk = (content: string): number => {
    const r = db
      .prepare(
        `INSERT INTO chunks
          (file_path, line_start, line_end, content, content_hash, scope,
           source, source_type, related_entity_id, token_count, created_at)
         VALUES ('messages/tri-test', 0, 1, ?, 'h-tri', 'work', null, 'glip',
                 'tri-test', 5, 0)`,
      )
      .run(content);
    return Number(r.lastInsertRowid);
  };

  beforeEach(() => {
    db = getTestDb();
  });

  afterEach(() => {
    db.prepare(`DELETE FROM chunks WHERE file_path = 'messages/tri-test'`).run();
    delete process.env.MEMORY_FTS_TRI_SHADOW;
  });

  it('migration creates the trigram table with working triggers', () => {
    const count = db
      .prepare(`SELECT COUNT(*) AS c FROM sqlite_master WHERE name IN ('chunks_fts_tri','chunks_tri_ai','chunks_tri_ad','chunks_tri_au')`)
      .get() as { c: number };
    expect(count.c).toBe(4);

    const id = insertChunk('会议室申请独占流程的问题 report');
    // Insert trigger synced the trigram index
    expect(
      db.prepare(`SELECT COUNT(*) c FROM chunks_fts_tri WHERE rowid = ?`).get(id),
    ).toMatchObject({ c: 1 });

    // Delete trigger removes it
    db.prepare(`DELETE FROM chunks WHERE chunk_id = ?`).run(id);
    expect(
      db.prepare(`SELECT COUNT(*) c FROM chunks_fts_tri WHERE rowid = ?`).get(id),
    ).toMatchObject({ c: 0 });
  });

  it('rebuild keeps the trigram index at full parity with chunks', () => {
    const chunkCount = (db.prepare(`SELECT COUNT(*) c FROM chunks`).get() as { c: number }).c;
    db.prepare(`INSERT INTO chunks_fts_tri(chunks_fts_tri) VALUES ('rebuild')`).run();
    const triCount = (db.prepare(`SELECT COUNT(*) c FROM chunks_fts_tri`).get() as { c: number }).c;
    expect(triCount).toBe(chunkCount);
  });

  it('trigram finds CJK substrings the porter tokenizer misses', () => {
    const id = insertChunk('Neo Huang通知大家会议室申请独占后系统会处理请求审批通过才能使用');
    const probe = '申请独占';

    const triHits = db
      .prepare(`SELECT rowid FROM chunks_fts_tri WHERE chunks_fts_tri MATCH ?`)
      .all(JSON.stringify(probe)) as Array<{ rowid: number }>;
    const triIds = triHits.map((h) => h.rowid);
    expect(triIds).toContain(id);

    // porter unicode61: the whole CJK run is one token, so a mid-string
    // fragment with different boundaries does NOT match — the recall gap.
    const porterHits = db
      .prepare(`SELECT rowid FROM chunks_fts WHERE chunks_fts MATCH ?`)
      .all(`"${probe}"`) as Array<{ rowid: number }>;
    expect(porterHits.map((h) => h.rowid)).not.toContain(id);
  });

  it('recall shadow probe records stats without changing results (I11)', async () => {
    const engine = new RecallEngine(db);
    // Any existing chunk content is fine; the probe must not throw when the
    // table is healthy, and must report tri-only candidates as counts.
    const stats = (engine as unknown as {
      ftsTriShadowProbe: (q: string, limit: number) => ReturnType<() => object>;
    }).ftsTriShadowProbe('会议室申请独占流程', 60);
    expect(stats).toBeDefined();
    expect((stats as { triCandidateCount: number }).triCandidateCount).toBeGreaterThanOrEqual(0);

    // With the flag enabled, recall() attaches shadow stats to the fts
    // diagnostic and returns the SAME items as with the flag off.
    process.env.MEMORY_FTS_TRI_SHADOW = 'true';
    const withShadow = await engine.recall({
      query: '会议室申请独占流程的问题',
      topK: 5,
      includeMetadata: true,
    });
    const shadowDiag = withShadow.channelDiagnostics?.find((d) => d.channel === 'fts');
    expect(shadowDiag?.shadow).toBeDefined();

    delete process.env.MEMORY_FTS_TRI_SHADOW;
    const withoutShadow = await engine.recall({
      query: '会议室申请独占流程的问题',
      topK: 5,
      includeMetadata: true,
    });
    expect(withShadow.items.map((i) => i.id)).toEqual(
      withoutShadow.items.map((i) => i.id),
    );
  });

  it('flag off by default → no shadow stats recorded', async () => {
    const engine = new RecallEngine(db);
    const result = await engine.recall({
      query: '会议室申请独占流程的问题',
      topK: 3,
      includeMetadata: true,
    });
    const ftsDiag = result.channelDiagnostics?.find((d) => d.channel === 'fts');
    expect(ftsDiag?.shadow).toBeUndefined();
  });
});
