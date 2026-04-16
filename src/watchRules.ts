import {
  getMemoryServiceClient,
  type OutreachSession,
  type OutreachSessionStatus,
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
  sessionId?: string;
  templateId?: string;
  sessionStatus?: OutreachSessionStatus;
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

function buildOutreachWatchRuleText(session: OutreachSession): string {
  const targetLabel = session.targetResolvedLabel || session.targetRef;
  const phaseHint =
    session.status === 'pending_approval' || session.status === 'scheduled'
      ? '如果消息已经给出这次主动询问想要的答案，可以视为发送前命中。'
      : '如果消息是在回应这次主动询问，或提供了相关证据/线索，请匹配本规则。';

  return [
    `【主动询问答复】目标对象是 ${targetLabel}。`,
    `这条规则对应一个进行中的主动询问：${session.renderedQuestion}`,
    phaseHint,
    '可匹配直接回答、补充说明、外部证据链接、需要继续查证的线索，或表示稍后回复/无法回答的反馈。',
  ]
    .filter(Boolean)
    .join(' ');
}

export function buildManualWatchRules(
  items: TopicItemWithAutoReply[],
): ManualWatchRule[] {
  return items.filter(isManualConcernedItem).map((item) => ({
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
    .map((session) => {
      const stableId = session.id || session.templateId;
      if (!stableId) {
        return null;
      }

      return {
        ruleRef: `outreach:${stableId}`,
        source: 'outreach',
        kind: 'outreach_answer_resolution',
        system: true,
        text: buildOutreachWatchRuleText(session),
        sessionId: session.id,
        templateId: session.templateId,
        sessionStatus: session.status,
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

export function buildRuntimeWatchRules(params: {
  manualItems: TopicItemWithAutoReply[];
  outreachSessions?: OutreachSession[];
}): WatchRule[] {
  const manualRules = buildManualWatchRules(params.manualItems);
  const outreachRules = buildOutreachWatchRules(params.outreachSessions || []);
  return [...manualRules, ...outreachRules];
}

export async function loadRuntimeWatchRules(
  manualItems: TopicItemWithAutoReply[],
): Promise<WatchRule[]> {
  try {
    const client = getMemoryServiceClient();
    const response = await client.getOutreachSessions({
      statuses: ACTIVE_OUTREACH_SESSION_STATUSES,
      limit: 200,
      offset: 0,
    });
    return buildRuntimeWatchRules({
      manualItems,
      outreachSessions: response.items || [],
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
}): ResolvedWatchRuleMatch {
  const { watchRules, matchedRule, matchedRuleRefs, matchedRuleIds } = params;
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
  const refsFromIds = resolvedIds
    .map((id) => manualRules[id]?.ruleRef)
    .filter((value): value is WatchRuleRef => typeof value === 'string');
  const finalRefs = uniqStrings([...resolvedRefs, ...refsFromIds]);

  const matchedRules = finalRefs
    .map((ruleRef) => watchRules.find((rule) => rule.ruleRef === ruleRef))
    .filter((rule): rule is WatchRule => Boolean(rule));

  if (matchedRules.length > 0) {
    return {
      watchRules: matchedRules,
      matchedRuleRefs: finalRefs,
      matchedRuleIds: resolvedIds,
    };
  }

  const fallbackMatch = fallbackMatchWatchRuleByText(matchedRule, watchRules);
  if (fallbackMatch) {
    return {
      watchRules: [fallbackMatch],
      matchedRuleRefs: [fallbackMatch.ruleRef],
      matchedRuleIds: resolvedIds,
    };
  }

  return {
    watchRules: [],
    matchedRuleRefs: finalRefs,
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
