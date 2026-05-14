export const normalizeTopicTimestamp = (timestamp: unknown): number | null => {
  if (timestamp === undefined || timestamp === null || timestamp === '') {
    return null;
  }

  const numericTimestamp =
    typeof timestamp === 'number' ? timestamp : Number(timestamp);

  if (Number.isFinite(numericTimestamp) && numericTimestamp > 0) {
    // Backend payloads may use Unix seconds while frontend mocks use ms.
    return numericTimestamp < 100_000_000_000
      ? numericTimestamp * 1000
      : numericTimestamp;
  }

  if (typeof timestamp === 'string') {
    const parsedTimestamp = Date.parse(timestamp);
    return Number.isFinite(parsedTimestamp) && parsedTimestamp > 0
      ? parsedTimestamp
      : null;
  }

  return null;
};

export const formatTopicRelativeTime = (
  timestamp: unknown,
  now = Date.now(),
): string => {
  const numericTimestamp = normalizeTopicTimestamp(timestamp);
  if (!numericTimestamp) return '';

  const diff = now - numericTimestamp;
  if (diff < -60_000) return '';
  if (diff <= 0) return '刚刚';

  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  const weeks = Math.floor(diff / 604800000);

  if (hours < 1) return '刚刚';
  if (hours < 24) return `${hours}小时前`;
  if (days < 7) return `${days}天前`;
  if (weeks < 4) return `${weeks}周前`;
  return new Date(numericTimestamp).toLocaleDateString();
};
