export interface AgentWorkflowRecallItemLike {
  id?: string;
  type?: string;
  content?: string;
  displayTitle?: string;
  displayText?: string;
  previewText?: string;
  source?: string;
  sourceTitle?: string;
  timestamp?: number;
  metadata?: Record<string, any>;
  score?: number;
}

export interface AgentWorkflowReplayMessage {
  id: string;
  sender: string;
  teamName: string;
  teamId?: string;
  content: string;
  datetime: string;
  sourceTitle?: string;
  source?: string;
  score?: number;
}

export interface AgentWorkflowTestInput {
  sender: string;
  teamName: string;
  teamId: string;
  datetime: string;
  content: string;
}

export interface AgentWorkflowSavedExpectation {
  capturedAt: string;
  shouldStore: boolean;
  shouldNotify: boolean;
  notificationReviewRequired: boolean;
  confidence: number | null;
  traceStatus: string;
  matchedRuleRefs: string[];
  matchedRuleIds: number[];
  summary?: string;
}

export interface AgentWorkflowSavedScenario {
  id: string;
  label: string;
  createdAt: string;
  updatedAt: string;
  input: AgentWorkflowTestInput;
  expectedResult?: AgentWorkflowSavedExpectation;
}

export interface AgentWorkflowTestScenario {
  id: string;
  label: string;
  signal: string;
  input: Omit<AgentWorkflowTestInput, 'datetime'>;
}

const UNKNOWN_SENDER = 'Unknown Sender';
const UNKNOWN_GROUP = 'Unknown Group';
export const AGENT_WORKFLOW_SAVED_SCENARIO_LIMIT = 12;

export const AGENT_WORKFLOW_TEST_SCENARIOS: AgentWorkflowTestScenario[] = [
  {
    id: 'manual-watch-hit',
    label: '手动关注项命中',
    signal: '通知/存储',
    input: {
      sender: 'Morgan Chen',
      teamName: 'Architecture',
      teamId: 'architecture',
      content:
        'API split has a blocker in the auth adapter. Please keep this on the radar today.',
    },
  },
  {
    id: 'low-confidence-review',
    label: '低置信度复核',
    signal: '待复核',
    input: {
      sender: 'Avery Wong',
      teamName: 'Escalations',
      teamId: 'escalations',
      content:
        'This might be related to the blocker thread, but I am not sure whether it requires action yet.',
    },
  },
  {
    id: 'storage-only-decision',
    label: '仅存储判断',
    signal: '记忆审计',
    input: {
      sender: 'Priya Shah',
      teamName: 'SDK Updates',
      teamId: 'sdk-updates',
      content:
        'Architecture decision: keep the migration guide as the source of truth until the rollout ends.',
    },
  },
];

function normalizeText(value: any): string {
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : '';
}

function normalizeConfidence(value: any): number | null {
  let numeric: number;
  if (typeof value === 'number') {
    numeric = value;
  } else if (typeof value === 'string') {
    const normalized = value.trim().replace(/%$/, '');
    if (!normalized) return null;
    numeric = Number(normalized);
  } else {
    return null;
  }

  if (!Number.isFinite(numeric)) return null;
  const normalized = numeric > 1 && numeric <= 100 ? numeric / 100 : numeric;
  return Math.min(1, Math.max(0, normalized));
}

function firstString(...values: any[]): string {
  for (const value of values) {
    const normalized = normalizeText(value);
    if (normalized) return normalized;
  }
  return '';
}

function firstMetadataString(
  metadata: Record<string, any>,
  keys: string[],
): string {
  return firstString(...keys.map((key) => metadata[key]));
}

function normalizeTimestampNumber(value: number): string {
  const milliseconds = Math.abs(value) < 1_000_000_000_000 ? value * 1000 : value;
  const date = new Date(milliseconds);
  return Number.isFinite(date.getTime()) ? date.toISOString() : '';
}

function normalizeDatetimeValue(value: any): string {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return normalizeTimestampNumber(value);
  }

  const normalized = normalizeText(value);
  if (!normalized) {
    return '';
  }

  if (/^-?\d+(\.\d+)?$/.test(normalized)) {
    return normalizeTimestampNumber(Number(normalized)) || normalized;
  }

  const parsed = Date.parse(normalized);
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : normalized;
}

function normalizeDatetime(item: AgentWorkflowRecallItemLike): string {
  const metadata = item.metadata || {};
  const datetimeKeys = [
    'datetime',
    'messageDatetime',
    'message_datetime',
    'messageDate',
    'message_date',
    'time',
    'timestamp',
    'timestampMs',
    'timestamp_ms',
    'createdAt',
    'created_at',
    'created',
    'createdTime',
    'updatedAt',
    'updated_at',
  ];
  for (const key of datetimeKeys) {
    const direct = normalizeDatetimeValue(metadata[key]);
    if (direct) return direct;
  }

  if (typeof item.timestamp === 'number' && Number.isFinite(item.timestamp)) {
    return normalizeTimestampNumber(item.timestamp);
  }

  return new Date().toISOString();
}

function padDatetimePart(value: number): string {
  return String(value).padStart(2, '0');
}

export function formatAgentWorkflowDatetimeInputValue(value?: any): string {
  const normalized =
    value === undefined || value === null || value === ''
      ? new Date().toISOString()
      : normalizeDatetimeValue(value);
  const date = new Date(normalized);
  if (!Number.isFinite(date.getTime())) {
    return '';
  }

  return [
    `${date.getFullYear()}-${padDatetimePart(date.getMonth() + 1)}-${padDatetimePart(date.getDate())}`,
    `${padDatetimePart(date.getHours())}:${padDatetimePart(date.getMinutes())}:${padDatetimePart(date.getSeconds())}`,
  ].join('T');
}

export function normalizeAgentWorkflowInputDatetime(value?: any): string {
  const normalized = normalizeDatetimeValue(value);
  if (normalized) {
    const parsed = Date.parse(normalized);
    if (Number.isFinite(parsed)) {
      return new Date(parsed).toISOString();
    }
  }
  return new Date().toISOString();
}

export function buildAgentWorkflowScenarioInput(
  scenario: AgentWorkflowTestScenario,
  now: Date = new Date(),
): AgentWorkflowTestInput {
  return {
    ...scenario.input,
    datetime: formatAgentWorkflowDatetimeInputValue(now.toISOString()),
  };
}

function normalizeSavedScenarioInput(value: any): AgentWorkflowTestInput | null {
  if (!value || typeof value !== 'object') return null;
  const content = normalizeText(value.content);
  if (!content) return null;

  return {
    sender: normalizeText(value.sender) || UNKNOWN_SENDER,
    teamName: normalizeText(value.teamName) || UNKNOWN_GROUP,
    teamId: normalizeText(value.teamId),
    datetime: formatAgentWorkflowDatetimeInputValue(value.datetime),
    content,
  };
}

function normalizeStringArray(value: any): string[] {
  return Array.isArray(value)
    ? Array.from(
        new Set(
          value
            .map((item) => normalizeText(item))
            .filter((item) => item.length > 0),
        ),
      )
    : [];
}

function normalizeNumberArray(value: any): number[] {
  return Array.isArray(value)
    ? Array.from(
        new Set(
          value
            .map((item) => Number(item))
            .filter((item) => Number.isFinite(item)),
        ),
      )
    : [];
}

export function getAgentWorkflowTraceStatus(result: any): string {
  const explicitStatus = normalizeText(result?.storageReview?.traceStatus);
  if (explicitStatus) return explicitStatus;

  const trace = Array.isArray(result?.agentWorkflowTrace)
    ? result.agentWorkflowTrace
    : [];
  if (trace.length === 0) return 'missing';

  const hasIssue = trace.some(
    (step: any) =>
      step?.status === 'error' ||
      (Array.isArray(step?.tools) &&
        step.tools.some(
          (tool: any) =>
            tool?.status === 'error' ||
            tool?.status === 'skipped' ||
            tool?.status === 'placeholder',
        )),
  );
  return hasIssue ? 'partial' : 'complete';
}

export function buildAgentWorkflowResultExpectation(
  result: any,
  now: Date = new Date(),
): AgentWorkflowSavedExpectation | undefined {
  if (!result || typeof result !== 'object') return undefined;

  const matchedRuleRefs = normalizeStringArray([
    ...(Array.isArray(result.matchedRuleRefs) ? result.matchedRuleRefs : []),
    ...(Array.isArray(result.storageReview?.matchedRuleRefs)
      ? result.storageReview.matchedRuleRefs
      : []),
  ]);
  const matchedRuleIds = normalizeNumberArray([
    ...(Array.isArray(result.matchedRuleIds) ? result.matchedRuleIds : []),
    ...(Array.isArray(result.storageReview?.matchedRuleIds)
      ? result.storageReview.matchedRuleIds
      : []),
  ]);

  return {
    capturedAt: now.toISOString(),
    shouldStore: Boolean(result.shouldStore),
    shouldNotify: Boolean(result.shouldNotify),
    notificationReviewRequired: Boolean(result.notificationReview?.required),
    confidence:
      normalizeConfidence(result.confidence) ??
      normalizeConfidence(result.storageReview?.confidence),
    traceStatus: getAgentWorkflowTraceStatus(result),
    matchedRuleRefs,
    matchedRuleIds,
    summary: normalizeText(result.summary || result.storageReview?.summary),
  };
}

function normalizeSavedExpectation(value: any): AgentWorkflowSavedExpectation | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const capturedAt = normalizeDatetimeValue(value.capturedAt);
  return {
    capturedAt: capturedAt || new Date().toISOString(),
    shouldStore: Boolean(value.shouldStore),
    shouldNotify: Boolean(value.shouldNotify),
    notificationReviewRequired: Boolean(value.notificationReviewRequired),
    confidence: normalizeConfidence(value.confidence),
    traceStatus: normalizeText(value.traceStatus) || 'missing',
    matchedRuleRefs: normalizeStringArray(value.matchedRuleRefs),
    matchedRuleIds: normalizeNumberArray(value.matchedRuleIds),
    summary: normalizeText(value.summary) || undefined,
  };
}

function buildSavedScenarioLabel(input: AgentWorkflowTestInput): string {
  const snippet =
    input.content.length > 42
      ? `${input.content.slice(0, 39)}...`
      : input.content;
  return `${input.sender} @ ${input.teamName} | ${snippet}`;
}

export function buildAgentWorkflowSavedScenario(
  input: AgentWorkflowTestInput,
  result?: any,
  now: Date = new Date(),
): AgentWorkflowSavedScenario {
  const normalizedInput = normalizeSavedScenarioInput(input) || {
    sender: UNKNOWN_SENDER,
    teamName: UNKNOWN_GROUP,
    teamId: '',
    datetime: formatAgentWorkflowDatetimeInputValue(now.toISOString()),
    content: normalizeText(input?.content) || 'Untitled test case',
  };
  const timestamp = now.toISOString();

  return {
    id: `workflow-saved-${now.getTime()}`,
    label: buildSavedScenarioLabel(normalizedInput),
    createdAt: timestamp,
    updatedAt: timestamp,
    input: normalizedInput,
    expectedResult: buildAgentWorkflowResultExpectation(result, now),
  };
}

export function normalizeAgentWorkflowSavedScenarios(
  value: any,
  limit = AGENT_WORKFLOW_SAVED_SCENARIO_LIMIT,
): AgentWorkflowSavedScenario[] {
  if (!Array.isArray(value)) return [];

  const scenarios: AgentWorkflowSavedScenario[] = [];
  const seenInputs = new Set<string>();

  for (const item of value) {
    if (!item || typeof item !== 'object') continue;
    const input = normalizeSavedScenarioInput(item.input);
    if (!input) continue;

    const dedupeKey = JSON.stringify(input);
    if (seenInputs.has(dedupeKey)) continue;
    seenInputs.add(dedupeKey);

    const updatedAt =
      normalizeDatetimeValue(item.updatedAt) ||
      normalizeDatetimeValue(item.createdAt) ||
      new Date().toISOString();
    const createdAt = normalizeDatetimeValue(item.createdAt) || updatedAt;

    scenarios.push({
      id: normalizeText(item.id) || `workflow-saved-${scenarios.length + 1}`,
      label: normalizeText(item.label) || buildSavedScenarioLabel(input),
      createdAt,
      updatedAt,
      input,
      expectedResult: normalizeSavedExpectation(item.expectedResult),
    });

    if (scenarios.length >= limit) break;
  }

  return scenarios;
}

export function formatAgentWorkflowSavedScenarioLabel(
  scenario: AgentWorkflowSavedScenario,
): string {
  const time = new Date(scenario.updatedAt);
  const timeLabel = Number.isFinite(time.getTime())
    ? time.toLocaleString()
    : scenario.updatedAt;
  const baselineLabel = scenario.expectedResult ? '有基线' : '无基线';
  return `${timeLabel} | ${baselineLabel} | ${scenario.label}`;
}

export function buildAgentWorkflowReplayMessage(
  item: AgentWorkflowRecallItemLike,
): AgentWorkflowReplayMessage | null {
  const metadata = item.metadata || {};
  const content = firstString(
    item.content,
    item.displayText,
    item.previewText,
    firstMetadataString(metadata, [
      'messageContent',
      'message_content',
      'content',
      'text',
      'summary',
    ]),
  );

  if (!content) {
    return null;
  }

  const sender =
    firstMetadataString(metadata, ['sender', 'creator', 'author', 'user']) ||
    UNKNOWN_SENDER;
  const teamName =
    firstMetadataString(metadata, [
      'groupName',
      'teamName',
      'team_name',
      'channelName',
      'sourceTitle',
    ]) ||
    normalizeText(item.sourceTitle) ||
    UNKNOWN_GROUP;
  const datetime = normalizeDatetime(item);

  return {
    id:
      normalizeText(item.id) ||
      `workflow-replay-${datetime}-${content.slice(0, 48)}`,
    sender,
    teamName,
    teamId: firstMetadataString(metadata, [
      'groupId',
      'group_id',
      'teamId',
      'team_id',
      'channelId',
      'channel_id',
    ]),
    content,
    datetime,
    sourceTitle: firstString(item.sourceTitle, item.displayTitle),
    source: normalizeText(item.source),
    score: typeof item.score === 'number' ? item.score : undefined,
  };
}

export function buildAgentWorkflowReplayMessages(
  items: AgentWorkflowRecallItemLike[],
  limit = 8,
): AgentWorkflowReplayMessage[] {
  const messages: AgentWorkflowReplayMessage[] = [];
  const seen = new Set<string>();

  for (const item of items) {
    const message = buildAgentWorkflowReplayMessage(item);
    if (!message) continue;

    const dedupeKey = `${message.sender}|${message.teamName}|${message.datetime}|${message.content}`;
    if (seen.has(dedupeKey)) continue;

    seen.add(dedupeKey);
    messages.push(message);
    if (messages.length >= limit) break;
  }

  return messages;
}

export function formatAgentWorkflowReplayLabel(
  message: AgentWorkflowReplayMessage,
): string {
  const time = new Date(message.datetime);
  const timeLabel = Number.isFinite(time.getTime())
    ? time.toLocaleString()
    : message.datetime;
  const snippet =
    message.content.length > 72
      ? `${message.content.slice(0, 69)}...`
      : message.content;
  const contextParts = [
    message.source && message.source !== 'unknown' ? message.source : '',
    message.sourceTitle && message.sourceTitle !== message.teamName
      ? message.sourceTitle
      : '',
    typeof message.score === 'number' && Number.isFinite(message.score)
      ? `相似度 ${Math.round(message.score * 100)}%`
      : '',
  ].filter(Boolean);
  const contextLabel =
    contextParts.length > 0 ? ` (${contextParts.join(' / ')})` : '';
  return `${timeLabel} | ${message.sender} @ ${message.teamName}${contextLabel} | ${snippet}`;
}
