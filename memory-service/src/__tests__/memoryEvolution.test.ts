/**
 * Tests for P1-6 slice B: nightly memory evolution — associative memory_links
 * between near-duplicate chunks, written idempotently. Uses the real local
 * embedding model + sqlite-vec, so it is skipped when vec is unavailable.
 */

import { getTestDb, cleanupTestDb } from './setup.js';
import { MemoryEvolutionService } from '../core/MemoryEvolutionService.js';
import { EmbeddingClient } from '../llm/EmbeddingClient.js';
import { now } from '../utils/time.js';
import type Database from 'better-sqlite3';

let db: Database.Database;
let vecAvailable = true;

function insertChunk(messageId: string, content: string): number {
  const info = db
    .prepare(
      `INSERT INTO chunks
         (file_path, line_start, line_end, content, content_hash, scope, source,
          source_type, related_entity_id, token_count, created_at)
       VALUES ('m', 0, 0, ?, ?, 'work', 'web', 'webpage', ?, 10, ?)`,
    )
    .run(content, `h-${content}`, messageId, now());
  return Number(info.lastInsertRowid);
}

async function embedInto(chunkId: number, content: string): Promise<void> {
  const client = await EmbeddingClient.getInstance();
  const v = await client.embed(content);
  try {
    db.prepare(`INSERT INTO chunks_vec (chunk_id, embedding) VALUES (?, ?)`).run(
      chunkId,
      JSON.stringify(v),
    );
  } catch {
    vecAvailable = false;
  }
}

beforeAll(() => {
  db = getTestDb();
});
afterAll(() => {
  cleanupTestDb();
});
beforeEach(() => {
  db.prepare('DELETE FROM memory_links').run();
  db.prepare('DELETE FROM chunks').run();
  try {
    db.prepare('DELETE FROM chunks_vec').run();
  } catch {
    vecAvailable = false;
  }
});

describe('MemoryEvolutionService', () => {
  it('returns a clean no-op when there are no recent chunks', async () => {
    const res = await new MemoryEvolutionService(db).run(now() + 1000);
    expect(res.newChunks).toBe(0);
    expect(res.linksAdded).toBe(0);
  });

  it('links near-duplicate chunks and is idempotent', async () => {
    const oldId = insertChunk('m-old', 'MTR-148115 联调延后到下周，等导出格式变更确认');
    const newId = insertChunk('m-new', 'MTR-148115 的联调推迟一周，要先确认导出格式的改动');
    await embedInto(oldId, 'MTR-148115 联调延后到下周，等导出格式变更确认');
    await embedInto(newId, 'MTR-148115 的联调推迟一周，要先确认导出格式的改动');

    if (!vecAvailable) {
      // Environment without sqlite-vec — evolution is a safe no-op.
      const res = await new MemoryEvolutionService(db).run(now() - 86400);
      expect(res.linksAdded).toBe(0);
      return;
    }

    const svc = new MemoryEvolutionService(db);
    const first = await svc.run(now() - 86400);
    expect(first.newChunks).toBeGreaterThanOrEqual(2);
    expect(first.linksAdded).toBeGreaterThanOrEqual(1);

    const before = (db.prepare('SELECT COUNT(*) AS c FROM memory_links').get() as { c: number }).c;
    await svc.run(now() - 86400);
    const after = (db.prepare('SELECT COUNT(*) AS c FROM memory_links').get() as { c: number }).c;
    expect(after).toBe(before); // idempotent
  });
});
