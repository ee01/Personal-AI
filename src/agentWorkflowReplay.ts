import {
  buildAgentWorkflowResultDiagnostics,
  buildAgentWorkflowRecommendedActions,
  buildAgentWorkflowReadinessChecks,
  buildAgentWorkflowRunVerdict,
  buildAgentWorkflowStructuralCoverage,
  type AgentWorkflowAgentLike,
  type AgentWorkflowDiagnostic,
  type AgentWorkflowReadinessCheck,
  type AgentWorkflowRecommendedAction,
  type AgentWorkflowRunVerdict,
  type AgentWorkflowStructuralCoverage,
} from './agentWorkflowDiagnostics';

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
  diagnosticSnapshot?: AgentWorkflowSavedDiagnosticSnapshot;
  agentConfigSnapshot?: AgentWorkflowAgentConfigSnapshot;
}

export interface AgentWorkflowSavedDiagnosticSnapshot {
  summary: string;
  structuralCoverage?: AgentWorkflowStructuralCoverage;
  verdict?: Pick<
    AgentWorkflowRunVerdict,
    'status' | 'title' | 'summary' | 'actionLabel'
  >;
  readiness: Array<
    Pick<AgentWorkflowReadinessCheck, 'id' | 'status' | 'title'>
  >;
  recommendedActions: Array<
    Pick<AgentWorkflowRecommendedAction, 'id' | 'status' | 'title'>
  >;
  diagnostics: Array<Pick<AgentWorkflowDiagnostic, 'id' | 'severity' | 'title'>>;
}

export interface AgentWorkflowAgentConfigSnapshot {
  key: string;
  totalAgentCount: number;
  enabledAgentCount: number;
  enabledToolCount: number;
  firstAgentId?: string;
  firstAgentLabel?: string;
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

export type AgentWorkflowTestSourceReceiptTone = 'info' | 'review' | 'ready';

export interface AgentWorkflowTestSourceReceipt {
  title: string;
  summary: string;
  detail: string;
  tone: AgentWorkflowTestSourceReceiptTone;
  chips: string[];
}

export interface AgentWorkflowRunScopeReceiptContext {
  input?: AgentWorkflowTestInput | null;
  agentConfig?: AgentWorkflowAgentConfigSnapshot | null;
  savedScenarioCount?: number;
  resultIsStale?: boolean;
  selectedSavedScenarioHasBaseline?: boolean;
  currentInputMatchesSavedScenario?: boolean;
  agentConfigMatchesSavedBaseline?: boolean;
}

export interface AgentWorkflowSavedScenarioReceiptContext {
  currentInputMatchesScenario?: boolean;
  hasResult?: boolean;
  resultMatchesScenario?: boolean;
  resultIsStale?: boolean;
  agentConfigMatchesBaseline?: boolean;
  baselineAgentConfigLabel?: string;
  currentAgentConfigLabel?: string;
}

export interface AgentWorkflowSavedRegressionScopeReceiptContext {
  savedScenarioCount?: number;
  running?: boolean;
  currentIndex?: number;
  currentLabel?: string;
  summary?: {
    total?: number;
    same?: number;
    changed?: number;
    noBaseline?: number;
    failed?: number;
  } | null;
}

export interface AgentWorkflowSavedRegressionCoverageReceiptContext {
  scenarios?: AgentWorkflowSavedScenario[];
}

export interface AgentWorkflowSavedScenarioCapacityReceiptContext {
  savedScenarioCount?: number;
  limit?: number;
  inputHasContent?: boolean;
  replacesExisting?: boolean;
  evictedScenarioLabel?: string;
}

export interface AgentWorkflowSavedScenarioDeleteReceiptContext {
  scenario?: AgentWorkflowSavedScenario | null;
  remainingCount?: number;
  nextScenarioLabel?: string;
}

export interface AgentWorkflowReplaySourceReceiptContext {
  loading?: boolean;
  error?: string;
  sampleCount?: number;
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

export function buildAgentWorkflowAgentConfigSnapshot(
  agents: AgentWorkflowAgentLike[] = [],
): AgentWorkflowAgentConfigSnapshot | undefined {
  if (!Array.isArray(agents) || agents.length === 0) return undefined;

  const comparableAgents = agents
    .map((agent) => ({
      id: normalizeText(agent.id),
      name: normalizeText(agent.name),
      enabled: agent.enabled !== false,
      priority: Number(agent.priority || 0),
      tools: Array.isArray(agent.tools)
        ? agent.tools.map((tool) => normalizeText(tool)).filter(Boolean).sort()
        : [],
    }))
    .filter((agent) => agent.id || agent.name || agent.tools.length > 0)
    .sort((a, b) => {
      if (b.priority !== a.priority) return b.priority - a.priority;
      return a.id.localeCompare(b.id);
    });

  if (comparableAgents.length === 0) return undefined;

  const enabledAgents = comparableAgents.filter((agent) => agent.enabled);
  const enabledToolCount = enabledAgents.reduce(
    (count, agent) => count + agent.tools.length,
    0,
  );
  const firstAgent = enabledAgents[0];
  const key = JSON.stringify(
    comparableAgents.map((agent) => ({
      id: agent.id,
      enabled: agent.enabled,
      priority: agent.priority,
      tools: agent.tools,
    })),
  );

  return {
    key,
    totalAgentCount: comparableAgents.length,
    enabledAgentCount: enabledAgents.length,
    enabledToolCount,
    firstAgentId: firstAgent?.id || undefined,
    firstAgentLabel: firstAgent?.name || firstAgent?.id || undefined,
  };
}

function normalizeAgentConfigSnapshot(
  value: any,
): AgentWorkflowAgentConfigSnapshot | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const key = normalizeText(value.key);
  if (!key) return undefined;

  return {
    key,
    totalAgentCount: Number(value.totalAgentCount || 0),
    enabledAgentCount: Number(value.enabledAgentCount || 0),
    enabledToolCount: Number(value.enabledToolCount || 0),
    firstAgentId: normalizeText(value.firstAgentId) || undefined,
    firstAgentLabel: normalizeText(value.firstAgentLabel) || undefined,
  };
}

export function formatAgentWorkflowAgentConfigSnapshot(
  snapshot?: AgentWorkflowAgentConfigSnapshot,
): string {
  if (!snapshot) return '配置未记录';
  const counts = [
    `Agent ${snapshot.enabledAgentCount}/${snapshot.totalAgentCount}`,
    `工具 ${snapshot.enabledToolCount}`,
  ];
  if (snapshot.firstAgentLabel) {
    counts.push(`首阶段 ${snapshot.firstAgentLabel}`);
  }
  return counts.join(' / ');
}

function normalizeDiagnosticItems<
  T extends Record<string, any>,
  K extends keyof T,
>(value: any, keys: K[]): Array<Pick<T, K>> {
  if (!Array.isArray(value)) return [];

  return value
    .map((item) => {
      if (!item || typeof item !== 'object') return null;
      const normalized = {} as Pick<T, K>;
      keys.forEach((key) => {
        const stringValue = normalizeText(item[key]);
        if (stringValue) {
          normalized[key] = stringValue as T[K];
        }
      });
      return Object.keys(normalized).length > 0 ? normalized : null;
    })
    .filter((item): item is Pick<T, K> => Boolean(item));
}

function normalizeDiagnosticSnapshot(
  value: any,
): AgentWorkflowSavedDiagnosticSnapshot | undefined {
  if (!value || typeof value !== 'object') return undefined;

  const summary = normalizeText(value.summary);
  const verdictValue =
    value.verdict && typeof value.verdict === 'object'
      ? value.verdict
      : undefined;
  const verdict = verdictValue
    ? {
        status: normalizeText(
          verdictValue.status,
        ) as AgentWorkflowRunVerdict['status'],
        title: normalizeText(verdictValue.title),
        summary: normalizeText(verdictValue.summary),
        actionLabel: normalizeText(verdictValue.actionLabel) || undefined,
      }
    : undefined;
  const readiness = normalizeDiagnosticItems<
    AgentWorkflowReadinessCheck,
    'id' | 'status' | 'title'
  >(value.readiness, ['id', 'status', 'title']);
  const recommendedActions = normalizeDiagnosticItems<
    AgentWorkflowRecommendedAction,
    'id' | 'status' | 'title'
  >(value.recommendedActions, ['id', 'status', 'title']);
  const diagnostics = normalizeDiagnosticItems<
    AgentWorkflowDiagnostic,
    'id' | 'severity' | 'title'
  >(value.diagnostics, ['id', 'severity', 'title']);
  const structuralCoverage =
    value.structuralCoverage && typeof value.structuralCoverage === 'object'
      ? {
          status: normalizeText(value.structuralCoverage.status) as
            | 'covered'
            | 'partial'
            | 'missing',
          summary: normalizeText(value.structuralCoverage.summary),
          expectedAgentCount: Number(
            value.structuralCoverage.expectedAgentCount || 0,
          ),
          executedAgentCount: Number(
            value.structuralCoverage.executedAgentCount || 0,
          ),
          expectedToolCount: Number(
            value.structuralCoverage.expectedToolCount || 0,
          ),
          observedToolCount: Number(
            value.structuralCoverage.observedToolCount || 0,
          ),
          missingAgents: normalizeStringArray(
            value.structuralCoverage.missingAgents,
          ),
          missingTools: normalizeStringArray(
            value.structuralCoverage.missingTools,
          ),
          issueSummary: normalizeStringArray(
            value.structuralCoverage.issueSummary,
          ),
        }
      : undefined;

  if (
    !summary &&
    !verdict &&
    !structuralCoverage &&
    readiness.length === 0 &&
    diagnostics.length === 0
  ) {
    return undefined;
  }

  return {
    summary: summary || '没有可导出的诊断摘要',
    structuralCoverage,
    verdict,
    readiness,
    recommendedActions,
    diagnostics,
  };
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

export function buildAgentWorkflowDiagnosticSnapshot(
  result: any,
  agents: AgentWorkflowAgentLike[] = [],
): AgentWorkflowSavedDiagnosticSnapshot | undefined {
  if (!result || typeof result !== 'object') return undefined;

  const structuralCoverage = buildAgentWorkflowStructuralCoverage(
    result,
    agents,
  );
  const diagnostics = buildAgentWorkflowResultDiagnostics(result);
  const readiness = buildAgentWorkflowReadinessChecks(result);
  const recommendedActions = buildAgentWorkflowRecommendedActions(
    result,
    diagnostics,
  );
  const verdict = buildAgentWorkflowRunVerdict(
    result,
    readiness,
    recommendedActions,
  );
  const blockedChecks = readiness.filter((item) => item.status === 'blocked');
  const reviewChecks = readiness.filter((item) => item.status === 'review');
  const nextAction = recommendedActions.find((item) => item.status !== 'done');
  const gatePrefix =
    blockedChecks.length > 0
      ? '阻塞'
      : reviewChecks.length > 0
        ? '复核'
        : '门禁';
  const gateChecks =
    blockedChecks.length > 0
      ? blockedChecks
      : reviewChecks.length > 0
        ? reviewChecks
        : readiness.filter((item) => item.status === 'ready');
  const summaryParts = [
    verdict?.title ? `结论 ${verdict.title}` : '',
    structuralCoverage?.summary || '',
    gateChecks.length > 0
      ? `${gatePrefix} ${gateChecks
          .slice(0, 3)
          .map((item) => item.title)
          .join('、')}`
      : '',
    nextAction?.title ? `下一步 ${nextAction.title}` : '',
  ].filter(Boolean);

  return {
    summary: summaryParts.join('；') || '没有可导出的诊断摘要',
    structuralCoverage,
    verdict: verdict
      ? {
          status: verdict.status,
          title: verdict.title,
          summary: verdict.summary,
          actionLabel: verdict.actionLabel,
        }
      : undefined,
    readiness: readiness.map((item) => ({
      id: item.id,
      status: item.status,
      title: item.title,
    })),
    recommendedActions: recommendedActions.map((item) => ({
      id: item.id,
      status: item.status,
      title: item.title,
    })),
    diagnostics: diagnostics.map((item) => ({
      id: item.id,
      severity: item.severity,
      title: item.title,
    })),
  };
}

export function buildAgentWorkflowResultExpectation(
  result: any,
  now: Date = new Date(),
  agents: AgentWorkflowAgentLike[] = [],
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
    diagnosticSnapshot: buildAgentWorkflowDiagnosticSnapshot(result, agents),
    agentConfigSnapshot: buildAgentWorkflowAgentConfigSnapshot(agents),
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
    diagnosticSnapshot: normalizeDiagnosticSnapshot(value.diagnosticSnapshot),
    agentConfigSnapshot: normalizeAgentConfigSnapshot(value.agentConfigSnapshot),
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
  agents: AgentWorkflowAgentLike[] = [],
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
    expectedResult: buildAgentWorkflowResultExpectation(result, now, agents),
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

export function buildAgentWorkflowRunScopeReceipt(
  context: AgentWorkflowRunScopeReceiptContext = {},
): AgentWorkflowTestSourceReceipt {
  const input = context.input;
  const sender = normalizeText(input?.sender) || UNKNOWN_SENDER;
  const teamName = normalizeText(input?.teamName) || UNKNOWN_GROUP;
  const content = normalizeText(input?.content);
  const hasMessage = content.length > 0;
  const configLabel = formatAgentWorkflowAgentConfigSnapshot(
    context.agentConfig,
  );
  const savedScenarioCount =
    typeof context.savedScenarioCount === 'number' &&
    Number.isFinite(context.savedScenarioCount)
      ? Math.max(0, context.savedScenarioCount)
      : null;
  const hasSavedScenarios =
    savedScenarioCount !== null && savedScenarioCount > 0;
  const gateNeedsReview =
    Boolean(context.resultIsStale) ||
    context.currentInputMatchesSavedScenario === false ||
    context.selectedSavedScenarioHasBaseline === false ||
    context.agentConfigMatchesSavedBaseline === false;
  let gateSummary = '本地门禁待建立：保存样例后才能形成批量回归证据。';
  let gateChip = '门禁未建立';

  if (!hasMessage) {
    gateSummary = '本地门禁不可用：先补测试消息。';
    gateChip = '门禁待输入';
  } else if (context.resultIsStale) {
    gateSummary = '本地门禁需重跑：上一次结果已过期。';
    gateChip = '门禁需重跑';
  } else if (!hasSavedScenarios) {
    gateSummary = '本地门禁未建立：还没有保存样例基线，只能做单次调试。';
    gateChip = '门禁未建立';
  } else if (context.currentInputMatchesSavedScenario === false) {
    gateSummary =
      '本地门禁不覆盖所选保存样例：当前输入已脱离下拉框里的基线。';
    gateChip = '门禁输入不匹配';
  } else if (context.selectedSavedScenarioHasBaseline === undefined) {
    gateSummary =
      '本地门禁待确认：选择保存样例后再判断基线和配置是否可比。';
    gateChip = '门禁待确认';
  } else if (context.selectedSavedScenarioHasBaseline === false) {
    gateSummary = '本地门禁待建基线：所选保存样例尚无可比较结果。';
    gateChip = '门禁待建基线';
  } else if (context.agentConfigMatchesSavedBaseline === false) {
    gateSummary =
      '本地门禁需复核：保存基线的 Agent 配置和当前配置不同。';
    gateChip = '门禁配置变更';
  } else if (context.selectedSavedScenarioHasBaseline === true) {
    gateSummary =
      '本地门禁可用：当前输入、保存基线和 Agent 配置可作为回归证据。';
    gateChip = '门禁可用';
  }

  return {
    title: '运行前范围',
    summary: hasMessage
      ? `当前表单可直接测试：${sender} @ ${teamName}。${gateSummary}`
      : '当前表单缺少测试消息，主运行按钮暂不可用。',
    detail:
      '运行测试只重跑当前表单；运行样例、回放测试、运行保存样例会先填入对应来源；批量回归逐条重跑本地保存样例。作为发布前证据时，先让当前输入对齐保存样例、重跑过期结果，并确认保存基线与当前 Agent 配置一致。所有运行都不会写入 Memory Service、不会发送通知、不会执行规则自动化、不会标记原消息已读，也不会覆盖基线；保存/接受基线会另显示写回回执。',
    tone: hasMessage && !gateNeedsReview ? 'ready' : 'review',
    chips: [
      hasMessage ? '当前表单可运行' : '等待测试消息',
      gateChip,
      context.resultIsStale ? '上次结果需重跑' : '',
      configLabel || '当前 Agent 配置',
      savedScenarioCount === null ? '' : `保存样例 ${savedScenarioCount}`,
      '本地测试无外发',
    ].filter(Boolean),
  };
}

function normalizeCount(value: any): number {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? Math.max(0, Math.floor(numeric)) : 0;
}

export function buildAgentWorkflowSavedScenarioCapacityReceipt(
  context: AgentWorkflowSavedScenarioCapacityReceiptContext = {},
): AgentWorkflowTestSourceReceipt {
  const limit = Math.max(
    1,
    normalizeCount(context.limit || AGENT_WORKFLOW_SAVED_SCENARIO_LIMIT),
  );
  const savedScenarioCount = normalizeCount(context.savedScenarioCount);
  const displayCount = Math.min(savedScenarioCount, limit);
  const remaining = Math.max(0, limit - savedScenarioCount);
  const countChip = `保存样例 ${displayCount}/${limit}`;
  const evictedScenarioLabel = normalizeText(context.evictedScenarioLabel);

  if (context.inputHasContent === false) {
    return {
      title: '保存样例容量',
      summary: `当前本地保存样例 ${displayCount}/${limit}；先补测试消息后才能保存。`,
      detail:
        '保存样例只会改写 chrome.storage.local 的本地回归样本，不会运行 Agent Workflow、写入 Memory Service、发送通知或执行规则自动化。',
      tone: 'review',
      chips: [countChip, '等待测试消息', '本地 storage'],
    };
  }

  if (context.replacesExisting) {
    return {
      title: '保存样例容量',
      summary: `当前输入已存在于保存样例；保存会更新同一条本地样例，数量仍为 ${displayCount}/${limit}。`,
      detail:
        '同输入保存会把新快照移动到列表顶部并刷新基线；不会挤掉其他保存样例，不会写入 Memory Service、发送通知或执行规则自动化。',
      tone: 'ready',
      chips: [countChip, '更新同输入', '本地 storage'],
    };
  }

  if (savedScenarioCount >= limit) {
    return {
      title: '保存样例容量',
      summary: `已达到本地上限 ${limit}；保存新输入会保留最新 ${limit} 个，并移出最旧样例${evictedScenarioLabel ? `：${evictedScenarioLabel}` : ''}。`,
      detail:
        '被移出的样例将不再参与批量回归、基线对比或导出报告；这只影响本地 chrome.storage.local 样例集，不会删除 Memory Service 记忆、发送通知或执行规则自动化。',
      tone: 'review',
      chips: [countChip, '将移出最旧', '本地 storage'],
    };
  }

  if (remaining === 1) {
    return {
      title: '保存样例容量',
      summary: `当前本地保存样例 ${displayCount}/${limit}；再保存一个新输入后将达到上限。`,
      detail:
        '保存只新增本地回归样例，不会立即运行批量回归、覆盖既有基线、写入 Memory Service、发送通知或执行规则自动化。',
      tone: 'review',
      chips: [countChip, '最后 1 个空位', '本地 storage'],
    };
  }

  return {
    title: '保存样例容量',
    summary: `当前本地保存样例 ${displayCount}/${limit}；还可新增 ${remaining} 个新输入。`,
    detail:
      '保存当前用例只更新本地 chrome.storage.local 样例集；是否作为发布前证据仍取决于后续运行、基线和 Agent 配置一致性。',
    tone: 'ready',
    chips: [countChip, `剩余 ${remaining}`, '本地 storage'],
  };
}

export function buildAgentWorkflowSavedScenarioDeleteReceipt(
  context: AgentWorkflowSavedScenarioDeleteReceiptContext = {},
): AgentWorkflowTestSourceReceipt {
  const scenario = context.scenario || null;
  const label = normalizeText(scenario?.label) || '未命名保存样例';
  const remainingCount = normalizeCount(context.remainingCount);
  const nextScenarioLabel = normalizeText(context.nextScenarioLabel);
  const hadBaseline = Boolean(scenario?.expectedResult);
  const baselineText = hadBaseline
    ? '这条样例的本地结果基线也已移出。'
    : '这条样例没有结果基线，因此只移出了测试输入。';
  const nextText =
    remainingCount > 0
      ? `下一个选中的保存样例是${nextScenarioLabel ? `：${nextScenarioLabel}` : '当前列表第一条'}。`
      : '本地保存样例已清空；批量回归和基线对比会等待新样例。';

  return {
    title: '保存样例删除回执',
    summary: `已删除本地保存样例：${label}；剩余 ${remainingCount} 个。${baselineText}`,
    detail:
      `${nextText} 删除只改写 chrome.storage.local 的 agentWorkflowSavedScenarios；不会删除 Memory Service 记忆、不会移除真实消息、不会发送通知、不会执行规则自动化、不会撤销已导出的报告，也不会改写当前测试输入。`,
    tone: remainingCount > 0 ? 'ready' : 'review',
    chips: [
      `剩余 ${remainingCount}`,
      hadBaseline ? '本地基线已移出' : '无基线',
      '本地 storage',
      '无真实副作用',
    ],
  };
}

export function buildAgentWorkflowSavedRegressionScopeReceipt(
  context: AgentWorkflowSavedRegressionScopeReceiptContext = {},
): AgentWorkflowTestSourceReceipt {
  const summary = context.summary || null;
  const savedScenarioCount =
    summary?.total !== undefined
      ? normalizeCount(summary.total)
      : normalizeCount(context.savedScenarioCount);
  const same = normalizeCount(summary?.same);
  const changed = normalizeCount(summary?.changed);
  const noBaseline = normalizeCount(summary?.noBaseline);
  const failed = normalizeCount(summary?.failed);
  const hasCompletedSummary = Boolean(summary);
  const hasIssues = changed > 0 || noBaseline > 0 || failed > 0;
  const currentIndex =
    context.currentIndex !== undefined
      ? Math.min(savedScenarioCount || 1, Math.max(1, normalizeCount(context.currentIndex)))
      : 0;
  const currentLabel = normalizeText(context.currentLabel);

  if (savedScenarioCount <= 0) {
    return {
      title: '批量回归范围',
      summary: '暂无保存样例；批量回归还不能运行。',
      detail:
        '先保存至少一个本地用例并运行出基线，再用批量回归做发布前对比。无保存样例时不会读取 Memory Service、发送通知、执行规则自动化或改写基线。',
      tone: 'review',
      chips: ['保存样例 0', '等待样例', '本地回归'],
    };
  }

  if (context.running) {
    return {
      title: '批量回归范围',
      summary: currentIndex
        ? `正在本地批量回归 ${currentIndex}/${savedScenarioCount}${currentLabel ? `：${currentLabel}` : ''}。`
        : `正在本地批量回归 ${savedScenarioCount} 个保存样例。`,
      detail:
        '批量回归只逐条重跑 chrome.storage.local 里的保存样例和当前 Agent 配置；运行中不会覆盖基线、不会写入 Memory Service、不会发送通知、不会执行规则自动化、不会标记原消息已读，也不会导出报告或复制原始消息正文。',
      tone: 'review',
      chips: [
        '批量运行中',
        `保存样例 ${savedScenarioCount}`,
        currentIndex ? `当前 ${currentIndex}/${savedScenarioCount}` : '',
        '无真实副作用',
      ].filter(Boolean),
    };
  }

  if (hasCompletedSummary) {
    return {
      title: '批量回归范围',
      summary: `已完成本地批量回归：通过 ${same} / 变化 ${changed} / 无基线 ${noBaseline} / 失败 ${failed}。`,
      detail:
        '完成态只是本地对比结果。导出报告需要用户单独点击；接受为基线也需要单独点击，且只覆盖变化或无基线样例，失败项不会被覆盖。批量回归不会写入 Memory Service、不会发送通知、不会执行规则自动化、不会标记原消息已读，也不会复制原始消息正文。',
      tone: hasIssues ? 'review' : 'ready',
      chips: [
        '批量完成',
        `保存样例 ${savedScenarioCount}`,
        `通过 ${same}`,
        changed > 0 ? `变化 ${changed}` : '',
        noBaseline > 0 ? `无基线 ${noBaseline}` : '',
        failed > 0 ? `失败 ${failed}` : '',
        '等待人工接受基线',
      ].filter(Boolean),
    };
  }

  return {
    title: '批量回归范围',
    summary: `可批量回归 ${savedScenarioCount} 个本地保存样例。`,
    detail:
      '点击批量回归后只会逐条重跑本地保存样例和当前 Agent 配置，用于发布前门禁对比；不会覆盖基线、不会写入 Memory Service、不会发送通知、不会执行规则自动化、不会标记原消息已读，也不会导出报告或复制原始消息正文。',
    tone: 'ready',
    chips: [`保存样例 ${savedScenarioCount}`, '本地回归', '无真实副作用'],
  };
}

export function buildAgentWorkflowSavedRegressionCoverageReceipt(
  context: AgentWorkflowSavedRegressionCoverageReceiptContext = {},
): AgentWorkflowTestSourceReceipt {
  const scenarios = Array.isArray(context.scenarios)
    ? context.scenarios.filter(Boolean)
    : [];
  const baselines = scenarios
    .map((scenario) => scenario.expectedResult)
    .filter((result): result is AgentWorkflowSavedExpectation =>
      Boolean(result),
    );
  const total = scenarios.length;
  const baselineCount = baselines.length;
  const missingBaselineCount = Math.max(0, total - baselineCount);
  const notificationCount = baselines.filter(
    (result) => result.shouldNotify && !result.notificationReviewRequired,
  ).length;
  const reviewCount = baselines.filter(
    (result) => result.notificationReviewRequired,
  ).length;
  const storageOnlyCount = baselines.filter(
    (result) =>
      result.shouldStore &&
      !result.shouldNotify &&
      !result.notificationReviewRequired,
  ).length;
  const ruleBackedCount = baselines.filter(
    (result) =>
      result.matchedRuleRefs.length > 0 || result.matchedRuleIds.length > 0,
  ).length;
  const traceReviewCount = baselines.filter(
    (result) =>
      result.traceStatus !== 'complete' ||
      result.diagnosticSnapshot?.verdict?.status === 'review' ||
      result.diagnosticSnapshot?.verdict?.status === 'blocked',
  ).length;
  const configVariantCount = new Set(
    baselines
      .map((result) => result.agentConfigSnapshot?.key)
      .filter(Boolean),
  ).size;

  if (total <= 0) {
    return {
      title: '回归样本构成',
      summary: '还没有保存样例；无法判断关注项回归覆盖。',
      detail:
        '先保存手动关注项命中、低置信复核和仅存储判断等代表性样例，再用批量回归做发布前门禁。本回执只读取本地保存样例，不读取 Memory Service、发送通知或执行规则自动化。',
      tone: 'review',
      chips: ['保存样例 0', '等待样本', '本地 coverage'],
    };
  }

  const missingLanes = [
    notificationCount <= 0 ? '通知路径' : '',
    reviewCount <= 0 ? '低置信复核' : '',
    storageOnlyCount <= 0 ? '存储-only' : '',
    ruleBackedCount <= 0 ? '规则归因' : '',
  ].filter(Boolean);
  const hasCoverageGaps =
    missingBaselineCount > 0 || missingLanes.length > 0;
  const laneSummary = `通知 ${notificationCount} / 复核 ${reviewCount} / 存储-only ${storageOnlyCount}`;
  const baselineSummary =
    missingBaselineCount > 0
      ? `有基线 ${baselineCount}，待建基线 ${missingBaselineCount}`
      : `有基线 ${baselineCount}`;
  const coverageAdvice = hasCoverageGaps
    ? [
        missingBaselineCount > 0
          ? `先为 ${missingBaselineCount} 个保存样例建立基线`
          : '',
        missingLanes.length > 0
          ? `补充 ${missingLanes.join('、')} 样例`
          : '',
      ]
        .filter(Boolean)
        .join('；')
    : '通知、复核、存储-only 和规则归因路径都有本地样例。';

  return {
    title: '回归样本构成',
    summary: `保存样例 ${total} 个；${baselineSummary}；${laneSummary}。`,
    detail: `${coverageAdvice}。这只是 chrome.storage.local 保存样例的结构覆盖，不代表所有线上关注项、群组、时间窗口或 Memory Service 最近消息都已覆盖；批量回归不会写入 Memory Service、不会发送通知、不会执行规则自动化，也不会标记原消息已读。`,
    tone: hasCoverageGaps ? 'review' : 'ready',
    chips: [
      `保存样例 ${total}`,
      `有基线 ${baselineCount}`,
      missingBaselineCount > 0 ? `待建基线 ${missingBaselineCount}` : '',
      `通知 ${notificationCount}`,
      `复核 ${reviewCount}`,
      `存储-only ${storageOnlyCount}`,
      `规则归因 ${ruleBackedCount}`,
      traceReviewCount > 0 ? `Trace需复核 ${traceReviewCount}` : '',
      configVariantCount > 0 ? `配置版本 ${configVariantCount}` : '',
      '本地 coverage',
    ].filter(Boolean),
  };
}

function formatReceiptTimestamp(value?: any): string {
  const normalized = normalizeDatetimeValue(value);
  if (!normalized) return '';
  const time = new Date(normalized);
  return Number.isFinite(time.getTime()) ? time.toLocaleString() : normalized;
}

export function buildAgentWorkflowScenarioSourceReceipt(
  scenario?: AgentWorkflowTestScenario | null,
): AgentWorkflowTestSourceReceipt {
  if (!scenario) {
    return {
      title: '内置样例范围',
      summary: '尚未选中内置样例。',
      detail:
        '选择样例后只会重跑当前 Options 里的 Agent 配置，不会走真实消息入口。',
      tone: 'info',
      chips: ['内置样例'],
    };
  }

  return {
    title: '内置样例范围',
    summary: `预期观察：${scenario.signal}。`,
    detail:
      '用于验证当前 Agent 配置、关注项门禁和 trace 覆盖，不会写入 Memory Service、发送通知或执行规则自动化。',
    tone: scenario.signal.includes('复核') ? 'review' : 'info',
    chips: ['内置样例', scenario.label, `预期 ${scenario.signal}`],
  };
}

export function buildAgentWorkflowReplaySourceReceipt(
  message?: AgentWorkflowReplayMessage | null,
  context: AgentWorkflowReplaySourceReceiptContext = {},
): AgentWorkflowTestSourceReceipt {
  const sampleCount: number | null =
    typeof context.sampleCount === 'number' && Number.isFinite(context.sampleCount)
      ? Math.max(0, Math.floor(context.sampleCount))
      : message
        ? 1
        : null;
  const error = normalizeText(context.error);

  if (context.loading) {
    return {
      title: '最近消息刷新中',
      summary: '正在读取 Memory Service time 召回快照，尚未确认可回放样本。',
      detail:
        '刷新只发起只读召回请求；等待期间不会写入 Memory Service、不会发送通知、不会执行规则自动化、不会标记原消息已读，也不会覆盖保存基线。',
      tone: 'review',
      chips: ['读取中', 'Memory Service', 'time 召回', '只读快照'],
    };
  }

  if (error) {
    return {
      title: '最近消息读取失败',
      summary: `本次没有拿到可回放样本：${error}`,
      detail:
        '读取失败只说明这次 time 召回未形成最近消息候选，不证明没有相关线上消息，也不代表当前聊天页已覆盖。失败不会写入 Memory Service、不会发送通知、不会执行规则自动化、不会标记原消息已读，也不会覆盖保存基线。',
      tone: 'review',
      chips: ['读取失败', 'Memory Service', '只读快照'],
    };
  }

  if (!message && sampleCount === 0) {
    return {
      title: '最近消息范围',
      summary: '本次刷新没有可回放的最近消息样本。',
      detail:
        '空结果只是当前 Memory Service time 召回快照没有可用消息候选，不证明没有相关线上消息，也不代表当前聊天页、所有群组或时间窗口已覆盖。刷新不会写入 Memory Service、不会发送通知、不会执行规则自动化、不会标记原消息已读，也不会覆盖保存基线。',
      tone: 'review',
      chips: ['样本 0', 'Memory Service', 'time 召回', '只读快照'],
    };
  }

  if (!message) {
    return {
      title: '最近消息范围',
      summary: '尚未选中可回放消息。',
      detail:
        '最近消息来自 Memory Service 的 time 召回只读快照；选择一条后才会填入或回放测试。未选择时不会写入 Memory Service、不会发送通知、不会执行规则自动化、不会标记原消息已读，也不会覆盖保存基线。',
      tone: 'info',
      chips: [
        sampleCount === null ? '' : `样本 ${sampleCount}`,
        'Memory Service',
        'time 召回',
        '只读快照',
      ].filter(Boolean),
    };
  }

  const sourceLabel = [
    message.source && message.source !== 'unknown' ? message.source : '',
    message.sourceTitle && message.sourceTitle !== message.teamName
      ? message.sourceTitle
      : '',
  ]
    .filter(Boolean)
    .join(' / ');
  const scoreChip =
    typeof message.score === 'number' && Number.isFinite(message.score)
      ? `相似度 ${Math.round(message.score * 100)}%`
      : '';

  return {
    title: '最近消息回放范围',
    summary: `使用 ${message.sender} @ ${message.teamName} 的记忆样本重跑当前配置。`,
    detail:
      '这条输入来自 Memory Service 最近记忆的只读快照，不代表当前聊天页仍有同一条 live 消息，也不代表所有线上关注项、群组或时间窗口已覆盖。回放不会写入 Memory Service、不会发送通知、不会执行规则自动化、不会标记原消息已读，也不会覆盖保存基线。',
    tone: 'info',
    chips: [
      `样本 ${sampleCount ?? 1}`,
      sourceLabel || 'Memory Service',
      formatReceiptTimestamp(message.datetime) || '时间未知',
      scoreChip,
      '只读快照',
    ].filter(Boolean),
  };
}

export function buildAgentWorkflowSavedScenarioSourceReceipt(
  scenario?: AgentWorkflowSavedScenario | null,
  context?: AgentWorkflowSavedScenarioReceiptContext,
): AgentWorkflowTestSourceReceipt {
  if (!scenario) {
    return {
      title: '保存样例范围',
      summary: '还没有保存样例。',
      detail:
        '保存当前用例后，才能建立基线并做批量回归对比。',
      tone: 'info',
      chips: ['本地 storage'],
    };
  }

  const hasBaseline = Boolean(scenario.expectedResult);
  const hasContext = Boolean(context);
  const currentInputMatchesScenario =
    context?.currentInputMatchesScenario !== false;
  const configMatchesBaseline =
    context?.agentConfigMatchesBaseline !== false;
  const resultReadyForScenario =
    hasContext &&
    Boolean(context?.hasResult) &&
    context?.resultMatchesScenario === true &&
    context?.resultIsStale !== true;
  const resultStaleForScenario =
    hasContext &&
    Boolean(context?.hasResult) &&
    context?.resultMatchesScenario === true &&
    context?.resultIsStale === true;
  const capturedAt = formatReceiptTimestamp(
    scenario.expectedResult?.capturedAt || scenario.updatedAt,
  );
  const baselineChip = hasBaseline ? '有基线' : '无基线';
  const baselineConfigLabel =
    context?.baselineAgentConfigLabel ||
    formatAgentWorkflowAgentConfigSnapshot(
      scenario.expectedResult?.agentConfigSnapshot,
    );
  const currentConfigLabel =
    context?.currentAgentConfigLabel || baselineConfigLabel;
  const configDetail =
    hasBaseline && !configMatchesBaseline
      ? ` 基线配置：${baselineConfigLabel}；当前配置：${currentConfigLabel}。`
      : '';

  if (!currentInputMatchesScenario) {
    return {
      title: '保存样例输入边界',
      summary:
        '当前输入不是所选保存样例；保存基线和批量回归仍只对应下拉框里的样例。',
      detail:
        '填入或运行保存样例后，才把下方对比作为这条保存样例的回归门禁；手动编辑后的输入可以另存为新样例。',
      tone: 'review',
      chips: [
        baselineChip,
        '输入已变更',
        capturedAt ? `基线 ${capturedAt}` : '',
        '本地 storage',
      ].filter(Boolean),
    };
  }

  let summary = hasBaseline
    ? '已有结果基线；批量回归会比较存储、通知、复核、Trace、规则和置信度。'
    : '尚无结果基线；先运行一次，再建立可比较的基线。';
  let tone: AgentWorkflowTestSourceReceiptTone = hasBaseline ? 'ready' : 'review';
  const chips = [
    baselineChip,
    capturedAt ? `基线 ${capturedAt}` : '',
    '本地 storage',
  ];

  if (hasContext) {
    tone = resultReadyForScenario && hasBaseline ? 'ready' : 'review';
    if (resultReadyForScenario && hasBaseline) {
      summary =
        '已有结果基线；当前结果属于这条保存样例，可用于基线对比或批量回归判断。';
      chips.splice(1, 0, '当前结果可比');
    } else if (resultReadyForScenario && !hasBaseline) {
      summary = '尚无结果基线；本次结果属于这条保存样例，可以建立当前结果基线。';
      chips.splice(1, 0, '可建立基线');
    } else if (resultStaleForScenario) {
      summary =
        '已有结果基线，但上一次结果已过期；重新运行保存样例后再更新或判断基线。';
      chips.splice(1, 0, '结果已过期');
    } else if (hasBaseline) {
      summary =
        '已有结果基线；当前页面还没有运行这条保存样例，运行后才会显示可比较结果。';
      chips.splice(1, 0, '等待运行');
    } else {
      summary = '尚无结果基线；先运行这条保存样例，再建立可比较的基线。';
      chips.splice(1, 0, '等待运行');
    }
  }

  if (hasBaseline && !configMatchesBaseline) {
    tone = 'review';
    summary = resultStaleForScenario
      ? '基线建立时的 Agent 配置不同，且上一次结果已过期；重新运行保存样例后再判断漂移。'
      : resultReadyForScenario
        ? '当前结果属于这条保存样例，但基线建立时的 Agent 配置不同；变化可能来自配置版本。'
        : '已有结果基线，但基线建立时的 Agent 配置不同；运行后按当前配置对比。';
    chips.splice(1, 0, '配置已变更');
  }

  return {
    title: '保存样例基线范围',
    summary,
    detail:
      `保存样例只存在本地 storage；运行或批量回归只重跑当前 Agent 配置，不会投递真实通知或执行规则自动化。${configDetail}`,
    tone,
    chips: chips.filter(Boolean),
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

export function formatAgentWorkflowRegressionFailureDetail(
  errorMessage?: string,
): string {
  const normalizedError = normalizeText(errorMessage);
  return `失败原因：${
    normalizedError || '该样例未产出可对比结果，请单独重跑确认。'
  }`;
}
