export type ComposerAssistFeedbackKind = 'accepted' | 'rejected';
export type ComposerAssistSurfaceThresholds = Record<string, number>;
export type ComposerAssistDraftReceiptTone = 'ok' | 'warn' | 'muted';

export interface ComposerAssistDraftReceiptRow {
  label: string;
  value: string;
  tone: ComposerAssistDraftReceiptTone;
}

export interface ComposerAssistDraftReceipt {
  title: string;
  rows: ComposerAssistDraftReceiptRow[];
}

export interface ComposerAssistSourceRouteReceiptInput {
  contextType?: string;
  surface?: string;
  scenario?: string;
  suggestionType?: string;
  provider?: string;
  sourceTypes?: string[];
}

export interface ComposerAssistDraftReceiptInput {
  contextType?: string;
  surface?: string;
  suggestionType?: string;
  riskLevel?: 'low' | 'medium' | 'high';
  previewRequired?: boolean;
  reviewRequired?: boolean;
  evidenceTypes?: string[];
  evidenceCount?: number;
}

export interface ComposerAssistInsertionReceiptInput {
  contextType?: string;
  surface?: string;
  suggestionType?: string;
}

export interface ComposerAssistInsertionReceipt {
  title: string;
  detail: string;
}

export interface ComposerRehearsalCueScopeInput {
  metadata?: unknown;
  whyRelevant?: string[];
  maxItems?: number;
}

export const DEFAULT_ASSIST_CONFIDENCE_THRESHOLD = 0.78;
export const DEFAULT_ASSIST_PREVIEW_LIMIT = 520;
export const COMPOSER_ASSIST_INSERT_UNDO_WINDOW_SECONDS = 10;
const MIN_ADAPTIVE_ASSIST_CONFIDENCE = 0.62;
const MAX_ADAPTIVE_ASSIST_CONFIDENCE = 0.92;
const ACCEPT_THRESHOLD_ADJUSTMENT_RATE = 0.12;
const REJECT_THRESHOLD_ADJUSTMENT_RATE = 0.16;
const DEFAULT_REHEARSAL_CUE_SCOPE_ITEMS = 4;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function roundThreshold(value: number): number {
  return Number(value.toFixed(3));
}

export function normalizeComposerAssistThreshold(
  value: unknown,
  fallback = DEFAULT_ASSIST_CONFIDENCE_THRESHOLD,
): number {
  const candidate = Number(value);
  if (!Number.isFinite(candidate)) {
    return roundThreshold(
      clamp(
        Number.isFinite(fallback)
          ? fallback
          : DEFAULT_ASSIST_CONFIDENCE_THRESHOLD,
        MIN_ADAPTIVE_ASSIST_CONFIDENCE,
        MAX_ADAPTIVE_ASSIST_CONFIDENCE,
      ),
    );
  }
  return roundThreshold(
    clamp(
      candidate,
      MIN_ADAPTIVE_ASSIST_CONFIDENCE,
      MAX_ADAPTIVE_ASSIST_CONFIDENCE,
    ),
  );
}

export function normalizeComposerAssistSurfaceThresholds(
  value: unknown,
): ComposerAssistSurfaceThresholds {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }

  const thresholds: ComposerAssistSurfaceThresholds = {};
  for (const [rawSurface, rawThreshold] of Object.entries(
    value as Record<string, unknown>,
  )) {
    const surface = rawSurface.trim();
    const threshold = Number(rawThreshold);
    if (!surface || !Number.isFinite(threshold)) continue;
    thresholds[surface] = normalizeComposerAssistThreshold(threshold);
  }
  return thresholds;
}

export function getComposerAssistThresholdForSurface(
  surface: string | undefined,
  thresholds: ComposerAssistSurfaceThresholds,
  fallback = DEFAULT_ASSIST_CONFIDENCE_THRESHOLD,
): number {
  const normalizedFallback = normalizeComposerAssistThreshold(fallback);
  if (!surface) return normalizedFallback;
  const surfaceThreshold = thresholds[surface];
  return Number.isFinite(surfaceThreshold)
    ? normalizeComposerAssistThreshold(surfaceThreshold, normalizedFallback)
    : normalizedFallback;
}

export function getNextComposerAssistThreshold(
  currentValue: number,
  feedbackKind: ComposerAssistFeedbackKind,
): number {
  const current = normalizeComposerAssistThreshold(currentValue);
  if (feedbackKind === 'accepted') {
    const delta =
      (current - MIN_ADAPTIVE_ASSIST_CONFIDENCE) *
      ACCEPT_THRESHOLD_ADJUSTMENT_RATE;
    return normalizeComposerAssistThreshold(current - delta);
  }

  const delta =
    (MAX_ADAPTIVE_ASSIST_CONFIDENCE - current) *
    REJECT_THRESHOLD_ADJUSTMENT_RATE;
  return normalizeComposerAssistThreshold(current + delta);
}

export function sanitizeComposerAssistInsertText(text?: string): string {
  return (text || '')
    .replace(/^Personal AI context to consider before replying:\s*/i, '')
    .replace(/^Personal AI context pack \(review before sending\):\s*/i, '')
    .replace(/^Personal AI context for [^\n]+:\s*/i, '')
    .replace(/\n?\s*Please review and edit before sending\.?\s*$/i, '')
    .replace(
      /\n?\s*Please verify against the current Jira state before posting\.?\s*$/i,
      '',
    )
    .trim();
}

export function getComposerAssistPreviewText(
  text: string | undefined,
  options: {
    forceFull?: boolean;
    maxLength?: number;
  } = {},
): string {
  const preview = sanitizeComposerAssistInsertText(text);
  const maxLength =
    Number.isFinite(options.maxLength) && Number(options.maxLength) > 0
      ? Number(options.maxLength)
      : DEFAULT_ASSIST_PREVIEW_LIMIT;

  if (options.forceFull || preview.length <= maxLength) {
    return preview;
  }

  return `${preview.slice(0, maxLength).trimEnd()}...`;
}

function asPlainObject(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => (typeof item === 'string' ? item.trim() : ''))
    .filter(Boolean);
}

function getRehearsalCueObject(
  metadata: unknown,
  key: 'matchedCues' | 'activationCues',
): Record<string, unknown> | null {
  const root = asPlainObject(metadata);
  if (!root) return null;
  const topLevel = asPlainObject(root[key]);
  if (topLevel) return topLevel;
  const rehearsal = asPlainObject(root.rehearsal);
  return asPlainObject(rehearsal?.[key]);
}

function clipCueScopeValue(value: string, maxLength = 28): string {
  const normalized = value.replace(/\s+/g, ' ').trim();
  if (!normalized) return '';
  if (/^https?:\/\//i.test(normalized)) {
    try {
      return new URL(normalized).hostname || normalized;
    } catch {
      // Keep the original normalized value below.
    }
  }
  return normalized.length > maxLength
    ? `${normalized.slice(0, maxLength).trimEnd()}...`
    : normalized;
}

export function buildComposerRehearsalCueScopeLabel(
  input: ComposerRehearsalCueScopeInput,
): string {
  const matchedCues = getRehearsalCueObject(input.metadata, 'matchedCues');
  const activationCues = getRehearsalCueObject(input.metadata, 'activationCues');
  const cueSource = matchedCues || activationCues || {};
  const maxItems = Math.max(
    1,
    Math.floor(Number(input.maxItems) || DEFAULT_REHEARSAL_CUE_SCOPE_ITEMS),
  );
  const parts: string[] = [];
  const append = (label: string, key: string, maxValues = 2) => {
    if (parts.length >= maxItems) return;
    const values = asStringArray(cueSource[key])
      .map((value) => clipCueScopeValue(value))
      .filter(Boolean)
      .slice(0, maxValues);
    if (!values.length) return;
    parts.push(`${label} ${values.join('、')}`);
  };

  append('人物', 'people');
  append('项目', 'projects');
  append('Issue', 'issueKeys');
  append('群聊', 'groupIds', 1);
  append('会话', 'conversationIds', 1);
  append('会议', 'meetingIds', 1);
  append('日历', 'calendarIds', 1);
  append('URL', 'urls', 1);
  append('入口', 'surfaces', 1);
  append('主题', 'topics');
  append('关键词', 'keywords');

  if (parts.length) return parts.slice(0, maxItems).join(' / ');

  return (input.whyRelevant ?? [])
    .map((item) => clipCueScopeValue(item, 36))
    .filter(Boolean)
    .slice(0, 2)
    .join(' / ');
}

function getComposerDraftTargetLabel(
  input: ComposerAssistDraftReceiptInput,
): string {
  if (input.suggestionType === 'prompt_patch') {
    return '外部 AI prompt 补丁';
  }
  if (
    input.contextType === 'web_agent_prompt' ||
    input.suggestionType === 'context_pack'
  ) {
    return '外部 AI context pack';
  }
  if (input.contextType === 'jira_issue' || input.surface === 'jira_issue') {
    return 'Jira comment 草稿';
  }
  if (input.surface === 'ringcentral_thread') {
    return 'RingCentral thread 回复草稿';
  }
  if (input.surface === 'ringcentral_message') {
    return 'RingCentral 回复草稿';
  }
  return '当前输入框草稿';
}

function getComposerEvidenceTypeLabel(type: string): string {
  switch (type) {
    case 'rehearsal':
      return '预演提醒';
    case 'source_memory':
      return '资料记忆';
    case 'message':
      return '消息记忆';
    case 'entity':
      return '人物/实体';
    default:
      return '记忆片段';
  }
}

function getComposerReviewBoundary(
  input: ComposerAssistDraftReceiptInput,
): ComposerAssistDraftReceiptRow {
  const evidenceTypes = input.evidenceTypes ?? [];
  if (input.riskLevel === 'high') {
    return {
      label: '复核边界',
      value: '高风险，需核对事实/语气/敏感信息',
      tone: 'warn',
    };
  }
  if (evidenceTypes.includes('rehearsal')) {
    return {
      label: '复核边界',
      value: '预演提醒，需确认未来场景仍适合',
      tone: 'warn',
    };
  }
  if (input.previewRequired || input.reviewRequired) {
    return {
      label: '复核边界',
      value: '后端要求预览确认',
      tone: 'warn',
    };
  }
  return {
    label: '复核边界',
    value: '低风险，仍可编辑或撤销',
    tone: 'ok',
  };
}

function getComposerEvidenceSummary(
  input: ComposerAssistDraftReceiptInput,
): ComposerAssistDraftReceiptRow {
  const evidenceCount = Math.max(0, Math.floor(Number(input.evidenceCount) || 0));
  const evidenceTypes = Array.from(
    new Set((input.evidenceTypes ?? []).filter(Boolean)),
  )
    .map(getComposerEvidenceTypeLabel)
    .slice(0, 3);
  if (evidenceCount <= 0) {
    return {
      label: '建议依据',
      value: '0 条证据，按当前草稿保守处理',
      tone: 'muted',
    };
  }
  const typeSummary = evidenceTypes.length ? ` · ${evidenceTypes.join(' / ')}` : '';
  return {
    label: '建议依据',
    value: `${evidenceCount} 条${typeSummary}`,
    tone: 'ok',
  };
}

function getComposerSourceRouteLabel(
  input: ComposerAssistSourceRouteReceiptInput,
): string {
  if (input.surface === 'ringcentral_thread') {
    return 'RingCentral thread 回复';
  }
  if (input.surface === 'ringcentral_message') {
    return 'RingCentral 主会话回复';
  }
  if (input.contextType === 'jira_issue' || input.surface === 'jira_issue') {
    return 'Jira comment';
  }
  if (input.contextType === 'web_agent_prompt') {
    const provider = (input.provider || input.surface || '').trim();
    if (provider && provider !== 'generic_agent') {
      return `${provider} prompt`;
    }
    return 'Web AI prompt';
  }
  return '当前输入框';
}

function getComposerCurrentContextLabel(
  input: ComposerAssistSourceRouteReceiptInput,
): string {
  if (input.surface === 'ringcentral_thread') {
    return 'thread root + 可见回复';
  }
  if (input.surface === 'ringcentral_message') {
    return '主会话可见消息';
  }
  if (input.contextType === 'jira_issue' || input.surface === 'jira_issue') {
    return 'issue 字段、描述、评论';
  }
  if (input.contextType === 'web_agent_prompt') {
    return '当前 prompt + 可见 AI turns';
  }
  return '当前页面和输入框';
}

function getComposerSourceTypeLabel(sourceType: string): string {
  switch (sourceType) {
    case 'ai_chat':
    case 'chatgpt':
    case 'doubao':
    case 'doubao_chat':
      return 'AI 对话';
    case 'codex_cli':
    case 'claude_code_cli':
    case 'cursor_agent_cli':
      return 'Agent 会话';
    case 'glip':
      return '聊天';
    case 'jira':
      return 'Jira';
    case 'meeting':
      return '会议';
    case 'calendar':
      return '日历';
    case 'source_memory':
      return '资料';
    case 'manual':
      return '手动';
    case 'markdown':
      return '文档';
    case 'web':
      return '网页';
    case 'user_core':
      return '画像';
    case 'system':
      return '系统';
    case 'reflection':
      return '反思';
    case 'reflection_thread':
      return '反思线程';
    case 'rehearsal':
      return '预演';
    default:
      return sourceType;
  }
}

function getComposerAllowedSourceSummary(sourceTypes?: string[]): string {
  const labels = Array.from(
    new Set((sourceTypes ?? []).filter(Boolean).map(getComposerSourceTypeLabel)),
  );
  if (!labels.length) {
    return '使用后端默认来源';
  }
  const visible = labels.slice(0, 6);
  const suffix = labels.length > visible.length ? ` +${labels.length - visible.length}` : '';
  return `${labels.length} 类：${visible.join(' / ')}${suffix}`;
}

function getComposerRouteBoundary(
  input: ComposerAssistSourceRouteReceiptInput,
): ComposerAssistDraftReceiptRow {
  if (input.contextType === 'web_agent_prompt') {
    const currentProvider = (input.provider || input.surface || '')
      .trim()
      .toLowerCase();
    const sourceTypes = new Set(input.sourceTypes ?? []);
    const currentProviderSources =
      currentProvider === 'chatgpt'
        ? ['chatgpt']
        : currentProvider === 'doubao'
        ? ['doubao', 'doubao_chat']
        : currentProvider === 'codex_cli'
        ? ['codex_cli']
        : currentProvider === 'claude_code_cli'
        ? ['claude_code_cli']
        : currentProvider === 'cursor_agent_cli'
        ? ['cursor_agent_cli']
        : [];
    const providerSelfExcluded =
      currentProviderSources.length > 0 &&
      currentProviderSources.every((sourceType) => !sourceTypes.has(sourceType));
    const patchLabel =
      input.suggestionType === 'prompt_patch' ? 'prompt 补丁' : 'context pack';
    const boundary =
      currentProviderSources.length === 0
        ? `只插 ${patchLabel}，不提交；按当前 AI provider 边界召回`
        : providerSelfExcluded
        ? `当前 AI 自身历史已排除；只插 ${patchLabel}，不提交`
        : `只插 ${patchLabel}，不提交；当前 AI 自身历史后端剔除`;
    return {
      label: '路由边界',
      value: boundary,
      tone: 'warn',
    };
  }
  if (input.contextType === 'jira_issue' || input.surface === 'jira_issue') {
    return {
      label: '路由边界',
      value: 'issue 优先，草稿只作语气/去重',
      tone: 'ok',
    };
  }
  if (
    input.surface === 'ringcentral_message' ||
    input.surface === 'ringcentral_thread'
  ) {
    return {
      label: '路由边界',
      value:
        input.surface === 'ringcentral_thread'
          ? 'thread 优先，不混主会话；草稿只作语气/去重'
          : '主会话优先，不混 thread；草稿只作语气/去重',
      tone: 'ok',
    };
  }
  return {
    label: '路由边界',
    value: '当前页面优先，只写入草稿',
    tone: 'muted',
  };
}

function getComposerRouteRefreshBoundary(
  input: ComposerAssistSourceRouteReceiptInput,
): ComposerAssistDraftReceiptRow {
  if (input.contextType === 'web_agent_prompt') {
    return {
      label: '刷新口径',
      value: 'prompt 或 AI turns 变化会重算；拒绝只影响当前 prompt',
      tone: 'ok',
    };
  }
  if (input.contextType === 'jira_issue' || input.surface === 'jira_issue') {
    return {
      label: '刷新口径',
      value: 'issue 字段/comment 变化会重算；切换 issue 重新路由',
      tone: 'ok',
    };
  }
  if (input.surface === 'ringcentral_thread') {
    return {
      label: '刷新口径',
      value: 'thread root 或可见回复变化会重算；不沿用主会话',
      tone: 'ok',
    };
  }
  if (input.surface === 'ringcentral_message') {
    return {
      label: '刷新口径',
      value: '主会话可见消息变化会重算；不沿用 thread',
      tone: 'ok',
    };
  }
  return {
    label: '刷新口径',
    value: '页面或输入框变化会重算；只写入当前草稿',
    tone: 'muted',
  };
}

export function buildComposerAssistSourceRouteReceipt(
  input: ComposerAssistSourceRouteReceiptInput,
): ComposerAssistDraftReceipt {
  return {
    title: '来源路由',
    rows: [
      {
        label: '场景路由',
        value: getComposerSourceRouteLabel(input),
        tone: 'muted',
      },
      {
        label: '当前上下文',
        value: getComposerCurrentContextLabel(input),
        tone: 'muted',
      },
      {
        label: '允许召回',
        value: getComposerAllowedSourceSummary(input.sourceTypes),
        tone: input.sourceTypes?.length ? 'ok' : 'muted',
      },
      getComposerRouteBoundary(input),
      getComposerRouteRefreshBoundary(input),
    ],
  };
}

export function buildComposerAssistDraftReceipt(
  input: ComposerAssistDraftReceiptInput,
): ComposerAssistDraftReceipt {
  const reviewRequired = Boolean(input.reviewRequired);
  return {
    title: '草稿回执',
    rows: [
      {
        label: '插入对象',
        value: getComposerDraftTargetLabel(input),
        tone: 'muted',
      },
      {
        label: '动作边界',
        value: reviewRequired
          ? '先锁定预览，确认后只插入草稿'
          : '点击 icon 只插入草稿，不发送/提交',
        tone: reviewRequired ? 'warn' : 'ok',
      },
      getComposerReviewBoundary(input),
      getComposerEvidenceSummary(input),
    ],
  };
}

export function buildComposerAssistInsertionReceipt(
  input: ComposerAssistInsertionReceiptInput,
): ComposerAssistInsertionReceipt {
  const target = getComposerDraftTargetLabel(input);
  const isWebAi =
    input.contextType === 'web_agent_prompt' ||
    input.suggestionType === 'context_pack' ||
    input.suggestionType === 'prompt_patch';
  const isJira =
    input.contextType === 'jira_issue' || input.surface === 'jira_issue';
  const isRingCentral =
    input.surface === 'ringcentral_message' ||
    input.surface === 'ringcentral_thread';
  const boundary = isWebAi
    ? '没有提交 prompt、没有发送给外部 AI'
    : isJira
      ? '没有提交 Jira comment'
      : isRingCentral
        ? '没有发送 RingCentral 消息'
        : '没有发送或提交';

  return {
    title: '已插入草稿',
    detail: `写入目标：${target}；${boundary}；约 ${COMPOSER_ASSIST_INSERT_UNDO_WINDOW_SECONDS} 秒内可撤销；撤销窗口结束后才记录 accepted 和脱敏校准信号。`,
  };
}
