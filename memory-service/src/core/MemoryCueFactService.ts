import type {
  ContextCueSourceRef,
  ContextRecallMatch,
  MemoryCueFact,
  SceneFrame,
} from '../types/index.js';

const PERSON_DAYS_PATTERN =
  /人天|人日|person[-\s]?days?|person\s+day|mandays?|man[-\s]?days?/i;
const HOURS_PATTERN = /\b\d+(?:\.\d+)?\s*h(?:ours?)?\b|小时/i;
const ORIGINAL_ESTIMATE_PATTERN =
  /\boriginal\s+estimate\b|original_estimate|原始预估|原始估算|原\s*estimate/i;
const CLOSE_NO_HARD_REQUIREMENT_PATTERN =
  /close[^。.\n]{0,60}(?:no\s+hard|not\s+hard|required|requirement)|(?:close|关闭)[^。.\n]{0,60}(?:无硬性|没有硬性|不强制)/i;
const DUE_DATE_PATTERN =
  /\bdue\s+date\b|deadline|截止日期|到期时间|due\s+不|无需\s+due/i;

export class MemoryCueFactService {
  extractFactsForScene(
    sceneFrame: SceneFrame,
    matches: ContextRecallMatch[],
  ): MemoryCueFact[] {
    if (sceneFrame.sceneType !== 'jira_estimate') return [];
    const facts: MemoryCueFact[] = [];
    for (const match of matches) {
      facts.push(...extractEstimateFacts(match, sceneFrame));
    }
    return dedupeFacts(facts).slice(0, 12);
  }
}

function extractEstimateFacts(
  match: ContextRecallMatch,
  sceneFrame: SceneFrame,
): MemoryCueFact[] {
  const text = collectMatchFactText(match);
  if (!text) return [];

  const sourceRefs = [toSourceRef(match)];
  const facts: MemoryCueFact[] = [];
  const subject =
    sceneFrame.anchors.issueKey ||
    sceneFrame.anchors.projects?.[0] ||
    extractIssueKey(text) ||
    'Jira estimate';
  const confidenceBase = Math.max(0.52, Math.min(0.92, match.score || 0.62));

  if (PERSON_DAYS_PATTERN.test(text)) {
    facts.push({
      id: buildFactId(match, 'estimate.unit', 'person_days'),
      subject,
      predicate: 'estimate.unit',
      object: '人天',
      qualifiers: buildEstimateQualifiers(text),
      sceneTags: ['jira_estimate'],
      sourceRefs,
      confidence: roundConfidence(confidenceBase + 0.08),
    });
  }

  if (ORIGINAL_ESTIMATE_PATTERN.test(text)) {
    facts.push({
      id: buildFactId(match, 'jira.field', 'original_estimate'),
      subject,
      predicate: 'jira.field',
      object: 'original estimate',
      qualifiers: buildEstimateQualifiers(text),
      sceneTags: ['jira_estimate'],
      sourceRefs,
      confidence: roundConfidence(confidenceBase + 0.04),
    });
  }

  if (CLOSE_NO_HARD_REQUIREMENT_PATTERN.test(text)) {
    facts.push({
      id: buildFactId(match, 'close_policy', 'no_hard_requirement'),
      subject,
      predicate: 'close_policy',
      object: '无硬性 close 要求',
      sceneTags: ['jira_estimate', 'jira_issue_update'],
      sourceRefs,
      confidence: roundConfidence(confidenceBase),
    });
  }

  if (DUE_DATE_PATTERN.test(text)) {
    facts.push({
      id: buildFactId(match, 'due_date_policy', 'mentioned'),
      subject,
      predicate: 'due_date_policy',
      object: 'due date 需要单独确认',
      sceneTags: ['jira_estimate', 'jira_issue_update'],
      sourceRefs,
      confidence: roundConfidence(confidenceBase - 0.04),
    });
  }

  return facts;
}

function buildEstimateQualifiers(text: string): Record<string, string> | undefined {
  const qualifiers: Record<string, string> = {};
  if (HOURS_PATTERN.test(text)) {
    qualifiers.alternative = text.match(HOURS_PATTERN)?.[0] || 'hours';
  }
  if (ORIGINAL_ESTIMATE_PATTERN.test(text)) {
    qualifiers.field = 'original estimate';
  }
  return Object.keys(qualifiers).length ? qualifiers : undefined;
}

function collectMatchFactText(match: ContextRecallMatch): string {
  const metadata = match.metadata ?? {};
  return [
    match.title,
    match.uiSummary,
    match.snippet,
    match.sourceTitle,
    match.sourceLabel,
    typeof metadata.summary === 'string' ? metadata.summary : '',
    typeof metadata.replyAdvice === 'string' ? metadata.replyAdvice : '',
    typeof metadata.contextMessage === 'string' ? metadata.contextMessage : '',
    Array.isArray(metadata.actions) ? JSON.stringify(metadata.actions) : '',
    Array.isArray(metadata.contextMessages)
      ? JSON.stringify(metadata.contextMessages)
      : '',
    Array.isArray(metadata.messages) ? JSON.stringify(metadata.messages) : '',
  ]
    .filter(Boolean)
    .join('\n');
}

function toSourceRef(match: ContextRecallMatch): ContextCueSourceRef {
  return {
    type: match.type,
    id: match.id,
    title: match.sourceTitle || match.title,
    url: match.sourceUrl || match.links?.[0]?.url,
    timestamp: match.timestamp,
  };
}

function dedupeFacts(facts: MemoryCueFact[]): MemoryCueFact[] {
  const byKey = new Map<string, MemoryCueFact>();
  for (const fact of facts) {
    const key = `${fact.subject}:${fact.predicate}:${fact.object}`;
    const existing = byKey.get(key);
    if (!existing || fact.confidence > existing.confidence) {
      byKey.set(key, mergeSourceRefs(existing, fact));
    } else if (existing) {
      byKey.set(key, mergeSourceRefs(existing, fact));
    }
  }
  return Array.from(byKey.values()).sort(
    (left, right) => right.confidence - left.confidence,
  );
}

function mergeSourceRefs(
  existing: MemoryCueFact | undefined,
  next: MemoryCueFact,
): MemoryCueFact {
  if (!existing) return next;
  const refs = new Map<string, ContextCueSourceRef>();
  for (const ref of [...existing.sourceRefs, ...next.sourceRefs]) {
    refs.set(`${ref.type}:${ref.id}`, ref);
  }
  return {
    ...existing,
    confidence: Math.max(existing.confidence, next.confidence),
    qualifiers: {
      ...(existing.qualifiers ?? {}),
      ...(next.qualifiers ?? {}),
    },
    sourceRefs: Array.from(refs.values()).slice(0, 4),
  };
}

function extractIssueKey(text: string): string | undefined {
  return text.match(/\b[A-Z][A-Z0-9]+-\d+\b/)?.[0];
}

function buildFactId(
  match: ContextRecallMatch,
  predicate: string,
  object: string,
): string {
  return `cue-fact:${stableHash(`${match.type}:${match.id}:${predicate}:${object}`)}`;
}

function roundConfidence(value: number): number {
  return Number(Math.max(0.2, Math.min(0.95, value)).toFixed(2));
}

function stableHash(text: string): string {
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}
