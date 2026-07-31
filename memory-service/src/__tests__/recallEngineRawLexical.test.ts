import { describe, expect, it } from 'vitest';

import { RecallEngine } from '../core/RecallEngine.js';
import { getTestDb } from './setup.js';

describe('RecallEngine raw-message lexical fallback', () => {
  it('finds an unchunked historical message through a cost synonym query', async () => {
    const db = getTestDb();
    const timestamp = Math.floor(Date.now() / 1000) - 60 * 24 * 60 * 60;
    db.prepare(
      `INSERT INTO messages_raw
        (id, content, source_type, timestamp, created_at)
       VALUES (?, ?, ?, ?, ?)`,
    ).run(
      'cursor-cost-raw-only',
      'Cursor is 30% more expensive than directly using Codex for the same task.',
      'glip',
      timestamp,
      timestamp,
    );
    db.prepare(
      `INSERT INTO messages_raw
        (id, content, source_type, timestamp, created_at)
       VALUES (?, ?, ?, ?, ?)`,
    ).run(
      'cursor-generic-raw-only',
      'Windsurf costs three times more than Cursor.',
      'glip',
      timestamp + 1,
      timestamp + 1,
    );

    const result = await new RecallEngine(db).recall({
      query: 'Cursor 的成本/性价比结论是什么？',
      channels: ['fts'],
      topK: 1,
      includeMetadata: true,
      scope: 'work',
      lifecycleMode: 'historical',
    });

    expect(result.items[0]?.id).toBe('cursor-cost-raw-only');
    expect(result.items[0]?.metadata?.lexicalFallback).toBe(true);
    expect(result.items[0]?.metadata?.lexicalDirectClaim).toBe(true);
  });

  it('keeps the direct raw claim when diversity ranking would otherwise omit it', () => {
    const engine = new RecallEngine(getTestDb()) as any;
    const directClaim = {
      id: 'cursor-cost-raw-only',
      type: 'message',
      content: 'Cursor is 30% more expensive than Codex.',
      score: 1.2,
      channels: ['fts'],
      lifecycleWeight: 0.55,
      metadata: { lexicalFallback: true, lexicalDirectClaim: true },
    };
    const ranked = [
      {
        id: 'generic-cursor-project',
        type: 'entity',
        content: 'Cursor project metadata',
        score: 0.9,
        channels: ['graph'],
      },
    ];

    const result = engine.preserveDirectLexicalClaim(
      ranked,
      [...ranked, directClaim],
      1,
    );

    expect(result).toHaveLength(1);
    expect(result[0]?.id).toBe('cursor-cost-raw-only');
    expect(result[0]?.score).toBeCloseTo(0.66);
  });

  it('does not inject raw-message fallback candidates into passive recall', async () => {
    const db = getTestDb();
    const timestamp = Math.floor(Date.now() / 1000) - 60 * 24 * 60 * 60;
    db.prepare(
      `INSERT INTO messages_raw
        (id, content, source_type, timestamp, created_at)
       VALUES (?, ?, ?, ?, ?)`,
    ).run(
      'cursor-cost-passive-only',
      'Cursor is 30% more expensive than directly using Codex.',
      'glip',
      timestamp,
      timestamp,
    );

    const result = await new RecallEngine(db).recall({
      query: 'Cursor 的成本/性价比结论是什么？',
      channels: ['fts'],
      topK: 5,
      includeMetadata: true,
      scope: 'work',
      lifecycleMode: 'passive_surface',
    });

    expect(result.items).toEqual([]);
  });
});
