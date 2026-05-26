export interface AutoReplyTopicContext {
  sender?: string;
  summary?: string;
  messageContent?: string;
}

export interface AutoReplyModeContext {
  reviewMode?: 'immediate' | 'delayed' | 'manual';
  delayHours?: number | string | null;
  useAIGenerate?: boolean;
}

export interface AutoReplyModeReceipt {
  tone: 'danger' | 'warning' | 'safe';
  title: string;
  timingText: string;
  reviewText: string;
  generationText: string;
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
  const generationText = config.useAIGenerate
    ? '每次命中都会重新生成草稿，固定文本只作为风格参考。'
    : '每次命中都会复用当前固定文本。';

  switch (config.reviewMode) {
    case 'immediate':
      return {
        tone: 'danger',
        title: '直接发送',
        timingText: '命中后会排到下一分钟发送。',
        reviewText: '不会进入审核队列，只适合低风险、范围很窄的规则。',
        generationText,
      };
    case 'manual':
      return {
        tone: 'safe',
        title: '仅审核',
        timingText: '命中后只进入待审核列表。',
        reviewText: '需要在定时消息管理器里批准后，才会安排发送。',
        generationText,
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
      };
    }
  }
}
