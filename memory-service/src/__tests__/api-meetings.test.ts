import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import type BetterSqlite3 from 'better-sqlite3';

import { buildApp } from '../server.js';
import { getTestDb } from './setup.js';

describe('Meetings API', () => {
  let app: FastifyInstance;
  let db: BetterSqlite3.Database;

  beforeAll(async () => {
    db = getTestDb();
    const result = await buildApp({ db });
    app = result.app;
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    db.prepare('DELETE FROM messages_raw').run();
  });

  it('groups meeting records and surfaces metadata-backed fields', async () => {
    db.prepare(
      `INSERT INTO messages_raw
        (id, content, source_type, source_title, group_id, group_name, timestamp, importance, sentiment, metadata_json, created_at)
       VALUES (?, ?, 'meeting', ?, ?, ?, ?, ?, 'neutral', ?, ?)`,
    ).run(
      'meeting-1-msg-1',
      'Kickoff summary',
      'Panorama source title',
      'meeting-1',
      'Planning Review',
      1000,
      0.9,
      JSON.stringify({ participants: ['Alex', 'Esone'], digestId: 'digest-1' }),
      1000,
    );

    db.prepare(
      `INSERT INTO messages_raw
        (id, content, source_type, source_title, group_id, group_name, timestamp, importance, sentiment, metadata_json, created_at)
       VALUES (?, ?, 'meeting', ?, ?, ?, ?, ?, 'neutral', ?, ?)`,
    ).run(
      'meeting-1-msg-2',
      'Digest completed',
      'Panorama source title',
      'meeting-1',
      'Planning Review',
      1100,
      0.95,
      JSON.stringify({
        participants: ['Alex', 'Esone'],
        digestId: 'digest-1',
        pdfUrl: 'https://example.com/meeting-1.pdf',
        summary: '预算与排期都已确认。',
        topicCount: 2,
        actionItemCount: 1,
        decisions: [{ id: 'decision-1', text: '通过预算' }],
      }),
      1100,
    );

    db.prepare(
      `INSERT INTO messages_raw
        (id, content, source_type, source_title, group_id, group_name, timestamp, importance, sentiment, metadata_json, created_at)
       VALUES (?, ?, 'meeting', ?, ?, ?, ?, ?, 'neutral', ?, ?)`,
    ).run(
      'meeting-2-msg-1',
      'Another meeting',
      'Fallback title',
      'meeting-2',
      null,
      900,
      0.8,
      JSON.stringify({ participants: ['Sarah'] }),
      900,
    );

    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/meetings?limit=10&offset=0',
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.total).toBe(2);
    expect(body.items).toHaveLength(2);

    expect(body.items[0]).toEqual({
      meetingId: 'meeting-1',
      title: 'Planning Review',
      date: 1000,
      lastEventAt: 1100,
      participants: ['Alex', 'Esone'],
      pdfUrl: 'https://example.com/meeting-1.pdf',
      digestId: 'digest-1',
      summary: '预算与排期都已确认。',
      topicCount: 2,
      actionItemCount: 1,
      decisionCount: 1,
    });

    expect(body.items[1]).toEqual({
      meetingId: 'meeting-2',
      title: 'Fallback title',
      date: 900,
      lastEventAt: 900,
      participants: ['Sarah'],
    });
  });

  it('returns archived meeting detail from the latest meeting record metadata', async () => {
    db.prepare(
      `INSERT INTO messages_raw
        (id, content, source_type, source_title, group_id, group_name, timestamp, importance, sentiment, metadata_json, created_at)
       VALUES (?, ?, 'meeting', ?, ?, ?, ?, ?, 'neutral', ?, ?)`,
    ).run(
      'meeting-detail-msg',
      'Meeting detail summary fallback',
      'Detail source title',
      'meeting-detail',
      'Design Review',
      2000,
      0.92,
      JSON.stringify({
        participants: ['Esone', 'Sarah'],
        digestId: 'digest-detail',
        pdfUrl: 'https://example.com/detail.pdf',
        summary: '确认了设计方向与下一步行动。',
        latestObservationText: '屏幕显示架构图与 Sprint 甘特图。',
        chapters: [
          { id: 'chapter-1', title: '设计评审', summary: '聚焦技术方案' },
        ],
        actionItems: [
          {
            id: 'action-1',
            title: '输出设计稿',
            owner: 'Esone',
            status: 'pending',
          },
        ],
        decisions: [
          { id: 'decision-1', text: '采用新交互方案', timestamp: '10:32' },
        ],
        timelineEvents: [
          {
            id: 'timeline-1',
            type: 'decision',
            title: '采用新交互方案',
            description: '确认新的 panel 交互方式',
          },
        ],
        participantStances: [
          {
            participant: 'Sarah',
            topic: '交互方案',
            stance: '支持',
            keyQuote: '这个交互更顺滑。',
          },
        ],
      }),
      2000,
    );

    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/meetings/meeting-detail',
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.meetingId).toBe('meeting-detail');
    expect(body.title).toBe('Design Review');
    expect(body.summary).toBe('确认了设计方向与下一步行动。');
    expect(body.latestObservationText).toBe('屏幕显示架构图与 Sprint 甘特图。');
    expect(body.actionItems).toHaveLength(1);
    expect(body.decisions).toHaveLength(1);
    expect(body.timelineEvents).toHaveLength(1);
    expect(body.participantStances).toHaveLength(1);
  });
});
