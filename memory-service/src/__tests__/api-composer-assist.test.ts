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
    db.prepare('DELETE FROM source_memory_events').run();
    db.prepare('DELETE FROM source_memory_links').run();
    db.prepare('DELETE FROM source_memory_triggers').run();
    db.prepare('DELETE FROM source_memory_takeaways').run();
    db.prepare('DELETE FROM source_memory_anchors').run();
    db.prepare('DELETE FROM source_memory_capsules').run();
    db.prepare('DELETE FROM rehearsal_activations').run();
    db.prepare('DELETE FROM rehearsals').run();
    db.prepare('DELETE FROM user_writing_style_memories').run();
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

  it('adds task framing and target-tool fit for compose-to-AI prompts', async () => {
    const now = Math.floor(Date.now() / 1000);
    insertChunk({
      id: 9221,
      content:
        'Codex CLI session result: user asked to fix the Personal AI Composer Guard repo bug, Codex changed ContextAssistService and ran composer-assist tests.',
      sourceType: 'codex_cli',
      source: 'codex_cli',
      scope: 'work',
      createdAt: now - 10,
    });

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/composer/assist',
      payload: {
        surface: 'chatgpt',
        contextType: 'web_agent_prompt',
        scenario: 'compose_to_ai',
        title: 'ChatGPT',
        draftText:
          'Help me fix the repo bug in Personal AI Composer Guard and run tests',
        primaryText: 'Current AI chat is about a repo bug fix',
        identifiers: { provider: 'chatgpt' },
        sourceTypes: ['codex_cli', 'chatgpt', 'doubao_chat'],
        debug: true,
      },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.available).toBe(true);
    expect(body.insertText).toContain('任务判断');
    expect(body.insertText).toContain('目标工具适配');
    expect(body.insertText).toContain('更适合的备选：codex_cli');
    expect(body.debug.taskFrame.kind).toBe('repo_bugfix');
    expect(body.debug.targetToolFit.betterTool).toBe('codex_cli');
    expect(body.debug.sourceMix.codex_cli).toBeGreaterThan(0);
  });

  it('keeps Jira status prompts source-aware when composing to another AI', async () => {
    const now = Math.floor(Date.now() / 1000);
    insertChunk({
      id: 9222,
      content:
        'Jira RCV-148412 status: backend is ready for review, FE owner is still tracking blockers, and release timing must be verified in Jira.',
      sourceType: 'jira',
      source: 'jira',
      scope: 'work',
      createdAt: now - 10,
    });

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/composer/assist',
      payload: {
        surface: 'chatgpt',
        contextType: 'web_agent_prompt',
        scenario: 'compose_to_ai',
        title: 'ChatGPT',
        draftText:
          'Summarize RCV-148412 status and current blockers before I reply',
        primaryText: 'Current AI chat is about Jira project status',
        identifiers: { provider: 'chatgpt' },
        sourceTypes: ['jira', 'chatgpt'],
        debug: true,
      },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.available).toBe(true);
    expect(body.insertText).toContain('任务判断');
    expect(body.insertText).toContain('Jira/项目上下文');
    expect(body.insertText).toContain('更适合的备选：jira_or_project_dashboard');
    expect(body.debug.taskFrame.kind).toBe('jira_data_analysis');
    expect(body.debug.targetToolFit.betterTool).toBe(
      'jira_or_project_dashboard',
    );
    expect(body.debug.recallRequest.sourceTypes).toContain('jira');
    expect(body.debug.recallRequest.sourceTypes).not.toContain('chatgpt');
  });

  it('allows saved source-memory capsules in compose-to-AI context packs', async () => {
    const saveRes = await app.inject({
      method: 'POST',
      url: '/api/v1/source-memory/capsules',
      payload: {
        sourceKind: 'webpage',
        sourceUrl: 'https://example.com/artifact-lineage',
        sourceTitle: 'Artifact lineage checklist',
        text: 'Artifact lineage checklist source memory: preserve browser evidence, original source URL, and generated artifact revisions before asking another AI to continue the workflow.',
        captureMode: 'manual',
        interactions: {
          copiedText: true,
          manualClick: true,
        },
      },
    });
    expect(saveRes.statusCode).toBe(200);
    const capsuleId = saveRes.json().capsule.id;

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/composer/assist',
      payload: {
        surface: 'chatgpt',
        contextType: 'web_agent_prompt',
        scenario: 'compose_to_ai',
        title: 'ChatGPT',
        draftText:
          'Use the artifact lineage checklist before this workflow continues',
        primaryText: 'Current AI prompt is about artifact lineage handoff',
        identifiers: { provider: 'chatgpt' },
        sourceTypes: ['source_memory', 'chatgpt'],
        debug: true,
      },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.available).toBe(true);
    expect(body.insertText).toContain('Artifact lineage checklist');
    expect(
      body.evidence.some(
        (item: any) =>
          item.type === 'source_memory' &&
          item.metadata?.sourceMemoryCapsuleId === capsuleId,
      ),
    ).toBe(true);
    expect(body.debug.recallRequest.sourceTypes).toContain('source_memory');
    expect(body.debug.recallRequest.sourceTypes).not.toContain('chatgpt');
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
    expect(body.previewRequired).toBe(true);
    expect(body.riskLevel).toBe('low');
    expect(llmGenerateMock).toHaveBeenCalledTimes(1);
    expect(llmGenerateMock.mock.calls[0][0]).toContain('预演提醒');
  });

  it('uses transferable writing style memory for peer RingCentral replies', async () => {
    const now = Math.floor(Date.now() / 1000);
    db.prepare(
      `INSERT INTO user_profile_items
        (id, item_type, item_key, item_value, evidence_refs, source_kind,
         confidence, user_confirmed, status, salience_score, mention_count,
         last_seen, valid_from, valid_to, created_at, updated_at, fingerprint)
       VALUES (?, 'preference', ?, ?, ?, 'system', 0.84, 1, 'active', 0.84, 3,
               ?, null, null, ?, ?, ?)`,
    ).run(
      'profile-writing-style-peer-zh',
      'writing_style.ringcentral.peer.casual_reply.zh',
      '中文 RingCentral peer 同事轻松回复：可采用：可以用“哈哈”和轻微“~”。避免：不要写“我最喜欢聊了”、泛泛未来承诺或“咱们一起捣鼓下”这类 AI 式热情套话。',
      JSON.stringify([{ traceId: 'ambient-style-peer-1' }]),
      now,
      now,
      now,
      'fingerprint-writing-style-peer-zh',
    );
    insertChunk({
      id: 9240,
      content:
        'Esther 下午要单独找 Esone 请教 Jira PAT token 怎么用；PAT setup 在 Jira personal access token 页面创建 token。',
      sourceType: 'glip',
      source: 'glip',
      scope: 'work',
      createdAt: now - 5,
    });
    llmGenerateMock.mockImplementation(async (prompt: string) => {
      expect(prompt).toContain(
        'writing_style.ringcentral.peer.casual_reply.zh',
      );
      expect(prompt).toContain('我最喜欢聊了');
      expect(prompt).toContain('咱们一起捣鼓下');
      return {
        content: '哈哈可以，下午你直接找我，我给你过一下 PAT 怎么用~',
      };
    });

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/composer/assist',
      payload: {
        surface: 'ringcentral_message',
        contextType: 'message_thread',
        title: 'Chat with Esther',
        primaryText:
          'Esther 问下午能不能单独找个时间请教 Jira PAT token 怎么用。',
        identifiers: {
          conversationId: 'esther-dm',
          groupId: 'esther-dm',
        },
        audience: {
          conversationTitle: 'Esther (Xiying) Pan',
          conversationId: 'esther-dm',
          groupId: 'esther-dm',
          people: ['Esther (Xiying) Pan'],
          relationshipHint: 'peer colleague',
        },
        visibleMessages: [
          {
            sender: 'Esther (Xiying) Pan',
            text: '下午单独找个时间跟你请教，哈哈哈',
          },
        ],
        debug: true,
      },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.available).toBe(true);
    expect(body.insertText).toBe(
      '哈哈可以，下午你直接找我，我给你过一下 PAT 怎么用~',
    );
    expect(body.insertText).not.toContain('我最喜欢聊了');
    expect(body.insertText).not.toContain('咱们一起捣鼓下');
    expect(body.debug.personalization.confirmedStyleHintKeys).toContain(
      'writing_style.ringcentral.peer.casual_reply.zh',
    );
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
