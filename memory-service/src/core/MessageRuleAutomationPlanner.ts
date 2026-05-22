import { createHash } from 'node:crypto';

import {
  ActionRepository,
  type QueuedActionRecord,
} from '../repositories/ActionRepository.js';
import { now } from '../utils/time.js';
import {
  reviewMessageRuleAutomationPrompt,
  type MessageRuleAutomationWarning,
} from './MessageRuleAutomationAdvisor.js';
import { resolveDelegateOpenClawPolicy } from './actions/delegateOpenClawPolicy.js';
import { detectAutomationActionFamily } from './actions/detectAutomationActionFamily.js';

export interface MessageRuleAutomationPlanInput {
  ruleRef: string;
  ruleText?: string;
  automationPrompt: string;
  requiresApproval?: boolean;
  message: {
    postId?: string;
    sender?: string;
    groupId?: string;
    groupName?: string;
    content: string;
    timestamp?: number;
    timezone?: string;
    event?: {
      title?: string;
      start?: string;
      end?: string;
      startAtMs?: number;
      endAtMs?: number;
      timeRange?: string;
      location?: string;
      allDay?: boolean;
    };
  };
  match?: {
    matchedRule?: string;
    summary?: string;
    confidence?: number;
  };
}

export interface MessageRuleAutomationPlanResult {
  deduped: boolean;
  skippedReason?: string;
  actions: QueuedActionRecord[];
  detectedWindow?: {
    startAt: number;
    endAt: number;
    startActionAt: number;
    restoreActionAt: number;
    label: string;
  };
}

export interface MessageRuleAutomationPreviewAction {
  actionType: 'notify_user' | 'delegate_openclaw';
  title: string;
  description?: string;
  targetSystem?: string;
  scheduledAt?: number;
  executionMode?: 'manual' | 'auto';
  requiresApproval?: boolean;
}

export interface MessageRuleAutomationPreviewResult {
  canPlan: boolean;
  skippedReason?: string;
  actionFamily: ReturnType<typeof detectAutomationActionFamily>;
  actions: MessageRuleAutomationPreviewAction[];
  warnings: MessageRuleAutomationWarning[];
  suggestedPrompt?: string;
  suggestionReason?: string;
  detectedWindow?: {
    startAt: number;
    endAt: number;
    startActionAt: number;
    restoreActionAt: number;
    label: string;
  };
}

interface ParsedLeaveWindow {
  startAt: number;
  endAt: number;
  hasExplicitStartTime: boolean;
  hasExplicitEndTime: boolean;
  label: string;
}

interface GenericActionPlan {
  family: Exclude<ReturnType<typeof detectAutomationActionFamily>, 'unknown'>;
  targetSystem: string;
  title: string;
  description: string;
  task: string;
}

interface ParsedDateToken {
  value: number;
  hasExplicitTime: boolean;
}

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function sanitizeTimeZone(value?: string): string | undefined {
  if (typeof value !== 'string' || value.trim().length === 0) {
    return undefined;
  }
  const normalized = value.trim();
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: normalized }).format(0);
    return normalized;
  } catch {
    return undefined;
  }
}

function getDateTimePartsInTimeZone(
  timestampMs: number,
  timeZone?: string,
): {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
} {
  const date = new Date(timestampMs);
  if (!timeZone) {
    return {
      year: date.getFullYear(),
      month: date.getMonth() + 1,
      day: date.getDate(),
      hour: date.getHours(),
      minute: date.getMinutes(),
      second: date.getSeconds(),
    };
  }

  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
    hourCycle: 'h23',
  });
  const parts = formatter.formatToParts(date);
  const read = (type: string) => {
    const value = parts.find((part) => part.type === type)?.value;
    return value ? parseInt(value, 10) : 0;
  };

  return {
    year: read('year'),
    month: read('month'),
    day: read('day'),
    hour: read('hour'),
    minute: read('minute'),
    second: read('second'),
  };
}

function getTimeZoneOffsetMs(timeZone: string, utcMs: number): number {
  const parts = getDateTimePartsInTimeZone(utcMs, timeZone);
  const asUtc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
  );
  return asUtc - utcMs;
}

function zonedLocalDateTimeToUtcMs(
  parts: {
    year: number;
    month: number;
    day: number;
    hour: number;
    minute: number;
    second: number;
  },
  timeZone?: string,
): number {
  if (!timeZone) {
    return new Date(
      parts.year,
      parts.month - 1,
      parts.day,
      parts.hour,
      parts.minute,
      parts.second,
      0,
    ).getTime();
  }

  const guessUtcMs = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
    0,
  );
  const firstOffset = getTimeZoneOffsetMs(timeZone, guessUtcMs);
  const firstPass = guessUtcMs - firstOffset;
  const secondOffset = getTimeZoneOffsetMs(timeZone, firstPass);
  return secondOffset === firstOffset
    ? firstPass
    : guessUtcMs - secondOffset;
}

function buildHitRef(input: MessageRuleAutomationPlanInput): string {
  const postId = input.message.postId?.trim();
  if (postId) return postId;
  const digest = createHash('sha1')
    .update(
      JSON.stringify({
        ruleRef: input.ruleRef,
        content: normalizeWhitespace(input.message.content),
        timestamp: input.message.timestamp ?? 0,
      }),
    )
    .digest('hex');
  return `synthetic:${digest}`;
}

function formatMonthDay(value: number, timeZone?: string): string {
  const parts = getDateTimePartsInTimeZone(value, timeZone);
  return `${parts.month}/${parts.day}`;
}

function formatLeaveLabel(startAt: number, endAt: number, timeZone?: string): string {
  const start = formatMonthDay(startAt, timeZone);
  const end = formatMonthDay(endAt, timeZone);
  return start === end ? start : `${start}~${end}`;
}

function hasExplicitTimeToken(value?: string): boolean {
  return typeof value === 'string' && /\d{1,2}:\d{2}(?::\d{2})?/.test(value);
}

function parseDateToken(
  raw: string,
  anchorTime: number,
  defaultToEndOfDay: boolean,
  timeZone?: string,
): ParsedDateToken | null {
  const normalized = normalizeWhitespace(raw);
  const normalizedTimeZone = sanitizeTimeZone(timeZone);
  const anchorDateParts = getDateTimePartsInTimeZone(
    anchorTime || Date.now(),
    normalizedTimeZone,
  );

  const slashMatch = normalized.match(
    /^(?:(\d{4})[\/.-])?(\d{1,2})[\/.-](\d{1,2})(?:\s+(\d{1,2})(?::(\d{2}))?(?::(\d{2}))?)?$/,
  );
  if (slashMatch) {
    const year = slashMatch[1]
      ? parseInt(slashMatch[1], 10)
      : anchorDateParts.year;
    const month = parseInt(slashMatch[2], 10);
    const day = parseInt(slashMatch[3], 10);
    const hasExplicitTime = Boolean(slashMatch[4]);
    const hour = hasExplicitTime
      ? parseInt(slashMatch[4], 10)
      : defaultToEndOfDay
        ? 23
        : 0;
    const minute = hasExplicitTime
      ? parseInt(slashMatch[5] || '0', 10)
      : defaultToEndOfDay
        ? 59
        : 0;
    const second = hasExplicitTime ? parseInt(slashMatch[6] || '0', 10) : 0;
    return {
      value: zonedLocalDateTimeToUtcMs(
        {
          year,
          month,
          day,
          hour,
          minute,
          second,
        },
        normalizedTimeZone,
      ),
      hasExplicitTime,
    };
  }

  const chineseMatch = normalized.match(
    /^(?:(\d{4})年)?(\d{1,2})月(\d{1,2})日(?:\s*(\d{1,2})(?::(\d{2}))?(?::(\d{2}))?)?$/,
  );
  if (chineseMatch) {
    const year = chineseMatch[1]
      ? parseInt(chineseMatch[1], 10)
      : anchorDateParts.year;
    const month = parseInt(chineseMatch[2], 10);
    const day = parseInt(chineseMatch[3], 10);
    const hasExplicitTime = Boolean(chineseMatch[4]);
    const hour = hasExplicitTime
      ? parseInt(chineseMatch[4], 10)
      : defaultToEndOfDay
        ? 23
        : 0;
    const minute = hasExplicitTime
      ? parseInt(chineseMatch[5] || '0', 10)
      : defaultToEndOfDay
        ? 59
        : 0;
    const second = hasExplicitTime ? parseInt(chineseMatch[6] || '0', 10) : 0;
    return {
      value: zonedLocalDateTimeToUtcMs(
        {
          year,
          month,
          day,
          hour,
          minute,
          second,
        },
        normalizedTimeZone,
      ),
      hasExplicitTime,
    };
  }

  return null;
}

function parseLeaveWindowFromEvent(
  message: MessageRuleAutomationPlanInput['message'],
  anchorTime: number,
): ParsedLeaveWindow | null {
  const event = message.event;
  if (!event || typeof event !== 'object') {
    return null;
  }

  const timeZone = sanitizeTimeZone(message.timezone);
  const startAt =
    typeof event.startAtMs === 'number' && Number.isFinite(event.startAtMs)
      ? event.startAtMs
      : typeof event.start === 'string'
        ? parseDateToken(event.start, anchorTime, false, timeZone)?.value
        : undefined;
  const endAt =
    typeof event.endAtMs === 'number' && Number.isFinite(event.endAtMs)
      ? event.endAtMs
      : typeof event.end === 'string'
        ? parseDateToken(event.end, anchorTime, true, timeZone)?.value
        : startAt;

  if (typeof startAt !== 'number' || typeof endAt !== 'number') {
    return null;
  }

  const hasExplicitStartTime =
    hasExplicitTimeToken(event.start) ||
    (event.allDay !== true &&
      typeof event.startAtMs === 'number' &&
      Number.isFinite(event.startAtMs));
  const hasExplicitEndTime =
    hasExplicitTimeToken(event.end) ||
    (event.allDay !== true &&
      typeof event.endAtMs === 'number' &&
      Number.isFinite(event.endAtMs));

  return {
    startAt,
    endAt,
    hasExplicitStartTime,
    hasExplicitEndTime,
    label: formatLeaveLabel(startAt, endAt, timeZone),
  };
}

function parseLeaveWindow(
  message: MessageRuleAutomationPlanInput['message'],
  automationPrompt: string,
  anchorTime: number,
): ParsedLeaveWindow | null {
  if (detectAutomationActionFamily(automationPrompt) !== 'leave_glip_status') {
    return null;
  }

  const eventWindow = parseLeaveWindowFromEvent(message, anchorTime);
  if (eventWindow) {
    return eventWindow;
  }

  const normalizedMessage = normalizeWhitespace(message.content);
  const timeZone = sanitizeTimeZone(message.timezone);

  const rangePatterns = [
    /((?:\d{4}[\/.-])?\d{1,2}[\/.-]\d{1,2}(?:\s+\d{1,2}(?::\d{2})?(?::\d{2})?)?)\s*(?:~|～|—|-|至|到)\s*((?:\d{4}[\/.-])?\d{1,2}[\/.-]\d{1,2}(?:\s+\d{1,2}(?::\d{2})?(?::\d{2})?)?)/,
    /((?:\d{4}年)?\d{1,2}月\d{1,2}日(?:\s*\d{1,2}(?::\d{2})?(?::\d{2})?)?)\s*(?:~|～|—|-|至|到)\s*((?:\d{4}年)?\d{1,2}月\d{1,2}日(?:\s*\d{1,2}(?::\d{2})?(?::\d{2})?)?)/,
  ];

  for (const pattern of rangePatterns) {
    const matched = normalizedMessage.match(pattern);
    if (!matched) continue;
    const start = parseDateToken(matched[1], anchorTime, false, timeZone);
    const end = parseDateToken(matched[2], anchorTime, true, timeZone);
    if (!start || !end) continue;
    return {
      startAt: start.value,
      endAt: end.value,
      hasExplicitStartTime: start.hasExplicitTime,
      hasExplicitEndTime: end.hasExplicitTime,
      label: formatLeaveLabel(start.value, end.value, timeZone),
    };
  }

  const singlePatterns = [
    /((?:\d{4}[\/.-])?\d{1,2}[\/.-]\d{1,2}(?:\s+\d{1,2}(?::\d{2})?(?::\d{2})?)?)/,
    /((?:\d{4}年)?\d{1,2}月\d{1,2}日(?:\s*\d{1,2}(?::\d{2})?(?::\d{2})?)?)/,
  ];
  for (const pattern of singlePatterns) {
    const matched = normalizedMessage.match(pattern);
    if (!matched) continue;
    const start = parseDateToken(matched[1], anchorTime, false, timeZone);
    const end = parseDateToken(matched[1], anchorTime, true, timeZone);
    if (!start || !end) continue;
    return {
      startAt: start.value,
      endAt: end.value,
      hasExplicitStartTime: start.hasExplicitTime,
      hasExplicitEndTime: end.hasExplicitTime,
      label: formatLeaveLabel(start.value, end.value, timeZone),
    };
  }

  return null;
}

function buildGenericActionPlan(
  input: MessageRuleAutomationPlanInput,
): GenericActionPlan | null {
  const family = detectAutomationActionFamily(input.automationPrompt);
  switch (family) {
    case 'forward_message':
      return {
        family,
        targetSystem: 'ringcentral',
        title: '根据消息内容转发信息',
        description: '整理当前消息并转发给指定对象，附带原始上下文。',
        task: [
          `You are executing a memory-entry automation hit for rule ${input.ruleRef}.`,
          `The matched message content is: ${input.message.content}`,
          'Summarize the message, identify the intended recipient from the rule or message context, and forward the information with the original message link when available.',
        ].join('\n'),
      };
    case 'jira_comment':
      return {
        family,
        targetSystem: 'jira',
        title: '为 Jira 工单补充评论',
        description: '识别消息中的 Jira / ticket 编号并追加 comment。',
        task: [
          `You are executing a memory-entry automation hit for rule ${input.ruleRef}.`,
          `The matched message content is: ${input.message.content}`,
          'Extract the Jira ticket identifier, summarize the actionable update, and append it as a comment. If no ticket id can be identified, do not perform the write and report the missing identifier.',
        ].join('\n'),
      };
    case 'spreadsheet_write':
      return {
        family,
        targetSystem: 'google_sheets',
        title: '将消息字段写入表格',
        description: '从消息提取结构化字段并写入一行表格。',
        task: [
          `You are executing a memory-entry automation hit for rule ${input.ruleRef}.`,
          `The matched message content is: ${input.message.content}`,
          'Extract the relevant structured fields from the message and append a new row to the configured spreadsheet. Preserve missing fields as blank cells and include the source message link if available.',
        ].join('\n'),
      };
    case 'glip_status':
      return {
        family,
        targetSystem: 'glip',
        title: '更新 Glip 状态',
        description: '根据消息上下文更新 Glip status。',
        task: [
          `You are executing a memory-entry automation hit for rule ${input.ruleRef}.`,
          `The matched message content is: ${input.message.content}`,
          'Infer the intended Glip status update from the message, including status text and end time when the message provides one, then apply the status change.',
        ].join('\n'),
      };
    case 'schedule_reminder':
      return {
        family,
        targetSystem: 'calendar',
        title: '创建提醒或日程',
        description: '从消息中提取时间和行动项，创建提醒或日程。',
        task: [
          `You are executing a memory-entry automation hit for rule ${input.ruleRef}.`,
          `The matched message content is: ${input.message.content}`,
          'Extract the time and action item, then create a reminder or calendar event. If the time is ambiguous, create a confirmation-needed reminder instead of silently guessing.',
        ].join('\n'),
      };
    case 'leave_glip_status':
    case 'unknown':
      return null;
  }
}

export class MessageRuleAutomationPlanner {
  private readonly actionRepo: ActionRepository;

  constructor(actionRepo: ActionRepository) {
    this.actionRepo = actionRepo;
  }

  preview(
    input: MessageRuleAutomationPlanInput,
  ): MessageRuleAutomationPreviewResult {
    const anchorTime = input.message.timestamp ?? Date.now();
    const actionFamily = detectAutomationActionFamily(input.automationPrompt);
    const review = reviewMessageRuleAutomationPrompt({
      automationPrompt: input.automationPrompt,
      actionFamily,
    });
    const warnings = [...review.warnings];

    if (actionFamily !== 'leave_glip_status') {
      const genericPlan = buildGenericActionPlan(input);
      if (!genericPlan) {
        return {
          canPlan: false,
          skippedReason: 'unsupported_or_unparseable_automation_prompt',
          actionFamily,
          actions: [],
          warnings: [
            ...warnings,
            {
              code: 'unsupported_action_family',
              severity: 'warning',
              message:
                '当前联动操作文案还不能稳定映射到已知 RuntimeAction/OpenClaw 动作族。',
            },
          ],
          suggestedPrompt: review.suggestedPrompt,
          suggestionReason: review.suggestionReason,
        };
      }

      const policy = resolveDelegateOpenClawPolicy({
        params: { mode: 'write' },
        requestedRequiresApproval: input.requiresApproval,
        defaultExecutionMode: 'auto',
        defaultRequiresApproval: false,
      });

      return {
        canPlan: true,
        actionFamily,
        actions: [
          {
            actionType: 'notify_user',
            title: `已创建关联操作: ${genericPlan.title}`,
            description: `规则 ${input.ruleRef} 命中后，会为 ${genericPlan.targetSystem} 排入 1 个关联操作。`,
            executionMode: 'auto',
            requiresApproval: false,
          },
          {
            actionType: 'delegate_openclaw',
            title: genericPlan.title,
            description: genericPlan.description,
            targetSystem: genericPlan.targetSystem,
            executionMode: policy.executionMode,
            requiresApproval: policy.requiresApproval,
          },
        ],
        warnings,
        suggestedPrompt: review.suggestedPrompt,
        suggestionReason: review.suggestionReason,
      };
    }

    const leaveWindow = parseLeaveWindow(
      input.message,
      input.automationPrompt,
      anchorTime,
    );
    if (!leaveWindow) {
      return {
        canPlan: false,
        skippedReason: 'unsupported_or_unparseable_automation_prompt',
        actionFamily,
        actions: [],
        warnings: [
          ...warnings,
          {
            code: 'unparseable_leave_window',
            severity: 'critical',
            message:
              '规则看起来是请假/PTO 状态联动，但当前样例消息里没有可解析的开始和结束时间。',
          },
        ],
        suggestedPrompt: review.suggestedPrompt,
        suggestionReason: review.suggestionReason,
      };
    }

    const currentTimeMs = now() * 1000;
    const idealStartActionAt = leaveWindow.startAt - 3 * 60 * 60 * 1000;
    const startActionAt = Math.max(currentTimeMs, idealStartActionAt);
    const restoreActionAt = leaveWindow.hasExplicitEndTime
      ? leaveWindow.endAt
      : leaveWindow.endAt + 60 * 1000;
    const scheduledStartAt = Math.floor(startActionAt / 1000);
    const scheduledRestoreAt = Math.floor(restoreActionAt / 1000);
    const policy = resolveDelegateOpenClawPolicy({
      params: { mode: 'write' },
      requestedRequiresApproval: input.requiresApproval,
      defaultExecutionMode: 'auto',
      defaultRequiresApproval: false,
    });

    if (idealStartActionAt <= currentTimeMs) {
      warnings.push({
        code: 'start_action_due_immediately',
        severity: 'info',
        message:
          '请假开始前 3 小时的执行点已经过去，实际入队后会按当前时间排入，下一次 due action 扫描会立即触发。',
      });
    }

    return {
      canPlan: true,
      actionFamily,
      actions: [
        {
          actionType: 'notify_user',
          title: `已解析请假时间并创建后续动作: ${leaveWindow.label}`,
          description: `规则 ${input.ruleRef} 会从消息中抽取请假时间，并排入 2 个后续状态动作。`,
          executionMode: 'auto',
          requiresApproval: false,
        },
        {
          actionType: 'delegate_openclaw',
          title: '请假开始前 3h 设置 Glip 状态',
          description: `设置状态为 PTO on ${leaveWindow.label}`,
          targetSystem: 'glip',
          scheduledAt: scheduledStartAt,
          executionMode: policy.executionMode,
          requiresApproval: policy.requiresApproval,
        },
        {
          actionType: 'delegate_openclaw',
          title: '请假结束后恢复 Glip 状态',
          description: '按开始动作保存的状态快照恢复',
          targetSystem: 'glip',
          scheduledAt: scheduledRestoreAt,
          executionMode: policy.executionMode,
          requiresApproval: policy.requiresApproval,
        },
      ],
      warnings,
      suggestedPrompt: review.suggestedPrompt,
      suggestionReason: review.suggestionReason,
      detectedWindow: {
        startAt: leaveWindow.startAt,
        endAt: leaveWindow.endAt,
        startActionAt,
        restoreActionAt,
        label: leaveWindow.label,
      },
    };
  }

  planAndQueue(
    input: MessageRuleAutomationPlanInput,
  ): MessageRuleAutomationPlanResult {
    const hitRef = buildHitRef(input);
    const existing = this.actionRepo
      .list({
        sourceKind: 'message_rule',
        sourceRefId: input.ruleRef,
        limit: 100,
      })
      .items.filter((item) => String(item.params?.hitRef ?? '') === hitRef);
    if (existing.length > 0) {
      const existingWindow = existing.find(
        (item) => typeof item.params?.restoreActionAt === 'number',
      );
      const existingParams = existingWindow?.params as
        | Record<string, unknown>
        | undefined;
      return {
        deduped: true,
        actions: existing,
        detectedWindow:
          existingWindow &&
          existingParams &&
          typeof existingParams.startAt === 'number' &&
          typeof existingParams.endAt === 'number' &&
          typeof existingParams.startActionAt === 'number' &&
          typeof existingParams.restoreActionAt === 'number' &&
          typeof existingParams.leaveLabel === 'string'
            ? {
                startAt: existingParams.startAt,
                endAt: existingParams.endAt,
                startActionAt: existingParams.startActionAt,
                restoreActionAt: existingParams.restoreActionAt,
                label: existingParams.leaveLabel,
              }
            : undefined,
      };
    }

    const anchorTime = input.message.timestamp ?? Date.now();
    const actionFamily = detectAutomationActionFamily(input.automationPrompt);
    const leaveWindow = parseLeaveWindow(
      input.message,
      input.automationPrompt,
      anchorTime,
    );
    if (actionFamily === 'leave_glip_status' && !leaveWindow) {
      return {
        deduped: false,
        skippedReason: 'unsupported_or_unparseable_automation_prompt',
        actions: [],
      };
    }

    if (actionFamily !== 'leave_glip_status') {
      const genericPlan = buildGenericActionPlan(input);
      if (!genericPlan) {
        return {
          deduped: false,
          skippedReason: 'unsupported_or_unparseable_automation_prompt',
          actions: [],
        };
      }

      const evidenceRefs = [
        `message_rule:${input.ruleRef}`,
        input.message.postId ? `glip_post:${input.message.postId}` : null,
      ].filter((value): value is string => Boolean(value));
      const commonMetadata = {
        ruleRef: input.ruleRef,
        ruleText: input.ruleText || '',
        requiresApproval: input.requiresApproval === true,
        hitRef,
        automationPrompt: input.automationPrompt,
        actionFamily: genericPlan.family,
        matchedRule: input.match?.matchedRule || '',
        messageSummary: input.match?.summary || '',
        messageSender: input.message.sender || '',
        messageGroupName: input.message.groupName || '',
        messageGroupId: input.message.groupId || '',
        messagePostId: input.message.postId || '',
        messageTimestamp: input.message.timestamp ?? null,
        sourceMessage: input.message.content,
      };

      const actions = [
        this.actionRepo.create({
          actionType: 'notify_user',
          title: `已创建关联操作: ${genericPlan.title}`,
          description: `规则 ${input.ruleRef} 命中后，已为 ${genericPlan.targetSystem} 排入 1 个关联操作。`,
          params: {
            title: `记忆规则已创建关联操作: ${genericPlan.title}`,
            body: `命中规则 ${input.ruleRef}，已将关联操作加入执行队列。`,
            payload: commonMetadata,
            hitRef,
          },
          requiresApproval: false,
          executionMode: 'auto',
          queueStatus: 'queued',
          priority: 6,
          confidence: input.match?.confidence ?? 0.8,
          sourceKind: 'message_rule',
          sourceRefId: input.ruleRef,
          evidenceRefs,
          idempotencyKey: `${input.ruleRef}:${hitRef}:notify`,
        }),
        this.actionRepo.create({
          actionType: 'delegate_openclaw',
          title: genericPlan.title,
          description: genericPlan.description,
          params: {
            mode: 'write',
            targetSystem: genericPlan.targetSystem,
            hitRef,
            task: genericPlan.task,
            metadata: commonMetadata,
          },
          ...resolveDelegateOpenClawPolicy({
            params: { mode: 'write' },
            requestedRequiresApproval: input.requiresApproval,
            defaultExecutionMode: 'auto',
            defaultRequiresApproval: false,
          }),
          queueStatus: 'queued',
          priority: 8,
          confidence: input.match?.confidence ?? 0.8,
          sourceKind: 'message_rule',
          sourceRefId: input.ruleRef,
          evidenceRefs,
          idempotencyKey: `${input.ruleRef}:${hitRef}:delegate`,
        }),
      ];

      return {
        deduped: false,
        actions,
      };
    }

    if (!leaveWindow) {
      return {
        deduped: false,
        skippedReason: 'unsupported_or_unparseable_automation_prompt',
        actions: [],
      };
    }

    const parsedLeaveWindow = leaveWindow;

    const currentTimeSeconds = now();
    const currentTimeMs = currentTimeSeconds * 1000;
    const startActionAt = Math.max(
      currentTimeMs,
      parsedLeaveWindow.startAt - 3 * 60 * 60 * 1000,
    );
    const restoreActionAt = parsedLeaveWindow.hasExplicitEndTime
      ? parsedLeaveWindow.endAt
      : parsedLeaveWindow.endAt + 60 * 1000;
    const scheduledStartAt = Math.floor(startActionAt / 1000);
    const scheduledRestoreAt = Math.floor(restoreActionAt / 1000);
    const evidenceRefs = [
      `message_rule:${input.ruleRef}`,
      input.message.postId ? `glip_post:${input.message.postId}` : null,
    ].filter((value): value is string => Boolean(value));

    const commonMetadata = {
      ruleRef: input.ruleRef,
      ruleText: input.ruleText || '',
      requiresApproval: input.requiresApproval === true,
      hitRef,
      automationPrompt: input.automationPrompt,
      matchedRule: input.match?.matchedRule || '',
      messageSummary: input.match?.summary || '',
      messageSender: input.message.sender || '',
      messageGroupName: input.message.groupName || '',
      messageGroupId: input.message.groupId || '',
      messagePostId: input.message.postId || '',
      messageTimestamp: input.message.timestamp ?? null,
      messageTimezone: input.message.timezone || '',
      messageEvent: input.message.event || null,
      sourceMessage: input.message.content,
      startAt: parsedLeaveWindow.startAt,
      endAt: parsedLeaveWindow.endAt,
      startActionAt,
      restoreActionAt,
      leaveLabel: parsedLeaveWindow.label,
      restoreStrategy: 'presence_snapshot',
      presenceSnapshotKey: `message_rule_presence:${input.ruleRef}:${hitRef}`,
    };

    const actions = [
      this.actionRepo.create({
        actionType: 'notify_user',
        title: `已解析请假时间并创建后续动作: ${parsedLeaveWindow.label}`,
        description: `规则 ${input.ruleRef} 已从消息中抽取请假时间，后续会在开始前和结束后执行状态动作。`,
        params: {
          title: `记忆规则已创建动作: ${parsedLeaveWindow.label}`,
          body: `命中规则 ${input.ruleRef}，已解析请假时间 ${parsedLeaveWindow.label}，并排入 2 个后续动作。`,
          payload: commonMetadata,
          hitRef,
        },
        requiresApproval: false,
        executionMode: 'auto',
        queueStatus: 'queued',
        priority: 6,
        confidence: input.match?.confidence ?? 0.8,
        sourceKind: 'message_rule',
        sourceRefId: input.ruleRef,
        evidenceRefs,
        idempotencyKey: `${input.ruleRef}:${hitRef}:notify`,
      }),
      this.actionRepo.create({
        actionType: 'delegate_openclaw',
        title: `请假开始前 3h 设置 Glip 状态`,
        description: `先读取并保存当前 Glip 状态，再将状态改为 "PTO on ${parsedLeaveWindow.label}"。`,
        params: {
          mode: 'write',
          targetSystem: 'glip',
          hitRef,
          leaveLabel: parsedLeaveWindow.label,
          startAt: parsedLeaveWindow.startAt,
          endAt: parsedLeaveWindow.endAt,
          startActionAt,
          restoreActionAt,
          task: [
            `You are executing a memory-entry automation hit for rule ${input.ruleRef}.`,
            `The user-defined linked action instruction is: ${input.automationPrompt}`,
            `The matched message content is: ${input.message.content}`,
            `Before making any status write, use the available RingCentral token/API access to read the current Glip/RingCentral presence and status text for the target user, then persist a durable snapshot using key ${commonMetadata.presenceSnapshotKey}.`,
            `At or after ${new Date(startActionAt).toISOString()}, update the Glip status to: PTO on ${parsedLeaveWindow.label}`,
            'If you cannot read and persist the pre-change presence snapshot, do not guess the original status. Return a human-decision response instead.',
          ].join('\n'),
          metadata: commonMetadata,
        },
        ...resolveDelegateOpenClawPolicy({
          params: { mode: 'write' },
          requestedRequiresApproval: input.requiresApproval,
          defaultExecutionMode: 'auto',
          defaultRequiresApproval: false,
        }),
        queueStatus: 'queued',
        priority: 8,
        confidence: input.match?.confidence ?? 0.8,
        sourceKind: 'message_rule',
        sourceRefId: input.ruleRef,
        evidenceRefs,
        scheduledAt: scheduledStartAt,
        idempotencyKey: `${input.ruleRef}:${hitRef}:start`,
      }),
      this.actionRepo.create({
        actionType: 'delegate_openclaw',
        title: `请假结束后恢复 Glip 状态`,
        description: '读取开始动作保存的状态快照，并恢复为原本的 Glip 状态。',
        params: {
          mode: 'write',
          targetSystem: 'glip',
          hitRef,
          leaveLabel: parsedLeaveWindow.label,
          startAt: parsedLeaveWindow.startAt,
          endAt: parsedLeaveWindow.endAt,
          startActionAt,
          restoreActionAt,
          task: [
            `You are executing a memory-entry automation hit for rule ${input.ruleRef}.`,
            `The user-defined linked action instruction is: ${input.automationPrompt}`,
            `The matched message content is: ${input.message.content}`,
            `At or after ${new Date(restoreActionAt).toISOString()}, load the previously stored presence snapshot using key ${commonMetadata.presenceSnapshotKey} and restore that exact Glip/RingCentral presence and status text.`,
            'Do not default to Available unless the stored snapshot explicitly says the original status was Available.',
          ].join('\n'),
          metadata: commonMetadata,
        },
        ...resolveDelegateOpenClawPolicy({
          params: { mode: 'write' },
          requestedRequiresApproval: input.requiresApproval,
          defaultExecutionMode: 'auto',
          defaultRequiresApproval: false,
        }),
        queueStatus: 'queued',
        priority: 8,
        confidence: input.match?.confidence ?? 0.8,
        sourceKind: 'message_rule',
        sourceRefId: input.ruleRef,
        evidenceRefs,
        scheduledAt: scheduledRestoreAt,
        idempotencyKey: `${input.ruleRef}:${hitRef}:restore`,
      }),
    ];

    return {
      deduped: false,
      actions,
      detectedWindow: {
        startAt: parsedLeaveWindow.startAt,
        endAt: parsedLeaveWindow.endAt,
        startActionAt,
        restoreActionAt,
        label: parsedLeaveWindow.label,
      },
    };
  }
}
