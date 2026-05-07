export interface AutoReplyTopicContext {
  sender?: string;
  summary?: string;
  messageContent?: string;
}

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
