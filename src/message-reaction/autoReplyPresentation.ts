export interface AutoReplyTopicContext {
  sender?: string;
  summary?: string;
  messageContent?: string;
}

export interface AutoReplyModeContext {
  reviewMode?: 'immediate' | 'delayed' | 'manual';
  delayHours?: number | string | null;
  useAIGenerate?: boolean;
  replyContent?: string | null;
}

export interface AutoReplyModeReceipt {
  tone: 'danger' | 'warning' | 'safe';
  title: string;
  timingText: string;
  reviewText: string;
  generationText: string;
  fallbackText: string;
}

export interface AutoReplyRuleScopeContext extends AutoReplyModeContext {
  filterSender?: string;
  filterGroup?: string;
}

export interface AutoReplyRuleScopeReceipt {
  tone: AutoReplyModeReceipt['tone'];
  title: string;
  scopeText: string;
  activationText: string;
  queueText: string;
}

export interface AutoReplyContentReadinessReceipt {
  tone: AutoReplyModeReceipt['tone'];
  title: string;
  detailText: string;
  recoveryText: string;
  listTitle: string;
  listSummary: string;
}

export interface AutoReplySaveButtonBoundaryContext
  extends AutoReplyRuleScopeContext {
  action: 'create' | 'edit';
  isSilentAnalysisEnabled?: boolean;
}

export function buildAutoReplyConfigLaunchReceipt(): string {
  return '已打开自动答复配置；当前消息未发送、未创建规则，保存规则后才会按发送口径执行。';
}

const MIN_AUTO_REPLY_DELAY_HOURS = 1;
const MAX_AUTO_REPLY_DELAY_HOURS = 72;

function normalizeTopicPreviewText(...candidates: Array<string | undefined>) {
  for (const candidate of candidates) {
    const normalized = candidate?.replace(/\s+/g, ' ').trim();
    if (normalized) {
      return normalized;
    }
  }

  return '消息';
}

function getSenderTopicPrefix(sender?: string, previewText = '') {
  const firstName = sender?.trim().split(/\s+/)[0] || '';
  if (!firstName || previewText.includes(firstName)) {
    return '';
  }

  return firstName;
}

export function buildAutoReplyTopic(
  msgContext: AutoReplyTopicContext,
): string {
  const previewText = normalizeTopicPreviewText(
    msgContext.summary,
    msgContext.messageContent,
  );
  const truncatedPreview = `${previewText.substring(0, 50)}${previewText.length > 50 ? '...' : ''}`;
  const senderPrefix = getSenderTopicPrefix(msgContext.sender, previewText);

  return senderPrefix
    ? `自动答复 ${senderPrefix}「${truncatedPreview}」`
    : `自动答复「${truncatedPreview}」`;
}

export function normalizeAutoReplyDelayHours(value: unknown): number {
  const numeric =
    typeof value === 'number'
      ? value
      : typeof value === 'string'
        ? Number.parseInt(value, 10)
        : Number.NaN;

  if (!Number.isFinite(numeric)) {
    return MIN_AUTO_REPLY_DELAY_HOURS;
  }

  return Math.min(
    MAX_AUTO_REPLY_DELAY_HOURS,
    Math.max(MIN_AUTO_REPLY_DELAY_HOURS, Math.floor(numeric)),
  );
}

export function buildAutoReplyModeReceipt(
  config: AutoReplyModeContext,
): AutoReplyModeReceipt {
  const hasFixedReplyFallback = Boolean(config.replyContent?.trim());
  const generationText = config.useAIGenerate
    ? '每次命中都会重新生成草稿，固定文本只作为风格参考。'
    : '每次命中都会复用当前固定文本。';
  const fallbackText = config.useAIGenerate
    ? hasFixedReplyFallback
      ? '如果 AI 生成失败，会改用当前固定文本入队；不会替换成默认短句。'
      : '如果 AI 生成失败或返回空文本，本次会跳过自动答复，不会写入默认短句。'
    : '如果固定文本为空，本次会跳过自动答复，不会入队空回复。';

  switch (config.reviewMode) {
    case 'immediate':
      return {
        tone: 'danger',
        title: '直接发送',
        timingText: '命中后会排到下一分钟发送。',
        reviewText: '不会进入审核队列，只适合低风险、范围很窄的规则。',
        generationText,
        fallbackText,
      };
    case 'manual':
      return {
        tone: 'safe',
        title: '仅审核',
        timingText: '命中后只进入待审核列表。',
        reviewText: '需要在定时消息管理器里批准后，才会安排发送。',
        generationText,
        fallbackText,
      };
    case 'delayed':
    default: {
      const delayHours = normalizeAutoReplyDelayHours(config.delayHours);
      return {
        tone: 'warning',
        title: `${delayHours} 小时可拦截`,
        timingText: `命中后会先排到 ${delayHours} 小时后发送。`,
        reviewText: '发送前可在定时消息管理器里修改、暂停或删除。',
        generationText,
        fallbackText,
      };
    }
  }
}

function normalizeScopeDisplay(value: string | undefined, fallback: string) {
  const normalized = value?.replace(/\s+/g, ' ').trim();
  return normalized || fallback;
}

export function normalizeAutoReplyContent(value: string | null | undefined) {
  return value?.trim() || '';
}

export function buildAutoReplyContentReadinessReceipt(
  config: AutoReplyModeContext,
): AutoReplyContentReadinessReceipt {
  const fixedReply = normalizeAutoReplyContent(config.replyContent);
  if (config.useAIGenerate && fixedReply) {
    return {
      tone: 'safe',
      title: 'AI 生成 + 固定 fallback 就绪',
      detailText:
        '后续命中会先尝试 AI 生成；生成失败或为空时，改用当前固定文本入队。',
      recoveryText: '改动模板只影响后续新消息，不会更新已排队的自动答复。',
      listTitle: '自动答复草稿',
      listSummary: fixedReply,
    };
  }

  if (config.useAIGenerate) {
    return {
      tone: 'warning',
      title: 'AI 生成就绪 · 无固定 fallback',
      detailText:
        '后续命中会尝试 AI 生成；如果生成失败或为空，本次会跳过入队。',
      recoveryText: '需要更稳时补一条固定 fallback，或切到仅审核后再观察。',
      listTitle: 'AI 自动答复',
      listSummary: '每次命中实时生成；没有固定 fallback，生成失败会跳过入队。',
    };
  }

  if (fixedReply) {
    return {
      tone: 'safe',
      title: '固定回复就绪',
      detailText: '后续命中会复用当前固定文本入队。',
      recoveryText: '改动文本只影响后续新消息，不会更新已排队的自动答复。',
      listTitle: '自动答复草稿',
      listSummary: fixedReply,
    };
  }

  return {
    tone: 'danger',
    title: '固定回复未就绪',
    detailText:
      '保存后其他规则动作仍生效，但自动答复命中会跳过，不创建空回复队列行。',
    recoveryText: '补充固定回复，或开启“每次 AI 生成类似答复”。',
    listTitle: '自动答复未就绪',
    listSummary:
      '固定回复为空且未开启 AI 生成；命中时只会跳过自动答复入队。',
  };
}

export function buildAutoReplyRuleScopeReceipt(
  config: AutoReplyRuleScopeContext,
): AutoReplyRuleScopeReceipt {
  const senderScope = normalizeScopeDisplay(config.filterSender, '不限发送人');
  const groupScope = normalizeScopeDisplay(config.filterGroup, '不限群组');
  const hasExplicitScope =
    Boolean(config.filterSender?.trim()) || Boolean(config.filterGroup?.trim());
  const modeReceipt = buildAutoReplyModeReceipt(config);

  let queueText: string;
  switch (config.reviewMode) {
    case 'immediate':
      queueText =
        '后续新消息命中后会新建 Active 队列行，并排到下一分钟发送当前命中时的正文；保存配置本身不会立即发送。';
      break;
    case 'manual':
      queueText =
        '后续新消息命中后只新建 PendingReview 行；批准某一行后才会排到下一分钟发送，拒绝只关闭该行。';
      break;
    case 'delayed':
    default:
      queueText =
        '后续新消息命中后会新建 Active 队列行，并按延迟时间排期；发送前可以在定时消息管理器修改、暂停或删除该行。';
      break;
  }

  return {
    tone: modeReceipt.tone,
    title: '自动答复规则边界',
    scopeText: hasExplicitScope
      ? `命中范围：发送人 ${senderScope}；群组 ${groupScope}。`
      : '命中范围：未限定发送人或群组，后续任何匹配规则语义的新消息都可能生成自动答复队列行。',
    activationText:
      '保存规则只影响后续分析的新消息；不会回扫历史消息、不会把当前页面草稿插入 RingCentral，也不会直接向任何人发送。',
    queueText,
  };
}

export function buildAutoReplySaveButtonBoundary(
  config: AutoReplySaveButtonBoundaryContext,
): string {
  const actionText =
    config.action === 'edit' ? '保存自动答复规则修改' : '确认添加自动答复规则';
  const readinessReceipt = buildAutoReplyContentReadinessReceipt(config);
  const ruleScopeReceipt = buildAutoReplyRuleScopeReceipt(config);
  const triggerText =
    config.isSilentAnalysisEnabled === false
      ? '后台静默消息分析未启用时只保存本机规则，不会自动捕获后续新消息。'
      : '保存后只影响后续分析的新消息。';

  return [
    `${actionText}。`,
    ruleScopeReceipt.scopeText,
    triggerText,
    ruleScopeReceipt.queueText,
    `${readinessReceipt.title}：${readinessReceipt.detailText}`,
    '点击不会回扫历史消息、不会把当前页面草稿插入 RingCentral，也不会立即发送当前消息。',
  ].join(' ');
}
