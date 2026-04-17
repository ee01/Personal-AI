import { createHash } from 'node:crypto';

import {
  ActionRepository,
  type QueuedActionRecord,
} from '../repositories/ActionRepository.js';
import { now } from '../utils/time.js';
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

function formatMonthDay(value: number): string {
  const date = new Date(value);
  return `${date.getMonth() + 1}/${date.getDate()}`;
}

function formatLeaveLabel(startAt: number, endAt: number): string {
  const start = formatMonthDay(startAt);
  const end = formatMonthDay(endAt);
  return start === end ? start : `${start}~${end}`;
}

function parseDateToken(
  raw: string,
  anchorTime: number,
  defaultToEndOfDay: boolean,
): ParsedDateToken | null {
  const normalized = normalizeWhitespace(raw);
  const anchorDate = new Date(anchorTime || Date.now());

  const slashMatch = normalized.match(
    /^(?:(\d{4})[\/.-])?(\d{1,2})[\/.-](\d{1,2})(?:\s+(\d{1,2})(?::(\d{2}))?)?$/,
  );
  if (slashMatch) {
    const year = slashMatch[1]
      ? parseInt(slashMatch[1], 10)
      : anchorDate.getFullYear();
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
    return {
      value: new Date(year, month - 1, day, hour, minute, 0, 0).getTime(),
      hasExplicitTime,
    };
  }

  const chineseMatch = normalized.match(
    /^(?:(\d{4})年)?(\d{1,2})月(\d{1,2})日(?:\s*(\d{1,2})(?::(\d{2}))?)?$/,
  );
  if (chineseMatch) {
    const year = chineseMatch[1]
      ? parseInt(chineseMatch[1], 10)
      : anchorDate.getFullYear();
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
    return {
      value: new Date(year, month - 1, day, hour, minute, 0, 0).getTime(),
      hasExplicitTime,
    };
  }

  return null;
}

function parseLeaveWindow(
  automationPrompt: string,
  messageContent: string,
  anchorTime: number,
): ParsedLeaveWindow | null {
  const normalizedMessage = normalizeWhitespace(messageContent);
  if (detectAutomationActionFamily(automationPrompt) !== 'leave_glip_status') {
    return null;
  }

  const rangePatterns = [
    /((?:\d{4}[\/.-])?\d{1,2}[\/.-]\d{1,2}(?:\s+\d{1,2}(?::\d{2})?)?)\s*(?:~|～|—|-|至|到)\s*((?:\d{4}[\/.-])?\d{1,2}[\/.-]\d{1,2}(?:\s+\d{1,2}(?::\d{2})?)?)/,
    /((?:\d{4}年)?\d{1,2}月\d{1,2}日(?:\s*\d{1,2}(?::\d{2})?)?)\s*(?:~|～|—|-|至|到)\s*((?:\d{4}年)?\d{1,2}月\d{1,2}日(?:\s*\d{1,2}(?::\d{2})?)?)/,
  ];

  for (const pattern of rangePatterns) {
    const matched = normalizedMessage.match(pattern);
    if (!matched) continue;
    const start = parseDateToken(matched[1], anchorTime, false);
    const end = parseDateToken(matched[2], anchorTime, true);
    if (!start || !end) continue;
    return {
      startAt: start.value,
      endAt: end.value,
      hasExplicitStartTime: start.hasExplicitTime,
      hasExplicitEndTime: end.hasExplicitTime,
      label: formatLeaveLabel(start.value, end.value),
    };
  }

  const singlePatterns = [
    /((?:\d{4}[\/.-])?\d{1,2}[\/.-]\d{1,2}(?:\s+\d{1,2}(?::\d{2})?)?)/,
    /((?:\d{4}年)?\d{1,2}月\d{1,2}日(?:\s*\d{1,2}(?::\d{2})?)?)/,
  ];
  for (const pattern of singlePatterns) {
    const matched = normalizedMessage.match(pattern);
    if (!matched) continue;
    const start = parseDateToken(matched[1], anchorTime, false);
    const end = parseDateToken(matched[1], anchorTime, true);
    if (!start || !end) continue;
    return {
      startAt: start.value,
      endAt: end.value,
      hasExplicitStartTime: start.hasExplicitTime,
      hasExplicitEndTime: end.hasExplicitTime,
      label: formatLeaveLabel(start.value, end.value),
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
      input.automationPrompt,
      input.message.content,
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
      sourceMessage: input.message.content,
      startAt: parsedLeaveWindow.startAt,
      endAt: parsedLeaveWindow.endAt,
      startActionAt,
      restoreActionAt,
      leaveLabel: parsedLeaveWindow.label,
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
        description: `将 Glip 状态改为 "PTO on ${parsedLeaveWindow.label}"。`,
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
            `The matched message content is: ${input.message.content}`,
            `At or after ${new Date(startActionAt).toISOString()}, update the Glip status to: PTO on ${parsedLeaveWindow.label}`,
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
        description: '将 Glip 状态恢复为 "Available"。',
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
            `The matched message content is: ${input.message.content}`,
            `At or after ${new Date(restoreActionAt).toISOString()}, restore the Glip status to: Available`,
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
