export type RuleSafetyTone = 'ok' | 'warn' | 'danger';

export interface RuleSafetyInput {
  filterSender?: string;
  filterGroup?: string;
  notifyMethod?: string;
  digestEnabled?: boolean;
  followThread?: boolean;
  automationPrompt?: string;
  automationRequiresApproval?: boolean;
}

export interface RuleSafetySummary {
  tone: RuleSafetyTone;
  label: string;
  reasons: string[];
}

export type RuleDeliveryTone = 'silent' | 'digest' | 'notify' | 'followup';

export interface RuleDeliveryReceipt {
  tone: RuleDeliveryTone;
  label: string;
  detail: string;
}

export type RuleAutoReplyMode = 'immediate' | 'delayed' | 'manual';

export type RuleEffectBoundaryTone = 'quiet' | 'review' | 'active' | 'danger';

export interface RuleEffectBoundaryReceipt {
  tone: RuleEffectBoundaryTone;
  label: string;
  items: string[];
}

export type RuleScopeExecutionTone = RuleSafetyTone | 'inactive';

export interface RuleScopeExecutionReceipt {
  tone: RuleScopeExecutionTone;
  title: string;
  summary: string;
  filterText: string;
  finalCheckText: string;
  boundaryText: string;
}

export type RuleRunPreviewTone = 'ready' | 'paused' | 'review' | 'danger';

export interface RuleRunPreviewReceipt {
  tone: RuleRunPreviewTone;
  title: string;
  triggerText: string;
  matchText: string;
  outcomeText: string;
  boundaryText: string;
}

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
  openClawConfigured?: boolean;
}

const normalizeOptionalText = (value?: string): string => value?.trim() || '';

const splitScopeValues = (value?: string): string[] =>
  normalizeOptionalText(value)
    .split(/[\n,，、;；]+/)
    .map((part) => part.trim())
    .filter(Boolean);

const hasNotifyMethod = (
  notifyMethod: string | undefined,
  method: string,
): boolean =>
  (notifyMethod || '')
    .split(',')
    .map((value) => value.trim())
    .includes(method);

function getNotifyMethodLabels(input: RuleActionSummaryInput): string[] {
  const labels: string[] = [];
  if (hasNotifyMethod(input.notifyMethod, 'bot')) {
    labels.push(input.mentionMe ? 'Glip + @我' : 'Glip');
  }
  if (hasNotifyMethod(input.notifyMethod, 'chrome')) {
    labels.push('Chrome');
  }
  return labels;
}

const isShortScopeValue = (value?: string): boolean => {
  return splitScopeValues(value).some((scopeValue) => {
    const compact = scopeValue.replace(/[\s_-]+/g, '');
    if (
      /[\u3040-\u30ff\u3400-\u9fff\uf900-\ufaff\uac00-\ud7af]/.test(
        compact,
      )
    ) {
      return compact.length === 1;
    }
    return compact.length > 0 && compact.length <= 2;
  });
};

function formatScopeCandidates(values: string[], fallback: string): string {
  return values.length > 0 ? values.join(' 或 ') : fallback;
}

export function getRuleScopeExecutionReceipt(input: {
  filterSender?: string;
  filterGroup?: string;
  inactive?: boolean;
}): RuleScopeExecutionReceipt {
  const senderValues = splitScopeValues(input.filterSender);
  const groupValues = splitScopeValues(input.filterGroup);
  const hasSenderScope = senderValues.length > 0;
  const hasGroupScope = groupValues.length > 0;
  const isGlobalScope = !hasSenderScope && !hasGroupScope;
  const hasShortScope =
    isShortScopeValue(input.filterSender) ||
    isShortScopeValue(input.filterGroup);

  if (input.inactive) {
    return {
      tone: 'inactive',
      title: '范围执行回执 · 已停止',
      summary: `当前规则已过期，不会进入运行时候选；原保存范围为群组 ${formatScopeCandidates(
        groupValues,
        '不限',
      )}；发送人 ${formatScopeCandidates(senderValues, '不限')}。`,
      filterText:
        'LLM 前候选筛选会跳过这条手动规则，模型即使命中旧 ruleRef 也不能让它恢复执行。',
      finalCheckText:
        '只有编辑过期时间并保存为有效规则后，才会重新参与发送人、群组、时间和系统观察上下文的最终校验。',
      boundaryText:
        '查看、导出或编辑过期规则不会分析历史消息、发送通知、写入记忆、进入摘要、生成自动答复或创建外部动作。',
    };
  }

  const title = isGlobalScope
    ? '范围执行回执 · 全局候选'
    : hasShortScope
      ? '范围执行回执 · 需复核'
      : '范围执行回执';
  const tone: RuleSafetyTone = isGlobalScope
    ? 'danger'
    : hasShortScope
      ? 'warn'
      : 'ok';

  return {
    tone,
    title,
    summary: isGlobalScope
      ? '当前手动规则会把所有可读取群组和所有发送人都纳入候选。'
      : `候选范围：群组 ${formatScopeCandidates(
          groupValues,
          '不限',
        )}；发送人 ${formatScopeCandidates(senderValues, '不限')}。`,
    filterText:
      'LLM 前先做确定性 sender / group 候选筛选；多个候选在同一维度内按 OR，群组和发送人同时设置时必须两者都命中。',
    finalCheckText:
      'LLM 返回后，写入记忆、通知、摘要、自动答复、关注后续和 RuntimeAction 前会再次按发送人、群组、时间和系统观察上下文校验；规则限定的发送人或群组如果在消息上下文里缺失，会按未确认范围拦截。',
    boundaryText:
      '保存或编辑只更新本机手动规则；不会分析历史消息、导入系统观察、发送通知或创建外部动作。',
  };
}

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
      input.openClawConfigured === false
        ? '联动操作：待激活'
        : input.automationRequiresApproval
        ? '联动操作：需批准'
        : '联动操作：自动执行',
    );
  }

  return items;
}

export function getRuleDeliveryReceipt(
  input: RuleActionSummaryInput,
): RuleDeliveryReceipt {
  const notifyMethods = getNotifyMethodLabels(input);
  const hasDigest = Boolean(input.digestEnabled && !input.followThread);

  if (input.followThread) {
    return {
      tone: 'followup',
      label: notifyMethods.length > 0 ? '关注后续通知' : '关注后续静默',
      detail:
        notifyMethods.length > 0
          ? `命中后写入记忆；后续相关消息优先按关注后续走 ${notifyMethods.join(' / ')}。`
          : '命中后写入记忆并更新后续上下文；没有配置即时通知。',
    };
  }

  if (hasDigest) {
    const frequency = input.digestFrequency === 'weekly' ? '每周' : '每日';
    return {
      tone: 'digest',
      label: `${frequency}摘要`,
      detail: `命中后写入记忆并进入${frequency}摘要；摘要会替代 Glip / Chrome 即时通知。`,
    };
  }

  if (notifyMethods.length > 0) {
    return {
      tone: 'notify',
      label: '即时通知',
      detail: `命中后写入记忆，并立即通过 ${notifyMethods.join(' / ')} 通知。`,
    };
  }

  return {
    tone: 'silent',
    label: '静默入库',
    detail: '命中后只写入记忆，不发即时通知，也不进入定时摘要。',
  };
}

function getAutoReplyBoundaryText(input: RuleActionSummaryInput): string {
  if (!input.autoReply) {
    return '自动答复：不会创建回复草稿。';
  }

  if (input.autoReplyMode === 'manual') {
    return '自动答复：只进入审核队列，不直接发送。';
  }

  if (input.autoReplyMode === 'delayed') {
    return '自动答复：先排入延迟窗口，发送前可拦截。';
  }

  return '自动答复：命中后可能直接发送，需要确认范围足够窄。';
}

function getAutomationBoundaryText(input: RuleActionSummaryInput): string {
  if (!normalizeOptionalText(input.automationPrompt)) {
    return '联动操作：不会创建外部执行动作。';
  }

  if (input.openClawConfigured === false) {
    return '联动操作：OpenClaw 未连接，先保存为待激活，不执行外部写操作。';
  }

  if (input.automationRequiresApproval) {
    return '联动操作：命中后进入 Action Queue，等待批准后才执行。';
  }

  return '联动操作：命中后可进入 Action Queue 自动执行，执行结果在那里审计。';
}

export function getRuleEffectBoundaryReceipt(
  input: RuleActionSummaryInput,
): RuleEffectBoundaryReceipt {
  const delivery = getRuleDeliveryReceipt(input);
  const hasAutomation = Boolean(normalizeOptionalText(input.automationPrompt));
  const autoReplyDirect = input.autoReply && input.autoReplyMode === 'immediate';
  const autoExecutesAutomation =
    hasAutomation &&
    input.openClawConfigured !== false &&
    input.automationRequiresApproval !== true;
  const requiresReview =
    (input.autoReply && input.autoReplyMode !== 'immediate') ||
    (hasAutomation &&
      (input.automationRequiresApproval === true ||
        input.openClawConfigured === false));

  const tone: RuleEffectBoundaryTone =
    autoReplyDirect || autoExecutesAutomation
      ? 'danger'
      : requiresReview
        ? 'review'
        : delivery.tone === 'silent'
          ? 'quiet'
          : 'active';

  const label =
    tone === 'danger'
      ? '副作用边界 · 自动执行'
      : tone === 'review'
        ? '副作用边界 · 可复核'
        : tone === 'quiet'
          ? '副作用边界 · 低打扰'
          : '副作用边界 · 已配置';

  return {
    tone,
    label,
    items: [
      '入库：只有通过最终范围校验的命中才写入记忆；如果规则限定发送人或群组但消息缺少对应上下文，会按未确认范围拦截；最近拦截会显示在规则卡片上。',
      `打扰：${delivery.detail}`,
      getAutoReplyBoundaryText(input),
      getAutomationBoundaryText(input),
    ],
  };
}

export function getRuleRunPreviewReceipt(
  input: RuleActionSummaryInput & {
    isSilentAnalysisEnabled?: boolean;
    inactive?: boolean;
  },
): RuleRunPreviewReceipt {
  const delivery = getRuleDeliveryReceipt(input);
  const effect = getRuleEffectBoundaryReceipt(input);
  const isPaused = input.inactive || input.isSilentAnalysisEnabled === false;
  const tone: RuleRunPreviewTone = isPaused
    ? 'paused'
    : effect.tone === 'danger'
      ? 'danger'
      : effect.tone === 'review'
        ? 'review'
        : 'ready';
  const title = input.inactive
    ? '保存前运行路径 · 已停止'
    : input.isSilentAnalysisEnabled === false
      ? '保存前运行路径 · 仅保存'
      : tone === 'danger'
        ? '保存前运行路径 · 自动执行'
        : tone === 'review'
          ? '保存前运行路径 · 需复核'
          : '保存前运行路径';

  const triggerText = input.inactive
    ? '触发：当前规则已过期；保存时如果不更新有效期，后台不会自动捕获后续新消息。'
    : input.isSilentAnalysisEnabled === false
      ? '触发：保存只更新本机手动规则；后台静默消息分析未启用，不会自动捕获后续新消息。'
      : '触发：保存后只自动观察后续新消息；历史消息需要另点「立即分析最近」才会扫描。';

  return {
    tone,
    title,
    triggerText,
    matchText:
      '匹配：先按发送人 / 群组做确定性候选筛选，再让 LLM 判断规则语义是否真正命中；最终确认时缺少被限定的发送人或群组上下文会被拦截。',
    outcomeText: `命中：通过最终发送人、群组和时间校验后才写入记忆；${delivery.detail}`,
    boundaryText:
      '保存本身不会回扫历史消息、发送通知、写入记忆、创建 RuntimeAction 或执行外部动作；系统观察规则也不会被导入、导出或改写。',
  };
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
  const hasNotificationTarget =
    hasNotifyMethod(input.notifyMethod, 'bot') ||
    hasNotifyMethod(input.notifyMethod, 'chrome');
  const isFollowThread = Boolean(input.followThread);
  const digestSuppressesImmediateNotification =
    Boolean(input.digestEnabled) && !isFollowThread;
  const interruptsImmediately =
    hasNotificationTarget &&
    !digestSuppressesImmediateNotification &&
    !isFollowThread;
  const notifiesFollowThread = hasNotificationTarget && isFollowThread;

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
  if (notifiesFollowThread) {
    reasons.push('关注后续通知');
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
