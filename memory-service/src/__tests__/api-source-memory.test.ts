import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import type BetterSqlite3 from 'better-sqlite3';

import { buildApp } from '../server.js';
import { getTestDb } from './setup.js';

const TABLES_TO_CLEAR = [
  'source_memory_events',
  'source_memory_links',
  'source_memory_triggers',
  'source_memory_takeaways',
  'source_memory_anchors',
  'source_memory_capsules',
  'memory_metadata',
  'chunks',
  'messages_raw',
];

function clearSourceMemoryTables(db: BetterSqlite3.Database): void {
  for (const table of TABLES_TO_CLEAR) {
    try {
      db.prepare(`DELETE FROM ${table}`).run();
    } catch {
      // Optional tables can be absent in older local migration snapshots.
    }
  }
}

describe('Memory Capture source memory API', () => {
  let app: FastifyInstance;
  let db: BetterSqlite3.Database;

  beforeAll(async () => {
    db = getTestDb();
    const result = await buildApp({ db });
    app = result.app;
    await app.ready();
  });

  beforeEach(() => {
    clearSourceMemoryTables(db);
  });

  afterAll(async () => {
    await app.close();
  });

  it('scores selected text as a suggested memory capture candidate', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/source-memory/candidates/selection',
      payload: {
        sourceUrl: 'https://example.com/article',
        sourceTitle: 'NotebookLM source-grounded notes',
        selectedText:
          'NotebookLM works best when the assistant answers from source-grounded evidence and keeps citations attached to the source material.',
        interactions: {
          selectedText: true,
        },
      },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.eligible).toBe(true);
    expect(body.suggestedAction).toBe('suggest');
    expect(body.reasons).toContain('用户选中了文本');
  });

  it('blocks selected secrets before capture', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/source-memory/candidates/selection',
      payload: {
        sourceUrl: 'https://example.com/keys',
        sourceTitle: 'Keys',
        selectedText: 'api_key = sk-abcdefghijklmnopqrstuvwxyz1234567890',
      },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.suggestedAction).toBe('blocked');
    expect(body.blockedReason).toMatch(/secrets|credentials/i);
  });

  it('scores page content with reading interaction as a suggested capture candidate', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/source-memory/candidates/score',
      payload: {
        sourceKind: 'webpage',
        sourceUrl: 'https://example.com/memory-capture',
        sourceTitle: 'Memory Capture product design',
        text:
          'Memory Capture should preserve original source evidence, derive draft takeaways, and keep future triggers so the same browser source can be reused in meetings, AI chats, and planning workflows.',
        interactions: {
          dwellMs: 120000,
          scrollDepth: 0.74,
          copiedText: true,
        },
      },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.eligible).toBe(true);
    expect(body.suggestedAction).toBe('suggest');
    expect(body.reasons).toEqual(
      expect.arrayContaining(['停留时间较长', '阅读深度较高', '用户复制了内容']),
    );
  });

  it('saves selected text as a source memory capsule and web memory signal', async () => {
    const payload = {
      sourceKind: 'selection',
      sourceUrl: 'https://example.com/notebooklm',
      sourceTitle: 'NotebookLM source-grounded workflow',
      selectedText:
        'A source-grounded workflow should keep the original source anchor, a short takeaway, and a future trigger so the memory can be reused in later AI conversations.',
      captureMode: 'manual',
      captureReason: '用户点击选区旁的 + 记住',
      note: '用于 AI CoP 分享准备',
      interactions: {
        selectedText: true,
        manualClick: true,
      },
    };

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/source-memory/capsules',
      payload,
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.capsule.sourceKind).toBe('selection');
    expect(body.capsule.captureMode).toBe('manual');
    expect(body.capsule.summary).toBe('用于 AI CoP 分享准备');
    expect(body.capsule.anchors).toHaveLength(1);
    expect(body.capsule.takeaways.length).toBeGreaterThan(0);

    const webCount = db
      .prepare(`SELECT COUNT(*) AS count FROM messages_raw WHERE source_type = 'web'`)
      .get() as { count: number };
    const chunkCount = db
      .prepare(`SELECT COUNT(*) AS count FROM chunks WHERE source_type = 'web'`)
      .get() as { count: number };
    expect(webCount.count).toBe(1);
    expect(chunkCount.count).toBeGreaterThan(0);

    const metadata = db
      .prepare(`SELECT metadata_json FROM messages_raw WHERE source_type = 'web' LIMIT 1`)
      .get() as { metadata_json: string };
    expect(JSON.parse(metadata.metadata_json).sourceMemoryCapsuleId).toBe(body.capsule.id);
  });

  it('saves whole page content as a webpage source memory capsule', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/source-memory/capsules',
      payload: {
        sourceKind: 'webpage',
        sourceUrl: 'https://example.com/whole-page',
        sourceTitle: 'Whole page source memory',
        text:
          'Whole page Memory Capture should save a longer source article when the user copied content or read deeply enough, while keeping the original URL and source title available as evidence anchors.',
        captureMode: 'manual',
        captureReason: '用户点击页面旁的 + 记住',
        interactions: {
          dwellMs: 120000,
          scrollDepth: 0.72,
          copiedText: true,
          manualClick: true,
        },
      },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.capsule.sourceKind).toBe('webpage');
    expect(body.capsule.anchors[0].anchorKind).toBe('page_excerpt');
    expect(body.capsule.sourceUrl).toBe('https://example.com/whole-page');
    expect(
      (db
        .prepare(`SELECT COUNT(*) AS count FROM messages_raw WHERE source_type = 'web'`)
        .get() as { count: number }).count,
    ).toBe(1);
  });

  it('stores automatic page capture with lower weight and supports undo dismiss', async () => {
    const saveRes = await app.inject({
      method: 'POST',
      url: '/api/v1/source-memory/capsules',
      payload: {
        sourceKind: 'webpage',
        sourceUrl: 'https://example.com/auto-page',
        sourceTitle: 'Automatic page source memory',
        text:
          'Automatic Memory Capture should save a page only after strong reading signals, keep capture mode as auto, and allow the user to undo the automatic save from the lightweight toast.',
        captureMode: 'auto',
        captureReason: '自动入库：浏览时间较久且阅读较深',
        interactions: {
          dwellMs: 180000,
          scrollDepth: 0.82,
          copiedText: false,
        },
      },
    });

    expect(saveRes.statusCode).toBe(200);
    const capsuleId = saveRes.json().capsule.id;
    const messageId = saveRes.json().capsule.messageId;
    expect(saveRes.json().capsule.captureMode).toBe('auto');

    const message = db
      .prepare(`SELECT importance, metadata_json FROM messages_raw WHERE id = ?`)
      .get(messageId) as { importance: number; metadata_json: string };
    expect(message.importance).toBeCloseTo(0.58);
    expect(JSON.parse(message.metadata_json).captureMode).toBe('auto');

    const dismissRes = await app.inject({
      method: 'POST',
      url: `/api/v1/source-memory/capsules/${capsuleId}/dismiss`,
      payload: {
        reason: '用户撤销自动入库',
      },
    });

    expect(dismissRes.statusCode).toBe(200);
    expect(dismissRes.json().capsule.status).toBe('dismissed');
    expect(
      (db
        .prepare(`SELECT COUNT(*) AS count FROM messages_raw WHERE id = ?`)
        .get(messageId) as { count: number }).count,
    ).toBe(0);
    expect(
      (db
        .prepare(`SELECT COUNT(*) AS count FROM chunks WHERE related_entity_id = ?`)
        .get(messageId) as { count: number }).count,
    ).toBe(0);
  });

  it('returns saved source memory as a dedicated context recall card', async () => {
    const saveRes = await app.inject({
      method: 'POST',
      url: '/api/v1/source-memory/capsules',
      payload: {
        sourceKind: 'webpage',
        sourceUrl: 'https://example.com/context-source',
        sourceTitle: 'Context source memory',
        text:
          'Source memory recall should surface a dedicated source memory card when a later AI planning workflow asks for original browser evidence and future triggers.',
        captureMode: 'manual',
        interactions: {
          copiedText: true,
          manualClick: true,
        },
      },
    });
    expect(saveRes.statusCode).toBe(200);
    const capsuleId = saveRes.json().capsule.id;

    const recallRes = await app.inject({
      method: 'POST',
      url: '/api/v1/context-recall',
      payload: {
        surface: 'web_passive',
        contextType: 'webpage',
        title: 'AI planning workflow',
        url: 'https://example.com/current-workflow',
        primaryText:
          'Need original browser evidence and future triggers from source memory recall.',
        sourceTypes: ['source_memory'],
        limit: 3,
      },
    });

    expect(recallRes.statusCode).toBe(200);
    const match = recallRes.json().matches.find(
      (item: { type: string; metadata?: Record<string, unknown> }) =>
        item.type === 'source_memory' &&
        item.metadata?.sourceMemoryCapsuleId === capsuleId,
    );
    expect(match).toBeTruthy();
    expect(match.sourceLabel).toBe('source_memory');
  });

  it('dedupes repeated captures by source fingerprint', async () => {
    const payload = {
      sourceUrl: 'https://example.com/repeat',
      sourceTitle: 'Repeated source',
      selectedText:
        'Repeated source memory capture should not create a second long-term web memory row when the source and selected text are identical.',
      captureMode: 'manual',
      interactions: {
        selectedText: true,
        manualClick: true,
      },
    };

    const first = await app.inject({
      method: 'POST',
      url: '/api/v1/source-memory/capsules',
      payload,
    });
    const second = await app.inject({
      method: 'POST',
      url: '/api/v1/source-memory/capsules',
      payload,
    });

    expect(first.statusCode).toBe(200);
    expect(second.statusCode).toBe(200);
    expect(second.json().capsule.duplicate).toBe(true);
    expect(
      (db
        .prepare(`SELECT COUNT(*) AS count FROM source_memory_capsules`)
        .get() as { count: number }).count,
    ).toBe(1);
    expect(
      (db
        .prepare(`SELECT COUNT(*) AS count FROM messages_raw WHERE source_type = 'web'`)
        .get() as { count: number }).count,
    ).toBe(1);
  });
});
