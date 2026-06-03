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
    db.prepare('DELETE FROM memory_metadata').run();
    db.prepare('DELETE FROM chunks').run();
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
    expect(body.ingestResults[0].decision).toMatchObject({
      storage: 'indexed',
      reason: 'salience_indexed',
      extractionStatus: 'skipped',
      shouldIndex: true,
      indexed: true,
    });

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
    expect(metadata.indexExtractedArtifact).toBe(true);

    const indexedChunk = db
      .prepare(
        `SELECT COUNT(*) AS count
         FROM chunks
         WHERE related_entity_id = ?`,
      )
      .get(body.ingestResults[0].id) as { count: number };
    expect(indexedChunk.count).toBeGreaterThan(0);

    const indexedMetadata = db
      .prepare(
        `SELECT salience_score
         FROM memory_metadata
         WHERE target_type = 'message' AND target_id = ?`,
      )
      .get(body.ingestResults[0].id) as { salience_score: number };
    expect(indexedMetadata.salience_score).toBeGreaterThanOrEqual(0.3);
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

  it('extracts compact agent-session artifacts with normalized source type', async () => {
    generateJSONMock.mockResolvedValue({
      scope: 'work',
      scope_confidence: 0.9,
      artifacts: [
        {
          kind: 'result',
          text: 'Codex fixed the Composer Guard repo bug and ran the composer assist tests.',
          source_quote:
            'Codex changed ContextAssistService and ran composer assist tests.',
          conversation_ref: 'agent-2',
        },
      ],
      outcome_signals: [
        {
          tool_key: 'codex_cli',
          task_kind: 'repo_bugfix',
          outcome: 'produced_artifact',
          produced_artifact: true,
          verification_signal: 'tests passed',
          note: 'Patch produced and tested.',
        },
      ],
    });

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/extractor/from-chat',
      payload: {
        source: 'codex_cli',
        sourceType: 'codex_cli',
        extractMode: 'agent_session',
        scope: 'work',
        autoClassify: false,
        conversationMeta: {
          toolKey: 'codex_cli',
          sessionId: 'session-1',
          projectPath: '/repo/personal-ai',
        },
        segments: [
          {
            id: 'agent-1',
            speaker: 'user',
            text: 'Please fix the Composer Guard repo bug.\n```ts\nconst secret = "large code";\n```',
          },
          {
            id: 'agent-2',
            speaker: 'assistant',
            text: 'Codex changed ContextAssistService and ran composer assist tests.\ndiff --git a/file b/file\n+ lots of code',
          },
        ],
      },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.scopeUsed).toBe('work');
    expect(body.outcomeSignals[0].tool_key).toBe('codex_cli');

    const prompt = generateJSONMock.mock.calls[0]?.[0] as string;
    expect(prompt).toContain('coding-agent session');
    expect(prompt).toContain('[code omitted]');
    expect(prompt).not.toContain('const secret');
    expect(prompt).not.toContain('diff --git');

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
    expect(stored.source).toBe('codex_cli');
    expect(stored.source_type).toBe('codex_cli');
    expect(metadata.extractMode).toBe('agent_session');
    expect(metadata.conversationMeta.toolKey).toBe('codex_cli');
    expect(metadata.toolFitSignals[0].task_kind).toBe('repo_bugfix');
  });

  it('rejects extractor source types outside the ingest allowlist', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/extractor/from-chat',
      payload: {
        source: 'unknown-sync',
        sourceType: 'made_up_source',
        scope: 'work',
        segments: [{ text: 'Remember this invalid source type test.' }],
      },
    });

    expect(res.statusCode).toBe(400);
  });
});
