import {
  getWatchRuleEligibilityIssues,
  type WatchRule,
  type WatchRuleMessageContext,
  type WatchRuleRef,
} from './watchRules';

export const MESSAGE_ANALYSIS_RULE_DIAGNOSTICS_KEY =
  'messageAnalysisRuleDiagnostics';

export type MessageAnalysisRuleDiagnosticStatus = 'scope_rejected';

export interface MessageAnalysisRuleDiagnostic {
  id: string;
  status: MessageAnalysisRuleDiagnosticStatus;
  ruleRef: WatchRuleRef;
  ruleText?: string;
  reason: string;
  reasons: string[];
  sender?: string;
  groupName?: string;
  groupId?: string;
  postId?: string;
  datetime?: string;
  matchedRule?: string;
  capturedAt: number;
}

const MAX_DIAGNOSTICS = 30;
const RETENTION_MS = 14 * 24 * 60 * 60 * 1000;

function getChromeStorage() {
  return globalThis.chrome?.storage?.local;
}

function normalizeDiagnostics(value: unknown): MessageAnalysisRuleDiagnostic[] {
  return Array.isArray(value)
    ? value.filter(
        (item): item is MessageAnalysisRuleDiagnostic =>
          Boolean(item) &&
          typeof item === 'object' &&
          typeof (item as MessageAnalysisRuleDiagnostic).ruleRef === 'string' &&
          typeof (item as MessageAnalysisRuleDiagnostic).capturedAt === 'number',
      )
    : [];
}

function getDiagnosticDedupeKey(item: MessageAnalysisRuleDiagnostic): string {
  return [
    item.status,
    item.ruleRef,
    item.postId || '',
    item.reason,
    item.sender || '',
    item.groupId || item.groupName || '',
  ].join('|');
}

export function getLatestRuleDiagnostic(
  diagnostics: MessageAnalysisRuleDiagnostic[],
  ruleRef: string,
): MessageAnalysisRuleDiagnostic | undefined {
  return diagnostics
    .filter((item) => item.ruleRef === ruleRef)
    .sort((a, b) => b.capturedAt - a.capturedAt)[0];
}

export async function appendMessageAnalysisRuleDiagnostics(
  entries: MessageAnalysisRuleDiagnostic[],
): Promise<void> {
  if (entries.length === 0) return;

  const storage = getChromeStorage();
  if (!storage) return;

  const now = Date.now();
  const result = await storage.get(MESSAGE_ANALYSIS_RULE_DIAGNOSTICS_KEY);
  const existing = normalizeDiagnostics(
    result[MESSAGE_ANALYSIS_RULE_DIAGNOSTICS_KEY],
  );
  const seen = new Set<string>();
  const next: MessageAnalysisRuleDiagnostic[] = [];

  [...entries, ...existing]
    .filter((item) => now - item.capturedAt <= RETENTION_MS)
    .forEach((item) => {
      const key = getDiagnosticDedupeKey(item);
      if (seen.has(key)) return;
      seen.add(key);
      next.push(item);
    });

  await storage.set({
    [MESSAGE_ANALYSIS_RULE_DIAGNOSTICS_KEY]: next.slice(0, MAX_DIAGNOSTICS),
  });
}

export async function recordRejectedManualRuleDiagnostics(params: {
  runtimeWatchRules: WatchRule[];
  matchedRuleRefs: string[];
  matchedRule?: string;
  messageContext: WatchRuleMessageContext;
  postId?: string;
  messageDatetime?: string;
}): Promise<void> {
  const capturedAt = Date.now();
  const entries = params.matchedRuleRefs
    .map((ruleRef) =>
      params.runtimeWatchRules.find((rule) => rule.ruleRef === ruleRef),
    )
    .filter((rule): rule is WatchRule => Boolean(rule))
    .filter((rule) => rule.source === 'manual')
    .map((rule): MessageAnalysisRuleDiagnostic => {
      const reasons = getWatchRuleEligibilityIssues(
        rule,
        params.messageContext,
      );
      return {
        id: `${rule.ruleRef}:${params.postId || 'unknown'}:${capturedAt}`,
        status: 'scope_rejected',
        ruleRef: rule.ruleRef,
        ruleText: rule.text,
        reason: reasons[0] || '未通过最终范围校验',
        reasons: reasons.length > 0 ? reasons : ['未通过最终范围校验'],
        sender: params.messageContext.sender || params.messageContext.creator,
        groupName: params.messageContext.groupName,
        groupId: params.messageContext.groupId,
        postId: params.postId,
        datetime: params.messageDatetime,
        matchedRule: params.matchedRule,
        capturedAt,
      };
    });

  try {
    await appendMessageAnalysisRuleDiagnostics(entries);
  } catch (error) {
    console.warn('写入记忆入口规则诊断失败:', error);
  }
}
