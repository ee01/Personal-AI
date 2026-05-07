import type Database from 'better-sqlite3';

import { ContextRecallService } from './ContextRecallService.js';
import type {
  ComposerAssistEvidence,
  ComposerAssistRequest,
  ComposerAssistResponse,
  ContextRecallContextType,
  ContextRecallMatch,
  ContextRecallRequest,
  ContextRecallSurface,
  RecallSourceType,
} from '../types/index.js';

const DEFAULT_LIMIT = 3;
const MAX_INSERT_TEXT = 2400;
const WEB_AGENT_SOURCES: RecallSourceType[] = [
  'ai_chat',
  'doubao',
  'glip',
  'jira',
  'meeting',
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
  'web',
  'manual',
  'system',
  'user_core',
  'markdown',
  'reflection',
];

export class ComposerAssistService {
  private readonly recallService: ContextRecallService;

  constructor(private readonly db: Database.Database) {
    this.recallService = new ContextRecallService(db);
  }

  async assist(request: ComposerAssistRequest): Promise<ComposerAssistResponse> {
    const recallRequest = buildRecallRequest(request);
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

    const suggestionType = getSuggestionType(request);
    const riskLevel = getRiskLevel(request, evidence);
    const insertText = clipInsertText(renderInsertText(request, evidence));

    return {
      available: true,
      suggestionType,
      title: getAssistTitle(request),
      summary: getSummary(request, evidence.length, riskLevel),
      insertText,
      evidence,
      riskLevel,
      previewRequired: riskLevel !== 'low' || request.contextType === 'web_agent_prompt',
      confidence: getConfidence(evidence),
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

function buildRecallRequest(request: ComposerAssistRequest): ContextRecallRequest {
  const secondaryTexts = [
    ...(request.secondaryTexts ?? []),
    ...(request.keywords?.length ? [request.keywords.join(' ')] : []),
    request.threadRoot?.text,
    ...(request.visibleMessages ?? []).slice(-4).map((message) => message.text),
  ]
    .filter((value): value is string => Boolean(value))
    .slice(0, 8);

  return {
    surface: mapSurface(request),
    contextType: mapContextType(request),
    title: request.title,
    url: request.url,
    primaryText: [request.draftText, request.primaryText]
      .filter(Boolean)
      .join('\n\n')
      .slice(0, 1600),
    secondaryTexts,
    entityHints: buildEntityHints(request),
    scope: 'work',
    sourceTypes: normalizeSourceTypes(request),
    limit: DEFAULT_LIMIT,
    debug: request.debug,
  };
}

function mapSurface(request: ComposerAssistRequest): ContextRecallSurface {
  if (
    request.surface === 'ringcentral_message' ||
    request.surface === 'ringcentral_thread'
  ) {
    return 'meeting_passive';
  }
  return 'web_passive';
}

function mapContextType(request: ComposerAssistRequest): ContextRecallContextType {
  if (request.contextType === 'message_thread') return 'message_thread';
  if (request.contextType === 'jira_issue') return 'jira_issue';
  return 'webpage';
}

function buildEntityHints(request: ComposerAssistRequest): ContextRecallRequest['entityHints'] {
  const hints: ContextRecallRequest['entityHints'] = [];
  const ids = request.identifiers;
  if (ids?.issueKey) hints.push({ kind: 'jira_key', value: ids.issueKey });
  if (ids?.conversationId) hints.push({ kind: 'conversation', value: ids.conversationId });
  if (ids?.groupId) hints.push({ kind: 'group', value: ids.groupId });
  if (ids?.threadRootPostId) hints.push({ kind: 'thread_root', value: ids.threadRootPostId });
  if (ids?.provider) hints.push({ kind: 'provider', value: ids.provider });
  return hints.length ? hints : undefined;
}

function normalizeSourceTypes(request: ComposerAssistRequest): RecallSourceType[] {
  const defaults =
    request.contextType === 'web_agent_prompt' ? WEB_AGENT_SOURCES : WORK_SOURCES;
  const requested = request.sourceTypes?.length
    ? request.sourceTypes.filter((value): value is RecallSourceType =>
        defaults.includes(value as RecallSourceType),
      )
    : defaults;
  return requested.length ? requested : defaults;
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

function getSuggestionType(
  request: ComposerAssistRequest,
): ComposerAssistResponse['suggestionType'] {
  if (request.contextType === 'web_agent_prompt') return 'context_pack';
  if (request.contextType === 'jira_issue') return 'issue_context';
  return 'reply_context';
}

function getAssistTitle(request: ComposerAssistRequest): string {
  if (request.contextType === 'web_agent_prompt') return 'AI context pack';
  if (request.contextType === 'jira_issue') return 'Jira 相关记忆';
  if (request.surface === 'ringcentral_thread') return 'Thread 回复上下文';
  return '消息回复上下文';
}

function getSummary(
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

function getRiskLevel(
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

function getConfidence(evidence: ComposerAssistEvidence[]): number {
  if (evidence.length === 0) return 0;
  const top = evidence[0]?.score ?? 0.4;
  const confidence = Math.max(0.2, Math.min(0.92, top));
  return Number(confidence.toFixed(2));
}

function renderInsertText(
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

function summarizeIntent(request: ComposerAssistRequest): string {
  const draft = request.draftText?.replace(/\s+/g, ' ').trim();
  if (draft) return draft.slice(0, 220);
  return (request.title || request.primaryText || 'continue this conversation').slice(0, 220);
}

function clipInsertText(text: string): string {
  if (text.length <= MAX_INSERT_TEXT) return text;
  return `${text.slice(0, MAX_INSERT_TEXT).trimEnd()}\n...`;
}
