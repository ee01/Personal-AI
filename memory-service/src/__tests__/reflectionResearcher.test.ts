import { beforeEach, describe, expect, it, vi } from 'vitest';

const llmMocks = vi.hoisted(() => ({
  generateJSON: vi.fn(),
}));

vi.mock('../llm/LLMClient.js', () => ({
  getLLMClient: () => ({
    generateJSON: llmMocks.generateJSON,
  }),
}));

import { ReflectionResearcher } from '../core/ReflectionResearcher.js';

const expectedDefaultLocalSources = [
  'glip',
  'jira',
  'web',
  'manual',
  'system',
  'source_memory',
  'user_core',
  'markdown',
  'reflection',
  'reflection_thread',
  'rehearsal',
  'daily_log',
  'project_summary',
  'entity_profile',
];

describe('ReflectionResearcher', () => {
  beforeEach(() => {
    llmMocks.generateJSON.mockReset();
    llmMocks.generateJSON.mockResolvedValue({
      local_queries: [
        {
          query: '最近有哪些协作阻塞？',
          topK: 4,
          purpose: '收集最近的协作证据',
        },
      ],
    });
  });

  it('defaults local research sourceTypes to local Personal AI evidence sources', async () => {
    const researcher = new ReflectionResearcher(undefined);
    const queries = await researcher.plan(
      {
        id: 'thread-1',
        topicKey: 'reflection:team-collaboration',
        title: '团队协作反思',
        status: 'active',
        priority: 5,
        salience: 0.8,
        sourceType: 'ask',
        sourceRefId: null,
        currentHypothesis: null,
        openQuestions: [],
        latestSummary: '',
        latestMarkdownPath: null,
        nextReflectionAt: 0,
        createdAt: 0,
        updatedAt: 0,
        lastReflectedAt: null,
        continueReason: null,
      },
      [],
      [],
    );

    expect(queries).toHaveLength(1);
    expect(queries[0].sourceTypes).toEqual(expectedDefaultLocalSources);
    expect(queries[0].sourceTypes).not.toContain('meeting');
    expect(queries[0].sourceTypes).not.toContain('calendar');
    expect(queries[0].sourceTypes).not.toContain('ai_chat');
  });

  it('sanitizes sourceTypes returned by the research planner', async () => {
    llmMocks.generateJSON.mockResolvedValueOnce({
      local_queries: [
        {
          query: 'Orbit release risk',
          topK: 99,
          purpose: '确认 Orbit 风险证据',
          sourceTypes: [
            'glip',
            'unsupported_slack',
            'source_memory',
            'jira',
            'glip',
          ],
        },
      ],
    });

    const researcher = new ReflectionResearcher(undefined);
    const queries = await researcher.plan(
      {
        id: 'thread-1',
        topicKey: 'project:orbit',
        title: '项目反思: Orbit',
        status: 'active',
        priority: 5,
        salience: 0.8,
        sourceType: 'message',
        sourceRefId: null,
        currentHypothesis: null,
        openQuestions: [],
        latestSummary: '',
        latestMarkdownPath: null,
        nextReflectionAt: 0,
        createdAt: 0,
        updatedAt: 0,
        lastReflectedAt: null,
        continueReason: null,
      },
      [],
      [],
    );

    expect(queries).toHaveLength(1);
    expect(queries[0].topK).toBe(8);
    expect(queries[0].sourceTypes).toEqual([
      'glip',
      'source_memory',
      'jira',
    ]);
    expect(queries[0].requestedSourceTypes).toEqual([
      'glip',
      'unsupported_slack',
      'source_memory',
      'jira',
    ]);
    expect(queries[0].rejectedSourceTypes).toEqual(['unsupported_slack']);
    expect(queries[0].scopeNotice).toContain('研究范围已裁剪');
    expect(queries[0].scopeNotice).toContain('unsupported_slack');
  });

  it('falls back to default local sources when every requested sourceType is unsupported', async () => {
    llmMocks.generateJSON.mockResolvedValueOnce({
      local_queries: [
        {
          query: 'Orbit source of truth',
          topK: 3,
          purpose: '确认 Orbit 真实来源',
          sourceTypes: ['salesforce', 'notion_private'],
        },
      ],
    });

    const researcher = new ReflectionResearcher(undefined);
    const queries = await researcher.plan(
      {
        id: 'thread-1',
        topicKey: 'project:orbit',
        title: '项目反思: Orbit',
        status: 'active',
        priority: 5,
        salience: 0.8,
        sourceType: 'message',
        sourceRefId: null,
        currentHypothesis: null,
        openQuestions: [],
        latestSummary: '',
        latestMarkdownPath: null,
        nextReflectionAt: 0,
        createdAt: 0,
        updatedAt: 0,
        lastReflectedAt: null,
        continueReason: null,
      },
      [],
      [],
    );

    expect(queries).toHaveLength(1);
    expect(queries[0].sourceTypes).toEqual(expectedDefaultLocalSources);
    expect(queries[0].requestedSourceTypes).toEqual([
      'salesforce',
      'notion_private',
    ]);
    expect(queries[0].rejectedSourceTypes).toEqual([
      'salesforce',
      'notion_private',
    ]);
    expect(queries[0].scopeNotice).toContain('已改用默认本地来源');
  });

  it('falls back to a deterministic local query when the planner fails', async () => {
    llmMocks.generateJSON.mockRejectedValueOnce(new Error('planner timeout'));

    const researcher = new ReflectionResearcher(undefined);
    const queries = await researcher.plan(
      {
        id: 'thread-1',
        topicKey: 'project:orbit',
        title: '项目反思: Orbit',
        status: 'active',
        priority: 7,
        salience: 0.86,
        sourceType: 'message',
        sourceRefId: null,
        currentHypothesis: 'Orbit owner 可能是 Platform Team',
        openQuestions: ['Orbit owner 是否已经稳定？'],
        latestSummary: '',
        latestMarkdownPath: null,
        nextReflectionAt: 0,
        createdAt: 0,
        updatedAt: 0,
        lastReflectedAt: null,
        continueReason: null,
      },
      [],
      [],
    );

    expect(queries).toHaveLength(1);
    expect(queries[0]).toMatchObject({
      topK: 5,
      sourceTypes: expectedDefaultLocalSources,
    });
    expect(queries[0].query).toContain('项目反思: Orbit');
    expect(queries[0].query).toContain('Orbit owner 是否已经稳定？');
    expect(queries[0].purpose).toContain(
      'Orbit owner 是否已经稳定？',
    );
  });
});
