import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const { generateMock, generateStreamMock } = vi.hoisted(() => ({
  generateMock: vi.fn(),
  generateStreamMock: vi.fn(),
}));

vi.mock('../llm/LLMClient.js', () => ({
  LLMClient: vi.fn().mockImplementation(() => ({
    generate: generateMock,
    generateStream: generateStreamMock,
  })),
  getLLMClient: () => ({
    generate: generateMock,
    generateStream: generateStreamMock,
    generateJSON: generateMock,
  }),
}));

vi.mock('../llm/EmbeddingClient.js', () => ({
  EmbeddingClient: {
    getInstance: vi.fn().mockRejectedValue(new Error('Embedding not available in tests')),
    isLoaded: vi.fn().mockReturnValue(false),
    getModelName: vi.fn().mockReturnValue('mock-model'),
  },
}));

import type { FastifyInstance } from 'fastify';
import type BetterSqlite3 from 'better-sqlite3';

import { buildApp } from '../server.js';
import { getTestDb } from './setup.js';

describe('Ask API', () => {
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
    generateMock.mockReset();
    generateStreamMock.mockReset();
    db.prepare('DELETE FROM messages_raw').run();
    db.prepare('DELETE FROM watched_projects').run();
    db.prepare('DELETE FROM entities').run();
    db.prepare('DELETE FROM memory_metadata').run();

    const currentTime = Math.floor(Date.now() / 1000);
    db.prepare(
      `INSERT INTO messages_raw
        (id, content, source_type, sender, group_name, timestamp, importance, sentiment, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      'ask-john-message',
      'John said the release risks are increasing and we should adjust the timeline.',
      'glip',
      'John',
      'DevOps',
      currentTime - 86400,
      0.92,
      'neutral',
      currentTime - 86400,
    );
  });

  it('returns structuredAnswer and evidence for filtered ask queries', async () => {
    generateMock.mockResolvedValue({
      content: JSON.stringify({
        answer: 'John mentioned that release risk is increasing.',
        timeline: [
          { date: 'yesterday', event: 'John warned that release risk is increasing.' },
        ],
        keyFindings: ['Release risk increased.'],
        insights: ['The team may need to adjust the delivery timeline.'],
        confidence: 0.84,
      }),
    });

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/ask',
      payload: {
        query: '最近三天 John 说过什么？',
        includeEvidence: true,
      },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();

    expect(body.answer).toContain('release risk');
    expect(body.structuredAnswer).toBeDefined();
    expect(body.structuredAnswer.timeline[0].event).toContain('release risk');
    expect(body.structuredAnswer.keyFindings).toEqual(['Release risk increased.']);
    expect(body.evidence).toHaveLength(1);
    expect(body.evidence[0].id).toBe('ask-john-message');
    expect(body.evidence[0].metadata?.sender).toBe('John');
    expect(body.evidence[0].metadata?.groupName).toBe('DevOps');
  });

  it('falls back to plain text when the model does not return JSON', async () => {
    generateMock.mockResolvedValue({
      content: 'I found one relevant memory, but not enough detail for a richer structure.',
    });

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/ask',
      payload: {
        query: '最近三天 John 说过什么？',
      },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();

    expect(body.answer).toContain('I found one relevant memory');
    expect(body.structuredAnswer).toBeUndefined();
  });

  it('streams the main answer before the final structured result', async () => {
    generateStreamMock.mockImplementation(async (_prompt, _options, onDelta) => {
      await onDelta('John mentioned ');
      await onDelta('that release risk is increasing.');
      return {
        content: 'John mentioned that release risk is increasing.',
      };
    });
    generateMock.mockResolvedValue({
      content: JSON.stringify({
        answer: 'John mentioned that release risk is increasing.',
        keyFindings: ['Release risk increased.'],
      }),
    });

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/ask/stream',
      payload: {
        query: '最近三天 John 说过什么？',
        includeEvidence: true,
      },
    });

    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toContain('text/event-stream');
    expect(res.body).toContain('event: start');
    expect(res.body).toContain('event: delta');
    expect(res.body).toContain('event: answer_done');
    expect(res.body).toContain('event: result');
    expect(res.body.indexOf('event: delta')).toBeGreaterThan(res.body.indexOf('event: start'));
    expect(res.body.indexOf('event: answer_done')).toBeGreaterThan(res.body.indexOf('event: delta'));
    expect(res.body.indexOf('event: result')).toBeGreaterThan(res.body.indexOf('event: answer_done'));
    expect(res.body).toContain('Release risk increased.');
  });
});
