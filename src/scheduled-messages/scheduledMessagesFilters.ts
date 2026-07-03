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

export interface ScheduledMessagesFilterReceipt {
  title: string;
  summary: string;
  details: string[];
  tone: 'info' | 'warning';
  totalCount: number;
  visibleCount: number;
  hiddenCount: number;
}

export interface ScheduledMessagesTargetReceipt {
  title: string;
  summary: string;
  details: string[];
  tone: 'info' | 'warning';
}

type ScheduledMessagesFilterRejectionReason =
  | 'self_only'
  | 'not_pending_review'
  | 'category_mismatch';

interface ScheduledMessagesFilterReasonCounts {
  selfOnly: number;
  notPendingReview: number;
  categoryMismatch: number;
}

export interface ScheduledMessagesFilterConditionCounts extends ScheduledMessagesFilterReasonCounts {
  totalConditionMatches: number;
  overlappingHiddenCount: number;
}

function parseBooleanParam(value: string | null): boolean {
  return value === '1' || value === 'true' || value === 'yes';
}

function normalizeToken(value?: string): string {
  return (value || '').trim().toLowerCase();
}

function normalizeRecipientToken(value?: string): string {
  let token = (value || '').trim().toLowerCase();
  if (!token) {
    return '';
  }

  const angleAddressMatch = token.match(/<([^>]+)>/);
  if (angleAddressMatch?.[1]) {
    token = angleAddressMatch[1].trim();
  }

  if (token.includes('@')) {
    token = token.split('@')[0] || token;
  }

  return token
    .replace(/\s+/g, '.')
    .replace(/\.+/g, '.')
    .replace(/^\.+|\.+$/g, '');
}

function getRecipientIdentityTokens(value?: string): string[] {
  return (value || '')
    .split(/[+,]/)
    .map(normalizeRecipientToken)
    .filter(Boolean);
}

function formatRecipientIdentityExample(currentUsername: string): string {
  const normalizedCurrentUsername = normalizeRecipientToken(currentUsername);
  const displayName = normalizedCurrentUsername
    .split('.')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');

  return displayName && displayName.toLowerCase() !== normalizedCurrentUsername
    ? `${normalizedCurrentUsername} / ${displayName} / 邮箱本地名`
    : `${normalizedCurrentUsername} / 邮箱本地名`;
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
  const normalizedCurrentUsername = normalizeRecipientToken(currentUsername);
  if (!message.Glip_User_Name || !normalizedCurrentUsername) {
    return false;
  }

  const usernames = getRecipientIdentityTokens(message.Glip_User_Name);

  return usernames.length === 1 && usernames[0] === normalizedCurrentUsername;
}

export function hasScheduledMessagesViewFilters(filters: ScheduledMessagesViewFilters): boolean {
  return Boolean(
    filters.filterPendingReview ||
    filters.filterSelfOnly ||
    filters.selectedCategories.length > 0,
  );
}

function getSelectedCategorySet(filters: ScheduledMessagesViewFilters): Set<string> {
  return new Set(filters.selectedCategories.map(normalizeToken).filter(Boolean));
}

function getScheduledMessageFilterRejectionReason(
  message: ScheduledMessage,
  filters: ScheduledMessagesViewFilters,
  selectedCategories = getSelectedCategorySet(filters),
): ScheduledMessagesFilterRejectionReason | null {
  if (filters.filterSelfOnly && isSelfOnlyScheduledMessage(message, filters.currentUsername)) {
    return 'self_only';
  }

  if (filters.filterPendingReview && message.Status !== 'PendingReview') {
    return 'not_pending_review';
  }

  if (selectedCategories.size > 0) {
    const messageCategories = getScheduledMessageCategories(message.Category)
      .map(normalizeToken);
    const hasMatchingCategory = messageCategories.some((category) =>
      selectedCategories.has(category),
    );
    if (!hasMatchingCategory) {
      return 'category_mismatch';
    }
  }

  return null;
}

export function filterScheduledMessagesForView(
  messages: ScheduledMessage[],
  filters: ScheduledMessagesViewFilters,
): ScheduledMessage[] {
  const selectedCategories = getSelectedCategorySet(filters);

  return messages.filter((message) => {
    return !getScheduledMessageFilterRejectionReason(message, filters, selectedCategories);
  });
}

export function getScheduledMessagesFilterReasonCounts(
  messages: ScheduledMessage[],
  filters: ScheduledMessagesViewFilters,
): ScheduledMessagesFilterReasonCounts {
  const selectedCategories = getSelectedCategorySet(filters);
  return messages.reduce<ScheduledMessagesFilterReasonCounts>(
    (counts, message) => {
      const reason = getScheduledMessageFilterRejectionReason(
        message,
        filters,
        selectedCategories,
      );

      if (reason === 'self_only') {
        counts.selfOnly += 1;
      } else if (reason === 'not_pending_review') {
        counts.notPendingReview += 1;
      } else if (reason === 'category_mismatch') {
        counts.categoryMismatch += 1;
      }

      return counts;
    },
    {
      selfOnly: 0,
      notPendingReview: 0,
      categoryMismatch: 0,
    },
  );
}

export function getScheduledMessagesFilterConditionCounts(
  messages: ScheduledMessage[],
  filters: ScheduledMessagesViewFilters,
): ScheduledMessagesFilterConditionCounts {
  const selectedCategories = getSelectedCategorySet(filters);
  const currentUsername = filters.currentUsername?.trim();
  let visibleCount = 0;
  const counts = messages.reduce<ScheduledMessagesFilterReasonCounts>(
    (acc, message) => {
      let hasConditionMiss = false;

      if (filters.filterSelfOnly && currentUsername && isSelfOnlyScheduledMessage(message, currentUsername)) {
        acc.selfOnly += 1;
        hasConditionMiss = true;
      }

      if (filters.filterPendingReview && message.Status !== 'PendingReview') {
        acc.notPendingReview += 1;
        hasConditionMiss = true;
      }

      if (selectedCategories.size > 0) {
        const messageCategories = getScheduledMessageCategories(message.Category)
          .map(normalizeToken);
        const hasMatchingCategory = messageCategories.some((category) =>
          selectedCategories.has(category),
        );
        if (!hasMatchingCategory) {
          acc.categoryMismatch += 1;
          hasConditionMiss = true;
        }
      }

      if (!hasConditionMiss) {
        visibleCount += 1;
      }

      return acc;
    },
    {
      selfOnly: 0,
      notPendingReview: 0,
      categoryMismatch: 0,
    },
  );
  const hiddenCount = Math.max(0, messages.length - visibleCount);
  const totalConditionMatches = counts.selfOnly + counts.notPendingReview + counts.categoryMismatch;

  return {
    ...counts,
    totalConditionMatches,
    overlappingHiddenCount: Math.max(0, totalConditionMatches - hiddenCount),
  };
}

function formatSelectedCategories(values: string[]): string {
  return values.map((value) => value.trim()).filter(Boolean).join('、');
}

function getFilterScopeLabels(filters: ScheduledMessagesViewFilters): string[] {
  const selectedCategories = filters.selectedCategories.map((value) => value.trim()).filter(Boolean);
  return [
    filters.filterPendingReview ? '待审核' : '',
    filters.filterSelfOnly ? '隐藏仅发给我的消息' : '',
    selectedCategories.length > 0 ? `类别 ${formatSelectedCategories(selectedCategories)}` : '',
  ].filter(Boolean);
}

export function buildScheduledMessagesTargetReceipt(input: {
  targetMessageId: string;
  targetMessage: ScheduledMessage | null;
  filters: ScheduledMessagesViewFilters;
}): ScheduledMessagesTargetReceipt | null {
  const targetMessageId = input.targetMessageId.trim();
  if (!targetMessageId) {
    return null;
  }

  const { targetMessage, filters } = input;
  const currentUsername = filters.currentUsername?.trim();
  const selectedCategories = filters.selectedCategories.map((value) => value.trim()).filter(Boolean);
  const scopeLabels = getFilterScopeLabels(filters);

  if (!targetMessage) {
    return {
      title: '消息定位回执：目标未找到',
      summary: `消息 ${targetMessageId} 未在当前 Messages 表中找到。`,
      details: [
        `目标: Messages 行 ${targetMessageId}`,
        scopeLabels.length > 0
          ? `当前筛选: ${scopeLabels.join(' / ')}`
          : '当前筛选: 无额外筛选',
        '边界: 未找到目标时不会修改本地列表、Sheet 或执行状态',
        '恢复: 返回完整列表会清除 messageId 和筛选条件',
      ],
      tone: 'warning',
    };
  }

  const filterDiagnostics = [
    filters.filterPendingReview
      ? targetMessage.Status === 'PendingReview'
        ? '待审核条件: 目标匹配待审核筛选'
        : `待审核条件: 目标状态是 ${targetMessage.Status || '未知'}，普通待审核筛选会隐藏它`
      : '',
    filters.filterSelfOnly && currentUsername
      ? isSelfOnlyScheduledMessage(targetMessage, currentUsername)
        ? `个人提醒条件: 目标仅发给 ${currentUsername}，普通个人提醒筛选会隐藏它`
        : `个人提醒条件: 目标不是仅发给 ${currentUsername} 的个人提醒`
      : '',
    filters.filterSelfOnly && !currentUsername
      ? '个人提醒条件: 当前账号未识别，目标展示不依赖该条件'
      : '',
    selectedCategories.length > 0
      ? (() => {
          const targetCategories = getScheduledMessageCategories(targetMessage.Category);
          const normalizedTargetCategories = targetCategories.map(normalizeToken);
          const selectedSet = new Set(selectedCategories.map(normalizeToken));
          const hasMatch = normalizedTargetCategories.some((category) => selectedSet.has(category));
          const targetCategoryLabel = targetCategories.length > 0
            ? formatSelectedCategories(targetCategories)
            : '未分类';
          return hasMatch
            ? `类别条件: 目标类别 ${targetCategoryLabel}，匹配当前类别筛选`
            : `类别条件: 目标类别 ${targetCategoryLabel}，普通类别筛选会隐藏它`;
        })()
      : '',
  ].filter(Boolean);

  return {
    title: '消息定位回执',
    summary: `正在显示目标消息 ${targetMessageId}，当前状态 ${targetMessage.Status || '未知'}。`,
    details: [
      `目标: ${targetMessage.Topic || targetMessageId}`,
      scopeLabels.length > 0
        ? `覆盖筛选: ${scopeLabels.join(' / ')}`
        : '覆盖筛选: 无，当前只锁定目标消息',
      ...filterDiagnostics,
      '边界: 只是把目标行显示出来；不会批准、拒绝、暂停、删除、改期、发送或同步 Sheet',
      '恢复: 返回完整列表会清除 messageId 和筛选条件',
    ],
    tone: 'info',
  };
}

export function buildScheduledMessagesFilterReceipt(
  messages: ScheduledMessage[],
  filters: ScheduledMessagesViewFilters,
): ScheduledMessagesFilterReceipt | null {
  if (!hasScheduledMessagesViewFilters(filters)) {
    return null;
  }

  const visibleMessages = filterScheduledMessagesForView(messages, filters);
  const hiddenCount = Math.max(0, messages.length - visibleMessages.length);
  const conditionCounts = getScheduledMessagesFilterConditionCounts(messages, filters);
  const currentUsername = filters.currentUsername?.trim();
  const selectedCategories = filters.selectedCategories.map((value) => value.trim()).filter(Boolean);
  const activeScopes = getFilterScopeLabels(filters);
  const details = [
    `范围: ${activeScopes.join(' / ') || '全部消息'}`,
    filters.filterPendingReview
      ? `待审核条件: ${conditionCounts.notPendingReview} 条非待审核消息不满足当前筛选`
      : '',
    filters.filterSelfOnly && currentUsername
      ? `个人提醒条件: ${conditionCounts.selfOnly} 条仅发给 ${currentUsername} 的消息不满足当前筛选`
      : '',
    filters.filterSelfOnly && currentUsername
      ? `个人提醒识别: 按 ${formatRecipientIdentityExample(currentUsername)} 归一匹配；多人或群组消息不会被隐藏`
      : '',
    filters.filterSelfOnly && !currentUsername
      ? '个人提醒条件: 当前账号未识别，隐藏仅发给我的消息暂未生效'
      : '',
    selectedCategories.length > 0
      ? `类别条件: ${conditionCounts.categoryMismatch} 条消息没有匹配这些类别`
      : '',
    conditionCounts.overlappingHiddenCount > 0
      ? `重叠: 部分隐藏消息同时命中多个条件，各条件相加会比隐藏总数多 ${conditionCounts.overlappingHiddenCount} 次`
      : '',
    '边界: 筛选只改变当前列表，不会暂停、删除、改期或同步 Sheet',
  ].filter(Boolean);

  return {
    title: filters.filterSelfOnly && !currentUsername
      ? '列表筛选回执：需要账号信息'
      : '列表筛选回执',
    summary: `当前显示 ${visibleMessages.length}/${messages.length} 条，${hiddenCount} 条暂时隐藏。`,
    details,
    tone: filters.filterSelfOnly && !currentUsername ? 'warning' : 'info',
    totalCount: messages.length,
    visibleCount: visibleMessages.length,
    hiddenCount,
  };
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
