import type {
  MemoryScope,
  RecallScope,
  RecallScopeCounts,
  RecallScopeReceipt,
} from '../types/index.js';

export interface RecallScopeCountable {
  scope?: MemoryScope | null;
  metadata?: Record<string, unknown>;
}

export function normalizeRecallRequestScope(
  scope: RecallScope | undefined,
  fallback: RecallScope = 'work',
): RecallScope {
  return scope ?? fallback;
}

export function getEffectiveRecallScope(
  scope: RecallScope,
): MemoryScope | 'both' {
  return scope === 'all' || scope === 'both' ? 'both' : scope;
}

function normalizeCountableScope(value: unknown): MemoryScope | undefined {
  return value === 'work' || value === 'personal' ? value : undefined;
}

function getCountableScope(item: RecallScopeCountable): MemoryScope | undefined {
  return normalizeCountableScope(item.scope ?? item.metadata?.scope);
}

export function countRecallScopes(
  items: RecallScopeCountable[],
): RecallScopeCounts {
  return items.reduce<RecallScopeCounts>(
    (counts, item) => {
      const scope = getCountableScope(item);
      if (scope === 'work' || scope === 'personal') {
        counts[scope] += 1;
      } else {
        counts.unknown += 1;
      }
      counts.total += 1;
      return counts;
    },
    { work: 0, personal: 0, unknown: 0, total: 0 },
  );
}

export function formatRecallScopeNote(params: {
  requestedScope: RecallScope;
  effectiveScope: MemoryScope | 'both';
  returned: RecallScopeCounts;
  candidates: RecallScopeCounts;
}): string {
  const { requestedScope, effectiveScope, returned, candidates } = params;
  if (effectiveScope === 'work') {
    if (returned.total === 0) {
      return '本次主动召回默认仅检索工作记忆，未纳入个人记忆；如需跨域证据请切到全部。';
    }
    return '本次主动召回仅检索工作记忆，个人记忆未进入候选。';
  }
  if (effectiveScope === 'personal') {
    if (returned.total === 0) {
      return '本次主动召回仅检索个人记忆，未纳入工作记忆；如需跨域证据请切到全部。';
    }
    return '本次主动召回仅检索个人记忆，工作记忆未进入候选。';
  }

  const scopeName = requestedScope === 'both' ? '工作和个人记忆' : '全部记忆';
  if (returned.personal > 0) {
    return `本次主动召回检索${scopeName}，返回结果包含 ${returned.personal} 条个人记忆；引用到工作场景前请确认。`;
  }
  if (candidates.personal > 0) {
    return `本次主动召回检索${scopeName}，个人记忆只进入候选但未进入返回结果。`;
  }
  if (returned.total === 0) {
    return `本次主动召回检索${scopeName}，没有找到可返回记忆。`;
  }
  return `本次主动召回检索${scopeName}，当前返回结果未包含个人记忆。`;
}

export function buildRecallScopeReceiptFromCounts(params: {
  scope: RecallScope | undefined;
  returned: RecallScopeCounts;
  candidates: RecallScopeCounts;
  fallbackScope?: RecallScope;
}): RecallScopeReceipt {
  const requestedScope = normalizeRecallRequestScope(
    params.scope,
    params.fallbackScope ?? 'work',
  );
  const effectiveScope = getEffectiveRecallScope(requestedScope);
  return {
    requestedScope,
    effectiveScope,
    returned: params.returned,
    candidates: params.candidates,
    note: formatRecallScopeNote({
      requestedScope,
      effectiveScope,
      returned: params.returned,
      candidates: params.candidates,
    }),
    includesPersonal: params.returned.personal > 0,
  };
}

export function buildRecallScopeReceipt(params: {
  scope: RecallScope | undefined;
  returnedItems: RecallScopeCountable[];
  candidateItems: RecallScopeCountable[];
  fallbackScope?: RecallScope;
}): RecallScopeReceipt {
  return buildRecallScopeReceiptFromCounts({
    scope: params.scope,
    returned: countRecallScopes(params.returnedItems),
    candidates: countRecallScopes(params.candidateItems),
    fallbackScope: params.fallbackScope,
  });
}
