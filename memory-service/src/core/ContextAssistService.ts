import type Database from 'better-sqlite3';

import { ContextRecallService } from './ContextRecallService.js';
import { TodayPilotMeetingPrepService } from './TodayPilotMeetingPrepService.js';
import { getLLMClient } from '../llm/LLMClient.js';
import type {
  ComposerAssistEvidence,
  ComposerAssistRequest,
  ComposerAssistResponse,
  ComposerContextItem,
  ComposerScenario,
  ContextAssistCueCard,
  ContextAssistRequest,
  ContextAssistResponse,
  ContextRecallContextType,
  ContextRecallCurrentContext,
  ContextRecallMatch,
  ContextRecallRequest,
  ContextRecallSourceContext,
  ContextRecallSurface,
  RecallSourceType,
} from '../types/index.js';

const DEFAULT_LIMIT = 3;
const MEETING_LIMIT = 5;
const MAX_INSERT_TEXT = 2400;
const MIN_AVAILABLE_CONFIDENCE = 0.58;
const MIN_COMPOSER_CONTEXT_OVERLAP = 2;
const MIN_COMPOSER_SOURCE_OVERLAP = 1;
const COMPOSER_GENERATION_TIMEOUT_MS = 4500;
const MAX_CONTEXT_ITEMS_FOR_PROMPT = 14;
const MAX_PROFILE_ITEMS_FOR_PROMPT = 8;
const MAX_USER_CORE_CHARS_FOR_PROMPT = 900;
const WEB_AGENT_SOURCES: RecallSourceType[] = [
  'ai_chat',
  'chatgpt',
  'doubao',
  'doubao_chat',
  'codex_cli',
  'claude_code_cli',
  'cursor_agent_cli',
  'glip',
  'jira',
  'meeting',
  'calendar',
  'web',
  'manual',
  'source_memory',
  'system',
  'user_core',
  'markdown',
  'reflection',
  'reflection_thread',
  'rehearsal',
];
const AGENT_COMPOSE_SOURCES: RecallSourceType[] = [
  'codex_cli',
  'claude_code_cli',
  'cursor_agent_cli',
  'chatgpt',
  'doubao_chat',
  'ai_chat',
  'doubao',
  'jira',
  'glip',
  'meeting',
  'calendar',
  'web',
  'manual',
  'source_memory',
  'system',
  'user_core',
  'markdown',
  'reflection',
  'reflection_thread',
  'rehearsal',
];
const WORK_SOURCES: RecallSourceType[] = [
  'glip',
  'jira',
  'meeting',
  'calendar',
  'web',
  'manual',
  'source_memory',
  'system',
  'user_core',
  'markdown',
  'reflection',
  'reflection_thread',
  'rehearsal',
];

function parseOptionalBooleanEnv(name: string): boolean | null {
  const raw = process.env[name];
  if (raw === undefined) return null;
  const normalized = raw.trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(normalized)) return true;
  if (['0', 'false', 'no', 'off'].includes(normalized)) return false;
  return null;
}

function isComposerSendableGenerationEnabled(): boolean {
  const envValue = parseOptionalBooleanEnv(
    'COMPOSER_SENDABLE_GENERATION_ENABLED',
  );
  if (envValue !== null) return envValue;
  return process.env.NODE_ENV === 'test' || process.env.VITEST === 'true';
}
const MEETING_PREP_SOURCES: RecallSourceType[] = [
  'calendar',
  'meeting',
  'glip',
  'jira',
  'web',
  'manual',
  'system',
  'user_core',
  'markdown',
  'reflection',
  'reflection_thread',
  'rehearsal',
];

type AgentComposeTaskKind =
  | 'repo_bugfix'
  | 'code_review'
  | 'ui_demo'
  | 'source_research'
  | 'meeting_prep'
  | 'jira_data_analysis'
  | 'message_reply'
  | 'policy_or_tool_decision'
  | 'unknown';

interface AgentComposeTaskFrame {
  kind: AgentComposeTaskKind;
  summary: string;
  confidence: number;
}

interface TargetToolFit {
  targetTool: string;
  fit: 'good' | 'ok' | 'weak' | 'unknown';
  reason: string;
  betterTool?: string;
}

interface AgentComposeContext {
  taskFrame: AgentComposeTaskFrame;
  targetToolFit: TargetToolFit;
  sourceMix: Record<string, number>;
  egressRisk: 'low' | 'medium' | 'high';
  relatedAgentSessions: string[];
}

interface PromptContextPatch {
  intentKind:
    | 'codex_sites_dashboard'
    | 'jira_estimate_analysis'
    | 'ai_service_auto_run';
  title: string;
  summary: string;
  insertText: string;
  gaps: string[];
  sourceLabels: string[];
}

export class ContextAssistService {
  private readonly recallService: ContextRecallService;

  constructor(
    private readonly db: Database.Database,
    private readonly userId = 'default',
  ) {
    this.recallService = new ContextRecallService(db, userId);
  }

  async assist(request: ContextAssistRequest): Promise<ContextAssistResponse> {
    if (request.surface === 'composer_guard') {
      const composerRequest =
        request.composer ?? contextAssistToComposer(request);
      const composer = await this.assistComposer(composerRequest);
      return composerToContextAssist(composer, request);
    }

    return this.assistMeetingPrep(request);
  }

  async assistComposer(
    request: ComposerAssistRequest,
  ): Promise<ComposerAssistResponse> {
    const taskFrame = inferAgentComposeTaskFrame(request);
    if (
      isAgentContextPackRequest(request) &&
      !hasAgentComposeTaskIntent(request, taskFrame)
    ) {
      return {
        available: false,
        suggestionType: 'none',
        title: '暂无明确任务',
        summary: '当前 AI 输入框还没有足够明确的任务意图，不展示跨 AI 上下文。',
        evidence: [],
        riskLevel: 'low',
        previewRequired: false,
        confidence: 0,
        queryTimeMs: 0,
        debug: request.debug
          ? {
              rejectedReason: 'agent_compose_task_intent_missing',
              taskFrame,
            }
          : undefined,
      };
    }

    const ownerReplyState = getOwnerReplyState(request);
    const recallRequest = buildComposerRecallRequest(request);
    const recall = await this.recallService.recall(recallRequest);
    const rawEvidence = recall.matches.map(toEvidence);
    const evidence = filterComposerEvidence(request, rawEvidence);

    if (evidence.length === 0) {
      return {
        available: false,
        suggestionType: 'none',
        title: '暂无相关记忆',
        summary: '没有找到足够相关的 Personal AI 记忆。',
        evidence: rawEvidence,
        riskLevel: 'low',
        previewRequired: false,
        confidence: 0,
        queryTimeMs: recall.queryTimeMs,
        debug: request.debug
          ? {
              recall: recall.debug,
              recallRequest,
              taskFrame,
              rejectedReason: rawEvidence.length
                ? 'composer_evidence_not_relevant_to_current_scene'
                : undefined,
            }
          : undefined,
      };
    }

    const confidence = getConfidence(evidence);
    if (confidence < MIN_AVAILABLE_CONFIDENCE) {
      return {
        available: false,
        suggestionType: 'none',
        title: '暂无高置信建议',
        summary: '相关记忆置信度不足，不展示输入框提示。',
        evidence,
        riskLevel: 'low',
        previewRequired: false,
        confidence,
        queryTimeMs: recall.queryTimeMs,
        debug: request.debug
          ? {
              recall: recall.debug,
              recallRequest,
              taskFrame,
              rejectedReason: 'confidence_below_threshold',
            }
          : undefined,
      };
    }

    let suggestionType = getComposerSuggestionType(request);
    const riskLevel = getComposerRiskLevel(request, evidence);
    if (ownerReplyState.state === 'complete') {
      return {
        available: false,
        suggestionType: 'none',
        title: '相关上下文',
        summary: '找到相关记忆，但最近上下文显示用户已经回复过；这里只展示上下文，不生成可插入草稿。',
        evidence,
        riskLevel,
        previewRequired: false,
        confidence,
        queryTimeMs: recall.queryTimeMs,
        debug: request.debug
          ? {
              recall: recall.debug,
              recallRequest,
              taskFrame,
              rejectedReason: 'owner_already_replied_context_only',
              ownerReplyText: ownerReplyState.text,
            }
          : undefined,
      };
    }
    const agentContext = buildAgentComposeContext(
      request,
      evidence,
      riskLevel,
      taskFrame,
    );
    const promptPatch = buildPromptContextPatch(
      request,
      evidence,
      agentContext,
    );
    if (promptPatch) {
      suggestionType = 'prompt_patch';
    }
    const personalization = loadComposerPersonalization(this.db, request);
    const insertText = await buildComposerInsertText(
      request,
      evidence,
      personalization,
      agentContext,
      promptPatch,
    );

    if (!insertText) {
      return {
        available: false,
        suggestionType: 'none',
        title: '暂无可直接发送的建议',
        summary: '找到相关记忆，但未能生成适合当前场景的回复文本。',
        evidence,
        riskLevel,
        previewRequired: false,
        confidence,
        queryTimeMs: recall.queryTimeMs,
        debug: request.debug
          ? {
              recall: recall.debug,
              recallRequest,
              taskFrame,
              targetToolFit: agentContext?.targetToolFit,
              sourceMix: agentContext?.sourceMix,
              egressRisk: agentContext?.egressRisk,
              relatedAgentSessions: agentContext?.relatedAgentSessions,
              promptPatch,
              personalization: summarizeComposerPersonalization(personalization),
              rejectedReason: 'composer_generation_unavailable',
            }
          : undefined,
      };
    }

    return {
      available: true,
      suggestionType,
      title: getComposerAssistTitle(request, promptPatch),
      summary: getComposerSummary(
        request,
        evidence.length,
        riskLevel,
        evidence,
        promptPatch,
      ),
      insertText,
      evidence,
      riskLevel,
      previewRequired:
        riskLevel !== 'low' ||
        request.contextType === 'web_agent_prompt' ||
        hasRehearsalEvidence(evidence),
      confidence,
      queryTimeMs: recall.queryTimeMs,
      debug: request.debug
        ? {
            recall: recall.debug,
            recallRequest,
            taskFrame,
            targetToolFit: agentContext?.targetToolFit,
            sourceMix: agentContext?.sourceMix,
            egressRisk: agentContext?.egressRisk,
            relatedAgentSessions: agentContext?.relatedAgentSessions,
            promptPatch,
            personalization: summarizeComposerPersonalization(personalization),
          }
        : undefined,
    };
  }

  private async assistMeetingPrep(
    request: ContextAssistRequest,
  ): Promise<ContextAssistResponse> {
    const todayPilot = new TodayPilotMeetingPrepService(this.db, this.userId);
    return todayPilot.resolveFromContextAssist(request);
  }
}

function buildComposerRecallRequest(
  request: ComposerAssistRequest,
): ContextRecallRequest {
  const contextText = buildComposerContextText(request, {
    includeAudience: false,
    includeSender: false,
  });
  const primaryText = buildComposerRecallPrimaryText(request, contextText);
  const secondaryTexts = [
    ...buildComposerDraftSecondaryTexts(request),
    ...buildComposerSecondaryContextTexts(request),
    ...(request.keywords?.length ? [request.keywords.join(' ')] : []),
  ]
    .filter((value): value is string => Boolean(value))
    .slice(0, 8);

  return {
    surface: mapComposerSurface(),
    contextType: mapComposerContextType(request),
    title: request.title,
    url: request.url,
    primaryText,
    secondaryTexts,
    sourceContext: buildComposerRecallSourceContext(request),
    currentContext: buildComposerRecallCurrentContext(request),
    interactionScene: request.interactionScene,
    entityHints: buildComposerEntityHints(request),
    scope: 'work',
    sourceTypes: normalizeComposerSourceTypes(request),
    limit: DEFAULT_LIMIT,
    debug: request.debug,
  };
}

function buildMeetingPrepRecallRequest(
  request: ContextAssistRequest,
): ContextRecallRequest {
  const event = request.event;
  const attendeeNames = (event?.attendees ?? [])
    .map((attendee) => attendee.name || attendee.email)
    .filter((value): value is string => Boolean(value))
    .slice(0, 12);
  const primaryParts = [
    request.primaryText,
    event?.title,
    request.userGoal ? `Meeting goal: ${request.userGoal}` : '',
    event?.descriptionPreview,
    event?.organizer?.name ? `Organizer: ${event.organizer.name}` : '',
    attendeeNames.length ? `Participants: ${attendeeNames.join(', ')}` : '',
    event?.location,
  ].filter(Boolean);

  const entityHints = [
    ...(request.entityHints ?? []),
    ...(event?.externalId
      ? [{ kind: 'calendar_event', value: event.externalId }]
      : []),
    ...(event?.seriesKey
      ? [{ kind: 'calendar_series', value: event.seriesKey }]
      : []),
    ...(event?.organizer?.name
      ? [{ kind: 'person', value: event.organizer.name }]
      : []),
    ...attendeeNames
      .slice(0, 8)
      .map((name) => ({ kind: 'person', value: name })),
  ];

  return {
    surface: 'meeting_prep',
    contextType: 'meeting',
    title: request.title || event?.title,
    url: request.url || event?.sourceUrl || event?.joinUrl,
    primaryText: primaryParts.join('\n').slice(0, 1800),
    secondaryTexts: [
      ...(request.secondaryTexts ?? []),
      ...(request.keywords?.length ? [request.keywords.join(' ')] : []),
    ].slice(0, 8),
    entityHints: entityHints.length ? entityHints : undefined,
    scope: 'work',
    sourceTypes: normalizeMeetingPrepSourceTypes(request),
    limit: Math.min(Math.max(request.limit ?? MEETING_LIMIT, 1), MEETING_LIMIT),
    debug: request.debug,
  };
}

function buildComposerRecallPrimaryText(
  request: ComposerAssistRequest,
  contextText: string,
): string | undefined {
  const fallback = contextText || request.primaryText || '';
  if (request.contextType !== 'web_agent_prompt') {
    return fallback ? fallback.slice(0, 1600) : undefined;
  }

  const draft = normalizeComposerDraft(request.draftText);
  const visibleContext = fallback || '';
  const parts = [
    draft ? `Draft prompt: ${draft}` : '',
    visibleContext ? `Visible AI context: ${visibleContext}` : '',
  ].filter(Boolean);
  const value = parts.join('\n').trim();
  return value ? value.slice(0, 1600) : undefined;
}

function buildComposerDraftSecondaryTexts(
  request: ComposerAssistRequest,
): string[] {
  if (request.contextType !== 'web_agent_prompt') return [];
  const draft = normalizeComposerDraft(request.draftText);
  return draft ? [`Draft prompt: ${draft}`] : [];
}

function buildComposerRecallSourceContext(
  request: ComposerAssistRequest,
): ContextRecallSourceContext | undefined {
  const ids = request.identifiers;
  if (request.contextType !== 'web_agent_prompt') {
    const context: ContextRecallSourceContext = {
      contextType: request.contextType,
      sourceType:
        request.contextType === 'jira_issue'
          ? 'jira'
          : request.surface.startsWith('ringcentral')
            ? 'glip'
            : 'web',
      host: getComposerUrlHost(request.url),
      url: request.url,
      title: request.title,
      topic: request.audience?.issueSummary || request.primaryText,
      groupId: ids?.groupId || request.audience?.groupId,
      conversationId:
        ids?.conversationId || request.audience?.conversationId,
      issueKey: ids?.issueKey || request.audience?.issueKey,
    };
    return Object.values(context).some(Boolean) ? context : undefined;
  }
  return {
    contextType: 'web_agent_prompt',
    sourceType: 'web',
    host: getComposerUrlHost(request.url),
    url: request.url,
    title: request.title,
    topic: normalizeComposerDraft(request.draftText),
  };
}

function buildComposerRecallCurrentContext(
  request: ComposerAssistRequest,
): ContextRecallCurrentContext | undefined {
  const visibleMessages = takeComposerContextItems(
    normalizeComposerContextItems(request),
    8,
  )
    .map((item) => ({
      id: item.id,
      sender: item.sender,
      text: item.text || item.title || '',
      timestampLabel: item.timestampLabel,
    }))
    .filter((item) => item.text.trim());
  const sourceAnchorHints = extractComposerSourceAnchorHints([
    request.draftText,
    request.url,
    request.primaryText,
    request.audience?.issueKey,
    request.audience?.issueSummary,
    ...(request.secondaryTexts ?? []),
  ]);

  return {
    title: request.title,
    url: request.url,
    conversationId:
      request.identifiers?.conversationId || request.audience?.conversationId,
    groupId: request.identifiers?.groupId || request.audience?.groupId,
    issueKey: request.identifiers?.issueKey || request.audience?.issueKey,
    participants: request.audience?.people,
    visibleFields: request.visibleFields,
    sourceAnchorHints: sourceAnchorHints.length ? sourceAnchorHints : undefined,
    visibleMessages: visibleMessages.length ? visibleMessages : undefined,
  };
}

function normalizeComposerDraft(value?: string): string {
  return (value || '').replace(/\s+/g, ' ').trim().slice(0, 520);
}

function getComposerUrlHost(value?: string): string | undefined {
  if (!value) return undefined;
  try {
    return new URL(value).hostname;
  } catch {
    return undefined;
  }
}

function extractComposerIssueKeys(value: string): string[] {
  const matches = value.match(/\b[A-Z][A-Z0-9]+-\d+\b/g) ?? [];
  return Array.from(new Set(matches)).slice(0, 4);
}

function extractComposerSourceAnchorHints(
  values: Array<string | undefined>,
): string[] {
  const anchors = new Set<string>();
  for (const value of values) {
    if (!value) continue;
    for (const issueKey of extractComposerIssueKeys(value)) {
      anchors.add(issueKey);
    }
    for (const match of value.matchAll(/https?:\/\/[^\s)）]+/g)) {
      anchors.add(match[0]);
      if (anchors.size >= 8) break;
    }
    if (anchors.size >= 8) break;
  }
  return Array.from(anchors).slice(0, 8);
}

function mapComposerSurface(): ContextRecallSurface {
  return 'composer_guard';
}

function mapComposerContextType(
  request: ComposerAssistRequest,
): ContextRecallContextType {
  if (request.contextType === 'message_thread') return 'message_thread';
  if (request.contextType === 'jira_issue') return 'jira_issue';
  return 'webpage';
}

function buildComposerEntityHints(
  request: ComposerAssistRequest,
): ContextRecallRequest['entityHints'] {
  const hints: ContextRecallRequest['entityHints'] = [];
  const ids = request.identifiers;
  if (ids?.issueKey) hints.push({ kind: 'jira_key', value: ids.issueKey });
  if (ids?.conversationId)
    hints.push({ kind: 'conversation', value: ids.conversationId });
  if (ids?.groupId) hints.push({ kind: 'group', value: ids.groupId });
  if (ids?.threadRootPostId)
    hints.push({ kind: 'thread_root', value: ids.threadRootPostId });
  if (ids?.provider) hints.push({ kind: 'provider', value: ids.provider });
  if (
    request.audience?.issueKey &&
    request.audience.issueKey !== ids?.issueKey
  ) {
    hints.push({ kind: 'jira_key', value: request.audience.issueKey });
  }
  if (
    request.audience?.conversationId &&
    request.audience.conversationId !== ids?.conversationId
  ) {
    hints.push({
      kind: 'conversation',
      value: request.audience.conversationId,
    });
  }
  if (request.audience?.groupId && request.audience.groupId !== ids?.groupId) {
    hints.push({ kind: 'group', value: request.audience.groupId });
  }
  if (request.contextType === 'web_agent_prompt') {
    for (const issueKey of extractComposerIssueKeys(request.draftText || '')) {
      if (issueKey !== ids?.issueKey) {
        hints.push({ kind: 'jira_key', value: issueKey });
      }
    }
  }
  return hints.length ? hints : undefined;
}

function isAllowedComposerSourceType(value: string): value is RecallSourceType {
  return (
    WEB_AGENT_SOURCES.includes(value as RecallSourceType) ||
    AGENT_COMPOSE_SOURCES.includes(value as RecallSourceType) ||
    WORK_SOURCES.includes(value as RecallSourceType)
  );
}

function getAgentComposeDefaultSources(
  request: ComposerAssistRequest,
): RecallSourceType[] {
  return getComposerScenario(request) === 'agent_compose'
    ? AGENT_COMPOSE_SOURCES
    : removeCurrentTargetSources(WEB_AGENT_SOURCES, request);
}

function removeCurrentTargetSources(
  sourceTypes: RecallSourceType[],
  request: ComposerAssistRequest,
): RecallSourceType[] {
  const current = getCurrentTargetSourceTypes(request);
  if (current.size === 0) return sourceTypes;
  return sourceTypes.filter((sourceType) => !current.has(sourceType));
}

function getCurrentTargetSourceTypes(
  request: ComposerAssistRequest,
): Set<RecallSourceType> {
  const provider = (
    request.identifiers?.provider ||
    request.audience?.provider ||
    request.surface
  )
    ?.trim()
    .toLowerCase();
  const values: RecallSourceType[] =
    provider === 'chatgpt'
      ? ['chatgpt']
      : provider === 'doubao'
      ? ['doubao', 'doubao_chat']
      : provider === 'codex_cli'
      ? ['codex_cli']
      : provider === 'claude_code_cli'
      ? ['claude_code_cli']
      : provider === 'cursor_agent_cli'
      ? ['cursor_agent_cli']
      : [];
  return new Set(values);
}

function normalizeComposerSourceTypes(
  request: ComposerAssistRequest,
): RecallSourceType[] {
  const defaults =
    request.contextType === 'web_agent_prompt'
      ? getAgentComposeDefaultSources(request)
      : WORK_SOURCES;
  const requested = request.sourceTypes?.length
    ? request.sourceTypes.filter((value): value is RecallSourceType =>
        isAllowedComposerSourceType(value),
      )
    : defaults;
  const normalized = requested.length ? requested : defaults;
  if (request.contextType !== 'web_agent_prompt') return normalized;
  const adjusted = removeCurrentTargetSources(normalized, request);
  return adjusted.length ? adjusted : defaults;
}

function normalizeMeetingPrepSourceTypes(
  request: ContextAssistRequest,
): RecallSourceType[] {
  const requested = request.sourceTypes?.length
    ? request.sourceTypes.filter((value): value is RecallSourceType =>
        MEETING_PREP_SOURCES.includes(value as RecallSourceType),
      )
    : MEETING_PREP_SOURCES;
  return requested.length ? requested : MEETING_PREP_SOURCES;
}

function toEvidence(match: ContextRecallMatch): ComposerAssistEvidence {
  return {
    id: match.id,
    type: match.type,
    title: match.title,
    snippet: match.snippet,
    sourceLabel: match.sourceLabel,
    sourceUrl: match.sourceUrl,
    sourceTitle: match.sourceTitle,
    exploreLink: match.exploreLink,
    links: match.links,
    whyMatched: match.whyMatched,
    whyRelevant: match.whyRelevant,
    matchedAnchors: match.matchedAnchors,
    reasonType: match.reasonType,
    evidenceRole: match.evidenceRole,
    displayPriority: match.displayPriority,
    metadata: match.metadata,
    timestamp: match.timestamp,
    score: match.score,
    cue: match.cue,
  };
}

function getComposerSuggestionType(
  request: ComposerAssistRequest,
): ComposerAssistResponse['suggestionType'] {
  if (request.contextType === 'web_agent_prompt') return 'context_pack';
  if (request.contextType === 'jira_issue') return 'issue_context';
  return 'reply_context';
}

function getComposerAssistTitle(
  request: ComposerAssistRequest,
  promptPatch?: PromptContextPatch,
): string {
  if (promptPatch) return promptPatch.title;
  if (request.contextType === 'web_agent_prompt') return '跨 AI 上下文';
  if (request.contextType === 'jira_issue') return 'Jira 相关记忆';
  if (request.surface === 'ringcentral_thread') return 'Thread 回复上下文';
  return '消息回复上下文';
}

function getComposerSummary(
  request: ComposerAssistRequest,
  evidenceCount: number,
  riskLevel: ComposerAssistResponse['riskLevel'],
  evidence: ComposerAssistEvidence[] = [],
  promptPatch?: PromptContextPatch,
): string {
  if (promptPatch) {
    const gaps = promptPatch.gaps.length
      ? ` 缺口：${promptPatch.gaps.join(' / ')}。`
      : ' ';
    return `${promptPatch.summary}${gaps}点击 icon 只插入当前 prompt 草稿，不发送。`;
  }
  const target =
    request.contextType === 'web_agent_prompt'
      ? '当前 AI prompt'
      : request.contextType === 'jira_issue'
      ? '当前 Jira issue'
      : '当前消息会话';
  const preview = riskLevel === 'high' ? '，插入前需要预览' : '';
  const rehearsalCount = evidence.filter(isRehearsalEvidence).length;
  const rehearsal = rehearsalCount
    ? `，其中 ${rehearsalCount} 条是预演提醒`
    : '';
  return `找到 ${evidenceCount} 条与${target}相关的记忆${rehearsal}${preview}。`;
}

function getComposerRiskLevel(
  request: ComposerAssistRequest,
  evidence: ComposerAssistEvidence[],
): ComposerAssistResponse['riskLevel'] {
  const sensitiveSource = evidence.some((item) =>
    hasSensitiveSourceLabel([item.sourceLabel, item.sourceTitle, item.title]),
  );
  if (sensitiveSource) return 'high';
  if (request.contextType === 'web_agent_prompt') return 'medium';
  return 'low';
}

function getMeetingRiskLevel(
  evidence: ComposerAssistEvidence[],
): ContextAssistResponse['riskLevel'] {
  const sensitiveSource = evidence.some((item) =>
    hasSensitiveSourceLabel([item.sourceLabel, item.sourceTitle, item.title]),
  );
  return sensitiveSource ? 'medium' : 'low';
}

function hasSensitiveSourceLabel(parts: Array<string | undefined>): boolean {
  const text = parts
    .filter(Boolean)
    .join(' ')
    .replace(/\bPersonal AI\b/gi, '');
  return /manual|user_core|profile|private|personal/i.test(text);
}

function getConfidence(evidence: ComposerAssistEvidence[]): number {
  if (evidence.length === 0) return 0;
  const top = evidence[0]?.score ?? 0.4;
  if (
    top < MIN_AVAILABLE_CONFIDENCE &&
    evidence.some((item) => /关键词|fts/i.test(item.whyMatched || ''))
  ) {
    return 0.62;
  }
  const confidence = Math.max(0.2, Math.min(0.92, top));
  return Number(confidence.toFixed(2));
}

function isAgentContextPackRequest(request: ComposerAssistRequest): boolean {
  return request.contextType === 'web_agent_prompt';
}

function hasAgentComposeTaskIntent(
  request: ComposerAssistRequest,
  taskFrame: AgentComposeTaskFrame,
): boolean {
  if (!isAgentContextPackRequest(request)) return true;
  const draft = normalizeComposerDraft(request.draftText);
  if (taskFrame.kind !== 'unknown' && taskFrame.confidence >= 0.55) {
    return true;
  }
  if (draft.length >= 12 && /[a-z\u4e00-\u9fff0-9]/i.test(draft)) {
    return true;
  }
  return false;
}

function inferAgentComposeTaskFrame(
  request: ComposerAssistRequest,
): AgentComposeTaskFrame {
  const text = [
    request.draftText,
    request.primaryText,
    request.title,
    ...(request.secondaryTexts ?? []),
    ...(request.keywords ?? []),
  ]
    .filter(Boolean)
    .join('\n')
    .toLowerCase();
  const fallbackSummary = summarizeIntent(request);

  const rules: Array<{
    kind: AgentComposeTaskKind;
    confidence: number;
    summary: string;
    pattern: RegExp;
  }> = [
    {
      kind: 'repo_bugfix',
      confidence: 0.86,
      summary: 'repo 内 bug 修复或可验证代码修改',
      pattern:
        /\b(bug|fix|regression|failing test|stack trace|exception|diff|patch|pr|branch|repo)\b|修复|报错|失败测试|补丁|代码库|分支/,
    },
    {
      kind: 'code_review',
      confidence: 0.78,
      summary: '代码 review、风险检查或实现方案复核',
      pattern: /\b(review|cr|code review|refactor|risk|lint)\b|代码评审|复审|重构|风险检查/,
    },
    {
      kind: 'ui_demo',
      confidence: 0.76,
      summary: 'UI/demo/prototype 生成或调整',
      pattern: /\b(ui|demo|prototype|mockup|html|css|figma)\b|原型|演示|页面|界面|交互/,
    },
    {
      kind: 'jira_data_analysis',
      confidence: 0.76,
      summary: 'Jira issue、项目状态或数据分析',
      pattern: /\b[A-Z][A-Z0-9]+-\d+\b|\bjira\b|\bissue\b|工单|需求|缺陷|状态|完成情况/,
    },
    {
      kind: 'source_research',
      confidence: 0.78,
      summary: '基于资料来源的研究、综合或引用整理',
      pattern:
        /\b(research|source|citation|paper|doc|notebooklm|notebook|study|summarize)\b|资料|来源|引用|论文|文档|调研|整理/,
    },
    {
      kind: 'meeting_prep',
      confidence: 0.74,
      summary: '会议准备、会前 brief 或议题梳理',
      pattern: /\b(meeting|agenda|prep|brief|standup)\b|会议|会前|议程|同步会|准备/,
    },
    {
      kind: 'message_reply',
      confidence: 0.68,
      summary: '消息回复或沟通表达',
      pattern: /\b(reply|respond|message|email|comment)\b|回复|怎么说|消息|评论|邮件/,
    },
    {
      kind: 'policy_or_tool_decision',
      confidence: 0.72,
      summary: '工具选型、政策判断或方案决策',
      pattern:
        /\b(choose|compare|decision|policy|tool|codex|claude|cursor|gemini|chatgpt|notebooklm)\b|选择|对比|决策|政策|工具|选型/,
    },
  ];

  for (const rule of rules) {
    if (rule.pattern.test(text)) {
      return {
        kind: rule.kind,
        summary: rule.summary,
        confidence: rule.confidence,
      };
    }
  }

  return {
    kind: 'unknown',
    summary: fallbackSummary || '继续当前 AI 会话',
    confidence: fallbackSummary.length >= 12 ? 0.46 : 0.2,
  };
}

function buildTargetToolFit(
  request: ComposerAssistRequest,
  taskFrame: AgentComposeTaskFrame,
): TargetToolFit {
  const targetTool = normalizeTargetTool(request);
  const task = taskFrame.kind;
  if (task === 'repo_bugfix' || task === 'ui_demo') {
    if (targetTool === 'codex_cli') {
      return {
        targetTool,
        fit: 'good',
        reason: '这是可验证的 repo/代码任务，Codex 适合产出 diff 并运行检查。',
      };
    }
    return {
      targetTool,
      fit: 'weak',
      betterTool: 'codex_cli',
      reason: '这是可验证的 repo/代码任务，更适合交给 Codex 生成 patch；当前 AI 可用于先梳理需求。',
    };
  }
  if (task === 'code_review') {
    if (targetTool === 'claude_code_cli' || targetTool === 'chatgpt') {
      return {
        targetTool,
        fit: 'good',
        reason: '当前任务偏 review 和推理，适合做风险检查与盲点复核。',
      };
    }
    return {
      targetTool,
      fit: 'ok',
      betterTool: 'claude_code_cli',
      reason: '可以继续使用当前 AI，但 Claude Code 更适合长上下文代码 review。',
    };
  }
  if (task === 'source_research') {
    if (targetTool === 'gemini') {
      return {
        targetTool,
        fit: 'good',
        reason: '当前任务偏资料研究，Gemini/Notebook 类工具适合处理 source-grounded 上下文。',
      };
    }
    return {
      targetTool,
      fit: 'ok',
      betterTool: 'notebooklm',
      reason: '可以继续讨论，但如果需要严格来源引用，更适合 NotebookLM/Gemini 这类资料空间。',
    };
  }
  if (task === 'jira_data_analysis') {
    if (isInteractiveAiTargetTool(targetTool)) {
      return {
        targetTool,
        fit: 'ok',
        betterTool: 'jira_or_project_dashboard',
        reason:
          '当前 AI 适合整理 Personal AI 带入的 Jira/项目上下文，但实时状态、owner 和 blocker 仍要回到 Jira 或 Personal AI 项目面板核对。',
      };
    }
    return {
      targetTool,
      fit: 'weak',
      betterTool: 'jira_or_project_dashboard',
      reason:
        '这是 Jira/项目状态判断，不是代码 patch；当前工具最多承接上下文整理，实时状态应由 Jira 或 Personal AI 项目面板确认。',
    };
  }
  if (task === 'meeting_prep') {
    if (isInteractiveAiTargetTool(targetTool)) {
      return {
        targetTool,
        fit: 'ok',
        betterTool: 'today_pilot_meeting_prep',
        reason:
          '当前 AI 可以帮助整理议程和表达，但日历、参会人和最近承诺应优先由 Today Pilot 会前准备核对。',
      };
    }
    return {
      targetTool,
      fit: 'weak',
      betterTool: 'today_pilot_meeting_prep',
      reason:
        '这是会前准备任务，最好使用 Today Pilot 的会议上下文；当前工具只能接收摘要后继续处理。',
    };
  }
  if (task === 'message_reply' || task === 'policy_or_tool_decision') {
    return {
      targetTool,
      fit: 'good',
      reason: '当前任务以表达、方案或判断为主，聊天型 AI 可以继续承接。',
    };
  }
  return {
    targetTool,
    fit: 'unknown',
    reason: '任务类型还不够明确，仅提供相关上下文，不做工具适配判断。',
  };
}

function isInteractiveAiTargetTool(targetTool: string): boolean {
  return ['chatgpt', 'claude', 'gemini', 'doubao', 'generic_agent'].includes(
    targetTool,
  );
}

function buildAgentComposeContext(
  request: ComposerAssistRequest,
  evidence: ComposerAssistEvidence[],
  riskLevel: ComposerAssistResponse['riskLevel'],
  taskFrame: AgentComposeTaskFrame,
): AgentComposeContext | undefined {
  if (!isAgentContextPackRequest(request)) return undefined;
  return {
    taskFrame,
    targetToolFit: buildTargetToolFit(request, taskFrame),
    sourceMix: buildComposerSourceMix(evidence),
    egressRisk: riskLevel,
    relatedAgentSessions: getRelatedAgentSessionLabels(evidence),
  };
}

function normalizeTargetTool(request: ComposerAssistRequest): string {
  return (
    request.identifiers?.provider ||
    request.audience?.provider ||
    request.surface ||
    'unknown'
  )
    .trim()
    .toLowerCase();
}

function buildComposerSourceMix(
  evidence: ComposerAssistEvidence[],
): Record<string, number> {
  const mix: Record<string, number> = {};
  for (const item of evidence) {
    const key = normalizeSourceLabel(
      item.sourceLabel || item.sourceTitle || item.title || item.id,
    );
    mix[key] = (mix[key] ?? 0) + 1;
  }
  return mix;
}

function normalizeSourceLabel(value: string): string {
  const lower = value.toLowerCase();
  if (/codex/.test(lower)) return 'codex_cli';
  if (/claude/.test(lower)) return 'claude_code_cli';
  if (/cursor/.test(lower)) return 'cursor_agent_cli';
  if (/doubao|豆包/.test(lower)) return 'doubao';
  if (/chatgpt|openai/.test(lower)) return 'chatgpt';
  if (/jira/.test(lower)) return 'jira';
  if (/glip|ringcentral/.test(lower)) return 'glip';
  return lower.replace(/[^a-z0-9_\u4e00-\u9fff]+/g, '_').slice(0, 40) || 'unknown';
}

function getRelatedAgentSessionLabels(
  evidence: ComposerAssistEvidence[],
): string[] {
  const labels = new Set<string>();
  for (const item of evidence) {
    const label = [item.sourceLabel, item.sourceTitle, item.title]
      .filter(Boolean)
      .join(' ');
    if (/codex|claude|cursor/i.test(label)) {
      labels.add(label || item.id);
    }
  }
  return Array.from(labels).slice(0, 6);
}

async function buildComposerInsertText(
  request: ComposerAssistRequest,
  evidence: ComposerAssistEvidence[],
  personalization: ComposerPersonalization,
  agentContext?: AgentComposeContext,
  promptPatch?: PromptContextPatch,
): Promise<string | null> {
  if (request.contextType === 'web_agent_prompt') {
    if (promptPatch) {
      return clipInsertText(promptPatch.insertText);
    }
    return clipInsertText(
      renderWebAgentContextPack(request, evidence, agentContext),
    );
  }

  const cueDraft = selectComposerDraftHintCue(evidence);
  if (cueDraft) {
    return clipInsertText(cueDraft.cueText);
  }

  const generated = await generateSendableComposerText(
    request,
    evidence,
    personalization,
  );
  if (!generated) return null;
  const sanitized = sanitizeGeneratedComposerText(generated);
  if (!isSendableComposerText(sanitized, getComposerScenario(request))) {
    return null;
  }
  if (isRedundantWithOwnerReply(sanitized, request)) {
    return null;
  }
  return clipInsertText(sanitized);
}

function renderWebAgentContextPack(
  request: ComposerAssistRequest,
  evidence: ComposerAssistEvidence[],
  agentContext?: AgentComposeContext,
): string {
  const intent = summarizeIntent(request);
  const taskFrame = agentContext?.taskFrame ?? inferAgentComposeTaskFrame(request);
  const targetToolFit =
    agentContext?.targetToolFit ?? buildTargetToolFit(request, taskFrame);
  const egressRisk = agentContext?.egressRisk ?? 'medium';
  const bullets = evidence.map(
    (item, index) =>
      `${index + 1}. ${formatComposerEvidenceForEgress(item, egressRisk)} [M${
        index + 1
      }]`,
  );
  const sources = evidence.map((item, index) => {
    const label = item.sourceTitle || item.title || item.sourceLabel || item.id;
    return `[M${index + 1}] ${
      isRehearsalEvidence(item) ? '预演提醒：' : ''
    }${label}`;
  });

  return [
    '请结合下面上下文回答：',
    '',
    `目标：${intent}`,
    '',
    `任务判断：${formatTaskFrame(taskFrame)}`,
    `目标工具适配：${formatTargetToolFit(targetToolFit)}`,
    '',
    '相关记忆：',
    ...bullets,
    '',
    '仍需确认：',
    '* 如果要对外承诺状态、时间或 owner，请先核对当前 Jira、文档或原始消息。',
    '* 没有直接证据的推断只能作为待确认线索。',
    '',
    '约束：',
    '* 只在有帮助时使用这些上下文。',
    '* 不要直接暴露不必要的私人细节。',
    '* 优先吸收意思，不要整段照抄记忆。',
    '',
    '来源：',
    ...sources,
  ].join('\n');
}

function buildPromptContextPatch(
  request: ComposerAssistRequest,
  evidence: ComposerAssistEvidence[],
  agentContext?: AgentComposeContext,
): PromptContextPatch | undefined {
  if (request.contextType !== 'web_agent_prompt') return undefined;
  const draft = normalizeComposerDraft(request.draftText);
  if (draft.length < 8) return undefined;

  const evidenceText = buildPromptPatchEvidenceText(evidence);
  const combined = [draft, request.primaryText, request.title, evidenceText]
    .filter(Boolean)
    .join('\n')
    .toLowerCase();
  const sourceLabels = evidence.map(formatPromptPatchSourceLabel).slice(0, 4);
  const targetToolFit =
    agentContext?.targetToolFit ??
    buildTargetToolFit(request, inferAgentComposeTaskFrame(request));

  if (isCodexSitesDashboardPrompt(combined, evidenceText)) {
    return {
      intentKind: 'codex_sites_dashboard',
      title: '提问上下文补丁',
      summary:
        '当前 prompt 缺少 Jira 数据契约、Sites 部署边界和验证方式，建议先插入最小 brief。',
      gaps: ['数据源', '输出契约', '写回/部署边界', '验证方式'],
      sourceLabels,
      insertText: renderPromptPatch({
        heading: '请先按下面的任务补丁理解我的 prompt：',
        sections: [
          [
            '目标',
            '生成一个 Jira roadmap / release risk board，可用 Codex Sites 部署和分享；不要只给泛泛网页设计建议。',
          ],
          [
            '数据源',
            '优先设计 Jira 字段、release phase、roadmap/risk 维度的数据契约；内部链接、附件和群消息原文只用摘要，不要求我整段外发。',
          ],
          [
            '输出格式',
            '请输出 1) 数据契约，2) 页面布局，3) refresh/storage 边界，4) 部署步骤，5) 验证步骤。',
          ],
          [
            '边界',
            '不要自动写回 Jira；如果需要实时状态，请明确列出需要我回 Jira/项目面板核对的字段。',
          ],
          ['工具适配', targetToolFit.reason],
        ],
        sources: sourceLabels,
      }),
    };
  }

  if (isJiraEstimatePrompt(combined, evidenceText)) {
    return {
      intentKind: 'jira_estimate_analysis',
      title: '估算口径补丁',
      summary:
        '当前 prompt 缺少 estimate 字段口径、输出列和写回边界，建议插入项目口径后再问 AI。',
      gaps: ['estimate 字段口径', '输出列', '写回边界', '无法判断原因'],
      sourceLabels,
      insertText: renderPromptPatch({
        heading: '请先按下面的 estimate 口径处理我的 prompt：',
        sections: [
          [
            '依据字段',
            '优先使用 Jira team field、Summary、Description、Issue type、Historical Story Points benchmark；字段不足时不要猜。',
          ],
          [
            '输出列',
            '请输出 Story Points、Dev estimate、QA estimate、diff comment、missing reason / low confidence reason。',
          ],
          [
            '写回边界',
            '先 dry-run 或写回 Google Sheet；不要自动写回 Jira，不要把内部讨论原文外发。',
          ],
          [
            '验证',
            '列出需要人工确认的 ticket、字段缺失、口径冲突，以及下一步应该核对的 Jira/Sheet 范围。',
          ],
        ],
        sources: sourceLabels,
      }),
    };
  }

  if (isAiServiceAutoRunPrompt(combined, evidenceText)) {
    return {
      intentKind: 'ai_service_auto_run',
      title: '自动运行边界补丁',
      summary:
        '当前 prompt 提到自动运行，但缺少触发条件、审批边界和失败回执，建议补齐后再交给 AI。',
      gaps: ['触发条件', '审批边界', '失败回执', '停止条件'],
      sourceLabels,
      insertText: renderPromptPatch({
        heading: '请先按下面的自动运行边界理解我的 prompt：',
        sections: [
          [
            '触发条件',
            '先明确哪些输入可以自动识别并运行，哪些必须停在预览/确认态。',
          ],
          [
            '审批边界',
            '外部发送、写回 Jira/Sheet、删除、同步 persona 或使用敏感来源时必须要求用户确认。',
          ],
          [
            '失败回执',
            '每次失败要说明未执行、未写入或仅生成草稿，并给出可重试/可复制的下一步。',
          ],
          [
            '停止条件',
            '低置信、来源过期、目标平台不可达或出现内部链接/secret 时不要自动继续。',
          ],
        ],
        sources: sourceLabels,
      }),
    };
  }

  return undefined;
}

function buildPromptPatchEvidenceText(
  evidence: ComposerAssistEvidence[],
): string {
  return evidence
    .map((item) =>
      [
        item.title,
        item.sourceTitle,
        item.sourceLabel,
        item.snippet,
        item.cue?.cueText,
      ]
        .filter(Boolean)
        .join(' '),
    )
    .join('\n')
    .toLowerCase();
}

function formatPromptPatchSourceLabel(item: ComposerAssistEvidence): string {
  const label = item.sourceTitle || item.title || item.sourceLabel || item.id;
  const source = item.sourceLabel ? `${item.sourceLabel} / ` : '';
  return `${source}${label}`.replace(/\s+/g, ' ').trim().slice(0, 96);
}

function isCodexSitesDashboardPrompt(
  combined: string,
  evidenceText: string,
): boolean {
  const promptHasSites =
    /codex|sites?\b|site\s+部署|部署|dashboard|roadmap|board|看板|仪表盘/.test(
      combined,
    );
  const promptHasJiraOrRelease =
    /jira|roadmap|release|risk|dashboard|board|看板|风险|发布/.test(
      combined,
    );
  const evidenceSupports =
    /codex|sites?\b|jira|roadmap|release\s+risk|dashboard|board|看板|字段/.test(
      evidenceText,
    );
  return promptHasSites && promptHasJiraOrRelease && evidenceSupports;
}

function isJiraEstimatePrompt(combined: string, evidenceText: string): boolean {
  const promptHasEstimate =
    /estimate|估算|story\s*points?|dev estimate|qa estimate|工时|人天|ticket/.test(
      combined,
    );
  const promptHasJiraOrSheet = /jira|ticket|issue|sheet|表格|story\s*points?/.test(
    combined,
  );
  const evidenceSupports =
    /team field|summary|description|issue type|historical story points?|estimate|dev estimate|qa estimate|只写回 sheet|没有回写 jira|人天|估算/.test(
      evidenceText,
    );
  return promptHasEstimate && promptHasJiraOrSheet && evidenceSupports;
}

function isAiServiceAutoRunPrompt(
  combined: string,
  evidenceText: string,
): boolean {
  const promptHasAutoRun =
    /auto[-\s]?run|auto[-\s]?execute|自动运行|自动识别|智能识别|自动执行|自动触发|审批边界|确认边界|失败回执/.test(
      combined,
    );
  const evidenceSupports =
    /prompt|提示词|自动运行|自动识别|智能识别|approval|确认|回执/.test(
      evidenceText,
    );
  return promptHasAutoRun && evidenceSupports;
}

function renderPromptPatch(input: {
  heading: string;
  sections: Array<[string, string]>;
  sources: string[];
}): string {
  const sources = input.sources.length
    ? input.sources.map((source, index) => `[P${index + 1}] ${source}`)
    : ['[P1] Personal AI 相关记忆摘要'];
  return [
    input.heading,
    '',
    ...input.sections.map(([label, value]) => `${label}：${value}`),
    '',
    '来源处理：只使用 Personal AI 记忆摘要；不要要求我粘贴内部链接、群消息原文、附件下载链接或 secret。',
    '',
    '参考来源：',
    ...sources,
  ].join('\n');
}

function formatTaskFrame(taskFrame: AgentComposeTaskFrame): string {
  const confidence = Math.round(taskFrame.confidence * 100);
  return `${taskFrame.summary}（${taskFrame.kind}, ${confidence}%）`;
}

function formatTargetToolFit(targetToolFit: TargetToolFit): string {
  const base = `${targetToolFit.targetTool}: ${targetToolFit.reason}`;
  return targetToolFit.betterTool
    ? `${base} 更适合的备选：${targetToolFit.betterTool}。`
    : base;
}

function formatComposerEvidenceForEgress(
  item: ComposerAssistEvidence,
  egressRisk: AgentComposeContext['egressRisk'],
): string {
  const raw = formatComposerEvidenceForPrompt(item);
  if (egressRisk !== 'high') return raw;
  const redacted = raw
    .replace(/https?:\/\/\S+/g, '[link]')
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[email]')
    .replace(/\b\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b/g, '[phone]');
  return redacted.length > 180
    ? `${redacted.slice(0, 180).trimEnd()}...`
    : redacted;
}

async function generateSendableComposerText(
  request: ComposerAssistRequest,
  evidence: ComposerAssistEvidence[],
  personalization: ComposerPersonalization,
): Promise<string | null> {
  if (!isComposerSendableGenerationEnabled()) return null;

  const scenario = getComposerScenario(request);
  const prompt = buildComposerGenerationPrompt(
    request,
    evidence,
    scenario,
    personalization,
  );
  if (!prompt) return null;

  try {
    const llm = getLLMClient();
    const response = await withTimeout(
      llm.generate(prompt, {
        temperature: 0.2,
        maxTokens: scenario === 'jira_comment' ? 360 : 220,
        systemPrompt:
          'You write only the exact text the user can insert into the current composer. No explanation, no wrapper, no metadata.',
        timeoutMs: COMPOSER_GENERATION_TIMEOUT_MS,
        retryCount: 0,
      }),
      COMPOSER_GENERATION_TIMEOUT_MS,
    );
    return response.content;
  } catch {
    return null;
  }
}

export function buildComposerGenerationPrompt(
  request: ComposerAssistRequest,
  evidence: ComposerAssistEvidence[],
  scenario: ComposerScenario,
  personalization: ComposerPersonalization,
): string | null {
  const currentContext = buildComposerContextText(request, {
    includeAudience: false,
    includeSender: true,
    maxItems: MAX_CONTEXT_ITEMS_FOR_PROMPT,
  });
  if (!currentContext) return null;

  const audience = formatComposerAudience(request);
  const memories = evidence
    .slice(0, 3)
    .map(
      (item, index) =>
        `[M${index + 1}] ${formatComposerEvidenceForPrompt(item)}`,
    )
    .join('\n');
  const ownerConstraints = formatOwnerExpressionConstraints(personalization);
  const ownerReplyState = getOwnerReplyState(request);

  return [
    '请根据当前场景，替用户写一段可以直接插入输入框并发送的内容。',
    '',
    `场景：${describeComposerScenario(scenario)}`,
    audience ? `对象：${audience}` : '',
    '',
    '当前上下文：',
    currentContext,
    ...(ownerReplyState.state === 'partial'
      ? ['', '用户已经发送但可能未完成的内容：', ownerReplyState.text]
      : []),
    '',
    '可用记忆：',
    memories,
    '',
    '主人表达约束：',
    '* 匹配主人当前使用的语言；长度、语气和结构跟当前场景保持一致。',
    '* 不要编造未经确认的事实；未确认内容最多只能作为表达风格参考。',
    '* 不要说 Personal AI，也不要透露这是由系统或记忆生成。',
    '* 只输出可直接发送的正文，不要解释、不加标题、不加元信息。',
    ownerConstraints,
    '',
    '要求：',
    '* 不要说“我理解当前”。',
    '* 不要把记忆逐条摘抄成清单；先消化成自然回复。',
    '* 只使用和当前上下文明显相关的记忆，不确定就少说。',
    ownerReplyState.state === 'partial'
      ? '* 用户已经发过的内容不要重复；只生成补充说明，且必须能接在已发送内容后面。'
      : '',
    scenario === 'jira_comment'
      ? '* 语气正式、清晰，给出判断/依据/next step。'
      : '* 语气像即时通讯里的真实回复，简短自然，默认 3-5 行以内。',
    '* 不要编造当前上下文或记忆里没有的事实。',
  ]
    .filter(Boolean)
    .join('\n');
}

export interface ComposerProfileRow {
  item_type: string;
  item_key: string;
  item_value: string;
  user_confirmed: number;
  status: string;
  salience_score: number | null;
  updated_at: number | null;
}

export interface ComposerPersonalization {
  userCore?: string;
  confirmedFacts: ComposerProfileRow[];
  confirmedPreferences: ComposerProfileRow[];
  confirmedConstraints: ComposerProfileRow[];
  confirmedStyleHints: ComposerProfileRow[];
  softStyleHints: ComposerProfileRow[];
}

export function loadComposerPersonalization(
  db: Database.Database,
  request: ComposerAssistRequest,
): ComposerPersonalization {
  return {
    userCore: loadUserCoreSnapshot(db),
    confirmedFacts: loadConfirmedProfileItems(db, ['fact']),
    confirmedPreferences: loadConfirmedProfileItems(db, ['preference']),
    confirmedConstraints: loadConfirmedProfileItems(db, ['constraint']),
    confirmedStyleHints: loadComposerStyleHints(db, request, true),
    softStyleHints: loadComposerStyleHints(db, request, false),
  };
}

function loadUserCoreSnapshot(db: Database.Database): string | undefined {
  try {
    const rows = db
      .prepare(
        `SELECT content
           FROM chunks
          WHERE source_type = 'user_core'
             OR file_path = 'USER_CORE.md'
          ORDER BY created_at DESC, chunk_id DESC
          LIMIT 3`,
      )
      .all() as Array<{ content: string }>;
    const content = rows
      .map((row) => formatProfileValue(row.content))
      .filter(Boolean)
      .join('\n')
      .slice(0, MAX_USER_CORE_CHARS_FOR_PROMPT)
      .trim();
    return content || undefined;
  } catch {
    return undefined;
  }
}

function loadConfirmedProfileItems(
  db: Database.Database,
  itemTypes: string[],
): ComposerProfileRow[] {
  try {
    const placeholders = itemTypes.map(() => '?').join(', ');
    return db
      .prepare(
        `SELECT item_type, item_key, item_value, user_confirmed, status,
                salience_score, updated_at
           FROM user_profile_items
          WHERE item_type IN (${placeholders})
            AND user_confirmed = 1
            AND status = 'active'
            AND item_key NOT LIKE 'writing_style.%'
            AND item_key NOT IN ('writing_style', 'response_style', 'communication_style')
          ORDER BY salience_score DESC, updated_at DESC
          LIMIT ?`,
      )
      .all(...itemTypes, MAX_PROFILE_ITEMS_FOR_PROMPT) as ComposerProfileRow[];
  } catch {
    return [];
  }
}

function loadComposerStyleHints(
  db: Database.Database,
  request: ComposerAssistRequest,
  confirmedOnly: boolean,
): ComposerProfileRow[] {
  const confirmedClause = confirmedOnly
    ? "AND user_confirmed = 1 AND status = 'active'"
    : "AND user_confirmed = 0 AND status = 'pending_confirm'";
  try {
    const rows = db
      .prepare(
        `SELECT item_type, item_key, item_value, user_confirmed, status,
                salience_score, updated_at
           FROM user_profile_items
          WHERE (
              item_key LIKE 'writing_style.%'
              OR item_key IN ('writing_style', 'response_style', 'communication_style')
            )
            ${confirmedClause}
          ORDER BY salience_score DESC, updated_at DESC
          LIMIT 40`,
      )
      .all() as ComposerProfileRow[];
    return rows
      .map((row) => ({
        row,
        score: scoreComposerStyleHint(row.item_key, request),
      }))
      .filter((item) => item.score > 0)
      .sort((left, right) => {
        if (right.score !== left.score) return right.score - left.score;
        return (right.row.salience_score ?? 0) - (left.row.salience_score ?? 0);
      })
      .slice(0, MAX_PROFILE_ITEMS_FOR_PROMPT)
      .map((item) => item.row);
  } catch {
    return [];
  }
}

function scoreComposerStyleHint(
  itemKey: string,
  request: ComposerAssistRequest,
): number {
  const key = itemKey.toLowerCase();
  const scenario = getComposerScenario(request);
  const surface = request.surface.toLowerCase();
  const contextText = buildComposerContextText(request, {
    includeAudience: true,
    includeSender: true,
    maxItems: 8,
  });
  let score = getComposerStyleKeys(request).includes(key) ? 3 : 0.3;

  if (key === 'writing_style') score += 0.5;
  if (key === 'response_style' || key === 'communication_style') score += 0.4;

  if (key.includes('ringcentral')) {
    score += surface.includes('ringcentral') ? 2 : -1.5;
  }
  if (key.includes('jira')) {
    score += request.contextType === 'jira_issue' ? 2 : -1.5;
  }
  if (key.includes('ai_chat')) {
    score += request.contextType === 'web_agent_prompt' ? 1.5 : -1;
  }

  if (key.includes('casual_reply')) {
    score += scenario === 'instant_message_reply' ? 2 : -0.5;
  }
  if (key.includes('thread_reply')) {
    score += scenario === 'thread_reply' ? 2 : -0.5;
  }
  if (key.includes('jira_comment')) {
    score += scenario === 'jira_comment' ? 2 : -0.5;
  }
  if (key.includes('status_update')) {
    score += /status|状态|进展|ready|blocker/i.test(contextText) ? 1.5 : 0;
  }

  if (key.includes('peer')) {
    const relationshipHint = [
      request.audience?.relationshipHint,
      request.audience?.conversationTitle,
      ...(request.audience?.people ?? []),
    ]
      .filter(Boolean)
      .join(' ');
    score +=
      /peer|colleague|同事/i.test(relationshipHint) ||
      surface.includes('ringcentral')
        ? 1.2
        : 0;
  }

  if (key.includes('.zh')) {
    score += /[\u4e00-\u9fff]/.test(contextText) ? 1 : -0.3;
  }
  if (key.includes('.en')) {
    score += /[a-z]{3,}/i.test(contextText) ? 0.6 : 0;
  }

  return score;
}

function getComposerStyleKeys(request: ComposerAssistRequest): string[] {
  const scenario = getComposerScenario(request);
  const scenarioKeys =
    scenario === 'jira_comment'
      ? ['writing_style.jira_comment', 'writing_style.jira.comment']
      : scenario === 'thread_reply'
      ? [
          'writing_style.ringcentral_thread_reply',
          'writing_style.ringcentral.thread_reply',
          'writing_style.thread_reply',
        ]
      : [
          'writing_style.ringcentral_reply',
          'writing_style.ringcentral.reply',
          'writing_style.instant_message_reply',
        ];
  return [
    ...scenarioKeys,
    'writing_style',
    'response_style',
    'communication_style',
  ];
}

function formatOwnerExpressionConstraints(
  personalization: ComposerPersonalization,
): string {
  const sections = [
    formatProfileSection(
      'USER_CORE（已确认画像快照）',
      personalization.userCore,
    ),
    formatProfileSection(
      '已确认偏好',
      formatProfileRows(personalization.confirmedPreferences),
    ),
    formatProfileSection(
      '已确认约束',
      formatProfileRows(personalization.confirmedConstraints),
    ),
    formatProfileSection(
      '已确认事实',
      formatProfileRows(personalization.confirmedFacts),
    ),
    formatProfileSection(
      'owner writing style hints（confirmed，优先遵守）',
      formatProfileRows(personalization.confirmedStyleHints),
    ),
    formatProfileSection(
      'owner writing style hints（pending inferred，只能作为 soft style hint，不能当事实）',
      formatProfileRows(personalization.softStyleHints),
    ),
  ].filter(Boolean);

  return sections.length ? sections.join('\n') : '';
}

function summarizeComposerPersonalization(
  personalization: ComposerPersonalization,
): Record<string, unknown> {
  return {
    confirmedStyleHintKeys: personalization.confirmedStyleHints.map(
      (row) => row.item_key,
    ),
    softStyleHintKeys: personalization.softStyleHints.map((row) => row.item_key),
    confirmedPreferenceCount: personalization.confirmedPreferences.length,
    confirmedConstraintCount: personalization.confirmedConstraints.length,
    hasUserCore: Boolean(personalization.userCore?.trim()),
  };
}

function formatProfileSection(label: string, body?: string): string {
  if (!body?.trim()) return '';
  return `${label}：\n${body.trim()}`;
}

function formatProfileRows(rows: ComposerProfileRow[]): string {
  return rows
    .map((row) => `- ${row.item_key}: ${formatProfileValue(row.item_value)}`)
    .filter((line) => line.trim().length > 3)
    .join('\n');
}

function formatProfileValue(value: string): string {
  const trimmed = value.replace(/\s+/g, ' ').trim();
  if (!trimmed) return '';
  try {
    const parsed = JSON.parse(trimmed) as unknown;
    if (typeof parsed === 'string') return parsed;
    return JSON.stringify(parsed);
  } catch {
    return trimmed;
  }
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error('composer_generation_timeout')),
      timeoutMs,
    );
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

function sanitizeGeneratedComposerText(text: string): string {
  return text
    .replace(/^```(?:\w+)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .replace(/^["'“”]+|["'“”]+$/g, '')
    .replace(/^Personal AI context(?: pack)?[^:：]*[:：]\s*/i, '')
    .replace(/^我理解当前是在讨论[:：]\s*/i, '')
    .replace(/^我这边先补充几个相关点[:：]\s*/i, '')
    .replace(/^我补充一下相关背景[:：]\s*/i, '')
    .replace(/\s*Please review and edit before sending\.?\s*$/i, '')
    .trim();
}

function isSendableComposerText(
  text: string,
  scenario: ComposerScenario,
): boolean {
  const cleaned = text.trim();
  if (!cleaned) return false;
  if (/Personal AI context|Please review/i.test(cleaned)) return false;
  if (/^我理解当前是在讨论[:：]/.test(cleaned)) return false;
  if (/^我这边先补充几个相关点[:：]/.test(cleaned)) return false;
  if (/^我补充一下相关背景[:：]/.test(cleaned)) return false;
  if (scenario !== 'web_agent_prompt' && cleaned.split('\n').length > 8)
    return false;
  if (scenario === 'jira_comment' && /哈哈|嘿|lol|😂|🤣/i.test(cleaned))
    return false;
  return true;
}

function getComposerScenario(request: ComposerAssistRequest): ComposerScenario {
  if (request.scenario) return request.scenario;
  if (request.contextType === 'web_agent_prompt') return 'web_agent_prompt';
  if (request.contextType === 'jira_issue') return 'jira_comment';
  if (request.surface === 'ringcentral_thread' || request.threadRoot)
    return 'thread_reply';
  return 'instant_message_reply';
}

type OwnerReplyState = {
  state: 'none' | 'partial' | 'complete';
  text: string;
};

function getOwnerReplyState(request: ComposerAssistRequest): OwnerReplyState {
  if (request.contextType === 'web_agent_prompt') {
    return { state: 'none', text: '' };
  }

  const messageItems =
    normalizeComposerContextItems(request).filter(isComposerReplyItem);
  const trailingOwnerItems: ComposerContextItem[] = [];
  for (let index = messageItems.length - 1; index >= 0; index -= 1) {
    const item = messageItems[index];
    if (!isOwnerAuthoredContextItem(item)) break;
    trailingOwnerItems.unshift(item);
  }

  if (trailingOwnerItems.length === 0) {
    return { state: 'none', text: '' };
  }

  const text = trailingOwnerItems
    .map((item) => formatChatSnippet(item.text || item.title || ''))
    .filter(Boolean)
    .join('\n')
    .trim();
  if (!text) return { state: 'none', text: '' };

  return {
    state: isCompleteOwnerReply(text) ? 'complete' : 'partial',
    text,
  };
}

function isComposerReplyItem(item: ComposerContextItem): boolean {
  return (
    item.type === 'message' ||
    item.type === 'thread_reply' ||
    item.type === 'thread_root' ||
    item.type === 'jira_comment'
  );
}

function isOwnerAuthoredContextItem(item: ComposerContextItem): boolean {
  return (
    item.metadata?.isSelf === true || item.metadata?.authorRole === 'owner'
  );
}

function isCompleteOwnerReply(text: string): boolean {
  const normalized = text.replace(/\s+/g, ' ').trim();
  if (!normalized) return false;

  const hasFinalRequestOrAnswerCue =
    /https?:\/\/|@[a-z0-9._-]+|[?？]|麻烦|帮忙|看看|能不能|是否|已经|已|可以|我也|上传|补齐|补充/i.test(
      normalized,
    );
  const hasIncompleteCue =
    /等下|稍等|待补|还没|没想好|先不|先别|草稿|draft|\btodo\b|ignore|忽略|测试下|test/i.test(
      normalized,
    );

  if (hasIncompleteCue && !hasFinalRequestOrAnswerCue) return false;
  if (hasFinalRequestOrAnswerCue) return true;
  return normalized.length >= 4;
}

function isRedundantWithOwnerReply(
  text: string,
  request: ComposerAssistRequest,
): boolean {
  const ownerReplyState = getOwnerReplyState(request);
  if (ownerReplyState.state === 'none' || !ownerReplyState.text) return false;

  const generatedTokens = tokenizeComposerRelevance(text);
  const ownerTokens = tokenizeComposerRelevance(ownerReplyState.text);
  if (generatedTokens.size === 0 || ownerTokens.size === 0) return false;

  const overlap = countTokenOverlap(generatedTokens, ownerTokens);
  const smaller = Math.min(generatedTokens.size, ownerTokens.size);
  return overlap >= 3 && overlap / Math.max(smaller, 1) >= 0.55;
}

function describeComposerScenario(scenario: ComposerScenario): string {
  switch (scenario) {
    case 'thread_reply':
      return '在即时通讯工具的 thread 里回复';
    case 'jira_comment':
      return '在 Jira issue 里写 comment';
    case 'web_agent_prompt':
      return '给网页 AI/Agent 写 prompt';
    case 'compose_to_ai':
      return '给当前网页 AI 接力上下文';
    case 'agent_compose':
      return '给 coding agent 准备任务上下文';
    case 'document_note':
      return '整理文档或笔记';
    case 'instant_message_reply':
    default:
      return '在即时通讯工具里回复消息';
  }
}

function formatComposerAudience(request: ComposerAssistRequest): string {
  const audience = request.audience;
  return [
    audience?.conversationTitle || request.title,
    audience?.issueKey,
    audience?.issueSummary,
    audience?.people?.length
      ? `visible people: ${audience.people.slice(0, 8).join(', ')}`
      : '',
    audience?.relationshipHint,
  ]
    .filter(Boolean)
    .join('；');
}

function filterComposerEvidence(
  request: ComposerAssistRequest,
  evidence: ComposerAssistEvidence[],
): ComposerAssistEvidence[] {
  if (request.contextType === 'web_agent_prompt') {
    return evidence;
  }

  const contextTokens = tokenizeComposerRelevance(
    buildComposerSceneText(request),
  );
  const sourceTokens = tokenizeComposerRelevance(
    buildComposerSourceAnchorText(request),
  );
  if (contextTokens.size === 0) {
    return [];
  }

  return evidence.filter((item) => {
    if (isSceneCueRehearsalEvidence(item)) return true;

    const evidenceTokens = tokenizeComposerRelevance(
      [item.snippet, item.title, item.sourceTitle].filter(Boolean).join(' '),
    );
    const overlap = countTokenOverlap(contextTokens, evidenceTokens);
    if (overlap >= MIN_COMPOSER_CONTEXT_OVERLAP) return true;

    const sourceOverlap = countTokenOverlap(sourceTokens, evidenceTokens);
    return overlap >= MIN_COMPOSER_SOURCE_OVERLAP && sourceOverlap >= 1;
  });
}

function isRehearsalEvidence(item: ComposerAssistEvidence): boolean {
  return item.type === 'rehearsal';
}

function hasRehearsalEvidence(evidence: ComposerAssistEvidence[]): boolean {
  return evidence.some(isRehearsalEvidence);
}

function isSceneCueRehearsalEvidence(item: ComposerAssistEvidence): boolean {
  if (!isRehearsalEvidence(item)) return false;
  if (item.displayPriority === 'hidden') return false;
  return (
    item.evidenceRole === 'rehearsal_cue' ||
    item.reasonType === 'prospective_cue' ||
    (item.score ?? 0) >= 0.55
  );
}

function formatComposerEvidenceForPrompt(
  item: ComposerAssistEvidence,
): string {
  if (item.cue?.compileStatus === 'compiled' && item.cue.cueText) {
    return `${item.cue.cueText} 证据：${formatChatSnippet(item.snippet)}`;
  }
  const snippet = formatChatSnippet(item.snippet);
  if (!isRehearsalEvidence(item)) return snippet;
  const reasons = item.whyRelevant?.length
    ? `（${item.whyRelevant.slice(0, 2).join('、')}）`
    : '';
  return `预演提醒${reasons}: ${snippet}`;
}

function selectComposerDraftHintCue(
  evidence: ComposerAssistEvidence[],
): ComposerAssistEvidence['cue'] | undefined {
  return evidence
    .map((item) => item.cue)
    .filter(
      (cue): cue is NonNullable<ComposerAssistEvidence['cue']> =>
        Boolean(
          cue?.compileStatus === 'compiled' &&
            cue.actionType === 'draft_hint' &&
            cue.surfaceEligibility.includes('compose_assist') &&
            cue.cueText.trim(),
        ),
    )
    .sort((left, right) => right.confidence - left.confidence)[0];
}

function buildComposerSceneText(request: ComposerAssistRequest): string {
  return buildComposerContextText(request, {
    includeAudience: false,
    includeSender: false,
  });
}

function buildComposerSourceAnchorText(request: ComposerAssistRequest): string {
  const ids = request.identifiers;
  return [
    ids?.issueKey,
    ids?.conversationId,
    ids?.groupId,
    ids?.threadRootPostId,
    request.audience?.issueKey,
    request.audience?.conversationId,
    request.audience?.groupId,
  ]
    .filter(Boolean)
    .join(' ');
}

interface ComposerContextTextOptions {
  includeAudience?: boolean;
  includeSender?: boolean;
  maxItems?: number;
}

function buildComposerContextText(
  request: ComposerAssistRequest,
  options: ComposerContextTextOptions = {},
): string {
  const items = normalizeComposerContextItems(request);
  const maxItems = options.maxItems ?? 12;
  const contextLines = takeComposerContextItems(items, maxItems)
    .map((item) =>
      formatComposerContextItem(item, options.includeSender ?? false),
    )
    .filter(Boolean);
  const audience = options.includeAudience
    ? formatComposerAudience(request)
    : '';
  return [audience, ...contextLines].filter(Boolean).join('\n');
}

function buildComposerSecondaryContextTexts(
  request: ComposerAssistRequest,
): string[] {
  const itemTexts = takeComposerContextItems(
    normalizeComposerContextItems(request),
    8,
  )
    .map((item) => item.text || item.title || '')
    .filter(Boolean)
    .slice(0, 8);
  return [...itemTexts, ...(request.secondaryTexts ?? [])].slice(0, 10);
}

function takeComposerContextItems(
  items: ComposerContextItem[],
  maxItems: number,
): ComposerContextItem[] {
  if (items.length <= maxItems) return items;
  const root = items.find((item) => item.type === 'thread_root');
  if (!root) return items.slice(-maxItems);
  const tail = items.filter((item) => item !== root).slice(-(maxItems - 1));
  return [root, ...tail];
}

function normalizeComposerContextItems(
  request: ComposerAssistRequest,
): ComposerContextItem[] {
  if (request.contextItems?.length) {
    return request.contextItems.filter((item) =>
      Boolean(item.text || item.title),
    );
  }

  const items: ComposerContextItem[] = [];
  if (request.threadRoot?.text) {
    items.push({
      type: 'thread_root',
      id: request.threadRoot.id,
      sender: request.threadRoot.sender,
      text: request.threadRoot.text,
      timestampLabel: request.threadRoot.timestampLabel,
    });
  }
  for (const message of request.visibleMessages ?? []) {
    items.push({
      type: request.threadRoot ? 'thread_reply' : 'message',
      id: message.id,
      sender: message.sender,
      text: message.text,
      timestampLabel: message.timestampLabel,
    });
  }
  if (items.length === 0 && request.primaryText) {
    items.push({
      type: request.contextType === 'jira_issue' ? 'jira_summary' : 'message',
      text: request.primaryText,
    });
  }
  return items;
}

function formatComposerContextItem(
  item: ComposerContextItem,
  includeSender: boolean,
): string {
  const label = getComposerContextItemLabel(item.type);
  const speaker = includeSender && item.sender ? `${item.sender}: ` : '';
  const body = formatChatSnippet(item.text || item.title || '');
  if (!body) return '';
  return `${label}${speaker}${body}`;
}

function getComposerContextItemLabel(
  type: ComposerContextItem['type'],
): string {
  switch (type) {
    case 'thread_root':
      return 'Thread root: ';
    case 'thread_reply':
      return 'Thread reply: ';
    case 'jira_summary':
      return 'Jira summary: ';
    case 'jira_description':
      return 'Jira description: ';
    case 'jira_comment':
      return 'Jira comment: ';
    case 'attachment':
      return 'Attachment: ';
    case 'image':
      return 'Image: ';
    case 'message':
    default:
      return 'Message: ';
  }
}

function tokenizeComposerRelevance(text: string): Set<string> {
  const tokens = new Set<string>();
  const normalized = text.toLowerCase();
  const parts = normalized.match(/[\p{L}\p{N}_-]+/gu) ?? [];

  for (const part of parts) {
    if (COMPOSER_RELEVANCE_STOPWORDS.has(part)) continue;

    if (/^[\u3400-\u9fff\uf900-\ufaff]+$/u.test(part)) {
      if (part.length === 1) continue;
      tokens.add(part);
      for (let index = 0; index < part.length - 1; index += 1) {
        tokens.add(part.slice(index, index + 2));
      }
      continue;
    }

    if (part.length >= 2) {
      tokens.add(part);
    }
  }

  return tokens;
}

function countTokenOverlap(a: Set<string>, b: Set<string>): number {
  let overlap = 0;
  for (const token of a) {
    if (b.has(token)) overlap += 1;
  }
  return overlap;
}

const COMPOSER_RELEVANCE_STOPWORDS = new Set([
  'the',
  'and',
  'for',
  'with',
  'this',
  'that',
  'from',
  'about',
  'please',
  'reply',
  'message',
  'comment',
  'current',
  'context',
  'meeting',
  'title',
  'video',
  'ringcentral',
  'glip',
  'jira',
  'ai',
  'esone',
  'qiu',
  '我',
  '你',
  '他',
  '她',
  '它',
  '我们',
  '你们',
  '他们',
  '这个',
  '那个',
  '当前',
  '回复',
  '消息',
  '评论',
  '相关',
  '讨论',
  '一下',
  '可以',
  '需要',
  '进行',
  '关于',
]);

function formatChatSnippet(text: string): string {
  return text
    .replace(/\s+/g, ' ')
    .replace(/^\s*[-*]\s+/, '')
    .replace(/^\s*\d+[.)]\s+/, '')
    .replace(/^Personal AI context(?: pack)?[^:]*:\s*/i, '')
    .replace(/\s*Please review and edit before sending\.?\s*$/i, '')
    .replace(
      /\s*Please verify against the current Jira state before posting\.?\s*$/i,
      '',
    )
    .trim()
    .slice(0, 360);
}

function buildMeetingCueCards(
  request: ContextAssistRequest,
  evidence: ComposerAssistEvidence[],
): ContextAssistCueCard[] {
  const eventTitle = request.event?.title || request.title || '当前会议';
  const cards: ContextAssistCueCard[] = [
    {
      id: 'brief',
      kind: 'brief',
      title: '进入会议前先看',
      body: `${eventTitle} 已匹配到 ${evidence.length} 条历史上下文。优先核对最近承诺、依赖进展和未关闭的问题。`,
      evidenceIds: evidence.slice(0, 2).map((item) => item.id),
    },
  ];

  for (const item of evidence.slice(0, 3)) {
    cards.push({
      id: `memory-${item.id}`,
      kind: 'memory',
      title: item.title || item.sourceTitle || item.sourceLabel || '相关记忆',
      body: item.snippet,
      evidenceIds: [item.id],
    });
  }

  const questionCard = buildMeetingQuestionCard(evidence);
  if (questionCard) {
    cards.push(questionCard);
  }

  if (request.userGoal?.trim()) {
    cards.push({
      id: 'goal',
      kind: 'action',
      title: '本次目标',
      body: `围绕用户补充目标准备：${request.userGoal.trim().slice(0, 180)}`,
    });
  } else {
    cards.push({
      id: 'missing-goal',
      kind: 'question',
      title: '建议补充会议目标',
      body: '如果这是 recurring 或 daily 会议，补一句今天要同步的问题，Personal AI 会用这个目标召回更准的上下文。',
    });
  }

  return cards;
}

function buildMeetingQuestionCard(
  evidence: ComposerAssistEvidence[],
): ContextAssistCueCard | null {
  if (evidence.length === 0) return null;

  const evidenceText = evidence
    .map((item) =>
      [item.title, item.sourceTitle, item.snippet].filter(Boolean).join(' '),
    )
    .join(' ')
    .toLowerCase();
  const questions: string[] = [];
  const addQuestion = (question: string): void => {
    if (!questions.includes(question)) questions.push(question);
  };

  if (/dependency|blocked|blocker|risk|依赖|阻塞|风险/.test(evidenceText)) {
    addQuestion('依赖或风险现在卡在哪里，owner 和下一步时间点是谁来确认？');
  }
  if (
    /handoff|rollout|launch|progress|交接|上线|发布|进展/.test(evidenceText)
  ) {
    addQuestion('交接或推进项的最新状态是否变化，哪些结论需要同步给参会人？');
  }
  if (/decision|decided|proposal|方案|决定|结论/.test(evidenceText)) {
    addQuestion('之前的决定是否仍然成立，有没有新的约束需要调整方案？');
  }
  if (/todo|follow.?up|action|next step|承诺|待办|下一步/.test(evidenceText)) {
    addQuestion('上次承诺的 follow-up 是否完成，今天要不要重新分配 owner？');
  }
  if (questions.length === 0) {
    addQuestion('哪些历史承诺、未关闭问题或风险需要在会中确认？');
  }

  return {
    id: 'suggested-questions',
    kind: 'question',
    title: '建议带进会议的问题',
    body: questions.slice(0, 2).join(' '),
    evidenceIds: evidence.slice(0, 3).map((item) => item.id),
  };
}

function buildMeetingFallbackCards(
  request: ContextAssistRequest,
): ContextAssistCueCard[] {
  const eventTitle = request.event?.title || request.title || '当前会议';
  return [
    {
      id: 'fallback-brief',
      kind: 'brief',
      title: '暂无高置信记忆',
      body: `${eventTitle} 暂时没有命中足够相关的历史上下文。可以补充本次会议目标后重新生成。`,
    },
  ];
}

function renderMeetingPilotHandoffText(
  request: ContextAssistRequest,
  evidence: ComposerAssistEvidence[],
): string {
  const title = request.event?.title || request.title || 'Meeting';
  return [
    `Personal AI meeting prep for ${title}:`,
    '',
    ...(request.userGoal ? [`Goal: ${request.userGoal}`, ''] : []),
    ...evidence.slice(0, 5).map((item) => `- ${item.snippet}`),
    '',
    'Use these as low-noise cues during the meeting; verify before quoting.',
  ].join('\n');
}

function summarizeIntent(request: ComposerAssistRequest): string {
  const draft = request.draftText?.replace(/\s+/g, ' ').trim();
  if (draft) return draft.slice(0, 220);
  return (
    request.title ||
    request.primaryText ||
    'continue this conversation'
  ).slice(0, 220);
}

function clipInsertText(text: string): string {
  if (text.length <= MAX_INSERT_TEXT) return text;
  return `${text.slice(0, MAX_INSERT_TEXT).trimEnd()}\n...`;
}

function contextAssistToComposer(
  request: ContextAssistRequest,
): ComposerAssistRequest {
  return {
    surface: 'generic_agent',
    contextType:
      request.contextType === 'jira_issue'
        ? 'jira_issue'
        : request.contextType === 'web_agent_prompt'
        ? 'web_agent_prompt'
        : 'message_thread',
    title: request.title,
    url: request.url,
    draftText: request.userGoal,
    primaryText: request.primaryText,
    secondaryTexts: request.secondaryTexts,
    keywords: request.keywords,
    sourceTypes: request.sourceTypes,
    debug: request.debug,
  };
}

function composerToContextAssist(
  composer: ComposerAssistResponse,
  request: ContextAssistRequest,
): ContextAssistResponse {
  return {
    available: composer.available,
    surface: 'composer_guard',
    suggestionType: composer.suggestionType,
    title: composer.title,
    summary: composer.summary,
    insertText: composer.insertText,
    cueCards: composer.evidence.slice(0, 3).map((item) => ({
      id: `composer-${item.id}`,
      kind: 'memory',
      title: item.title || item.sourceTitle || '相关记忆',
      body: item.snippet,
      evidenceIds: [item.id],
    })),
    evidence: composer.evidence,
    riskLevel: composer.riskLevel,
    previewRequired: composer.previewRequired,
    confidence: composer.confidence,
    queryTimeMs: composer.queryTimeMs,
    debug: request.debug ? composer.debug : undefined,
  };
}
