import assert from 'node:assert/strict';

import {
  buildAgentWorkflowConfigDiagnostics,
  buildAgentWorkflowDecisionPath,
  buildAgentWorkflowResultDiagnostics,
  getAgentWorkflowHighestSeverity,
} from '../src/agentWorkflowDiagnostics.ts';

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

console.log('verify-agent-workflow-diagnostics: ok');
