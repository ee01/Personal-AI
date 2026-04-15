import { describe, expect, it, vi } from 'vitest';

vi.mock('../llm/LLMClient.js', () => ({
  getLLMClient: () => ({
    generateJSON: async () => ({
      local_queries: [
        {
          query: '最近有哪些协作阻塞？',
          topK: 4,
          purpose: '收集最近的协作证据',
        },
      ],
    }),
  }),
}));

import { ReflectionResearcher } from '../core/ReflectionResearcher.js';

describe('ReflectionResearcher', () => {
  it('defaults local research sourceTypes to non-meeting sources', async () => {
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
    expect(queries[0].sourceTypes).toEqual([
      'glip',
      'jira',
      'web',
      'manual',
      'system',
    ]);
  });
});
