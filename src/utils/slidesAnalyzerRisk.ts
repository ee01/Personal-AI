import type { ProjectUpdateSuggestion } from '../slide';
import type { JiraTicket } from '../types';

export type ProjectRiskLevel = 'critical' | 'high' | 'medium' | 'normal' | 'low';

const RISK_STATUS_KEYWORDS = [
  'risk',
  'at risk',
  'block',
  'blocker',
  'blocked',
  'blocking',
  'stuck',
  'delay',
  'delays',
  'delayed',
  'overdue',
  '风险',
  '阻塞',
  '卡住',
  '延期',
  '逾期'
];

const CLOSED_STATUS_KEYWORDS = [
  'done',
  'resolved',
  'closed',
  'complete',
  'completed',
  '完成',
  '已解决',
  '关闭'
];

const HIGH_PRIORITY_KEYWORDS = [
  'highest',
  'critical',
  'blocker',
  'high',
  '紧急',
  '最高',
  '高'
];

const NEGATED_RISK_PATTERNS = [
  /\b(no|not|without)\s+(known\s+)?(risk|risks|blocker|blockers|block|blocked|delay|delays|overdue|stuck)\b/gi,
  /\b(no|not|without)\s+(known\s+)?schedule\s+(risk|delay|delays)\b/gi,
  /\b(risk|risks|blocker|blockers|block|blocked|delay|delays)\s+(resolved|cleared|mitigated)\b/gi,
  /\b(unblocked|not blocked|not delayed)\b/gi,
  /无风险|没有风险|无阻塞|没有阻塞|风险已(解除|解决|消除)|阻塞已(解除|解决)/g,
];

const NEGATED_CLOSED_STATUS_PATTERNS = [
  /\b(not|never)\s+(done|resolved|closed|complete|completed)\b/i,
  /\b(unresolved|unclosed)\b/i,
  /未完成|未解决|未关闭|尚未完成|尚未解决/g,
];

function addUniqueEvidenceItem(items: string[], value: unknown): void {
  if (typeof value !== 'string') {
    return;
  }

  const trimmed = value.trim();
  if (!trimmed || items.includes(trimmed)) {
    return;
  }

  items.push(trimmed);
}

export function normalizeKeywordText(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fff]+/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function containsKeyword(value: string, keyword: string): boolean {
  const normalizedValue = normalizeKeywordText(value);
  const normalizedKeyword = normalizeKeywordText(keyword);

  if (!normalizedValue || !normalizedKeyword) {
    return false;
  }

  if (/[\u4e00-\u9fff]/.test(normalizedKeyword)) {
    return normalizedValue.includes(normalizedKeyword);
  }

  return ` ${normalizedValue} `.includes(` ${normalizedKeyword} `);
}

export function includesAnyKeyword(value: unknown, keywords: string[]): boolean {
  if (typeof value !== 'string') {
    return false;
  }

  return keywords.some((keyword) => containsKeyword(value, keyword));
}

export function removeNegatedRiskPhrases(value: string): string {
  return NEGATED_RISK_PATTERNS.reduce((current, pattern) => current.replace(pattern, ' '), value);
}

export function includesRiskKeyword(value: unknown): boolean {
  if (typeof value !== 'string') {
    return false;
  }

  return includesAnyKeyword(removeNegatedRiskPhrases(value), RISK_STATUS_KEYWORDS);
}

export function isClosedStatus(value: unknown): boolean {
  if (typeof value === 'string' && NEGATED_CLOSED_STATUS_PATTERNS.some((pattern) => pattern.test(value))) {
    return false;
  }

  return includesAnyKeyword(value, CLOSED_STATUS_KEYWORDS);
}

export function isPastDueDate(value: unknown, now = Date.now()): boolean {
  if (typeof value !== 'string' || !value.trim()) {
    return false;
  }

  const dueDate = new Date(`${value}T23:59:59`);
  if (Number.isNaN(dueDate.getTime())) {
    return false;
  }

  return dueDate.getTime() < now;
}

export function formatDisplayDate(dateString: string): string {
  if (!dateString) return '';

  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) {
    return dateString;
  }

  return date.toLocaleDateString('zh-CN');
}

export function hasHighPrioritySignal(value: unknown): boolean {
  return includesAnyKeyword(value, HIGH_PRIORITY_KEYWORDS);
}

export function isOpenJiraIssue(issue: Pick<JiraTicket, 'status'>): boolean {
  return !isClosedStatus(issue.status);
}

export function getRiskEvidenceItems(suggestion: ProjectUpdateSuggestion, now = Date.now()): string[] {
  const items: string[] = [];
  const statusText = [suggestion.currentStatus, suggestion.suggestedStatus].filter(Boolean).join(' -> ');

  if (includesRiskKeyword(statusText)) {
    addUniqueEvidenceItem(items, `状态提示风险: ${statusText}`);
  }

  suggestion.reason?.forEach((reason) => {
    if (includesRiskKeyword(reason)) {
      addUniqueEvidenceItem(items, reason);
    }
  });

  for (const issue of suggestion.sourceInfo?.jiraIssues || []) {
    const isOpenIssue = isOpenJiraIssue(issue);

    if (isOpenIssue && hasHighPrioritySignal(issue.priority)) {
      addUniqueEvidenceItem(items, `高优先级 Jira: ${issue.key} · ${issue.priority}`);
    }

    if (isOpenIssue && isPastDueDate(issue.duedate, now)) {
      addUniqueEvidenceItem(items, `已逾期 Jira: ${issue.key} · ${formatDisplayDate(issue.duedate)}`);
    }

    if (includesRiskKeyword(issue.status)) {
      addUniqueEvidenceItem(items, `Jira 状态提示风险: ${issue.key} · ${issue.status}`);
    }
  }

  return items.slice(0, 4);
}

export function isRiskSpotlightSuggestion(suggestion: ProjectUpdateSuggestion): boolean {
  return getRiskEvidenceItems(suggestion).length > 0;
}

export function normalizeProjectRiskLevel(riskLevel: unknown): ProjectRiskLevel | undefined {
  if (typeof riskLevel !== 'string') {
    return undefined;
  }

  const normalized = riskLevel.trim().toLowerCase();
  if (normalized === 'critical' || normalized === 'high' || normalized === 'medium' || normalized === 'normal' || normalized === 'low') {
    return normalized;
  }

  return undefined;
}

export function hasRiskLevelSignal(riskLevel: unknown): boolean {
  const normalized = normalizeProjectRiskLevel(riskLevel);
  return normalized === 'critical' || normalized === 'high';
}

export function hasAttentionRiskLevelSignal(riskLevel: unknown): boolean {
  const normalized = normalizeProjectRiskLevel(riskLevel);
  return normalized === 'medium' || normalized === 'normal';
}

export function hasProjectRiskSignal(input: {
  currentStatus?: unknown;
  suggestedStatus?: unknown;
  reasons?: unknown[];
  riskLevel?: unknown;
  jiraIssues?: JiraTicket[];
  now?: number;
}): boolean {
  if (hasRiskLevelSignal(input.riskLevel)) {
    return true;
  }

  const statusText = [input.currentStatus, input.suggestedStatus].filter(Boolean).join(' -> ');
  if (includesRiskKeyword(statusText)) {
    return true;
  }

  if ((input.reasons || []).some((reason) => includesRiskKeyword(reason))) {
    return true;
  }

  return (input.jiraIssues || []).some((issue) => (
    (isOpenJiraIssue(issue) && hasHighPrioritySignal(issue.priority)) ||
    includesRiskKeyword(issue.status) ||
    (isOpenJiraIssue(issue) && isPastDueDate(issue.duedate, input.now))
  ));
}
