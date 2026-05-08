import type Database from 'better-sqlite3';

import { ContextRecallService } from './ContextRecallService.js';
import type {
  ComposerAssistEvidence,
  ComposerAssistRequest,
  ComposerAssistResponse,
  ContextAssistCueCard,
  ContextAssistRequest,
  ContextAssistResponse,
  ContextRecallContextType,
  ContextRecallMatch,
  ContextRecallRequest,
  ContextRecallSurface,
  RecallSourceType,
} from '../types/index.js';

const DEFAULT_LIMIT = 3;
const MEETING_LIMIT = 5;
const MAX_INSERT_TEXT = 2400;
const MIN_AVAILABLE_CONFIDENCE = 0.58;
const WEB_AGENT_SOURCES: RecallSourceType[] = [
  'ai_chat',
  'doubao',
  'glip',
  'jira',
  'meeting',
  'calendar',
  'web',
  'manual',
  'system',
  'user_core',
  'markdown',
  'reflection',
];
const WORK_SOURCES: RecallSourceType[] = [
  'glip',
  'jira',
  'meeting',
  'calendar',
  'web',
  'manual',
  'system',
  'user_core',
  'markdown',
  'reflection',
];
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
];

export class ContextAssistService {
  private readonly recallService: ContextRecallService;

  constructor(private readonly db: Database.Database) {
    this.recallService = new ContextRecallService(db);
  }

  async assist(request: ContextAssistRequest): Promise<ContextAssistResponse> {
    if (request.surface === 'composer_guard') {
      const composerRequest = request.composer ?? contextAssistToComposer(request);
      const composer = await this.assistComposer(composerRequest);
      return composerToContextAssist(composer, request);
    }

    return this.assistMeetingPrep(request);
  }

  async assistComposer(
    request: ComposerAssistRequest,
  ): Promise<ComposerAssistResponse> {
    const recallRequest = buildComposerRecallRequest(request);
    const recall = await this.recallService.recall(recallRequest);
    const evidence = recall.matches.map(toEvidence);

    if (evidence.length === 0) {
      return {
        available: false,
        suggestionType: 'none',
        title: '暂无相关记忆',
        summary: '没有找到足够相关的 Personal AI 记忆。',
        evidence: [],
        riskLevel: 'low',
        previewRequired: false,
        confidence: 0,
        queryTimeMs: recall.queryTimeMs,
        debug: request.debug
          ? {
              recall: recall.debug,
              recallRequest,
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
              rejectedReason: 'confidence_below_threshold',
            }
          : undefined,
      };
    }

    const suggestionType = getComposerSuggestionType(request);
    const riskLevel = getComposerRiskLevel(request, evidence);
    const insertText = clipInsertText(renderComposerInsertText(request, evidence));

    return {
      available: true,
      suggestionType,
      title: getComposerAssistTitle(request),
      summary: getComposerSummary(request, evidence.length, riskLevel),
      insertText,
      evidence,
      riskLevel,
      previewRequired:
        riskLevel !== 'low' || request.contextType === 'web_agent_prompt',
      confidence,
      queryTimeMs: recall.queryTimeMs,
      debug: request.debug
        ? {
            recall: recall.debug,
            recallRequest,
          }
        : undefined,
    };
  }

  private async assistMeetingPrep(
    request: ContextAssistRequest,
  ): Promise<ContextAssistResponse> {
    const recallRequest = buildMeetingPrepRecallRequest(request);
    const recall = await this.recallService.recall(recallRequest);
    const evidence = recall.matches.map(toEvidence);
    const confidence = getConfidence(evidence);

    if (evidence.length === 0) {
      return {
        available: false,
        surface: 'meeting_prep',
        suggestionType: 'none',
        title: '暂无会前上下文',
        summary: '没有找到与本次会议足够相关的 Personal AI 记忆。',
        cueCards: buildMeetingFallbackCards(request),
        evidence: [],
        riskLevel: 'low',
        previewRequired: false,
        confidence: 0,
        queryTimeMs: recall.queryTimeMs,
        debug: request.debug
          ? {
              recall: recall.debug,
              recallRequest,
            }
          : undefined,
      };
    }

    const cueCards = buildMeetingCueCards(request, evidence);
    return {
      available: true,
      surface: 'meeting_prep',
      suggestionType: 'meeting_brief',
      title: '会前准备',
      summary: `找到 ${evidence.length} 条与本次会议相关的记忆。`,
      insertText: renderMeetingPilotHandoffText(request, evidence),
      cueCards,
      evidence,
      riskLevel: getMeetingRiskLevel(evidence),
      previewRequired: false,
      confidence,
      queryTimeMs: recall.queryTimeMs,
      debug: request.debug
        ? {
            recall: recall.debug,
            recallRequest,
          }
        : undefined,
    };
  }
}

function buildComposerRecallRequest(
  request: ComposerAssistRequest,
): ContextRecallRequest {
  const secondaryTexts = [
    ...(request.secondaryTexts ?? []),
    ...(request.keywords?.length ? [request.keywords.join(' ')] : []),
    request.threadRoot?.text,
    ...(request.visibleMessages ?? []).slice(-4).map((message) => message.text),
  ]
    .filter((value): value is string => Boolean(value))
    .slice(0, 8);

  return {
    surface: mapComposerSurface(),
    contextType: mapComposerContextType(request),
    title: request.title,
    url: request.url,
    primaryText: request.primaryText?.slice(0, 1600),
    secondaryTexts,
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
    ...attendeeNames.slice(0, 8).map((name) => ({ kind: 'person', value: name })),
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
  return hints.length ? hints : undefined;
}

function normalizeComposerSourceTypes(
  request: ComposerAssistRequest,
): RecallSourceType[] {
  const defaults =
    request.contextType === 'web_agent_prompt' ? WEB_AGENT_SOURCES : WORK_SOURCES;
  const requested = request.sourceTypes?.length
    ? request.sourceTypes.filter((value): value is RecallSourceType =>
        defaults.includes(value as RecallSourceType),
      )
    : defaults;
  return requested.length ? requested : defaults;
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
    whyMatched: match.whyMatched,
    timestamp: match.timestamp,
    score: match.score,
  };
}

function getComposerSuggestionType(
  request: ComposerAssistRequest,
): ComposerAssistResponse['suggestionType'] {
  if (request.contextType === 'web_agent_prompt') return 'context_pack';
  if (request.contextType === 'jira_issue') return 'issue_context';
  return 'reply_context';
}

function getComposerAssistTitle(request: ComposerAssistRequest): string {
  if (request.contextType === 'web_agent_prompt') return 'AI context pack';
  if (request.contextType === 'jira_issue') return 'Jira 相关记忆';
  if (request.surface === 'ringcentral_thread') return 'Thread 回复上下文';
  return '消息回复上下文';
}

function getComposerSummary(
  request: ComposerAssistRequest,
  evidenceCount: number,
  riskLevel: ComposerAssistResponse['riskLevel'],
): string {
  const target =
    request.contextType === 'web_agent_prompt'
      ? '当前 AI prompt'
      : request.contextType === 'jira_issue'
        ? '当前 Jira issue'
        : '当前消息会话';
  const preview = riskLevel === 'high' ? '，插入前需要预览' : '';
  return `找到 ${evidenceCount} 条与${target}相关的记忆${preview}。`;
}

function getComposerRiskLevel(
  request: ComposerAssistRequest,
  evidence: ComposerAssistEvidence[],
): ComposerAssistResponse['riskLevel'] {
  const sensitiveSource = evidence.some((item) =>
    /manual|user_core|profile|private|personal/i.test(
      [item.sourceLabel, item.sourceTitle, item.title].filter(Boolean).join(' '),
    ),
  );
  if (sensitiveSource) return 'high';
  if (request.contextType === 'web_agent_prompt') return 'medium';
  return 'low';
}

function getMeetingRiskLevel(
  evidence: ComposerAssistEvidence[],
): ContextAssistResponse['riskLevel'] {
  const sensitiveSource = evidence.some((item) =>
    /manual|user_core|profile|private|personal/i.test(
      [item.sourceLabel, item.sourceTitle, item.title].filter(Boolean).join(' '),
    ),
  );
  return sensitiveSource ? 'medium' : 'low';
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

function renderComposerInsertText(
  request: ComposerAssistRequest,
  evidence: ComposerAssistEvidence[],
): string {
  if (request.contextType === 'web_agent_prompt') {
    return renderWebAgentContextPack(request, evidence);
  }

  if (request.contextType === 'jira_issue') {
    return renderJiraContext(request, evidence);
  }

  return renderReplyContext(request, evidence);
}

function renderWebAgentContextPack(
  request: ComposerAssistRequest,
  evidence: ComposerAssistEvidence[],
): string {
  const intent = summarizeIntent(request);
  const bullets = evidence.map(
    (item, index) => `${index + 1}. ${item.snippet} [M${index + 1}]`,
  );
  const sources = evidence.map((item, index) => {
    const label = item.sourceTitle || item.title || item.sourceLabel || item.id;
    return `[M${index + 1}] ${label}`;
  });

  return [
    'Personal AI context pack (review before sending):',
    '',
    `Goal: ${intent}`,
    '',
    'Relevant memory:',
    ...bullets,
    '',
    'Use instructions:',
    '- Use this context only when it helps answer the current prompt.',
    '- Do not expose private details verbatim unless I explicitly ask.',
    '- Prefer citing the source idea, not copying the whole memory.',
    '',
    'Sources:',
    ...sources,
  ].join('\n');
}

function renderReplyContext(
  request: ComposerAssistRequest,
  evidence: ComposerAssistEvidence[],
): string {
  const bullets = evidence.map((item) => `- ${item.snippet}`);
  const threadLine = request.threadRoot?.text
    ? [`Thread root: ${request.threadRoot.text}`, '']
    : [];

  return [
    'Personal AI context to consider before replying:',
    '',
    ...threadLine,
    ...bullets,
    '',
    'Please review and edit before sending.',
  ].join('\n');
}

function renderJiraContext(
  request: ComposerAssistRequest,
  evidence: ComposerAssistEvidence[],
): string {
  const issue = request.identifiers?.issueKey || request.title || 'this issue';
  return [
    `Personal AI context for ${issue}:`,
    '',
    ...evidence.map((item) => `- ${item.snippet}`),
    '',
    'Please verify against the current Jira state before posting.',
  ].join('\n');
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
  return (request.title || request.primaryText || 'continue this conversation').slice(
    0,
    220,
  );
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
