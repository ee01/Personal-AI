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
