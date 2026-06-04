import assert from 'node:assert/strict';

import {
  AGENT_WORKFLOW_TEST_SCENARIOS,
  buildAgentWorkflowResultExpectation,
  buildAgentWorkflowSavedScenario,
  buildAgentWorkflowScenarioInput,
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
);

assert.equal(savedScenario.id, 'workflow-saved-1777820460000');
assert.equal(
  normalizeAgentWorkflowInputDatetime(savedScenario.input.datetime),
  '2026-05-03T15:00:00.000Z',
);
assert.equal(savedScenario.expectedResult?.confidence, 0.88);
assert.equal(savedScenario.expectedResult?.shouldNotify, true);
assert.equal(savedScenario.expectedResult?.traceStatus, 'partial');
assert.deepEqual(savedScenario.expectedResult?.matchedRuleRefs, [
  'manual:manual-1',
]);
assert.match(
  formatAgentWorkflowSavedScenarioLabel(savedScenario),
  /有基线 \| Morgan Chen @ Architecture/,
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
  formatAgentWorkflowRegressionFailureDetail('HTTP error! status: 500'),
  '失败原因：HTTP error! status: 500',
);
assert.equal(
  formatAgentWorkflowRegressionFailureDetail(''),
  '失败原因：该样例未产出可对比结果，请单独重跑确认。',
);

console.log('verify-agent-workflow-replay: ok');
