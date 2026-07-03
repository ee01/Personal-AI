import assert from 'node:assert/strict';

import {
  AGENT_WORKFLOW_TEST_SCENARIOS,
  buildAgentWorkflowResultExpectation,
  buildAgentWorkflowAgentConfigSnapshot,
  buildAgentWorkflowScenarioSourceReceipt,
  buildAgentWorkflowReplaySourceReceipt,
  buildAgentWorkflowRunScopeReceipt,
  buildAgentWorkflowSavedRegressionCoverageReceipt,
  buildAgentWorkflowSavedRegressionScopeReceipt,
  buildAgentWorkflowSavedScenarioSourceReceipt,
  buildAgentWorkflowSavedScenario,
  buildAgentWorkflowScenarioInput,
  formatAgentWorkflowAgentConfigSnapshot,
  buildAgentWorkflowReplayMessage,
  buildAgentWorkflowReplayMessages,
  formatAgentWorkflowDatetimeInputValue,
  formatAgentWorkflowRegressionFailureDetail,
  formatAgentWorkflowReplayLabel,
  formatAgentWorkflowSavedScenarioLabel,
  getAgentWorkflowTraceStatus,
  normalizeAgentWorkflowSavedScenarios,
  normalizeAgentWorkflowInputDatetime,
} from '../src/agentWorkflowReplay.ts';

const timestamp = Date.parse('2026-05-03T09:30:00.000Z');

const directMessage = buildAgentWorkflowReplayMessage({
  id: 'memory-1',
  type: 'message',
  content: '  Please review the API split blocker today.  ',
  source: 'glip',
  sourceTitle: 'Architecture',
  timestamp,
  score: 0.91,
  metadata: {
    sender: 'Morgan Chen',
    groupName: 'Architecture',
    groupId: 'team-architecture',
  },
});

assert.deepEqual(directMessage, {
  id: 'memory-1',
  sender: 'Morgan Chen',
  teamName: 'Architecture',
  teamId: 'team-architecture',
  content: 'Please review the API split blocker today.',
  datetime: '2026-05-03T09:30:00.000Z',
  sourceTitle: 'Architecture',
  source: 'glip',
  score: 0.91,
});

const metadataOnly = buildAgentWorkflowReplayMessage({
  metadata: {
    creator: 'Priya Shah',
    team_name: 'SDK Updates',
    team_id: 'sdk-updates',
    message_content: 'migration guide 发布了吗？',
    datetime: '2026-05-03T10:00:00.000Z',
  },
});

assert.equal(metadataOnly?.sender, 'Priya Shah');
assert.equal(metadataOnly?.teamName, 'SDK Updates');
assert.equal(metadataOnly?.teamId, 'sdk-updates');
assert.equal(metadataOnly?.content, 'migration guide 发布了吗？');
assert.equal(metadataOnly?.datetime, '2026-05-03T10:00:00.000Z');

const secondsTimestamp = buildAgentWorkflowReplayMessage({
  id: 'memory-seconds',
  content: 'Memory service stores timestamps in seconds.',
  timestamp: Math.floor(Date.parse('2026-05-03T11:15:00.000Z') / 1000),
  metadata: {
    sender: 'Avery Wong',
    group_id: 'escalations',
    groupName: 'Escalations',
  },
});

assert.equal(secondsTimestamp?.datetime, '2026-05-03T11:15:00.000Z');
assert.equal(secondsTimestamp?.teamId, 'escalations');

const metadataTimestamp = buildAgentWorkflowReplayMessage({
  content: 'Metadata timestamp can also be seconds.',
  metadata: {
    sender: 'Lee',
    teamName: 'Release',
    timestamp: String(Math.floor(Date.parse('2026-05-03T11:30:00.000Z') / 1000)),
  },
});

assert.equal(metadataTimestamp?.datetime, '2026-05-03T11:30:00.000Z');

const metadataTimestampMs = buildAgentWorkflowReplayMessage({
  content: 'Metadata timestamp can also be milliseconds.',
  metadata: {
    sender: 'Jordan',
    teamName: 'Runtime',
    timestamp_ms: Date.parse('2026-05-03T12:30:00.000Z'),
  },
});

assert.equal(metadataTimestampMs?.datetime, '2026-05-03T12:30:00.000Z');

const metadataMessageDatetime = buildAgentWorkflowReplayMessage({
  content: 'Message datetime metadata should be preferred.',
  timestamp: Date.parse('2026-05-03T13:30:00.000Z'),
  metadata: {
    sender: 'Casey',
    teamName: 'Replay',
    message_datetime: '2026-05-03T13:00:00.000Z',
  },
});

assert.equal(metadataMessageDatetime?.datetime, '2026-05-03T13:00:00.000Z');

const datetimeInputValue = formatAgentWorkflowDatetimeInputValue(
  '2026-05-03T09:30:00.000Z',
);
assert.match(datetimeInputValue, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/);
assert.equal(
  normalizeAgentWorkflowInputDatetime(datetimeInputValue),
  '2026-05-03T09:30:00.000Z',
);

const messages = buildAgentWorkflowReplayMessages(
  [
    {
      id: 'duplicate-a',
      content: 'same message',
      metadata: {
        sender: 'Avery',
        groupName: 'Escalations',
        datetime: '2026-05-03T11:00:00.000Z',
      },
    },
    {
      id: 'duplicate-b',
      previewText: 'same message',
      metadata: {
        sender: 'Avery',
        groupName: 'Escalations',
        datetime: '2026-05-03T11:00:00.000Z',
      },
    },
    {
      id: 'empty',
      content: '   ',
      metadata: { sender: 'No Content' },
    },
    {
      id: 'unique',
      displayText: 'new evidence message',
      metadata: {
        sender: 'Lee',
        teamName: 'Release',
        datetime: '2026-05-03T12:00:00.000Z',
      },
    },
  ],
  4,
);

assert.equal(messages.length, 2);
assert.deepEqual(
  messages.map((message) => message.id),
  ['duplicate-a', 'unique'],
);

assert.match(
  formatAgentWorkflowReplayLabel(directMessage!),
  /Morgan Chen @ Architecture \(glip \/ 相似度 91%\) \| Please review/,
);

const scenario = AGENT_WORKFLOW_TEST_SCENARIOS.find(
  (item) => item.id === 'low-confidence-review',
);
assert.ok(scenario);
const scenarioInput = buildAgentWorkflowScenarioInput(
  scenario,
  new Date('2026-05-03T14:00:00.000Z'),
);
assert.equal(scenarioInput.sender, 'Avery Wong');
assert.equal(scenarioInput.teamId, 'escalations');
assert.equal(
  normalizeAgentWorkflowInputDatetime(scenarioInput.datetime),
  '2026-05-03T14:00:00.000Z',
);
assert.match(scenarioInput.content, /blocker thread/);

const workflowAgents = [
  {
    id: 'notificationJudge',
    name: '通知判断Agent',
    enabled: true,
    priority: 95,
    tools: ['concernedItemMatcher'],
  },
  {
    id: 'relevanceJudge',
    name: '重要性判断Agent',
    enabled: true,
    priority: 80,
    tools: ['relevanceJudgment'],
  },
];

const savedScenario = buildAgentWorkflowSavedScenario(
  {
    sender: 'Morgan Chen',
    teamName: 'Architecture',
    teamId: 'architecture',
    datetime: '2026-05-03T15:00:00.000Z',
    content: 'API split blocker should stay on the radar.',
  },
  {
    shouldStore: true,
    shouldNotify: true,
    confidence: '88%',
    matchedRuleRefs: ['manual:manual-1'],
    matchedRuleIds: [],
    summary: 'manual blocker watch rule matched',
    storageReview: {
      traceStatus: 'partial',
      matchedRuleRefs: ['manual:manual-1'],
    },
  },
  new Date('2026-05-03T15:01:00.000Z'),
  workflowAgents,
);

assert.equal(savedScenario.id, 'workflow-saved-1777820460000');
assert.equal(
  normalizeAgentWorkflowInputDatetime(savedScenario.input.datetime),
  '2026-05-03T15:00:00.000Z',
);
assert.equal(savedScenario.expectedResult?.confidence, 0.88);
assert.equal(savedScenario.expectedResult?.shouldNotify, true);
assert.equal(savedScenario.expectedResult?.traceStatus, 'partial');
assert.match(
  savedScenario.expectedResult?.diagnosticSnapshot?.summary || '',
  /执行 Trace/,
);
assert.equal(
  savedScenario.expectedResult?.diagnosticSnapshot?.verdict?.status,
  'blocked',
);
assert.deepEqual(savedScenario.expectedResult?.matchedRuleRefs, [
  'manual:manual-1',
]);
assert.match(
  formatAgentWorkflowSavedScenarioLabel(savedScenario),
  /有基线 \| Morgan Chen @ Architecture/,
);

const emptyCoverageReceipt =
  buildAgentWorkflowSavedRegressionCoverageReceipt();
assert.equal(emptyCoverageReceipt.title, '回归样本构成');
assert.equal(emptyCoverageReceipt.tone, 'review');
assert.match(emptyCoverageReceipt.summary, /还没有保存样例/);
assert.match(emptyCoverageReceipt.detail, /不读取 Memory Service/);

const notificationOnlyCoverageReceipt =
  buildAgentWorkflowSavedRegressionCoverageReceipt({
    scenarios: [savedScenario],
  });
assert.equal(notificationOnlyCoverageReceipt.tone, 'review');
assert.match(notificationOnlyCoverageReceipt.summary, /保存样例 1 个/);
assert.match(notificationOnlyCoverageReceipt.summary, /通知 1 \/ 复核 0 \/ 存储-only 0/);
assert.match(notificationOnlyCoverageReceipt.detail, /补充 低置信复核、存储-only 样例/);
assert.ok(notificationOnlyCoverageReceipt.chips.includes('Trace需复核 1'));

const reviewScenario = buildAgentWorkflowSavedScenario(
  {
    sender: 'Avery Wong',
    teamName: 'Escalations',
    teamId: 'escalations',
    datetime: '2026-05-03T15:30:00.000Z',
    content: 'This may relate to the blocker thread but confidence is low.',
  },
  {
    shouldStore: true,
    shouldNotify: false,
    notificationReview: { required: true },
    confidence: 0.42,
    matchedRuleRefs: ['manual:manual-1'],
    storageReview: {
      traceStatus: 'complete',
      matchedRuleRefs: ['manual:manual-1'],
    },
  },
  new Date('2026-05-03T15:31:00.000Z'),
  workflowAgents,
);
const storageOnlyScenario = buildAgentWorkflowSavedScenario(
  {
    sender: 'Priya Shah',
    teamName: 'SDK Updates',
    teamId: 'sdk-updates',
    datetime: '2026-05-03T15:45:00.000Z',
    content: 'Architecture decision: keep the migration guide as source of truth.',
  },
  {
    shouldStore: true,
    shouldNotify: false,
    confidence: null,
    storageReview: {
      traceStatus: 'complete',
      reasonSource: 'relevanceJudgment',
    },
  },
  new Date('2026-05-03T15:46:00.000Z'),
  workflowAgents,
);
const readyCoverageReceipt =
  buildAgentWorkflowSavedRegressionCoverageReceipt({
    scenarios: [savedScenario, reviewScenario, storageOnlyScenario],
  });
assert.equal(readyCoverageReceipt.tone, 'ready');
assert.match(readyCoverageReceipt.summary, /保存样例 3 个/);
assert.match(readyCoverageReceipt.summary, /通知 1 \/ 复核 1 \/ 存储-only 1/);
assert.match(readyCoverageReceipt.detail, /通知、复核、存储-only 和规则归因路径都有本地样例/);
assert.ok(readyCoverageReceipt.chips.includes('配置版本 1'));

const scenarioReceipt = buildAgentWorkflowScenarioSourceReceipt(scenario);
assert.equal(scenarioReceipt.title, '内置样例范围');
assert.equal(scenarioReceipt.tone, 'review');
assert.match(scenarioReceipt.summary, /待复核/);
assert.match(scenarioReceipt.detail, /不会写入 Memory Service/);
assert.ok(scenarioReceipt.chips.includes('低置信度复核'));

const replayReceipt = buildAgentWorkflowReplaySourceReceipt(directMessage);
assert.equal(replayReceipt.title, '最近消息回放范围');
assert.match(replayReceipt.summary, /Morgan Chen @ Architecture/);
assert.match(replayReceipt.detail, /不会发送通知或执行规则自动化/);
assert.ok(replayReceipt.chips.includes('glip'));
assert.ok(replayReceipt.chips.includes('相似度 91%'));

const emptyReplayReceipt = buildAgentWorkflowReplaySourceReceipt(null);
assert.match(emptyReplayReceipt.summary, /尚未选中可回放消息/);
assert.ok(emptyReplayReceipt.chips.includes('time 召回'));

const savedScenarioReceipt =
  buildAgentWorkflowSavedScenarioSourceReceipt(savedScenario);
assert.equal(savedScenarioReceipt.title, '保存样例基线范围');
assert.equal(savedScenarioReceipt.tone, 'ready');
assert.match(savedScenarioReceipt.summary, /已有结果基线/);
assert.match(savedScenarioReceipt.detail, /只存在本地 storage/);
assert.ok(savedScenarioReceipt.chips.includes('有基线'));

const savedScenarioCurrentReceipt =
  buildAgentWorkflowSavedScenarioSourceReceipt(savedScenario, {
    currentInputMatchesScenario: true,
    hasResult: true,
    resultMatchesScenario: true,
    resultIsStale: false,
  });
assert.equal(savedScenarioCurrentReceipt.tone, 'ready');
assert.match(savedScenarioCurrentReceipt.summary, /当前结果属于这条保存样例/);
assert.ok(savedScenarioCurrentReceipt.chips.includes('当前结果可比'));

const changedInputReceipt = buildAgentWorkflowSavedScenarioSourceReceipt(
  savedScenario,
  {
    currentInputMatchesScenario: false,
    hasResult: true,
    resultMatchesScenario: true,
    resultIsStale: true,
  },
);
assert.equal(changedInputReceipt.title, '保存样例输入边界');
assert.equal(changedInputReceipt.tone, 'review');
assert.match(changedInputReceipt.summary, /当前输入不是所选保存样例/);
assert.ok(changedInputReceipt.chips.includes('输入已变更'));

const staleResultReceipt = buildAgentWorkflowSavedScenarioSourceReceipt(
  savedScenario,
  {
    currentInputMatchesScenario: true,
    hasResult: true,
    resultMatchesScenario: true,
    resultIsStale: true,
  },
);
assert.equal(staleResultReceipt.tone, 'review');
assert.match(staleResultReceipt.summary, /上一次结果已过期/);
assert.ok(staleResultReceipt.chips.includes('结果已过期'));

const noBaselineReceipt = buildAgentWorkflowSavedScenarioSourceReceipt({
  ...savedScenario,
  expectedResult: undefined,
});
assert.equal(noBaselineReceipt.tone, 'review');
assert.match(noBaselineReceipt.summary, /尚无结果基线/);

const noBaselineCurrentReceipt = buildAgentWorkflowSavedScenarioSourceReceipt(
  {
    ...savedScenario,
    expectedResult: undefined,
  },
  {
    currentInputMatchesScenario: true,
    hasResult: true,
    resultMatchesScenario: true,
    resultIsStale: false,
  },
);
assert.equal(noBaselineCurrentReceipt.tone, 'review');
assert.match(noBaselineCurrentReceipt.summary, /本次结果属于这条保存样例/);
assert.ok(noBaselineCurrentReceipt.chips.includes('可建立基线'));

const expectationWithStructure = buildAgentWorkflowResultExpectation(
  {
    shouldStore: true,
    shouldNotify: false,
    agentWorkflowTrace: [
      {
        agentId: 'entityRecognizer',
        agentName: '实体识别 Agent',
        status: 'success',
        tools: [{ name: 'entityExtraction', status: 'success' }],
      },
      {
        agentId: 'notificationJudge',
        agentName: '通知判断 Agent',
        status: 'success',
        tools: [{ name: 'concernedItemMatcher', status: 'success' }],
      },
    ],
  },
  new Date('2026-05-03T15:02:00.000Z'),
  [
    {
      id: 'entityRecognizer',
      name: '实体识别 Agent',
      enabled: true,
      priority: 100,
      tools: ['entityExtraction'],
    },
    {
      id: 'notificationJudge',
      name: '通知判断 Agent',
      enabled: true,
      priority: 95,
      tools: ['concernedItemMatcher'],
    },
  ],
);
assert.equal(
  expectationWithStructure?.diagnosticSnapshot?.structuralCoverage?.status,
  'covered',
);
assert.match(
  expectationWithStructure?.diagnosticSnapshot?.summary || '',
  /结构覆盖 Agent 2\/2、工具 2\/2/,
);

const expectationFromTrace = buildAgentWorkflowResultExpectation({
  shouldStore: false,
  shouldNotify: false,
  agentWorkflowTrace: [
    {
      status: 'success',
      tools: [{ status: 'success' }],
    },
  ],
});
assert.equal(expectationFromTrace?.traceStatus, 'complete');

const placeholderTraceResult = {
  shouldStore: false,
  shouldNotify: false,
  agentWorkflowTrace: [
    {
      status: 'success',
      tools: [
        {
          name: 'externalServiceQuery',
          status: 'placeholder',
          summary: 'success=false, message=不支持的服务或缺少参数',
        },
      ],
    },
  ],
};
assert.equal(getAgentWorkflowTraceStatus(placeholderTraceResult), 'partial');
assert.equal(
  buildAgentWorkflowResultExpectation(placeholderTraceResult)?.traceStatus,
  'partial',
);

const workflowAgents = [
  {
    id: 'entityRecognizer',
    name: '实体识别 Agent',
    enabled: true,
    priority: 100,
    tools: ['entityExtraction'],
  },
  {
    id: 'notificationJudge',
    name: '通知判断 Agent',
    enabled: true,
    priority: 95,
    tools: ['concernedItemMatcher'],
  },
];
const agentConfigSnapshot = buildAgentWorkflowAgentConfigSnapshot(workflowAgents);
assert.equal(agentConfigSnapshot?.enabledAgentCount, 2);
assert.equal(agentConfigSnapshot?.enabledToolCount, 2);
assert.equal(
  formatAgentWorkflowAgentConfigSnapshot(agentConfigSnapshot),
  'Agent 2/2 / 工具 2 / 首阶段 实体识别 Agent',
);

const runScopeReceipt = buildAgentWorkflowRunScopeReceipt({
  input: savedScenario.input,
  agentConfig: agentConfigSnapshot,
  savedScenarioCount: 1,
  selectedSavedScenarioHasBaseline: true,
  currentInputMatchesSavedScenario: true,
  agentConfigMatchesSavedBaseline: true,
});
assert.equal(runScopeReceipt.title, '运行前范围');
assert.equal(runScopeReceipt.tone, 'ready');
assert.match(runScopeReceipt.summary, /Morgan Chen @ Architecture/);
assert.match(runScopeReceipt.summary, /本地门禁可用/);
assert.match(runScopeReceipt.detail, /运行测试只重跑当前表单/);
assert.match(runScopeReceipt.detail, /作为发布前证据/);
assert.match(runScopeReceipt.detail, /不会写入 Memory Service/);
assert.match(runScopeReceipt.detail, /不会发送通知/);
assert.match(runScopeReceipt.detail, /不会执行规则自动化/);
assert.match(runScopeReceipt.detail, /不会.*覆盖基线/);
assert.ok(runScopeReceipt.chips.includes('当前表单可运行'));
assert.ok(runScopeReceipt.chips.includes('门禁可用'));
assert.ok(runScopeReceipt.chips.includes('保存样例 1'));
assert.ok(runScopeReceipt.chips.includes('本地测试无外发'));

const noSavedRunScopeReceipt = buildAgentWorkflowRunScopeReceipt({
  input: savedScenario.input,
  agentConfig: agentConfigSnapshot,
  savedScenarioCount: 0,
});
assert.equal(noSavedRunScopeReceipt.tone, 'ready');
assert.match(noSavedRunScopeReceipt.summary, /本地门禁未建立/);
assert.ok(noSavedRunScopeReceipt.chips.includes('门禁未建立'));

const configChangedRunScopeReceipt = buildAgentWorkflowRunScopeReceipt({
  input: savedScenario.input,
  agentConfig: agentConfigSnapshot,
  savedScenarioCount: 1,
  selectedSavedScenarioHasBaseline: true,
  currentInputMatchesSavedScenario: true,
  agentConfigMatchesSavedBaseline: false,
});
assert.equal(configChangedRunScopeReceipt.tone, 'review');
assert.match(configChangedRunScopeReceipt.summary, /Agent 配置和当前配置不同/);
assert.ok(configChangedRunScopeReceipt.chips.includes('门禁配置变更'));

const emptyRunScopeReceipt = buildAgentWorkflowRunScopeReceipt({
  input: { ...savedScenario.input, content: '' },
  agentConfig: agentConfigSnapshot,
  resultIsStale: true,
});
assert.equal(emptyRunScopeReceipt.tone, 'review');
assert.match(emptyRunScopeReceipt.summary, /缺少测试消息/);
assert.ok(emptyRunScopeReceipt.chips.includes('等待测试消息'));
assert.ok(emptyRunScopeReceipt.chips.includes('门禁待输入'));
assert.ok(emptyRunScopeReceipt.chips.includes('上次结果需重跑'));

const emptyRegressionScopeReceipt = buildAgentWorkflowSavedRegressionScopeReceipt({
  savedScenarioCount: 0,
});
assert.equal(emptyRegressionScopeReceipt.title, '批量回归范围');
assert.equal(emptyRegressionScopeReceipt.tone, 'review');
assert.match(emptyRegressionScopeReceipt.summary, /暂无保存样例/);
assert.match(emptyRegressionScopeReceipt.detail, /不会读取 Memory Service/);
assert.ok(emptyRegressionScopeReceipt.chips.includes('保存样例 0'));

const readyRegressionScopeReceipt = buildAgentWorkflowSavedRegressionScopeReceipt({
  savedScenarioCount: 2,
});
assert.equal(readyRegressionScopeReceipt.tone, 'ready');
assert.match(readyRegressionScopeReceipt.summary, /可批量回归 2 个/);
assert.match(readyRegressionScopeReceipt.detail, /不会覆盖基线/);
assert.match(readyRegressionScopeReceipt.detail, /不会发送通知/);
assert.ok(readyRegressionScopeReceipt.chips.includes('无真实副作用'));

const runningRegressionScopeReceipt = buildAgentWorkflowSavedRegressionScopeReceipt({
  savedScenarioCount: 2,
  running: true,
  currentIndex: 1,
  currentLabel: 'Morgan Chen @ Architecture | blocker',
});
assert.equal(runningRegressionScopeReceipt.tone, 'review');
assert.match(runningRegressionScopeReceipt.summary, /正在本地批量回归 1\/2/);
assert.match(runningRegressionScopeReceipt.summary, /Morgan Chen/);
assert.match(runningRegressionScopeReceipt.detail, /运行中不会覆盖基线/);
assert.match(runningRegressionScopeReceipt.detail, /不会标记原消息已读/);
assert.ok(runningRegressionScopeReceipt.chips.includes('批量运行中'));
assert.ok(runningRegressionScopeReceipt.chips.includes('当前 1/2'));

const completedRegressionScopeReceipt = buildAgentWorkflowSavedRegressionScopeReceipt({
  savedScenarioCount: 3,
  summary: {
    total: 3,
    same: 1,
    changed: 1,
    noBaseline: 1,
    failed: 0,
  },
});
assert.equal(completedRegressionScopeReceipt.tone, 'review');
assert.match(
  completedRegressionScopeReceipt.summary,
  /通过 1 \/ 变化 1 \/ 无基线 1 \/ 失败 0/,
);
assert.match(completedRegressionScopeReceipt.detail, /导出报告需要用户单独点击/);
assert.match(completedRegressionScopeReceipt.detail, /失败项不会被覆盖/);
assert.match(completedRegressionScopeReceipt.detail, /不会复制原始消息正文/);
assert.ok(completedRegressionScopeReceipt.chips.includes('等待人工接受基线'));

const normalizedSavedScenarios = normalizeAgentWorkflowSavedScenarios(
  [
    savedScenario,
    {
      ...savedScenario,
      id: 'duplicate-by-input',
    },
    {
      id: 'invalid',
      input: {
        content: '   ',
      },
    },
  ],
  4,
);
assert.equal(normalizedSavedScenarios.length, 1);
assert.equal(normalizedSavedScenarios[0].id, savedScenario.id);
assert.equal(normalizedSavedScenarios[0].expectedResult?.confidence, 0.88);
assert.equal(
  normalizedSavedScenarios[0].expectedResult?.diagnosticSnapshot?.verdict
    ?.status,
  'blocked',
);

const savedScenarioWithConfig = buildAgentWorkflowSavedScenario(
  savedScenario.input,
  {
    shouldStore: true,
    shouldNotify: false,
    agentWorkflowTrace: [
      {
        agentId: 'entityRecognizer',
        agentName: '实体识别 Agent',
        status: 'success',
        tools: [{ name: 'entityExtraction', status: 'success' }],
      },
      {
        agentId: 'notificationJudge',
        agentName: '通知判断 Agent',
        status: 'success',
        tools: [{ name: 'concernedItemMatcher', status: 'success' }],
      },
    ],
  },
  new Date('2026-05-03T16:10:00.000Z'),
  workflowAgents,
);
assert.equal(
  savedScenarioWithConfig.expectedResult?.agentConfigSnapshot?.key,
  agentConfigSnapshot?.key,
);
assert.equal(
  normalizeAgentWorkflowSavedScenarios([savedScenarioWithConfig])[0]
    .expectedResult?.agentConfigSnapshot?.enabledAgentCount,
  2,
);
const configChangedReceipt = buildAgentWorkflowSavedScenarioSourceReceipt(
  savedScenarioWithConfig,
  {
    currentInputMatchesScenario: true,
    hasResult: true,
    resultMatchesScenario: true,
    resultIsStale: false,
    agentConfigMatchesBaseline: false,
    baselineAgentConfigLabel:
      formatAgentWorkflowAgentConfigSnapshot(agentConfigSnapshot),
    currentAgentConfigLabel: 'Agent 3/3 / 工具 3 / 首阶段 实体识别 Agent',
  },
);
assert.equal(configChangedReceipt.tone, 'review');
assert.match(configChangedReceipt.summary, /Agent 配置不同/);
assert.match(configChangedReceipt.detail, /基线配置：Agent 2\/2/);
assert.ok(configChangedReceipt.chips.includes('配置已变更'));

assert.equal(
  formatAgentWorkflowRegressionFailureDetail('HTTP error! status: 500'),
  '失败原因：HTTP error! status: 500',
);
assert.equal(
  formatAgentWorkflowRegressionFailureDetail(''),
  '失败原因：该样例未产出可对比结果，请单独重跑确认。',
);

console.log('verify-agent-workflow-replay: ok');
