import type { DelegationOutcome } from '../integrations/OpenClawDelegationService.js';
import type { QueuedActionRecord } from '../repositories/ActionRepository.js';
import { detectAutomationActionFamily } from './actions/detectAutomationActionFamily.js';

export type MessageRuleAutomationWarningSeverity =
  | 'info'
  | 'warning'
  | 'critical';

export interface MessageRuleAutomationWarning {
  code: string;
  severity: MessageRuleAutomationWarningSeverity;
  message: string;
}

export interface MessageRulePromptReview {
  warnings: MessageRuleAutomationWarning[];
  suggestedPrompt?: string;
  suggestionReason?: string;
}

export interface MessageRuleImprovementContext {
  schema: 'message_rule_improvement.v1';
  ruleRef: string;
  ruleText?: string;
  currentPrompt: string;
  proposedPrompt: string;
  reason: string;
  summary: string;
  sourceActionId?: string;
  sourceActionTitle?: string;
  sourceMessage?: string;
  outcomeStatus?: string;
  outcomeSummary?: string;
  targetSystem?: string;
  createdAt: number;
}

function normalizeText(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function appendSentenceIfMissing(prompt: string, sentence: string): string {
  const normalizedPrompt = normalizeText(prompt);
  const normalizedSentence = normalizeText(sentence);
  if (!normalizedSentence) return normalizedPrompt;
  if (normalizedPrompt.includes(normalizedSentence)) return normalizedPrompt;
  const separator = /[。.!?]$/.test(normalizedPrompt) ? ' ' : '。';
  return `${normalizedPrompt}${separator}${normalizedSentence}`;
}

function includesAny(value: string, patterns: RegExp[]): boolean {
  return patterns.some((pattern) => pattern.test(value));
}

function hasPresenceSnapshotInstruction(prompt: string): boolean {
  return includesAny(prompt, [
    /presence\s+snapshot/i,
    /read\s+(?:current|original|previous).*(?:presence|status)/i,
    /读取.*(?:当前|原始|原本|之前).*(?:presence|状态|status|文案|快照)/iu,
    /保存.*(?:当前|原始|原本|之前).*(?:presence|状态|status|文案|快照)/iu,
    /快照.*(?:恢复|回滚|还原)/u,
  ]);
}

function hasFailureFallbackInstruction(prompt: string): boolean {
  return includesAny(prompt, [
    /human[-\s]?decision/i,
    /need_human_decision/i,
    /do\s+not\s+guess/i,
    /(?:无法|不能|失败|缺少|不确定).*(?:人工|确认|决策中心|停止|不要猜|不要默认)/u,
  ]);
}

function mentionsPresenceRestore(prompt: string): boolean {
  return includesAny(prompt, [
    /(?:恢复|改回|还原|回滚).*(?:原本|原始|之前|原来|available|状态|status|presence)/iu,
    /restore.*(?:original|previous|available|presence|status)/i,
  ]);
}

function mentionsAvailableRestore(prompt: string): boolean {
  return includesAny(prompt, [
    /(?:恢复|改回|还原|回滚).*available/iu,
    /available.*(?:恢复|改回|还原|回滚)/iu,
    /restore.*available/i,
  ]);
}

function rewriteHardcodedAvailableRestore(prompt: string): string {
  return normalizeText(prompt)
    .replace(
      /((?:结束后|恢复时|请假结束后|PTO\s*结束后)?\s*)(?:改回|恢复|还原|回滚)\s*Available/giu,
      '$1按写入前保存的原始状态快照恢复',
    )
    .replace(
      /restore\s+(?:the\s+)?(?:status\s+)?(?:to\s+)?Available/giu,
      'restore the exact presence/status snapshot saved before the write',
    );
}

function mentionsGlipOrPresence(prompt: string, targetSystem?: string): boolean {
  const family = detectAutomationActionFamily(prompt);
  return (
    family === 'leave_glip_status' ||
    family === 'glip_status' ||
    targetSystem?.toLowerCase() === 'glip' ||
    includesAny(prompt, [/glip/i, /ringcentral/i, /presence/i, /状态/u])
  );
}

export function reviewMessageRuleAutomationPrompt(input: {
  automationPrompt: string;
  targetSystem?: string;
  actionFamily?: string;
  outcomeSummary?: string;
}): MessageRulePromptReview {
  const prompt = normalizeText(input.automationPrompt);
  if (!prompt) {
    return { warnings: [] };
  }

  const warnings: MessageRuleAutomationWarning[] = [];
  let proposedPrompt = prompt;
  const suggestionReasons: string[] = [];
  const isGlipPresenceAction =
    input.actionFamily === 'leave_glip_status' ||
    input.actionFamily === 'glip_status' ||
    mentionsGlipOrPresence(prompt, input.targetSystem);
  const needsRestoreSnapshot =
    isGlipPresenceAction &&
    mentionsPresenceRestore(prompt) &&
    !hasPresenceSnapshotInstruction(prompt);

  if (needsRestoreSnapshot) {
    warnings.push({
      code: 'missing_presence_snapshot',
      severity: 'critical',
      message:
        '规则要求恢复原始状态，但没有说明写入前要读取并保存当前 presence/status 快照。',
    });
    proposedPrompt = appendSentenceIfMissing(
      proposedPrompt,
      '执行写入前先使用 RingCentral token/API 读取并保存当前 Glip/RingCentral presence/status 快照；恢复时必须按保存的快照回滚，不要猜测 Available。',
    );
    suggestionReasons.push('补充 presence/status 快照读取与恢复策略');
  }

  if (isGlipPresenceAction && mentionsAvailableRestore(prompt)) {
    warnings.push({
      code: 'hardcoded_available_restore',
      severity: 'warning',
      message:
        '规则把恢复目标写死为 Available，可能覆盖用户原本的状态文案。',
    });
    proposedPrompt = appendSentenceIfMissing(
      rewriteHardcodedAvailableRestore(proposedPrompt),
      '恢复动作不要默认写 Available，除非快照明确显示原始状态就是 Available。',
    );
    suggestionReasons.push('避免把恢复状态写死为 Available');
  }

  if (isGlipPresenceAction && !hasFailureFallbackInstruction(prompt)) {
    warnings.push({
      code: 'missing_failure_fallback',
      severity: 'warning',
      message:
        '规则没有说明外部能力、授权或关键字段缺失时如何处理，自动执行时容易静默失败或误写。',
    });
    proposedPrompt = appendSentenceIfMissing(
      proposedPrompt,
      '如果缺少外部能力、授权、原始状态快照或关键时间字段，停止外部写入并进入决策中心请我确认。',
    );
    suggestionReasons.push('补充缺能力或缺关键信息时的安全降级');
  }

  if (
    input.outcomeSummary &&
    isGlipPresenceAction &&
    /(?:原始状态|原本状态|presence|Glip|状态|Available)/i.test(
      input.outcomeSummary,
    ) &&
    !hasPresenceSnapshotInstruction(prompt)
  ) {
    warnings.push({
      code: 'runtime_needs_presence_snapshot',
      severity: 'critical',
      message:
        '最近一次 OpenClaw 运行结果显示需要原始状态信息，当前规则文案没有提供可执行的快照策略。',
    });
    proposedPrompt = appendSentenceIfMissing(
      proposedPrompt,
      'OpenClaw 执行结果需要原始状态时，必须先读取并持久化 presence/status 快照，再继续后续写入。',
    );
    suggestionReasons.push('根据运行结果补充原始状态快照要求');
  }

  return {
    warnings,
    ...(proposedPrompt !== prompt
      ? {
          suggestedPrompt: proposedPrompt,
          suggestionReason: suggestionReasons.join('；'),
        }
      : {}),
  };
}

export function buildMessageRuleImprovementContextFromDelegationOutcome(
  action: QueuedActionRecord,
  outcome: DelegationOutcome,
): MessageRuleImprovementContext | null {
  const metadata =
    action.params.metadata &&
    typeof action.params.metadata === 'object' &&
    !Array.isArray(action.params.metadata)
      ? (action.params.metadata as Record<string, unknown>)
      : {};
  const ruleRef =
    typeof metadata.ruleRef === 'string' && metadata.ruleRef.trim()
      ? metadata.ruleRef.trim()
      : action.sourceKind === 'message_rule' && action.sourceRefId
        ? action.sourceRefId
        : undefined;
  const currentPrompt =
    typeof metadata.automationPrompt === 'string'
      ? normalizeText(metadata.automationPrompt)
      : '';

  if (!ruleRef || !currentPrompt) {
    return null;
  }

  const params = action.params;
  const review = reviewMessageRuleAutomationPrompt({
    automationPrompt: currentPrompt,
    targetSystem:
      typeof params.targetSystem === 'string' ? params.targetSystem : undefined,
    actionFamily:
      typeof metadata.actionFamily === 'string'
        ? metadata.actionFamily
        : undefined,
    outcomeSummary: outcome.summary,
  });

  let proposedPrompt = review.suggestedPrompt;
  let reason = review.suggestionReason;
  if (!proposedPrompt) {
    proposedPrompt = appendSentenceIfMissing(
      currentPrompt,
      '如果 OpenClaw 返回缺少能力、鉴权失败或需要人工判断，停止外部写入并进入决策中心，请我确认下一步或补充配置。',
    );
    reason = '根据最近一次 OpenClaw 运行失败补充安全降级策略';
  }

  if (proposedPrompt === currentPrompt) {
    return null;
  }

  return {
    schema: 'message_rule_improvement.v1',
    ruleRef,
    ruleText:
      typeof metadata.ruleText === 'string' ? metadata.ruleText : undefined,
    currentPrompt,
    proposedPrompt,
    reason: reason || '根据 OpenClaw 执行结果建议改进联动操作文案',
    summary: `OpenClaw 执行「${action.title}」返回 ${outcome.status}: ${outcome.summary}`,
    sourceActionId: action.id,
    sourceActionTitle: action.title,
    sourceMessage:
      typeof metadata.sourceMessage === 'string'
        ? metadata.sourceMessage
        : undefined,
    outcomeStatus: outcome.status,
    outcomeSummary: outcome.summary,
    targetSystem:
      typeof params.targetSystem === 'string' ? params.targetSystem : undefined,
    createdAt: Date.now(),
  };
}
