import { randomUUID } from 'node:crypto';
import type Database from 'better-sqlite3';

import { runWithUsageContext } from '../analytics/usageContext.js';
import {
  extractAgentResultJson,
  extractSummaryFromMixedText,
} from '../integrations/executors/agentResultEnvelope.js';
import { RingCentralClient } from '../integrations/RingCentralClient.js';
import { composeNoticeMarkdown } from '../utils/botSender.js';
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
  const lines = isEmptyResultOutcome(input.result) ? [] : evidence.lines;
  if (input.template?.trim()) {
    return applyNotifyTemplateLocally(input.template, { ...evidence, summary, lines });
  }
  const announcement = [
    input.title,
    summary ? compactText(summary, 1200) : '',
    ...lines,
  ];
  return uniqueNonEmpty(announcement).join('\n');
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

  const text = composeNoticeMarkdown(input.title, input.body);
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
  // A 0-match run still ships diagnostic artifacts, and those keys must not be
  // listed as if they were results.
  const emptyOutcome = isEmptyResultOutcome(input.result);
  const structuredFallback = applyNotifyTemplateLocally(
    template,
    emptyOutcome ? { ...evidence, lines: [] } : evidence,
  );

  // Nothing to list means the LLM would only rewrite prose, and it then tends to
  // drop the separator and the closing cc line. Fill the template deterministically.
  if (emptyOutcome || evidence.lines.length === 0) {
    return structuredFallback;
  }

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
            '不要执行外部操作，不要编造未出现在证据里的标识 / 人名。',
            '严格按用户模板的结构输出（标题行、分隔线、列表项、结尾说明）。',
            '模板的标题行、分隔线（例如 ---- 这一行）和结尾说明行必须原样保留、顺序不变；结尾说明里的 @ 提醒也要保留，不要只留 cc 部分。',
            '中间只放真实条目，一行一条并保留模板的 * 前缀；不要把列表改写成整段散文。',
            templateRequestsLinks(template)
              ? [
                  '用户模板要求列表项带可点击链接（markdown `[text](url)`，或模板文字写了要带链接 / link）。',
                  '模板里的 xxx、Nova-xxx、http://xxx 只是占位示例：请替换成证据里的真实条目，并输出 markdown 链接，不要把标识写成纯文本。',
                  '证据里已有 URL 时必须用证据 URL；证据没有完整 URL 时，按模板给出的链接格式补全可点击地址，不要照抄 xxx 占位符。',
                ].join('')
              : '',
            '只输出最终通知正文，不要 JSON、不要 markdown 代码围栏、不要解释。',
            '',
            `任务标题: ${input.title}`,
            `任务内容: ${input.task}`,
            `用户通知模板:\n${template}`,
            `已整理的证据摘要:\n${evidence.summary || '(无)'}`,
            evidence.lines.length
              ? `已整理的列表项:\n${evidence.lines.join('\n')}`
              : '没有可列出的条目。',
            evidence.urls.length
              ? `证据中的 URL:\n${evidence.urls.join('\n')}`
              : '证据中没有现成 URL。',
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
  if (formatted) return enforceTemplateScaffolding(template, formatted);

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
  urls: string[];
}

function pushHttpUrl(value: unknown, urls: string[]): void {
  if (typeof value === 'string' && /^https?:\/\//i.test(value.trim())) {
    urls.push(value.trim());
  }
}

function collectArtifactUrls(record: Record<string, unknown>, urls: string[]): void {
  for (const key of ['url', 'href', 'link']) {
    pushHttpUrl(record[key], urls);
  }
  const metadata = asRecord(record.metadata);
  for (const key of ['url', 'href', 'link', 'browseUrl']) {
    pushHttpUrl(metadata[key], urls);
  }
  const content = typeof record.content === 'string' ? record.content : '';
  const title = typeof record.title === 'string' ? record.title : '';
  for (const text of [content, title]) {
    const matches = text.match(/https?:\/\/[^\s)\]>'"]+/gi);
    if (matches) urls.push(...matches);
  }
}

function evidenceLineFromArtifact(art: Record<string, unknown>): string | undefined {
  const metadata = asRecord(art.metadata);
  const title = typeof art.title === 'string' ? art.title.trim() : '';
  const entityKey =
    nonEmptyString(metadata.entityKey) ||
    (/^[A-Z][A-Z0-9]+-\d+$/.test(title) ? title : undefined);
  if (!entityKey) return undefined;
  const summary =
    (title && title !== entityKey ? title : '') ||
    nonEmptyString(metadata.summary) ||
    '';
  const assignee = nonEmptyString(metadata.assignee);
  const parts = [
    entityKey,
    summary,
    assignee ? `@${assignee.replace(/^@/, '')}` : '',
  ].filter(Boolean);
  return `* ${parts.join(' ')}`;
}

export function extractNotificationEvidence(
  result?: Record<string, unknown>,
): NotificationEvidence {
  if (!result) return { summary: '', lines: [], urls: [] };

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
  const urls: string[] = [];
  let summary = '';

  const collectFromEnvelope = (envelope: Record<string, unknown>) => {
    collectArtifactUrls(envelope, urls);
    if (typeof envelope.summary === 'string' && envelope.summary.trim()) {
      const next = envelope.summary.trim();
      if (!summary || next.length > summary.length) summary = next;
    }
    const innerArtifacts = Array.isArray(envelope.artifacts) ? envelope.artifacts : [];
    for (const inner of innerArtifacts) {
      collectArtifactUrls(asRecord(inner), urls);
      const art = asRecord(inner);
      const content = typeof art.content === 'string' ? art.content.trim() : '';
      if (looksLikeListContent(content)) {
        for (const line of content.split('\n')) {
          const trimmed = line.trim();
          if (trimmed) lines.push(normalizeEvidenceLine(trimmed));
        }
      } else {
        const structured = evidenceLineFromArtifact(art);
        if (structured) lines.push(structured);
      }
    }
  };

  for (const envelope of nestedEnvelopes) collectFromEnvelope(envelope);

  for (const artifact of artifacts) {
    collectArtifactUrls(asRecord(artifact), urls);
  }

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
      const structured = evidenceLineFromArtifact(art);
      if (structured) {
        lines.push(structured);
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
    urls: uniqueNonEmpty(urls),
  };
}

export function templateRequestsLinks(template: string): boolean {
  const text = template.trim();
  if (!text) return false;
  if (/\[[^\]]+\]\([^)]+\)/.test(text)) return true;
  return /链接|超链接|\blinks?\b/i.test(text);
}

/**
 * A scan/write task that legitimately matched nothing still owes the reader the
 * template shape: header, separator and the closing line (which usually carries
 * the cc mention). Only the list rows collapse into one explanation row.
 */
function emptyListRow(summary: string): string {
  const reason = summary.trim();
  return reason
    ? `本次没有符合条件的条目：${compactText(reason, 900)}`
    : '本次没有符合条件的条目。';
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
    : [emptyListRow(evidence.summary)];

  if (bulletIndexes.length === 0) {
    return uniqueNonEmpty([
      template.trim(),
      evidence.lines.length ? evidence.summary : '',
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

/**
 * The LLM keeps the wording but sometimes loses the template frame (separator
 * line, closing line with the cc mention). Re-anchor the frame from the template
 * and let the model own only the middle rows.
 */
export function enforceTemplateScaffolding(template: string, body: string): string {
  const templateLines = template.replace(/\r\n/g, '\n').split('\n');
  const firstPlaceholder = templateLines.findIndex(isTemplatePlaceholderLine);
  if (firstPlaceholder < 0) return body.trim();

  let lastPlaceholder = firstPlaceholder;
  while (
    lastPlaceholder + 1 < templateLines.length &&
    isTemplatePlaceholderLine(templateLines[lastPlaceholder + 1])
  ) {
    lastPlaceholder += 1;
  }

  const head = templateLines.slice(0, firstPlaceholder);
  const tail = templateLines.slice(lastPlaceholder + 1);
  const frame = [...head, ...tail];
  const middle = body
    .replace(/\r\n/g, '\n')
    .split('\n')
    .filter((line) => !isFrameEcho(line, frame));

  return [...head, ...middle, ...tail]
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function normalizeForCompare(line: string): string {
  return line.trim().replace(/\s+/g, ' ');
}

/**
 * True when the model line is the template frame said again, possibly truncated
 * or slightly extended, so the frame is not duplicated after re-anchoring.
 */
function isFrameEcho(line: string, frame: string[]): boolean {
  const value = normalizeForCompare(line);
  if (!value || /^\*\s/.test(value)) return false;
  return frame.some((candidate) => {
    const other = normalizeForCompare(candidate);
    if (!other) return false;
    if (other === value) return true;
    const [shorter, longer] = value.length <= other.length ? [value, other] : [other, value];
    return shorter.length >= 4 && longer.includes(shorter);
  });
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
  /** External effect boundary of the run; recorded when an empty result is skipped. */
  mode: 'read' | 'write';
  /** Undefined means the task never chose, so empty results stay silent. */
  notifyWhenEmpty?: boolean;
}

function readOptionalBoolean(...values: unknown[]): boolean | undefined {
  for (const value of values) {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'string') {
      const normalized = value.trim().toUpperCase();
      if (normalized === 'Y' || normalized === 'TRUE') return true;
      if (normalized === 'N' || normalized === 'FALSE') return false;
    }
  }
  return undefined;
}

/**
 * A run that matched nothing is noise in the target chat unless this task
 * opted in. Read and write share that default: stay quiet, keep the ledger.
 */
export function shouldNotifyEmptyResult(config: {
  mode?: 'read' | 'write';
  notifyWhenEmpty?: boolean;
}): boolean {
  void config.mode;
  return config.notifyWhenEmpty === true;
}

/** Payload counters that describe what the run actually did. */
const OUTCOME_COUNT_KEY =
  /(updated|created|changed|written|posted|filled|linked|transitioned|commented|resolved|deleted|applied|synced)/i;
/** Payload counters that only describe how wide the scan was. */
const SCAN_COUNT_KEY = /(matched|scanned|candidate|found|queried)/i;
/** Artifact operations that only appear once a real item was touched. */
const WRITE_OPERATIONS = new Set([
  'update',
  'create',
  'delete',
  'transition',
  'comment',
  'link',
  'assign',
  'move',
]);

interface CountSignal {
  positive: boolean;
  zero: boolean;
}

function readCountSignal(
  payload: Record<string, unknown>,
  keyPattern: RegExp,
): CountSignal {
  const signal: CountSignal = { positive: false, zero: false };
  for (const [key, value] of Object.entries(payload)) {
    if (!keyPattern.test(key)) continue;
    const count = Array.isArray(value)
      ? value.length
      : typeof value === 'number' && Number.isFinite(value)
        ? value
        : undefined;
    if (count === undefined) continue;
    if (count > 0) signal.positive = true;
    else signal.zero = true;
  }
  return signal;
}

/**
 * Executors report emptiness in several shapes, and they disagree on what
 * `matchCount` means: some count the JQL hits, others count the rows that
 * survived the task's own filter. So read the signals in precedence order —
 * what the run changed beats what it touched, which beats what it scanned —
 * and only fall back to counting listable evidence when nothing is declared.
 *
 * True when the run succeeded but produced nothing worth announcing.
 */
export function isEmptyResultOutcome(result?: Record<string, unknown>): boolean {
  if (!result) return true;

  const payload = asRecord(result.payload);
  const outcome = readCountSignal(payload, OUTCOME_COUNT_KEY);
  if (outcome.positive) return false;
  if (outcome.zero) return true;

  const artifacts = Array.isArray(result.artifacts) ? result.artifacts : [];
  const scan: CountSignal = { positive: false, zero: false };
  for (const artifact of artifacts) {
    const metadata = asRecord(asRecord(artifact).metadata);
    if (Array.isArray(metadata.changedFields) && metadata.changedFields.length) return false;
    const operation = nonEmptyString(metadata.operation);
    if (operation && WRITE_OPERATIONS.has(operation.toLowerCase())) return false;
    const matchCount = metadata.matchCount;
    if (typeof matchCount === 'number' && Number.isFinite(matchCount)) {
      if (matchCount > 0) scan.positive = true;
      else scan.zero = true;
    }
  }

  const payloadScan = readCountSignal(payload, SCAN_COUNT_KEY);
  if (scan.positive || payloadScan.positive) return false;
  if (scan.zero || payloadScan.zero) return true;

  return extractNotificationEvidence(result).lines.length === 0;
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
  const mode = params.mode === 'write' || metadata.mode === 'write' ? 'write' : 'read';
  const notifyWhenEmpty = readOptionalBoolean(
    metadata.notifyWhenEmpty,
    params.notifyWhenEmpty,
  );
  return {
    notify,
    successReceipt,
    notifyVia,
    notifyTarget,
    notifyTemplate,
    triggerSource,
    taskId,
    task,
    mode,
    notifyWhenEmpty,
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
}): Promise<{
  attempted: number;
  delivered: number;
  errors: string[];
  emptyResultSkipped?: boolean;
}> {
  const config = readLedgerNotifyConfig(input.action);
  const succeeded = input.execution.queueStatus === 'succeeded';
  const ownerUserId = input.userId || 'default';
  const resultTarget = resolveExplicitAgentTaskResultTarget(config.notifyTarget);
  const planned = planAgentTaskNotifications({
    succeeded,
    notify: config.notify,
    successReceipt: config.successReceipt,
    resultTarget,
    ownerUserId,
  });

  // A run that matched nothing can stay out of the target chat. The owner
  // receipt and the run ledger still record it, so nothing becomes invisible.
  const skipEmptyResult =
    succeeded &&
    isEmptyResultOutcome(input.execution.result) &&
    !shouldNotifyEmptyResult(config);
  const deliveries = skipEmptyResult
    ? planned.filter((delivery) => delivery.kind !== 'result')
    : planned;

  if (skipEmptyResult && planned.some((delivery) => delivery.kind === 'result')) {
    new ActionRepository(input.db).patchParamsMetadata(input.action.id, {
      notifyEmptyResultSkipped: {
        at: now(),
        mode: config.mode,
        reason: 'no listable item in result',
      },
    });
  }

  if (deliveries.length === 0) {
    return {
      attempted: 0,
      delivered: 0,
      errors: [],
      emptyResultSkipped: skipEmptyResult || undefined,
    };
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
        : delivery.kind === 'success_receipt'
          ? `帮我做完成: ${title}`
          : '';
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

  return {
    attempted: deliveries.length,
    delivered,
    errors,
    emptyResultSkipped: skipEmptyResult || undefined,
  };
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
