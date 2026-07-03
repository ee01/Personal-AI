import {
  getMemoryServiceClient,
  type OutreachSession,
  type OutreachSessionStatus,
  type OutreachTemplateRuntimeStatusItem,
} from './services/MemoryServiceClient';
import type { TopicItemWithAutoReply } from './message-reaction/AutoReplyHandler';

export type WatchRuleRef = `manual:${string}` | `outreach:${string}`;

export interface WatchRuleBase {
  ruleRef: WatchRuleRef;
  source: 'manual' | 'outreach';
  kind: 'manual' | 'follow_thread' | 'outreach_answer_resolution';
  text: string;
  filterSender?: string;
  filterGroup?: string;
}

export interface ManualWatchRule extends WatchRuleBase {
  ruleRef: `manual:${string}`;
  source: 'manual';
  kind: 'manual' | 'follow_thread';
  manualItemId: string;
  manualItem: TopicItemWithAutoReply;
}

export interface OutreachWatchRule extends WatchRuleBase {
  ruleRef: `outreach:${string}`;
  source: 'outreach';
  kind: 'outreach_answer_resolution';
  system: true;
  runtimeScope: 'template' | 'session';
  sessionId?: string;
  templateId?: string;
  sessionStatus?: OutreachSessionStatus;
  templateSyncState?: string;
  baselineAt?: number;
  targetType: string;
  targetRef: string;
  targetLabel?: string;
  targetResolvedChatId?: string;
  sentChatId?: string;
  sentPostId?: string;
  renderedQuestion: string;
  renderedContext?: string;
}

export type WatchRule = ManualWatchRule | OutreachWatchRule;

export interface ResolvedWatchRuleMatch {
  watchRules: WatchRule[];
  matchedRuleRefs: string[];
  matchedRuleIds: number[];
}

export interface WatchRuleMessageContext {
  sender?: string;
  creator?: string;
  groupName?: string;
  teamName?: string;
  groupId?: string;
  teamId?: string;
  timestamp?: number | string;
  datetime?: string;
  time?: string;
  timestamps?: Array<number | string | undefined | null>;
}

export interface ConcernedItemsPartition {
  manualItems: TopicItemWithAutoReply[];
  systemItems: TopicItemWithAutoReply[];
}

export function isManualConcernedItem(
  item: TopicItemWithAutoReply & { source?: string },
): boolean {
  if (item?.source && item.source !== 'manual') {
    return false;
  }
  if (typeof item?.id === 'string' && item.id.startsWith('outreach:')) {
    return false;
  }
  return true;
}

export function partitionConcernedItems(
  items: TopicItemWithAutoReply[] = [],
): ConcernedItemsPartition {
  const manualItems: TopicItemWithAutoReply[] = [];
  const systemItems: TopicItemWithAutoReply[] = [];

  items.forEach((item) => {
    if (isManualConcernedItem(item)) {
      manualItems.push(item);
    } else {
      systemItems.push(item);
    }
  });

  return { manualItems, systemItems };
}

export function mergeManualConcernedItemsPreservingSystem(
  allItems: TopicItemWithAutoReply[] = [],
  manualItems: TopicItemWithAutoReply[] = [],
): TopicItemWithAutoReply[] {
  const { systemItems } = partitionConcernedItems(allItems);
  return [...manualItems, ...systemItems];
}

const ACTIVE_OUTREACH_SESSION_STATUSES: OutreachSessionStatus[] = [
  'pending_approval',
  'scheduled',
  'waiting_reply',
  'deferred',
];

function uniqStrings(values: Array<string | undefined | null>): string[] {
  return Array.from(
    new Set(
      values.filter(
        (value): value is string =>
          typeof value === 'string' && value.trim().length > 0,
      ),
    ),
  );
}

function normalizeText(value: string): string {
  return value.replace(/\s+/g, ' ').trim().toLowerCase();
}

function normalizeScopeValue(value: unknown): string {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function splitScopeValues(value: string | undefined): string[] {
  const normalizedValue = normalizeScopeValue(value);
  if (!normalizedValue) return [];
  return normalizedValue
    .split(/[\n,，、;；]+/)
    .map((part) => part.trim())
    .filter(Boolean);
}

function compactScopeValue(value: string): string {
  return value.replace(/[\s_-]+/g, '');
}

function tokenizeScopeValue(value: string): string[] {
  return value
    .split(/[^0-9a-zA-Z\u00c0-\uffff]+/)
    .map((part) => part.trim())
    .filter(Boolean);
}

function tokensContainSequence(actualTokens: string[], expectedTokens: string[]): boolean {
  if (expectedTokens.length === 0 || actualTokens.length < expectedTokens.length) {
    return false;
  }

  return actualTokens.some((_, startIndex) =>
    expectedTokens.every(
      (expectedToken, offset) => actualTokens[startIndex + offset] === expectedToken,
    ),
  );
}

function containsEastAsianText(value: string): boolean {
  return /[\u3040-\u30ff\u3400-\u9fff\uf900-\ufaff\uac00-\ud7af]/.test(
    value,
  );
}

function isSafeContainedScopeMatch(expected: string, actual: string): boolean {
  if (expected.length === 0 || actual.length === 0) return false;
  if (!containsEastAsianText(expected) && !containsEastAsianText(actual)) {
    return false;
  }
  return expected.length >= 2 && actual.includes(expected);
}

function valuesMatchScope(expected: string | undefined, actualValues: unknown[]): boolean {
  const expectedScopes = splitScopeValues(expected);
  if (expectedScopes.length === 0) return true;

  return actualValues.some((value) => {
    const normalizedActual = normalizeScopeValue(value);
    const compactActual = compactScopeValue(normalizedActual);
    const actualTokens = tokenizeScopeValue(normalizedActual);
    if (normalizedActual.length === 0) return false;

    return expectedScopes.some((normalizedExpected) => {
      const compactExpected = compactScopeValue(normalizedExpected);
      const expectedTokens = tokenizeScopeValue(normalizedExpected);
      return (
        normalizedActual === normalizedExpected ||
        (compactActual.length > 0 &&
          compactExpected.length > 0 &&
          compactActual === compactExpected) ||
        tokensContainSequence(actualTokens, expectedTokens) ||
        isSafeContainedScopeMatch(normalizedExpected, normalizedActual)
      );
    });
  });
}

function formatScopeDiagnosticList(value: string | undefined): string {
  const values = String(value || '')
    .replace(/\s+/g, ' ')
    .trim()
    .split(/[\n,，、;；]+/)
    .map((part) => part.trim())
    .filter(Boolean);
  if (values.length === 0) return '不限';
  return values.join(' 或 ');
}

function formatActualScopeValues(values: unknown[]): string {
  const normalized = uniqStrings(
    values.map((value) => {
      const text = String(value || '').trim();
      return text || undefined;
    }),
  );
  return normalized.length > 0 ? normalized.join(' / ') : '未提供上下文';
}

function getContextGroupValues(context?: WatchRuleMessageContext): unknown[] {
  return [context?.groupId, context?.teamId, context?.groupName, context?.teamName];
}

function getContextSenderValues(context?: WatchRuleMessageContext): unknown[] {
  return [context?.sender, context?.creator];
}

function hasScopeValues(values: unknown[]): boolean {
  return values.some((value) => normalizeScopeValue(value).length > 0);
}

function normalizeEpochToMillis(value: unknown): number | null {
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return null;
    return value > 1_000_000_000_000 ? value : value * 1000;
  }

  if (typeof value !== 'string' || !value.trim()) {
    return null;
  }

  const trimmed = value.trim();
  const numeric = Number(trimmed);
  if (Number.isFinite(numeric) && /^[+-]?\d+(\.\d+)?$/.test(trimmed)) {
    return normalizeEpochToMillis(numeric);
  }

  const parsed = Date.parse(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

function getContextMessageTimes(context?: WatchRuleMessageContext): number[] {
  if (!context) return [];

  return [
    context.timestamp,
    context.datetime,
    context.time,
    ...(context.timestamps || []),
  ]
    .map(normalizeEpochToMillis)
    .filter((value): value is number => value !== null);
}

function isOutreachRuleInsideObservationWindow(
  rule: OutreachWatchRule,
  context?: WatchRuleMessageContext,
): boolean {
  const baselineAt = normalizeEpochToMillis(rule.baselineAt);
  if (baselineAt === null) return true;

  const messageTimes = getContextMessageTimes(context);
  if (messageTimes.length === 0) return true;

  return messageTimes.some((messageTime) => messageTime >= baselineAt);
}

export function isWatchRuleEligibleForMessage(
  rule: WatchRule,
  context?: WatchRuleMessageContext,
): boolean {
  if (!context) return true;

  if (rule.source === 'manual') {
    const senderValues = getContextSenderValues(context);
    if (
      rule.filterSender &&
      hasScopeValues(senderValues) &&
      !valuesMatchScope(rule.filterSender, senderValues)
    ) {
      return false;
    }

    const groupValues = getContextGroupValues(context);
    if (
      rule.filterGroup &&
      hasScopeValues(groupValues) &&
      !valuesMatchScope(rule.filterGroup, groupValues)
    ) {
      return false;
    }

    return true;
  }

  if (!isOutreachRuleInsideObservationWindow(rule, context)) {
    return false;
  }

  const contextGroupIds = [context.groupId, context.teamId]
    .map(normalizeScopeValue)
    .filter(Boolean);
  const strictTargetIds = [rule.sentChatId, rule.targetResolvedChatId]
    .map(normalizeScopeValue)
    .filter(Boolean);

  if (strictTargetIds.length > 0 && contextGroupIds.length > 0) {
    return contextGroupIds.some((groupId) => strictTargetIds.includes(groupId));
  }

  const targetLabels = [rule.targetLabel, rule.targetRef].filter(
    (value): value is string => typeof value === 'string' && value.trim().length > 0,
  );
  if (targetLabels.length > 0 && getContextGroupValues(context).some(Boolean)) {
    return targetLabels.some((target) =>
      valuesMatchScope(target, getContextGroupValues(context)),
    );
  }

  return true;
}

export function getWatchRuleEligibilityIssues(
  rule: WatchRule,
  context?: WatchRuleMessageContext,
): string[] {
  if (!context) return [];

  const issues: string[] = [];

  if (rule.source === 'manual') {
    const senderValues = getContextSenderValues(context);
    if (
      rule.filterSender &&
      hasScopeValues(senderValues) &&
      !valuesMatchScope(rule.filterSender, senderValues)
    ) {
      issues.push(
        `发送人不在范围：期望 ${formatScopeDiagnosticList(
          rule.filterSender,
        )}，实际 ${formatActualScopeValues(senderValues)}`,
      );
    }

    const groupValues = getContextGroupValues(context);
    if (
      rule.filterGroup &&
      hasScopeValues(groupValues) &&
      !valuesMatchScope(rule.filterGroup, groupValues)
    ) {
      issues.push(
        `群组不在范围：期望 ${formatScopeDiagnosticList(
          rule.filterGroup,
        )}，实际 ${formatActualScopeValues(groupValues)}`,
      );
    }

    return issues;
  }

  if (!isOutreachRuleInsideObservationWindow(rule, context)) {
    issues.push('消息早于系统观察起点');
  }

  if (!isWatchRuleEligibleForMessage(rule, context) && issues.length === 0) {
    issues.push('目标群组不在系统观察范围');
  }

  return issues;
}

export function filterWatchRulesForMessageContext(
  watchRules: WatchRule[],
  context?: WatchRuleMessageContext,
): WatchRule[] {
  return watchRules.filter((rule) => isWatchRuleEligibleForMessage(rule, context));
}

export function filterWatchRulesForMessageGroups(
  watchRules: WatchRule[],
  groups: WatchRuleMessageContext[] = [],
): WatchRule[] {
  if (groups.length === 0) return watchRules;
  return watchRules.filter((rule) =>
    groups.some((group) => isWatchRuleEligibleForMessage(rule, group)),
  );
}

function buildOutreachWatchRuleText(params: {
  question: string;
  targetLabel: string;
  phase: 'before_dispatch' | 'active_session';
}): string {
  const phaseHint =
    params.phase === 'before_dispatch'
      ? '如果消息已经给出这次主动询问想要的答案，可以视为发送前命中。'
      : '如果消息是在回应这次主动询问，或提供了相关证据/线索，请匹配本规则。';

  return [
    `【主动询问答复】目标对象是 ${params.targetLabel}。`,
    `这条规则对应一个进行中的主动询问：${params.question}`,
    phaseHint,
    '可匹配直接回答、补充说明、外部证据链接、需要继续查证的线索，或表示稍后回复/无法回答的反馈。',
  ]
    .filter(Boolean)
    .join(' ');
}

export function buildManualWatchRules(
  items: TopicItemWithAutoReply[],
): ManualWatchRule[] {
  return items
    .filter(isManualConcernedItem)
    .filter((item) => {
      const expiredAt = normalizeEpochToMillis(item.expiredAt);
      return expiredAt === null || expiredAt <= 0 || expiredAt > Date.now();
    })
    .map((item) => ({
      ruleRef: `manual:${item.id}`,
      source: 'manual',
      kind: item.followThread && item.followConfig ? 'follow_thread' : 'manual',
      text: item.text || '',
      filterSender: item.filterSender,
      filterGroup: item.filterGroup,
      manualItemId: item.id,
      manualItem: item,
    }));
}

export function isOutreachAnswerResolutionSession(
  session: OutreachSession,
): boolean {
  return (
    ACTIVE_OUTREACH_SESSION_STATUSES.includes(session.status) &&
    Boolean(session.renderedQuestion?.trim()) &&
    Boolean(
      session.sentChatId ||
      session.targetResolvedChatId ||
      session.targetRef?.trim(),
    )
  );
}

export function buildOutreachWatchRules(
  sessions: OutreachSession[],
): OutreachWatchRule[] {
  return sessions
    .filter(isOutreachAnswerResolutionSession)
    .map<OutreachWatchRule | null>((session) => {
      const stableId = session.id || session.templateId;
      if (!stableId) {
        return null;
      }

      return {
        ruleRef: `outreach:${stableId}`,
        source: 'outreach',
        kind: 'outreach_answer_resolution',
        system: true,
        runtimeScope: 'session',
        text: buildOutreachWatchRuleText({
          question: session.renderedQuestion,
          targetLabel: session.targetResolvedLabel || session.targetRef,
          phase:
            session.status === 'pending_approval' || session.status === 'scheduled'
              ? 'before_dispatch'
              : 'active_session',
        }),
        sessionId: session.id,
        templateId: session.templateId,
        sessionStatus: session.status,
        baselineAt: session.createdAt,
        targetType: session.targetType,
        targetRef: session.targetRef,
        targetLabel: session.targetResolvedLabel || session.targetRef,
        targetResolvedChatId: session.targetResolvedChatId,
        sentChatId: session.sentChatId,
        sentPostId: session.sentPostId,
        renderedQuestion: session.renderedQuestion,
        renderedContext: session.renderedContext,
      } satisfies OutreachWatchRule;
    })
    .filter((rule): rule is OutreachWatchRule => rule !== null);
}

function isSyncedOutreachTemplate(
  item: OutreachTemplateRuntimeStatusItem,
): boolean {
  return (
    item.template.enabled !== false &&
    item.template.syncState === 'synced' &&
    Boolean(item.template.questionTemplate?.trim()) &&
    Boolean(item.template.targetRef?.trim())
  );
}

export function buildOutreachWatchRulesFromRuntimeStatus(
  items: OutreachTemplateRuntimeStatusItem[],
): OutreachWatchRule[] {
  return items
    .map((item) => {
      const activeSession =
        item.latestSession && isOutreachAnswerResolutionSession(item.latestSession)
          ? item.latestSession
          : null;
      if (activeSession) {
        const [rule] = buildOutreachWatchRules([activeSession]);
        return rule ?? null;
      }

      if (!isSyncedOutreachTemplate(item)) {
        return null;
      }

      const templateId = item.template.id;
      const targetLabel = item.template.targetRef || '未知目标';

      return {
        ruleRef: `outreach:template:${templateId}`,
        source: 'outreach',
        kind: 'outreach_answer_resolution',
        system: true,
        runtimeScope: 'template',
        text: buildOutreachWatchRuleText({
          question:
            item.template.questionTemplate || item.template.title || '待补充问题',
          targetLabel,
          phase: 'before_dispatch',
        }),
        templateId,
        templateSyncState: item.template.syncState,
        baselineAt: item.template.createdAt,
        targetType: item.template.targetType || 'group',
        targetRef: item.template.targetRef || '',
        targetLabel,
        renderedQuestion:
          item.template.questionTemplate || item.template.title || '',
        renderedContext: item.template.contextTemplate,
      } satisfies OutreachWatchRule;
    })
    .filter((rule): rule is OutreachWatchRule => rule !== null);
}

export function buildRuntimeWatchRules(params: {
  manualItems: TopicItemWithAutoReply[];
  outreachSessions?: OutreachSession[];
  outreachRuntimeItems?: OutreachTemplateRuntimeStatusItem[];
}): WatchRule[] {
  const manualRules = buildManualWatchRules(params.manualItems);
  const outreachRules = params.outreachRuntimeItems
    ? buildOutreachWatchRulesFromRuntimeStatus(params.outreachRuntimeItems)
    : buildOutreachWatchRules(params.outreachSessions || []);
  return [...manualRules, ...outreachRules];
}

export async function loadRuntimeWatchRules(
  manualItems: TopicItemWithAutoReply[],
): Promise<WatchRule[]> {
  try {
    const client = getMemoryServiceClient();
    const response = await client.getOutreachTemplateRuntimeStatus(
      undefined,
      200,
    );
    return buildRuntimeWatchRules({
      manualItems,
      outreachRuntimeItems: response.items || [],
    });
  } catch (error) {
    console.warn(
      'Failed to load runtime outreach watch rules, falling back to manual rules only:',
      error,
    );
    return buildRuntimeWatchRules({ manualItems });
  }
}

export function extractRuleRefsFromMatchedRule(matchedRule: string): string[] {
  if (!matchedRule) return [];

  const refs: string[] = [];
  let match: RegExpExecArray | null;

  const bracketRegex = /\[RULE_REF:([^\]\s]+)\]/g;
  while ((match = bracketRegex.exec(matchedRule)) !== null) {
    refs.push(match[1]);
  }

  const plainRegex = /(?<!\[)RULE_REF:([^\]\s]+)(?!\])/g;
  while ((match = plainRegex.exec(matchedRule)) !== null) {
    refs.push(match[1]);
  }

  return uniqStrings(refs);
}

export function extractRuleIdsFromMatchedRule(matchedRule: string): number[] {
  if (!matchedRule) return [];

  const ids: number[] = [];
  let match: RegExpExecArray | null;

  const bracketRegex = /\[RULE_ID:(\d+)\]/g;
  while ((match = bracketRegex.exec(matchedRule)) !== null) {
    ids.push(parseInt(match[1], 10));
  }

  const plainRegex = /(?<!\[)RULE_ID:(\d+)(?!\])/g;
  while ((match = plainRegex.exec(matchedRule)) !== null) {
    const id = parseInt(match[1], 10);
    if (!ids.includes(id)) {
      ids.push(id);
    }
  }

  return ids;
}

function fallbackMatchWatchRuleByText(
  matchedRule: string | undefined,
  watchRules: WatchRule[],
): WatchRule | undefined {
  if (!matchedRule) return undefined;

  const exactMatch = watchRules.find(
    (rule) =>
      matchedRule.includes(rule.text) || rule.text.includes(matchedRule),
  );
  if (exactMatch) {
    return exactMatch;
  }

  const normalizedMatchedRule = normalizeText(matchedRule);
  return watchRules.find((rule) => {
    const normalizedRuleText = normalizeText(rule.text);
    return (
      normalizedMatchedRule.includes(normalizedRuleText) ||
      normalizedRuleText.includes(normalizedMatchedRule)
    );
  });
}

export function resolveMatchedWatchRules(params: {
  watchRules: WatchRule[];
  matchedRule?: string;
  matchedRuleRefs?: string[];
  matchedRuleIds?: number[];
  messageContext?: WatchRuleMessageContext;
}): ResolvedWatchRuleMatch {
  const {
    watchRules,
    matchedRule,
    matchedRuleRefs,
    matchedRuleIds,
    messageContext,
  } = params;
  const manualRules = watchRules.filter(
    (rule): rule is ManualWatchRule => rule.source === 'manual',
  );
  const refsFromText = extractRuleRefsFromMatchedRule(matchedRule || '');
  const idsFromText = extractRuleIdsFromMatchedRule(matchedRule || '');
  const resolvedRefs = uniqStrings([
    ...(matchedRuleRefs || []),
    ...refsFromText,
  ]);
  const resolvedIds = Array.from(
    new Set([...(matchedRuleIds || []), ...idsFromText]),
  );

  if (resolvedRefs.length > 0) {
    const matchedRules = resolvedRefs
      .map((ruleRef) => watchRules.find((rule) => rule.ruleRef === ruleRef))
      .filter((rule): rule is WatchRule => Boolean(rule))
      .filter((rule) => isWatchRuleEligibleForMessage(rule, messageContext));

    if (matchedRules.length > 0) {
      return {
        watchRules: matchedRules,
        matchedRuleRefs: matchedRules.map((rule) => rule.ruleRef),
        matchedRuleIds: resolvedIds,
      };
    }

    return {
      watchRules: [],
      matchedRuleRefs: resolvedRefs,
      matchedRuleIds: resolvedIds,
    };
  }

  const fallbackMatch = fallbackMatchWatchRuleByText(matchedRule, watchRules);
  if (
    fallbackMatch &&
    isWatchRuleEligibleForMessage(fallbackMatch, messageContext)
  ) {
    return {
      watchRules: [fallbackMatch],
      matchedRuleRefs: [fallbackMatch.ruleRef],
      matchedRuleIds: resolvedIds,
    };
  }

  const refsFromIds = resolvedIds
    .map((id) => manualRules[id]?.ruleRef)
    .filter((value): value is `manual:${string}` => typeof value === 'string');
  const matchedRules = refsFromIds
    .map((ruleRef) => watchRules.find((rule) => rule.ruleRef === ruleRef))
    .filter((rule): rule is WatchRule => Boolean(rule))
    .filter((rule) => isWatchRuleEligibleForMessage(rule, messageContext));

  if (matchedRules.length > 0) {
    return {
      watchRules: matchedRules,
      matchedRuleRefs: matchedRules.map((rule) => rule.ruleRef),
      matchedRuleIds: resolvedIds,
    };
  }

  return {
    watchRules: [],
    matchedRuleRefs: refsFromIds,
    matchedRuleIds: resolvedIds,
  };
}

export function getManualItemsFromMatchedRules(
  watchRules: WatchRule[],
): TopicItemWithAutoReply[] {
  return watchRules
    .filter((rule): rule is ManualWatchRule => rule.source === 'manual')
    .map((rule) => rule.manualItem);
}

export function getFirstManualItemFromMatchedRules(
  watchRules: WatchRule[],
): TopicItemWithAutoReply | undefined {
  return getManualItemsFromMatchedRules(watchRules)[0];
}
