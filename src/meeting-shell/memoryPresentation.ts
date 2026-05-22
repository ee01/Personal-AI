import type {
  ContextRecallMatch,
  ContextRecallRequest,
  RecallItem,
} from '../services/MemoryServiceClient';
import type { MeetingPilotMemoryRef } from './protocol';

type ContextRecallMatchV2 = ContextRecallMatch & {
  uiSummary?: string;
  whyRelevant?: string[];
  matchedAnchors?: {
    people?: string[];
    topics?: string[];
    projects?: string[];
    source?: string[];
  };
  suppressionReason?: string;
  reasonType?: string;
  evidenceRole?: string;
  displayPriority?: 'p1' | 'p2' | 'hidden';
  metadata?: Record<string, unknown>;
  mergedCount?: number;
  mergedIds?: string[];
  sourceClusterKey?: string;
};

type MeetingPilotContextRecallRequestV2 = ContextRecallRequest & {
  sourceContext?: Record<string, unknown>;
  exclude?: Record<string, unknown>;
};

const GENERIC_SOURCE_LABELS = new Set([
  'meeting',
  'manual',
  'web',
  'glip',
  'jira',
  'memory-service',
  'memory service',
  'ringcentral 消息',
  'ringcentral message',
  '时间',
  '消息',
]);

function stripMarkup(value: string): string {
  return String(value || '')
    .replace(/<a\b[^>]*>(.*?)<\/a>/gis, '$1')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/?(?:p|div|li|ul|ol|blockquote|span|strong|em|b|i|code|pre)[^>]*>/gi, ' ')
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g, '$1')
    .replace(/https?:\/\/\S+/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/&#34;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/gi, "'")
    .replace(/&gt;/g, '>')
    .replace(/&lt;/g, '<')
    .replace(/&amp;/g, '&')
    .replace(/&nbsp;/g, ' ')
    .replace(/[*_`>#]+/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/@person-[a-z0-9._-]+/gi, ' ');
}

function sanitizeMemoryText(value: string): string {
  const text = stripMarkup(value)
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => {
      if (!line) return false;
      if (/^__?回复建议__?/i.test(line)) return false;
      if (/^🔗\s*点击查看原消息/i.test(line)) return false;
      if (/^\*?以上是 Personal AI/i.test(line)) return false;
      return true;
    })
    .join('\n');

  return text
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

function truncateWithEllipsis(value: string, maxLength: number): string {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, maxLength).trimEnd()}...`;
}

function cleanTitle(value?: string): string | undefined {
  if (!value) return undefined;
  const cleaned = sanitizeMemoryText(value)
    .replace(/\s+(?:—|-)\s+Meeting Memory$/i, '')
    .replace(/\s+(?:—|-)\s+Meeting$/i, '')
    .trim();
  if (!cleaned) return undefined;
  if (
    GENERIC_SOURCE_LABELS.has(cleaned.toLowerCase()) ||
    /^(ringcentral\s+消息|消息|时间|相关记忆|@?[\p{Letter}\p{Mark}\s.'()_-]{1,64}\s+wrote\s*[:：]?)$/iu.test(cleaned)
  ) {
    return undefined;
  }
  const firstPart = cleaned
    .split(/\s+(?:—|-|｜|\|)\s+/)
    .map((part) => part.trim())
    .find(Boolean);
  return firstPart || cleaned;
}

function fallbackPreview(fullText: string, maxLength = 72): string {
  const firstLine = fullText
    .split('\n')
    .map((line) => line.trim())
    .find(Boolean);
  return truncateWithEllipsis(firstLine || fullText, maxLength);
}

function resolveTitle(item: RecallItem, snippet: string): string {
  const preferred =
    cleanTitle(item.displayTitle) || cleanTitle(item.sourceTitle) || '';
  if (preferred && preferred !== snippet) {
    return preferred;
  }
  const sourceLabel = (item.source || '').trim();
  if (!sourceLabel || GENERIC_SOURCE_LABELS.has(sourceLabel.toLowerCase())) {
    return '';
  }
  return sourceLabel;
}

export interface BuildMeetingPilotContextRecallArgs {
  /** Current meeting id to exclude from recall (self-echo protection). */
  excludeMeetingId?: string;
  meetingUrl?: string;
  meetingTitle: string;
  participants?: string[];
  currentTopic?: string;
  summary?: string;
  transcriptSummary?: string;
  screenObservation?: string;
  actionSummary?: string;
  decisionSummary?: string;
  meetingMetadata?: string;
}

const BOILERPLATE_BLOCKLIST = [
  'no active screen share is detected.',
  'meeting pilot is recording this meeting.',
  '决议 - 暂无',
  '行动项 - 暂无',
  'open the panel to start capture or follow the live map.',
  'a shared application is minimized.',
  'current speaker:',
];

function isBoilerplate(text: string): boolean {
  if (!text) return true;
  const lower = text.toLowerCase().trim();
  if (!lower) return true;
  return BOILERPLATE_BLOCKLIST.some((entry) => lower.includes(entry));
}

function dropBoilerplateLines(text: string): string {
  return text
    .split('\n')
    .filter((line) => !isBoilerplate(line))
    .join('\n')
    .trim();
}

function hasMeaningfulMeetingRecallSignal(value?: string): boolean {
  const cleaned = dropBoilerplateLines(sanitizeMemoryText(value ?? ''));
  if (cleaned.length < 12) return false;
  if (/^(ringcentral video|live discussion|waiting for context)$/i.test(cleaned)) {
    return false;
  }
  return /[A-Za-z0-9\u3400-\u9fff]{4,}/.test(cleaned);
}

const REASON_LABELS: Record<string, string> = {
  same_project: '同一项目',
  same_people: '相关参会人',
  open_action: '未关闭行动项',
  prior_decision: '历史决策',
  linked_artifact: '相关资料',
  meeting_series: '同系列会议',
  weak_related: '相关背景',
  semantic: '语义相关',
  keyword: '关键词匹配',
  source: '来源相关',
  recent: '近期上下文',
  entity: '实体关联',
};

const EVIDENCE_ROLE_LABELS: Record<string, string> = {
  decision: '历史决策',
  action: '行动项',
  action_item: '行动项',
  risk: '风险',
  context: '背景',
  artifact: '资料',
  issue: '问题线索',
};

function getRelationLabel(match: ContextRecallMatchV2): string | undefined {
  if (match.reasonType && REASON_LABELS[match.reasonType]) {
    return REASON_LABELS[match.reasonType];
  }
  return match.whyMatched;
}

function getEvidenceRoleLabel(match: ContextRecallMatchV2): string | undefined {
  if (match.evidenceRole && EVIDENCE_ROLE_LABELS[match.evidenceRole]) {
    return EVIDENCE_ROLE_LABELS[match.evidenceRole];
  }
  return undefined;
}

export function isContextRecallMatchVisibleForMeetingPilot(
  match: ContextRecallMatch,
): boolean {
  const v2 = match as ContextRecallMatchV2;
  if (v2.displayPriority === 'hidden') return false;
  if (Array.isArray(v2.whyRelevant) && v2.whyRelevant.some((item) => item.trim())) {
    return true;
  }
  return (
    v2.evidenceRole === 'action_item' ||
    v2.evidenceRole === 'action' ||
    v2.evidenceRole === 'decision' ||
    v2.evidenceRole === 'issue' ||
    v2.evidenceRole === 'risk'
  );
}

/**
 * Build a ContextRecallRequest body for Meeting Pilot's passive memory hint
 * surface. The body avoids self-echo by trimming meeting boilerplate before
 * sending it to the backend.
 */
export function buildMeetingPilotContextRecallRequest(
  args: BuildMeetingPilotContextRecallArgs,
): ContextRecallRequest | null {
  const cleanedPrimary = dropBoilerplateLines(
    sanitizeMemoryText(args.transcriptSummary ?? ''),
  );
  const cleanedScreenObservation = dropBoilerplateLines(
    sanitizeMemoryText(args.screenObservation ?? ''),
  );
  const primaryText = [
    cleanedPrimary,
    cleanedScreenObservation
      ? `[共享画面 / OCR]\n${cleanedScreenObservation}`
      : '',
    args.actionSummary ? `[行动项]\n${dropBoilerplateLines(sanitizeMemoryText(args.actionSummary))}` : '',
    args.decisionSummary ? `[决策]\n${dropBoilerplateLines(sanitizeMemoryText(args.decisionSummary))}` : '',
  ]
    .filter(Boolean)
    .join('\n\n');
  const secondary = [
    args.currentTopic,
    args.summary,
    args.meetingMetadata,
  ]
    .map((part) => (part ? dropBoilerplateLines(sanitizeMemoryText(part)) : ''))
    .filter(Boolean) as string[];

  const hasRealSignal =
    hasMeaningfulMeetingRecallSignal(primaryText) ||
    hasMeaningfulMeetingRecallSignal(args.currentTopic) ||
    hasMeaningfulMeetingRecallSignal(args.summary);

  if (!hasRealSignal) {
    return null;
  }

  const request: MeetingPilotContextRecallRequestV2 = {
    surface: 'meeting_passive',
    contextType: 'meeting',
    title: args.meetingTitle,
    url: args.meetingUrl,
    primaryText,
    secondaryTexts: secondary,
    entityHints: [
      args.excludeMeetingId
        ? { kind: 'meeting_id', value: args.excludeMeetingId }
        : null,
      ...(args.participants || [])
        .map((participant) => participant.trim())
        .filter(Boolean)
        .slice(0, 8)
        .map((participant) => ({ kind: 'person', value: participant })),
    ].filter(Boolean) as Array<{ kind: string; value: string }>,
    scope: 'work',
    sourceTypes: ['meeting', 'manual', 'web', 'glip', 'jira', 'calendar', 'markdown'],
    limit: 3,
    sourceContext: {
      contextType: 'meeting',
      sourceType: 'meeting',
      url: args.meetingUrl,
      meetingId: args.excludeMeetingId,
      title: args.meetingTitle,
      participants: args.participants || [],
      topic: args.currentTopic,
    },
    exclude: {
      meetingIds: args.excludeMeetingId ? [args.excludeMeetingId] : [],
      urls: args.meetingUrl ? [args.meetingUrl] : [],
    },
  };

  return request;
}

export function contextMatchToMeetingPilotMemoryRef(
  match: ContextRecallMatch,
): MeetingPilotMemoryRef {
  const v2 = match as ContextRecallMatchV2;
  const summary = dropBoilerplateLines(sanitizeMemoryText(v2.uiSummary ?? ''));
  const fullSnippet = dropBoilerplateLines(sanitizeMemoryText(match.snippet));
  const previewClean = isBoilerplate(match.snippet) ? '' : match.snippet;
  const snippet = previewClean || fallbackPreview(fullSnippet);
  const title =
    cleanTitle(match.title) ||
    cleanTitle(summary) ||
    cleanTitle(match.sourceTitle) ||
    (match.sourceLabel || 'memory-service');
  const relationLabel = getRelationLabel(v2);
  const evidenceRoleLabel = getEvidenceRoleLabel(v2);

  return {
    id: match.id,
    type: match.type,
    title,
    cueTitle: title,
    cueBody: summary || fullSnippet || snippet,
    snippet: isBoilerplate(snippet) ? '' : snippet,
    evidenceSnippet: fullSnippet || snippet,
    fullSnippet,
    score: match.score,
    sourceLabel: match.sourceLabel || 'memory-service',
    sourceTitle: match.sourceTitle,
    sourceUrl: match.sourceUrl,
    timestamp: match.timestamp,
    matchedAt: Date.now(),
    links: match.links,
    exploreLink: match.exploreLink,
    whyMatched: match.whyMatched,
    whyRelevant: v2.whyRelevant,
    matchedAnchors: v2.matchedAnchors,
    suppressionReason: v2.suppressionReason,
    reasonType: v2.reasonType,
    relationLabel,
    evidenceRole: v2.evidenceRole,
    evidenceRoleLabel,
    displayPriority: v2.displayPriority,
    metadata: v2.metadata,
    mergedCount: v2.mergedCount,
    mergedIds: v2.mergedIds,
    sourceClusterKey: v2.sourceClusterKey,
  };
}

/** Kept for legacy explorer surfaces that still convert RecallItems. */
export function recallItemToMeetingPilotMemoryRef(
  item: RecallItem,
): MeetingPilotMemoryRef {
  const fullSnippet = dropBoilerplateLines(
    sanitizeMemoryText(item.displayText || item.content || ''),
  );
  const rawPreview = (item.previewText || '').trim();
  const previewClean = isBoilerplate(rawPreview) ? '' : rawPreview;
  const snippet = previewClean || fallbackPreview(fullSnippet);
  const title = resolveTitle(item, snippet);

  return {
    id: item.id,
    title,
    snippet: isBoilerplate(snippet) ? '' : snippet,
    fullSnippet,
    score: item.score,
    sourceLabel: item.source || 'memory-service',
    sourceUrl: item.sourceUrl,
    exploreLink: item.exploreLink,
  };
}
