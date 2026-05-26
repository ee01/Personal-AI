import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

const llmGenerateMock = vi.hoisted(() => vi.fn());

vi.mock('../llm/EmbeddingClient.js', () => ({
  EmbeddingClient: {
    getInstance: vi
      .fn()
      .mockRejectedValue(new Error('Embedding not available in tests')),
    isLoaded: vi.fn().mockReturnValue(false),
    getModelName: vi.fn().mockReturnValue('mock-model'),
  },
}));

vi.mock('../llm/LLMClient.js', () => ({
  LLMClient: vi.fn().mockImplementation(() => ({
    generate: llmGenerateMock,
    generateJSON: vi.fn(),
    generateStream: vi.fn(),
  })),
  getLLMClient: () => ({
    generate: llmGenerateMock,
  }),
}));

import type { FastifyInstance } from 'fastify';
import type BetterSqlite3 from 'better-sqlite3';

import { buildApp } from '../server.js';
import { getTestDb } from './setup.js';

describe('Composer Assist API (POST /composer/assist)', () => {
  let app: FastifyInstance;
  let db: BetterSqlite3.Database;

  beforeAll(async () => {
    db = getTestDb();
    const result = await buildApp({ db });
    app = result.app;
    await app.ready();
  });

  afterAll(async () => {
    if (app) await app.close();
  });

  beforeEach(() => {
    llmGenerateMock.mockReset();
    llmGenerateMock.mockResolvedValue({
      content:
        'Factory AI 试用已经过了 security approval，但 production 场景还是要用 RingCentral email login。',
    });

    db.prepare('DELETE FROM messages_raw').run();
    db.prepare('DELETE FROM chunks').run();
    db.prepare('DELETE FROM rehearsal_activations').run();
    db.prepare('DELETE FROM rehearsals').run();
    db.prepare('DELETE FROM user_profile_items').run();
    db.prepare('DELETE FROM watched_projects').run();
    db.prepare(`INSERT INTO chunks_fts(chunks_fts) VALUES ('delete-all')`).run();

    const now = Math.floor(Date.now() / 1000);
    insertChunk({
      id: 9201,
      content:
        'Factory AI free trial passed security approval, but production usage must use RingCentral email login.',
      sourceType: 'glip',
      source: 'glip',
      scope: 'work',
      createdAt: now - 60,
    });
    insertChunk({
      id: 9202,
      content:
        'Cross AI handoff should inject a concise Personal AI context pack into the current ChatGPT prompt.',
      sourceType: 'ai_chat',
      source: 'chatgpt',
      scope: 'work',
      createdAt: now - 30,
    });
    insertChunk({
      id: 9203,
      content:
        'Doubao conversation memory says do not auto-send prompts when transferring context to another AI platform.',
      sourceType: 'doubao',
      source: 'doubao',
      scope: 'work',
      createdAt: now - 20,
    });
  });

  function insertChunk(args: {
    id: number;
    content: string;
    sourceType: string;
    source: string;
    scope: string;
    createdAt: number;
  }): void {
    db.prepare(
      `INSERT INTO chunks
        (chunk_id, file_path, line_start, line_end, content, content_hash, scope, source, source_type, related_project, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      args.id,
      `messages/${args.id}`,
      1,
      1,
      args.content,
      `hash-${args.id}`,
      args.scope,
      args.source,
      args.sourceType,
      'Personal AI',
      args.createdAt,
    );
    db.prepare(`INSERT INTO chunks_fts(rowid, content) VALUES (?, ?)`).run(
      args.id,
      args.content,
    );
  }

  it('rejects unknown surfaces', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/composer/assist',
      payload: {
        surface: 'unknown_surface',
        contextType: 'web_agent_prompt',
      },
    });

    expect(res.statusCode).toBe(400);
  });

  it('returns a preview-required AI context pack for web agent prompts', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/composer/assist',
      payload: {
        surface: 'chatgpt',
        contextType: 'web_agent_prompt',
        title: 'ChatGPT',
        draftText: 'Help me design cross AI prompt injection for Personal AI',
        primaryText: 'current prompt is about cross AI handoff context pack',
        identifiers: { provider: 'chatgpt' },
        sourceTypes: ['ai_chat', 'doubao'],
      },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.available).toBe(true);
    expect(body.suggestionType).toBe('context_pack');
    expect(body.previewRequired).toBe(true);
    expect(body.riskLevel).toBe('medium');
    expect(body.insertText).not.toContain('Personal AI context pack (review before sending)');
    expect(body.insertText).not.toContain('Please review and edit before sending');
    expect(body.insertText).toContain('请结合下面上下文回答');
    expect(body.insertText).toContain('不要直接暴露不必要的私人细节');
    expect(body.evidence.length).toBeGreaterThan(0);
  });

  it('uses Web AI draft text as the context-enrichment recall signal', async () => {
    const now = Math.floor(Date.now() / 1000);
    db.prepare(
      `INSERT INTO watched_projects
        (id, name, aliases_json, is_active, priority, created_at)
       VALUES (?, ?, ?, 1, 8, ?)`,
    ).run(
      'project-ai-vbg',
      'RCV Working Team: Modernize Existing Backgrounds and Add AI-Generated VBGs',
      JSON.stringify(['AI VBG', 'VBG', 'AI Generated Background']),
      now,
    );
    insertChunk({
      id: 9211,
      content:
        'AI-Generated VBG backend status: RCV-148412 is ready for review, while FE follow-up is still separate.',
      sourceType: 'glip',
      source: 'glip',
      scope: 'work',
      createdAt: now - 15,
    });

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/composer/assist',
      payload: {
        surface: 'chatgpt',
        contextType: 'web_agent_prompt',
        title: 'ChatGPT',
        primaryText: 'New blank AI chat',
        draftText: 'AI VBG 的 BE 部分完成情况如何',
        identifiers: { provider: 'chatgpt' },
        sourceTypes: ['glip', 'jira', 'manual'],
        debug: true,
      },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.available).toBe(true);
    expect(body.suggestionType).toBe('context_pack');
    expect(body.insertText).toContain('目标：AI VBG 的 BE 部分完成情况如何');
    expect(body.insertText).toContain('仍需确认');
    expect(body.evidence.map((item: any) => item.snippet).join('\n')).toContain(
      'RCV-148412',
    );
    expect(body.debug.recallRequest.primaryText).toContain(
      'Draft prompt: AI VBG 的 BE 部分完成情况如何',
    );
    expect(
      body.debug.recall.contextExpansion.expandedQuery,
    ).toContain('AI-Generated VBGs');
    expect(body.debug.recall.contextExpansion.expandedQuery).toContain('backend');
  });

  it('returns reply context for RingCentral threads and includes thread root', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/composer/assist',
      payload: {
        surface: 'ringcentral_thread',
        contextType: 'message_thread',
        title: 'AI tools selection',
        draftText: 'Factory AI trial status?',
        primaryText: 'Discussing Factory AI free trial security approval',
        identifiers: {
          conversationId: '1280503250946',
          groupId: '1280503250946',
          threadRootPostId: 'post-1',
        },
        threadRoot: {
          id: 'post-1',
          sender: 'Alice',
          text: 'Can we use Factory AI for production project?',
        },
      },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.available).toBe(true);
    expect(body.suggestionType).toBe('reply_context');
    expect(body.insertText).not.toContain('Personal AI context to consider');
    expect(body.insertText).not.toContain('Please review and edit before sending');
    expect(body.insertText).not.toContain('我理解当前是在讨论');
    expect(body.insertText).not.toContain('我这边先补充几个相关点');
    expect(body.insertText).toContain('Factory AI');
    expect(llmGenerateMock).toHaveBeenCalledTimes(1);
  });

  it('keeps scene-cue rehearsal reminders for RingCentral composer assist', async () => {
    const created = (
      await app.inject({
        method: 'POST',
        url: '/api/v1/rehearsals',
        payload: {
          title: 'Next Colin Liu check-in',
          scenarioType: 'person_chat',
          content:
            'Ask Colin whether the review reminder should name a concrete owner.',
          summary: 'Ask Colin to confirm the review owner.',
          activationCues: {
            people: ['Colin Liu'],
            groupIds: ['colin-group'],
          },
          confidence: 0.92,
          priority: 9,
        },
      })
    ).json().rehearsal;

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/composer/assist',
      payload: {
        surface: 'ringcentral_message',
        contextType: 'message_thread',
        title: 'Chat with Colin Liu',
        primaryText: 'Could you reply?',
        identifiers: {
          conversationId: 'colin-group',
          groupId: 'colin-group',
        },
        audience: {
          conversationTitle: 'Colin Liu',
          conversationId: 'colin-group',
          groupId: 'colin-group',
          people: ['Colin Liu'],
        },
        visibleMessages: [
          {
            sender: 'Colin Liu',
            text: 'Could you reply?',
          },
        ],
        sourceTypes: ['rehearsal'],
        debug: true,
      },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.available).toBe(true);
    expect(body.summary).toContain('预演提醒');
    expect(body.evidence).toHaveLength(1);
    expect(body.evidence[0].id).toBe(created.id);
    expect(body.evidence[0].type).toBe('rehearsal');
    expect(body.evidence[0].evidenceRole).toBe('rehearsal_cue');
    expect(body.evidence[0].reasonType).toBe('prospective_cue');
    expect(body.evidence[0].whyRelevant).toEqual(
      expect.arrayContaining(['人物：Colin Liu', '同群聊']),
    );
    expect(llmGenerateMock).toHaveBeenCalledTimes(1);
    expect(llmGenerateMock.mock.calls[0][0]).toContain('预演提醒');
  });

  it('filters weak composer memories that do not match the current scene', async () => {
    db.prepare('DELETE FROM messages_raw').run();
    db.prepare('DELETE FROM chunks').run();
    db.prepare(`INSERT INTO chunks_fts(chunks_fts) VALUES ('delete-all')`).run();
    const now = Math.floor(Date.now() / 1000);
    insertChunk({
      id: 9301,
      content:
        'Tue Mar 31 — Flight: SFO → HKG · Cathay Pacific CX873 · 12:20 AM–6:15 AM (+1)',
      sourceType: 'calendar',
      source: 'calendar',
      scope: 'work',
      createdAt: now - 60,
    });
    insertChunk({
      id: 9302,
      content:
        'Everyone AI 主题分享 | RingClaw：在 RingCentral 内直接对话多智能体 AI',
      sourceType: 'glip',
      source: 'glip',
      scope: 'work',
      createdAt: now - 50,
    });
    insertChunk({
      id: 9303,
      content:
        '五一假期即将来临，根据国家法定节假日规定并结合公司实际情况，现将2026年劳动节放假安排通知如下：',
      sourceType: 'web',
      source: 'web',
      scope: 'work',
      createdAt: now - 40,
    });

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/composer/assist',
      payload: {
        surface: 'ringcentral_message',
        contextType: 'message_thread',
        title: 'RingCentral AI reply',
        primaryText: 'Can you reply with the owner and next action?',
        visibleMessages: [
          {
            sender: 'Alice',
            text: 'Can you reply with the owner and next action?',
          },
        ],
      },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.available).toBe(false);
    expect(body.suggestionType).toBe('none');
    expect(body.insertText).toBeUndefined();
  });

  it('returns an empty result when no memory is relevant', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/composer/assist',
      payload: {
        surface: 'jira_issue',
        contextType: 'jira_issue',
        title: 'VIDEONONEXISTENT-1',
        primaryText: 'unrelated basalt kitchen cabinet hardware',
      },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.available).toBe(false);
    expect(body.suggestionType).toBe('none');
    expect(body.evidence).toEqual([]);
  });

  it('does not use draft text as the recall query signal', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/composer/assist',
      payload: {
        surface: 'ringcentral_message',
        contextType: 'message_thread',
        title: 'Unrelated chat',
        draftText: 'Factory AI free trial security approval',
        primaryText: 'basalt kitchen cabinet hardware',
      },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.available).toBe(false);
    expect(body.suggestionType).toBe('none');
  });
});
