import assert from 'node:assert/strict';

import {
  buildAgentWorkflowConfigDiagnostics,
  buildAgentWorkflowDecisionPath,
  buildAgentWorkflowNotificationReviewReceipt,
  buildAgentWorkflowOrchestrationReceipt,
  buildAgentWorkflowRecommendedActions,
  buildAgentWorkflowReadinessChecks,
  buildAgentWorkflowResultDiagnostics,
  buildAgentWorkflowRunEvidencePacket,
  buildAgentWorkflowRunVerdict,
  buildAgentWorkflowStructuralCoverage,
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

const structuralCovered = buildAgentWorkflowStructuralCoverage(
  {
    agentWorkflowTrace: [
      {
        agentId: 'entity',
        agentName: 'Entity',
        status: 'success',
        tools: [{ name: 'entityExtraction', status: 'success' }],
      },
      {
        agentId: 'relationship',
        agentName: 'Relationship',
        status: 'success',
        tools: [{ name: 'relationshipAnalysis', status: 'success' }],
      },
    ],
  },
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
);
assert.equal(structuralCovered?.status, 'covered');
assert.match(structuralCovered?.summary || '', /Agent 2\/2、工具 2\/2/);

const structuralPartial = buildAgentWorkflowStructuralCoverage(
  {
    agentWorkflowTrace: [
      {
        agentId: 'entity',
        agentName: 'Entity',
        status: 'success',
        tools: [{ name: 'entityExtraction', status: 'success' }],
      },
      {
        agentId: 'external',
        agentName: 'External',
        status: 'success',
        tools: [{ name: 'externalServiceQuery', status: 'placeholder' }],
      },
    ],
  },
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
    {
      id: 'external',
      name: 'External',
      enabled: true,
      priority: 70,
      tools: ['externalServiceQuery'],
    },
  ],
);
assert.equal(structuralPartial?.status, 'partial');
assert.match(structuralPartial?.summary || '', /Agent 2\/3、工具 2\/3/);
assert.deepEqual(structuralPartial?.missingAgents, ['Relationship']);
assert.match(structuralPartial?.summary || '', /占位工具 1/);

const partialOrchestrationReceipt = buildAgentWorkflowOrchestrationReceipt(
  {
    shouldStore: true,
    shouldNotify: false,
    storageReview: {
      traceStatus: 'partial',
      primaryReason: 'Only notify me when blocker is mentioned',
      toolPlaceholderCount: 1,
    },
    agentWorkflowTrace: [
      {
        agentId: 'entity',
        agentName: 'Entity',
        status: 'success',
        tools: [{ name: 'entityExtraction', status: 'success' }],
      },
      {
        agentId: 'external',
        agentName: 'External',
        status: 'success',
        tools: [{ name: 'externalServiceQuery', status: 'placeholder' }],
      },
    ],
  },
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
    {
      id: 'external',
      name: 'External',
      enabled: true,
      priority: 70,
      tools: ['externalServiceQuery'],
    },
  ],
);
assert.equal(partialOrchestrationReceipt?.status, 'review');
assert.equal(partialOrchestrationReceipt?.title, '编排需复核');
assert.match(partialOrchestrationReceipt?.summary || '', /Agent 2\/3/);
assert.match(partialOrchestrationReceipt?.summary || '', /工具 2\/3/);
assert.match(partialOrchestrationReceipt?.detail || '', /占位工具 1/);
assert.match(partialOrchestrationReceipt?.detail || '', /缺阶段 Relationship/);
assert.match(
  partialOrchestrationReceipt?.boundary || '',
  /不会写入 Memory Service、发送通知或执行规则自动化/,
);
assert.ok(partialOrchestrationReceipt?.chips.includes('本地测试'));

const structuralMissing = buildAgentWorkflowStructuralCoverage(
  { agentWorkflowTrace: [] },
  [
    {
      id: 'entity',
      name: 'Entity',
      enabled: true,
      priority: 100,
      tools: ['entityExtraction'],
    },
  ],
);
assert.equal(structuralMissing?.status, 'missing');

const blockedOrchestrationReceipt = buildAgentWorkflowOrchestrationReceipt(
  { shouldStore: false, shouldNotify: false, agentWorkflowTrace: [] },
  [
    {
      id: 'entity',
      name: 'Entity',
      enabled: true,
      priority: 100,
      tools: ['entityExtraction'],
    },
  ],
);
assert.equal(blockedOrchestrationReceipt?.status, 'blocked');
assert.equal(blockedOrchestrationReceipt?.title, '编排未达门禁');
assert.match(blockedOrchestrationReceipt?.summary || '', /Agent 0\/1/);
assert.match(blockedOrchestrationReceipt?.summary || '', /工具 0\/1/);

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
assert.equal(resultDiagnostics[0].title, '通知复核候选');
assert.match(resultDiagnostics[0].detail || '', /本地复核候选/);
assert.match(resultDiagnostics[0].detail || '', /不会创建真实复核队列项/);

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
assert.match(decisionPath[2].detail || '', /真实复核入口尚未创建/);
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
assert.equal(recommendedActions[0].title, '确认本地复核候选');
assert.match(recommendedActions[0].detail || '', /不会创建真实复核队列项/);
assert.match(recommendedActions[1].summary, /重要性判断Agent/);

const notificationReviewReceipt = buildAgentWorkflowNotificationReviewReceipt({
  shouldStore: true,
  shouldNotify: false,
  confidence: 0.42,
  matchedRuleRefs: ['manual:manual-1'],
  notificationReview: {
    required: true,
    message: '低置信度关注项命中待复核：42% < 70%',
  },
});
assert.equal(notificationReviewReceipt?.title, '通知复核候选');
assert.match(notificationReviewReceipt?.detail || '', /manual:manual-1/);
assert.match(notificationReviewReceipt?.detail || '', /置信度 42%/);
assert.match(notificationReviewReceipt?.boundary || '', /本地复核候选/);
assert.match(notificationReviewReceipt?.boundary || '', /不会写入 Memory Service/);

const rawEvidenceInput =
  'API split has a blocker in the auth adapter. Please keep this on the radar today.';
const runEvidencePacket = buildAgentWorkflowRunEvidencePacket(
  {
    shouldStore: true,
    shouldNotify: true,
    confidence: 0.88,
    matchedRuleRefs: ['manual:manual-1'],
    summary: 'API split has a blocker in the auth adapter',
    storageReview: {
      traceStatus: 'partial',
      primaryReason: 'Please keep this on the radar today',
      toolSkippedCount: 1,
      matchedRuleRefs: ['manual:manual-1'],
    },
    agentWorkflowTrace: [
      {
        agentId: 'entity',
        agentName: 'Entity',
        status: 'success',
        tools: [{ name: 'entityExtraction', status: 'success' }],
      },
      {
        agentId: 'external',
        agentName: 'External',
        status: 'success',
        tools: [{ name: 'externalServiceQuery', status: 'placeholder' }],
      },
    ],
  },
  [
    {
      id: 'entity',
      name: 'Entity',
      enabled: true,
      priority: 100,
      tools: ['entityExtraction'],
    },
    {
      id: 'external',
      name: 'External',
      enabled: true,
      priority: 70,
      tools: ['externalServiceQuery'],
    },
  ],
  {
    generatedAt: '2026-06-26T00:00:00.000Z',
    stale: true,
    staleReason: '当前输入已修改',
    sourceLabel: 'Options 关注项测试 · 保存样例',
    redactedInputContent: rawEvidenceInput,
  },
);
assert.equal(runEvidencePacket?.title, '单次运行证据包（旧快照）');
assert.match(runEvidencePacket?.summary || '', /旧快照/);
assert.equal(runEvidencePacket?.qualification.status, 'stale');
assert.equal(runEvidencePacket?.qualification.title, '证据需重跑');
assert.match(runEvidencePacket?.detail || '', /结构覆盖 Agent 2\/2、工具 2\/2/);
assert.match(runEvidencePacket?.detail || '', /证据资格 证据需重跑：当前输入已修改/);
assert.ok(runEvidencePacket?.chips.includes('证据 证据需重跑'));
assert.match(runEvidencePacket?.text || '', /生成时间: 2026-06-26T00:00:00.000Z/);
assert.match(runEvidencePacket?.text || '', /快照状态: 旧快照/);
assert.match(runEvidencePacket?.text || '', /来源: Options 关注项测试 · 保存样例/);
assert.match(runEvidencePacket?.text || '', /证据资格: 证据需重跑 - 当前输入已修改/);
assert.match(runEvidencePacket?.text || '', /资格说明: 这份证据包只能说明上一次运行/);
assert.match(runEvidencePacket?.text || '', /匹配规则: manual:manual-1/);
assert.match(runEvidencePacket?.text || '', /存储: 是/);
assert.match(runEvidencePacket?.text || '', /通知: 发送/);
assert.match(runEvidencePacket?.text || '', /置信度: 88%/);
assert.match(runEvidencePacket?.text || '', /运行就绪:/);
assert.match(runEvidencePacket?.text || '', /下一步:/);
assert.match(runEvidencePacket?.text || '', /不会写入 Memory Service/);
assert.match(runEvidencePacket?.text || '', /不会发送通知/);
assert.match(runEvidencePacket?.text || '', /不会执行规则自动化/);
assert.match(runEvidencePacket?.text || '', /不会包含原始消息正文或工具参数/);
assert.match(runEvidencePacket?.text || '', /已省略测试消息片段/);
assert.doesNotMatch(
  runEvidencePacket?.text || '',
  /API split has a blocker/i,
);
assert.doesNotMatch(
  runEvidencePacket?.text || '',
  /keep this on the radar today/i,
);

const readyEvidencePacket = buildAgentWorkflowRunEvidencePacket(
  {
    shouldStore: false,
    shouldNotify: false,
    confidence: 0.99,
    agentWorkflowTrace: [
      {
        agentId: 'entity',
        agentName: 'Entity',
        status: 'success',
        tools: [{ name: 'entityExtraction', status: 'success' }],
      },
    ],
  },
  [
    {
      id: 'entity',
      name: 'Entity',
      enabled: true,
      priority: 100,
      tools: ['entityExtraction'],
    },
  ],
  {
    qualification: {
      status: 'ready',
      title: '可作本地回归证据',
      summary: '当前结果匹配保存样例、已有基线且 Agent 配置一致',
      detail: '可作为本地发布前门禁证据。',
    },
  },
);
assert.equal(readyEvidencePacket?.qualification.status, 'ready');
assert.match(readyEvidencePacket?.detail || '', /可作本地回归证据/);
assert.match(readyEvidencePacket?.text || '', /证据资格: 可作本地回归证据/);

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
  ['partial-trace:工具错误 关系分析Agent / 历史消息搜索工具'],
);
assert.match(
  buildAgentWorkflowResultDiagnostics(partialTraceToolErrorFromTraceOnly)[0]
    .detail || '',
  /Agent \/ 工具错误/,
);
assert.match(
  buildAgentWorkflowReadinessChecks(partialTraceToolErrorFromTraceOnly)[0]
    .summary,
  /工具错误 关系分析Agent \/ 历史消息搜索工具/,
);
assert.deepEqual(
  buildAgentWorkflowRecommendedActions(partialTraceToolErrorFromTraceOnly).map(
    (item) => item.id,
  ),
  ['fix-tool-errors', 'verify-storage'],
);
assert.match(
  buildAgentWorkflowRecommendedActions(partialTraceToolErrorFromTraceOnly)[0]
    .summary,
  /关系分析Agent \/ 历史消息搜索工具/,
);

const placeholderCountWithoutTraceLabels = {
  shouldStore: true,
  shouldNotify: false,
  confidence: 0.8,
  storageReview: {
    primaryReason: 'External context may affect this message',
    reasonSource: 'workflow',
    traceStatus: 'partial',
    toolPlaceholderCount: 2,
  },
  agentWorkflowTrace: [
    {
      agentId: 'externalInfo',
      agentName: '外部信息获取Agent',
      status: 'success',
      durationMs: 120,
      tools: [
        {
          name: 'externalServiceQuery',
          displayName: '外部服务查询工具',
          status: 'success',
          durationMs: 90,
        },
      ],
    },
  ],
};
assert.deepEqual(
  buildAgentWorkflowResultDiagnostics(placeholderCountWithoutTraceLabels).map(
    (item) => `${item.id}:${item.message}`,
  ),
  ['external-query-placeholder-runtime:占位工具 2'],
);
assert.match(
  buildAgentWorkflowResultDiagnostics(placeholderCountWithoutTraceLabels)[0]
    .detail || '',
  /当前 trace 快照没有具体 Agent \/ Tool 标签/,
);
assert.match(
  buildAgentWorkflowDecisionPath(placeholderCountWithoutTraceLabels)[2]
    .detail || '',
  /占位工具 2/,
);
assert.deepEqual(
  buildAgentWorkflowReadinessChecks(placeholderCountWithoutTraceLabels).map(
    (item) => `${item.id}:${item.status}`,
  ),
  ['trace:review', 'storage:review', 'notification:skipped'],
);
assert.match(
  buildAgentWorkflowReadinessChecks(placeholderCountWithoutTraceLabels)[0]
    .summary,
  /有 2 个工具仍是占位结果/,
);
assert.deepEqual(
  buildAgentWorkflowRecommendedActions(placeholderCountWithoutTraceLabels).map(
    (item) => item.id,
  ),
  ['connect-external-query-adapter', 'verify-storage'],
);
assert.match(
  buildAgentWorkflowRecommendedActions(placeholderCountWithoutTraceLabels)[0]
    .summary,
  /占位工具 2/,
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
