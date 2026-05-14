const DISCUSSION_ID_KEYS = [
  'messageId',
  'conversationId',
  'sourceMessageId',
  'id',
] as const;

export const getUnreadDiscussionMessageId = (discussion: any): string => {
  for (const key of DISCUSSION_ID_KEYS) {
    const value = discussion?.[key];
    if (value !== undefined && value !== null && String(value).trim()) {
      return String(value).trim();
    }
  }
  return '';
};

export const getUnreadDiscussionText = (discussion: any): string => {
  const text =
    discussion?.text ||
    discussion?.summary ||
    discussion?.content ||
    discussion?.highlightText ||
    discussion?.title;
  const normalizedText = String(text || '').trim();
  return normalizedText || '未读讨论';
};

export const getUnreadDiscussionKey = (
  discussion: any,
  index: number,
): string => {
  return (
    getUnreadDiscussionMessageId(discussion) ||
    `${getUnreadDiscussionText(discussion)}:${index}`
  );
};

export const getTopicUnreadPreviewCount = (topic: any): number => {
  return Array.isArray(topic?.unreadDiscussions)
    ? topic.unreadDiscussions.length
    : 0;
};

export const getTopicUnreadTotalCount = (topic: any): number => {
  const readStatusCount = Number(topic?.readStatus?.unreadCount);
  const previewCount = getTopicUnreadPreviewCount(topic);
  if (Number.isFinite(readStatusCount)) {
    return Math.max(0, readStatusCount, previewCount);
  }
  return previewCount;
};

export const getTopicUnreadPreviewMeta = (topic: any): string => {
  const previewCount = getTopicUnreadPreviewCount(topic);
  if (previewCount === 0) return '';

  const totalCount = getTopicUnreadTotalCount(topic);
  return totalCount > previewCount
    ? `(${previewCount}/${totalCount}条预览)`
    : `(${previewCount}条)`;
};

export const getTopicUnreadRemainingCount = (
  topic: any,
  visibleLimit = 3,
): number => {
  const visiblePreviewCount = Math.min(
    getTopicUnreadPreviewCount(topic),
    Math.max(0, visibleLimit),
  );
  return Math.max(0, getTopicUnreadTotalCount(topic) - visiblePreviewCount);
};
