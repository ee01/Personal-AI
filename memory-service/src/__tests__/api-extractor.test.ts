import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

const { generateJSONMock } = vi.hoisted(() => ({
  generateJSONMock: vi.fn(),
}));

vi.mock('../llm/LLMClient.js', () => ({
  getLLMClient: () => ({
    generateJSON: generateJSONMock,
  }),
  LLMClient: vi.fn(),
}));

vi.mock('../llm/EmbeddingClient.js', () => ({
  EmbeddingClient: {
    getInstance: vi
      .fn()
      .mockRejectedValue(new Error('Embedding not available in tests')),
    isLoaded: vi.fn().mockReturnValue(false),
    getModelName: vi.fn().mockReturnValue('mock-model'),
  },
}));

import type { FastifyInstance } from 'fastify';
import type BetterSqlite3 from 'better-sqlite3';

import { buildApp } from '../server.js';
import { getTestDb } from './setup.js';

describe('Extractor API', () => {
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
    generateJSONMock.mockReset();
    db.prepare('DELETE FROM messages_vec').run();
    db.prepare('DELETE FROM messages_raw').run();
  });

  it('extracts artifacts from chat, cleans obvious noise, and stores them through the ingest pipeline', async () => {
    generateJSONMock.mockResolvedValue({
      scope: 'personal',
      scope_confidence: 0.99,
      artifacts: [
        {
          kind: 'decision',
          text: 'Only save release decisions from this chat to long-term memory.',
          source_quote:
            'Please remember only release decisions from this thread.',
          conversation_ref: 'segment-2',
        },
      ],
    });

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/extractor/from-chat',
      payload: {
        source: 'chat-sync',
        scope: 'work',
        autoClassify: false,
        segments: [
          { text: 'Sent from my iPhone' },
          {
            text: 'Please remember only release decisions from this thread.',
          },
          {
            id: 'segment-3',
            speaker: 'Esone',
            timestamp: 1_710_000_123,
            text: 'The Q2 launch decision is final and should be retained.',
          },
        ],
      },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.scopeUsed).toBe('work');
    expect(body.artifacts).toEqual([
      {
        kind: 'decision',
        text: 'Only save release decisions from this chat to long-term memory.',
        source_quote:
          'Please remember only release decisions from this thread.',
        conversation_ref: 'segment-2',
      },
    ]);
    expect(body.ingestResults).toHaveLength(1);
    expect(body.ingestResults[0].status).toBe('created');

    const prompt = generateJSONMock.mock.calls[0]?.[0] as string;
    expect(prompt).toContain('segment-2');
    expect(prompt).not.toContain('Sent from my iPhone');

    const stored = db
      .prepare(
        `SELECT scope, source, source_type, content, metadata_json
         FROM messages_raw
         WHERE id = ?`,
      )
      .get(body.ingestResults[0].id) as {
      scope: string;
      source: string | null;
      source_type: string;
      content: string;
      metadata_json: string | null;
    };

    const metadata = JSON.parse(stored.metadata_json ?? '{}');
    expect(stored.scope).toBe('work');
    expect(stored.source).toBe('chat-sync');
    expect(stored.source_type).toBe('system');
    expect(stored.content).toBe(
      'Only save release decisions from this chat to long-term memory.',
    );
    expect(metadata.kind).toBe('decision');
    expect(metadata.sourceQuote).toBe(
      'Please remember only release decisions from this thread.',
    );
    expect(metadata.conversationRef).toBe('segment-2');
    expect(metadata.extractor).toBe('from-chat');
  });

  it('falls back to the provided scope when auto classification confidence is low', async () => {
    generateJSONMock.mockResolvedValue({
      scope: 'work',
      scope_confidence: 0.41,
      artifacts: [
        {
          kind: 'preference',
          text: 'The user prefers weekend trip ideas over weekday plans.',
          source_quote: 'I only want weekend trip ideas, not weekday plans.',
          conversation_ref: 'chat-1',
        },
      ],
    });

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/extractor/from-chat',
      payload: {
        source: 'doubao-sync',
        scope: 'personal',
        autoClassify: true,
        segments: [
          {
            id: 'chat-1',
            text: 'I only want weekend trip ideas, not weekday plans.',
          },
        ],
      },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.scopeUsed).toBe('personal');
    expect(body.ingestResults).toHaveLength(1);

    const stored = db
      .prepare(
        'SELECT scope, source, source_type FROM messages_raw WHERE id = ?',
      )
      .get(body.ingestResults[0].id) as {
      scope: string;
      source: string | null;
      source_type: string;
    };

    expect(stored.scope).toBe('personal');
    expect(stored.source).toBe('doubao-sync');
    expect(stored.source_type).toBe('system');
  });
});
