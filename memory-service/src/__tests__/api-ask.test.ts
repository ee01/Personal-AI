import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const { fetchMock, generateMock, generateStreamMock } = vi.hoisted(() => ({
  fetchMock: vi.fn(),
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
    getInstance: vi
      .fn()
      .mockRejectedValue(new Error('Embedding not available in tests')),
    isLoaded: vi.fn().mockReturnValue(false),
    getModelName: vi.fn().mockReturnValue('mock-model'),
  },
}));

import type { FastifyInstance } from 'fastify';
import type BetterSqlite3 from 'better-sqlite3';

import { UserContextManager } from '../core/UserContextManager.js';
import { RecallEngine } from '../core/RecallEngine.js';
import { buildApp } from '../server.js';
import { getTestDb } from './setup.js';

function parseSseEvents(body: string): Array<Record<string, unknown>> {
  return body
    .split(/\r?\n\r?\n/)
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block) => {
      const lines = block.split(/\r?\n/);
      let event = 'message';
      const dataLines: string[] = [];

      for (const line of lines) {
        if (line.startsWith('event:')) {
          event = line.slice(6).trim() || 'message';
          continue;
        }
        if (line.startsWith('data:')) {
          dataLines.push(line.slice(5).trim());
        }
      }

      const payload = dataLines.join('\n');
      try {
        return JSON.parse(payload) as Record<string, unknown>;
      } catch {
        return { type: event, raw: payload };
      }
    });
}

describe('Ask API', () => {
  let app: FastifyInstance;
  let db: BetterSqlite3.Database;

  beforeAll(async () => {
    db = getTestDb();
    vi.stubGlobal('fetch', fetchMock);
    const result = await buildApp({ db });
    app = result.app;
    await app.ready();
  });

  afterAll(async () => {
    vi.unstubAllGlobals();
    await app.close();
  });

  beforeEach(() => {
    fetchMock.mockReset();
    generateMock.mockReset();
    generateStreamMock.mockReset();
    db.prepare('DELETE FROM messages_raw').run();
    db.prepare('DELETE FROM watched_projects').run();
    db.prepare('DELETE FROM entities').run();
    db.prepare('DELETE FROM memory_metadata').run();

    const currentTime = Math.floor(Date.now() / 1000);
    db.prepare(
      `INSERT INTO messages_raw
        (id, content, source_type, source_url, source_title, sender, group_name, timestamp, importance, sentiment, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      'ask-john-message',
      'John said the release risks are increasing and we should adjust the timeline.',
      'glip',
      'https://memory.example.com/messages/ask-john-message',
      'John release risk note',
      'John',
      'DevOps',
      currentTime - 86400,
      0.92,
      'neutral',
      currentTime - 86400,
    );

    db.prepare(
      `INSERT INTO messages_raw
        (id, content, source_type, source_url, source_title, sender, group_name, timestamp, importance, sentiment, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      'ask-meeting-memory',
      '在 Q2 预算评审会议中，团队决定由 Esone 主导技术评审，并在下周二前提交文档。',
      'meeting',
      'https://memory.example.com/meetings/ask-meeting-memory',
      'Q2 Planning Review — Archived Meeting',
      'meeting-pilot',
      'Q2 Planning Review',
      currentTime - 7200,
      0.95,
      'neutral',
      currentTime - 7200,
    );
  });

  it('returns structuredAnswer and evidence for filtered ask queries', async () => {
    generateMock.mockResolvedValue({
      content: JSON.stringify({
        answer: 'John mentioned that release risk is increasing.',
        timeline: [
          {
            date: 'yesterday',
            event: 'John warned that release risk is increasing.',
          },
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
    expect(body.structuredAnswer.keyFindings).toEqual([
      'Release risk increased.',
    ]);
    expect(body.evidence).toHaveLength(1);
    expect(body.evidence[0].id).toBe('ask-john-message');
    expect(body.evidence[0].sourceUrl).toBe(
      'https://memory.example.com/messages/ask-john-message',
    );
    expect(body.evidence[0].sourceTitle).toBe('John release risk note');
    expect(body.evidence[0].metadata?.sender).toBe('John');
    expect(body.evidence[0].metadata?.groupName).toBe('DevOps');
    expect(body.evidence[0].metadata?.sourceUrl).toBe(
      'https://memory.example.com/messages/ask-john-message',
    );
    expect(body.evidence[0].metadata?.sourceTitle).toBe(
      'John release risk note',
    );
  });

  it('falls back to plain text when the model does not return JSON', async () => {
    generateMock.mockResolvedValue({
      content:
        'I found one relevant memory, but not enough detail for a richer structure.',
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

  it('includes archived meeting records in /ask by default when relevant', async () => {
    db.prepare(`DELETE FROM messages_raw WHERE source_type = 'glip'`).run();
    const recallSpy = vi
      .spyOn(RecallEngine.prototype, 'recall')
      .mockResolvedValueOnce({
        items: [
          {
            id: 'ask-meeting-memory',
            type: 'message',
            content:
              '在 Q2 预算评审会议中，团队决定由 Esone 主导技术评审，并在下周二前提交文档。',
            score: 0.95,
            source: 'meeting',
            sourceUrl: 'https://memory.example.com/meetings/ask-meeting-memory',
            sourceTitle: 'Q2 Planning Review — Archived Meeting',
            timestamp: Math.floor(Date.now() / 1000) - 7200,
            metadata: { sourceType: 'meeting' },
          },
        ],
        totalFound: 1,
        channels: ['fts'],
        queryTimeMs: 1,
      } as any);
    generateMock.mockResolvedValue({
      content: JSON.stringify({
        answer: '会议里确认由 Esone 主导技术评审，并在下周二前提交文档。',
        keyFindings: ['Esone 是技术评审 owner。'],
      }),
    });

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/ask',
      payload: {
        query: 'Meeting Pilot technical review owner in Q2 planning review',
        includeEvidence: true,
      },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.answer).toContain('Esone');
    expect(recallSpy).toHaveBeenCalled();
    expect(recallSpy.mock.calls[0][0].sourceTypes).toBeUndefined();
    expect(recallSpy.mock.calls[0][0].scope).toBe('work');
    expect(body.evidence).toHaveLength(1);
    expect(body.evidence[0].source).toBe('meeting');
    expect(body.evidence[0].id).toBe('ask-meeting-memory');
    expect(body.evidence[0].sourceUrl).toBe(
      'https://memory.example.com/meetings/ask-meeting-memory',
    );
    recallSpy.mockRestore();
  });

  it('propagates explicit ask scope to recall', async () => {
    const recallSpy = vi
      .spyOn(RecallEngine.prototype, 'recall')
      .mockResolvedValueOnce({
        items: [
          {
            id: 'ask-john-message',
            type: 'message',
            content:
              'John said the release risks are increasing and we should adjust the timeline.',
            score: 0.92,
            source: 'glip',
            timestamp: Math.floor(Date.now() / 1000) - 86400,
          },
        ],
        totalFound: 1,
        channels: ['time'],
        queryTimeMs: 1,
      } as any);
    generateMock.mockResolvedValue({
      content: JSON.stringify({
        answer: 'I found both-scope evidence.',
      }),
    });

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/ask',
      payload: {
        query: 'What did John say?',
        includeEvidence: true,
        scope: 'both',
      },
    });

    expect(res.statusCode).toBe(200);
    expect(recallSpy).toHaveBeenCalled();
    expect(recallSpy.mock.calls[0][0].scope).toBe('both');
    recallSpy.mockRestore();
  });

  it('streams the main answer before the final structured result', async () => {
    generateStreamMock.mockImplementation(
      async (_prompt, _options, onDelta) => {
        await onDelta('John mentioned ');
        await onDelta('that release risk is increasing.');
        return {
          content: 'John mentioned that release risk is increasing.',
        };
      },
    );
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
    expect(res.body).toContain('event: status');
    expect(res.body).toContain('event: delta');
    expect(res.body).toContain('event: answer_done');
    expect(res.body).toContain('event: result');
    expect(res.body.indexOf('event: status')).toBeGreaterThan(
      res.body.indexOf('event: start'),
    );
    expect(res.body.indexOf('event: delta')).toBeGreaterThan(
      res.body.indexOf('event: status'),
    );
    expect(res.body.indexOf('event: answer_done')).toBeGreaterThan(
      res.body.indexOf('event: delta'),
    );
    expect(res.body.indexOf('event: result')).toBeGreaterThan(
      res.body.indexOf('event: answer_done'),
    );
    expect(res.body).toContain('Release risk increased.');
  });

  it('merges synchronous OpenClaw evidence into ask responses and returns follow-up action info', async () => {
    generateMock
      .mockResolvedValueOnce({
        resolutionState: 'partial',
        directFindings: ['video 相关安排集中在下周。'],
        resolvedConclusion: 'video 相关安排集中在下周。',
        remainingQuestions: ['需要核实具体日期和城市。'],
        candidateArtifacts: [
          {
            kind: 'link',
            title: "Gary's calendar",
            url: 'https://calendar.example.com/gary',
          },
        ],
        recommendedAction: 'delegate_openclaw',
        actionParams: {
          task: '请核实 Gary 下周与 video 相关的具体行程。',
          mode: 'read',
          targetSystem: 'calendar',
        },
        confidence: 0.91,
        legacyClassification: 'answer',
        summary: 'video 相关安排集中在下周，仍需核实具体日期和城市。',
      })
      .mockResolvedValueOnce({
        content: JSON.stringify({
          answer:
            '根据本地线索和外部日历，video 相关安排集中在下周，其中 4/8-4/11 在杭州。',
          keyFindings: ['video 相关安排集中在下周。', '4/8-4/11 在杭州。'],
          confidence: 0.88,
        }),
      });

    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      text: async () =>
        JSON.stringify({
          output_text: JSON.stringify({
            status: 'success',
            summary: '已核实 Gary 在 4/8-4/11 位于杭州。',
            artifacts: [
              {
                kind: 'external_evidence',
                title: "Gary's calendar",
                content: '4/8-4/11: HZ',
                metadata: {
                  sourceSystem: 'calendar',
                  entityId: 'gary-calendar',
                  verification: 'calendar_lookup',
                  observedFields: ['schedule'],
                  observedAt: '2026-04-01T10:00:00Z',
                },
              },
            ],
          }),
        }),
    });

    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ask-openclaw-'));
    const userContextManager = new UserContextManager(tempDir);
    const configured = await buildApp({ userContextManager });
    await configured.app.ready();

    try {
      const context = userContextManager.getContext('ask-openclaw');
      context.userDataManager.writeFile(
        'config.json',
        JSON.stringify({
          openClawEnabled: true,
          openClawBaseUrl: 'https://openclaw.example.com',
          openClawApiKey: 'test-key',
          openClawTimeoutMs: 5000,
        }),
      );

      const res = await configured.app.inject({
        method: 'POST',
        url: '/api/v1/ask',
        headers: {
          'X-User-Id': 'ask-openclaw',
        },
        payload: {
          query: 'Gary 和 video 相关的安排是什么？',
        },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();

      expect(body.answer).toContain('杭州');
      expect(body.resolutionState).toBe('complete');
      expect(body.externalEvidence).toHaveLength(1);
      expect(body.followUpActions).toHaveLength(1);
      expect(body.followUpActions[0].actionType).toBe('delegate_openclaw');
      expect(body.followUpActions[0].queueStatus).toBe('succeeded');
      expect(fetchMock).toHaveBeenCalledTimes(1);
    } finally {
      await configured.app.close();
      userContextManager.closeAll();
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('streams status updates and planner-enriched results when OpenClaw evidence is needed', async () => {
    generateMock
      .mockResolvedValueOnce({
        resolutionState: 'partial',
        directFindings: ['video 相关安排集中在下周。'],
        resolvedConclusion: 'video 相关安排集中在下周。',
        remainingQuestions: ['需要核实具体日期和城市。'],
        candidateArtifacts: [
          {
            kind: 'link',
            title: "Gary's calendar",
            url: 'https://calendar.example.com/gary',
          },
        ],
        recommendedAction: 'delegate_openclaw',
        actionParams: {
          task: '请核实 Gary 下周与 video 相关的具体行程。',
          mode: 'read',
          targetSystem: 'calendar',
        },
        confidence: 0.93,
        legacyClassification: 'answer',
        summary: 'video 相关安排集中在下周，仍需核实具体日期和城市。',
      })
      .mockResolvedValueOnce({
        content: JSON.stringify({
          answer: 'video 相关安排集中在下周，其中 4/8-4/11 在杭州。',
          keyFindings: ['video 相关安排集中在下周。', '4/8-4/11 在杭州。'],
          confidence: 0.9,
        }),
      });

    generateStreamMock.mockImplementation(
      async (_prompt, _options, onDelta) => {
        await onDelta('video 相关安排集中在下周，');
        await onDelta('其中 4/8-4/11 在杭州。');
        return {
          content: 'video 相关安排集中在下周，其中 4/8-4/11 在杭州。',
        };
      },
    );

    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      text: async () =>
        JSON.stringify({
          output_text: JSON.stringify({
            status: 'success',
            summary: '已核实 Gary 在 4/8-4/11 位于杭州。',
            artifacts: [
              {
                kind: 'external_evidence',
                title: "Gary's calendar",
                content: '4/8-4/11: HZ',
                metadata: {
                  sourceSystem: 'calendar',
                  entityId: 'gary-calendar',
                  verification: 'calendar_lookup',
                  observedFields: ['schedule'],
                  observedAt: '2026-04-01T10:00:00Z',
                },
              },
            ],
          }),
        }),
    });

    const tempDir = fs.mkdtempSync(
      path.join(os.tmpdir(), 'ask-stream-openclaw-'),
    );
    const userContextManager = new UserContextManager(tempDir);
    const configured = await buildApp({ userContextManager });
    await configured.app.ready();

    try {
      const context = userContextManager.getContext('ask-stream-openclaw');
      context.userDataManager.writeFile(
        'config.json',
        JSON.stringify({
          openClawEnabled: true,
          openClawBaseUrl: 'https://openclaw.example.com',
          openClawApiKey: 'test-key',
          openClawTimeoutMs: 5000,
        }),
      );

      const res = await configured.app.inject({
        method: 'POST',
        url: '/api/v1/ask/stream',
        headers: {
          'X-User-Id': 'ask-stream-openclaw',
        },
        payload: {
          query: 'Gary 和 video 相关的安排是什么？',
        },
      });

      expect(res.statusCode).toBe(200);
      const events = parseSseEvents(res.body);
      const statusMessages = events
        .filter((event) => event.type === 'status')
        .map((event) => String(event.message ?? ''));
      const resultEvent = events.find((event) => event.type === 'result');

      expect(
        statusMessages.some((message) => message.includes('正在调用外部工具')),
      ).toBe(true);
      expect(resultEvent).toBeDefined();
      expect(resultEvent?.answer).toContain('杭州');
      expect(resultEvent?.resolutionState).toBe('complete');
      expect(Array.isArray(resultEvent?.externalEvidence)).toBe(true);
      expect((resultEvent?.externalEvidence as unknown[])?.length).toBe(1);
      expect(Array.isArray(resultEvent?.followUpActions)).toBe(true);
      expect(
        (resultEvent?.followUpActions as Array<Record<string, unknown>>)[0]
          ?.actionType,
      ).toBe('delegate_openclaw');
    } finally {
      await configured.app.close();
      userContextManager.closeAll();
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });
});
