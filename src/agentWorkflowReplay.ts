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

export interface AgentWorkflowTestScenario {
  id: string;
  label: string;
  signal: string;
  input: Omit<AgentWorkflowTestInput, 'datetime'>;
}

const UNKNOWN_SENDER = 'Unknown Sender';
const UNKNOWN_GROUP = 'Unknown Group';

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
