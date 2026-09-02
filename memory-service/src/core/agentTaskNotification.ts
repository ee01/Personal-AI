import { randomUUID } from 'node:crypto';
import type Database from 'better-sqlite3';

import { runWithUsageContext } from '../analytics/usageContext.js';
import {
  extractAgentResultJson,
  extractSummaryFromMixedText,
} from '../integrations/executors/agentResultEnvelope.js';
import { RingCentralClient } from '../integrations/RingCentralClient.js';
import { getLLMClient, type LLMOptions, type LLMResponse } from '../llm/LLMClient.js';
import type { QueuedActionRecord } from '../repositories/ActionRepository.js';
import { ActionRepository } from '../repositories/ActionRepository.js';
import { ChannelDeliveryRepository } from '../repositories/ChannelDeliveryRepository.js';
import type { UserDataManager } from '../storage/UserDataManager.js';
import { now } from '../utils/time.js';
import { NotificationCenterService } from './NotificationCenterService.js';

function nonEmptyString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

export interface AgentTaskNotifyTarget {
  type?: 'private' | 'group';
  targetUserId?: string;
  targetGroupId?: string;
  glipUserName?: string;
  glipUser?: string;
  glipTeamId?: string;
}

export interface ResolvedAgentTaskNotificationTarget {
  type: 'private' | 'group' | 'default_bot_config';
  targetUserId?: string;
  targetGroupId?: string;
  defaulted: boolean;
}

function normalizeNotifyTargetUser(value: unknown): string | undefined {
  const raw = nonEmptyString(value);
  if (!raw) return undefined;

  const firstUser = raw.split(/[+,]/)[0]?.trim();
  if (!firstUser) return undefined;

  const localPart = firstUser.includes('@')
    ? firstUser.split('@')[0]?.trim()
    : firstUser;
  const normalized = localPart?.toLowerCase().replace(/\s+/g, '.');
  return normalized && /^[a-z0-9._-]+$/i.test(normalized) ? normalized : undefined;
}

export function normalizeAgentTaskNotifyTarget(
  value: unknown,
): AgentTaskNotifyTarget | undefined {
  if (!value || typeof value !== 'object') return undefined;

  const input = value as Record<string, unknown>;
  const groupId =
    nonEmptyString(input.targetGroupId) || nonEmptyString(input.glipTeamId);
  if ((input.type === 'group' || groupId) && groupId) {
    return {
      type: 'group',
      targetGroupId: groupId,
      glipTeamId: groupId,
    };
  }

  const targetUserId =
    normalizeNotifyTargetUser(input.targetUserId) ||
    normalizeNotifyTargetUser(input.glipUserName) ||
    normalizeNotifyTargetUser(input.glipUser);
  if (targetUserId) {
    return {
      type: 'private',
      targetUserId,
      glipUserName: nonEmptyString(input.glipUserName) || nonEmptyString(input.glipUser),
      glipUser: nonEmptyString(input.glipUser),
    };
  }

  return undefined;
}

export function resolveAgentTaskNotificationTarget(
  notifyTarget: AgentTaskNotifyTarget | undefined,
  userId: string,
): ResolvedAgentTaskNotificationTarget {
  if (notifyTarget?.type === 'group' && notifyTarget.targetGroupId) {
    return {
      type: 'group',
      targetGroupId: notifyTarget.targetGroupId,
      defaulted: false,
    };
  }

  if (notifyTarget?.type === 'private' && notifyTarget.targetUserId) {
    return {
      type: 'private',
      targetUserId: notifyTarget.targetUserId,
      defaulted: false,
    };
  }

  if (userId && userId !== 'default') {
    return {
      type: 'private',
      targetUserId: userId,
      defaulted: true,
    };
  }

  return {
    type: 'default_bot_config',
    defaulted: true,
  };
}

export function resolveExplicitAgentTaskResultTarget(
  notifyTarget: AgentTaskNotifyTarget | undefined,
): ResolvedAgentTaskNotificationTarget | undefined {
  if (!notifyTarget) return undefined;
  if (notifyTarget.type === 'group' && notifyTarget.targetGroupId) {
    return {
      type: 'group',
      targetGroupId: notifyTarget.targetGroupId,
      defaulted: false,
    };
  }
  if (notifyTarget.type === 'private' && notifyTarget.targetUserId) {
    return {
      type: 'private',
      targetUserId: notifyTarget.targetUserId,
      defaulted: false,
    };
  }
  return undefined;
}

function compactText(value: unknown, maxLength = 1600): string {
  const text = typeof value === 'string' ? value.trim() : '';
  if (!text) return '';
  return text.length <= maxLength ? text : `${text.slice(0, maxLength - 1).trim()}...`;
}

export function buildDefaultNotificationBody(input: {
  title: string;
  taskId: string;
  resultStatus: string;
  queueStatus: string;
  summary?: string;
  error?: string;
  actionId: string;
  triggerSource: string;
  arBindingId?: string;
}): string {
  const lines = [
    `任务: ${input.title}`,
    `状态: ${input.resultStatus || input.queueStatus}`,
    input.summary ? `结果: ${compactText(input.summary, 900)}` : '',
    input.error ? `错误: ${compactText(input.error, 900)}` : '',
    `Run: ${input.actionId}`,
    `触发: ${input.triggerSource}`,
    input.arBindingId ? `AR: ${input.arBindingId}` : '',
    '边界: Sheet 只记录计划和到期领取；原始执行结果、artifact 和错误以 memory-service run 账本为准。',
  ];
  return lines.filter(Boolean).join('\n');
}

export function buildAgentTaskResultAnnouncementBody(input: {
  title: string;
  summary?: string;
  result?: Record<string, unknown>;
  template?: string;
}): string {
  const evidence = extractNotificationEvidence(input.result);
  const summary = evidence.summary || input.summary || '';
  if (input.template?.trim() && evidence.lines.length > 0) {
    return applyNotifyTemplateLocally(input.template, evidence);
  }
  const lines = [
    input.title,
    summary ? compactText(summary, 1200) : '',
    ...evidence.lines,
  ];
  return uniqueNonEmpty(lines).join('\n');
}

export function getExecutionSummary(result?: Record<string, unknown>): string | undefined {
  const evidence = extractNotificationEvidence(result);
  if (evidence.summary) return evidence.summary;
  const summary = result?.summary;
  if (typeof summary !== 'string' || !summary.trim()) return undefined;
  const cleaned = extractSummaryFromMixedText(summary);
  return cleaned.trim() || undefined;
}

export function getResultStatus(result?: Record<string, unknown>, queueStatus?: string): string {
  const status = result?.status;
  if (typeof status === 'string' && status.trim()) {
    return status.trim();
  }
  return queueStatus || 'unknown';
}

export type AgentTaskNotificationKind =
  | 'result'
  | 'success_receipt'
  | 'failure_receipt';

export type AgentTaskNotifyVia = 'bot' | 'asme' | 'plugin';

export interface AgentTaskNotificationDelivery {
  kind: AgentTaskNotificationKind;
  targetUserId?: string;
  targetGroupId?: string;
  /** Template formatting only applies to success result notifications. */
  useTemplate: boolean;
}

export function normalizeAgentTaskNotifyVia(value: unknown): AgentTaskNotifyVia {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized === 'asme') return 'asme';
  if (normalized === 'plugin' || normalized === 'chrome') return 'plugin';
  return 'bot';
}

export function normalizeAsMeSenderCredentials(value: unknown): {
  clientId: string;
  clientSecret: string;
  jwt: string;
  serverUrl?: string;
} | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const input = value as Record<string, unknown>;
  const clientId = nonEmptyString(input.clientId);
  const clientSecret = nonEmptyString(input.clientSecret);
  const jwt = nonEmptyString(input.jwt);
  if (!clientId || !clientSecret || !jwt) return undefined;
  return {
    clientId,
    clientSecret,
    jwt,
    serverUrl: nonEmptyString(input.serverUrl),
  };
}

export function resolveAgentTaskDeliveryVia(
  kind: AgentTaskNotificationKind,
  notifyVia: AgentTaskNotifyVia,
): AgentTaskNotifyVia {
  if (notifyVia === 'plugin') return 'plugin';
  return kind === 'result' && notifyVia === 'asme' ? 'asme' : 'bot';
}

export interface AgentTaskAsMeRingClient {
  isConfigured(): boolean;
  resolveTarget(input: {
    targetType: string;
    targetRef: string;
    limit?: number;
  }): Promise<{
    status: 'unresolved' | 'ambiguous' | 'resolved';
    resolved?: {
      kind: 'user' | 'chat';
      entityId: string;
      chatId?: string;
    };
  }>;
  resolveDirectConversationChatId(userEntityId: string): Promise<string | null>;
  sendMessage(input: {
    targetType: string;
    targetRef: string;
    text: string;
    targetResolvedType?: string;
    targetResolvedId?: string;
    targetResolvedChatId?: string;
  }): Promise<{ chatId: string; postId: string }>;
}

export async function deliverAgentTaskAsMeNotice(input: {
  ringClient: AgentTaskAsMeRingClient;
  title: string;
  body: string;
  targetUserId?: string;
  targetGroupId?: string;
}): Promise<{ sent: boolean; error?: string; chatId?: string; postId?: string }> {
  if (!input.ringClient.isConfigured()) {
    return { sent: false, error: 'RingCentral not configured for AsMe notify' };
  }

  const text = `**${input.title}**\n\n${input.body}`;
  try {
    const targetGroupId = input.targetGroupId?.trim();
    if (targetGroupId) {
      const sent = await input.ringClient.sendMessage({
        targetType: 'group',
        targetRef: targetGroupId,
        text,
      });
      return { sent: true, chatId: sent.chatId, postId: sent.postId };
    }

    const targetUserId = input.targetUserId?.trim();
    if (!targetUserId) {
      return { sent: false, error: 'AsMe notify missing private target' };
    }

    const resolution = await input.ringClient.resolveTarget({
      targetType: 'private',
      targetRef: targetUserId,
      limit: 8,
    });
    if (resolution.status !== 'resolved' || !resolution.resolved) {
      return {
        sent: false,
        error: `AsMe notify target unresolved (${resolution.status}): ${targetUserId}`,
      };
    }

    let chatId = resolution.resolved.chatId;
    if (!chatId && resolution.resolved.kind === 'user' && resolution.resolved.entityId) {
      chatId =
        (await input.ringClient.resolveDirectConversationChatId(resolution.resolved.entityId)) ||
        undefined;
    }
    if (!chatId) {
      return { sent: false, error: `AsMe notify missing chat id for ${targetUserId}` };
    }

    const sent = await input.ringClient.sendMessage({
      targetType: 'private',
      targetRef: targetUserId,
      targetResolvedType: resolution.resolved.kind,
      targetResolvedId: resolution.resolved.entityId,
      targetResolvedChatId: chatId,
      text,
    });
    return { sent: true, chatId: sent.chatId, postId: sent.postId };
  } catch (error) {
    return {
      sent: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Plan Glip / plugin deliveries for an AgentTask (or Task Center push/agent) run.
 *
 * Matrix (when notify !== false):
 * - Failure: always a private failure receipt to owner (never to notifyTarget).
 * - Success + result target + successReceipt: result to target; owner receipt unless target is already owner private (dedupe).
 * - Success + result target + !successReceipt: result to target only.
 * - Success + no result target + successReceipt: owner private success receipt (default body, no template).
 * - Success + no result target + !successReceipt: silent.
 *
 * `notifyVia=asme` only changes the success **result** delivery identity.
 * Receipts always stay Bot (or plugin when the whole task asked for plugin).
 * AsMe failure does not fall back to Bot.
 *
 * `notify === false` suppresses all deliveries including failure.
 */
export function planAgentTaskNotifications(input: {
  succeeded: boolean;
  notify: boolean;
  successReceipt: boolean;
  resultTarget?: ResolvedAgentTaskNotificationTarget;
  ownerUserId: string;
}): AgentTaskNotificationDelivery[] {
  if (!input.notify) return [];

  const ownerUserId =
    input.ownerUserId && input.ownerUserId !== 'default'
      ? input.ownerUserId
      : undefined;
  const resultTarget =
    input.resultTarget && !input.resultTarget.defaulted
      ? input.resultTarget
      : undefined;

  if (!input.succeeded) {
    return [
      {
        kind: 'failure_receipt',
        targetUserId: ownerUserId,
        useTemplate: false,
      },
    ];
  }

  const deliveries: AgentTaskNotificationDelivery[] = [];
  if (resultTarget) {
    deliveries.push({
      kind: 'result',
      targetUserId:
        resultTarget.type === 'private' ? resultTarget.targetUserId : undefined,
      targetGroupId:
        resultTarget.type === 'group' ? resultTarget.targetGroupId : undefined,
      useTemplate: true,
    });
  }

  if (!input.successReceipt) {
    return deliveries;
  }

  const isOwnerPrivateResult =
    resultTarget?.type === 'private' &&
    Boolean(ownerUserId) &&
    resultTarget.targetUserId === ownerUserId;
  if (isOwnerPrivateResult) {
    return deliveries;
  }

  deliveries.push({
    kind: 'success_receipt',
    targetUserId: ownerUserId,
    useTemplate: false,
  });
  return deliveries;
}

interface FormatSuccessNotificationLogger {
  warn: (obj: Record<string, unknown>, msg: string) => void;
}

/**
 * Formats the group/private result notification with Memory Service's own LLM
 * (not the Agent executor). Push to Glip is also Memory Service. If the LLM
 * call fails, fall back to a local template fill from artifacts.
 */
export async function formatSuccessNotificationWithTemplate(input: {
  template: string;
  title: string;
  task: string;
  defaultBody: string;
  result?: Record<string, unknown>;
  userDataManager: UserDataManager | undefined;
  userId: string;
  taskId: string;
  actionId: string;
  log: FormatSuccessNotificationLogger;
  generate?: (prompt: string, options?: LLMOptions) => Promise<LLMResponse>;
}): Promise<string> {
  void input.userDataManager;
  const template = input.template.trim();
  if (!template) return input.defaultBody;

  const evidence = extractNotificationEvidence(input.result);
  const structuredFallback =
    evidence.lines.length > 0
      ? applyNotifyTemplateLocally(template, evidence)
      : input.defaultBody;

  let content: string;
  try {
    const generate =
      input.generate ?? ((prompt, options) => getLLMClient().generate(prompt, options));
    const response = await runWithUsageContext(
      {
        userId: input.userId,
        capability: 'scheduled_messages',
        feature: 'agent_task_notify_template',
        side: 'backend',
      },
      () =>
        generate(
          [
            '你只负责把 Agent task 执行结果整理成 Glip 通知正文。',
            '不要执行外部操作，不要编造未出现在证据里的 Jira key / URL / 人名。',
            '严格按用户模板的结构输出（标题行、分隔线、列表项、结尾说明）。',
            '只输出最终通知正文，不要 JSON、不要 markdown 代码围栏、不要解释。',
            '',
            `任务标题: ${input.title}`,
            `任务内容: ${input.task}`,
            `用户通知模板:\n${template}`,
            `已整理的证据摘要:\n${evidence.summary || '(无)'}`,
            evidence.lines.length
              ? `已整理的列表项:\n${evidence.lines.join('\n')}`
              : '没有可列出的条目。',
            `本地兜底文案:\n${structuredFallback}`,
          ].join('\n'),
          {
            scenario: 'drafting',
            maxTokens: 2000,
            timeoutMs: 45_000,
            systemPrompt:
              '你是 Personal AI 的通知文案整理器。只输出可直接发给用户的中文通知正文。',
          },
        ),
    );
    content = response.content || '';
  } catch (error) {
    input.log.warn(
      { err: error, taskId: input.taskId, actionId: input.actionId },
      'AgentTask notification template formatting threw; using structured fallback',
    );
    return structuredFallback;
  }

  const formatted = notificationBodyFromLlm(content);
  if (formatted) return formatted;

  input.log.warn(
    {
      taskId: input.taskId,
      actionId: input.actionId,
      hasLlmContent: Boolean(content.trim()),
    },
    'AgentTask notification template formatting did not return a usable body; using structured fallback',
  );
  return structuredFallback;
}

export interface NotificationEvidence {
  summary: string;
  lines: string[];
}

export function extractNotificationEvidence(
  result?: Record<string, unknown>,
): NotificationEvidence {
  if (!result) return { summary: '', lines: [] };

  const nestedEnvelopes: Record<string, unknown>[] = [];
  const rawSummary = typeof result.summary === 'string' ? result.summary : '';
  const fromSummary = extractAgentResultJson(rawSummary);
  if (fromSummary) nestedEnvelopes.push(fromSummary);

  const artifacts = Array.isArray(result.artifacts) ? result.artifacts : [];
  for (const artifact of artifacts) {
    const art = asRecord(artifact);
    const content = typeof art.content === 'string' ? art.content : '';
    const nested = extractAgentResultJson(content);
    if (nested) nestedEnvelopes.push(nested);
  }

  const lines: string[] = [];
  let summary = '';

  const collectFromEnvelope = (envelope: Record<string, unknown>) => {
    if (typeof envelope.summary === 'string' && envelope.summary.trim()) {
      const next = envelope.summary.trim();
      if (!summary || next.length > summary.length) summary = next;
    }
    const innerArtifacts = Array.isArray(envelope.artifacts) ? envelope.artifacts : [];
    for (const inner of innerArtifacts) {
      const art = asRecord(inner);
      const content = typeof art.content === 'string' ? art.content.trim() : '';
      if (looksLikeListContent(content)) {
        for (const line of content.split('\n')) {
          const trimmed = line.trim();
          if (trimmed) lines.push(normalizeEvidenceLine(trimmed));
        }
      }
    }
  };

  for (const envelope of nestedEnvelopes) collectFromEnvelope(envelope);

  if (!lines.length) {
    for (const artifact of artifacts) {
      const art = asRecord(artifact);
      const content = typeof art.content === 'string' ? art.content.trim() : '';
      if (looksLikeListContent(content) && !content.trimStart().startsWith('{')) {
        for (const line of content.split('\n')) {
          const trimmed = line.trim();
          if (trimmed) lines.push(normalizeEvidenceLine(trimmed));
        }
        continue;
      }
      const title = typeof art.title === 'string' ? art.title.trim() : '';
      if (/^[A-Z][A-Z0-9]+-\d+/.test(title) && !content.trimStart().startsWith('{')) {
        const suffix = content && !content.includes('{') ? ` ${compactText(content, 80)}` : '';
        lines.push(normalizeEvidenceLine(`* ${title}${suffix}`.trim()));
      }
    }
  }

  if (!summary && rawSummary.trim()) {
    summary = extractSummaryFromMixedText(rawSummary);
  }

  return {
    summary: summary.replace(/\{[\s\S]*$/, '').trim(),
    lines: uniqueNonEmpty(lines),
  };
}

export function applyNotifyTemplateLocally(
  template: string,
  evidence: NotificationEvidence,
): string {
  const templateLines = template.replace(/\r\n/g, '\n').split('\n');
  const bulletIndexes = templateLines
    .map((line, index) => (isTemplatePlaceholderLine(line) ? index : -1))
    .filter((index) => index >= 0);

  const replacement = evidence.lines.length
    ? evidence.lines.map((line) => (line.startsWith('*') ? line : `* ${line}`))
    : [];

  if (bulletIndexes.length === 0) {
    return uniqueNonEmpty([
      template.trim(),
      evidence.summary,
      ...replacement,
    ]).join('\n');
  }

  const start = bulletIndexes[0];
  let end = start;
  while (end + 1 < templateLines.length && isTemplatePlaceholderLine(templateLines[end + 1])) {
    end += 1;
  }
  while (end + 1 < templateLines.length && templateLines[end + 1].trim() === '') {
    if (end + 2 < templateLines.length && !isTemplatePlaceholderLine(templateLines[end + 2])) {
      break;
    }
    end += 1;
  }

  const next = [
    ...templateLines.slice(0, start),
    ...replacement,
    ...templateLines.slice(end + 1),
  ];
  return next.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

function isTemplatePlaceholderLine(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed) return false;
  if (trimmed === '*' || trimmed === '* ...' || trimmed === '...') return true;
  return trimmed.startsWith('*') && (/xxx/i.test(trimmed) || trimmed.includes('...'));
}

function looksLikeListContent(content: string): boolean {
  const trimmed = content.trim();
  if (!trimmed || trimmed.startsWith('{')) return false;
  return /^\*\s+\S+/m.test(trimmed) || /^[A-Z][A-Z0-9]+-\d+\b/m.test(trimmed);
}

function normalizeEvidenceLine(line: string): string {
  const trimmed = line.trim().replace(/^[-•]\s+/, '* ');
  if (trimmed.startsWith('*')) return trimmed;
  if (/^[A-Z][A-Z0-9]+-\d+/.test(trimmed)) return `* ${trimmed}`;
  return trimmed;
}

function uniqueNonEmpty(values: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    const trimmed = value.trim();
    if (!trimmed || seen.has(trimmed)) continue;
    seen.add(trimmed);
    result.push(trimmed);
  }
  return result;
}

function notificationBodyFromLlm(content: string): string | undefined {
  const trimmed = content.trim();
  if (!trimmed) return undefined;
  const fenced = trimmed.match(/```(?:[\w-]+)?\s*([\s\S]*?)```/);
  const candidate = (fenced ? fenced[1] : trimmed).trim();
  if (!candidate) return undefined;

  const envelope = extractAgentResultJson(candidate);
  if (envelope && typeof envelope.summary === 'string' && envelope.summary.trim()) {
    const summary = envelope.summary.trim();
    if (!/"artifacts"\s*:/.test(summary)) return summary;
  }
  if (/^\s*\{/.test(candidate) && /"status"\s*:/.test(candidate)) {
    return undefined;
  }
  if (/"artifacts"\s*:/.test(candidate) && /"status"\s*:/.test(candidate)) {
    return undefined;
  }
  return candidate;
}

function asRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

export interface LedgerNotifyConfig {
  notify: boolean;
  successReceipt: boolean;
  notifyVia: AgentTaskNotifyVia;
  notifyTarget?: AgentTaskNotifyTarget;
  notifyTemplate?: string;
  triggerSource: string;
  taskId: string;
  task: string;
}

/**
 * Read notify settings from either the HTTP AgentTask metadata shape or the
 * flatter Task Center payload. Missing fields default the same way the
 * `/agent-tasks/execute` route does (notify on, success receipt on, via bot).
 */
export function readLedgerNotifyConfig(action: QueuedActionRecord): LedgerNotifyConfig {
  const params = asRecord(action.params);
  const metadata = asRecord(params.metadata);
  const notify =
    metadata.suppressRecoveryNotifications !== true &&
    params.notify !== false &&
    metadata.notify !== false;
  const successReceipt =
    metadata.successReceipt !== false && params.successReceipt !== false;
  const viaRaw = metadata.notifyVia ?? params.notifyVia ?? params.channel;
  const notifyVia = normalizeAgentTaskNotifyVia(viaRaw);
  const notifyTarget = normalizeAgentTaskNotifyTarget(
    metadata.notifyTarget ?? params.notifyTarget,
  );
  const notifyTemplate =
    nonEmptyString(metadata.notifyTemplate) ?? nonEmptyString(params.notifyTemplate);
  const taskId =
    nonEmptyString(metadata.taskId) ||
    nonEmptyString(action.sourceRefId) ||
    action.id;
  const task =
    nonEmptyString(params.task) ||
    nonEmptyString(params.content) ||
    action.description ||
    action.title;
  const triggerSource =
    nonEmptyString(metadata.triggerSource) ||
    nonEmptyString(action.sourceKind) ||
    'task_center';
  return {
    notify,
    successReceipt,
    notifyVia,
    notifyTarget,
    notifyTemplate,
    triggerSource,
    taskId,
    task,
  };
}

/**
 * Home-lane push/agent tasks used to run through ActionExecutor and then stop.
 * Delivery lived only on the HTTP `/agent-tasks/execute` path, so locally
 * scheduled work produced a result nobody ever saw. This is that loop, callable
 * from both places.
 *
 * Notification failure never rewrites run status.
 */
export async function deliverAgentTaskRunNotifications(input: {
  db: Database.Database;
  userDataManager?: UserDataManager;
  userId: string;
  action: QueuedActionRecord;
  execution: {
    queueStatus: string;
    result?: Record<string, unknown>;
    error?: string;
  };
  asmeSender?: ReturnType<typeof normalizeAsMeSenderCredentials>;
  log?: FormatSuccessNotificationLogger;
}): Promise<{ attempted: number; delivered: number; errors: string[] }> {
  const config = readLedgerNotifyConfig(input.action);
  const succeeded = input.execution.queueStatus === 'succeeded';
  const ownerUserId = input.userId || 'default';
  const resultTarget = resolveExplicitAgentTaskResultTarget(config.notifyTarget);
  const deliveries = planAgentTaskNotifications({
    succeeded,
    notify: config.notify,
    successReceipt: config.successReceipt,
    resultTarget,
    ownerUserId,
  });
  if (deliveries.length === 0) {
    return { attempted: 0, delivered: 0, errors: [] };
  }

  const log = input.log ?? {
    warn: (obj, msg) => console.warn(msg, obj),
  };
  const title = input.action.title;
  const resultStatus = getResultStatus(input.execution.result, input.execution.queueStatus);
  const summary = getExecutionSummary(input.execution.result);
  const metadata = asRecord(asRecord(input.action.params).metadata);
  const defaultBody = buildDefaultNotificationBody({
    title,
    taskId: config.taskId,
    resultStatus,
    queueStatus: input.execution.queueStatus,
    summary,
    error: input.execution.error,
    actionId: input.action.id,
    triggerSource: config.triggerSource,
    arBindingId: nonEmptyString(metadata.arBindingId),
  });
  const resultAnnouncementBody = buildAgentTaskResultAnnouncementBody({
    title,
    summary,
    result: input.execution.result,
    template: succeeded ? config.notifyTemplate : undefined,
  });

  let templatedResultBody = resultAnnouncementBody;
  const needsTemplate =
    Boolean(config.notifyTemplate) &&
    succeeded &&
    deliveries.some((item) => item.useTemplate);
  if (needsTemplate && config.notifyTemplate) {
    templatedResultBody = await formatSuccessNotificationWithTemplate({
      template: config.notifyTemplate,
      title,
      task: config.task,
      defaultBody: resultAnnouncementBody,
      result: input.execution.result,
      userDataManager: input.userDataManager,
      userId: ownerUserId,
      taskId: config.taskId,
      actionId: input.action.id,
      log,
    });
  }

  const notificationService = new NotificationCenterService(input.db);
  const deliveryRepo = new ChannelDeliveryRepository(input.db);
  const errors: string[] = [];
  let delivered = 0;

  for (const [index, delivery] of deliveries.entries()) {
    const bodyText = delivery.kind === 'result' ? templatedResultBody : defaultBody;
    const noticeTitle =
      delivery.kind === 'failure_receipt'
        ? `帮我做失败: ${title}`
        : delivery.kind === 'result'
          ? `任务完成: ${title}`
          : `帮我做完成: ${title}`;
    const sourceRef = `agent_task:${input.action.id}:${delivery.kind}:${index}`;
    const deliveryVia = resolveAgentTaskDeliveryVia(delivery.kind, config.notifyVia);

    if (deliveryVia === 'plugin') {
      const pluginResult = writePluginNotice({
        db: input.db,
        actionId: input.action.id,
        title: noticeTitle,
        body: bodyText,
      });
      deliveryRepo.upsertEvents([
        {
          sourceRef,
          channel: 'chrome',
          lane: 'notice',
          status: pluginResult.sent ? 'delivered' : 'failed',
          error: pluginResult.error,
        },
      ]);
      if (pluginResult.sent) delivered += 1;
      else errors.push(pluginResult.error ?? 'plugin notify failed');
      continue;
    }

    if (deliveryVia === 'asme') {
      const ringClient = new RingCentralClient(
        input.userDataManager,
        input.db,
        ownerUserId,
        input.asmeSender,
      );
      const asmeResult = await deliverAgentTaskAsMeNotice({
        ringClient,
        title: noticeTitle,
        body: bodyText,
        targetUserId: delivery.targetUserId,
        targetGroupId: delivery.targetGroupId,
      });
      deliveryRepo.upsertEvents([
        {
          sourceRef,
          channel: 'glip',
          lane: 'notice',
          status: asmeResult.sent ? 'delivered' : 'failed',
          error: asmeResult.error,
        },
      ]);
      if (asmeResult.sent) {
        delivered += 1;
      } else {
        const err = asmeResult.error || 'AsMe notify failed';
        errors.push(err);
        log.warn(
          { err, actionId: input.action.id, kind: delivery.kind },
          'AgentTask AsMe result notify failed',
        );
      }
      continue;
    }

    const botResult = await notificationService.deliverNoticeToGlip({
      sourceRef,
      title: noticeTitle,
      body: bodyText,
      mention: true,
      targetUserId: delivery.targetUserId,
      targetGroupId: delivery.targetGroupId,
    });
    if (botResult.sent) {
      delivered += 1;
    } else {
      const err = botResult.error || 'Bot notify failed';
      errors.push(err);
      log.warn(
        {
          err,
          actionId: input.action.id,
          kind: delivery.kind,
          targetUserId: delivery.targetUserId,
          targetGroupId: delivery.targetGroupId,
        },
        'AgentTask Bot result notify failed',
      );
      const escalateOwner =
        delivery.kind === 'result' && ownerUserId && ownerUserId !== 'default';
      if (escalateOwner) {
        await notificationService.deliverNoticeToGlip({
          sourceRef: `agent_task:${input.action.id}:result_delivery_failed:${index}`,
          title: `帮我做通知投递失败: ${title}`,
          body: [
            '结果已产生，但推送到指定通知目标失败：',
            err,
            '',
            '任务本身的执行结果不受影响，仅通知投递失败。',
          ].join('\n'),
          mention: true,
          targetUserId: ownerUserId,
        });
      }
    }
  }

  if (errors.length > 0) {
    new ActionRepository(input.db).patchParamsMetadata(input.action.id, {
      notifyDeliveryError: errors.join('; '),
    });
  }

  return { attempted: deliveries.length, delivered, errors };
}

function writePluginNotice(input: {
  db: Database.Database;
  actionId: string;
  title: string;
  body: string;
}): { sent: boolean; error?: string } {
  try {
    const notificationId = randomUUID();
    const currentTime = now();
    input.db
      .prepare(
        `INSERT INTO notification_records
          (id, channel, type, title, body, payload_json, topic_id, related_entity_id, utility_score, sent_at, created_at)
         VALUES (?, 'task_center', ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        notificationId,
        'agent_task',
        input.title,
        input.body,
        JSON.stringify({ actionId: input.actionId }),
        input.actionId,
        null,
        null,
        currentTime,
        currentTime,
      );
    return { sent: true };
  } catch (error) {
    return {
      sent: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Ledger tasks that should fan out a result after the executor finishes.
 * Reflection-generated delegate_agent rows stay silent unless they opted in
 * via taskKind / sourceKind.
 */
export function shouldDeliverLedgerNotifications(action: QueuedActionRecord): boolean {
  if (action.actionType === 'notify_user' || action.actionType === 'ask_external_user') {
    return false;
  }
  const params = asRecord(action.params);
  const kind = action.taskKind || nonEmptyString(params.taskKind);
  if (kind === 'agent' || kind === 'push') return true;
  if (action.sourceKind === 'agent_task') return true;
  if (action.actionType === 'run_http_push') return true;
  return false;
}
