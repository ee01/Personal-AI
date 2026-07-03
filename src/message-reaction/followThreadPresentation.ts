export interface FollowThreadDraftBoundaryContext {
  groupName?: string;
  filterSender?: string;
  notifyMethod?: string;
  notifyFrequency?: 'immediate' | 'merged' | string;
  expiryDays?: string | number;
}

export interface FollowThreadDraftBoundaryReceipt {
  title: string;
  scopeText: string;
  lifetimeText: string;
  matchingText: string;
  activationText: string;
  deliveryText: string;
  boundaryText: string;
}

export interface FollowThreadSaveResultContext {
  ruleName?: string;
  indexedOriginal: boolean;
  notifyMethod?: string;
  notifyFrequency?: 'immediate' | 'merged' | string;
  expiryDays?: string | number;
}

export interface FollowThreadManagementStatusContext {
  relatedCount: number;
  latestHitText?: string;
  latestNotifiedAt?: unknown;
  expiredAt?: unknown;
  notifyMethod?: string;
  notifyFrequency?: 'immediate' | 'merged' | string;
}

export interface FollowThreadManagementReceipt {
  tone: 'success' | 'warning';
  title: string;
  body: string;
}

export interface FollowThreadManagementStatusReceipt {
  title: string;
  stateText: string;
  hitText: string;
  deliveryText: string;
  boundaryText: string;
}

function normalizeText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function getNotifyMethodLabel(value: string): string {
  const methods = value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
  if (!methods.length) return '未选择通知渠道';

  const labels = methods.map((method) => {
    if (method === 'bot') return 'Bot';
    if (method === 'chrome') return 'Chrome 通知';
    return method;
  });
  return labels.join(' + ');
}

function normalizeExpiryTimestamp(value: unknown): number | null {
  if (typeof value === 'number') {
    return Number.isFinite(value) && value > 0 ? value : null;
  }

  const text = normalizeText(value);
  if (!text) return null;
  const timestamp = Number(text);
  return Number.isFinite(timestamp) && timestamp > 0 ? timestamp : null;
}

function getExpiryLabel(value: unknown): string {
  if (typeof value === 'number') {
    return Number.isFinite(value) && value > 0
      ? `${Math.ceil(value)} 天后自动过期`
      : '手动结束';
  }

  const text = normalizeText(value);
  if (!text) return '手动结束';

  const days = Number(text);
  return Number.isFinite(days) && days > 0
    ? `${Math.ceil(days)} 天后自动过期`
    : '手动结束';
}

function formatRuleName(value: unknown): string {
  const text = normalizeText(value);
  if (!text) return '这条规则';
  return text.length > 34 ? `${text.slice(0, 34)}...` : text;
}

function formatDateTime(value: number): string {
  return new Date(value).toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatTimestamp(value: unknown): string | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return formatDateTime(value > 1_000_000_000_000 ? value : value * 1000);
  }

  const text = normalizeText(value);
  if (!text) return null;

  const numeric = Number(text);
  if (Number.isFinite(numeric) && /^[+-]?\d+(\.\d+)?$/.test(text)) {
    return formatTimestamp(numeric);
  }

  const parsed = Date.parse(text);
  return Number.isFinite(parsed) ? formatDateTime(parsed) : null;
}

function buildDeliveryText(
  context: Pick<
    FollowThreadDraftBoundaryContext,
    'notifyMethod' | 'notifyFrequency'
  >,
): string {
  const notifyMethod = getNotifyMethodLabel(normalizeText(context.notifyMethod));
  const notifyCadence =
    context.notifyFrequency === 'merged' ? '合并推送' : '即时提醒';
  return `通知口径：${notifyMethod}，${notifyCadence}。`;
}

export function buildFollowThreadConfigLaunchReceipt(): string {
  return '已打开关注后续配置；当前消息尚未开始关注，保存规则后才会监听同会话后续讨论并按通知设置提醒。';
}

export function buildFollowThreadDraftBoundaryReceipt(
  context: FollowThreadDraftBoundaryContext,
): FollowThreadDraftBoundaryReceipt {
  const groupName = normalizeText(context.groupName) || '当前会话';
  const filterSender = normalizeText(context.filterSender);

  return {
    title: '关注后续创建边界',
    scopeText: filterSender
      ? `当前会限定发送人为「${filterSender}」，并在「${groupName}」内匹配后续讨论。`
      : `默认监听「${groupName}」内所有人的后续讨论，不只看原发送人。`,
    lifetimeText: `监听期限：${getExpiryLabel(context.expiryDays)}；可在保存前修改天数，留空则手动结束。`,
    matchingText:
      '匹配路线：优先用 reply/thread/@提及/引用/关键词识别后续，必要时再用原消息语义匹配；命中新消息后才通知。',
    activationText:
      '只有点击保存后，才会创建本地关注规则并索引这条原消息；打开或编辑表单不会启用 Watch。',
    deliveryText: buildDeliveryText(context),
    boundaryText:
      '保存不会回扫历史消息、不会立刻发送通知、不会立即写入长期记忆，也不会创建自动答复或联动操作。',
  };
}

export function buildFollowThreadSaveResultReceipt(
  context: FollowThreadSaveResultContext,
): string {
  const ruleName = formatRuleName(context.ruleName);
  const deliveryText = buildDeliveryText(context);
  const lifetimeText = `监听期限：${getExpiryLabel(context.expiryDays)}。`;

  if (context.indexedOriginal) {
    return `已保存关注后续「${ruleName}」：开始监听后续新消息；原消息索引已写入，reply/thread/@提及/引用/关键词和语义匹配都可用。${deliveryText}${lifetimeText}没有回扫历史消息，也没有立刻发送通知。`;
  }

  return `已保存关注后续「${ruleName}」，但原消息索引未确认：reply/thread/@提及/引用/关键词路径仍会尝试，语义匹配可能降级。${deliveryText}${lifetimeText}没有回扫历史消息，也没有立刻发送通知。`;
}

export function isFollowThreadRuleExpired(
  expiredAt: unknown,
  now = Date.now(),
): boolean {
  const timestamp = normalizeExpiryTimestamp(expiredAt);
  return timestamp !== null && timestamp <= now;
}

export function formatFollowThreadExpiry(
  expiredAt: unknown,
  now = Date.now(),
): string {
  const timestamp = normalizeExpiryTimestamp(expiredAt);
  if (timestamp === null) return '手动结束';

  const diff = timestamp - now;
  if (diff <= 0) return '已过期';

  const dayMs = 24 * 60 * 60 * 1000;
  const hourMs = 60 * 60 * 1000;
  if (diff < dayMs) {
    return `${Math.max(1, Math.ceil(diff / hourMs))} 小时后`;
  }
  return `${Math.ceil(diff / dayMs)} 天后`;
}

export function getFollowThreadExtendedExpiry(
  expiredAt: unknown,
  now = Date.now(),
  extensionDays = 7,
): number {
  const timestamp = normalizeExpiryTimestamp(expiredAt);
  const base = timestamp !== null && timestamp > now ? timestamp : now;
  return base + extensionDays * 24 * 60 * 60 * 1000;
}

export function getFollowThreadNotifyMethodText(method: unknown): string {
  const text = normalizeText(method);
  if (!text) return '未选择通知渠道';
  return getNotifyMethodLabel(text);
}

export function buildFollowThreadManagementStatusReceipt(
  context: FollowThreadManagementStatusContext,
): FollowThreadManagementStatusReceipt {
  const expired = isFollowThreadRuleExpired(context.expiredAt);
  const expiryText = formatFollowThreadExpiry(context.expiredAt);
  const latestHitText = normalizeText(context.latestHitText) || '暂无';
  const latestNotifiedAt = formatTimestamp(context.latestNotifiedAt);
  const notifyCadence =
    context.notifyFrequency === 'merged' ? '合并推送' : '即时提醒';

  return {
    title: '监听状态回执',
    stateText: expired
      ? `这条手动规则已过期，当前不会继续匹配新消息；到期时间：${expiryText}。`
      : `这条手动规则仍在监听后续新消息；到期时间：${expiryText}。`,
    hitText:
      context.relatedCount > 0
        ? `已记录 ${context.relatedCount} 条关联消息；最新关联：${latestHitText}；最新通知：${latestNotifiedAt || '未记录通知时间'}。`
        : '当前还没有关联消息。这不是读取失败，只表示本规则范围内尚未捕获到后续命中。',
    deliveryText: `通知口径：${getNotifyMethodLabel(
      normalizeText(context.notifyMethod),
    )}，${notifyCadence}；展开时间线不会补发或重发通知。`,
    boundaryText:
      '本页只展示本机手动 Watch 规则快照；不会回扫历史消息、不会确认任务完成、不会发送消息，也不会把关联记录改写成长期记忆。',
  };
}

export function buildFollowThreadHitStatusText(context: {
  notifiedAt?: unknown;
  summary?: unknown;
}): string {
  const notifiedAt = formatTimestamp(context.notifiedAt);
  const summary = normalizeText(context.summary);
  const notificationText = notifiedAt
    ? `已记录通知时间 ${notifiedAt}`
    : '未看到通知时间，可能只是旧缓存或本地关联记录';
  const summaryText = summary
    ? '已有摘要'
    : '未记录摘要，可用发送人、时间和匹配方式回溯';

  return `通知状态：${notificationText}；${summaryText}；展开这条命中不会重新发送通知。`;
}

export function buildFollowThreadExtendedReceipt(context: {
  ruleName?: string;
  expiredAt: unknown;
}): FollowThreadManagementReceipt {
  return {
    tone: 'success',
    title: '已延长关注后续',
    body: `关注规则「${formatRuleName(context.ruleName)}」的新到期时间为 ${formatDateTime(
      normalizeExpiryTimestamp(context.expiredAt) ?? Date.now(),
    )}；本次只更新本地手动规则，不回扫历史消息、不立刻发送通知。`,
  };
}

export function buildFollowThreadCancelReceipt(context: {
  ruleName?: string;
}): FollowThreadManagementReceipt {
  return {
    tone: 'warning',
    title: '已取消关注后续',
    body: `已删除本地手动规则「${formatRuleName(
      context.ruleName,
    )}」；不会删除原消息、不会立刻清理已写入 Memory Service 的历史索引，后端仍按遗忘策略处理旧资料。`,
  };
}
