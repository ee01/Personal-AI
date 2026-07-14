import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  buildAgentToolCallKey,
  IntelligentAgent,
  registerTool,
} from '../src/agentThinking.ts';
import { MESSAGE_ANALYSIS_RULE_DIAGNOSTICS_KEY } from '../src/messageAnalysisRuleDiagnostics.ts';
import {
  buildAgentRunDiagnosticPacket,
  buildAgentRunSnapshot,
  buildAgentDiagnosticCopyScope,
  buildAgentDiagnosticCopyPreflight,
  buildAgentDiagnosticCopiedSnapshot,
  buildAgentDiagnosticCopyFreshnessReceipt,
  buildAgentDiagnosticCopySuccessReceipt,
  buildAgentTraceReviewLane,
  buildPendingApprovalActions,
  buildAgentRunReviewItems,
  buildAgentFlowSteps,
  formatApprovalEffect,
  formatApprovalRisk,
  getAgentRunReviewSeverity,
  getStepDiagnosticSummary,
  getStepIntentSummary,
  getStepKind,
  getStepSummary,
  getStepVisibleSummary,
  stepHasToolApprovalRequired,
  stepHasEmptyToolEvidence,
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
    async set(values: Record<string, any>, callback?: () => void) {
      Object.assign(storage, values);
      callback?.();
      return undefined;
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

      if (prompt.includes('blocked notification side effect regression')) {
        return new Response(
          JSON.stringify({
            response: JSON.stringify([
              {
                post_id: 'post-thinking-blocked-notify',
                summary: '未注册通知工具不应污染最终通知决策',
                importanceLevel: 'low',
                needsProcessing: true,
                isNoiseMessage: false,
                matchedRuleRefs: [],
                matchedRuleIds: [],
                matchedRules: [],
                thought: '模型尝试调用通知工具，但该工具当前未注册。',
                nextAction: 'use_tool',
                tools: [
                  {
                    id: 'messageNotification',
                    params: {
                      channel: 'project-alerts',
                      message: 'blocked notification side effect regression',
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

      if (prompt.includes('standalone-only regression')) {
        return new Response(
          JSON.stringify({
            response: JSON.stringify([
              {
                post_id: 'post-thinking-standalone',
                summary: 'standalone-only regression 命中记忆入口规则',
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
                confidence: 0.9,
                user_relation_type: 'general_interest',
                entities: {},
              },
            ]),
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      }

      if (prompt.includes('Daily Standup') && prompt.includes('blocker update')) {
        return new Response(
          JSON.stringify({
            response: JSON.stringify([
              {
                post_id: 'post-thinking-out-of-scope',
                summary: 'LLM hallucinated a release-only rule match',
                importanceLevel: 'high',
                needsProcessing: true,
                isNoiseMessage: false,
                matchedRuleRefs: ['manual:release-only'],
                matchedRuleIds: [],
                matchedRules: ['[RULE_REF:manual:release-only] Release blockers'],
                nextAction: 'finish',
                tools: [],
                shouldStore: true,
                shouldNotify: true,
                confidence: 0.91,
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
  const outreachBaselineAt = Math.floor(
    Date.parse('2026-04-14T23:00:00.000Z') / 1000,
  );

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
      createdAt: outreachBaselineAt,
      updatedAt: outreachBaselineAt,
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
  assert.deepEqual(
    catalog.map((tool) => [
      tool.id,
      tool.effect,
      tool.riskLevel,
      tool.requiresHumanApproval,
    ]),
    [
      ['historySearch', 'read', 'low', false],
      ['jiraQuery', 'external_read', 'low', false],
    ],
  );
  assert.ok(
    agent
      .getToolDescriptions()
      .some((description) => description.includes('安全: 只读 / 低风险 / 无需人工确认')),
  );
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
  assert.ok(optionsSource.includes('安全边界'));
  assert.ok(optionsSource.includes('tool.requiresHumanApproval'));
  assert.ok(optionsSource.includes('approval-tail-token-visible-in-ui'));
  const agentThinkingSource = readFileSync('src/agentThinking.ts', 'utf8');
  assert.ok(!agentThinkingSource.includes('考虑使用orgStructure'));
  assert.ok(agentThinkingSource.includes('已阻断调用'));
  assert.ok(agentThinkingSource.includes('publicSummary'));
  assert.ok(agentThinkingSource.includes('工具安全规则'));
  assert.ok(agentThinkingSource.includes('需要人工确认'));
  assert.ok(agentThinkingSource.includes('批准 key 必须精确匹配'));
  assert.ok(!agentThinkingSource.includes('详细解释你的思考过程'));
  assert.ok(!agentThinkingSource.includes('分析当前情况和下一步行动的详细思考过程'));
  const agentVisualizerSource = readFileSync('src/agent-visualizer.tsx', 'utf8');
  assert.ok(agentVisualizerSource.includes('agentVisualizerPresentation'));
  assert.ok(agentVisualizerSource.includes('role="button"'));
  assert.ok(agentVisualizerSource.includes('aria-expanded'));
  assert.ok(agentVisualizerSource.includes('决策摘要:'));
  assert.ok(agentVisualizerSource.includes('调用意图:'));
  assert.ok(agentVisualizerSource.includes('状态说明:'));
  assert.ok(agentVisualizerSource.includes('运行检查'));
  assert.ok(agentVisualizerSource.includes('待确认动作'));
  assert.ok(agentVisualizerSource.includes('复制 key'));
  assert.ok(agentVisualizerSource.includes('复制审核包'));
  assert.ok(agentVisualizerSource.includes('复制重跑配置'));
  assert.ok(agentVisualizerSource.includes('重跑配置回执'));
  assert.ok(agentVisualizerSource.includes('待确认动作未执行'));
  assert.ok(agentVisualizerSource.includes('pending-notify'));
  assert.ok(agentVisualizerSource.includes('node-detail'));
  assert.ok(agentVisualizerSource.includes('AGENT_TRACE_JUMP_EVENT'));
  assert.ok(agentVisualizerSource.includes('node-step-index'));
  assert.ok(agentVisualizerSource.includes('跳到时间线步骤'));
  assert.ok(agentVisualizerSource.includes('复制诊断包'));
  assert.ok(agentVisualizerSource.includes('诊断包复制预检'));
  assert.ok(agentVisualizerSource.includes('诊断包范围'));
  assert.ok(agentVisualizerSource.includes('buildAgentDiagnosticCopyPreflight'));
  assert.ok(agentVisualizerSource.includes('agent-run-diagnostic-scope'));
  assert.ok(agentVisualizerSource.includes('agent-run-diagnostic-preflight'));
  assert.ok(agentVisualizerSource.includes('buildAgentDiagnosticCopyScope'));
  assert.ok(agentVisualizerSource.includes('buildAgentRunSnapshot'));
  assert.ok(agentVisualizerSource.includes('buildAgentTraceReviewLane'));
  assert.ok(agentVisualizerSource.includes('agent-trace-review-lane'));
  assert.ok(agentVisualizerSource.includes('agent-trace-navigation-receipt'));
  assert.ok(agentVisualizerSource.includes('当前 trace 导航'));
  assert.ok(agentVisualizerSource.includes('buildAgentTraceStepButtonBoundary'));
  assert.ok(agentVisualizerSource.includes('复核理由：'));
  assert.ok(agentVisualizerSource.includes('只展开并聚焦当前页面时间线'));
  assert.ok(agentVisualizerSource.includes('agent-trace-span-composition-steps'));
  assert.ok(agentVisualizerSource.includes('agent-run-summary-chip'));
  assert.ok(agentVisualizerSource.includes('agent-result-handoff-receipt'));
  assert.ok(agentVisualizerSource.includes('agent-result-handoff-steps'));
  assert.ok(agentVisualizerSource.includes('从结果整理回执跳到终止步骤'));
  assert.ok(agentVisualizerSource.includes('结果整理中...'));
  assert.ok(agentVisualizerSource.includes('identityBoundary'));
  assert.ok(agentVisualizerSource.includes('freshnessBoundary'));
  assert.ok(agentVisualizerSource.includes('复制失败，请手动选择 key'));
  assert.ok(agentVisualizerSource.includes('复制失败，请手动选择审核包'));
  assert.ok(agentVisualizerSource.includes('复制失败，请手动选择重跑配置'));
  assert.ok(agentVisualizerSource.includes('复制失败，请手动选择诊断包'));
  assert.ok(agentVisualizerSource.includes('agent-run-diagnostic-manual-copy'));
  assert.ok(agentVisualizerSource.includes('agent-approval-manual-copy'));
  assert.ok(agentVisualizerSource.includes('agent-approval-copy-receipt'));
  assert.ok(agentVisualizerSource.includes('当前审批复制回执'));
  assert.ok(agentVisualizerSource.includes('旧审批复制回执'));
  assert.ok(agentVisualizerSource.includes('复制只产生本地文本'));
  assert.ok(agentVisualizerSource.includes('agent-approval-queue-receipt'));
  assert.ok(agentVisualizerSource.includes('待确认队列口径'));
  assert.ok(agentVisualizerSource.includes('agent-approval-decision-guide'));
  assert.ok(!agentVisualizerSource.includes('思考过程:'));
  const agentVisualizerPresentationSource = readFileSync(
    'src/agentVisualizerPresentation.ts',
    'utf8',
  );
  assert.ok(agentVisualizerPresentationSource.includes('stepHasToolBlocked'));
  assert.ok(agentVisualizerPresentationSource.includes('已阻断'));
  assert.ok(agentVisualizerPresentationSource.includes('getStepVisibleSummary'));
  assert.ok(agentVisualizerPresentationSource.includes('getStepDiagnosticSummary'));
  assert.ok(agentVisualizerPresentationSource.includes('buildAgentRunReviewItems'));
  assert.ok(agentVisualizerPresentationSource.includes('stepHasEmptyToolEvidence'));
  assert.ok(agentVisualizerPresentationSource.includes('证据不足'));
  assert.ok(agentVisualizerPresentationSource.includes('stepHasToolApprovalRequired'));
  assert.ok(agentVisualizerPresentationSource.includes('需要人工确认'));
  assert.ok(agentVisualizerPresentationSource.includes('buildPendingApprovalActions'));
  assert.ok(agentVisualizerPresentationSource.includes('buildAgentApprovalQueueReceipt'));
  assert.ok(agentVisualizerPresentationSource.includes('buildApprovalReviewHint'));
  assert.ok(agentVisualizerPresentationSource.includes('buildApprovalDecisionGuide'));
  assert.ok(agentVisualizerPresentationSource.includes('retryConfigPatch'));
  assert.ok(agentVisualizerPresentationSource.includes('retryReceipt'));
  assert.ok(agentVisualizerPresentationSource.includes('detail?: string'));
  assert.ok(agentVisualizerPresentationSource.includes('stepIndex?: number'));
  assert.ok(agentVisualizerPresentationSource.includes('buildAgentRunDiagnosticPacket'));
  assert.ok(agentVisualizerPresentationSource.includes('buildAgentRunSnapshot'));
  assert.ok(agentVisualizerPresentationSource.includes('buildAgentTraceReviewLane'));
  assert.ok(agentVisualizerPresentationSource.includes('Trace 复核路线'));
  assert.ok(agentVisualizerPresentationSource.includes('待确认队列口径'));
  assert.ok(agentVisualizerPresentationSource.includes('buildAgentTraceNavigationReceipt'));
  assert.ok(agentVisualizerPresentationSource.includes('当前 trace 导航'));
  assert.ok(agentVisualizerPresentationSource.includes('buildAgentDiagnosticCopyScope'));
  assert.ok(agentVisualizerPresentationSource.includes('buildAgentDiagnosticCopyPreflight'));
  assert.ok(agentVisualizerPresentationSource.includes('buildAgentDiagnosticCopySuccessReceipt'));
  assert.ok(agentVisualizerPresentationSource.includes('agent_thinking_run_diagnostics'));
  assert.ok(agentVisualizerPresentationSource.includes('traceSpans'));
  assert.ok(agentVisualizerPresentationSource.includes('traceIdentity'));
  assert.ok(agentVisualizerPresentationSource.includes('fnv1a32-local'));
  assert.ok(agentVisualizerPresentationSource.includes('本地 trace id'));
  assert.ok(agentVisualizerPresentationSource.includes('snapshotBoundary'));
  assert.ok(agentVisualizerPresentationSource.includes('resultHandoffReceipt'));
  assert.ok(agentVisualizerPresentationSource.includes('buildAgentResultHandoffReceipt'));
  assert.ok(agentVisualizerPresentationSource.includes('navigationReceipt'));
  assert.ok(agentVisualizerPresentationSource.includes('current_page_trace_snapshot'));
  assert.ok(agentVisualizerPresentationSource.includes('gen_ai.operation.name'));
  assert.ok(agentVisualizerPresentationSource.includes('不是 OpenTelemetry / LangSmith / Langfuse 标准导出'));
  const agentVisualizerCss = readFileSync('static/agent-visualizer.css', 'utf8');
  assert.ok(agentVisualizerCss.includes('.flow-node.tool.blocked'));
  assert.ok(agentVisualizerCss.includes('.agent-trace-navigation-receipt'));
  assert.ok(agentVisualizerCss.includes('.agent-run-summary-chip'));
  assert.ok(agentVisualizerCss.includes('.processing-indicator.finalizing'));
  assert.ok(agentVisualizerCss.includes('.agent-result-handoff-receipt'));
  assert.ok(agentVisualizerCss.includes('.agent-result-handoff-steps'));
  assert.ok(agentVisualizerCss.includes('.agent-trace-review-lane'));
  assert.ok(agentVisualizerCss.includes('.agent-trace-review-lane-item'));
  assert.ok(agentVisualizerCss.includes('.agent-trace-span-composition-steps'));
  assert.ok(agentVisualizerCss.includes('.flow-node.jumpable'));
  assert.ok(agentVisualizerCss.includes('.node-result.blocked'));
  assert.ok(agentVisualizerCss.includes('.node-detail'));
  assert.ok(agentVisualizerCss.includes('.node-step-index'));
  assert.ok(agentVisualizerCss.includes('.flow-node.tool.empty'));
  assert.ok(agentVisualizerCss.includes('.node-result.empty'));
  assert.ok(agentVisualizerCss.includes('.flow-node.tool.approval'));
  assert.ok(agentVisualizerCss.includes('.node-result.approval'));
  assert.ok(agentVisualizerCss.includes('.diagnostic-content'));
  assert.ok(agentVisualizerCss.includes('.agent-run-review'));
  assert.ok(agentVisualizerCss.includes('.agent-run-review-step-links'));
  assert.ok(agentVisualizerCss.includes('.agent-approval-queue'));
  assert.ok(agentVisualizerCss.includes('.agent-approval-review-hint'));
  assert.ok(agentVisualizerCss.includes('.agent-approval-policy-note'));
  assert.ok(agentVisualizerCss.includes('.agent-approval-decision-guide'));
  assert.ok(agentVisualizerCss.includes('.agent-approval-decision-guide-item.approve'));
  assert.ok(agentVisualizerCss.includes('.agent-approval-actions'));
  assert.ok(agentVisualizerCss.includes('.agent-approval-retry-config'));
  assert.ok(agentVisualizerCss.includes('.agent-approval-retry-receipt'));
  assert.ok(agentVisualizerCss.includes('.agent-approval-copy-status'));
  assert.ok(agentVisualizerCss.includes('.result-pending-approval'));
  assert.ok(agentVisualizerCss.includes('.decision-badge.pending-notify'));
  assert.ok(agentVisualizerCss.includes('.agent-run-diagnostic-copy'));
  assert.ok(agentVisualizerCss.includes('.agent-run-diagnostic-preflight'));
  assert.ok(agentVisualizerCss.includes('.agent-run-diagnostic-scope'));
  assert.ok(agentVisualizerCss.includes('.agent-run-diagnostic-manual-copy'));
  assert.ok(agentVisualizerCss.includes('.agent-approval-manual-copy'));
  assert.ok(agentVisualizerCss.includes('.agent-approval-copy-receipt'));
  const optionsCss = readFileSync('static/options.css', 'utf8');
  assert.ok(optionsCss.includes('.tool-safety-badge'));

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
  assert.equal(
    getStepVisibleSummary({
      ...blockedStep,
      thought: '内部候选推理不应该成为 UI 主路径',
      publicSummary: '未注册工具未通过执行前校验，系统已阻断调用。',
    }),
    'orgStructure 未通过工具校验，已阻断执行。',
  );
  assert.equal(
    getStepIntentSummary({
      ...blockedStep,
      thought: '内部候选推理不应该成为 UI 主路径',
      publicSummary: '未注册工具未通过执行前校验，系统已阻断调用。',
    }),
    '未注册工具未通过执行前校验，系统已阻断调用。',
  );
  assert.match(
    getStepDiagnosticSummary(blockedStep),
    /执行前校验拦截/,
  );
  assert.deepEqual(getToolStepResultPresentation(blockedStep), {
    label: '已阻断',
    className: 'blocked',
  });
  const blockedReviewItems = buildAgentRunReviewItems([blockedStep]);
  assert.equal(getAgentRunReviewSeverity(blockedReviewItems), 'warning');
  assert.deepEqual(blockedReviewItems.map((item) => item.title), [
    '工具被阻断',
    '缺少完成状态',
  ]);
  assert.deepEqual(blockedReviewItems[0].stepIndexes, [0]);

  registerTool({
    id: 'approvalWriteTest',
    name: '审批写入测试',
    description: '测试需要人工确认的写入工具',
    effect: 'write',
    riskLevel: 'high',
    requiresHumanApproval: true,
    safetyNote: '测试工具，不应在未批准时执行。',
    parameterDefs: [
      {
        name: 'target',
        description: '写入目标',
        required: true,
        type: 'string',
      },
    ],
    execute: async () => ({
      message: 'approval write executed',
      result: { ok: true },
    }),
  });

  const approvalParams = {
    target:
      'external-system-with-long-human-review-payload-that-must-remain-copyable-because-approval-keys-need-exact-matching-and-visible-tail-approval-tail-token-visible-in-ui',
  };
  const approvalKey = buildAgentToolCallKey({
    id: 'approvalWriteTest',
    params: approvalParams,
  });
  const approvalStep: any = {
    timestamp: timestamp + 500,
    thought: '尝试写入外部系统',
    publicSummary: '准备执行需要确认的写入动作。',
    action: 'use_tool',
  };
  const approvalState: any = {
    actionHistory: [],
    memory: {},
    config: {},
    context: {},
  };
  const approvalUsedTools = new Set<string>();
  await (agent as any).executeTools(
    [{ id: 'approvalWriteTest', params: approvalParams }],
    approvalState,
    approvalStep,
    approvalUsedTools,
  );
  const approvalToolResult = JSON.parse(approvalStep.toolResult);
  assert.equal(approvalToolResult.approvalWriteTest.blocked, true);
  assert.equal(approvalToolResult.approvalWriteTest.approvalRequired, true);
  assert.equal(approvalToolResult.approvalWriteTest.approvalKey, approvalKey);
  assert.equal(
    approvalToolResult.approvalWriteTest.safetyNote,
    '测试工具，不应在未批准时执行。',
  );
  assert.equal(approvalUsedTools.has('approvalWriteTest'), false);
  assert.equal(stepHasToolApprovalRequired(approvalStep), true);
  assert.equal(getStepKind(approvalStep), '待确认');
  assert.equal(
    getStepSummary(approvalStep),
    'approvalWriteTest 需要人工确认，当前未执行。',
  );
  assert.deepEqual(getToolStepResultPresentation(approvalStep), {
    label: '待确认',
    className: 'approval',
  });
  const approvalReviewItems = buildAgentRunReviewItems([approvalStep]);
  assert.equal(approvalReviewItems[0].title, '需要人工确认');
  assert.deepEqual(approvalReviewItems[0].stepIndexes, [0]);
  const pendingApprovalActions = buildPendingApprovalActions([approvalStep]);
  assert.equal(pendingApprovalActions.length, 1);
  assert.deepEqual(
    {
      toolId: pendingApprovalActions[0].toolId,
      approvalKey: pendingApprovalActions[0].approvalKey,
      effect: pendingApprovalActions[0].effect,
      riskLevel: pendingApprovalActions[0].riskLevel,
      paramsPreview: pendingApprovalActions[0].paramsPreview,
      reviewHint: pendingApprovalActions[0].reviewHint,
      safetyNote: pendingApprovalActions[0].safetyNote,
    },
    {
      toolId: 'approvalWriteTest',
      approvalKey,
      effect: 'write',
      riskLevel: 'high',
      paramsPreview: JSON.stringify(approvalParams),
      reviewHint:
        '确认写入对象、字段变化和回滚方式后再批准。 高风险动作需要明确用户授权。',
      safetyNote: '测试工具，不应在未批准时执行。',
    },
  );
  assert.deepEqual(
    pendingApprovalActions[0].decisionOptions.map((option) => option.type),
    ['approve', 'reject', 'edit'],
  );
  assert.deepEqual(pendingApprovalActions[0].decisionGuide, [
    {
      type: 'approve',
      label: '批准后重跑',
      currentState:
        'approvalWriteTest / 写入 / 高风险 仍停在步骤 1，写入还没有发生。',
      nextStep:
        '确认参数无误后复制重跑配置，并让调用方用同一工具和同一参数重新运行。',
      boundary:
        '复制配置本身不会执行动作；上下文、参数或工具策略变化后要重新生成批准 key。',
    },
    {
      type: 'reject',
      label: '拒绝本次动作',
      currentState:
        'approvalWriteTest / 写入 / 高风险 可以直接拒绝；当前批准 key 不应继续使用。',
      nextStep:
        '把拒绝原因反馈给 Agent，或重新运行一个不触发该工具动作的分析路径。',
      boundary:
        '拒绝不会自动恢复本轮 run，也不会发送通知、写入、删除或执行外部动作。',
    },
    {
      type: 'edit',
      label: '修改参数后再审',
      currentState:
        'approvalWriteTest / 写入 / 高风险 的参数、范围、接收方或内容一旦变化，旧 key 就不能代表新动作。',
      nextStep:
        '先修改工具参数或重新生成建议，再用新的待确认动作和批准 key 复核。',
      boundary:
        '不要把旧 key 套到新参数；新参数必须重新经过执行前校验和人工确认。',
    },
  ]);
  assert.match(
    pendingApprovalActions[0].decisionOptions[0].description,
    /approvalKey/,
  );
  assert.match(
    pendingApprovalActions[0].decisionOptions[2].description,
    /不复用旧 key/,
  );
  assert.match(
    pendingApprovalActions[0].resumeInstruction,
    /拒绝或修改参数时不要复用旧 key/,
  );
  assert.deepEqual(pendingApprovalActions[0].reviewBoundary, {
    mode: 'single_run_retry',
    generatedAt: new Date(timestamp + 500).toISOString(),
    label: '临时重跑凭据',
    description:
      '这是本轮 trace 生成的轻量审批包，不会持久暂停或自动恢复 Agent run。',
    scope: '只适用于同一 tool id 和完全相同参数的下一次重跑。',
    expiresWhen: '工具定义、参数、提示词、上下文或用户意图变化后应重新生成。',
    approvalKeyBinding:
      '批准 key 与 tool id + 参数精确绑定；拒绝或修改参数时不要复用旧 key。',
  });
  assert.deepEqual(pendingApprovalActions[0].retryReceipt, {
    title: '重跑配置回执',
    configScope: 'approvalWriteTest / 写入 / 高风险。',
    copiedFields:
      '重跑配置只复制 approvedToolActionKeys；调用方仍需重新运行同一工具和同一参数。',
    notCopied:
      '不复制工具参数、原始工具结果、通知正文或外部执行凭据。',
    recoveryBoundary:
      '拒绝、修改参数、上下文变化或工具策略变化时，应重新生成批准 key，不复用当前配置。',
  });
  assert.deepEqual(pendingApprovalActions[0].preflightReceipt, {
    title: '审批前确认',
    pendingAction: 'approvalWriteTest / 写入 / 高风险，停在步骤 1，等待人工确认。',
    noEffectBoundary:
      '写入还没有发生。 本轮只是生成临时批准 key、审核包和重跑配置。',
    copyBoundary:
      '复制 key、审核包或重跑配置只复制文本，不会批准、恢复 run、发送通知、写入、删除或执行外部动作。',
    nextStep:
      '批准时复制重跑配置并用同一工具和同一参数重新运行；拒绝或修改参数时不要复用旧 key。',
  });
  assert.match(
    pendingApprovalActions[0].reviewPayload,
    /"type": "agent_tool_approval_review"/,
  );
  assert.match(
    pendingApprovalActions[0].reviewPayload,
    /"allowedDecisions": \[/,
  );
  assert.match(
    pendingApprovalActions[0].reviewPayload,
    /"edit_params_then_regenerate_key"/,
  );
  assert.match(
    pendingApprovalActions[0].reviewPayload,
    /"retryConfigPatch"/,
  );
  assert.deepEqual(JSON.parse(pendingApprovalActions[0].retryConfigPatch), {
    approvedToolActionKeys: [approvalKey],
  });
  const pendingApprovalReviewPayload = JSON.parse(
    pendingApprovalActions[0].reviewPayload,
  );
  assert.equal(pendingApprovalReviewPayload.approvalKey, approvalKey);
  assert.deepEqual(pendingApprovalReviewPayload.params, approvalParams);
  assert.equal(
    pendingApprovalReviewPayload.safetyNote,
    '测试工具，不应在未批准时执行。',
  );
  assert.deepEqual(pendingApprovalReviewPayload.retryConfigPatch, {
    approvedToolActionKeys: [approvalKey],
  });
  assert.deepEqual(
    pendingApprovalReviewPayload.retryReceipt,
    pendingApprovalActions[0].retryReceipt,
  );
  assert.deepEqual(
    pendingApprovalReviewPayload.preflightReceipt,
    pendingApprovalActions[0].preflightReceipt,
  );
  assert.deepEqual(
    pendingApprovalReviewPayload.decisionOptions.map(
      (option: { type: string }) => option.type,
    ),
    ['approve', 'reject', 'edit'],
  );
  assert.deepEqual(
    pendingApprovalReviewPayload.decisionGuide.map(
      (item: { type: string; label: string }) => [item.type, item.label],
    ),
    [
      ['approve', '批准后重跑'],
      ['reject', '拒绝本次动作'],
      ['edit', '修改参数后再审'],
    ],
  );
  assert.match(
    pendingApprovalReviewPayload.decisionGuide[0].boundary,
    /不会执行动作/,
  );
  assert.match(
    pendingApprovalReviewPayload.resumeInstruction,
    /批准后复制重跑配置重新运行/,
  );
  assert.deepEqual(
    pendingApprovalReviewPayload.reviewBoundary,
    pendingApprovalActions[0].reviewBoundary,
  );
  assert.equal(formatApprovalEffect(pendingApprovalActions[0].effect), '写入');
  assert.equal(formatApprovalRisk(pendingApprovalActions[0].riskLevel), '高风险');
  assert.match(
    getStepDiagnosticSummary(approvalStep),
    new RegExp(`批准 key: ${approvalKey.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`),
  );
  assert.ok(
    getStepDiagnosticSummary(approvalStep).includes(
      'approval-tail-token-visible-in-ui',
    ),
  );
  assert.equal(getStepDiagnosticSummary(approvalStep).includes('...'), false);

  const toolIdOnlyApprovalStep: any = {
    timestamp: timestamp + 550,
    thought: '只批准工具 ID 不应放行',
    publicSummary: '工具 ID 不能作为所有参数的通配批准。',
    action: 'use_tool',
  };
  const toolIdOnlyApprovalState: any = {
    actionHistory: [],
    memory: {},
    config: {
      approvedToolActionKeys: ['approvalWriteTest'],
    },
    context: {},
  };
  const toolIdOnlyApprovalUsedTools = new Set<string>();
  await (agent as any).executeTools(
    [{ id: 'approvalWriteTest', params: approvalParams }],
    toolIdOnlyApprovalState,
    toolIdOnlyApprovalStep,
    toolIdOnlyApprovalUsedTools,
  );
  const toolIdOnlyApprovalResult = JSON.parse(
    toolIdOnlyApprovalStep.toolResult,
  );
  assert.equal(toolIdOnlyApprovalResult.approvalWriteTest.blocked, true);
  assert.equal(
    toolIdOnlyApprovalResult.approvalWriteTest.approvalRequired,
    true,
  );
  assert.equal(toolIdOnlyApprovalUsedTools.has('approvalWriteTest'), false);

  const approvedStep: any = {
    timestamp: timestamp + 600,
    thought: '已获得用户确认',
    publicSummary: '批准后执行写入动作。',
    action: 'use_tool',
  };
  const approvedState: any = {
    actionHistory: [],
    memory: {},
    config: {
      approvedToolActionKeys: [approvalKey],
    },
    context: {},
  };
  const approvedUsedTools = new Set<string>();
  await (agent as any).executeTools(
    [{ id: 'approvalWriteTest', params: approvalParams }],
    approvedState,
    approvedStep,
    approvedUsedTools,
  );
  const approvedToolResult = JSON.parse(approvedStep.toolResult);
  assert.equal(approvedToolResult.approvalWriteTest.result.ok, true);
  assert.equal(approvedUsedTools.has('approvalWriteTest'), true);

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
  const skippedReviewItems = buildAgentRunReviewItems([
    mixedSkippedStep,
    {
      timestamp: timestamp + 1500,
      thought: '完成',
      publicSummary: '已有足够信息，结束分析。',
      action: 'finish',
    },
  ]);
  assert.equal(getAgentRunReviewSeverity(skippedReviewItems), 'info');
  assert.deepEqual(skippedReviewItems.map((item) => item.title), [
    '重复调用已跳过',
  ]);
  assert.deepEqual(skippedReviewItems[0].stepIndexes, [0]);

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
  const errorReviewItems = buildAgentRunReviewItems([
    errorStep,
    {
      timestamp: timestamp + 2500,
      thought: '完成',
      publicSummary: '工具失败后使用已有信息结束。',
      action: 'finish',
    },
  ]);
  assert.equal(getAgentRunReviewSeverity(errorReviewItems), 'critical');
  assert.equal(errorReviewItems[0].title, '工具调用失败');
  assert.deepEqual(errorReviewItems[0].stepIndexes, [0]);

  const jiraSoftFailureStep = {
    timestamp: timestamp + 2600,
    thought: 'JIRA 返回失败对象',
    action: 'use_tool',
    toolUsed: 'jiraQuery',
    toolResult: JSON.stringify({
      jiraQuery: {
        success: false,
        source: 'jira-api',
        message: 'JIRA认证失败',
      },
    }),
  };
  assert.equal(getStepKind(jiraSoftFailureStep), '失败');
  assert.equal(
    getStepSummary(jiraSoftFailureStep),
    'jiraQuery 调用失败，需要查看调试详情。',
  );
  assert.equal(getToolStepResultPresentation(jiraSoftFailureStep).className, 'error');

  const emptyEvidenceStep = {
    timestamp: timestamp + 2700,
    thought: '历史工具没有返回证据',
    action: 'use_tool',
    toolUsed: 'historySearch',
    toolResult: JSON.stringify({
      historySearch: {
        message: '没有找到匹配的历史消息',
        result: [],
      },
    }),
  };
  assert.equal(stepHasEmptyToolEvidence(emptyEvidenceStep), true);
  assert.equal(getStepKind(emptyEvidenceStep), '证据不足');
  assert.equal(
    getStepSummary(emptyEvidenceStep),
    'historySearch 已执行，但没有返回可用证据。',
  );
  assert.match(getStepDiagnosticSummary(emptyEvidenceStep), /返回结果为空/);
  assert.deepEqual(getToolStepResultPresentation(emptyEvidenceStep), {
    label: '证据不足',
    className: 'empty',
  });
  assert.equal(
    stepHasEmptyToolEvidence({
      ...emptyEvidenceStep,
      toolResult: JSON.stringify({
        historySearch: {
          message: '没有找到匹配的历史消息',
          result: { memories: [] },
        },
      }),
    }),
    true,
  );
  const emptyEvidenceReviewItems = buildAgentRunReviewItems([
    emptyEvidenceStep,
    {
      timestamp: timestamp + 2800,
      thought: '完成',
      publicSummary: '用已有信息结束。',
      action: 'finish',
    },
  ]);
  assert.equal(getAgentRunReviewSeverity(emptyEvidenceReviewItems), 'warning');
  assert.deepEqual(emptyEvidenceReviewItems.map((item) => item.title), [
    '工具证据不足',
  ]);
  assert.deepEqual(emptyEvidenceReviewItems[0].stepIndexes, [0]);

  const budgetReviewItems = buildAgentRunReviewItems([
    {
      timestamp: timestamp + 3000,
      thought: '已达到最大行动次数 1，使用当前已收集的信息结束本轮分析。',
      publicSummary: '已达到最大行动次数 1，使用当前已收集的信息结束本轮分析。',
      action: 'max_actions_reached',
    },
  ]);
  assert.equal(getAgentRunReviewSeverity(budgetReviewItems), 'warning');
  assert.equal(budgetReviewItems[0].title, '行动次数用完');
  assert.deepEqual(budgetReviewItems[0].stepIndexes, [0]);

  const budgetWithOpenIssues = buildAgentRunReviewItems([
    errorStep,
    approvalStep,
    blockedStep,
    emptyEvidenceStep,
    {
      timestamp: timestamp + 3200,
      thought: '已达到最大行动次数 3，使用当前已收集的信息结束本轮分析。',
      publicSummary: '已达到最大行动次数 3，使用当前已收集的信息结束本轮分析。',
      action: 'max_actions_reached',
    },
  ]);
  const budgetWithOpenIssuesItem = budgetWithOpenIssues.find(
    (item) => item.title === '行动次数用完',
  );
  assert.ok(budgetWithOpenIssuesItem);
  assert.match(
    budgetWithOpenIssuesItem.detail,
    /工具失败 1 个步骤、待确认 1 个步骤、被阻断 1 个步骤、证据不足 1 个步骤/,
  );
  assert.match(
    budgetWithOpenIssuesItem.action,
    /先处理失败、待确认、阻断或缺证问题/,
  );
  assert.deepEqual(budgetWithOpenIssuesItem.stepIndexes, [0, 1, 2, 3, 4]);

  const okReviewItems = buildAgentRunReviewItems([
    {
      timestamp: timestamp + 4000,
      thought: '完成',
      publicSummary: '已有足够信息，结束分析。',
      action: 'finish',
    },
  ]);
  assert.deepEqual(okReviewItems.map((item) => item.title), ['运行正常']);
  assert.equal(getAgentRunReviewSeverity(okReviewItems), 'ok');

  const flowSteps = buildAgentFlowSteps(
    [blockedStep, mixedSkippedStep, emptyEvidenceStep, errorStep],
    (time) => String(time),
  );
  assert.equal(
    flowSteps.some((step) => step.type === 'decision'),
    false,
  );
  assert.deepEqual(
    flowSteps
      .filter((step) => step.type === 'tool')
      .map((step) => `${step.name}:${step.result}:${step.resultClass}`),
    [
      'orgStructure:已阻断:blocked',
      'historySearch, historySearch:部分跳过:partial',
      'historySearch:证据不足:empty',
      'jiraQuery:失败:error',
    ],
  );
  assert.deepEqual(
    flowSteps
      .filter((step) => step.type === 'tool')
      .map((step) => step.stepIndex),
    [0, 1, 2, 3],
  );
  const completedFlowSteps = buildAgentFlowSteps(
    [
      blockedStep,
      {
        timestamp: timestamp + 5000,
        thought: '完成',
        publicSummary: '已有足够信息，结束分析。',
        action: 'finish',
      },
    ],
    (time) => String(time),
  );
  assert.deepEqual(
    completedFlowSteps
      .filter((step) => step.type === 'decision')
      .map((step) => `${step.name}:${step.stepIndex}`),
    ['最终决策:1'],
  );
  const budgetFlowSteps = buildAgentFlowSteps(
    [
      approvalStep,
      emptyEvidenceStep,
      {
        timestamp: timestamp + 5200,
        thought: '已达到最大行动次数 2，使用当前已收集的信息结束本轮分析。',
        publicSummary: '已达到最大行动次数 2，使用当前已收集的信息结束本轮分析。',
        action: 'max_actions_reached',
      },
    ],
    (time) => String(time),
  );
  const budgetDecisionStep = budgetFlowSteps.find(
    (step) => step.type === 'decision',
  );
  assert.equal(budgetDecisionStep?.name, '预算耗尽');
  assert.equal(budgetDecisionStep?.stepIndex, 2);
  assert.match(
    budgetDecisionStep?.detail || '',
    /待确认 1 个步骤、证据不足 1 个步骤/,
  );
  const diagnosticPacket = buildAgentRunDiagnosticPacket(
    [
      approvalStep,
      blockedStep,
      emptyEvidenceStep,
      {
        timestamp: timestamp + 5300,
        thought: '已达到最大行动次数 3，使用当前已收集的信息结束本轮分析。',
        publicSummary: '已达到最大行动次数 3，使用当前已收集的信息结束本轮分析。',
        action: 'max_actions_reached',
      },
    ],
    { generatedAt: '2026-05-31T00:00:00.000Z' },
  );
  assert.equal(diagnosticPacket.type, 'agent_thinking_run_diagnostics');
  assert.deepEqual(diagnosticPacket.traceIdentity, {
    traceId: 'pai-agent-trace-7105dab9',
    checksum: '7105dab9',
    checksumAlgorithm: 'fnv1a32-local',
    source: 'sanitized_diagnostic_snapshot',
    matchBoundary:
      'Use this local trace id and checksum only to match the copied diagnostics JSON with this Options page snapshot.',
    notFor: [
      'standard OpenTelemetry, LangSmith, or Langfuse trace correlation',
      'persistent run checkpoint or resume',
      'tool approval, rejection, or execution proof',
    ],
  });
  assert.equal(diagnosticPacket.status, 'max_actions_reached');
  assert.equal(diagnosticPacket.severity, 'warning');
  assert.equal(diagnosticPacket.summary.stepCount, 4);
  assert.equal(diagnosticPacket.summary.pendingApprovalCount, 1);
  assert.deepEqual(diagnosticPacket.summary.toolsInvolved, [
    'approvalWriteTest',
    'historySearch',
    'orgStructure',
  ]);
  assert.deepEqual(
    diagnosticPacket.reviewItems
      .find((item) => item.title === '行动次数用完')
      ?.stepNumbers,
    [1, 2, 3, 4],
  );
  assert.deepEqual(diagnosticPacket.pendingApprovals.map((item) => ({
    stepNumber: item.stepNumber,
    toolId: item.toolId,
    approvalKeyAvailable: item.approvalKeyAvailable,
    retryConfigAvailable: item.retryConfigAvailable,
    reviewBoundary: item.reviewBoundary,
  })), [
    {
      stepNumber: 1,
      toolId: 'approvalWriteTest',
      approvalKeyAvailable: true,
      retryConfigAvailable: true,
      reviewBoundary: pendingApprovalActions[0].reviewBoundary,
    },
  ]);
  assert.deepEqual(diagnosticPacket.approvalQueueReceipt, {
    title: '待确认队列口径',
    traceScope:
      '当前页面 trace pai-agent-trace-7105dab9 汇总 1 个待确认动作，来自步骤 #1。',
    pendingScope:
      '队列只汇总本轮已被执行前阻断的人审工具动作；approvalWriteTest 还没有执行。',
    persistenceBoundary:
      '这不是持久审批队列，也不会让本轮 Agent run 在后台继续暂停等待；刷新、重跑、工具策略或参数变化后需重新生成。',
    copyBoundary:
      '复制 key、审核包或重跑配置只复制文本，不会批准、恢复 run、发送通知、写入、删除或执行外部动作。',
    nextStep:
      '逐条复核参数、接收方和安全说明；批准时复制对应重跑配置并用同一工具和同一参数重新运行，拒绝或修改时不要复用旧 key。',
    stepNumbers: [1],
  });
  assert.equal(diagnosticPacket.traceSpans[0].operationName, 'agent.run');
  assert.equal(diagnosticPacket.traceSpans[0].status.code, 'max_actions_reached');
  assert.equal(diagnosticPacket.traceSpans.length, 8);
  assert.deepEqual(
    diagnosticPacket.traceSpans
      .filter((span) => span.operationName === 'execute_tool')
      .map((span) => [
        span.attributes['gen_ai.operation.name'],
        span.attributes['gen_ai.tool.name'],
        span.status.code,
      ]),
    [
      ['execute_tool', 'approvalWriteTest', 'approval_required'],
      ['execute_tool', 'orgStructure', 'blocked'],
      ['execute_tool', 'historySearch', 'empty_evidence'],
    ],
  );
  assert.deepEqual(
    diagnosticPacket.traceSpans
      .filter((span) => span.operationName === 'agent.step')
      .map((span) => [span.stepNumber, span.attributes['agent.evidence.status']]),
    [
      [1, 'pending_approval'],
      [2, 'blocked'],
      [3, 'empty'],
    ],
  );
  assert.deepEqual(
    diagnosticPacket.traceSpans
      .filter((span) => span.operationName === 'agent.decision')
      .map((span) => [span.stepNumber, span.status.code]),
    [[4, 'max_actions_reached']],
  );
  assert.deepEqual(diagnosticPacket.schemaBoundary, {
    schemaName: 'personal_ai_agent_thinking_diagnostics',
    schemaVersion: 1,
    spanLineage: [
      'OpenTelemetry GenAI-inspired agent.run / execute_tool span naming',
      'LangSmith / Langfuse-inspired step, tool, and decision grouping',
      'Personal AI privacy-preserving run review metadata',
    ],
    exporterStatus: 'local_only_not_standard_export',
    supportedUses: [
      'local debugging',
      'eval fixtures',
      'support handoff without raw tool payloads',
    ],
    unsupportedUses: [
      'direct OpenTelemetry ingestion',
      'direct LangSmith or Langfuse import',
      'tool approval, rejection, or run resume',
    ],
    approvalContextBoundary:
      'This diagnostics packet only says approvals exist. Use the per-action approval review packet or retry config for approval context.',
  });
  assert.deepEqual(diagnosticPacket.snapshotBoundary, {
    generatedAt: '2026-05-31T00:00:00.000Z',
    status: 'max_actions_reached',
    statusLabel: '预算耗尽',
    source: 'current_page_trace_snapshot',
    copySemantics:
      'This diagnostics packet is a point-in-time snapshot of the trace currently rendered on the Options page.',
    notLive:
      'It will not subscribe to later tool results, approval decisions, retries, or reruns.',
    refreshBoundary:
      'Refresh the page, rerun the Agent, or copy a new packet after the trace changes.',
  });
  assert.deepEqual(diagnosticPacket.navigationReceipt, {
    title: '当前 trace 导航',
    currentTrace:
      '当前 trace pai-agent-trace-7105dab9（预算耗尽，生成于 2026-05-31T00:00:00.000Z）。',
    primaryRoute:
      '先处理 待确认 1 / 阻断 1 / 缺证 1，再阅读完整时间线或复制诊断包。',
    stepScope:
      '本页共 4 步 / 8 个 span；首屏可直接跳到步骤 #1、#2、#3、#4。',
    noEffectBoundary:
      '点击步骤定位只展开当前页面时间线，不会批准、复制诊断包、重跑、发送通知、写入、删除或执行外部动作。',
    stepNumbers: [1, 2, 3, 4],
    stepRoutes: [
      {
        stepNumber: 1,
        reason:
          '审批上下文：approvalWriteTest 尚未执行，需使用单个动作审核包或重跑配置复核。；需要人工确认：先让用户确认具体工具和参数，再带对应批准 key 重新运行。；行动次数用完：先处理失败、待确认、阻断或缺证问题，再提高 maxActions 或缩小问题范围重新分析。',
      },
      {
        stepNumber: 2,
        reason:
          '工具被阻断：改用工具目录里的 ID，或补齐必填参数后重试。；行动次数用完：先处理失败、待确认、阻断或缺证问题，再提高 maxActions 或缩小问题范围重新分析。',
      },
      {
        stepNumber: 3,
        reason:
          '工具证据不足：调整查询参数、补充上下文，或在结论中标记证据不足。；行动次数用完：先处理失败、待确认、阻断或缺证问题，再提高 maxActions 或缩小问题范围重新分析。',
      },
      {
        stepNumber: 4,
        reason:
          '运行状态：预算已用完；剩余审批、阻断或缺证应先于结论外发处理。；行动次数用完：先处理失败、待确认、阻断或缺证问题，再提高 maxActions 或缩小问题范围重新分析。',
      },
    ],
  });
  assert.deepEqual(diagnosticPacket.traceSpanComposition, {
    title: 'Trace span 构成',
    detail:
      '这份本地 trace 由 8 个 span 组成；先看工具执行和问题 span，再决定是否复制诊断包。',
    items: [
      {
        key: 'run',
        label: 'Root run',
        value: '1',
        detail: '运行级状态、终止动作和工具计数入口。',
        tone: 'neutral',
      },
      {
        key: 'steps',
        label: 'Agent steps',
        value: '3',
        detail: '非终止步骤，用于定位分析、工具前后状态和证据口径。',
        tone: 'neutral',
      },
      {
        key: 'tools',
        label: 'Tool calls',
        value: '3',
        detail:
          '工具执行 span；保留工具名、状态和证据/审批状态，不含原始参数或结果。',
        tone: 'info',
      },
      {
        key: 'decision',
        label: 'Terminal',
        value: '1',
        detail: 'finish、stopped 或 max_actions_reached 终止决策 span。',
        tone: 'neutral',
      },
      {
        key: 'issues',
        label: '问题 span',
        value: '6',
        detail:
          '只统计失败、待确认、阻断和缺证 span；对应步骤 #1、#2、#3。',
        tone: 'warning',
        stepNumbers: [1, 2, 3],
      },
    ],
    boundary:
      '这是 Personal AI 本地 span 构成，不是标准 OpenTelemetry / LangSmith / Langfuse 拓扑；查看或复制它不会批准、恢复、重跑、发送通知、写入、删除或执行外部动作。',
  });
  const serializedDiagnosticPacket = JSON.stringify(diagnosticPacket);
  assert.ok(!serializedDiagnosticPacket.includes('approval-tail-token-visible-in-ui'));
  assert.ok(!serializedDiagnosticPacket.includes('approvalWriteTest:{'));
  assert.ok(!serializedDiagnosticPacket.includes(JSON.stringify(approvalParams)));
  assert.match(diagnosticPacket.privacyNote, /omits raw tool results/);
  assert.match(diagnosticPacket.privacyNote, /traceSpans/);
  assert.match(diagnosticPacket.privacyNote, /traceSpanComposition/);
  assert.match(diagnosticPacket.privacyNote, /approvalQueueReceipt/);
  assert.match(diagnosticPacket.privacyNote, /not a durable checkpoint/);
  assert.match(diagnosticPacket.privacyNote, /resultHandoffReceipt/);
  assert.match(diagnosticPacket.privacyNote, /traceIdentity/);
  assert.match(diagnosticPacket.privacyNote, /schemaBoundary/);
  assert.equal(diagnosticPacket.resultHandoffReceipt, undefined);
  const finalizingDiagnosticPacket = buildAgentRunDiagnosticPacket(
    [
      approvalStep,
      blockedStep,
      emptyEvidenceStep,
      {
        timestamp: timestamp + 5300,
        thought: '已达到最大行动次数 3，使用当前已收集的信息结束本轮分析。',
        publicSummary: '已达到最大行动次数 3，使用当前已收集的信息结束本轮分析。',
        action: 'max_actions_reached',
      },
    ],
    {
      generatedAt: '2026-05-31T00:00:03.000Z',
      isProcessing: true,
    },
  );
  assert.deepEqual(finalizingDiagnosticPacket.resultHandoffReceipt, {
    title: '结果整理中',
    traceState:
      'Trace 已到达 步骤 #4（预算耗尽），状态快照为 预算耗尽，生成于 2026-05-31T00:00:03.000Z。',
    resultState:
      '结果摘要卡片仍在生成；在它出现前，不要把当前页面解读成最终已交付结果。',
    unresolvedIssueSummary:
      '整理前仍有 1 个待确认动作、1 个已阻断工具步骤、1 个证据不足步骤，需要按运行检查复核。',
    inspectionRoute:
      '可先定位终止步骤 #4，只展开当前页面时间线里的这个步骤。',
    boundary:
      '这个整理状态不会批准、恢复 run、重跑、发送通知、写入、删除或执行外部动作；待确认和工具问题仍按运行检查处理。',
    terminalStepNumber: 4,
  });
  const runningDiagnosticPacket = buildAgentRunDiagnosticPacket(
    [approvalStep],
    {
      generatedAt: '2026-05-31T00:00:01.000Z',
      isProcessing: true,
    },
  );
  assert.equal(runningDiagnosticPacket.status, 'running');
  assert.equal(runningDiagnosticPacket.resultHandoffReceipt, undefined);
  const diagnosticCopyScope = buildAgentDiagnosticCopyScope(diagnosticPacket);
  assert.deepEqual(diagnosticCopyScope, {
    title: '诊断包范围',
    detail: '包含 8 个结构化 trace span、4 条运行检查和 1 个待确认动作摘要，用于排障或 eval。',
    identityBoundary:
      '本地 trace id pai-agent-trace-7105dab9，校验 7105dab9；只用于匹配这份复制 JSON 和当前页面快照。',
    freshnessBoundary:
      '生成于 2026-05-31T00:00:00.000Z，状态 预算耗尽；复制的是当前页面快照，不会随审批、重跑或后续工具结果自动更新。',
    privacyBoundary: '不会复制原始工具结果、工具参数或批准 key。',
    exportBoundary:
      '这是 Personal AI 本地诊断包，不是 OpenTelemetry / LangSmith / Langfuse 标准导出。',
    schemaBoundary:
      'personal_ai_agent_thinking_diagnostics v1；span 命名参考 OTel GenAI，分组参考 LangSmith / Langfuse，但不能直接导入这些平台。',
    approvalBoundary:
      '本地 trace id 不能用于标准追踪关联、恢复 run 或审批动作；需要审批上下文时，仍使用单个待确认动作的审核包或重跑配置。',
  });
  const diagnosticCopyPreflight = buildAgentDiagnosticCopyPreflight(diagnosticPacket);
  assert.equal(diagnosticCopyPreflight.title, '诊断包复制预检');
  assert.equal(
    diagnosticCopyPreflight.detail,
    '准备复制当前页面 trace 7105dab9 的本地诊断 JSON；复制只产生文本，不会批准、恢复或执行工具。',
  );
  assert.deepEqual(
    diagnosticCopyPreflight.items.map((item) => [item.label, item.value, item.tone]),
    [
      [
        '复制对象',
        '8 个 trace span / 预算耗尽 / 1 个待确认动作摘要',
        'warning',
      ],
      [
        '可用于',
        '本地排障、eval fixture、支持交接；不含原始工具结果、工具参数或批准 key。',
        'neutral',
      ],
      [
        '不会发生',
        '不会批准、恢复 run、重跑、发送通知、写入、删除或执行外部动作。',
        'warning',
      ],
      [
        '新鲜度',
        '生成于 2026-05-31T00:00:00.000Z，状态 预算耗尽。',
        'neutral',
      ],
      [
        '导出边界',
        '这是 Personal AI 本地 schema，不能直接导入 OpenTelemetry / LangSmith / Langfuse。',
        'neutral',
      ],
    ],
  );
  assert.equal(
    buildAgentDiagnosticCopySuccessReceipt(diagnosticPacket),
    '已复制诊断包：8 个 trace span，状态 预算耗尽，本地 trace 7105dab9。 这是当前页面快照；未复制原始工具结果、工具参数或批准 key。 本地 trace id 只用于匹配这份 JSON；审批或恢复仍使用单个待确认动作的审核包或重跑配置。',
  );
  const copiedSnapshot = buildAgentDiagnosticCopiedSnapshot(diagnosticPacket);
  assert.deepEqual(copiedSnapshot, {
    traceId: 'pai-agent-trace-7105dab9',
    checksum: '7105dab9',
    generatedAt: '2026-05-31T00:00:00.000Z',
    statusLabel: '预算耗尽',
    traceSpanCount: 8,
  });
  assert.equal(
    buildAgentDiagnosticCopyFreshnessReceipt(copiedSnapshot, diagnosticPacket),
    '当前诊断包回执：上次复制内容仍匹配当前页面 pai-agent-trace-7105dab9（预算耗尽，8 个 span）。 它仍只是本地快照，不会批准、恢复、重跑、发送通知、写入、删除或执行外部动作。',
  );
  const newerDiagnosticPacket = buildAgentRunDiagnosticPacket(
    [
      approvalStep,
      blockedStep,
      emptyEvidenceStep,
      {
        timestamp: timestamp + 5300,
        thought: '已达到最大行动次数 3，使用当前已收集的信息结束本轮分析。',
        publicSummary: '已达到最大行动次数 3，使用当前已收集的信息结束本轮分析。',
        action: 'max_actions_reached',
      },
    ],
    { generatedAt: '2026-05-31T00:00:05.000Z' },
  );
  const staleCopyReceipt = buildAgentDiagnosticCopyFreshnessReceipt(
    copiedSnapshot,
    newerDiagnosticPacket,
  );
  assert.match(staleCopyReceipt, /旧诊断包回执/);
  assert.match(staleCopyReceipt, /上次复制内容仍是 pai-agent-trace-7105dab9/);
  assert.match(staleCopyReceipt, /当前页面已经变为 pai-agent-trace-[0-9a-f]{8}/);
  assert.match(staleCopyReceipt, /请重新复制后再用于排障或 eval/);
  assert.match(staleCopyReceipt, /旧包不会随新步骤、审批、重跑或后续工具结果更新/);
  assert.equal(
    buildAgentDiagnosticCopyFreshnessReceipt(copiedSnapshot, null),
    '旧诊断包回执：上次复制内容仍是 pai-agent-trace-7105dab9（预算耗尽，8 个 span，生成于 2026-05-31T00:00:00.000Z）。 当前页面没有可匹配的 trace；重新运行并复制新诊断包后再用于排障或 eval。',
  );
  const traceReviewLane = buildAgentTraceReviewLane(diagnosticPacket);
  assert.equal(traceReviewLane.title, 'Trace 复核路线');
  assert.match(traceReviewLane.detail, /复制诊断包不等于批准、恢复或外部写入/);
  assert.deepEqual(
    traceReviewLane.items.map((item) => [
      item.key,
      item.label,
      item.value,
      item.tone,
    ]),
    [
      ['status', '运行状态', '预算耗尽', 'warning'],
      ['approval', '审批上下文', '1 个待确认', 'warning'],
      ['tool_issues', '工具证据', '阻断 1 / 缺证 1', 'warning'],
      ['diagnostics', '诊断包', '8 spans', 'neutral'],
    ],
  );
  assert.match(
    traceReviewLane.items.find((item) => item.key === 'approval')?.detail || '',
    /诊断包不含批准 key/,
  );
  assert.deepEqual(
    traceReviewLane.items.find((item) => item.key === 'status')?.stepIndexes,
    [3],
  );
  assert.deepEqual(
    traceReviewLane.items.find((item) => item.key === 'status')?.stepRoutes,
    [
      {
        stepNumber: 4,
        reason:
          '运行状态：预算已用完；剩余审批、阻断或缺证应先于结论外发处理。',
      },
    ],
  );
  assert.deepEqual(
    traceReviewLane.items.find((item) => item.key === 'approval')?.stepIndexes,
    [0],
  );
  assert.deepEqual(
    traceReviewLane.items.find((item) => item.key === 'approval')?.stepRoutes,
    [
      {
        stepNumber: 1,
        reason:
          '审批上下文：approvalWriteTest 尚未执行，需使用单个动作审核包或重跑配置复核。',
      },
    ],
  );
  assert.deepEqual(
    traceReviewLane.items.find((item) => item.key === 'tool_issues')?.stepIndexes,
    [1, 2],
  );
  assert.deepEqual(
    traceReviewLane.items.find((item) => item.key === 'tool_issues')?.stepRoutes,
    [
      {
        stepNumber: 2,
        reason: '工具被阻断：改用工具目录里的 ID，或补齐必填参数后重试。',
      },
      {
        stepNumber: 3,
        reason:
          '工具证据不足：调整查询参数、补充上下文，或在结论中标记证据不足。',
      },
    ],
  );
  assert.equal(
    traceReviewLane.items.find((item) => item.key === 'diagnostics')?.stepIndexes,
    undefined,
  );
  assert.match(
    traceReviewLane.items.find((item) => item.key === 'diagnostics')?.detail || '',
    /优先步骤的复核理由/,
  );
  const diagnosticSnapshot = buildAgentRunSnapshot(diagnosticPacket);
  assert.equal(diagnosticSnapshot.statusLabel, '预算耗尽');
  assert.equal(
    diagnosticSnapshot.detail,
    '终止于步骤 #4（预算耗尽）。 涉及 3 个工具。',
  );
  assert.equal(
    diagnosticSnapshot.primaryAction,
    '先让用户确认具体工具和参数，再带对应批准 key 重新运行。',
  );
  assert.deepEqual(
    diagnosticSnapshot.chips.map((chip) => [chip.label, chip.value, chip.tone]),
    [
      ['状态', '预算耗尽', 'warning'],
      ['步骤', '4', 'neutral'],
      ['Trace spans', '8', 'neutral'],
      ['本地 trace', '7105dab9', 'neutral'],
      ['待确认动作', '1', 'warning'],
      ['阻断', '1', 'warning'],
      ['缺证', '1', 'warning'],
      ['工具', '3', 'neutral'],
    ],
  );
  const flowStepsWithDetails = buildAgentFlowSteps(
    [
      {
        ...emptyEvidenceStep,
        publicSummary: '准备用更窄关键词查找补充证据。',
      },
      {
        timestamp: timestamp + 5500,
        thought: '完成',
        publicSummary: '已有足够信息，结束分析。',
        action: 'finish',
      },
    ],
    (time) => String(time),
  );
  assert.equal(
    flowStepsWithDetails.find((step) => step.type === 'tool')?.detail,
    '准备用更窄关键词查找补充证据。',
  );
  assert.equal(
    flowStepsWithDetails.find((step) => step.type === 'decision')?.detail,
    '已有足够信息，结束分析。',
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
  assert.match(
    toolStep.publicSummary || '',
    /准备调用 historySearch/,
  );
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
  assert.match(guardToolStep.publicSummary || '', /准备调用 orgStructure、historySearch/);
  const guardToolResult = JSON.parse(guardToolStep.toolResult);
  assert.equal(guardToolResult.orgStructure.blocked, true);
  assert.match(guardToolResult.orgStructure.message, /未注册/);
  assert.equal(guardToolResult.historySearch.blocked, true);
  assert.match(guardToolResult.historySearch.message, /缺少必填参数 content/);

  const blockedNotifyResult = await agent.analyze(
    {
      content: 'blocked notification side effect regression',
      sender: 'Morgan',
      post_id: 'post-thinking-blocked-notify',
    },
    {
      type: 'message',
      analysisDepth: 'normal',
      maxActions: 1,
    },
  );
  assert.ok(!Array.isArray(blockedNotifyResult));
  assert.equal(blockedNotifyResult.shouldNotify, false);
  assert.deepEqual(blockedNotifyResult.metaData?.usedTools || [], []);
  const blockedNotifyToolStep = blockedNotifyResult.thoughtProcess?.find(
    (step) => step.toolUsed === 'messageNotification',
  );
  assert.ok(blockedNotifyToolStep?.toolResult);
  const blockedNotifyToolResult = JSON.parse(blockedNotifyToolStep.toolResult);
  assert.equal(blockedNotifyToolResult.messageNotification.blocked, true);
  assert.equal(blockedNotifyToolResult.messageNotification.reason, 'unknown_tool');

  const standaloneCompletedGroups: any[][] = [];
  const standaloneResult = await agent.analyze(
    [
      {
        groupName: 'SDK Updates',
        groupId: 'team-1',
        standalone: [
          {
            content: 'standalone-only regression migration guide draft is ready',
            sender: 'James Lee',
            datetime: '2026-04-15T00:02:00.000Z',
            post_id: 'post-thinking-standalone',
          },
        ],
      },
    ],
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
      standaloneCompletedGroups.push(groupResults);
    },
  );

  assert.ok(Array.isArray(standaloneResult));
  assert.equal(standaloneResult.length, 1);
  assert.equal(standaloneResult[0].postId, 'post-thinking-standalone');
  assert.equal(standaloneResult[0].shouldStore, true);
  assert.equal(standaloneCompletedGroups.length, 1);

  const outOfScopeRules = buildRuntimeWatchRules({
    manualItems: [
      {
        id: 'release-only',
        text: 'Release blockers',
        expiredAt: 0,
        notifyMethod: 'bot',
        filterGroup: 'Release Chat',
      },
    ],
  });
  const outOfScopeResult = await agent.analyze(
    [
      {
        groupName: 'Daily Standup',
        groupId: 'daily-standup',
        posts: [
          {
            content: 'blocker update is ready',
            sender: 'Priya',
            datetime: '2026-04-15T01:00:00.000Z',
            post_id: 'post-thinking-out-of-scope',
          },
        ],
      },
    ],
    {
      type: 'message',
      analysisDepth: 'normal',
      maxActions: 1,
    },
    {
      currentUser: 'Current User',
      concernedRules: outOfScopeRules,
      groupInfo: {
        id: 'daily-standup',
        name: 'Daily Standup',
        members: [],
      },
    },
  );

  assert.ok(Array.isArray(outOfScopeResult));
  assert.equal(outOfScopeResult.length, 1);
  assert.equal(outOfScopeResult[0].shouldStore, false);
  assert.equal(outOfScopeResult[0].shouldNotify, false);
  assert.deepEqual(outOfScopeResult[0].matchedRuleRefs, []);
  assert.ok(
    outOfScopeResult[0].thoughtProcess?.some(
      (step) => step.action === 'invalid_rule_scope',
    ),
  );
  const ruleDiagnostics = storage[MESSAGE_ANALYSIS_RULE_DIAGNOSTICS_KEY] || [];
  assert.equal(ruleDiagnostics.length, 1);
  assert.equal(ruleDiagnostics[0].ruleRef, 'manual:release-only');
  assert.match(ruleDiagnostics[0].reason, /群组不在范围/);
  assert.match(ruleDiagnostics[0].reason, /Release Chat/);
  assert.match(ruleDiagnostics[0].reason, /Daily Standup/);

  console.log('verify-memory-entry-agent-thinking: ok');
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
