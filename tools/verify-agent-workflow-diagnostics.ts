import assert from 'node:assert/strict';

import {
  buildAgentWorkflowConfigDiagnostics,
  buildAgentWorkflowDecisionPath,
  buildAgentWorkflowRecommendedActions,
  buildAgentWorkflowReadinessChecks,
  buildAgentWorkflowResultDiagnostics,
  buildAgentWorkflowRunVerdict,
  getAgentWorkflowHighestSeverity,
  normalizeAgentWorkflowConfidence,
} from '../src/agentWorkflowDiagnostics.ts';

assert.equal(normalizeAgentWorkflowConfidence(0.42), 0.42);
assert.equal(normalizeAgentWorkflowConfidence(42), 0.42);
assert.equal(normalizeAgentWorkflowConfidence('42%'), 0.42);
assert.equal(normalizeAgentWorkflowConfidence('0.42'), 0.42);
assert.equal(normalizeAgentWorkflowConfidence(''), null);

const configDiagnostics = buildAgentWorkflowConfigDiagnostics(
  [
    {
      id: 'relationship-first',
      name: 'Relationship First',
      enabled: true,
      priority: 100,
      tools: ['relationshipAnalysis'],
    },
    {
      id: 'empty-enabled',
      name: 'Empty Enabled',
      enabled: true,
      priority: 90,
      tools: [],
    },
    {
      id: 'legacy',
      name: 'Legacy Agent',
      enabled: true,
      priority: 80,
      tools: ['removedTool'],
    },
    {
      id: 'external',
      name: 'External Info',
      enabled: true,
      priority: 70,
      tools: ['externalServiceQuery'],
    },
    {
      id: 'legacy',
      name: 'Duplicate Legacy',
      enabled: false,
      priority: 10,
      tools: ['entityExtraction'],
    },
  ],
  [
    'entityExtraction',
    'relationshipAnalysis',
    'historySearch',
    'relevanceJudgment',
    'externalServiceQuery',
  ],
);

assert.deepEqual(
  configDiagnostics.map((item) => item.id),
  [
    'duplicate-agent-ids',
    'enabled-agent-without-tools',
    'unknown-tools',
    'relationship-before-entity',
    'external-query-placeholder',
  ],
);
assert.equal(getAgentWorkflowHighestSeverity(configDiagnostics), 'error');

const cleanConfigDiagnostics = buildAgentWorkflowConfigDiagnostics(
  [
    {
      id: 'entity',
      name: 'Entity',
      enabled: true,
      priority: 100,
      tools: ['entityExtraction'],
    },
    {
      id: 'relationship',
      name: 'Relationship',
      enabled: true,
      priority: 90,
      tools: ['relationshipAnalysis'],
    },
  ],
  ['entityExtraction', 'relationshipAnalysis'],
);

assert.equal(cleanConfigDiagnostics.length, 0);
assert.equal(getAgentWorkflowHighestSeverity(cleanConfigDiagnostics), 'ok');

const resultDiagnostics = buildAgentWorkflowResultDiagnostics({
  shouldStore: true,
  shouldNotify: false,
  confidence: 0.42,
  summary: 'possible manual blocker match',
  matchedRuleRefs: ['manual:manual-1'],
  notificationReview: {
    required: true,
    message: '低置信度关注项命中待复核：42% < 70%',
  },
  storageReview: {
    primaryReason: 'Only notify me when blocker is mentioned',
    reasonSource: 'concernedItemMatcher',
    traceStatus: 'partial',
    toolErrorCount: 1,
  },
  agentWorkflowTrace: [
    {
      agentId: 'notificationJudge',
      agentName: '通知判断Agent',
      status: 'success',
      durationMs: 120,
      tools: [
        {
          name: 'concernedItemMatcher',
          displayName: '关注项匹配工具',
          status: 'success',
          durationMs: 90,
        },
      ],
    },
    {
      agentId: 'legacy',
      agentName: 'Legacy Agent',
      status: 'skipped',
      durationMs: 10,
      tools: [
        {
          name: 'removedTool',
          status: 'skipped',
          summary: 'tool is not registered',
        },
      ],
    },
    {
      agentId: 'relevanceJudge',
      agentName: '重要性判断Agent',
      status: 'error',
      durationMs: 16000,
      error: 'mock failure',
      tools: [
        {
          name: 'relevanceJudgment',
          displayName: '重要性判断工具',
          status: 'error',
          durationMs: 7000,
          error: 'mock failure',
        },
      ],
    },
  ],
});

assert.deepEqual(
  resultDiagnostics.map((item) => item.id),
  [
    'notification-review-required',
    'agent-step-errors',
    'skipped-tools',
    'slow-agents',
    'slow-tools',
  ],
);
assert.equal(getAgentWorkflowHighestSeverity(resultDiagnostics), 'error');

const decisionPath = buildAgentWorkflowDecisionPath({
  shouldStore: true,
  shouldNotify: false,
  confidence: 42,
  summary: 'possible manual blocker match',
  matchedRuleRefs: ['manual:manual-1'],
  notificationReview: {
    required: true,
    message: '低置信度关注项命中待复核：42% < 70%',
  },
  storageReview: {
    primaryReason: 'Only notify me when blocker is mentioned',
    reasonSource: 'concernedItemMatcher',
    traceStatus: 'partial',
    toolErrorCount: 1,
  },
  agentWorkflowTrace: [
    {
      agentId: 'notificationJudge',
      agentName: '通知判断Agent',
      status: 'success',
      durationMs: 120,
      tools: [
        {
          name: 'concernedItemMatcher',
          displayName: '关注项匹配工具',
          status: 'success',
          durationMs: 90,
        },
      ],
    },
    {
      agentId: 'relevanceJudge',
      agentName: '重要性判断Agent',
      status: 'error',
      durationMs: 16000,
      error: 'mock failure',
      tools: [
        {
          name: 'relevanceJudgment',
          displayName: '重要性判断工具',
          status: 'error',
          durationMs: 7000,
          error: 'mock failure',
        },
      ],
    },
  ],
});

assert.deepEqual(
  decisionPath.map((item) => item.id),
  [
    'watch-rule-match',
    'storage-decision',
    'notification-review',
    'trace-health',
  ],
);
assert.deepEqual(
  decisionPath.map((item) => item.status),
  ['warning', 'warning', 'warning', 'error'],
);
assert.match(decisionPath[0].detail || '', /置信度 42%/);
assert.match(decisionPath[1].detail || '', /关注项匹配/);
assert.match(decisionPath[3].detail || '', /重要性判断Agent/);

const recommendedActions = buildAgentWorkflowRecommendedActions({
  shouldStore: true,
  shouldNotify: false,
  confidence: 42,
  summary: 'possible manual blocker match',
  matchedRuleRefs: ['manual:manual-1'],
  notificationReview: {
    required: true,
    message: '低置信度关注项命中待复核：42% < 70%',
  },
  storageReview: {
    primaryReason: 'Only notify me when blocker is mentioned',
    reasonSource: 'concernedItemMatcher',
    traceStatus: 'partial',
    failedAgents: ['重要性判断Agent'],
    toolErrorCount: 1,
  },
  agentWorkflowTrace: [
    {
      agentId: 'notificationJudge',
      agentName: '通知判断Agent',
      status: 'success',
      durationMs: 120,
      tools: [
        {
          name: 'concernedItemMatcher',
          displayName: '关注项匹配工具',
          status: 'success',
          durationMs: 90,
        },
      ],
    },
    {
      agentId: 'relevanceJudge',
      agentName: '重要性判断Agent',
      status: 'error',
      durationMs: 16000,
      error: 'mock failure',
      tools: [
        {
          name: 'relevanceJudgment',
          displayName: '重要性判断工具',
          status: 'error',
          durationMs: 7000,
          error: 'mock failure',
        },
      ],
    },
  ],
});
assert.deepEqual(
  recommendedActions.map((item) => item.id),
  [
    'review-notification',
    'fix-agent-errors',
    'optimize-slow-steps',
    'verify-storage',
  ],
);
assert.deepEqual(
  recommendedActions.map((item) => item.status),
  ['review', 'fix', 'optimize', 'verify'],
);
assert.match(recommendedActions[0].detail || '', /manual:manual-1/);
assert.match(recommendedActions[1].summary, /重要性判断Agent/);

const readinessChecks = buildAgentWorkflowReadinessChecks({
  shouldStore: true,
  shouldNotify: false,
  confidence: 42,
  summary: 'possible manual blocker match',
  matchedRuleRefs: ['manual:manual-1'],
  notificationReview: {
    required: true,
    message: '低置信度关注项命中待复核：42% < 70%',
  },
  storageReview: {
    primaryReason: 'Only notify me when blocker is mentioned',
    reasonSource: 'concernedItemMatcher',
    traceStatus: 'partial',
    failedAgents: ['重要性判断Agent'],
    toolErrorCount: 1,
  },
  agentWorkflowTrace: [
    {
      agentId: 'notificationJudge',
      agentName: '通知判断Agent',
      status: 'success',
      durationMs: 120,
      tools: [
        {
          name: 'concernedItemMatcher',
          displayName: '关注项匹配工具',
          status: 'success',
          durationMs: 90,
        },
      ],
    },
    {
      agentId: 'relevanceJudge',
      agentName: '重要性判断Agent',
      status: 'error',
      durationMs: 16000,
      error: 'mock failure',
      tools: [
        {
          name: 'relevanceJudgment',
          displayName: '重要性判断工具',
          status: 'error',
          durationMs: 7000,
          error: 'mock failure',
        },
      ],
    },
  ],
});
assert.deepEqual(
  readinessChecks.map((item) => item.id),
  ['trace', 'storage', 'notification', 'performance'],
);
assert.deepEqual(
  readinessChecks.map((item) => item.status),
  ['blocked', 'review', 'review', 'review'],
);
assert.match(readinessChecks[0].summary, /重要性判断Agent/);
assert.match(readinessChecks[2].detail || '', /manual:manual-1/);
const blockedVerdict = buildAgentWorkflowRunVerdict(
  {
    shouldStore: true,
    shouldNotify: false,
    confidence: 42,
    summary: 'possible manual blocker match',
    matchedRuleRefs: ['manual:manual-1'],
    notificationReview: {
      required: true,
      message: '低置信度关注项命中待复核：42% < 70%',
    },
    storageReview: {
      primaryReason: 'Only notify me when blocker is mentioned',
      reasonSource: 'concernedItemMatcher',
      traceStatus: 'partial',
      failedAgents: ['重要性判断Agent'],
      toolErrorCount: 1,
    },
    agentWorkflowTrace: [
      {
        agentId: 'relevanceJudge',
        agentName: '重要性判断Agent',
        status: 'error',
        durationMs: 16000,
        error: 'mock failure',
        tools: [
          {
            name: 'relevanceJudgment',
            displayName: '重要性判断工具',
            status: 'error',
            durationMs: 7000,
            error: 'mock failure',
          },
        ],
      },
    ],
  },
  readinessChecks,
  recommendedActions,
);
assert.equal(blockedVerdict?.status, 'blocked');
assert.equal(blockedVerdict?.title, '先修复阻塞项');
assert.match(blockedVerdict?.detail || '', /执行 Trace/);
assert.equal(blockedVerdict?.actionLabel, '修复失败阶段');

const notificationWithoutRuleResult = {
  shouldStore: false,
  shouldNotify: true,
  confidence: 0.91,
  agentWorkflowTrace: [
    {
      agentId: 'notificationJudge',
      agentName: '通知判断Agent',
      status: 'success',
      durationMs: 120,
      tools: [
        {
          name: 'concernedItemMatcher',
          displayName: '关注项匹配工具',
          status: 'success',
          durationMs: 90,
        },
      ],
    },
  ],
};
assert.deepEqual(
  buildAgentWorkflowResultDiagnostics(notificationWithoutRuleResult).map(
    (item) => item.id,
  ),
  ['notification-without-rule'],
);
assert.deepEqual(
  buildAgentWorkflowRecommendedActions(notificationWithoutRuleResult).map(
    (item) => item.id,
  ),
  ['fix-notification-attribution', 'verify-notification'],
);
assert.deepEqual(
  buildAgentWorkflowReadinessChecks(notificationWithoutRuleResult).map(
    (item) => `${item.id}:${item.status}`,
  ),
  ['trace:ready', 'storage:skipped', 'notification:blocked'],
);

const notificationWithStorageRuleRefs = {
  shouldStore: true,
  shouldNotify: true,
  confidence: '91%',
  storageReview: {
    primaryReason: 'Matched persisted watch rule',
    reasonSource: 'concernedItemMatcher',
    traceStatus: 'complete',
    matchedRuleRefs: ['manual:persisted-1'],
  },
  agentWorkflowTrace: [
    {
      agentId: 'notificationJudge',
      agentName: '通知判断Agent',
      status: 'success',
      durationMs: 120,
      tools: [
        {
          name: 'concernedItemMatcher',
          displayName: '关注项匹配工具',
          status: 'success',
          durationMs: 90,
        },
      ],
    },
  ],
};
assert.deepEqual(
  buildAgentWorkflowResultDiagnostics(notificationWithStorageRuleRefs).map(
    (item) => item.id,
  ),
  [],
);
assert.deepEqual(
  buildAgentWorkflowReadinessChecks(notificationWithStorageRuleRefs).map(
    (item) => `${item.id}:${item.status}`,
  ),
  ['trace:ready', 'storage:ready', 'notification:ready'],
);
const readyVerdict = buildAgentWorkflowRunVerdict(
  notificationWithStorageRuleRefs,
);
assert.equal(readyVerdict?.status, 'ready');
assert.match(readyVerdict?.summary || '', /manual:persisted-1/);

const partialTraceToolErrorOnly = {
  shouldStore: true,
  shouldNotify: false,
  confidence: 0.8,
  storageReview: {
    primaryReason: 'Important architecture decision',
    reasonSource: 'relevanceJudgment',
    traceStatus: 'partial',
    toolErrorCount: 2,
  },
  agentWorkflowTrace: [
    {
      agentId: 'relationshipAnalyzer',
      agentName: '关系分析Agent',
      status: 'success',
      durationMs: 120,
      tools: [
        {
          name: 'historySearch',
          displayName: '历史消息搜索工具',
          status: 'success',
          durationMs: 90,
        },
      ],
    },
  ],
};
assert.deepEqual(
  buildAgentWorkflowDecisionPath(partialTraceToolErrorOnly).map(
    (item) => item.status,
  ),
  ['warning', 'muted', 'error'],
);
assert.match(
  buildAgentWorkflowDecisionPath(partialTraceToolErrorOnly)[2].detail || '',
  /工具错误 2/,
);
assert.deepEqual(
  buildAgentWorkflowReadinessChecks(partialTraceToolErrorOnly).map(
    (item) => `${item.id}:${item.status}`,
  ),
  ['trace:blocked', 'storage:review', 'notification:skipped'],
);
assert.match(
  buildAgentWorkflowReadinessChecks(partialTraceToolErrorOnly)[0].summary,
  /工具错误 2/,
);
assert.deepEqual(
  buildAgentWorkflowRecommendedActions(partialTraceToolErrorOnly).map(
    (item) => item.id,
  ),
  ['fix-tool-errors', 'verify-storage'],
);

const partialTraceToolErrorFromTraceOnly = {
  shouldStore: true,
  shouldNotify: false,
  storageReview: {
    primaryReason: 'Important architecture decision',
    reasonSource: 'relevanceJudgment',
    traceStatus: 'partial',
  },
  agentWorkflowTrace: [
    {
      agentId: 'relationshipAnalyzer',
      agentName: '关系分析Agent',
      status: 'success',
      durationMs: 120,
      tools: [
        {
          name: 'historySearch',
          displayName: '历史消息搜索工具',
          status: 'error',
          durationMs: 90,
          error: 'memory service unavailable',
        },
      ],
    },
  ],
};
assert.deepEqual(
  buildAgentWorkflowResultDiagnostics(partialTraceToolErrorFromTraceOnly).map(
    (item) => `${item.id}:${item.message}`,
  ),
  ['partial-trace:工具错误 1'],
);
assert.match(
  buildAgentWorkflowReadinessChecks(partialTraceToolErrorFromTraceOnly)[0]
    .summary,
  /工具错误 1/,
);
assert.deepEqual(
  buildAgentWorkflowRecommendedActions(partialTraceToolErrorFromTraceOnly).map(
    (item) => item.id,
  ),
  ['fix-tool-errors', 'verify-storage'],
);

const reviewVerdict = buildAgentWorkflowRunVerdict({
  shouldStore: true,
  shouldNotify: false,
  confidence: 0.42,
  matchedRuleRefs: ['manual:manual-1'],
  notificationReview: {
    required: true,
    message: '低置信度关注项命中待复核：42% < 70%',
  },
  storageReview: {
    primaryReason: 'Only notify me when blocker is mentioned',
    reasonSource: 'concernedItemMatcher',
    traceStatus: 'complete',
  },
  agentWorkflowTrace: [
    {
      agentId: 'notificationJudge',
      agentName: '通知判断Agent',
      status: 'success',
      durationMs: 120,
      tools: [
        {
          name: 'concernedItemMatcher',
          displayName: '关注项匹配工具',
          status: 'success',
          durationMs: 90,
        },
      ],
    },
  ],
});
assert.equal(reviewVerdict?.status, 'review');
assert.match(reviewVerdict?.summary || '', /通知\/自动化/);

const externalPlaceholderResult = {
  shouldStore: false,
  shouldNotify: false,
  agentWorkflowTrace: [
    {
      agentId: 'externalInfoFetcher',
      agentName: '外部信息获取Agent',
      status: 'success',
      durationMs: 50,
      tools: [
        {
          name: 'externalServiceQuery',
          displayName: '外部服务查询工具',
          status: 'placeholder',
          durationMs: 20,
          summary: 'success=false, message=不支持的服务或缺少参数',
        },
      ],
    },
  ],
};
const externalPlaceholderChecks = buildAgentWorkflowReadinessChecks(
  externalPlaceholderResult,
);
assert.deepEqual(
  buildAgentWorkflowResultDiagnostics(externalPlaceholderResult).map(
    (item) => item.id,
  ),
  ['external-query-placeholder-runtime'],
);
assert.deepEqual(
  buildAgentWorkflowRecommendedActions(externalPlaceholderResult).map(
    (item) => item.id,
  ),
  ['connect-external-query-adapter'],
);
assert.deepEqual(
  externalPlaceholderChecks.map((item) => `${item.id}:${item.status}`),
  [
    'trace:review',
    'storage:skipped',
    'notification:skipped',
    'external-info:review',
  ],
);
assert.match(externalPlaceholderChecks[0].summary, /占位结果/);
assert.match(externalPlaceholderChecks[3].detail || '', /Jira\/Wiki/);

const slowToolOnlyChecks = buildAgentWorkflowReadinessChecks({
  shouldStore: false,
  shouldNotify: false,
  agentWorkflowTrace: [
    {
      agentId: 'relationshipAnalyzer',
      agentName: '关系分析Agent',
      status: 'success',
      durationMs: 6000,
      tools: [
        {
          name: 'historySearch',
          displayName: '历史消息搜索工具',
          status: 'success',
          durationMs: 6100,
        },
      ],
    },
  ],
});
assert.deepEqual(
  slowToolOnlyChecks.map((item) => `${item.id}:${item.status}`),
  [
    'trace:ready',
    'storage:skipped',
    'notification:skipped',
    'performance:review',
  ],
);
assert.match(slowToolOnlyChecks[3].summary, /历史消息搜索工具 6100ms/);

const skippedOnlyDecisionPath = buildAgentWorkflowDecisionPath({
  shouldStore: true,
  shouldNotify: false,
  summary: 'stored with skipped legacy tool',
  storageReview: {
    primaryReason: 'Important architecture decision',
    reasonSource: 'relevanceJudgment',
    traceStatus: 'partial',
    toolErrorCount: 0,
    toolSkippedCount: 1,
  },
  agentWorkflowTrace: [
    {
      agentId: 'legacy',
      agentName: 'Legacy Agent',
      status: 'skipped',
      durationMs: 5,
      tools: [
        {
          name: 'removedTool',
          status: 'skipped',
          summary: 'tool is not registered',
        },
      ],
    },
  ],
});
assert.deepEqual(
  skippedOnlyDecisionPath.map((item) => item.status),
  ['warning', 'muted', 'warning'],
);
assert.match(skippedOnlyDecisionPath[2].detail || '', /跳过工具 1/);
assert.deepEqual(
  buildAgentWorkflowRecommendedActions({
    shouldStore: true,
    shouldNotify: false,
    summary: 'stored with skipped legacy tool',
    storageReview: {
      primaryReason: 'Important architecture decision',
      reasonSource: 'relevanceJudgment',
      traceStatus: 'partial',
      toolErrorCount: 0,
      toolSkippedCount: 1,
    },
    agentWorkflowTrace: [
      {
        agentId: 'legacy',
        agentName: 'Legacy Agent',
        status: 'skipped',
        durationMs: 5,
        tools: [
          {
            name: 'removedTool',
            status: 'skipped',
            summary: 'tool is not registered',
          },
        ],
      },
    ],
  }).map((item) => item.id),
  ['fix-skipped-tools', 'verify-storage'],
);

const matchedRuleWithoutActionResult = {
  shouldStore: false,
  shouldNotify: false,
  matchedRuleIds: [42],
  agentWorkflowTrace: [
    {
      agentId: 'notificationJudge',
      agentName: '通知判断Agent',
      status: 'success',
      durationMs: 120,
      tools: [
        {
          name: 'concernedItemMatcher',
          displayName: '关注项匹配工具',
          status: 'success',
          durationMs: 90,
        },
      ],
    },
  ],
};
assert.deepEqual(
  buildAgentWorkflowResultDiagnostics(matchedRuleWithoutActionResult).map(
    (item) => item.id,
  ),
  ['matched-rule-without-action'],
);
assert.match(
  buildAgentWorkflowResultDiagnostics(matchedRuleWithoutActionResult)[0]
    .message,
  /42/,
);
assert.deepEqual(
  buildAgentWorkflowDecisionPath(matchedRuleWithoutActionResult).map(
    (item) => `${item.id}:${item.status}`,
  ),
  [
    'watch-rule-match:info',
    'storage-decision:muted',
    'notification-decision:muted',
    'trace-health:success',
  ],
);
assert.deepEqual(
  buildAgentWorkflowRecommendedActions(matchedRuleWithoutActionResult).map(
    (item) => `${item.id}:${item.status}`,
  ),
  ['review-rule-without-action:review'],
);
assert.deepEqual(
  buildAgentWorkflowReadinessChecks(matchedRuleWithoutActionResult).map(
    (item) => `${item.id}:${item.status}`,
  ),
  [
    'trace:ready',
    'storage:skipped',
    'notification:skipped',
    'rule-action:review',
  ],
);

assert.deepEqual(
  buildAgentWorkflowResultDiagnostics({
    shouldStore: false,
    shouldNotify: false,
    storageReview: {
      matchedRuleRefs: ['manual:storage-only-ref'],
    },
    agentWorkflowTrace: matchedRuleWithoutActionResult.agentWorkflowTrace,
  }).map((item) => item.id),
  ['matched-rule-without-action'],
);

const noActionPath = buildAgentWorkflowDecisionPath({
  shouldStore: false,
  shouldNotify: false,
  agentWorkflowTrace: [],
});
assert.deepEqual(
  noActionPath.map((item) => item.id),
  ['storage-decision', 'notification-decision', 'trace-health'],
);
assert.deepEqual(
  noActionPath.map((item) => item.status),
  ['muted', 'muted', 'warning'],
);

assert.equal(buildAgentWorkflowDecisionPath(null).length, 0);
assert.equal(buildAgentWorkflowResultDiagnostics(null).length, 0);
assert.deepEqual(
  buildAgentWorkflowResultDiagnostics({
    shouldStore: false,
    agentWorkflowTrace: [],
  }).map((item) => item.id),
  ['missing-trace'],
);
assert.deepEqual(
  buildAgentWorkflowRecommendedActions({
    shouldStore: false,
    shouldNotify: false,
    agentWorkflowTrace: [
      {
        agentId: 'notificationJudge',
        agentName: '通知判断Agent',
        status: 'success',
        tools: [],
      },
    ],
  }).map((item) => item.id),
  ['no-followup'],
);
const idleVerdict = buildAgentWorkflowRunVerdict({
  shouldStore: false,
  shouldNotify: false,
  agentWorkflowTrace: [
    {
      agentId: 'notificationJudge',
      agentName: '通知判断Agent',
      status: 'success',
      tools: [],
    },
  ],
});
assert.equal(idleVerdict?.status, 'idle');
assert.match(idleVerdict?.summary || '', /不会存储/);

console.log('verify-agent-workflow-diagnostics: ok');
