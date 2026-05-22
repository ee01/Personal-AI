export type RuleSafetyTone = 'ok' | 'warn' | 'danger';

export interface RuleSafetyInput {
  filterSender?: string;
  filterGroup?: string;
  notifyMethod?: string;
  digestEnabled?: boolean;
  automationPrompt?: string;
  automationRequiresApproval?: boolean;
}

export interface RuleSafetySummary {
  tone: RuleSafetyTone;
  label: string;
  reasons: string[];
}

export type RuleAutoReplyMode = 'immediate' | 'delayed' | 'manual';

export interface RuleActionSummaryInput {
  notifyMethod?: string;
  mentionMe?: boolean;
  digestEnabled?: boolean;
  digestFrequency?: 'daily' | 'weekly';
  autoReply?: boolean;
  autoReplyMode?: RuleAutoReplyMode;
  followThread?: boolean;
  automationPrompt?: string;
  automationRequiresApproval?: boolean;
}

const normalizeOptionalText = (value?: string): string => value?.trim() || '';

const hasNotifyMethod = (
  notifyMethod: string | undefined,
  method: string,
): boolean =>
  (notifyMethod || '')
    .split(',')
    .map((value) => value.trim())
    .includes(method);

const isShortScopeValue = (value?: string): boolean => {
  const normalized = normalizeOptionalText(value);
  if (!normalized) return false;
  const compact = normalized.replace(/[\s_-]+/g, '');
  if (/[\u3040-\u30ff\u3400-\u9fff\uf900-\ufaff\uac00-\ud7af]/.test(compact)) {
    return compact.length === 1;
  }
  return compact.length > 0 && compact.length <= 2;
};

export function getRuleActionSummaryItems(
  input: RuleActionSummaryInput,
): string[] {
  const items = ['写入记忆'];

  if (input.digestEnabled) {
    items.push(
      `${input.digestFrequency === 'weekly' ? '每周' : '每日'}摘要（不即时推送）`,
    );
  }
  if (!input.digestEnabled) {
    if (hasNotifyMethod(input.notifyMethod, 'bot')) {
      items.push('Glip 推送');
    }
    if (hasNotifyMethod(input.notifyMethod, 'chrome')) {
      items.push('Chrome 通知');
    }
    if (input.mentionMe && hasNotifyMethod(input.notifyMethod, 'bot')) {
      items.push('@我');
    }
  }
  if (input.autoReply) {
    const modeLabel =
      input.autoReplyMode === 'manual'
        ? '手动审核'
        : input.autoReplyMode === 'delayed'
          ? '延迟可拦截'
          : '直接发送';
    items.push(`自动答复：${modeLabel}`);
  }
  if (input.followThread) {
    items.push('关注后续');
  }
  if (normalizeOptionalText(input.automationPrompt)) {
    items.push(
      input.automationRequiresApproval
        ? '联动操作：需批准'
        : '联动操作：自动执行',
    );
  }

  return items;
}

export function getRuleSafetySummary(
  input: RuleSafetyInput,
): RuleSafetySummary {
  const hasSenderScope = Boolean(normalizeOptionalText(input.filterSender));
  const hasGroupScope = Boolean(normalizeOptionalText(input.filterGroup));
  const isGlobalScope = !hasSenderScope && !hasGroupScope;
  const hasShortScope =
    isShortScopeValue(input.filterSender) ||
    isShortScopeValue(input.filterGroup);
  const hasAutomation = Boolean(normalizeOptionalText(input.automationPrompt));
  const autoExecutesAutomation =
    hasAutomation && input.automationRequiresApproval !== true;
  const interruptsImmediately =
    !input.digestEnabled &&
    (hasNotifyMethod(input.notifyMethod, 'bot') ||
      hasNotifyMethod(input.notifyMethod, 'chrome'));

  const reasons: string[] = [];
  if (isGlobalScope) {
    reasons.push('所有群组/发送人生效');
  }
  if (hasShortScope) {
    reasons.push('范围词较短');
  }
  if (autoExecutesAutomation) {
    reasons.push('联动操作免批准');
  } else if (hasAutomation) {
    reasons.push('联动操作需批准');
  }
  if (interruptsImmediately) {
    reasons.push('即时通知');
  }

  if (isGlobalScope && autoExecutesAutomation) {
    return {
      tone: 'danger',
      label: '全局自动执行',
      reasons,
    };
  }

  if (isGlobalScope || hasShortScope || autoExecutesAutomation) {
    return {
      tone: 'warn',
      label: '需复核范围',
      reasons,
    };
  }

  return {
    tone: 'ok',
    label: hasAutomation ? '范围清晰' : '基础安全',
    reasons: reasons.length > 0 ? reasons : ['范围明确'],
  };
}
