import type Database from 'better-sqlite3';

import { ContextRecallService } from './ContextRecallService.js';
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
  ContextRecallMatch,
  ContextRecallRequest,
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
    const ownerReplyState = getOwnerReplyState(request);
    if (ownerReplyState.state === 'complete') {
      return {
        available: false,
        suggestionType: 'none',
        title: '已回复',
        summary: '最近上下文显示用户已经完成回复，不展示重复提词。',
        evidence: [],
        riskLevel: 'low',
        previewRequired: false,
        confidence: 0,
        queryTimeMs: 0,
        debug: request.debug
          ? {
              rejectedReason: 'owner_already_replied',
              ownerReplyText: ownerReplyState.text,
            }
          : undefined,
      };
    }

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
              rejectedReason: 'confidence_below_threshold',
            }
          : undefined,
      };
    }

    const suggestionType = getComposerSuggestionType(request);
    const riskLevel = getComposerRiskLevel(request, evidence);
    const personalization = loadComposerPersonalization(this.db, request);
    const insertText = await buildComposerInsertText(
      request,
      evidence,
      personalization,
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
              rejectedReason: 'composer_generation_unavailable',
            }
          : undefined,
      };
    }

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
  const contextText = buildComposerContextText(request, {
    includeAudience: false,
    includeSender: false,
  });
  const secondaryTexts = [
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
    primaryText: (contextText || request.primaryText)?.slice(0, 1600),
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
  return hints.length ? hints : undefined;
}

function normalizeComposerSourceTypes(
  request: ComposerAssistRequest,
): RecallSourceType[] {
  const defaults =
    request.contextType === 'web_agent_prompt'
      ? WEB_AGENT_SOURCES
      : WORK_SOURCES;
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
    links: match.links,
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
      [item.sourceLabel, item.sourceTitle, item.title]
        .filter(Boolean)
        .join(' '),
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
      [item.sourceLabel, item.sourceTitle, item.title]
        .filter(Boolean)
        .join(' '),
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

async function buildComposerInsertText(
  request: ComposerAssistRequest,
  evidence: ComposerAssistEvidence[],
  personalization: ComposerPersonalization,
): Promise<string | null> {
  if (request.contextType === 'web_agent_prompt') {
    return clipInsertText(renderWebAgentContextPack(request, evidence));
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
): string {
  const intent = summarizeIntent(request);
  const bullets = evidence.map(
    (item, index) =>
      `${index + 1}. ${formatChatSnippet(item.snippet)} [M${index + 1}]`,
  );
  const sources = evidence.map((item, index) => {
    const label = item.sourceTitle || item.title || item.sourceLabel || item.id;
    return `[M${index + 1}] ${label}`;
  });

  return [
    '请结合下面上下文回答：',
    '',
    `目标：${intent}`,
    '',
    '相关记忆：',
    ...bullets,
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

async function generateSendableComposerText(
  request: ComposerAssistRequest,
  evidence: ComposerAssistEvidence[],
  personalization: ComposerPersonalization,
): Promise<string | null> {
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
      }),
      COMPOSER_GENERATION_TIMEOUT_MS,
    );
    return response.content;
  } catch {
    return null;
  }
}

function buildComposerGenerationPrompt(
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
    .map((item, index) => `[M${index + 1}] ${formatChatSnippet(item.snippet)}`)
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

interface ComposerProfileRow {
  item_type: string;
  item_key: string;
  item_value: string;
  user_confirmed: number;
  status: string;
  salience_score: number | null;
  updated_at: number | null;
}

interface ComposerPersonalization {
  userCore?: string;
  confirmedFacts: ComposerProfileRow[];
  confirmedPreferences: ComposerProfileRow[];
  confirmedConstraints: ComposerProfileRow[];
  confirmedStyleHints: ComposerProfileRow[];
  softStyleHints: ComposerProfileRow[];
}

function loadComposerPersonalization(
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
  const styleKeys = getComposerStyleKeys(request);
  const keyPlaceholders = styleKeys.map(() => '?').join(', ');
  const confirmedClause = confirmedOnly
    ? "AND user_confirmed = 1 AND status = 'active'"
    : "AND user_confirmed = 0 AND status = 'pending_confirm'";
  try {
    return db
      .prepare(
        `SELECT item_type, item_key, item_value, user_confirmed, status,
                salience_score, updated_at
           FROM user_profile_items
          WHERE item_key IN (${keyPlaceholders})
            ${confirmedClause}
          ORDER BY
            CASE ${styleKeys
              .map((key, index) => `WHEN item_key = ? THEN ${index}`)
              .join(' ')}
              ELSE ${styleKeys.length}
            END,
            salience_score DESC,
            updated_at DESC
          LIMIT ?`,
      )
      .all(
        ...styleKeys,
        ...styleKeys,
        MAX_PROFILE_ITEMS_FOR_PROMPT,
      ) as ComposerProfileRow[];
  } catch {
    return [];
  }
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
    const evidenceTokens = tokenizeComposerRelevance(
      [item.snippet, item.title, item.sourceTitle].filter(Boolean).join(' '),
    );
    const overlap = countTokenOverlap(contextTokens, evidenceTokens);
    if (overlap >= MIN_COMPOSER_CONTEXT_OVERLAP) return true;

    const sourceOverlap = countTokenOverlap(sourceTokens, evidenceTokens);
    return overlap >= MIN_COMPOSER_SOURCE_OVERLAP && sourceOverlap >= 1;
  });
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
