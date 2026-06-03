import type { ScheduledMessage } from './types';

export interface ScheduledMessagesQueryFilters {
  categories: string[];
  filterPendingReview: boolean;
  filterSelfOnly: boolean;
  targetMessageId?: string;
  configureRingCentralSender: boolean;
}

export interface ScheduledMessagesViewFilters {
  selectedCategories: string[];
  filterPendingReview: boolean;
  filterSelfOnly: boolean;
  currentUsername?: string;
}

function parseBooleanParam(value: string | null): boolean {
  return value === '1' || value === 'true' || value === 'yes';
}

function normalizeToken(value?: string): string {
  return (value || '').trim().toLowerCase();
}

function normalizeQueryValue(value: string | null): string | undefined {
  const normalized = (value || '').trim();
  return normalized || undefined;
}

export function buildScheduledMessagesReviewUrl(messageId?: string): string {
  const params = new URLSearchParams({ filterPendingReview: 'true' });
  const normalizedMessageId = normalizeQueryValue(messageId || null);
  if (normalizedMessageId) {
    params.set('messageId', normalizedMessageId);
  }

  const pagePath = `scheduled-messages.html?${params.toString()}`;
  if (typeof chrome !== 'undefined' && chrome.runtime?.getURL) {
    return chrome.runtime.getURL(pagePath);
  }

  return pagePath;
}

export function getScheduledMessageCategories(category?: string): string[] {
  return (category || '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
}

export function isSelfOnlyScheduledMessage(
  message: Pick<ScheduledMessage, 'Glip_User_Name'>,
  currentUsername?: string,
): boolean {
  const normalizedCurrentUsername = normalizeToken(currentUsername);
  if (!message.Glip_User_Name || !normalizedCurrentUsername) {
    return false;
  }

  const usernames = message.Glip_User_Name
    .split('+')
    .map(normalizeToken)
    .filter(Boolean);

  return usernames.length === 1 && usernames[0] === normalizedCurrentUsername;
}

export function hasScheduledMessagesViewFilters(filters: ScheduledMessagesViewFilters): boolean {
  return Boolean(
    filters.filterPendingReview ||
    filters.filterSelfOnly ||
    filters.selectedCategories.length > 0,
  );
}

export function filterScheduledMessagesForView(
  messages: ScheduledMessage[],
  filters: ScheduledMessagesViewFilters,
): ScheduledMessage[] {
  const selectedCategories = new Set(filters.selectedCategories.map(normalizeToken).filter(Boolean));

  return messages.filter((message) => {
    if (filters.filterSelfOnly && isSelfOnlyScheduledMessage(message, filters.currentUsername)) {
      return false;
    }

    if (filters.filterPendingReview && message.Status !== 'PendingReview') {
      return false;
    }

    if (selectedCategories.size > 0) {
      const messageCategories = getScheduledMessageCategories(message.Category)
        .map(normalizeToken);
      const hasMatchingCategory = messageCategories.some((category) =>
        selectedCategories.has(category),
      );
      if (!hasMatchingCategory) {
        return false;
      }
    }

    return true;
  });
}

export function parseScheduledMessagesQueryFilters(
  search: string,
): ScheduledMessagesQueryFilters {
  const params = new URLSearchParams(search.startsWith('?') ? search : `?${search}`);
  const categoryValues = [
    ...params.getAll('category'),
    ...params.getAll('categories'),
  ];
  const categories = categoryValues
    .flatMap((value) => value.split(','))
    .map((value) => value.trim())
    .filter(Boolean);

  const targetMessageId = normalizeQueryValue(params.get('messageId') || params.get('targetMessageId'));

  return {
    categories: Array.from(new Set(categories)),
    filterPendingReview: parseBooleanParam(params.get('filterPendingReview')),
    filterSelfOnly: parseBooleanParam(params.get('filterSelfOnly')),
    configureRingCentralSender: parseBooleanParam(params.get('configureRingCentralSender')),
    ...(targetMessageId ? { targetMessageId } : {}),
  };
}
