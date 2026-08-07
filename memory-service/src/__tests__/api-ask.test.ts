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
import {
  extractAskContextTitle,
  formatAskResumeContextHints,
  getAskResumePreferredTopic,
  resolveAskCandidateSelection,
} from '../routes/ask.js';
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
    db.prepare('DELETE FROM conversation_context_frames').run();
    db.prepare('DELETE FROM answer_memory_versions').run();
    db.prepare('DELETE FROM answer_memory_threads').run();
    db.prepare('DELETE FROM answer_memory_observations').run();
    db.prepare('DELETE FROM proposed_action_attempts').run();
    db.prepare('DELETE FROM proposed_actions').run();
    db.prepare('DELETE FROM messages_raw').run();
    db.prepare('DELETE FROM chunks').run();
    db.prepare(`INSERT INTO chunks_fts(chunks_fts) VALUES ('delete-all')`).run();
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

  it('extracts common RingCentral conversation labels as Ask surface titles', () => {
    expect(
      extractAskContextTitle(
        'Surface: RingCentral chat. Current conversation: MTR-141852: AI Custom VBG. Visible message: 那个 BE ready 了吗？',
      ),
    ).toBe('MTR-141852: AI Custom VBG');
    expect(
      extractAskContextTitle(
        'Group name: RingCentral Webinar BE CN Team; Last message: BE owner is checking status.',
      ),
    ).toBe('RingCentral Webinar BE CN Team');
    expect(
      extractAskContextTitle(
        'Thread: AI VBG Phase 2.1 rollout. Question: 那个 BE ready 了吗？',
      ),
    ).toBe('AI VBG Phase 2.1 rollout');
    expect(
      extractAskContextTitle(
        'Surface: RingCentral chat. Current chat title: MTR-141852: AI Custom VBG. Current URL: https://app.ringcentral.com/messages/153798238214 Selected text: BE status still pending.',
      ),
    ).toBe('MTR-141852: AI Custom VBG');
    expect(
      extractAskContextTitle(
        'Surface: Browser page. Current page title: AI Tooling Roadmap. Current URL: https://docs.example.com/roadmap Visible page text: MTR-141852 next steps.',
      ),
    ).toBe('AI Tooling Roadmap');
  });

  it('formats a local Ask resume snapshot as a non-authoritative retrieval hint', () => {
    const hints = {
      source: 'local_ask_resume_snapshot',
      localOnly: true as const,
      updatedAt: '2026-07-15T02:00:00.000Z',
      topicTitle: 'MTR-141852: AI Custom VBG',
      previousQuestion: '那个 BE ready 了吗？',
      previousAnswerSummary: '上一轮判断 backend 还在等待 design。',
      evidenceRefs: ['jira:MTR-141852', 'message:ai-vbg-backend'],
    } as const;
    const context = formatAskResumeContextHints(hints);

    expect(context).toContain('Selected topic: MTR-141852: AI Custom VBG.');
    expect(context).toContain('may be stale; do not treat as evidence');
    expect(context).toContain('Re-retrieve current evidence before answering.');
    expect(context).toContain('Do not persist this hint as user memory');
    expect(getAskResumePreferredTopic(hints)).toBe(
      'MTR-141852: AI Custom VBG',
    );
  });

  it('uses a local Ask resume hint without persisting the snapshot text as memory', async () => {
    generateMock.mockResolvedValue({
      content: JSON.stringify({
        answer: '重新检索后，仍建议先找技术评审负责人确认。',
      }),
    });
    const uniquePreviousSummary =
      'LOCAL-RESUME-ONLY previous answer summary must not become memory';
    const beforeCount = Number(
      db.prepare('SELECT COUNT(*) AS count FROM messages_raw').get().count,
    );

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/ask',
      payload: {
        query: '所以现在应该先找谁确认？',
        includeEvidence: true,
        contextHints: {
          source: 'local_ask_resume_snapshot',
          localOnly: true,
          updatedAt: '2026-07-15T02:00:00.000Z',
          topicTitle: 'Q2 Planning Review',
          previousQuestion: 'Q2 预算评审下一步是什么？',
          previousAnswerSummary: uniquePreviousSummary,
          evidenceRefs: ['meeting:ask-meeting-memory'],
        },
      },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.continuityReceipt).toEqual({
      source: 'local_ask_resume_snapshot',
      localOnly: true,
      usedAsHint: true,
      reRetrieved: true,
      detail:
        '已使用本机续聊线索，并重新检索本轮证据；续聊快照未写入长期记忆。',
    });
    expect(body.contextMatch).toMatchObject({
      state: 'locked',
      selectedTopic: {
        label: expect.stringContaining('Q2 Planning Review'),
      },
    });
    const afterCount = Number(
      db.prepare('SELECT COUNT(*) AS count FROM messages_raw').get().count,
    );
    expect(afterCount).toBe(beforeCount);
    expect(
      db
        .prepare('SELECT COUNT(*) AS count FROM messages_raw WHERE content = ?')
        .get(uniquePreviousSummary).count,
    ).toBe(0);
  });

  it('resolves a candidate-number follow-up from the previous ambiguous Ask turn', () => {
    const context = [
      'User: 那个 BE ready 了吗？',
      'Assistant: 这个问题可能指向多个近期话题。',
      '候选话题：',
      '1. AI Generated VBG (匹配角色词、近期高频)',
      '2. AI Notes (匹配角色词、近期高频)',
      '',
      '你可以直接回复候选序号，或补上项目 / 群组 / issue key；确认后我再继续查证状态和证据。',
    ].join('\n');

    const resolved = resolveAskCandidateSelection('2', context);

    expect(resolved?.query).toBe('那个 BE ready 了吗？ AI Notes');
    expect(resolved?.selectedCandidateIndex).toBe(2);
    expect(resolved?.selectedTopicLabel).toBe('AI Notes');
    expect(resolved?.context).toContain(
      'Clarification: user selected candidate 2: AI Notes.',
    );
    expect(resolveAskCandidateSelection('2')).toBeUndefined();
  });

  it('resolves English candidate follow-up wording from the previous Ask turn', () => {
    const context = [
      'User: Is that BE ready?',
      'Assistant: This question may refer to multiple recent topics.',
      'Candidate topics:',
      '1. AI Generated VBG (role term match, recent activity)',
      '2. AI Notes (role term match, recent activity)',
      '',
      'You can reply with the candidate number, or add a project / group / issue key.',
    ].join('\n');

    const resolved = resolveAskCandidateSelection('candidate 2', context);
    const ordinalResolved = resolveAskCandidateSelection('second one', context);

    expect(resolved?.query).toBe('Is that BE ready? AI Notes');
    expect(resolved?.selectedCandidateIndex).toBe(2);
    expect(resolved?.selectedTopicLabel).toBe('AI Notes');
    expect(resolved?.context).toContain(
      'Clarification: user selected candidate 2: AI Notes.',
    );
    expect(ordinalResolved?.query).toBe('Is that BE ready? AI Notes');
  });

  it('asks for a candidate number when a short Ask topic is ambiguous', async () => {
    const currentTime = Math.floor(Date.now() / 1000);
    const insertFrame = db.prepare(
      `INSERT INTO conversation_context_frames
        (id, surface, source_type, title, summary, dominant_projects_json,
         topics_json, role_terms_json, source_anchors_json, confidence,
         created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    );

    for (const project of ['AI Generated VBG', 'AI Notes']) {
      insertFrame.run(
        `ask-ambiguous:${project}`,
        'glip',
        'glip',
        project,
        `${project} backend BE status is being discussed.`,
        JSON.stringify([project]),
        JSON.stringify([project]),
        JSON.stringify(['backend']),
        JSON.stringify([]),
        0.75,
        currentTime - 120,
        currentTime - 120,
      );
    }

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/ask',
      payload: {
        query: '那个 BE ready 了吗？',
        includeEvidence: true,
      },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.contextMatch?.state).toBe('ambiguous');
    expect(body.answerMemory).toMatchObject({
      state: 'skipped',
      skipReason: 'context_ambiguous',
      receipt: {
        label: '等待话题确认',
        tone: 'warning',
      },
    });
    expect(body.answer).toContain('候选话题：');
    expect(body.answer).toContain('你可以直接回复候选序号');
    expect(body.evidence).toBeUndefined();
  });

  it('continues an ambiguous short Ask after the user replies with a candidate number', async () => {
    const currentTime = Math.floor(Date.now() / 1000);
    const insertFrame = db.prepare(
      `INSERT INTO conversation_context_frames
        (id, surface, source_type, title, summary, dominant_projects_json,
         topics_json, role_terms_json, source_anchors_json, confidence,
         created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    const insertMessage = db.prepare(
      `INSERT INTO messages_raw
        (id, content, source_type, source_url, source_title, sender, group_id,
         group_name, timestamp, importance, sentiment, metadata_json, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    );

    for (const project of ['AI Generated VBG', 'AI Notes']) {
      insertFrame.run(
        `ask-ambiguous-followup:${project}`,
        'glip',
        'glip',
        project,
        `${project} backend BE status is being discussed.`,
        JSON.stringify([project]),
        JSON.stringify([project]),
        JSON.stringify(['backend']),
        JSON.stringify([]),
        0.75,
        currentTime - 120,
        currentTime - 120,
      );
      insertMessage.run(
        `ask-ambiguous-followup-message:${project}`,
        `${project} backend BE is still pending API checks and is not ready yet.`,
        'glip',
        `https://app.ringcentral.com/messages/${encodeURIComponent(project)}`,
        project,
        'Backend Owner',
        project,
        project,
        currentTime - 90,
        0.76,
        'neutral',
        JSON.stringify({ groupName: project }),
        currentTime - 90,
      );
    }

    const first = await app.inject({
      method: 'POST',
      url: '/api/v1/ask',
      payload: {
        query: '那个 BE ready 了吗？',
        includeEvidence: true,
      },
    });

    expect(first.statusCode).toBe(200);
    const firstBody = first.json();
    expect(firstBody.contextMatch?.state).toBe('ambiguous');

    generateMock.mockResolvedValue({
      content: JSON.stringify({
        answer:
          'AI Notes 的 BE 还没有 ready，后端仍在等待 API checks。',
      }),
    });

    const second = await app.inject({
      method: 'POST',
      url: '/api/v1/ask',
      payload: {
        query: '2',
        context: `User: 那个 BE ready 了吗？\nAssistant: ${firstBody.answer}`,
        includeEvidence: true,
      },
    });

    expect(second.statusCode).toBe(200);
    const secondBody = second.json();
    expect(secondBody.contextMatch?.state).toBe('locked');
    expect(secondBody.contextMatch?.selectedTopic?.label).toBe('AI Notes');
    expect(secondBody.evidence?.[0]?.id).toBe(
      'ask-ambiguous-followup-message:AI Notes',
    );
    expect(secondBody.answer).toContain('AI Notes');
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

  it('filters cross-topic evidence before Ask prompt assembly', async () => {
    const currentTime = Math.floor(Date.now() / 1000);
    db.prepare(
      `INSERT INTO watched_projects
        (id, name, aliases_json, is_active, priority, created_at)
       VALUES (?, ?, ?, 1, 8, ?)`,
    ).run(
      'project-umw',
      'Unified Messaging Workspace',
      JSON.stringify(['UMW']),
      currentTime,
    );
    const recallSpy = vi
      .spyOn(RecallEngine.prototype, 'recall')
      .mockResolvedValueOnce({
        items: [
          {
            id: 'ask-umw-repository',
            type: 'message',
            content:
              'Unified Messaging Workspace purpose is unified messaging workflows. Repository URL is github.com/ringcentral/unified-messaging-workspace.',
            score: 0.91,
            source: 'glip',
            sourceTitle: 'Unified Messaging Workspace',
            timestamp: currentTime - 120,
            metadata: { groupName: 'Unified Messaging Workspace' },
          },
          {
            id: 'ask-rc-ai-learning-noise',
            type: 'message',
            content:
              'Signal Deck purpose and repository URL are documented in github.com/esone/rc-ai-learning.',
            score: 0.89,
            source: 'glip',
            sourceTitle: 'rc-ai-learning',
            timestamp: currentTime - 60,
            metadata: { groupName: 'rc-ai-learning' },
          },
        ],
        totalFound: 2,
        channels: ['fts'],
        queryTimeMs: 1,
      } as any);
    generateMock.mockResolvedValue({
      content: JSON.stringify({
        answer:
          'Unified Messaging Workspace serves unified messaging workflows.',
      }),
    });

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/ask',
      payload: {
        query:
          'Unified Messaging Workspace 的 purpose 和 repository URL 是什么？',
        includeEvidence: true,
      },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.evidence.map((item: { id: string }) => item.id)).toEqual([
      'ask-umw-repository',
    ]);
    expect(body.cohesionReceipt).toMatchObject({
      state: 'cohesive',
      usedCount: 1,
      excludedCount: 1,
      silent: true,
    });
    const prompts = generateMock.mock.calls
      .map((call) => call[0])
      .filter((value): value is string => typeof value === 'string');
    expect(prompts.some((prompt) => prompt.includes('ask-rc-ai-learning-noise'))).toBe(
      false,
    );
    expect(prompts.some((prompt) => prompt.includes('Signal Deck purpose'))).toBe(
      false,
    );
    recallSpy.mockRestore();
  });

  it('sanitizes mixed-owner claims before Ask generation and returns a compact attribution receipt', async () => {
    const currentTime = Math.floor(Date.now() / 1000);
    const mixedContent =
      '我的决定是 Project Nimbus 保留 Vue；另一位 AI 建议 Project Nimbus 改用 React；先假设 Project Nimbus 七月一日上线。';
    db.prepare(
      `INSERT INTO messages_raw (
         id, content, source_type, source, scope, sender, timestamp,
         importance, sentiment, metadata_json, created_at
       ) VALUES (?, ?, 'glip', 'glip', 'work', 'Esone', ?, 0.92, 'neutral', ?, ?)`,
    ).run(
      'ask-claim-mixed',
      mixedContent,
      currentTime,
      JSON.stringify({ authorRole: 'user' }),
      currentTime,
    );
    const recallSpy = vi
      .spyOn(RecallEngine.prototype, 'recall')
      .mockResolvedValueOnce({
        items: [
          {
            id: 'ask-claim-mixed',
            type: 'message',
            content: mixedContent,
            score: 0.96,
            source: 'glip',
            sourceTitle: 'Project Nimbus decision',
            timestamp: currentTime,
            metadata: { messageId: 'ask-claim-mixed' },
          },
        ],
        totalFound: 1,
        channels: ['fts'],
        queryTimeMs: 1,
      } as any);
    generateMock.mockResolvedValue({
      content: JSON.stringify({
        answer: '你的决定是保留 Vue；React 仅是 AI 建议。',
      }),
    });

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/ask',
      payload: {
        query: 'Project Nimbus 最后决定用什么？',
        includeEvidence: true,
      },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.evidence).toHaveLength(1);
    expect(body.evidence[0].content).toContain('保留 Vue');
    expect(body.evidence[0].content).toContain('改用 React');
    expect(body.evidence[0].content).not.toContain('七月一日上线');
    expect(body.evidence[0].claimAttribution.map((claim: any) => claim.effect)).toEqual([
      'used',
      'background_only',
      'blocked',
    ]);
    expect(body.attributionReceipt).toMatchObject({
      visibility: 'compact',
      summary: '采用 1 条；仅作背景 1 条；未使用 1 条',
      boundary: expect.stringContaining('不修改原始消息或外部系统'),
    });
    const prompts = generateMock.mock.calls
      .map((call) => call[0])
      .filter((value): value is string => typeof value === 'string');
    expect(prompts.some((prompt) => prompt.includes('七月一日上线'))).toBe(false);
    expect(prompts.some((prompt) => prompt.includes('保留 Vue'))).toBe(true);
    recallSpy.mockRestore();
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

  it('returns a deterministic evidence summary when answer generation times out', async () => {
    generateMock
      .mockResolvedValueOnce({
        resolutionState: 'partial',
        directFindings: ['John said the release risks are increasing.'],
        resolvedConclusion: 'John raised release risk.',
        remainingQuestions: ['需要确认下一步 owner。'],
        candidateArtifacts: [],
        recommendedAction: 'none',
        confidence: 0.72,
        legacyClassification: 'answer',
        summary: 'John raised release risk.',
      })
      .mockRejectedValueOnce(
        new Error('[LLMClient] Request timed out after 5000ms'),
      );

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

    expect(body.answer).toContain('基于已检索到的记忆');
    expect(body.answer).toContain('release risks are increasing');
    expect(body.evidence).toHaveLength(1);
    expect(body.evidence[0].id).toBe('ask-john-message');
    expect(body.missingInfo).toContain(
      'LLM 综合生成超时，当前回答为确定性证据摘要。',
    );
    expect(body.analysis.summary).toContain('可能相关的记忆');
    expect(generateMock).toHaveBeenCalledTimes(2);
  });

  it('keeps locked resume-topic evidence when answer generation times out', async () => {
    generateMock
      .mockResolvedValueOnce({
        resolutionState: 'partial',
        directFindings: [],
        resolvedConclusion: '',
        remainingQuestions: ['需要确认下一步 owner。'],
        candidateArtifacts: [],
        recommendedAction: 'none',
        confidence: 0.5,
        legacyClassification: 'answer',
        summary: 'Need current owner confirmation.',
      })
      .mockRejectedValueOnce(
        new Error('[LLMClient] Request timed out after 5000ms'),
      );

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/ask',
      payload: {
        query: '所以现在应该先找谁确认？',
        includeEvidence: true,
        contextHints: {
          source: 'local_ask_resume_snapshot',
          localOnly: true,
          updatedAt: '2026-07-15T02:00:00.000Z',
          topicTitle: 'Q2 Planning Review',
          previousQuestion: 'Q2 预算评审下一步是什么？',
          previousAnswerSummary: '旧摘要只作定位线索。',
          evidenceRefs: ['meeting:ask-meeting-memory'],
        },
      },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.contextMatch).toMatchObject({
      state: 'locked',
      selectedTopic: {
        label: expect.stringContaining('Q2 Planning Review'),
      },
    });
    expect(body.answer).toContain('基于已检索到的记忆');
    expect(body.evidence.map((item: { id: string }) => item.id)).toContain(
      'ask-meeting-memory',
    );
  });

  it('does not turn unrelated recalled items into fallback evidence', async () => {
    const recallSpy = vi
      .spyOn(RecallEngine.prototype, 'recall')
      .mockResolvedValueOnce({
        items: [
          {
            id: 'ask-unrelated-afternoon-meeting',
            type: 'message',
            content: '稍等一下，我下午会议有点多，迟些我加下。',
            score: 0.91,
            source: 'glip',
            sourceUrl: 'https://memory.example.com/messages/ask-unrelated-afternoon-meeting',
            sourceTitle: 'Afternoon meeting note',
            timestamp: Math.floor(Date.now() / 1000) - 3600,
          },
        ],
        totalFound: 1,
        channels: ['fts'],
        queryTimeMs: 1,
      } as any);
    generateMock
      .mockResolvedValueOnce({
        resolutionState: 'partial',
        directFindings: [],
        resolvedConclusion: '',
        remainingQuestions: ['本地没有巴黎航班事实。'],
        candidateArtifacts: [],
        recommendedAction: 'none',
        confidence: 0.2,
        legacyClassification: 'answer',
        summary: 'No grounded flight evidence.',
      })
      .mockRejectedValueOnce(
        new Error('[LLMClient] Request timed out after 5000ms'),
      );

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/ask',
      payload: {
        query: '我下周飞往巴黎的航班是几点起飞？登机口是多少？',
        includeEvidence: true,
      },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.answer).toContain('本地记忆没有检索到足够证据');
    expect(body.evidence).toEqual([]);
    expect(body.blocks).toBeUndefined();
    expect(body.resolutionState).toBe('insufficient');
    expect(body.missingInfo).toContain(
      '已检索到候选记忆，但与本问题的关键锚点没有足够交集，未作为回答证据。',
    );
    recallSpy.mockRestore();
  });

  it('uses active lifecycle recall in /ask by default', async () => {
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
    expect(recallSpy.mock.calls[0][0].lifecycleMode).toBe('active_default');
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
            scope: 'work',
          },
        ],
        totalFound: 1,
        channels: ['time'],
        queryTimeMs: 1,
        scopeReceipt: {
          requestedScope: 'both',
          effectiveScope: 'both',
          returned: { work: 1, personal: 0, unknown: 0, total: 1 },
          candidates: { work: 1, personal: 0, unknown: 0, total: 1 },
          note: '本次主动召回检索工作和个人记忆，当前返回结果未包含个人记忆。',
          includesPersonal: false,
        },
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
    expect(res.json().scopeReceipt).toMatchObject({
      requestedScope: 'both',
      effectiveScope: 'both',
      includesPersonal: false,
    });
    recallSpy.mockRestore();
  });

  it('accepts all ask scope from the search UI', async () => {
    const recallSpy = vi
      .spyOn(RecallEngine.prototype, 'recall')
      .mockResolvedValueOnce({
        items: [
          {
            id: 'ask-all-scope-memory',
            type: 'message',
            content:
              'Personal and work planning context should be available when the user searches all memories.',
            score: 0.88,
            source: 'manual',
            timestamp: Math.floor(Date.now() / 1000) - 120,
            scope: 'personal',
          },
        ],
        totalFound: 1,
        channels: ['time'],
        queryTimeMs: 1,
        scopeReceipt: {
          requestedScope: 'all',
          effectiveScope: 'both',
          returned: { work: 0, personal: 1, unknown: 0, total: 1 },
          candidates: { work: 0, personal: 1, unknown: 0, total: 1 },
          note: '本次主动召回检索全部记忆，返回结果包含 1 条个人记忆；引用到工作场景前请确认。',
          includesPersonal: true,
        },
      } as any);
    generateMock.mockResolvedValue({
      content: JSON.stringify({
        answer: 'All-scope evidence is available.',
      }),
    });

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/ask',
      payload: {
        query: 'What planning context do I have?',
        includeEvidence: true,
        scope: 'all',
      },
    });

    expect(res.statusCode).toBe(200);
    expect(recallSpy).toHaveBeenCalled();
    expect(recallSpy.mock.calls[0][0].scope).toBe('all');
    const body = res.json();
    expect(body.evidence?.[0]?.id).toBe('ask-all-scope-memory');
    expect(body.scopeReceipt).toMatchObject({
      requestedScope: 'all',
      effectiveScope: 'both',
      includesPersonal: true,
    });
    expect(body.scopeReceipt.note).toContain('个人记忆');
    recallSpy.mockRestore();
  });

  it('expands short VBG backend ask queries before recall', async () => {
    const currentTime = Math.floor(Date.now() / 1000);
    db.prepare(
      `INSERT INTO watched_projects
        (id, name, aliases_json, is_active, priority, created_at)
       VALUES (?, ?, ?, 1, 8, ?)`,
    ).run(
      'project-vbg',
      'Next gen VBG',
      JSON.stringify(['AI VBG', 'VBG', 'AI Generated Background']),
      currentTime,
    );

    const rows = [
      {
        id: 'ask-vbg-backend-pending',
        chunkId: 9100,
        content:
          'Ivan confirmed RCV BE new design still has pending work on RCV-148412 and RCV-148411 before ready.',
        hash: 'hash-ask-vbg-backend-pending',
      },
      {
        id: 'ask-vbg-daily-limit',
        chunkId: 9101,
        content:
          'AI Generated VBG daily generation limit is 20 per day with retry-after on quota errors.',
        hash: 'hash-ask-vbg-daily-limit',
      },
    ];

    for (const row of rows) {
      db.prepare(
        `INSERT INTO messages_raw
          (id, content, source_type, source_url, source_title, sender, group_id,
           group_name, timestamp, importance, sentiment, metadata_json, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run(
        row.id,
        row.content,
        'glip',
        `https://app.ringcentral.com/messages/${row.id}`,
        'MTR-141852: AI Custom VBG',
        'Ivan Velencoso',
        'vbg-group',
        'MTR-141852: AI Custom VBG',
        currentTime - 600,
        0.86,
        'neutral',
        JSON.stringify({
          groupId: 'vbg-group',
          groupName: 'MTR-141852: AI Custom VBG',
        }),
        currentTime - 600,
      );
      db.prepare(
        `INSERT INTO chunks
          (chunk_id, file_path, line_start, line_end, content, content_hash,
           scope, source, source_type, related_project, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run(
        row.chunkId,
        `messages/${row.id}`,
        1,
        1,
        row.content,
        row.hash,
        'work',
        'glip',
        'glip',
        'RCV Working Team: Modernize Existing Backgrounds and Add AI-Generated VBGs',
        currentTime - 600,
      );
      db.prepare(`INSERT INTO chunks_fts(rowid, content) VALUES (?, ?)`).run(
        row.chunkId,
        row.content,
      );
    }

    generateMock.mockResolvedValue({
      content: JSON.stringify({
        answer: 'VBG backend still has pending work before it is ready.',
        keyFindings: ['Backend work is still pending.'],
      }),
    });
    const recallSpy = vi.spyOn(RecallEngine.prototype, 'recall');

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/ask',
      payload: {
        query: 'AI VBG 的 BE 部分完成情况如何',
        includeEvidence: true,
      },
    });

    expect(res.statusCode).toBe(200);
    expect(recallSpy).toHaveBeenCalled();
    expect(recallSpy.mock.calls[0][0].query).toContain('backend');
    expect(recallSpy.mock.calls[0][0].query).toContain('VBG');
    expect(recallSpy.mock.calls[0][0].lifecycleMode).toBe('active_default');
    const body = res.json();
    expect(body.evidence?.[0]?.id).toBe('ask-vbg-backend-pending');
    expect(body.evidence?.[0]?.content).toContain('pending work');
    expect(body.answer).toContain('pending work');
    recallSpy.mockRestore();
  });

  it('uses query topical anchors for ambiguous VBG backend ask queries', async () => {
    const currentTime = Math.floor(Date.now() / 1000);
    for (const row of [
      {
        id: 'ask-vbg-ambiguous-target',
        content:
          'AI VBG RCV BE new design is still pending before the backend can be ready.',
        sourceTitle: 'MTR-141852: AI Custom VBG',
        groupName: 'MTR-141852: AI Custom VBG',
        timestamp: currentTime - 60,
        importance: 0.9,
      },
      {
        id: 'ask-vbg-ambiguous-other',
        content:
          'AI VBG backend planning is also mentioned in a different video launch thread.',
        sourceTitle: 'New AI Meetings Desktop Client',
        groupName: 'New AI Meetings Desktop Client',
        timestamp: currentTime - 120,
        importance: 0.7,
      },
    ]) {
      db.prepare(
        `INSERT INTO messages_raw
          (id, content, source_type, source_url, source_title, sender, group_id,
           group_name, timestamp, importance, sentiment, metadata_json, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run(
        row.id,
        row.content,
        'glip',
        `https://app.ringcentral.com/messages/${row.id}`,
        row.sourceTitle,
        'Ivan Velencoso',
        row.id,
        row.groupName,
        row.timestamp,
        row.importance,
        'neutral',
        JSON.stringify({
          groupName: row.groupName,
        }),
        row.timestamp,
      );
    }

    generateMock.mockResolvedValue({
      content: JSON.stringify({
        answer: 'AI VBG 的 BE 仍在等 RCV BE new design。',
      }),
    });

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/ask',
      payload: {
        query: 'AI VBG 的 BE 部分完成情况如何',
        includeEvidence: true,
      },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.evidence?.[0]?.id).toBe('ask-vbg-ambiguous-target');
    expect(body.evidence?.[0]?.content).toContain('RCV BE new design');
  });

  it('uses provided surface context to resolve deictic BE ask queries before recall', async () => {
    const currentTime = Math.floor(Date.now() / 1000);
    db.prepare(
      `INSERT INTO watched_projects
        (id, name, aliases_json, is_active, priority, created_at)
       VALUES (?, ?, ?, 1, 9, ?)`,
    ).run(
      'project-ai-custom-vbg',
      'AI Custom VBG',
      JSON.stringify(['MTR-141852', 'AI VBG', 'AI Generated VBG']),
      currentTime,
    );
    db.prepare(
      `INSERT INTO messages_raw
        (id, content, source_type, source_url, source_title, sender, group_id,
         group_name, timestamp, importance, sentiment, metadata_json, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      'ask-vbg-deictic-backend',
      'MTR-141852 AI Custom VBG backend BE is not ready yet because RCV BE new design is still pending.',
      'glip',
      'https://app.ringcentral.com/messages/ask-vbg-deictic-backend',
      'MTR-141852: AI Custom VBG',
      'Ivan Velencoso',
      'mtr-141852',
      'MTR-141852: AI Custom VBG',
      currentTime - 300,
      0.9,
      'neutral',
      JSON.stringify({
        groupName: 'MTR-141852: AI Custom VBG',
      }),
      currentTime - 300,
    );
    db.prepare(
      `INSERT INTO messages_raw
        (id, content, source_type, source_url, source_title, sender, group_id,
         group_name, timestamp, importance, sentiment, metadata_json, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      'ask-vbg-ui-color-noise',
      'MTR-141852 AI Custom VBG UI color token still needs design confirmation.',
      'glip',
      'https://app.ringcentral.com/messages/ask-vbg-ui-color-noise',
      'MTR-141852: AI Custom VBG',
      'Eva Zhang',
      'mtr-141852',
      'MTR-141852: AI Custom VBG',
      currentTime - 100,
      0.99,
      'neutral',
      JSON.stringify({
        groupName: 'MTR-141852: AI Custom VBG',
      }),
      currentTime - 100,
    );
    db.prepare(
      `INSERT INTO messages_raw
        (id, content, source_type, source_url, source_title, sender, group_id,
         group_name, timestamp, importance, sentiment, metadata_json, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      'ask-vbg-webpage-distractor',
      'RingCentral Video page capture mentions MTR-141852 but does not contain the chat answer.',
      'web',
      'https://v.ringcentral.com/conf/on/292463811',
      'MTR-141852: AI Custom VBG',
      'Memory Capture',
      'v.ringcentral.com',
      'v.ringcentral.com',
      currentTime - 120,
      0.99,
      'neutral',
      JSON.stringify({
        sourceKind: 'webpage',
        sourceTitle: 'RingCentral Video',
      }),
      currentTime - 120,
    );
    db.prepare(
      `INSERT INTO messages_raw
        (id, content, source_type, source_url, source_title, sender, group_id,
         group_name, timestamp, importance, sentiment, metadata_json, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      'ask-vbg-sync-service-noise',
      'AI Service risk digest mentions MTR-141852, BE readiness, and RCV mobile release notes, but it is a generic esone.qiu+sync.service summary.',
      'glip',
      'https://app.ringcentral.com/messages/ask-vbg-sync-service-noise',
      'esone.qiu+sync.service',
      'AI Service',
      'sync-service',
      'esone.qiu+sync.service',
      currentTime - 60,
      0.99,
      'neutral',
      JSON.stringify({
        groupName: 'esone.qiu+sync.service',
      }),
      currentTime - 60,
    );
    db.prepare(
      `INSERT INTO chunks
        (chunk_id, file_path, line_start, line_end, content, content_hash,
         scope, source, source_type, related_project, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      9200,
      'messages/ask-vbg-deictic-backend',
      1,
      1,
      'MTR-141852 AI Custom VBG backend BE is not ready yet because RCV BE new design is still pending.',
      'hash-ask-vbg-deictic-backend',
      'work',
      'glip',
      'glip',
      'AI Custom VBG',
      currentTime - 300,
    );
    db.prepare(`INSERT INTO chunks_fts(rowid, content) VALUES (?, ?)`).run(
      9200,
      'MTR-141852 AI Custom VBG backend BE is not ready yet because RCV BE new design is still pending.',
    );
    generateMock.mockResolvedValue({
      content: JSON.stringify({
        answer: 'AI Custom VBG 的 BE 还没有 ready，RCV BE new design 仍 pending。',
      }),
    });
    const recallSpy = vi.spyOn(RecallEngine.prototype, 'recall');

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/ask',
      payload: {
        query: '那个 BE ready 了吗？',
        context:
          'Surface: RingCentral chat. Current chat title: MTR-141852: AI Custom VBG. Visible message: 那个 BE ready 了吗？',
        includeEvidence: true,
      },
    });

    expect(res.statusCode).toBe(200);
    expect(recallSpy).toHaveBeenCalled();
    const recallQuery = recallSpy.mock.calls[0][0].query;
    expect(recallQuery).toContain('AI Custom VBG');
    expect(recallQuery).toContain('MTR-141852');
    expect(recallQuery).toContain('backend');
    const body = res.json();
    expect(body.evidence?.[0]?.id).toBe('ask-vbg-deictic-backend');
    expect(
      body.evidence?.some(
        (item: any) => item.id === 'ask-vbg-sync-service-noise',
      ),
    ).toBe(false);
    expect(body.answer).toContain('还没有 ready');
    recallSpy.mockRestore();
  });

  it('uses current conversation labels as Ask surface context for deictic questions', async () => {
    const currentTime = Math.floor(Date.now() / 1000);
    const insert = db.prepare(
      `INSERT INTO messages_raw
        (id, content, source_type, source_url, source_title, sender, group_id,
         group_name, timestamp, importance, sentiment, metadata_json, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    );

    insert.run(
      'ask-webinar-be-current-conversation',
      'RingCentral Webinar BE CN Team backend is not ready yet because the BE owner is still checking API status.',
      'glip',
      'https://app.ringcentral.com/messages/ask-webinar-be-current-conversation',
      'RingCentral Webinar BE CN Team',
      'Ivan Velencoso',
      'webinar-be-cn',
      'RingCentral Webinar BE CN Team',
      currentTime - 600,
      0.74,
      'neutral',
      JSON.stringify({
        groupName: 'RingCentral Webinar BE CN Team',
      }),
      currentTime - 600,
    );
    insert.run(
      'ask-generic-backend-current-conversation-distractor',
      'Generic backend maintenance is ready and fully deployed.',
      'glip',
      'https://app.ringcentral.com/messages/ask-generic-backend-current-conversation-distractor',
      'RCW Backend team',
      'Backend Bot',
      'backend-team',
      'RCW Backend team',
      currentTime - 30,
      0.95,
      'neutral',
      JSON.stringify({
        groupName: 'RCW Backend team',
      }),
      currentTime - 30,
    );

    generateMock.mockResolvedValue({
      content: JSON.stringify({
        answer:
          'RingCentral Webinar BE CN Team 的 BE 还没有 ready，owner 仍在检查 API 状态。',
      }),
    });

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/ask',
      payload: {
        query: '那个 BE ready 了吗？',
        context:
          'Surface: RingCentral chat. Current conversation: RingCentral Webinar BE CN Team. Visible message: 那个 BE ready 了吗？',
        includeEvidence: true,
      },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.contextMatch?.state).toBe('locked');
    expect(body.contextMatch?.selectedTopic?.label).toBe(
      'RingCentral Webinar BE CN Team',
    );
    expect(body.evidence?.[0]?.id).toBe(
      'ask-webinar-be-current-conversation',
    );
    expect(body.evidence?.[0]?.metadata?.contextAnchorReason).toBe(
      'locked_memory_context_match',
    );
    expect(body.answer).toContain('还没有 ready');
  });

  it('tracks repeated locked ask outcomes without changing the Ask UI payload shape', async () => {
    const currentTime = Math.floor(Date.now() / 1000);
    db.prepare(
      `INSERT INTO watched_projects
        (id, name, aliases_json, is_active, priority, created_at)
       VALUES (?, ?, ?, 1, 9, ?)`,
    ).run(
      'project-ai-custom-vbg',
      'AI Custom VBG',
      JSON.stringify(['MTR-141852', 'AI VBG', 'AI Generated VBG']),
      currentTime,
    );
    db.prepare(
      `INSERT INTO messages_raw
        (id, content, source_type, source_url, source_title, sender, group_id,
         group_name, timestamp, importance, sentiment, metadata_json, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      'ask-vbg-answer-memory-backend',
      'MTR-141852 AI Custom VBG backend BE is not ready yet because RCV BE new design is still pending.',
      'glip',
      'https://app.ringcentral.com/messages/ask-vbg-answer-memory-backend',
      'MTR-141852: AI Custom VBG',
      'Ivan Velencoso',
      'mtr-141852',
      'MTR-141852: AI Custom VBG',
      currentTime - 300,
      0.9,
      'neutral',
      JSON.stringify({
        groupName: 'MTR-141852: AI Custom VBG',
      }),
      currentTime - 300,
    );
    db.prepare(
      `INSERT INTO chunks
        (chunk_id, file_path, line_start, line_end, content, content_hash,
         scope, source, source_type, related_project, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      9300,
      'messages/ask-vbg-answer-memory-backend',
      1,
      1,
      'MTR-141852 AI Custom VBG backend BE is not ready yet because RCV BE new design is still pending.',
      'hash-ask-vbg-answer-memory-backend',
      'work',
      'glip',
      'glip',
      'AI Custom VBG',
      currentTime - 300,
    );
    db.prepare(`INSERT INTO chunks_fts(rowid, content) VALUES (?, ?)`).run(
      9300,
      'MTR-141852 AI Custom VBG backend BE is not ready yet because RCV BE new design is still pending.',
    );

    generateMock.mockResolvedValue({
      content: JSON.stringify({
        answer: 'AI Custom VBG 的 BE 还没有 ready，RCV BE new design 仍 pending。',
        keyFindings: ['Backend work is still pending.'],
        confidence: 0.78,
      }),
    });

    const first = await app.inject({
      method: 'POST',
      url: '/api/v1/ask',
      payload: {
        query: '那个 BE ready 了吗？',
        context:
          'Surface: RingCentral chat. Current chat title: MTR-141852: AI Custom VBG. Visible message: 那个 BE ready 了吗？',
        includeEvidence: true,
      },
    });
    expect(first.statusCode).toBe(200);
    const firstAnswerMemory = first.json().answerMemory;
    expect(firstAnswerMemory?.state).toBe('observed');
    expect(firstAnswerMemory?.receipt).toMatchObject({
      label: '已记录活答案候选',
      currentEvidenceCount: 2,
    });
    expect(firstAnswerMemory?.authority).toMatchObject({
      decision: 'authorized_change',
    });
    expect(
      db
        .prepare('SELECT COUNT(*) AS count FROM answer_memory_threads')
        .get(),
    ).toEqual({ count: 0 });

    const second = await app.inject({
      method: 'POST',
      url: '/api/v1/ask',
      payload: {
        query: 'AI VBG 的 BE 部分完成情况如何？',
        context:
          'Surface: RingCentral chat. Current chat title: MTR-141852: AI Custom VBG.',
        includeEvidence: true,
      },
    });
    expect(second.statusCode).toBe(200);
    const secondBody = second.json();
    expect(secondBody.answerMemory?.state).toBe('promoted');
    expect(secondBody.answerMemory?.threadId).toBeTruthy();
    expect(secondBody.answerMemory?.receipt).toMatchObject({
      label: '已建立活答案',
      currentEvidenceCount: 2,
    });
    expect(secondBody.answerMemory?.authority).toMatchObject({
      decision: 'authorized_change',
    });

    const third = await app.inject({
      method: 'POST',
      url: '/api/v1/ask',
      payload: {
        query: '那个 BE ready 了吗？',
        context:
          'Surface: RingCentral chat. Current chat title: MTR-141852: AI Custom VBG. Visible message: 那个 BE ready 了吗？',
        includeEvidence: true,
      },
    });
    expect(third.statusCode).toBe(200);
    const thirdBody = third.json();
    expect(thirdBody.answerMemory?.state).toBe('priorHit');
    expect(thirdBody.answerMemory?.receipt).toMatchObject({
      label: '活答案已复核',
      currentEvidenceCount: 2,
      priorEvidenceCount: 2,
      lastVerifiedAt: expect.any(Number),
      staleAfter: expect.any(Number),
    });
    expect(thirdBody.answerMemory?.receipt?.lastVerifiedAt).toBeGreaterThan(0);
    expect(thirdBody.answerMemory?.receipt?.staleAfter).toBeGreaterThan(
      thirdBody.answerMemory?.receipt?.lastVerifiedAt ?? 0,
    );
    expect(thirdBody.answerMemory?.authority).toMatchObject({
      decision: 'same_meaning_no_change',
      suppressedUpdate: false,
    });
    expect(thirdBody.answer).toContain('还没有 ready');
  });

  it('does not promote noisy web captures as context anchors for deictic BE queries without surface context', async () => {
    const currentTime = Math.floor(Date.now() / 1000);
    db.prepare(
      `INSERT INTO messages_raw
        (id, content, source_type, source_url, source_title, sender, group_id,
         group_name, timestamp, importance, sentiment, metadata_json, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      'ask-noisy-docs-capture',
      'Story Points estimation by AI Service Restore this version Ask Gemini FileEditViewInsertFormatTools Accessibility Belarusian Create a new doc',
      'web',
      'https://docs.google.com/document/d/noisy/edit',
      'Story Points estimation by AI Service - Google Docs',
      'Memory Capture',
      'docs.google.com',
      'docs.google.com',
      currentTime - 30,
      0.99,
      'neutral',
      JSON.stringify({
        captureLayer: 'memory_capture',
        sourceTitle: 'Story Points estimation by AI Service - Google Docs',
      }),
      currentTime - 30,
    );
    db.prepare(
      `INSERT INTO messages_raw
        (id, content, source_type, source_url, source_title, sender, group_id,
         group_name, timestamp, importance, sentiment, metadata_json, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      'ask-recent-vbg-be-status',
      'AI Generate 现在我们需要等 RCV BE 新的 design，所以 BE 还没有 ready。',
      'glip',
      'https://app.ringcentral.com/messages/ask-recent-vbg-be-status',
      'MTR-141852: AI Custom VBG',
      'Quintin Xiao',
      '153798238214',
      'MTR-141852: AI Custom VBG',
      currentTime - 120,
      0.9,
      'neutral',
      JSON.stringify({
        groupName: 'MTR-141852: AI Custom VBG',
      }),
      currentTime - 120,
    );

    generateMock.mockResolvedValue({
      content: JSON.stringify({
        answer: 'BE 还没有 ready，仍在等 RCV BE 新的 design。',
      }),
    });
    const recallSpy = vi.spyOn(RecallEngine.prototype, 'recall').mockResolvedValue({
      items: [
        {
          id: 'ask-sync-service-noise',
          type: 'message',
          content:
            'Nova Brandy Daily and RCV mobile release notes mention AI Notes, BE risk, and MTR-141852, but this is a generic summary.',
          score: 0.99,
          source: 'glip',
          sourceTitle: 'esone.qiu+sync.service',
          timestamp: currentTime - 30,
          metadata: {
            groupName: 'esone.qiu+sync.service',
            sourceTitle: 'esone.qiu+sync.service',
          },
        },
        {
          id: 'ask-ai-notes-noise',
          type: 'message',
          content:
            'AI Notes participant recognition needs speaker diarization and follow-up planning.',
          score: 0.98,
          source: 'glip',
          sourceTitle: '❤️ Interests',
          timestamp: currentTime - 45,
          metadata: {
            groupName: '❤️ Interests',
            sourceTitle: '❤️ Interests',
          },
        },
      ],
      totalFound: 2,
      queryTimeMs: 1,
      channels: ['fts'],
    } as any);

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/ask',
      payload: {
        query: '那个 BE ready 了吗？',
        includeEvidence: true,
      },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.evidence?.[0]?.id).toBe('ask-recent-vbg-be-status');
    expect(body.evidence?.[0]?.source).toBe('glip');
    expect(body.evidence?.[0]?.content).toContain('RCV BE 新的 design');
    expect(body.contextMatch?.state).toBe('locked');
    expect(body.contextMatch?.selectedTopic?.label).toContain('MTR-141852');
    expect(body.evidence?.[0]?.metadata?.contextAnchorReason).toBe(
      'locked_memory_context_match',
    );
    expect(
      body.evidence
        ?.some((item: any) =>
          [
            'ask-noisy-docs-capture',
            'ask-sync-service-noise',
            'ask-ai-notes-noise',
          ].includes(item.id),
        ),
    ).toBe(false);
    recallSpy.mockRestore();
  });

  it('keeps direct older BE status evidence ahead of newer generic backend mentions', async () => {
    const currentTime = Math.floor(Date.now() / 1000);
    const insert = db.prepare(
      `INSERT INTO messages_raw
        (id, content, source_type, source_url, source_title, sender, group_id,
         group_name, timestamp, importance, sentiment, metadata_json, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    const insertMany = db.transaction(() => {
      for (let index = 0; index < 170; index += 1) {
        insert.run(
          `ask-generic-backend-${index}`,
          index === 0
            ? 'Generic backend maintenance note 0. See [routing ticket](https://jira.ringcentral.com/browse/INIT-26199), but no direct project ready signal here.'
            : `Generic backend maintenance note ${index}. No direct project ready signal here.`,
          'glip',
          `https://app.ringcentral.com/messages/ask-generic-backend-${index}`,
          'RCW Backend team',
          'Backend Bot',
          'backend-team',
          'RCW Backend team',
          currentTime - index,
          0.7,
          'neutral',
          JSON.stringify({
            groupName: 'RCW Backend team',
          }),
          currentTime - index,
        );
      }
    });
    insertMany();

    insert.run(
      'ask-older-vbg-be-status',
      'AI Generate 现在我们需要等RCV BE新的design，所以 BE 还没有 ready。',
      'glip',
      'https://app.ringcentral.com/messages/ask-older-vbg-be-status',
      'MTR-141852: AI Custom VBG',
      'Quintin Xiao',
      '153798238214',
      'MTR-141852: AI Custom VBG',
      currentTime - 80 * 24 * 60 * 60,
      0.5,
      'neutral',
      JSON.stringify({
        groupName: 'MTR-141852: AI Custom VBG',
      }),
      currentTime - 80 * 24 * 60 * 60,
    );

    generateMock.mockResolvedValue({
      content: JSON.stringify({
        answer: 'BE 还没有 ready，仍在等 RCV BE 新的 design。',
      }),
    });

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/ask',
      payload: {
        query: '那个 BE ready 了吗？',
        includeEvidence: true,
      },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.evidence?.[0]?.id).toBe('ask-older-vbg-be-status');
    expect(body.evidence?.[0]?.metadata?.contextAnchorReason).toBe(
      'locked_memory_context_match',
    );
    expect(body.contextMatch?.state).toBe('locked');
    expect(body.answer).toContain('Memory service 先把这个问题锁定到');
    expect(body.followUpActions ?? []).toHaveLength(0);
  });

  it('adds a decision evidence chain block for historical decision questions', async () => {
    const now = Math.floor(Date.now() / 1000);
    const recallSpy = vi
      .spyOn(RecallEngine.prototype, 'recall')
      .mockResolvedValueOnce({
        items: [
          {
            id: 'decision-codex-base',
            type: 'message',
            content:
              'Fred said the team decided to keep active Cursor users unblocked while pushing Codex experimentation because Cursor cost pressure was high.',
            score: 0.96,
            source: 'glip',
            sourceUrl: 'https://memory.example.com/messages/decision-codex-base',
            sourceTitle: 'AI tools migration discussion',
            timestamp: now - 86400,
            metadata: {
              sourceType: 'glip',
              sender: 'Fred',
              groupName: 'AI Tools for Engineering',
            },
          },
          {
            id: 'decision-factory-change',
            type: 'message',
            content:
              'Factory.ai production approval changed on Apr 30, so the AI tool migration decision needs review before the OpenAI deal vote.',
            score: 0.9,
            source: 'glip',
            sourceUrl:
              'https://memory.example.com/messages/decision-factory-change',
            sourceTitle: 'Factory.ai production approval update',
            timestamp: now - 3600,
            metadata: {
              sourceType: 'glip',
              sender: 'Global P+T',
              groupName: 'Global P+T',
            },
          },
        ],
        totalFound: 2,
        channels: ['fts'],
        queryTimeMs: 1,
      } as any);
    generateMock.mockResolvedValue({
      content: JSON.stringify({
        answer:
          '当时的方向是保留活跃 Cursor 用户，同时推动 Codex 实验。',
        keyFindings: ['Cursor 成本压力是关键背景。'],
      }),
    });

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/ask',
      payload: {
        query: '为什么决定推 Codex 而不是继续 Cursor？这个决定是什么时候做出的？',
        includeEvidence: true,
      },
    });

    expect(res.statusCode).toBe(200);
    expect(recallSpy.mock.calls[0][0].lifecycleMode).toBe('historical');
    const body = res.json();
    const decisionBlock = body.blocks?.find(
      (block: any) => block.type === 'decision_evidence_chain',
    );

    expect(decisionBlock).toBeDefined();
    expect(decisionBlock.payload.chainType).toBe('why_decided');
    expect(decisionBlock.payload.decisionDetected).toBe(true);
    expect(decisionBlock.payload.decisionStatement).toContain('Cursor');
    expect(
      decisionBlock.payload.then.evidenceRefs.some(
        (ref: any) => ref.sourceId === 'decision-codex-base',
      ),
    ).toBe(true);
    expect(
      decisionBlock.payload.then.evidenceRefs.find(
        (ref: any) => ref.sourceId === 'decision-codex-base',
      )?.stance,
    ).toBe('supports');
    expect(
      decisionBlock.payload.now.changed.some((change: string) =>
        change.includes('Factory.ai'),
      ),
    ).toBe(true);
    expect(
      decisionBlock.payload.now.changed.some((change: string) =>
        change.includes('unblocked'),
      ),
    ).toBe(false);
    expect(decisionBlock.payload.saveCandidate).toBeDefined();
    recallSpy.mockRestore();
  });

  it('does not add a decision evidence chain block for ordinary ask queries', async () => {
    const recallSpy = vi
      .spyOn(RecallEngine.prototype, 'recall')
      .mockResolvedValueOnce({
        items: [
          {
            id: 'ordinary-ask-memory',
            type: 'message',
            content: 'John said the release risk is increasing.',
            score: 0.9,
            source: 'glip',
            timestamp: Math.floor(Date.now() / 1000) - 120,
          },
        ],
        totalFound: 1,
        channels: ['fts'],
        queryTimeMs: 1,
      } as any);
    generateMock.mockResolvedValue({
      content: JSON.stringify({
        answer: 'John said release risk is increasing.',
      }),
    });

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/ask',
      payload: {
        query: '最近 John 说过什么？',
      },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(
      body.blocks?.some((block: any) => block.type === 'decision_evidence_chain'),
    ).not.toBe(true);
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
        contextHints: {
          source: 'local_ask_resume_snapshot',
          localOnly: true,
          updatedAt: '2026-07-15T02:00:00.000Z',
          topicTitle: 'John release risk note',
          previousQuestion: 'John 最近提过什么风险？',
          previousAnswerSummary: '上一轮提到 release risk。',
          evidenceRefs: ['message:ask-john-message'],
        },
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
    const resultEvent = parseSseEvents(res.body).find(
      (event) => event.type === 'result',
    );
    expect(resultEvent?.continuityReceipt).toMatchObject({
      source: 'local_ask_resume_snapshot',
      localOnly: true,
      usedAsHint: true,
      reRetrieved: true,
    });
  });

  it('streams ambiguous Ask as a clarification state without generating an answer', async () => {
    const currentTime = Math.floor(Date.now() / 1000);
    const insertFrame = db.prepare(
      `INSERT INTO conversation_context_frames
        (id, surface, source_type, title, summary, dominant_projects_json,
         topics_json, role_terms_json, source_anchors_json, confidence,
         created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    );

    for (const project of ['AI Generated VBG', 'AI Notes']) {
      insertFrame.run(
        `ask-stream-ambiguous:${project}`,
        'glip',
        'glip',
        project,
        `${project} backend BE status is being discussed.`,
        JSON.stringify([project]),
        JSON.stringify([project]),
        JSON.stringify(['backend']),
        JSON.stringify([]),
        0.75,
        currentTime - 120,
        currentTime - 120,
      );
    }

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/ask/stream',
      payload: {
        query: '那个 BE ready 了吗？',
        includeEvidence: true,
      },
    });

    expect(res.statusCode).toBe(200);
    const events = parseSseEvents(res.body);
    const statusMessages = events
      .filter((event) => event.type === 'status')
      .map((event) => String(event.message ?? ''));
    const answerDone = events.find((event) => event.type === 'answer_done');
    const result = events.find((event) => event.type === 'result');

    expect(events.some((event) => event.type === 'delta')).toBe(false);
    expect(statusMessages).toContain('需要先确认你指的是哪个话题...');
    expect(statusMessages).not.toContain('正在生成回答...');
    expect(answerDone?.answer).toContain('候选话题：');
    expect(result?.contextMatch).toMatchObject({ state: 'ambiguous' });
    expect(result?.answerMemory).toMatchObject({
      state: 'skipped',
      skipReason: 'context_ambiguous',
      receipt: {
        label: '等待话题确认',
        tone: 'warning',
      },
    });
    expect(generateStreamMock).not.toHaveBeenCalled();
    expect(generateMock).not.toHaveBeenCalled();
  });

  it('streams decision evidence chain blocks during recall_done and final result', async () => {
    const now = Math.floor(Date.now() / 1000);
    const recallSpy = vi
      .spyOn(RecallEngine.prototype, 'recall')
      .mockResolvedValueOnce({
        items: [
          {
            id: 'stream-decision-base',
            type: 'message',
            content:
              'The team decided to keep active Cursor users unblocked while pushing Codex experimentation because Cursor cost pressure was high.',
            score: 0.96,
            source: 'glip',
            sourceTitle: 'AI tools migration discussion',
            timestamp: now - 86400,
            metadata: { sourceType: 'glip', sender: 'Fred' },
          },
          {
            id: 'stream-decision-change',
            type: 'message',
            content:
              'Factory.ai production approval changed, so the tool migration decision needs review.',
            score: 0.88,
            source: 'glip',
            sourceTitle: 'Factory.ai update',
            timestamp: now - 3600,
            metadata: { sourceType: 'glip', sender: 'Global P+T' },
          },
        ],
        totalFound: 2,
        channels: ['fts'],
        queryTimeMs: 1,
      } as any);
    generateStreamMock.mockImplementation(
      async (_prompt, _options, onDelta) => {
        await onDelta('当时是为了保留 Cursor 活跃用户，');
        await onDelta('同时推动 Codex 实验。');
        return {
          content: '当时是为了保留 Cursor 活跃用户，同时推动 Codex 实验。',
        };
      },
    );
    generateMock.mockResolvedValue({
      content: JSON.stringify({
        answer: '当时是为了保留 Cursor 活跃用户，同时推动 Codex 实验。',
      }),
    });

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/ask/stream',
      payload: {
        query: '为什么当时决定推 Codex 而不是继续 Cursor？',
        includeEvidence: true,
      },
    });

    expect(res.statusCode).toBe(200);
    const events = parseSseEvents(res.body);
    const recallDone = events.find((event) => event.type === 'recall_done');
    const result = events.find((event) => event.type === 'result');
    const recallBlocks = recallDone?.blocks as Array<Record<string, any>>;
    const resultBlocks = result?.blocks as Array<Record<string, any>>;

    expect(
      recallBlocks.some((block) => block.type === 'decision_evidence_chain'),
    ).toBe(true);
    expect(
      resultBlocks.some((block) => block.type === 'decision_evidence_chain'),
    ).toBe(true);
    recallSpy.mockRestore();
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

  it('keeps evaluationMode read_only free of actions and answer-memory writes', async () => {
    generateMock
      .mockResolvedValueOnce({
        resolutionState: 'partial',
        directFindings: ['John 提到 release risk 正在上升。'],
        resolvedConclusion: '需要补充外部系统中的具体发布时间。',
        remainingQuestions: ['具体发布日期尚未确认。'],
        candidateArtifacts: [],
        recommendedAction: 'delegate_openclaw',
        actionParams: {
          task: '核实 release 的具体发布日期。',
          mode: 'read',
          targetSystem: 'jira',
        },
        confidence: 0.86,
        legacyClassification: 'answer',
        summary: '本地证据不足，需要外部查证。',
      })
      .mockResolvedValueOnce({
        content: JSON.stringify({
          answer: 'John 提到 release risk 正在上升，具体发布日期仍未确认。',
          confidence: 0.8,
        }),
      });

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/ask',
      payload: {
        query: 'release 的具体发布日期是什么？',
        includeEvidence: true,
        evaluationMode: 'read_only',
      },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.answer).toContain('具体发布日期');
    expect(body.resolutionState).toBe('partial');
    expect(body.followUpActions).toBeUndefined();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(
      db.prepare('SELECT COUNT(*) AS count FROM proposed_actions').get(),
    ).toMatchObject({ count: 0 });
    expect(
      db.prepare('SELECT COUNT(*) AS count FROM answer_memory_observations').get(),
    ).toMatchObject({ count: 0 });
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
