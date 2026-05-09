import type {
  BridgeAssistantRuntimeSummary,
  BridgeAssistantStatusItem,
  BridgeAssistantStatusKind,
  BridgeStatus,
} from './types.js';

interface ConfirmRequestLike {
  id: string;
  question: string;
  category?: string;
  priority?: string;
}

interface RuntimeActionLike {
  id: string;
  title: string;
  actionType?: string;
  queueStatus: 'queued' | 'running' | 'succeeded' | 'failed' | 'cancelled' | 'dead_letter';
}

interface OutreachSummaryLike {
  waitingReplyCount: number;
  pendingApprovalCount: number;
  escalatedCount: number;
}

interface OutreachSessionLike {
  id: string;
  status:
    | 'pending_approval'
    | 'scheduled'
    | 'waiting_reply'
    | 'deferred'
    | 'resolved'
    | 'no_reply'
    | 'escalated'
    | 'cancelled'
    | 'failed';
  renderedQuestion: string;
}

export interface AssistantRuntimeBuildInput {
  status: BridgeStatus;
  confirmRequests?: { items: ConfirmRequestLike[] };
  runningActions?: { items: RuntimeActionLike[] };
  queuedActions?: { items: RuntimeActionLike[] };
  outreachSummary?: OutreachSummaryLike;
  waitingReplySessions?: { items: OutreachSessionLike[] };
  pendingApprovalSessions?: { items: OutreachSessionLike[] };
  runtimeErrorMessage?: string;
}

export interface AssistantRememberClassification {
  normalizedText: string;
  itemType: 'preference' | 'fact';
  itemKey: string;
  itemValue: string;
}

const REMEMBER_INTENT_PATTERNS = [
  /^(?:请帮我|帮我|麻烦你|请你|请)?\s*(?:记住|记下|记录|保存)(?!了吗|吗|没|没有|哪些|什么)(?:一下|到(?:长期)?记忆|在(?:长期)?记忆里)?[：:\s]*/i,
  /^以后(?:请|帮我|麻烦你)?\s*(?:记住|记下|记录)(?!了吗|吗|没|没有|哪些|什么)[：:\s]*/i,
  /^(?:please\s+)?(?:remember|save|note)(?:\s+(?:that|this))?(?:[\s:：]|$)/i,
];

const STATUS_PRIORITIES: Record<BridgeAssistantStatusKind, number> = {
  setup_blocker: 1,
  sync_issue: 2,
  confirm_request: 3,
  running_action: 4,
  waiting_reply: 5,
  queued_action: 6,
};

const STATUS_LABELS: Record<BridgeAssistantStatusKind, string> = {
  setup_blocker: '还没完成设置',
  sync_issue: '豆包同步异常',
  confirm_request: '待你确认',
  running_action: '工具执行中',
  waiting_reply: '外部询问等待回复',
  queued_action: '动作排队中',
};

function summarizeSetupBlocker(status: BridgeStatus, runtimeErrorMessage?: string): BridgeAssistantStatusItem | undefined {
  const blockers = status.blockingReasons || [];
  if (blockers.length === 0 && !runtimeErrorMessage) return undefined;

  const summary = runtimeErrorMessage || blockers[0]?.message || '还有配置未完成。';
  const count = Math.max(blockers.length, runtimeErrorMessage ? 1 : 0);

  return {
    kind: 'setup_blocker',
    title: STATUS_LABELS.setup_blocker,
    summary,
    count,
    badgeLabel: `${count} 项`,
    actionHint: '打开设置继续完成',
    priority: STATUS_PRIORITIES.setup_blocker,
  };
}

function summarizeSyncIssue(status: BridgeStatus): BridgeAssistantStatusItem | undefined {
  const summary =
    status.syncState?.lastErrorMessage ||
    status.lastError ||
    '';
  if (!summary) return undefined;

  return {
    kind: 'sync_issue',
    title: STATUS_LABELS.sync_issue,
    summary,
    count: 1,
    badgeLabel: '需检查',
    actionHint: '查看同步诊断',
    priority: STATUS_PRIORITIES.sync_issue,
  };
}

function summarizeConfirmRequest(confirmRequests?: { items: ConfirmRequestLike[] }): BridgeAssistantStatusItem | undefined {
  const items = confirmRequests?.items || [];
  if (items.length === 0) return undefined;
  const first = items[0];
  return {
    kind: 'confirm_request',
    title: STATUS_LABELS.confirm_request,
    summary: first.question || `有 ${items.length} 条确认请求等待你决定。`,
    count: items.length,
    badgeLabel: `${items.length} 条`,
    actionHint: '继续追问这条状态',
    priority: STATUS_PRIORITIES.confirm_request,
  };
}

function summarizeAction(
  kind: 'running_action' | 'queued_action',
  actions?: { items: RuntimeActionLike[] },
): BridgeAssistantStatusItem | undefined {
  const items = actions?.items || [];
  if (items.length === 0) return undefined;
  const first = items[0];
  return {
    kind,
    title: STATUS_LABELS[kind],
    summary:
      first.title ||
      first.actionType ||
      (kind === 'running_action' ? '有工具任务正在执行。' : '有工具任务还在排队中。'),
    count: items.length,
    badgeLabel: `${items.length} 项`,
    actionHint: '继续追问这条状态',
    priority: STATUS_PRIORITIES[kind],
  };
}

function summarizeOutreach(
  outreachSummary?: OutreachSummaryLike,
  waitingReplySessions?: { items: OutreachSessionLike[] },
  pendingApprovalSessions?: { items: OutreachSessionLike[] },
): BridgeAssistantStatusItem | undefined {
  const waitingReplyCount = outreachSummary?.waitingReplyCount || 0;
  const pendingApprovalCount = outreachSummary?.pendingApprovalCount || 0;
  const escalatedCount = outreachSummary?.escalatedCount || 0;
  const total = waitingReplyCount + pendingApprovalCount + escalatedCount;
  if (total === 0) return undefined;

  const firstWaiting = waitingReplySessions?.items?.[0];
  const firstPendingApproval = pendingApprovalSessions?.items?.[0];
  const summary =
    firstWaiting?.renderedQuestion ||
    firstPendingApproval?.renderedQuestion ||
    `有 ${total} 条外部询问相关状态需要关注。`;

  const badgeParts: string[] = [];
  if (waitingReplyCount > 0) badgeParts.push(`待回 ${waitingReplyCount}`);
  if (pendingApprovalCount > 0) badgeParts.push(`待发 ${pendingApprovalCount}`);
  if (escalatedCount > 0) badgeParts.push(`升级 ${escalatedCount}`);

  return {
    kind: 'waiting_reply',
    title: STATUS_LABELS.waiting_reply,
    summary,
    count: total,
    badgeLabel: badgeParts.join(' / '),
    actionHint: '继续追问这条状态',
    priority: STATUS_PRIORITIES.waiting_reply,
  };
}

export function buildAssistantRuntimeSummary(input: AssistantRuntimeBuildInput): BridgeAssistantRuntimeSummary {
  const items = [
    summarizeSetupBlocker(input.status, input.runtimeErrorMessage),
    summarizeSyncIssue(input.status),
    summarizeConfirmRequest(input.confirmRequests),
    summarizeAction('running_action', input.runningActions),
    summarizeOutreach(input.outreachSummary, input.waitingReplySessions, input.pendingApprovalSessions),
    summarizeAction('queued_action', input.queuedActions),
  ].filter((item): item is BridgeAssistantStatusItem => Boolean(item));

  items.sort((left, right) => left.priority - right.priority);
  const topStatus = items[0]
    ? {
        kind: items[0].kind,
        label: STATUS_LABELS[items[0].kind],
        count: items[0].count || 1,
        priority: items[0].priority,
      }
    : undefined;

  return {
    pendingConfirmCount: input.confirmRequests?.items?.length || 0,
    queuedActionCount: input.queuedActions?.items?.length || 0,
    runningActionCount: input.runningActions?.items?.length || 0,
    waitingReplyCount: input.outreachSummary?.waitingReplyCount || 0,
    pendingApprovalCount: input.outreachSummary?.pendingApprovalCount || 0,
    escalatedCount: input.outreachSummary?.escalatedCount || 0,
    memoryGrowth: input.status.memoryGrowth,
    topStatus,
    items,
    fetchedAt: new Date().toISOString(),
  };
}

export function buildAskContextFromTurns(
  turns: Array<{ userText?: string; assistantText?: string }>,
  maxTurns = 4,
  maxChars = 4_000,
): string {
  const relevantTurns = turns
    .slice(-maxTurns)
    .map((turn) => {
      const parts: string[] = [];
      if (turn.userText?.trim()) parts.push(`User: ${turn.userText.trim()}`);
      if (turn.assistantText?.trim()) parts.push(`Assistant: ${turn.assistantText.trim()}`);
      return parts.join('\n');
    })
    .filter(Boolean);

  let context = relevantTurns.join('\n\n');
  while (context.length > maxChars && relevantTurns.length > 1) {
    relevantTurns.shift();
    context = relevantTurns.join('\n\n');
  }

  return context.slice(-maxChars);
}

export function normalizeRememberText(text: string): string {
  const trimmed = text.trim();
  let normalized = trimmed;
  for (const pattern of REMEMBER_INTENT_PATTERNS) {
    if (pattern.test(normalized)) {
      normalized = normalized.replace(pattern, '').trim();
      break;
    }
  }

  return normalized.replace(/^[,，。.!！\s]+|[,，。.!！\s]+$/g, '').trim() || trimmed;
}

export function hasExplicitRememberIntent(text: string): boolean {
  const trimmed = text.trim();
  return REMEMBER_INTENT_PATTERNS.some((pattern) => pattern.test(trimmed));
}

export function classifyRememberText(text: string): AssistantRememberClassification {
  const normalizedText = normalizeRememberText(text);
  const lowered = normalizedText.toLowerCase();

  if (
    /(回复|回答|语气|风格|偏好|喜欢|希望你|请你用|语言|中文|英文|简洁|详细|bullet|emoji|tone|style|prefer|preference|respond)/i.test(
      normalizedText,
    )
  ) {
    const itemKey =
      /(语言|中文|英文|language)/i.test(normalizedText) ? 'language_preference' : 'response_style';
    return {
      normalizedText,
      itemType: 'preference',
      itemKey,
      itemValue: normalizedText,
    };
  }

  if (/(时区|timezone|utc)/i.test(normalizedText)) {
    return {
      normalizedText,
      itemType: 'fact',
      itemKey: 'timezone',
      itemValue: normalizedText,
    };
  }

  if (/(组织|团队|公司|部门|organization|team|company|department)/i.test(normalizedText)) {
    return {
      normalizedText,
      itemType: 'fact',
      itemKey: 'organization',
      itemValue: normalizedText,
    };
  }

  if (/(职位|角色|role|title|job)/i.test(normalizedText)) {
    return {
      normalizedText,
      itemType: 'fact',
      itemKey: 'role',
      itemValue: normalizedText,
    };
  }

  if (
    /^(我是|我叫|我是个|i am|i'm|my name is|我在|我来自)/i.test(normalizedText) ||
    lowered.includes('my ') ||
    lowered.includes('i ')
  ) {
    return {
      normalizedText,
      itemType: 'fact',
      itemKey: 'identity',
      itemValue: normalizedText,
    };
  }

  return {
    normalizedText,
    itemType: 'fact',
    itemKey: 'remembered_note',
    itemValue: normalizedText,
  };
}

export function isStandaloneRememberRequest(text: string): boolean {
  const trimmed = text.trim();
  if (!hasExplicitRememberIntent(trimmed)) return false;
  if (/[?？]/.test(trimmed)) return false;
  const segments = trimmed.split(/[。.!！\n]/).map((item) => item.trim()).filter(Boolean);
  return segments.length <= 1;
}
