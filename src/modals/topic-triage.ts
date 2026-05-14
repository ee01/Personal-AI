import { normalizeTopicTimestamp } from './topic-time';

export interface TopicTriagePriority {
  score: number;
  label: string;
  reasons: string[];
  unreadCount: number;
  lastActivityTime: number | null;
}

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

export const getTopicUnreadCount = (topic: any): number => {
  const readStatusCount = Number(topic?.readStatus?.unreadCount);
  if (Number.isFinite(readStatusCount)) {
    return Math.max(0, readStatusCount);
  }

  return Array.isArray(topic?.unreadDiscussions)
    ? topic.unreadDiscussions.length
    : 0;
};

export const getTopicLastActivityTime = (topic: any): number | null => {
  return normalizeTopicTimestamp(
    topic?.readStatus?.lastUpdateTime ??
      topic?.updated ??
      topic?.lastActivityTime ??
      topic?.timestamp ??
      topic?.cachedAt,
  );
};

const getTopicImportanceScore = (topic: any): number => {
  const rawImportance = Number(
    topic?.importance ?? topic?.salience ?? topic?.relevanceScore ?? 0.5,
  );
  return Number.isFinite(rawImportance) ? clamp(rawImportance, 0, 1) : 0.5;
};

const getRecencyScore = (lastActivityTime: number | null, now: number): number => {
  if (!lastActivityTime) return 0;

  const ageHours = (now - lastActivityTime) / 3_600_000;
  if (ageHours < -1) return 0;
  if (ageHours <= 2) return 40;
  if (ageHours <= 24) return 28;
  if (ageHours <= 72) return 18;
  if (ageHours <= 168) return 10;
  return 0;
};

export const getTopicTriagePriority = (
  topic: any,
  now = Date.now(),
): TopicTriagePriority => {
  const unreadCount = getTopicUnreadCount(topic);
  const importance = getTopicImportanceScore(topic);
  const lastActivityTime = getTopicLastActivityTime(topic);
  const conversationCount = Number(topic?.statistic?.conversations || 0);

  const unreadScore = Math.min(unreadCount, 10) * 8;
  const importanceScore = importance * 40;
  const recencyScore = getRecencyScore(lastActivityTime, now);
  const discussionScore = Number.isFinite(conversationCount)
    ? Math.min(conversationCount, 50) * 0.2
    : 0;
  const score = unreadScore + importanceScore + recencyScore + discussionScore;

  const reasons: string[] = [];
  if (unreadCount >= 5) reasons.push('未读较多');
  if (importance >= 0.8) reasons.push('高热度');
  if (recencyScore >= 28) reasons.push('近期更新');
  if (conversationCount >= 20) reasons.push('讨论集中');

  let label = '待阅读';
  if (unreadCount >= 3 && importance >= 0.75) {
    label = '优先处理';
  } else if (unreadCount >= 5) {
    label = '多条未读';
  } else if (importance >= 0.8) {
    label = '高热度';
  } else if (recencyScore >= 28) {
    label = '近期更新';
  }

  return {
    score,
    label,
    reasons: reasons.length > 0 ? reasons : ['按未读、热度和时间综合排序'],
    unreadCount,
    lastActivityTime,
  };
};

export const sortTopicsForTriage = (topics: any[], now = Date.now()): any[] => {
  return [...topics].sort((a, b) => {
    const priorityDelta =
      getTopicTriagePriority(b, now).score - getTopicTriagePriority(a, now).score;
    if (priorityDelta !== 0) return priorityDelta;

    return (getTopicLastActivityTime(b) || 0) - (getTopicLastActivityTime(a) || 0);
  });
};
