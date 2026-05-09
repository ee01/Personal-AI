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

describe('Composer Assist evals', () => {
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
        '可以，我觉得可以按 Codex computer use + skill backend 这个方向分享，重点讲怎么一键安装和复用。',
    });

    db.prepare('DELETE FROM messages_raw').run();
    db.prepare('DELETE FROM chunks').run();
    db.prepare('DELETE FROM user_profile_items').run();
    db.prepare(`INSERT INTO chunks_fts(chunks_fts) VALUES ('delete-all')`).run();
  });

  function insertChunk(args: {
    id: number;
    content: string;
    sourceType: string;
    source?: string;
    scope?: string;
  }): void {
    const now = Math.floor(Date.now() / 1000);
    db.prepare(
      `INSERT INTO chunks
        (chunk_id, file_path, line_start, line_end, content, content_hash, scope, source, source_type, related_project, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      args.id,
      `eval/${args.id}`,
      1,
      1,
      args.content,
      `eval-hash-${args.id}`,
      args.scope || 'work',
      args.source || args.sourceType,
      args.sourceType,
      'Personal AI',
      now - args.id,
    );
    db.prepare(`INSERT INTO chunks_fts(rowid, content) VALUES (?, ?)`).run(
      args.id,
      args.content,
    );
  }

  function insertProfileItem(args: {
    id: string;
    itemType: string;
    itemKey: string;
    itemValue: string;
    confirmed: boolean;
    status?: string;
    salience?: number;
  }): void {
    const now = Math.floor(Date.now() / 1000);
    db.prepare(
      `INSERT INTO user_profile_items
        (id, item_type, item_key, item_value, evidence_refs, source_kind,
         confidence, user_confirmed, status, salience_score, mention_count,
         last_seen, created_at, updated_at, fingerprint)
       VALUES (?, ?, ?, ?, NULL, ?, 0.86, ?, ?, ?, 1, ?, ?, ?, ?)`,
    ).run(
      args.id,
      args.itemType,
      args.itemKey,
      args.itemValue,
      args.confirmed ? 'explicit' : 'inferred',
      args.confirmed ? 1 : 0,
      args.status || (args.confirmed ? 'active' : 'pending_confirm'),
      args.salience ?? 0.8,
      now,
      now,
      now,
      `${args.itemKey}:${args.itemValue}`.toLowerCase(),
    );
  }

  it('keeps RingCentral dev-group suggestions on-topic and rejects travel/meeting noise', async () => {
    insertChunk({
      id: 101,
      content:
        'Codex computer use can be packaged as a reusable skill backed by backend code, with one-click install and team sharing.',
      sourceType: 'glip',
    });
    insertChunk({
      id: 102,
      content:
        'Tue Mar 31 — Flight: SFO → HKG · Cathay Pacific CX873 · 12:20 AM–6:15 AM (+1)',
      sourceType: 'calendar',
    });
    insertChunk({
      id: 103,
      content: "Meeting title: Esone Qiu's video meeting",
      sourceType: 'meeting',
    });

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/composer/assist',
      payload: {
        surface: 'ringcentral_message',
        contextType: 'message_thread',
        scenario: 'instant_message_reply',
        title: 'RingCentral group 35165069318',
        audience: {
          conversationTitle: 'AI 小群',
          conversationId: '35165069318',
          groupId: '35165069318',
          people: ['Esone Qiu', 'Fred Gu', 'Ryan Chen'],
        },
        contextItems: [
          {
            type: 'message',
            sender: 'Esone Qiu',
            text: 'codex 里的 computer use，很有意思。可以去玩一下',
          },
          {
            type: 'message',
            sender: 'Fred Gu',
            text: '那些所谓的 skill 实现方式千奇百怪，很多都是有后端代码支持的，主打可重用、经济实惠、高效。',
          },
          {
            type: 'message',
            sender: 'Ryan Chen',
            text: 'ideally，让大家无脑使用，一键安装，一键配置，一键调用。',
          },
        ],
      },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.available).toBe(true);
    expect(body.insertText).not.toContain('我理解当前是在讨论');
    expect(body.insertText).not.toContain('我这边先补充几个相关点');
    expect(body.insertText).toContain('Codex');
    const evidenceText = body.evidence.map((item: any) => item.snippet).join('\n');
    expect(evidenceText).not.toContain('Flight: SFO');
    expect(evidenceText).not.toContain('video meeting');
  });

  it('uses only thread context for thread replies', async () => {
    insertChunk({
      id: 201,
      content:
        'Factory AI free trial passed security approval, but production usage must use RingCentral email login.',
      sourceType: 'glip',
    });

    llmGenerateMock.mockResolvedValueOnce({
      content:
        'Factory AI 试用已经过了 security approval，但 production 还是先用 RingCentral email login。',
    });

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/composer/assist',
      payload: {
        surface: 'ringcentral_thread',
        contextType: 'message_thread',
        scenario: 'thread_reply',
        title: 'AI tools selection',
        audience: {
          conversationTitle: 'AI Service',
          conversationId: '1280503250946',
          groupId: '1280503250946',
          people: ['Alice', 'Bob'],
        },
        contextItems: [
          {
            type: 'thread_root',
            id: 'post-1',
            sender: 'Alice',
            text: 'Can we use Factory AI for production project?',
          },
          {
            type: 'thread_reply',
            id: 'post-2',
            sender: 'Bob',
            text: 'Need security approval status before we decide.',
          },
        ],
        primaryText:
          'Main room unrelated: launch party agenda should not be included in this thread reply.',
      },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.available).toBe(true);
    expect(body.insertText).toContain('Factory AI');
    const prompt = llmGenerateMock.mock.calls[0][0] as string;
    expect(prompt).toContain('Thread root: Alice: Can we use Factory AI');
    expect(prompt).not.toContain('launch party agenda');
  });

  it('writes Jira comments in a formal style with issue context and visible media metadata', async () => {
    insertChunk({
      id: 301,
      content:
        'MTR-116322 unified invite participants experience: UX approved the compact participant picker; next step is frontend integration.',
      sourceType: 'jira',
    });

    llmGenerateMock.mockResolvedValueOnce({
      content:
        'Based on the current issue context, the compact participant picker direction looks aligned with the UX approval. Next step: I will validate the frontend integration against the attached screenshot before marking the comment resolved.',
    });

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/composer/assist',
      payload: {
        surface: 'jira_issue',
        contextType: 'jira_issue',
        scenario: 'jira_comment',
        title: 'MTR-116322: Unified invite participants experience',
        identifiers: { issueKey: 'MTR-116322' },
        audience: {
          issueKey: 'MTR-116322',
          issueSummary: 'Unified invite participants experience',
          people: ['PM Owner', 'Frontend Dev'],
        },
        contextItems: [
          {
            type: 'jira_summary',
            text: 'Unified invite participants experience',
          },
          {
            type: 'jira_description',
            text: 'Need to ship compact participant picker and align invite behavior.',
          },
          {
            type: 'jira_comment',
            sender: 'PM Owner',
            text: 'Please confirm UX approval and frontend integration next step.',
          },
          {
            type: 'image',
            title: 'compact-picker-before-after.png',
            text: 'compact-picker-before-after.png',
            url: 'https://jira.ringcentral.com/secure/attachment/compact-picker-before-after.png',
          },
        ],
      },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.available).toBe(true);
    expect(body.suggestionType).toBe('issue_context');
    expect(body.insertText).toContain('Next step');
    expect(body.insertText).not.toMatch(/哈哈|我这边先补充|我理解当前/);
    const prompt = llmGenerateMock.mock.calls[0][0] as string;
    expect(prompt).toContain('场景：在 Jira issue 里写 comment');
    expect(prompt).toContain('Image: compact-picker-before-after.png');
  });

  it('passes audience into generation so tone can differ by target', async () => {
    insertChunk({
      id: 401,
      content:
        'Codex skill rollout needs one-click install, one-click configure, and a clear owner for backend-supported skills.',
      sourceType: 'glip',
    });

    llmGenerateMock
      .mockResolvedValueOnce({
        content:
          '我会把 rollout plan 收敛成 owner、风险和下一步，先确认一键安装/配置这两块能跑通。',
      })
      .mockResolvedValueOnce({
        content:
          '可以，我觉得就按一键安装/配置/调用这条线讲，顺便补一下 backend-supported skill 的边界。',
      });

    const basePayload = {
      surface: 'ringcentral_message',
      contextType: 'message_thread',
      scenario: 'instant_message_reply',
      contextItems: [
        {
          type: 'message',
          sender: 'Ryan Chen',
          text: 'Codex skill rollout ideally needs one-click install, configure and call.',
        },
      ],
    };

    await app.inject({
      method: 'POST',
      url: '/api/v1/composer/assist',
      payload: {
        ...basePayload,
        title: 'Boss sync',
        audience: {
          conversationTitle: 'Boss sync',
          people: ['VP Engineering'],
          relationshipHint: 'manager',
        },
      },
    });

    await app.inject({
      method: 'POST',
      url: '/api/v1/composer/assist',
      payload: {
        ...basePayload,
        title: 'AI dev group',
        audience: {
          conversationTitle: 'AI dev group',
          people: ['Fred Gu', 'Ryan Chen'],
          relationshipHint: 'developer peer group',
        },
      },
    });

    const bossPrompt = llmGenerateMock.mock.calls[0][0] as string;
    const peerPrompt = llmGenerateMock.mock.calls[1][0] as string;
    expect(bossPrompt).toContain('manager');
    expect(peerPrompt).toContain('developer peer group');
    expect(bossPrompt).not.toEqual(peerPrompt);
  });

  it('injects scenario-specific owner style hints into the composer prompt', async () => {
    insertChunk({
      id: 501,
      content:
        'Codex rollout should focus on one-click install, reusable backend-supported skills, and the owner for rollout risk.',
      sourceType: 'glip',
    });
    insertProfileItem({
      id: 'style-rc-reply',
      itemType: 'preference',
      itemKey: 'writing_style.ringcentral.reply',
      itemValue: 'Use concise Chinese, one short paragraph, no bullet list.',
      confirmed: true,
    });
    insertProfileItem({
      id: 'style-jira-comment',
      itemType: 'preference',
      itemKey: 'writing_style.jira.comment',
      itemValue: 'Use formal English with explicit next step.',
      confirmed: true,
    });

    llmGenerateMock.mockImplementationOnce(async (prompt: string) => ({
      content: prompt.includes('Use concise Chinese, one short paragraph')
        ? '可以，我会把 Codex rollout 收敛成 owner、风险和下一步。'
        : 'STYLE_HINT_MISSING',
    }));

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/composer/assist',
      payload: {
        surface: 'ringcentral_message',
        contextType: 'message_thread',
        scenario: 'instant_message_reply',
        title: 'AI dev group',
        contextItems: [
          {
            type: 'message',
            sender: 'Ryan Chen',
            text: 'Codex rollout needs one-click install and a clear owner.',
          },
        ],
      },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.available).toBe(true);
    expect(body.insertText).toContain('Codex rollout');
    const prompt = llmGenerateMock.mock.calls[0][0] as string;
    expect(prompt).toContain('主人表达约束');
    expect(prompt).toContain('writing_style.ringcentral.reply');
    expect(prompt).toContain('Use concise Chinese, one short paragraph');
    expect(prompt).not.toContain('writing_style.jira.comment');
    expect(prompt).not.toContain('Use formal English with explicit next step');
  });

  it('does not inject unconfirmed facts as facts but allows pending style as a soft hint', async () => {
    insertChunk({
      id: 601,
      content:
        'Factory AI trial is approved for security review; production usage still needs RingCentral email login.',
      sourceType: 'glip',
    });
    insertProfileItem({
      id: 'fact-pending-title',
      itemType: 'fact',
      itemKey: 'job_title',
      itemValue: 'Unconfirmed VP of Product',
      confirmed: false,
    });
    insertProfileItem({
      id: 'fact-confirmed-team',
      itemType: 'fact',
      itemKey: 'team',
      itemValue: 'AI platform team',
      confirmed: true,
    });
    insertProfileItem({
      id: 'style-pending-thread',
      itemType: 'preference',
      itemKey: 'writing_style.ringcentral.thread_reply',
      itemValue: 'Prefer very brief replies with one concrete next action.',
      confirmed: false,
    });

    llmGenerateMock.mockResolvedValueOnce({
      content:
        'Factory AI security review 已过，但 production 还是先用 RingCentral email login。',
    });

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/composer/assist',
      payload: {
        surface: 'ringcentral_thread',
        contextType: 'message_thread',
        scenario: 'thread_reply',
        title: 'AI tools selection',
        contextItems: [
          {
            type: 'thread_root',
            sender: 'Alice',
            text: 'Can we use Factory AI for production project?',
          },
          {
            type: 'thread_reply',
            sender: 'Bob',
            text: 'Need security review status and login requirement.',
          },
        ],
      },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.available).toBe(true);
    const prompt = llmGenerateMock.mock.calls[0][0] as string;
    expect(prompt).toContain('已确认事实');
    expect(prompt).toContain('team: AI platform team');
    expect(prompt).not.toContain('job_title: Unconfirmed VP of Product');
    expect(prompt).toContain('pending inferred，只能作为 soft style hint，不能当事实');
    expect(prompt).toContain('writing_style.ringcentral.thread_reply');
    expect(prompt).toContain('Prefer very brief replies with one concrete next action.');
  });
});
