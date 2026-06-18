import type {
  ContextRecallInteractionSurface,
  ContextRecallRequest,
  ContextRecallVisibleFact,
  SceneFrame,
  SceneFrameFieldHint,
  SceneFrameIntent,
  SceneFrameSurface,
  SceneFrameType,
} from '../types/index.js';

const ISSUE_KEY_PATTERN = /\b[A-Z][A-Z0-9]+-\d+\b/;
const ESTIMATE_PATTERN =
  /\b(?:estimate|estimated|estimation|story\s*points?|sp|original\s+estimate)\b|估算|预估|工时|人天|人日/i;
const ORIGINAL_ESTIMATE_PATTERN =
  /\boriginal\s+estimate\b|original_estimate|原始预估|原始估算|原\s*estimate/i;
const DUE_DATE_PATTERN = /\bdue\s+date\b|deadline|截止|到期|日期/i;
const STATUS_PATTERN = /\bstatus\b|状态|ready|done|blocked|review/i;
const ASSIGNEE_PATTERN = /\bassignee|owner\b|负责人|owner/i;
const CLOSE_POLICY_PATTERN =
  /\bclose\b.*\b(?:policy|requirement|required)\b|关闭|close\s*无|无硬性要求/i;

export class SceneFrameService {
  fromContextRecallRequest(
    request: ContextRecallRequest,
    normalizedQuery = '',
  ): SceneFrame {
    const texts = collectSceneTexts(request, normalizedQuery);
    const combined = texts.join('\n');
    const fieldHints = extractFieldHints(combined);
    const anchors = extractAnchors(request, combined);
    const surface = mapSurface(request.surface, request.interactionScene?.surface);
    const sceneType = inferSceneType(request, combined, fieldHints);
    const userIntent = inferUserIntent(request, combined, fieldHints);

    return {
      sceneType,
      surface,
      anchors,
      fieldHints: fieldHints.length ? fieldHints : undefined,
      userIntent,
      interactionSceneType: request.interactionScene?.sceneType,
      userMode: request.interactionScene?.userMode,
      visibleFacts: collectVisibleFacts(request),
      admission: request.interactionScene?.admission,
      riskLevel: inferRiskLevel(surface, sceneType, combined),
    };
  }
}

function mapSurface(
  surface: string,
  interactionSurface?: ContextRecallInteractionSurface,
): SceneFrameSurface {
  if (interactionSurface === 'compose_assist') return 'compose_assist';
  if (interactionSurface === 'meeting_pilot') return 'meeting_pilot';
  if (interactionSurface === 'ask') return 'ask';
  if (surface === 'composer_guard') return 'compose_assist';
  if (surface === 'meeting_passive' || surface === 'meeting_prep') {
    return 'meeting_pilot';
  }
  return 'memory_lens';
}

function collectSceneTexts(
  request: ContextRecallRequest,
  normalizedQuery: string,
): string[] {
  return [
    normalizedQuery,
    request.title,
    request.url,
    request.primaryText,
    ...(request.secondaryTexts ?? []),
    request.sourceContext?.title,
    request.sourceContext?.topic,
    request.sourceContext?.url,
    request.sourceContext?.issueKey,
    request.interactionScene?.sceneType,
    request.interactionScene?.userMode,
    request.interactionScene?.title,
    request.interactionScene?.url,
    request.interactionScene?.issueKey,
    request.interactionScene?.conversationId,
    request.interactionScene?.groupId,
    request.interactionScene?.activeElement?.label,
    request.interactionScene?.activeElement?.placeholder,
    request.interactionScene?.activeElement?.nearbyText,
    request.interactionScene?.activeElement?.containerLabel,
    request.interactionScene?.draftText,
    request.interactionScene?.selectedText,
    ...(request.interactionScene?.participants ?? []),
    ...(request.interactionScene?.sourceAnchorHints ?? []),
    ...(request.interactionScene?.visibleFacts ?? []).map((fact) =>
      [fact.name, fact.value, fact.rawText].filter(Boolean).join(': '),
    ),
    ...(request.interactionScene?.nearbyMessages ?? []).map((message) =>
      [message.sender, message.text].filter(Boolean).join(': '),
    ),
    ...(request.sourceContext?.participants ?? []),
    ...(request.entityHints ?? []).map((hint) => `${hint.kind}: ${hint.value}`),
    ...(request.currentContext?.sourceAnchorHints ?? []),
    ...(request.currentContext?.visibleMessages ?? []).map((message) =>
      [message.sender, message.text].filter(Boolean).join(': '),
    ),
  ].filter((value): value is string => Boolean(value && value.trim()));
}

function extractFieldHints(text: string): SceneFrameFieldHint[] {
  const hints: SceneFrameFieldHint[] = [];
  addFieldHint(hints, text, 'estimate', ESTIMATE_PATTERN, 0.74);
  addFieldHint(
    hints,
    text,
    'original_estimate',
    ORIGINAL_ESTIMATE_PATTERN,
    0.88,
  );
  addFieldHint(hints, text, 'due_date', DUE_DATE_PATTERN, 0.62);
  addFieldHint(hints, text, 'status', STATUS_PATTERN, 0.58);
  addFieldHint(hints, text, 'assignee', ASSIGNEE_PATTERN, 0.58);
  addFieldHint(hints, text, 'close_policy', CLOSE_POLICY_PATTERN, 0.7);
  return dedupeFieldHints(hints);
}

function addFieldHint(
  hints: SceneFrameFieldHint[],
  text: string,
  field: SceneFrameFieldHint['field'],
  pattern: RegExp,
  confidence: number,
): void {
  const match = text.match(pattern);
  if (!match) return;
  hints.push({
    field,
    rawText: clipSceneText(match[0], 80),
    confidence,
  });
}

function dedupeFieldHints(
  hints: SceneFrameFieldHint[],
): SceneFrameFieldHint[] {
  const byField = new Map<string, SceneFrameFieldHint>();
  for (const hint of hints) {
    const existing = byField.get(hint.field);
    if (!existing || hint.confidence > existing.confidence) {
      byField.set(hint.field, hint);
    }
  }
  return Array.from(byField.values());
}

function extractAnchors(
  request: ContextRecallRequest,
  text: string,
): SceneFrame['anchors'] {
  const issueKey =
    request.interactionScene?.issueKey ||
    request.sourceContext?.issueKey ||
    request.entityHints?.find((hint) => /jira|issue/i.test(hint.kind))?.value ||
    text.match(ISSUE_KEY_PATTERN)?.[0];
  const conversationId =
    request.interactionScene?.conversationId ||
    request.sourceContext?.conversationId ||
    request.currentContext?.conversationId ||
    request.entityHints?.find((hint) => /conversation/i.test(hint.kind))?.value;
  const groupId =
    request.interactionScene?.groupId ||
    request.sourceContext?.groupId ||
    request.currentContext?.groupId ||
    request.entityHints?.find((hint) => /group/i.test(hint.kind))?.value;

  const projects = new Set<string>();
  if (issueKey) projects.add(issueKey.split('-')[0]);
  for (const hint of request.entityHints ?? []) {
    if (/project|jira|issue/i.test(hint.kind)) {
      const value = normalizeAnchor(hint.value);
      if (value) projects.add(value);
    }
  }

  const people = new Set<string>();
  for (const name of [
    ...(request.interactionScene?.participants ?? []),
    ...(request.sourceContext?.participants ?? []),
  ]) {
    const value = normalizeAnchor(name);
    if (value) people.add(value);
  }
  for (const hint of request.entityHints ?? []) {
    if (/person|participant|sender/i.test(hint.kind)) {
      const value = normalizeAnchor(hint.value);
      if (value) people.add(value);
    }
  }

  const source = new Set<string>();
  for (const value of [
    request.sourceContext?.host,
    request.sourceContext?.sourceType,
    request.sourceContext?.groupId,
    request.sourceContext?.conversationId,
    request.sourceContext?.meetingId,
    issueKey,
  ]) {
    const normalized = normalizeAnchor(value);
    if (normalized) source.add(normalized);
  }

  const topics = new Set<string>();
  for (const hint of request.entityHints ?? []) {
    if (!/person|participant|sender|project|jira|issue|group|conversation/i.test(hint.kind)) {
      const value = normalizeAnchor(hint.value);
      if (value) topics.add(value);
    }
  }
  if (ESTIMATE_PATTERN.test(text)) topics.add('estimate');

  return {
    people: people.size ? Array.from(people).slice(0, 8) : undefined,
    projects: projects.size ? Array.from(projects).slice(0, 8) : undefined,
    topics: topics.size ? Array.from(topics).slice(0, 8) : undefined,
    source: source.size ? Array.from(source).slice(0, 8) : undefined,
    issueKey: normalizeAnchor(issueKey),
    conversationId: normalizeAnchor(conversationId),
    groupId: normalizeAnchor(groupId),
  };
}

function inferSceneType(
  request: ContextRecallRequest,
  text: string,
  fieldHints: SceneFrameFieldHint[],
): SceneFrameType {
  const hasIssueAnchor =
    request.contextType === 'jira_issue' ||
    Boolean(request.sourceContext?.issueKey) ||
    ISSUE_KEY_PATTERN.test(text);
  const hasEstimateField = fieldHints.some(
    (hint) => hint.field === 'estimate' || hint.field === 'original_estimate',
  );
  if (hasIssueAnchor && hasEstimateField) return 'jira_estimate';
  if (hasIssueAnchor) return 'jira_issue_update';
  if (request.surface === 'composer_guard' && request.contextType === 'message_thread') {
    return 'ringcentral_reply';
  }
  if (request.contextType === 'meeting') return 'meeting_live';
  if (request.sourceContext?.contextType === 'web_agent_prompt') {
    return 'external_ai_prompt';
  }
  if (request.contextType === 'webpage') return 'web_reading';
  return 'unknown';
}

function inferUserIntent(
  request: ContextRecallRequest,
  text: string,
  fieldHints: SceneFrameFieldHint[],
): SceneFrameIntent {
  const userMode = request.interactionScene?.userMode;
  if (userMode === 'comment' || userMode === 'reply') return 'reply';
  if (userMode === 'compose') return 'reply';
  if (userMode === 'read' || userMode === 'select_text') return 'read';
  if (request.surface === 'composer_guard') return 'reply';
  if (
    request.contextType === 'jira_issue' &&
    fieldHints.some((hint) => hint.field === 'estimate' || hint.field === 'original_estimate')
  ) {
    return 'fill_field';
  }
  if (/summarize|总结|整理/i.test(text)) return 'summarize';
  if (/decide|choose|判断|决策|选择/i.test(text)) return 'decide';
  if (/delegate|交给|委派/i.test(text)) return 'delegate';
  return request.contextType === 'webpage' ? 'read' : 'unknown';
}

function collectVisibleFacts(
  request: ContextRecallRequest,
): ContextRecallVisibleFact[] | undefined {
  const facts: ContextRecallVisibleFact[] = [];
  for (const fact of request.interactionScene?.visibleFacts ?? []) {
    facts.push(fact);
  }
  const issueKey =
    request.interactionScene?.issueKey ||
    request.currentContext?.issueKey ||
    request.sourceContext?.issueKey;
  for (const field of request.currentContext?.visibleFields ?? []) {
    facts.push({
      kind: 'jira_field',
      name: field.name,
      value: field.value,
      rawText: field.rawText,
      source: 'current_page',
      issueKey,
      confidence: 0.9,
    });
  }
  const seen = new Set<string>();
  const deduped = facts.filter((fact) => {
    const key = `${fact.kind}:${fact.name || ''}:${fact.value}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  return deduped.length ? deduped.slice(0, 16) : undefined;
}

function inferRiskLevel(
  surface: SceneFrameSurface,
  sceneType: SceneFrameType,
  text: string,
): SceneFrame['riskLevel'] {
  if (/private|personal|salary|token|secret|密码|隐私|薪资/i.test(text)) {
    return 'high';
  }
  if (surface === 'compose_assist' || sceneType === 'jira_estimate') {
    return 'medium';
  }
  return 'low';
}

function normalizeAnchor(value?: string | null): string | undefined {
  const normalized = String(value || '').replace(/\s+/g, ' ').trim();
  return normalized ? normalized.slice(0, 120) : undefined;
}

function clipSceneText(value: string, maxLength: number): string {
  const normalized = value.replace(/\s+/g, ' ').trim();
  return normalized.length <= maxLength
    ? normalized
    : normalized.slice(0, maxLength).trimEnd();
}
