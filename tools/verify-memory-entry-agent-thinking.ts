import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  buildAgentToolCallKey,
  IntelligentAgent,
} from '../src/agentThinking.ts';
import {
  buildAgentFlowSteps,
  getStepKind,
  getStepSummary,
  getToolStepResultPresentation,
} from '../src/agentVisualizerPresentation.ts';
import { buildRuntimeWatchRules } from '../src/watchRules.ts';
import type { TopicItemWithAutoReply } from '../src/message-reaction/AutoReplyHandler.ts';
import type { OutreachSession } from '../src/services/MemoryServiceClient.ts';

const storage: Record<string, any> = {
  envConfig: {
    ANALYZE_BY_GROUP: true,
    LLM_TYPE: 'local',
    OLLAMA_BASE_URL: 'http://mock-ollama',
    OLLAMA_MODEL: 'mock-model',
    OLLAMA_QUERY_MODEL: 'mock-model',
  },
};

const recallQueries: string[] = [];
let ollamaGenerateCount = 0;

function installChromeMock() {
  const local = {
    async get(
      keys: string | string[],
      callback?: (result: Record<string, any>) => void,
    ) {
      let result: Record<string, any>;
      if (Array.isArray(keys)) {
        result = Object.fromEntries(keys.map((key) => [key, storage[key]]));
      } else {
        result = { [keys]: storage[keys] };
      }
      if (callback) callback(result);
      return result;
    },
  };

  (globalThis as any).chrome = {
    storage: {
      local,
      onChanged: {
        addListener() {
          return undefined;
        },
        removeListener() {
          return undefined;
        },
      },
    },
    runtime: {
      sendMessage(
        _message: unknown,
        callback?: (response: Record<string, any>) => void,
      ) {
        callback?.({ success: true, data: {} });
        return Promise.resolve({ success: true, data: {} });
      },
    },
  };
}

function installFetchMock() {
  (globalThis as any).fetch = async (
    input: string | URL,
    init?: RequestInit,
  ) => {
    const url = String(input);
    const body = init?.body ? JSON.parse(String(init.body)) : {};
      const prompt = String(body?.prompt || '');

      if (url.startsWith('http://localhost:3210/api/v1/recall')) {
        recallQueries.push(String(body?.query || ''));
      return new Response(
        JSON.stringify({
          items: [
            {
              id: `memory-${recallQueries.length}`,
              type: 'message',
              content: `remembered ${body?.query || 'context'}`,
              score: 0.91,
              metadata: {
                summary: `memory summary ${recallQueries.length}`,
                sender: 'Memory Service',
              },
            },
          ],
          totalFound: 1,
          queryTimeMs: 3,
          channels: ['vector'],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );
    }

    if (url.startsWith('http://mock-ollama/api/generate')) {
      ollamaGenerateCount += 1;

      if (prompt.includes('invalid tool guard')) {
        return new Response(
          JSON.stringify({
            response: JSON.stringify([
              {
                post_id: 'post-thinking-guard',
                summary: '需要验证无效工具调用会被阻断',
                importanceLevel: 'low',
                needsProcessing: true,
                isNoiseMessage: false,
                matchedRuleRefs: [],
                matchedRuleIds: [],
                matchedRules: [],
                thought: '尝试调用未注册工具和缺少必填参数的工具。',
                nextAction: 'use_tool',
                tools: [
                  {
                    id: 'orgStructure',
                    params: {
                      person: 'Morgan',
                    },
                  },
                  {
                    id: 'historySearch',
                    params: {
                      limit: 1,
                    },
                  },
                ],
                shouldStore: false,
                shouldNotify: false,
                confidence: 0.6,
                user_relation_type: 'general_interest',
                entities: {},
              },
            ]),
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      }

      if (
        prompt.includes('duplicate history probe') ||
        ollamaGenerateCount === 3
      ) {
        return new Response(
          JSON.stringify({
            response: JSON.stringify([
              {
                post_id: 'post-thinking-budget',
                summary: '需要多次历史检索来验证工具结果记录',
                importanceLevel: 'low',
                needsProcessing: true,
                isNoiseMessage: false,
                matchedRuleRefs: [],
                matchedRuleIds: [],
                matchedRules: [],
                thought: '需要查询两组历史上下文，其中一次是重复参数。',
                nextAction: 'use_tool',
                tools: [
                  {
                    id: 'historySearch',
                    params: {
                      content: 'duplicate history probe',
                      customQuery: 'alpha context',
                      limit: 1,
                    },
                  },
                  {
                    id: 'historySearch',
                    params: {
                      content: 'duplicate history probe',
                      customQuery: 'beta context',
                      limit: 1,
                    },
                  },
                  {
                    id: 'historySearch',
                    params: {
                      limit: 1,
                      customQuery: 'alpha context',
                      content: 'duplicate history probe',
                    },
                  },
                ],
                shouldStore: false,
                shouldNotify: false,
                confidence: 0.65,
                user_relation_type: 'general_interest',
                entities: {},
              },
            ]),
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      }

      if (prompt.includes('关注规则')) {
        return new Response(
          JSON.stringify({
            response: JSON.stringify([
              {
                post_id: 'post-thinking-1',
                summary: 'agentThinking 命中 outreach system rule',
                importanceLevel: 'low',
                needsProcessing: true,
                isNoiseMessage: false,
                matchedRuleRefs: ['outreach:session-before-followup'],
                matchedRuleIds: [0],
                matchedRules: ['[RULE_REF:outreach:session-before-followup]'],
                nextAction: 'finish',
                tools: [],
                shouldStore: true,
                shouldNotify: false,
                confidence: 0.88,
                user_relation_type: 'general_interest',
                entities: {},
              },
              {
                post_id: 'post-thinking-2',
                summary: '普通状态更新，无需通知',
                importanceLevel: 'low',
                needsProcessing: true,
                isNoiseMessage: false,
                matchedRuleRefs: [],
                matchedRuleIds: [],
                matchedRules: [],
                nextAction: 'finish',
                tools: [],
                shouldStore: false,
                shouldNotify: false,
                confidence: 0.72,
                user_relation_type: 'general_interest',
                entities: {},
              },
            ]),
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      }

      return new Response(
        JSON.stringify({
          response: JSON.stringify({
            thought: 'done',
            nextAction: 'finish',
            tools: [],
          }),
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );
    }

    throw new Error(`Unexpected fetch ${url}`);
  };
}

async function main() {
  installChromeMock();
  installFetchMock();

  const manualItems: TopicItemWithAutoReply[] = [
    {
      id: 'manual-1',
      text: 'Only notify me when blocker is mentioned',
      expiredAt: 0,
      notifyMethod: 'bot',
    },
  ];
  const outreachSessions: OutreachSession[] = [
    {
      id: 'session-before-followup',
      targetType: 'group',
      targetRef: 'sdk-updates',
      renderedQuestion: 'migration guide 发布了吗？',
      status: 'waiting_reply',
      requiresApproval: false,
      followupCount: 0,
      maxFollowup: 2,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    },
  ];

  const concernedRules = buildRuntimeWatchRules({
    manualItems,
    outreachSessions,
  });

  const agent = new IntelligentAgent();
  const catalog = agent.getToolCatalog();
  const toolIds = catalog.map((tool) => tool.id).sort();

  assert.deepEqual(toolIds, ['historySearch', 'jiraQuery']);
  assert.equal(
    buildAgentToolCallKey({
      id: 'historySearch',
      params: {
        limit: 5,
        content: 'project update',
        people: ['Pat'],
      },
    }),
    buildAgentToolCallKey({
      id: 'historySearch',
      params: {
        people: ['Pat'],
        content: 'project update',
        limit: 5,
      },
    }),
  );

  const optionsSource = readFileSync('src/options.tsx', 'utf8');
  assert.ok(!optionsSource.includes("toolUsed: 'entityExtractor'"));
  assert.ok(!optionsSource.includes("toolUsed: 'orgChart'"));
  assert.ok(optionsSource.includes("const historyToolId = 'historySearch'"));
  assert.ok(optionsSource.includes("const jiraToolId = 'jiraQuery'"));
  const agentThinkingSource = readFileSync('src/agentThinking.ts', 'utf8');
  assert.ok(!agentThinkingSource.includes('考虑使用orgStructure'));
  assert.ok(agentThinkingSource.includes('已阻断调用'));
  const agentVisualizerSource = readFileSync('src/agent-visualizer.tsx', 'utf8');
  assert.ok(agentVisualizerSource.includes('agentVisualizerPresentation'));
  assert.ok(agentVisualizerSource.includes('role="button"'));
  assert.ok(agentVisualizerSource.includes('aria-expanded'));
  const agentVisualizerPresentationSource = readFileSync(
    'src/agentVisualizerPresentation.ts',
    'utf8',
  );
  assert.ok(agentVisualizerPresentationSource.includes('stepHasToolBlocked'));
  assert.ok(agentVisualizerPresentationSource.includes('已阻断'));
  const agentVisualizerCss = readFileSync('static/agent-visualizer.css', 'utf8');
  assert.ok(agentVisualizerCss.includes('.flow-node.tool.blocked'));
  assert.ok(agentVisualizerCss.includes('.node-result.blocked'));

  const timestamp = Date.parse('2026-05-08T00:00:00.000Z');
  const blockedStep = {
    timestamp,
    thought: '工具未注册',
    action: 'use_tool',
    toolUsed: 'orgStructure',
    toolResult: JSON.stringify({
      orgStructure: {
        blocked: true,
        message: '工具 orgStructure 未注册，已阻断调用。',
      },
    }),
  };
  assert.equal(getStepKind(blockedStep), '已阻断');
  assert.equal(
    getStepSummary(blockedStep),
    'orgStructure 未通过工具校验，已阻断执行。',
  );
  assert.deepEqual(getToolStepResultPresentation(blockedStep), {
    label: '已阻断',
    className: 'blocked',
  });

  const mixedSkippedStep = {
    timestamp: timestamp + 1000,
    thought: '重复查询',
    action: 'use_tool',
    toolUsed: 'historySearch, historySearch',
    toolResult: JSON.stringify({
      historySearch: [
        {
          message: '已获得历史消息',
          result: [{ summary: '记忆摘要' }],
        },
        {
          skipped: true,
          message: '已跳过重复工具调用',
        },
      ],
    }),
  };
  assert.equal(getStepKind(mixedSkippedStep), '部分跳过');
  assert.deepEqual(getToolStepResultPresentation(mixedSkippedStep), {
    label: '部分跳过',
    className: 'partial',
  });

  const errorStep = {
    timestamp: timestamp + 2000,
    thought: '工具失败',
    action: 'use_tool',
    toolUsed: 'jiraQuery',
    toolResult: JSON.stringify({
      jiraQuery: {
        error: 'JIRA API 查询失败',
      },
    }),
  };
  assert.equal(getStepKind(errorStep), '失败');
  assert.equal(getToolStepResultPresentation(errorStep).className, 'error');

  const flowSteps = buildAgentFlowSteps(
    [blockedStep, mixedSkippedStep, errorStep],
    (time) => String(time),
  );
  assert.deepEqual(
    flowSteps
      .filter((step) => step.type === 'tool')
      .map((step) => `${step.name}:${step.result}:${step.resultClass}`),
    [
      'orgStructure:已阻断:blocked',
      'historySearch, historySearch:部分跳过:partial',
      'jiraQuery:失败:error',
    ],
  );

  const completedGroups: any[][] = [];
  const result = await agent.analyze(
    {
      groupName: 'SDK Updates',
      groupId: 'team-1',
      posts: [
        {
          content: 'migration guide draft is ready',
          sender: 'James Lee',
          datetime: '2026-04-15T00:00:00.000Z',
          post_id: 'post-thinking-1',
        },
        {
          content: 'daily status is green',
          sender: 'Pat Smith',
          datetime: '2026-04-15T00:01:00.000Z',
          post_id: 'post-thinking-2',
        },
      ],
    },
    {
      type: 'message',
      analysisDepth: 'normal',
      maxActions: 1,
    },
    {
      currentUser: 'Current User',
      concernedRules,
      groupInfo: {
        id: 'team-1',
        name: 'SDK Updates',
        members: [],
      },
    },
    (groupResults) => {
      completedGroups.push(groupResults);
    },
  );

  assert.ok(Array.isArray(result));
  assert.equal(result.length, 2);
  console.log('agentThinking result', result[0]);
  assert.deepEqual(result[0].matchedRuleRefs, [
    'outreach:session-before-followup',
  ]);
  assert.deepEqual(result[0].matchedRuleIds, [0]);
  assert.equal(result[0].shouldStore, true);
  assert.equal(result[0].shouldNotify, false);
  assert.equal(result[1].postId, 'post-thinking-2');
  assert.equal(result[1].shouldStore, false);
  assert.equal(completedGroups.length, 1);
  assert.equal(completedGroups[0].length, 2);

  const singleResult = await agent.analyze(
    {
      content: 'single message without explicit context',
      sender: 'Morgan',
      post_id: 'post-thinking-single',
    },
    {
      type: 'message',
      analysisDepth: 'normal',
      maxActions: 1,
    },
  );

  assert.ok(!Array.isArray(singleResult));
  assert.equal(singleResult.postId, 'post-thinking-single');

  const budgetResult = await agent.analyze(
    {
      content: 'duplicate history probe',
      sender: 'Morgan',
      post_id: 'post-thinking-budget',
    },
    {
      type: 'message',
      analysisDepth: 'normal',
      maxActions: 1,
    },
  );

  assert.ok(!Array.isArray(budgetResult));
  assert.equal(recallQueries.length, 2);
  assert.ok(
    budgetResult.thoughtProcess?.some(
      (step) => step.action === 'max_actions_reached',
    ),
  );

  const toolStep = budgetResult.thoughtProcess?.find(
    (step) => step.toolUsed === 'historySearch, historySearch, historySearch',
  );
  assert.ok(toolStep?.toolResult);
  const toolResult = JSON.parse(toolStep.toolResult);
  assert.ok(Array.isArray(toolResult.historySearch));
  assert.equal(toolResult.historySearch.length, 3);
  assert.equal(toolResult.historySearch[2].skipped, true);

  const recallCountBeforeGuard = recallQueries.length;
  const guardResult = await agent.analyze(
    {
      content: 'invalid tool guard',
      sender: 'Morgan',
      post_id: 'post-thinking-guard',
    },
    {
      type: 'message',
      analysisDepth: 'normal',
      maxActions: 1,
    },
  );

  assert.ok(!Array.isArray(guardResult));
  assert.equal(recallQueries.length, recallCountBeforeGuard);
  const guardToolStep = guardResult.thoughtProcess?.find(
    (step) => step.toolUsed === 'orgStructure, historySearch',
  );
  assert.ok(guardToolStep?.toolResult);
  const guardToolResult = JSON.parse(guardToolStep.toolResult);
  assert.equal(guardToolResult.orgStructure.blocked, true);
  assert.match(guardToolResult.orgStructure.message, /未注册/);
  assert.equal(guardToolResult.historySearch.blocked, true);
  assert.match(guardToolResult.historySearch.message, /缺少必填参数 content/);

  console.log('verify-memory-entry-agent-thinking: ok');
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
