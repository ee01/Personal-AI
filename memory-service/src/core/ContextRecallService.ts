/**
 * Context Recall — passive associative recall.
 *
 * Used by web/meeting/popup surfaces to surface "you've seen this before" style
 * memory bubbles. Hard requirements:
 *
 *   - Fast (target: < 250ms p50, < 500ms p95, no LLM in the path).
 *   - Few results (default 3, hard cap 5).
 *   - Each result carries `exploreLink` pointing to memory-exploring (Vue UI)
 *     and at most 2 direct "open source" links.
 *   - Defensive against weak input (raw DOM dumps, very short queries).
 *
 * The service composes the existing multi-channel `RecallEngine` but pins the
 * channel set to `vector + fts` (no graph traversal, no time window) to keep
 * latency low and signal high.
 */

import type Database from 'better-sqlite3';

import type {
  ContextRecallAutopilotDecision,
  ContextRecallMatch,
  ContextRecallDebug,
  ContextRecallRequest,
  ContextRecallResponse,
  ContextRecallScope,
  RecallItem,
  RecallQuery,
  RecallSourceType,
} from '../types/index.js';
import { RecallEngine } from './RecallEngine.js';
import {
  RecallContextExpansionService,
  type RecallContextExpansion,
} from './RecallContextExpansionService.js';
import { RecallRelevancePatchService } from './RecallRelevancePatchService.js';
import { RehearsalActivationService } from './RehearsalActivationService.js';
import { buildExploreLink } from '../utils/exploreLink.js';
import { buildRecallPresentation } from '../utils/recallPresentation.js';
import { getRecallFeedbackAction } from '../utils/recallFeedback.js';

const DEFAULT_LIMIT_BY_SURFACE: Record<string, number> = {
  web_passive: 3,
  meeting_passive: 3,
  popup_passive: 1,
  follow_thread: 3,
  meeting_prep: 5,
  composer_guard: 3,
};

const HARD_LIMIT = 5;
const PREVIEW_MAX = 140;
const UI_SUMMARY_MAX = 220;
const MIN_QUERY_CHARS = 8;
const MAX_QUERY_CHARS = 600;
// Reject obviously low-signal payloads where text is mostly markup/whitespace.
const MIN_SIGNAL_RATIO = 0.45;
const LOW_INFORMATION_REJECT_REASON = 'low_information_match';
const CONTEXT_OVER_FETCH_FACTOR = 6;

const GENERIC_CONTEXT_TERMS = new Set([
  'about',
  'accepted',
  'am',
  'apr',
  'aug',
  'calendar',
  'context',
  'current',
  'declined',
  'dec',
  'didn',
  'event',
  'feb',
  'fri',
  'jan',
  'jul',
  'jun',
  'mar',
  'may',
  'meeting',
  'memory',
  'mon',
  'nov',
  'oct',
  'page',
  'participants',
  'pm',
  'recall',
  'related',
  'respond',
  'ringcentral',
  'sat',
  'sep',
  'source',
  'sun',
  'thu',
  'tue',
  'video',
  'web',
  'webpage',
  'wed',
]);

const SPECIFIC_CONTEXT_SIGNAL_PATTERN =
  /\b(action|android|api|approval|billing|blocked|budget|bug|claude|codex|commit|composer|cost|credit|cursor|customer|decision|decided|dependency|design|dollar|estimate|fast|follow[-\s]?up|freshservice|goal|gpt[-\s]?5(?:\.5)?|handoff|hard\s+limit|incident|ios|issue|jira|launch|layout|limit|migration|model|openai|owner|plan|planning|premium\s+request|price|project|quota|rate\s+limit|release|review|risk|ship|soft\s+limit|task|thread|token|todo|usage|ux)\b/i;
const CJK_SPECIFIC_CONTEXT_SIGNAL_PATTERN =
  /承诺|依赖|进展|问题|风险|决定|结论|待办|阻塞|负责人|排期|评审|方案|上线|需求|修复|讨论|计划|跟进|设计|布局|客户|事故|审批|迁移|预算|额度|限额|超限|用量|费用|成本|价格|模型|令牌|申请|工具|每月|一个月/;
const ISSUE_KEY_PATTERN = /\b[A-Z][A-Z0-9]+-\d+\b/;
const LOW_INFORMATION_CONTEXT_SHELL_PATTERN =
  /(发送位置|当前位置|当前这个|当前.*(?:群|群聊|会话)|ringcentral\s*(?:群|group)|send(?:ing)?\s+location|current\s+(?:ringcentral\s+)?(?:group|chat|thread)|content\s*[:：]?)/i;
const CONTEXT_SIGNAL_KEYS = [
  'agent_setup',
  'ai_generic',
  'ai_notes',
  'codex',
  'composer',
  'cursor',
  'fast_mode',
  'gpt55',
  'openai',
  'spend_limit',
  'team_planning',
  'usage_alert',
  'virtual_background',
] as const;
type ContextSignalKey = (typeof CONTEXT_SIGNAL_KEYS)[number];
const GENERIC_CONTEXT_SIGNAL_KEYS = new Set<ContextSignalKey>(['ai_generic']);
const TOOL_CONTEXT_SIGNAL_KEYS = new Set<ContextSignalKey>([
  'agent_setup',
  'codex',
  'composer',
  'cursor',
  'fast_mode',
  'gpt55',
  'openai',
]);
const OFF_DOMAIN_CONTEXT_SIGNAL_KEYS = new Set<ContextSignalKey>([
  'ai_notes',
  'team_planning',
  'virtual_background',
]);
const CONTEXT_SIGNAL_PATTERNS: Array<[ContextSignalKey, RegExp]> = [
  [
    'agent_setup',
    /\b(?:headless|mcp|settings?|skill|skills|setup)\b|安装|设置|引导界面|技能/i,
  ],
  ['ai_generic', /\bai\b|artificial\s+intelligence|人工智能|智能体/i],
  ['ai_notes', /\bai\s+notes?\b|translation|quill|翻译|字符限制/i],
  ['codex', /\bcodex\b/i],
  ['composer', /\bcomposer\b/i],
  ['cursor', /\bcursor\b/i],
  ['fast_mode', /\/fast\b|\bfast\b|\/goal\b|\bgoal\b/i],
  ['gpt55', /\bgpt[-\s]?5(?:\.5)?\b|\b5\.5\b/i],
  ['openai', /\bopenai\b/i],
  [
    'spend_limit',
    /\b(?:billing|budget|cost|credit|dollar|hard\s+limit|limit|per\s+month|per\s+user|premium\s+request|price|quota|rate\s+limit|soft\s+limit|token|usage)\b|\$\d|费用|预算|额度|限额|超限|用量|成本|价格|每月|一个月|申请额外/i,
  ],
  [
    'team_planning',
    /\bweekly\s+updates?\b|\bstory\s+points?\b|\bq\s+planning\b|\bstretch\s+goal\b|周会|排期|需求准备/i,
  ],
  [
    'usage_alert',
    /engineering\s+excellence\s+dashboard|hard\s+limit|percentage\s+used|current\s+usage/i,
  ],
  [
    'virtual_background',
    /virtual\s+background|vbg|ai-generated\s+background|背景配额|生成背景/i,
  ],
];
const CONTEXT_SIGNAL_LABELS: Record<ContextSignalKey, string> = {
  agent_setup: 'Agent setup',
  ai_generic: 'AI',
  ai_notes: 'AI Notes',
  codex: 'Codex',
  composer: 'Composer',
  cursor: 'Cursor',
  fast_mode: '/fast',
  gpt55: 'GPT-5.5',
  openai: 'OpenAI',
  spend_limit: '额度/成本',
  team_planning: '团队规划',
  usage_alert: '用量告警',
  virtual_background: 'Virtual Background',
};
const WEAK_TOPIC_ANCHORS = new Set([
  'ai',
  'context',
  'glip',
  'memory',
  'meeting',
  'message',
  'recall',
  'ringcentral',
  'time',
  'webpage',
  '上下文',
  '会议',
  '内容',
  '时间',
  '消息',
  '网页',
  '记忆',
  '相关',
]);
const GENERIC_SOURCE_TITLES = new Set([
  'calendar event',
  'glip',
  'memory-service',
  'message',
  'ringcentral message',
  'ringcentral video',
  'webpage',
  '会议',
  '时间',
  '消息',
  '网页',
  '记忆',
  '相关记忆',
  'ringcentral 消息',
]);
const BROADCAST_CONTEXT_PATTERN =
  /\b(?:all hands|announcement|campaign|everyone ai|hr open day|open day|webinar|主题分享)\b|公告|通知|全员|活动|分享会|开放日/i;
const LOW_INFORMATION_TITLE_PATTERN =
  /^(?:@?[\p{Letter}\p{Mark}\s.'()_-]{1,64}\s+wrote\s*[:：]?|[\p{Letter}\p{Mark}\s.'()_-]{1,64}\s+shared\s+a\s+(?:message|file)\b|ringcentral\s+消息|ringcentral\s+message|glip|消息|内容|时间|相关记忆|memory|meeting|webpage)$/iu;
const LOW_INFORMATION_PREVIEW_PATTERN =
  /^(?:@?[\p{Letter}\p{Mark}\s.'()_-]{1,64}\s+(?:shared|forwarded|sent|wrote|posted)\b|[\p{Letter}\p{Mark}\s.'()_-]{1,64}\s+shared\s+a\s+message\b|for\s+the\s+same\s+meeting\b)/iu;

interface AnchorBuckets {
  people: Set<string>;
  topics: Set<string>;
  projects: Set<string>;
  source: Set<string>;
}

interface SourceMemoryContextRow {
  id: string;
  source_kind: string;
  source_url: string | null;
  source_title: string;
  capture_mode: string;
  summary: string | null;
  content_preview: string | null;
  message_id: string | null;
  created_at: number;
  updated_at: number;
  anchor_preview: string | null;
  takeaway_text: string | null;
}

interface AnchorOverlap {
  people: string[];
  topics: string[];
  projects: string[];
  source: string[];
}

type SuppressionReason =
  | 'broadcast_without_scene_anchor'
  | 'generic_title_without_anchor'
  | 'low_anchor_overlap'
  | 'off_domain_tool_context'
  | 'user_relevance_patch'
  | 'weak_semantic_only';

const AUTOPILOT_QUIET_REASON_LABELS: Record<string, string> = {
  ambiguous_context: '当前指代存在多个候选话题',
  broadcast_without_scene_anchor: '广播/公告缺少当前场景锚点',
  duplicate_source_cluster: '同一来源的重复记忆已合并',
  generic_title_without_anchor: '标题信息量低且无场景锚点',
  low_anchor_overlap: '缺少当前场景锚点',
  low_information_match: '候选内容信息量不足',
  low_information_meeting_context: '当前会议只是空壳信息',
  off_domain_tool_context: '工具或项目场景不一致',
  query_too_short: '当前输入过短',
  source_context_excluded: '当前来源或已排除来源',
  user_relevance_patch: '这类证据已被你标记为不符合当前场景',
  weak_semantic_only: '只有弱语义相似',
};

export class ContextRecallService {
  private engine: RecallEngine;
  private contextExpansion: RecallContextExpansionService;
  private rehearsalActivation: RehearsalActivationService;
  private relevancePatches: RecallRelevancePatchService;

  constructor(
    private db: Database.Database,
    userId = 'default',
  ) {
    this.engine = new RecallEngine(db);
    this.contextExpansion = new RecallContextExpansionService(db);
    this.rehearsalActivation = new RehearsalActivationService(db);
    this.relevancePatches = new RecallRelevancePatchService(db, userId);
  }

  async recall(request: ContextRecallRequest): Promise<ContextRecallResponse> {
    const startedAt = Date.now();
    const limit = Math.min(
      Math.max(
        request.limit ?? DEFAULT_LIMIT_BY_SURFACE[request.surface] ?? 3,
        1,
      ),
      HARD_LIMIT,
    );

    const preliminaryNormalized = normalizeContextQuery(request);
    if (preliminaryNormalized.rejectedReason === 'low_information_meeting_context') {
      const autopilot = buildAutopilotDecision({
        request,
        sceneAnchors: extractSceneAnchors(
          request,
          preliminaryNormalized.query,
        ),
        matches: [],
        candidateCount: 0,
        hiddenCount: 0,
        lowInformationCount: 0,
        sourceExcludedCount: 0,
        duplicateMergedCount: 0,
        quietReasons: [
          {
            reason: preliminaryNormalized.rejectedReason,
            count: 1,
          },
        ],
      });
      return {
        matches: [],
        topMatch: null,
        queryTimeMs: Date.now() - startedAt,
        autopilot,
        debug: request.debug
          ? {
              normalizedQuery: preliminaryNormalized.query,
              channelsHit: [],
              rejectedReason: preliminaryNormalized.rejectedReason,
              autopilot,
            }
          : undefined,
      };
    }

    const expansion = this.contextExpansion.expand({
      query: [request.title, request.primaryText].filter(Boolean).join(' '),
      surface: request.surface,
      contextType: request.contextType,
      title: request.title,
      sourceContext: request.sourceContext,
      currentContext: request.currentContext,
      secondaryTexts: request.secondaryTexts,
      entityHints: request.entityHints,
      scope: request.scope,
      sourceTypes: request.sourceTypes,
    });
    const expandedRequest = applyContextExpansion(request, expansion);
    const normalized = normalizeContextQuery(expandedRequest);
    const debug: ContextRecallDebug | undefined = request.debug
      ? {
          normalizedQuery: normalized.query,
          channelsHit: [] as string[],
          contextExpansion: {
            expandedQuery: expansion.expandedQuery,
            addedTerms: expansion.addedTerms,
            resolvedProject: expansion.resolvedProject,
            resolvedRole: expansion.resolvedRole,
            ambiguity: expansion.ambiguity,
            sourceAnchors: expansion.sourceAnchors,
            contextMatch: expansion.contextMatch,
          },
        }
      : undefined;

    if (expansion.ambiguity?.state === 'ambiguous') {
      const autopilot = buildAutopilotDecision({
        request: expandedRequest,
        sceneAnchors: extractSceneAnchors(expandedRequest, normalized.query),
        matches: [],
        candidateCount: 0,
        hiddenCount: 0,
        lowInformationCount: 0,
        sourceExcludedCount: 0,
        duplicateMergedCount: 0,
        quietReasons: [{ reason: 'ambiguous_context', count: 1 }],
      });
      return {
        matches: [],
        topMatch: null,
        queryTimeMs: Date.now() - startedAt,
        autopilot,
        debug: debug
          ? { ...debug, rejectedReason: 'ambiguous_context', autopilot }
          : undefined,
      };
    }

    if (!normalized.usable) {
      const rehearsalMatches = this.rehearsalActivation.getMatches(
        expandedRequest,
        limit,
      );
      const autopilot = buildAutopilotDecision({
        request: expandedRequest,
        sceneAnchors: extractSceneAnchors(expandedRequest, normalized.query),
        matches: rehearsalMatches,
        candidateCount: rehearsalMatches.length,
        hiddenCount: 0,
        lowInformationCount: 0,
        sourceExcludedCount: 0,
        duplicateMergedCount: 0,
        quietReasons: normalized.rejectedReason
          ? [{ reason: normalized.rejectedReason, count: 1 }]
          : [],
      });
      return {
        matches: rehearsalMatches,
        topMatch: rehearsalMatches[0] ?? null,
        queryTimeMs: Date.now() - startedAt,
        autopilot,
        debug: debug
          ? { ...debug, rejectedReason: normalized.rejectedReason, autopilot }
          : undefined,
      };
    }

    // Pin to vector + fts. Graph & time would slow us down without much win
    // for purely associative cases.
    const requestedSourceTypes = expandedRequest.sourceTypes ?? [];
    const sourceMemoryRequested =
      requestedSourceTypes.includes('source_memory');
    const sourceMemoryOnly =
      requestedSourceTypes.length > 0 &&
      requestedSourceTypes.every(
        (sourceType) => sourceType === 'source_memory',
      );
    const recallQuery: RecallQuery = {
      query: normalized.query,
      scope: (expandedRequest.scope ?? 'all') as ContextRecallScope,
      topK: limit * CONTEXT_OVER_FETCH_FACTOR,
      channels: ['vector', 'fts'],
      sourceTypes: expandSourceMemorySourceTypes(requestedSourceTypes),
      includeMetadata: true,
      presentationHint: 'compact',
      lifecycleMode:
        expandedRequest.surface === 'composer_guard'
          ? 'composer_surface'
          : 'passive_surface',
      previewMaxLength: PREVIEW_MAX,
      // No blockTypes → engine returns evidence-only, fast path.
    };

    const result = sourceMemoryOnly
      ? {
          items: [],
          totalFound: 0,
          queryTimeMs: 0,
          channels: ['source_memory'],
        }
      : await this.engine.recall(recallQuery, {
          reinforceAccess: false,
        });
    if (debug) debug.channelsHit = result.channels;

    const sceneAnchors = extractSceneAnchors(expandedRequest, normalized.query);
    let lowInformationMatches = 0;
    let sourceExcludedCount = 0;
    const filteredItems = result.items.filter((item) => {
      if (
        !shouldIncludeSourceMemoryItem(
          item,
          requestedSourceTypes,
          sourceMemoryRequested,
        )
      ) {
        sourceExcludedCount += 1;
        return false;
      }
      if (shouldExcludeBySourceContext(item, expandedRequest)) {
        sourceExcludedCount += 1;
        return false;
      }
      return true;
    });
    const rawMatches = filteredItems
      .map((item) => {
        const match = toContextMatch(item, expandedRequest);
        if (!match) {
          lowInformationMatches += 1;
          return null;
        }
        if (!isDisplayableContextMatch(match)) {
          lowInformationMatches += 1;
          return null;
        }
        return match;
      })
      .filter((m): m is ContextRecallMatch => m != null);
    const clusteredMatches = mergeContextMatchClusters(rawMatches);
    const duplicateMergedCount = countMergedContextMatches(clusteredMatches);
    const rankedMatches = rankContextMatches(
      clusteredMatches,
      normalized.query,
      sceneAnchors,
    );
    const rehearsalMatches = this.rehearsalActivation.getMatches(
      expandedRequest,
      limit,
    );
    const sourceMemoryMatches = sourceMemoryRequested
      ? getSourceMemoryContextMatches(
          this.db,
          expandedRequest,
          normalized.query,
          limit,
        )
      : [];
    const candidateMatches = [
      ...rehearsalMatches,
      ...sourceMemoryMatches,
      ...rankedMatches,
    ];
    const patchedCandidateMatches = this.relevancePatches.applyPatchesToMatches(
      expandedRequest,
      candidateMatches,
    );
    const hiddenCount = patchedCandidateMatches.filter(
      (match) => match.displayPriority === 'hidden',
    ).length;
    const suppressionReasons = Array.from(
      new Set(
        patchedCandidateMatches
          .map((match) => match.suppressionReason)
          .filter((reason): reason is string => Boolean(reason)),
      ),
    );
    let displayFilteredMatches = 0;
    const matches = patchedCandidateMatches
      .filter((match) => {
        if (!isDisplayableContextMatch(match)) {
          displayFilteredMatches += 1;
          return false;
        }
        return true;
      })
      .sort(compareContextMatches)
      .slice(0, limit);

    let rejectedReason: string | undefined;
    if (
      matches.length === 0 &&
      (lowInformationMatches > 0 ||
        displayFilteredMatches > 0 ||
        sourceExcludedCount > 0)
    ) {
      rejectedReason = LOW_INFORMATION_REJECT_REASON;
      if (debug) debug.rejectedReason = rejectedReason;
    }
    if (debug && suppressionReasons.length) {
      debug.suppressionReasons = suppressionReasons;
    }
    const autopilot = buildAutopilotDecision({
      request: expandedRequest,
      sceneAnchors,
      matches,
      candidateCount:
        result.items.length + rehearsalMatches.length + sourceMemoryMatches.length,
      hiddenCount,
      lowInformationCount: lowInformationMatches,
      sourceExcludedCount,
      duplicateMergedCount,
      quietReasons: buildAutopilotQuietReasons({
        rankedMatches: patchedCandidateMatches,
        lowInformationCount: lowInformationMatches,
        sourceExcludedCount,
        duplicateMergedCount,
        rejectedReason,
      }),
    });
    if (debug) {
      debug.autopilot = autopilot;
    }

    return {
      matches,
      topMatch: matches[0] ?? null,
      queryTimeMs: Date.now() - startedAt,
      autopilot,
      debug,
    };
  }
}

function applyContextExpansion(
  request: ContextRecallRequest,
  expansion: RecallContextExpansion,
): ContextRecallRequest {
  const addedTerms = expansion.addedTerms.filter(Boolean);
  const expansionText = addedTerms.length
    ? `Resolved context: ${addedTerms.join(' ')}`
    : '';
  const current = request.currentContext;
  const sourceContext = {
    ...(request.sourceContext ?? {}),
    title: request.sourceContext?.title ?? current?.title,
    url: request.sourceContext?.url ?? current?.url,
    participants: request.sourceContext?.participants ?? current?.participants,
    groupId: request.sourceContext?.groupId ?? current?.groupId,
    conversationId:
      request.sourceContext?.conversationId ?? current?.conversationId,
    meetingId: request.sourceContext?.meetingId ?? current?.meetingId,
    issueKey: request.sourceContext?.issueKey ?? current?.issueKey,
  };
  const secondaryTexts = [
    ...(request.secondaryTexts ?? []),
    ...(current?.visibleMessages
      ?.slice(-8)
      .map((message) =>
        [message.sender, message.text].filter(Boolean).join(': '),
      ) ?? []),
    ...(current?.sourceAnchorHints ?? []),
    expansionText,
  ].filter((text): text is string => Boolean(text && text.trim()));
  const entityHints = [
    ...(request.entityHints ?? []),
    ...expansion.entityHints,
  ];

  return {
    ...request,
    sourceContext,
    secondaryTexts,
    entityHints: entityHints.length ? entityHints : undefined,
  };
}

interface NormalizedContextQuery {
  usable: boolean;
  query: string;
  rejectedReason?: string;
}

function normalizeContextQuery(
  req: ContextRecallRequest,
): NormalizedContextQuery {
  const parts: string[] = [];
  if (req.title) parts.push(req.title.trim());
  if (req.primaryText) parts.push(takeMeaningful(req.primaryText, 360));
  if (req.secondaryTexts?.length) {
    for (const txt of req.secondaryTexts) {
      const cleaned = takeMeaningful(txt, 160);
      if (cleaned) parts.push(cleaned);
    }
  }
  if (req.entityHints?.length) {
    parts.push(req.entityHints.map((h) => h.value).join(' '));
  }

  const raw = parts.filter(Boolean).join(' ');
  const compact = raw.replace(/\s+/g, ' ').trim().slice(0, MAX_QUERY_CHARS);

  if (compact.length < MIN_QUERY_CHARS) {
    return { usable: false, query: compact, rejectedReason: 'query_too_short' };
  }

  if (isLowInformationCurrentMeetingRequest(req, compact)) {
    return {
      usable: false,
      query: compact,
      rejectedReason: 'low_information_meeting_context',
    };
  }

  // Signal ratio = (alphanumeric+CJK) / total length
  const signal = (compact.match(/[\p{Letter}\p{Number}]/gu) || []).length;
  if (signal / compact.length < MIN_SIGNAL_RATIO) {
    return {
      usable: false,
      query: compact,
      rejectedReason: 'low_signal_payload',
    };
  }

  return { usable: true, query: compact };
}

function expandSourceMemorySourceTypes(
  sourceTypes?: RecallSourceType[],
): RecallSourceType[] | undefined {
  if (!sourceTypes?.length) return sourceTypes;
  const expanded = new Set<RecallSourceType>();
  for (const sourceType of sourceTypes) {
    if (sourceType === 'source_memory') {
      expanded.add('web');
      continue;
    }
    expanded.add(sourceType);
  }
  return Array.from(expanded);
}

function shouldIncludeSourceMemoryItem(
  item: RecallItem,
  requestedSourceTypes: RecallSourceType[],
  sourceMemoryRequested: boolean,
): boolean {
  if (!sourceMemoryRequested) return true;
  if (isSourceMemoryRecallItem(item)) return true;

  const nonSourceMemoryTypes = requestedSourceTypes.filter(
    (sourceType) => sourceType !== 'source_memory',
  );
  if (nonSourceMemoryTypes.length === 0) return false;
  return Boolean(
    item.source &&
      nonSourceMemoryTypes.some((sourceType) => sourceType === item.source),
  );
}

function isSourceMemoryRecallItem(item: RecallItem): boolean {
  return Boolean(item.metadata?.sourceMemoryCapsuleId);
}

function getSourceMemoryContextMatches(
  db: Database.Database,
  req: ContextRecallRequest,
  query: string,
  limit: number,
): ContextRecallMatch[] {
  const terms = extractSourceMemorySearchTerms(query);
  if (terms.length === 0) return [];

  const rows = db
    .prepare(
      `SELECT
         c.id,
         c.source_kind,
         c.source_url,
         c.source_title,
         c.capture_mode,
         c.summary,
         c.content_preview,
         c.message_id,
         c.created_at,
         c.updated_at,
         (
           SELECT a.quote_or_preview
           FROM source_memory_anchors a
           WHERE a.capsule_id = c.id
           ORDER BY a.created_at ASC
           LIMIT 1
         ) AS anchor_preview,
         (
           SELECT GROUP_CONCAT(t.title || ' ' || t.body, ' ')
           FROM source_memory_takeaways t
           WHERE t.capsule_id = c.id
         ) AS takeaway_text
       FROM source_memory_capsules c
       WHERE c.status = 'saved'
       ORDER BY c.updated_at DESC
       LIMIT 80`,
    )
    .all() as SourceMemoryContextRow[];

  const currentUrls = [
    req.url,
    req.sourceContext?.url,
    ...(req.exclude?.urls ?? []),
  ]
    .map(normalizeUrlForCompare)
    .filter(Boolean);

  return rows
    .map((row) => {
      const recallFeedback = getRecallFeedbackAction(
        db,
        'source_memory',
        row.id,
      );
      if (recallFeedback === 'negative') return null;

      const sourceUrl = row.source_url ?? undefined;
      const normalizedSourceUrl = normalizeUrlForCompare(sourceUrl);
      if (normalizedSourceUrl && currentUrls.includes(normalizedSourceUrl)) {
        return null;
      }

      const haystack = normalizeInformationText(
        [
          row.source_title,
          row.summary,
          row.content_preview,
          row.anchor_preview,
          row.takeaway_text,
          sourceUrl,
        ]
          .filter(Boolean)
          .join(' '),
      ).toLowerCase();
      const matchedTerms = terms.filter((term) =>
        haystack.includes(term.toLowerCase()),
      );
      if (matchedTerms.length === 0) return null;

      const overlapScore = Math.min(0.22, matchedTerms.length * 0.07);
      const feedbackBoost = recallFeedback === 'positive' ? 0.08 : 0;
      const score = Math.min(0.97, 0.58 + overlapScore + feedbackBoost);
      const snippet = clipContextText(
        row.summary ||
          row.content_preview ||
          row.anchor_preview ||
          row.source_title,
        PREVIEW_MAX,
      );
      if (!snippet) return null;

      const whyRelevant = [
        matchedTerms.length
          ? `命中资料关键词：${matchedTerms.slice(0, 3).join(' / ')}`
          : '',
        row.source_title ? `来源：${row.source_title}` : '',
      ].filter(Boolean);

      return {
        id: `source-memory:${row.id}`,
        type: 'source_memory',
        score,
        title: row.source_title,
        snippet,
        sourceLabel: 'source_memory',
        sourceUrl,
        sourceTitle: row.source_title,
        exploreLink: `#/source-memory/${encodeURIComponent(row.id)}`,
        links: sourceUrl ? [{ label: '打开来源', url: sourceUrl }] : [],
        whyMatched: '资料记忆与当前上下文有关键词重合',
        whyRelevant,
        reasonType: 'keyword',
        evidenceRole: 'artifact',
        displayPriority: matchedTerms.length >= 2 ? 'p1' : 'p2',
        metadata: {
          sourceMemoryCapsuleId: row.id,
          sourceKind: row.source_kind,
          captureMode: row.capture_mode,
          matchedTerms,
          ...(recallFeedback ? { recallFeedback } : {}),
        },
        sourceClusterKey: `source-memory:${row.id}`,
        timestamp: row.updated_at || row.created_at,
      } as ContextRecallMatch;
    })
    .filter((match): match is ContextRecallMatch => match != null)
    .sort(compareContextMatches)
    .slice(0, limit);
}

function extractSourceMemorySearchTerms(query: string): string[] {
  const normalized = normalizeInformationText(query);
  const latinTerms =
    normalized.toLowerCase().match(/[a-z0-9][a-z0-9_-]{2,}/g) ?? [];
  const cjkTerms = normalized.match(/[\u3400-\u9fff]{2,}/g) ?? [];
  return Array.from(new Set([...latinTerms, ...cjkTerms]))
    .filter((term) => !GENERIC_CONTEXT_TERMS.has(term))
    .slice(0, 12);
}

function isLowInformationCurrentMeetingRequest(
  req: ContextRecallRequest,
  compactQuery: string,
): boolean {
  if (req.surface !== 'meeting_passive') return false;
  const contextText = normalizeInformationText(
    [compactQuery, req.sourceContext?.title, req.sourceContext?.topic]
      .filter(Boolean)
      .join(' '),
  );
  if (!contextText) return true;
  if (hasSpecificContextSignal(contextText)) return false;
  if (ISSUE_KEY_PATTERN.test(contextText)) return false;

  const stripped = contextText
    .replace(/\bringcentral\s+video\b/gi, ' ')
    .replace(/\byou'?re\s+the\s+only\s+one\s+here\b/gi, ' ')
    .replace(/\binvite\s+others?\b/gi, ' ')
    .replace(
      /\b(?:brb|mute|unmute|start\s+video|share|participants?|chat|react|raise\s+hand|notes|more|leave|waiting\s+room)\b/gi,
      ' ',
    )
    .replace(/会议|参会人|邀请|举手|聊天|离开|静音|开启视频|共享屏幕/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  return (
    countMeaningfulTokens(stripped) < 3 && countCjkSignalChars(stripped) < 8
  );
}

function takeMeaningful(value: string, maxLen: number): string {
  if (!value) return '';
  // Strip basic HTML if a caller forgot to.
  const noHtml = value.replace(/<[^>]+>/g, ' ');
  // Drop URLs (they bias the embedding) and excess whitespace.
  const noUrls = noHtml.replace(/https?:\/\/\S+/g, ' ');
  const compact = noUrls.replace(/\s+/g, ' ').trim();
  if (compact.length <= maxLen) return compact;
  return `${compact.slice(0, maxLen).trimEnd()}…`;
}

function toContextMatch(
  item: RecallItem,
  req: ContextRecallRequest,
): ContextRecallMatch | null {
  const isSourceMemory = isSourceMemoryRecallItem(item);
  const presentation = buildRecallPresentation({
    content: item.displayText || item.content || '',
    query: req.title || req.primaryText || '',
    source: item.source,
    sourceTitle: item.sourceTitle,
    presentationHint: 'compact',
    previewMaxLength: PREVIEW_MAX,
  });

  const exploreLink =
    item.exploreLink ||
    buildExploreLink({
      type: item.type,
      id: item.id,
      conversationId:
        (item.metadata?.conversationId as string | undefined) ||
        (item.metadata?.conversation_id as string | undefined),
      entityType: item.entity?.type,
      entity: item.entity,
    });

  if (!presentation.previewText && !item.displayTitle) {
    return null;
  }

  const uiSummary = selectContextUiSummary(item, presentation.previewText);
  const snippet = selectContextSnippet(
    item,
    presentation.previewText,
    uiSummary,
  );
  const title = selectContextTitle(
    item,
    presentation.displayTitle,
    uiSummary,
    snippet,
  );

  const links: Array<{ label: string; url: string }> = [];
  if (item.sourceUrl) {
    links.push({ label: '打开来源', url: item.sourceUrl });
  }

  return {
    id: isSourceMemory
      ? `source-memory:${String(item.metadata?.sourceMemoryCapsuleId)}`
      : item.id,
    type: isSourceMemory ? 'source_memory' : item.type,
    score: item.score,
    title,
    snippet,
    sourceLabel: isSourceMemory ? 'source_memory' : item.source,
    sourceUrl: item.sourceUrl,
    sourceTitle: item.sourceTitle,
    exploreLink,
    links,
    whyMatched: explainMatch(item, req),
    uiSummary,
    reasonType: getReasonType(item),
    evidenceRole: getEvidenceRole(item),
    displayPriority: getDisplayPriority(item),
    metadata: item.metadata,
    sourceClusterKey: getSourceClusterKey(item),
    timestamp: item.timestamp,
  };
}

function selectContextUiSummary(
  item: RecallItem,
  previewText?: string,
): string {
  const preview = normalizeInformationText(previewText || item.previewText);
  const metadataSummary = getMetadataSummaryText(item.metadata);
  const actionSummary = getMetadataActionText(item.metadata);
  const contextMessage = getMetadataContextMessageText(item.metadata);

  const shouldPreferMetadataSummary =
    metadataSummary &&
    (!preview ||
      isLowInformationPreview(preview) ||
      metadataSummary.length > preview.length + 24);
  if (shouldPreferMetadataSummary) {
    return clipContextText(metadataSummary, UI_SUMMARY_MAX);
  }
  if (preview) return clipContextText(preview, UI_SUMMARY_MAX);
  if (metadataSummary) return clipContextText(metadataSummary, UI_SUMMARY_MAX);
  if (actionSummary) return clipContextText(actionSummary, UI_SUMMARY_MAX);
  if (contextMessage) return clipContextText(contextMessage, UI_SUMMARY_MAX);
  return clipContextText(
    item.displayText || item.content || '',
    UI_SUMMARY_MAX,
  );
}

function selectContextSnippet(
  item: RecallItem,
  previewText: string | undefined,
  uiSummary: string,
): string {
  const preview = normalizeInformationText(previewText || item.previewText);
  const contextMessage = getMetadataContextMessageText(item.metadata);
  const actionSummary = getMetadataActionText(item.metadata);
  const fallback = normalizeInformationText(item.displayText || item.content);
  const candidate =
    preview && !isLowInformationPreview(preview)
      ? preview
      : contextMessage || actionSummary || preview || fallback || uiSummary;
  return clipContextText(candidate, PREVIEW_MAX);
}

function selectContextTitle(
  item: RecallItem,
  presentationTitle: string | undefined,
  uiSummary: string,
  snippet: string,
): string | undefined {
  const metadataSummary = getMetadataSummaryText(item.metadata);
  const actionSummary = getMetadataActionText(item.metadata);
  const contextMessage = getMetadataContextMessageText(item.metadata);
  const candidates = [
    metadataSummary,
    actionSummary,
    contextMessage,
    item.displayTitle,
    presentationTitle,
    item.sourceTitle,
    uiSummary,
    snippet,
  ];

  for (const candidate of candidates) {
    const title = cleanContextTitleCandidate(candidate, item.source);
    if (title) return title;
  }
  return undefined;
}

function cleanContextTitleCandidate(
  value?: string | null,
  sourceLabel?: string | null,
): string | undefined {
  const cleaned = stripLowInformationLead(value || '')
    .replace(/^[-*•\s]+/, '')
    .replace(/^\d+[.)、]\s*/, '')
    .replace(/^📅\s*/, '')
    .replace(/^时间\s*[:：]\s*/i, '')
    .replace(/^@?[\p{Letter}\p{Mark}\s.'()_-]{1,64}\s+wrote\s*[:：]\s*/iu, '')
    .replace(
      /^[\p{Letter}\p{Mark}\s.'()_-]{1,64}\s+shared\s+a\s+(?:message|file)\s*/iu,
      '',
    )
    .trim();
  if (!cleaned) return undefined;

  const firstLine = cleaned
    .split(/\n+/)
    .map((line) => normalizeInformationText(line))
    .find(Boolean);
  const sentence = (firstLine || cleaned)
    .split(/(?<=[。！？!?])\s+|[;；]\s*/)
    .map((part) => part.trim())
    .find(Boolean);
  const candidate = clipContextText(sentence || firstLine || cleaned, 86);
  if (isLowInformationTitle(candidate, sourceLabel)) return undefined;
  return candidate;
}

function isLowInformationTitle(
  value?: string | null,
  sourceLabel?: string | null,
): boolean {
  const cleaned = normalizeInformationText(value);
  if (!cleaned) return true;
  const comparable = normalizeComparableText(cleaned);
  if (!comparable) return true;
  if (GENERIC_SOURCE_TITLES.has(comparable)) return true;
  if (sourceLabel && comparable === normalizeComparableText(sourceLabel))
    return true;
  if (LOW_INFORMATION_TITLE_PATTERN.test(cleaned)) return true;
  if (
    /^(?:\d{4}[ 年/-])?\d{1,2}[ 月/-]\d{1,2}|(?:mon|tue|wed|thu|fri|sat|sun)\b/i.test(
      cleaned,
    ) &&
    !hasSpecificContextSignal(cleaned) &&
    countMeaningfulTokens(cleaned) < 2 &&
    countCjkSignalChars(cleaned) < 4
  ) {
    return true;
  }
  return (
    !hasSpecificContextSignal(cleaned) &&
    countMeaningfulTokens(cleaned) < 2 &&
    countCjkSignalChars(cleaned) < 4
  );
}

function getMetadataSummaryText(metadata?: Record<string, any>): string {
  return normalizeInformationText(
    typeof metadata?.summary === 'string'
      ? metadata.summary
      : typeof metadata?.metadata?.summary === 'string'
      ? metadata.metadata.summary
      : '',
  );
}

function getMetadataActionText(metadata?: Record<string, any>): string {
  const actions = Array.isArray(metadata?.actions) ? metadata.actions : [];
  const descriptions = actions
    .map((action) => {
      if (!action || typeof action !== 'object') return '';
      const description =
        typeof action.description === 'string' ? action.description : '';
      const status = typeof action.status === 'string' ? action.status : '';
      return normalizeInformationText(
        [description, status].filter(Boolean).join(' '),
      );
    })
    .filter(Boolean);
  return descriptions.length ? descriptions.slice(0, 2).join(' / ') : '';
}

function getMetadataContextMessageText(metadata?: Record<string, any>): string {
  const messages = Array.isArray(metadata?.contextMessages)
    ? metadata.contextMessages
    : [];
  const candidates = messages
    .map((message) => {
      if (!message || typeof message !== 'object') return '';
      const raw = typeof message.content === 'string' ? message.content : '';
      const text = clipContextText(
        stripLowInformationLead(raw.replace(/https?:\/\/\S+/g, ' ')),
        UI_SUMMARY_MAX,
      );
      if (!text) return '';
      return {
        isMainMessage: Boolean(message.isMainMessage),
        text,
      };
    })
    .filter(
      (candidate): candidate is { isMainMessage: boolean; text: string } =>
        typeof candidate === 'object' &&
        candidate != null &&
        typeof candidate.text === 'string' &&
        candidate.text.length > 0,
    );
  const specificNonMain = candidates.find(
    (candidate) =>
      !candidate.isMainMessage && hasSpecificContextSignal(candidate.text),
  );
  const specific = candidates.find((candidate) =>
    hasSpecificContextSignal(candidate.text),
  );
  return specificNonMain?.text || specific?.text || candidates[0]?.text || '';
}

function extractMetadataSearchText(metadata?: Record<string, any>): string {
  if (!metadata) return '';
  const parts: string[] = [
    getMetadataSummaryText(metadata),
    getMetadataActionText(metadata),
    getMetadataContextMessageText(metadata),
  ];
  const entities = metadata.entities;
  if (entities && typeof entities === 'object') {
    for (const value of Object.values(entities)) {
      if (!Array.isArray(value)) continue;
      for (const item of value.slice(0, 5)) {
        if (!item || typeof item !== 'object') continue;
        const record = item as Record<string, unknown>;
        parts.push(
          normalizeInformationText(
            [
              record.name,
              record.title,
              record.summary,
              record.description,
              record.category,
            ]
              .filter((entry): entry is string => typeof entry === 'string')
              .join(' '),
          ),
        );
      }
    }
  }
  const nestedMetadata = metadata.metadata;
  if (nestedMetadata && typeof nestedMetadata === 'object') {
    const tags = (nestedMetadata as Record<string, unknown>).tags;
    const category = (nestedMetadata as Record<string, unknown>).category;
    if (Array.isArray(tags))
      parts.push(tags.filter((tag) => typeof tag === 'string').join(' '));
    if (Array.isArray(category)) {
      parts.push(
        category.filter((entry) => typeof entry === 'string').join(' '),
      );
    } else if (typeof category === 'string') {
      parts.push(category);
    }
  }
  return parts.filter(Boolean).join(' ');
}

function stripLowInformationLead(value: string): string {
  const lines = value
    .replace(/<[^>]+>/g, ' ')
    .split(/\n+/)
    .map((line) => normalizeInformationText(line))
    .filter(Boolean);
  while (lines.length > 1 && isLowInformationPreview(lines[0])) {
    lines.shift();
  }
  return normalizeInformationText(lines.join(' '));
}

function isLowInformationPreview(value?: string | null): boolean {
  const cleaned = normalizeInformationText(value);
  if (!cleaned) return true;
  if (LOW_INFORMATION_PREVIEW_PATTERN.test(cleaned)) return true;
  if (
    /^@?[\p{Letter}\p{Mark}\s.'()_-]{1,64}\s+wrote\s*[:：]?$/iu.test(cleaned)
  ) {
    return true;
  }
  return (
    countMeaningfulTokens(cleaned) < 3 &&
    countCjkSignalChars(cleaned) < 8 &&
    !hasSpecificContextSignal(cleaned)
  );
}

function clipContextText(value: string, maxLength: number): string {
  const cleaned = normalizeInformationText(value);
  if (cleaned.length <= maxLength) return cleaned;
  return `${cleaned.slice(0, maxLength).trimEnd()}…`;
}

function shouldExcludeBySourceContext(
  item: RecallItem,
  req: ContextRecallRequest,
): boolean {
  const metadata = item.metadata ?? {};
  if (metadata.recallFeedback === 'negative') return true;

  const itemId = String(item.id);
  if (req.exclude?.ids?.some((id) => String(id) === itemId)) return true;

  const currentUrls = [
    req.url,
    req.sourceContext?.url,
    ...(req.exclude?.urls ?? []),
  ]
    .map(normalizeUrlForCompare)
    .filter(Boolean);
  const itemUrl = normalizeUrlForCompare(item.sourceUrl);
  if (itemUrl && currentUrls.includes(itemUrl)) return true;

  const sourceIds = getItemSourceIds(item);
  const blockedMeetingIds = new Set(
    [req.sourceContext?.meetingId, ...(req.exclude?.meetingIds ?? [])].filter(
      Boolean,
    ),
  );
  const blockedGroupIds = new Set(
    [...(req.exclude?.groupIds ?? [])].filter(Boolean),
  );
  if (
    sourceIds.meetingIds.some((id) => blockedMeetingIds.has(id)) ||
    sourceIds.groupIds.some((id) => blockedGroupIds.has(id))
  ) {
    return true;
  }

  const blockedConversationIds = new Set(
    [...(req.exclude?.conversationIds ?? [])].filter(Boolean),
  );
  if (sourceIds.conversationIds.some((id) => blockedConversationIds.has(id))) {
    return true;
  }

  if (isLowQualityMeetingBoilerplate(item)) return true;

  return false;
}

function mergeContextMatchClusters(
  matches: ContextRecallMatch[],
): ContextRecallMatch[] {
  const byCluster = new Map<string, ContextRecallMatch>();
  const ordered: ContextRecallMatch[] = [];

  for (const match of matches) {
    const clusterKey = match.sourceClusterKey;
    if (!clusterKey) {
      ordered.push(match);
      continue;
    }

    const existing = byCluster.get(clusterKey);
    if (!existing) {
      match.mergedCount = 1;
      match.mergedIds = [match.id];
      byCluster.set(clusterKey, match);
      ordered.push(match);
      continue;
    }

    existing.mergedCount = (existing.mergedCount ?? 1) + 1;
    existing.mergedIds = Array.from(
      new Set([...(existing.mergedIds ?? [existing.id]), match.id]),
    );
    existing.score = Math.max(existing.score, match.score);
    if (
      getDisplayPriorityRank(match.displayPriority) >
      getDisplayPriorityRank(existing.displayPriority)
    ) {
      existing.displayPriority = match.displayPriority;
    }
    if (
      match.timestamp &&
      (!existing.timestamp || match.timestamp > existing.timestamp)
    ) {
      existing.timestamp = match.timestamp;
    }
    if (
      match.snippet.length > existing.snippet.length &&
      hasSpecificContextSignal(match.snippet)
    ) {
      existing.snippet = match.snippet;
      existing.uiSummary = match.uiSummary;
      existing.title = match.title || existing.title;
      existing.evidenceRole = match.evidenceRole;
    }
  }

  return ordered;
}

function compareContextMatches(
  left: ContextRecallMatch,
  right: ContextRecallMatch,
): number {
  const priorityDelta =
    getDisplayPriorityRank(right.displayPriority) -
    getDisplayPriorityRank(left.displayPriority);
  if (priorityDelta !== 0) return priorityDelta;
  return right.score - left.score;
}

function countMergedContextMatches(matches: ContextRecallMatch[]): number {
  return matches.reduce(
    (sum, match) => sum + Math.max(0, (match.mergedCount ?? 1) - 1),
    0,
  );
}

interface AutopilotQuietReasonInput {
  reason: string;
  count: number;
}

interface BuildAutopilotQuietReasonInput {
  rankedMatches: ContextRecallMatch[];
  lowInformationCount: number;
  sourceExcludedCount: number;
  duplicateMergedCount: number;
  rejectedReason?: string;
}

interface BuildAutopilotDecisionInput {
  request: ContextRecallRequest;
  sceneAnchors: AnchorBuckets;
  matches: ContextRecallMatch[];
  candidateCount: number;
  hiddenCount: number;
  lowInformationCount: number;
  sourceExcludedCount: number;
  duplicateMergedCount: number;
  quietReasons: AutopilotQuietReasonInput[];
}

function buildAutopilotQuietReasons(
  input: BuildAutopilotQuietReasonInput,
): AutopilotQuietReasonInput[] {
  const counts = new Map<string, number>();
  const add = (reason: string | undefined, count = 1): void => {
    if (!reason || count <= 0) return;
    counts.set(reason, (counts.get(reason) ?? 0) + count);
  };

  for (const match of input.rankedMatches) {
    if (match.displayPriority !== 'hidden') continue;
    add(match.suppressionReason || 'weak_semantic_only');
  }
  add('low_information_match', input.lowInformationCount);
  add('source_context_excluded', input.sourceExcludedCount);
  add('duplicate_source_cluster', input.duplicateMergedCount);
  if (input.rejectedReason && counts.size === 0) add(input.rejectedReason);

  return Array.from(counts.entries()).map(([reason, count]) => ({
    reason,
    count,
  }));
}

function buildAutopilotDecision(
  input: BuildAutopilotDecisionInput,
): ContextRecallAutopilotDecision {
  const shownMatches = input.matches.filter(isDisplayableContextMatch);
  const strongCount = shownMatches.filter(
    (match) => match.displayPriority === 'p1',
  ).length;
  const possibleCount = shownMatches.filter(
    (match) => match.displayPriority === 'p2',
  ).length;
  const quietedCount =
    input.hiddenCount +
    input.lowInformationCount +
    input.sourceExcludedCount +
    input.duplicateMergedCount;
  const mode = selectAutopilotMode(
    input.request,
    shownMatches.length,
    strongCount,
  );
  const quietReasons = normalizeAutopilotQuietReasons(input.quietReasons);
  const gates = buildAutopilotGates(input, quietReasons);

  return {
    mode,
    summary: buildAutopilotSummary({
      mode,
      strongCount,
      possibleCount,
      shownCount: shownMatches.length,
      quietedCount,
      quietReasons,
    }),
    candidateCount: input.candidateCount,
    shownCount: shownMatches.length,
    strongCount,
    possibleCount,
    quietedCount,
    hiddenCount: input.hiddenCount,
    lowInformationCount: input.lowInformationCount,
    sourceExcludedCount: input.sourceExcludedCount,
    duplicateMergedCount: input.duplicateMergedCount,
    quietReasons,
    sceneAnchors: serializeSceneAnchors(input.sceneAnchors),
    gates,
  };
}

function selectAutopilotMode(
  request: ContextRecallRequest,
  shownCount: number,
  strongCount: number,
): ContextRecallAutopilotDecision['mode'] {
  if (shownCount <= 0) return 'silent';
  if (request.surface === 'composer_guard') return 'context_pack';
  if (strongCount > 0) return 'card';
  return 'chip';
}

function normalizeAutopilotQuietReasons(
  reasons: AutopilotQuietReasonInput[],
): ContextRecallAutopilotDecision['quietReasons'] {
  const counts = new Map<string, number>();
  for (const item of reasons) {
    if (!item.reason || item.count <= 0) continue;
    counts.set(item.reason, (counts.get(item.reason) ?? 0) + item.count);
  }

  return Array.from(counts.entries())
    .map(([reason, count]) => ({
      reason,
      label:
        AUTOPILOT_QUIET_REASON_LABELS[reason] ||
        reason.replace(/[_-]+/g, ' '),
      count,
    }))
    .sort((left, right) => right.count - left.count || left.reason.localeCompare(right.reason));
}

function buildAutopilotGates(
  input: BuildAutopilotDecisionInput,
  quietReasons: ContextRecallAutopilotDecision['quietReasons'],
): string[] {
  const gates = new Set<string>(['attention_budget']);
  if (input.sourceExcludedCount > 0) gates.add('source_context_exclusion');
  if (input.lowInformationCount > 0) gates.add('low_information_gate');
  if (input.hiddenCount > 0 || quietReasons.length > 0)
    gates.add('scene_anchor_gate');
  if (input.duplicateMergedCount > 0) gates.add('same_source_dedup');
  if (input.matches.some((match) => match.whyRelevant?.length))
    gates.add('explainability_required');
  return Array.from(gates);
}

function buildAutopilotSummary(input: {
  mode: ContextRecallAutopilotDecision['mode'];
  strongCount: number;
  possibleCount: number;
  shownCount: number;
  quietedCount: number;
  quietReasons: ContextRecallAutopilotDecision['quietReasons'];
}): string {
  if (input.mode === 'silent') {
    const reason = input.quietReasons[0]?.label;
    return reason
      ? `保持安静：${reason}，共静默 ${input.quietedCount} 条候选。`
      : '保持安静：没有足够具体的场景关联记忆。';
  }
  if (input.mode === 'context_pack') {
    return `提供写作上下文：${input.shownCount} 条候选进入 context pack，${input.quietedCount} 条静默。`;
  }
  if (input.mode === 'card') {
    return `展示强相关卡片：${input.strongCount} 条强相关，${input.quietedCount} 条弱关联静默。`;
  }
  return `低打扰提示：${input.possibleCount || input.shownCount} 条可能相关，${input.quietedCount} 条静默。`;
}

function serializeSceneAnchors(
  anchors: AnchorBuckets,
): ContextRecallAutopilotDecision['sceneAnchors'] | undefined {
  const scene: NonNullable<ContextRecallAutopilotDecision['sceneAnchors']> = {};
  if (anchors.people.size) scene.people = Array.from(anchors.people).slice(0, 6);
  if (anchors.topics.size) scene.topics = Array.from(anchors.topics).slice(0, 8);
  if (anchors.projects.size)
    scene.projects = Array.from(anchors.projects).slice(0, 8);
  if (anchors.source.size) scene.source = Array.from(anchors.source).slice(0, 8);
  return Object.keys(scene).length ? scene : undefined;
}

function rankContextMatches(
  matches: ContextRecallMatch[],
  query: string,
  sceneAnchors: AnchorBuckets,
): ContextRecallMatch[] {
  const querySignals = extractContextSignals(query);
  const specificQuerySignals = getSpecificSignals(querySignals);
  const hasToolSpecificQuery = specificQuerySignals.some((signal) =>
    TOOL_CONTEXT_SIGNAL_KEYS.has(signal),
  );

  return matches.map((match) => {
    const matchText = buildMatchRerankText(match);
    const matchSignals = extractContextSignals(matchText);
    const candidateAnchors = extractMatchAnchors(match);
    const anchorOverlap = intersectAnchors(sceneAnchors, candidateAnchors);
    const anchorOverlapCount = countAnchorOverlap(anchorOverlap);
    const hasTopicOrProjectOverlap =
      anchorOverlap.topics.length > 0 || anchorOverlap.projects.length > 0;
    const hasSourceOverlap = anchorOverlap.source.length > 0;
    const whyRelevant = buildWhyRelevant(anchorOverlap);
    const overlapSignals = specificQuerySignals.filter((signal) =>
      matchSignals.has(signal),
    );
    const hasToolOverlap = overlapSignals.some((signal) =>
      TOOL_CONTEXT_SIGNAL_KEYS.has(signal),
    );
    const hasOffDomainMismatch = Array.from(
      OFF_DOMAIN_CONTEXT_SIGNAL_KEYS,
    ).some((signal) => matchSignals.has(signal) && !querySignals.has(signal));
    let adjustedScore = Number.isFinite(match.score) ? match.score : 0;

    adjustedScore += Math.min(0.32, overlapSignals.length * 0.08);
    adjustedScore += Math.min(0.28, anchorOverlapCount * 0.07);
    if (hasTopicOrProjectOverlap) adjustedScore += 0.08;
    if (hasSourceOverlap) adjustedScore += 0.05;
    if (querySignals.has('spend_limit') && matchSignals.has('spend_limit')) {
      adjustedScore += 0.12;
    }
    if (querySignals.has('usage_alert') && matchSignals.has('spend_limit')) {
      adjustedScore += 0.06;
    }
    for (const toolSignal of TOOL_CONTEXT_SIGNAL_KEYS) {
      if (querySignals.has(toolSignal) && matchSignals.has(toolSignal)) {
        adjustedScore += 0.08;
      }
    }

    if (specificQuerySignals.length > 0 && overlapSignals.length === 0) {
      adjustedScore -= 0.28;
    }
    if (hasToolSpecificQuery && !hasToolOverlap) {
      adjustedScore -= 0.18;
    }
    for (const offDomainSignal of OFF_DOMAIN_CONTEXT_SIGNAL_KEYS) {
      if (
        matchSignals.has(offDomainSignal) &&
        !querySignals.has(offDomainSignal)
      ) {
        adjustedScore -= 0.2;
      }
    }
    if (
      specificQuerySignals.length >= 2 &&
      overlapSignals.length === 0 &&
      matchSignals.has('ai_generic')
    ) {
      adjustedScore -= 0.16;
    }
    if (hasToolSpecificQuery && hasOffDomainMismatch && !hasToolOverlap) {
      adjustedScore -= 0.22;
    }
    if (specificQuerySignals.length > 0 && anchorOverlapCount === 0) {
      adjustedScore -= 0.14;
    }

    const nextScore = Math.max(0, Math.min(0.99, adjustedScore));
    const matchedAnchors = serializeAnchorOverlap(anchorOverlap);
    const nextMatch: ContextRecallMatch = {
      ...match,
      score: nextScore,
      whyRelevant: whyRelevant.length ? whyRelevant : undefined,
      matchedAnchors,
      metadata: {
        ...(match.metadata ?? {}),
        contextRecallRerank: {
          querySignals: Array.from(querySignals),
          matchSignals: Array.from(matchSignals),
          overlapSignals,
          anchorOverlap: matchedAnchors,
          score: nextScore,
        },
      },
    };

    let suppressionReason: SuppressionReason | undefined;
    if (
      specificQuerySignals.length >= 2 &&
      overlapSignals.length === 0 &&
      anchorOverlapCount === 0 &&
      nextMatch.score < 0.55
    ) {
      suppressionReason = 'low_anchor_overlap';
      nextMatch.displayPriority = 'hidden';
    } else if (
      hasToolSpecificQuery &&
      hasOffDomainMismatch &&
      !hasToolOverlap
    ) {
      suppressionReason = 'off_domain_tool_context';
      nextMatch.displayPriority = 'hidden';
    } else if (isBroadcastContextMatch(nextMatch) && anchorOverlapCount === 0) {
      suppressionReason = 'broadcast_without_scene_anchor';
      nextMatch.displayPriority = 'hidden';
    } else if (
      isLowInformationTitle(nextMatch.title, nextMatch.sourceLabel) &&
      anchorOverlapCount === 0
    ) {
      suppressionReason = 'generic_title_without_anchor';
      nextMatch.displayPriority = 'hidden';
    } else if (
      (overlapSignals.length >= 2 && anchorOverlapCount > 0) ||
      (hasTopicOrProjectOverlap &&
        (nextMatch.evidenceRole === 'action_item' ||
          nextMatch.evidenceRole === 'decision' ||
          nextMatch.evidenceRole === 'issue' ||
          nextMatch.evidenceRole === 'risk')) ||
      (querySignals.has('spend_limit') &&
        matchSignals.has('spend_limit') &&
        overlapSignals.length >= 1 &&
        anchorOverlapCount > 0)
    ) {
      nextMatch.displayPriority = 'p1';
    } else if (specificQuerySignals.length > 0 && nextMatch.score < 0.32) {
      suppressionReason = 'weak_semantic_only';
      nextMatch.displayPriority = 'hidden';
    } else if (nextMatch.displayPriority === 'p1' && whyRelevant.length === 0) {
      nextMatch.displayPriority = 'p2';
    } else if (
      nextMatch.displayPriority === 'p1' &&
      !hasTopicOrProjectOverlap &&
      !hasSourceOverlap
    ) {
      nextMatch.displayPriority = 'p2';
    }

    if (nextMatch.displayPriority === 'hidden') {
      nextMatch.suppressionReason = suppressionReason || 'weak_semantic_only';
    }

    return nextMatch;
  });
}

function createAnchorBuckets(): AnchorBuckets {
  return {
    people: new Set<string>(),
    topics: new Set<string>(),
    projects: new Set<string>(),
    source: new Set<string>(),
  };
}

function extractSceneAnchors(
  req: ContextRecallRequest,
  normalizedQuery: string,
): AnchorBuckets {
  const anchors = createAnchorBuckets();
  addAnchorsFromText(anchors, normalizedQuery);
  addAnchorsFromText(anchors, req.title || '');
  addAnchorsFromText(anchors, req.sourceContext?.title || '');
  addAnchorsFromText(anchors, req.sourceContext?.topic || '');
  for (const text of req.secondaryTexts || [])
    addAnchorsFromText(anchors, text);
  for (const participant of req.sourceContext?.participants || []) {
    addAnchor(anchors.people, participant);
  }
  for (const hint of req.entityHints || []) {
    if (/person|participant|sender/i.test(hint.kind)) {
      addAnchor(anchors.people, hint.value);
    } else if (/project|jira|issue/i.test(hint.kind)) {
      addAnchor(anchors.projects, hint.value);
    } else if (/group|conversation|meeting/i.test(hint.kind)) {
      addSourceAnchor(anchors, hint.kind, hint.value);
    } else {
      addAnchor(anchors.topics, hint.value);
    }
  }
  addSourceAnchor(anchors, 'group', req.sourceContext?.groupId);
  addSourceAnchor(anchors, 'conversation', req.sourceContext?.conversationId);
  addSourceAnchor(anchors, 'meeting', req.sourceContext?.meetingId);
  addSourceAnchor(anchors, 'issue', req.sourceContext?.issueKey);
  return anchors;
}

function extractMatchAnchors(match: ContextRecallMatch): AnchorBuckets {
  const anchors = createAnchorBuckets();
  addAnchorsFromText(anchors, buildMatchRerankText(match));
  const metadata = match.metadata ?? {};
  addAnchorsFromMetadata(anchors, metadata);
  addSourceAnchor(
    anchors,
    'group',
    getMetadataString(metadata, 'groupId', 'group_id'),
  );
  addSourceAnchor(
    anchors,
    'conversation',
    getMetadataString(
      metadata,
      'conversationId',
      'conversation_id',
      'threadId',
      'thread_id',
    ),
  );
  addSourceAnchor(
    anchors,
    'meeting',
    getMetadataString(metadata, 'meetingId', 'meeting_id'),
  );
  addSourceAnchor(
    anchors,
    'issue',
    getMetadataString(metadata, 'issueKey', 'issue_key'),
  );
  addAnchor(
    anchors.projects,
    normalizeInformationText(match.sourceTitle || ''),
  );
  return anchors;
}

function addAnchorsFromMetadata(
  anchors: AnchorBuckets,
  metadata?: Record<string, any>,
): void {
  if (!metadata) return;
  const entities = metadata.entities;
  if (entities && typeof entities === 'object') {
    addEntityAnchorArray(anchors.people, entities.people);
    addEntityAnchorArray(anchors.projects, entities.projects);
    addEntityAnchorArray(anchors.topics, entities.topics);
    addEntityAnchorArray(anchors.topics, entities.tools);
  }
  addAnchor(
    anchors.people,
    getMetadataString(metadata, 'sender', 'owner', 'assignee'),
  );
  addAnchor(
    anchors.projects,
    getMetadataString(metadata, 'project', 'relatedProject'),
  );
  addAnchor(
    anchors.source,
    getMetadataString(metadata, 'groupName', 'group_name'),
  );
  const nested = metadata.metadata;
  if (nested && typeof nested === 'object') {
    const tags = (nested as Record<string, unknown>).tags;
    if (Array.isArray(tags)) {
      for (const tag of tags) {
        if (typeof tag === 'string') addAnchor(anchors.topics, tag);
      }
    }
  }
}

function addEntityAnchorArray(target: Set<string>, value: unknown): void {
  if (!Array.isArray(value)) return;
  for (const entry of value.slice(0, 8)) {
    if (typeof entry === 'string') {
      addAnchor(target, entry);
      continue;
    }
    if (!entry || typeof entry !== 'object') continue;
    const record = entry as Record<string, unknown>;
    for (const key of ['name', 'title', 'summary', 'description']) {
      if (typeof record[key] === 'string')
        addAnchor(target, record[key] as string);
    }
  }
}

function addAnchorsFromText(
  anchors: AnchorBuckets,
  value?: string | null,
): void {
  const text = normalizeInformationText(value);
  if (!text) return;

  for (const issueKey of text.match(ISSUE_KEY_PATTERN_GLOBAL) || []) {
    addAnchor(anchors.projects, issueKey);
    addAnchor(anchors.topics, issueKey);
  }

  for (const [signal, pattern] of CONTEXT_SIGNAL_PATTERNS) {
    if (signal === 'ai_generic') continue;
    if (pattern.test(text))
      addAnchor(anchors.topics, CONTEXT_SIGNAL_LABELS[signal]);
  }

  const explicitProjects = [
    ...text.matchAll(/\bProject\s+([A-Za-z][A-Za-z0-9_-]{2,30})\b/g),
    ...text.matchAll(/项目\s*[:：]?\s*([A-Za-z0-9\u3400-\u9fff_-]{2,30})/g),
  ];
  for (const match of explicitProjects) addAnchor(anchors.projects, match[1]);

  const mentionNames = text.match(/@[A-Za-z][A-Za-z0-9._-]{1,40}/g) || [];
  for (const mention of mentionNames)
    addAnchor(anchors.people, mention.replace(/^@/, ''));

  const fullNames = text.match(/\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,2}\b/g) || [];
  for (const name of fullNames) {
    if (
      !/^(Project|RingCentral|Memory|Personal)\b/.test(name) &&
      !GENERIC_SOURCE_TITLES.has(normalizeComparableText(name))
    ) {
      addAnchor(anchors.people, name);
    }
  }

  const productTerms =
    text.match(
      /\b(?:Auto[-\s]?code|Claude(?:\s+Code)?|Codex|Composer|Cursor|FreshService|GPT[-\s]?5(?:\.5)?|MCP|Nova|OpenAI|Personal AI|RingClaw|Runstead|XMN[-\s]?UP)\b/gi,
    ) || [];
  for (const term of productTerms) addAnchor(anchors.topics, term);
}

const ISSUE_KEY_PATTERN_GLOBAL = /\b[A-Z][A-Z0-9]+-\d+\b/g;

function addAnchor(target: Set<string>, value?: string | null): void {
  const cleaned = cleanAnchorLabel(value);
  if (!cleaned) return;
  if (isWeakAnchorLabel(cleaned)) return;
  target.add(cleaned);
}

function addSourceAnchor(
  anchors: AnchorBuckets,
  kind: string,
  value?: string | null,
): void {
  const cleaned = cleanAnchorLabel(value);
  if (!cleaned) return;
  anchors.source.add(`${kind}:${cleaned}`);
}

function cleanAnchorLabel(value?: string | null): string {
  const cleaned = normalizeInformationText(value)
    .replace(/^[@#]+/, '')
    .replace(/^group:|^conversation:|^meeting:|^issue:/i, '')
    .replace(/[，。；;:：]+$/g, '')
    .trim();
  if (!cleaned) return '';
  if (cleaned.length > 48) return '';
  return cleaned;
}

function isWeakAnchorLabel(value: string): boolean {
  const comparable = normalizeComparableText(value);
  if (!comparable) return true;
  if (WEAK_TOPIC_ANCHORS.has(comparable)) return true;
  if (/^\d+$/.test(comparable)) return true;
  return comparable.length < 2 && countCjkSignalChars(value) < 2;
}

function intersectAnchors(
  left: AnchorBuckets,
  right: AnchorBuckets,
): AnchorOverlap {
  return {
    people: intersectAnchorSet(left.people, right.people),
    topics: intersectAnchorSet(left.topics, right.topics),
    projects: intersectAnchorSet(left.projects, right.projects),
    source: intersectAnchorSet(left.source, right.source),
  };
}

function intersectAnchorSet(left: Set<string>, right: Set<string>): string[] {
  const result: string[] = [];
  for (const leftValue of left) {
    const leftNorm = normalizeAnchorForCompare(leftValue);
    if (!leftNorm) continue;
    for (const rightValue of right) {
      const rightNorm = normalizeAnchorForCompare(rightValue);
      if (!rightNorm) continue;
      if (
        leftNorm === rightNorm ||
        (leftNorm.length >= 4 && rightNorm.includes(leftNorm)) ||
        (rightNorm.length >= 4 && leftNorm.includes(rightNorm))
      ) {
        const label = displayAnchorLabel(leftValue, rightValue);
        if (!result.includes(label)) result.push(label);
      }
    }
  }
  return result.slice(0, 5);
}

function normalizeAnchorForCompare(value: string): string {
  return normalizeComparableText(
    value.replace(/^(group|conversation|meeting|issue):/i, ''),
  );
}

function displayAnchorLabel(leftValue: string, rightValue: string): string {
  const candidate =
    leftValue.length <= rightValue.length ? leftValue : rightValue;
  return candidate.replace(/^(group|conversation|meeting|issue):/i, '');
}

function countAnchorOverlap(overlap: AnchorOverlap): number {
  return (
    overlap.people.length +
    overlap.topics.length +
    overlap.projects.length +
    overlap.source.length
  );
}

function serializeAnchorOverlap(
  overlap: AnchorOverlap,
): ContextRecallMatch['matchedAnchors'] | undefined {
  const serialized: ContextRecallMatch['matchedAnchors'] = {};
  if (overlap.people.length) serialized.people = overlap.people;
  if (overlap.topics.length) serialized.topics = overlap.topics;
  if (overlap.projects.length) serialized.projects = overlap.projects;
  if (overlap.source.length) serialized.source = overlap.source;
  return Object.keys(serialized).length ? serialized : undefined;
}

function buildWhyRelevant(overlap: AnchorOverlap): string[] {
  const reasons: string[] = [];
  for (const source of overlap.source.slice(0, 1)) {
    if (source.startsWith('group:') || source.startsWith('conversation:')) {
      reasons.push(`同群：${source.replace(/^(group|conversation):/i, '')}`);
    } else if (source.startsWith('meeting:')) {
      reasons.push(`同会议：${source.replace(/^meeting:/i, '')}`);
    } else if (source.startsWith('issue:')) {
      reasons.push(`同工单：${source.replace(/^issue:/i, '')}`);
    } else {
      reasons.push(`来源：${source}`);
    }
  }
  for (const project of overlap.projects.slice(0, 2)) {
    reasons.push(`项目：${project}`);
  }
  for (const topic of overlap.topics.slice(0, 2)) {
    reasons.push(`主题：${topic}`);
  }
  for (const person of overlap.people.slice(0, 1)) {
    reasons.push(`人物：${person}`);
  }
  return Array.from(new Set(reasons)).slice(0, 4);
}

function isBroadcastContextMatch(match: ContextRecallMatch): boolean {
  const text = normalizeInformationText(
    [match.title, match.uiSummary, match.snippet, match.sourceTitle]
      .filter(Boolean)
      .join(' '),
  );
  return BROADCAST_CONTEXT_PATTERN.test(text);
}

function getMetadataString(
  metadata: Record<string, any> | undefined,
  ...keys: string[]
): string | undefined {
  if (!metadata) return undefined;
  for (const key of keys) {
    const value = metadata[key];
    if (typeof value === 'string' && value.trim()) return value;
  }
  return undefined;
}

function extractContextSignals(value?: string | null): Set<ContextSignalKey> {
  const signals = new Set<ContextSignalKey>();
  const text = normalizeInformationText(value);
  if (!text) return signals;
  for (const [signal, pattern] of CONTEXT_SIGNAL_PATTERNS) {
    if (pattern.test(text)) {
      signals.add(signal);
    }
  }
  return signals;
}

function getSpecificSignals(
  signals: Set<ContextSignalKey>,
): ContextSignalKey[] {
  return Array.from(signals).filter(
    (signal) => !GENERIC_CONTEXT_SIGNAL_KEYS.has(signal),
  );
}

function buildMatchRerankText(match: ContextRecallMatch): string {
  return [
    match.title,
    match.uiSummary,
    match.snippet,
    match.sourceTitle,
    extractMetadataSearchText(match.metadata),
  ]
    .filter(Boolean)
    .join(' ');
}

function getDisplayPriorityRank(
  priority: ContextRecallMatch['displayPriority'],
): number {
  switch (priority) {
    case 'p1':
      return 3;
    case 'p2':
      return 2;
    case 'hidden':
      return 0;
    default:
      return 1;
  }
}

function normalizeUrlForCompare(value?: string | null): string {
  if (!value) return '';
  try {
    const parsed = new URL(value);
    parsed.hash = '';
    parsed.search = '';
    return parsed.toString().replace(/\/$/, '');
  } catch {
    return value
      .trim()
      .replace(/[?#].*$/, '')
      .replace(/\/$/, '')
      .toLowerCase();
  }
}

function getItemSourceIds(item: RecallItem): {
  meetingIds: string[];
  groupIds: string[];
  conversationIds: string[];
} {
  const metadata = item.metadata ?? {};
  const values = (...keys: string[]) =>
    keys
      .map((key) => metadata[key])
      .filter(
        (value): value is string =>
          typeof value === 'string' && value.length > 0,
      );
  return {
    meetingIds: values('meetingId', 'meeting_id'),
    groupIds: values('groupId', 'group_id'),
    conversationIds: values(
      'conversationId',
      'conversation_id',
      'threadId',
      'thread_id',
    ),
  };
}

function getSourceClusterKey(item: RecallItem): string | undefined {
  const ids = getItemSourceIds(item);
  const meetingId = ids.meetingIds[0];
  if (meetingId) {
    return `meeting:${meetingId}`;
  }
  const groupId = ids.groupIds[0];
  if (groupId) {
    return item.source === 'meeting'
      ? `meeting:${groupId}`
      : `group:${groupId}`;
  }
  const conversationId = ids.conversationIds[0];
  if (conversationId) return `conversation:${conversationId}`;
  const url = normalizeUrlForCompare(item.sourceUrl);
  if (url && item.source !== 'web') return `url:${url}`;
  return undefined;
}

function getReasonType(item: RecallItem): ContextRecallMatch['reasonType'] {
  const channels = (item.metadata?.channels as string[] | undefined) || [];
  if (channels.includes('fts')) return 'keyword';
  if (channels.includes('vector')) return 'semantic';
  if (channels.includes('time')) return 'recent';
  if (channels.includes('graph')) return 'entity';
  return 'source';
}

function getEvidenceRole(item: RecallItem): ContextRecallMatch['evidenceRole'] {
  const text = `${item.displayTitle ?? ''} ${item.displayText ?? ''} ${
    item.content ?? ''
  }`;
  if (
    /\b(decision|decided|approved|conclusion)\b/i.test(text) ||
    /决定|结论|批准/.test(text)
  ) {
    return 'decision';
  }
  if (
    /\b(action|todo|follow[-\s]?up|owner|next step)\b/i.test(text) ||
    /待办|行动|负责人|跟进/.test(text)
  ) {
    return 'action_item';
  }
  if (hasSpecificContextSignal(text)) return 'issue';
  return 'context';
}

function getDisplayPriority(
  item: RecallItem,
): ContextRecallMatch['displayPriority'] {
  const text = `${item.displayTitle ?? ''} ${item.displayText ?? ''} ${
    item.content ?? ''
  }`;
  const role = getEvidenceRole(item);
  if (role === 'decision' || role === 'action_item' || role === 'risk') {
    return 'p1';
  }
  if (
    hasSpecificContextSignal(text) ||
    item.metadata?.recallFeedback === 'positive'
  ) {
    return 'p1';
  }
  if (item.score < 0.35 && !isLowScoreKeywordContextCandidate(item)) {
    return 'hidden';
  }
  return 'p2';
}

function isLowScoreKeywordContextCandidate(item: RecallItem): boolean {
  const channels = (item.metadata?.channels as string[] | undefined) || [];
  if (!channels.includes('fts')) return false;
  const text = `${item.displayTitle ?? ''} ${item.displayText ?? ''} ${
    item.content ?? ''
  }`;
  return (
    hasSpecificContextSignal(text) ||
    countMeaningfulTokens(text) >= 3 ||
    countCjkSignalChars(text) >= 8
  );
}

function isLowQualityMeetingBoilerplate(item: RecallItem): boolean {
  if (item.source !== 'meeting' && item.source !== 'calendar') return false;
  const text = normalizeComparableText(
    `${item.displayTitle ?? ''} ${item.displayText ?? ''} ${
      item.content ?? ''
    } ${item.sourceTitle ?? ''}`,
  );
  if (!text) return true;
  if (hasSpecificContextSignal(text)) return false;
  if (
    /\b(join meeting|ringcentral video|video meeting|calendar event|accepted|declined|participants|waiting room|starts at|ends at)\b/i.test(
      text,
    )
  ) {
    return countMeaningfulTokens(text) < 4 && countCjkSignalChars(text) < 8;
  }
  return false;
}

function isDisplayableContextMatch(match: ContextRecallMatch): boolean {
  if (match.displayPriority === 'hidden') return false;

  const title = normalizeInformationText(match.title);
  const uiSummary = normalizeInformationText(match.uiSummary);
  const snippet = normalizeInformationText(match.snippet);
  const sourceTitle = normalizeInformationText(match.sourceTitle);
  const sourceLabel = normalizeInformationText(match.sourceLabel);

  if (!title && !uiSummary && !snippet) return false;

  const combined = [title, uiSummary, snippet, sourceTitle]
    .filter(Boolean)
    .join(' ');
  const comparable = normalizeComparableText(combined);
  if (!comparable) return false;

  const stripped = stripContextShellLabels(combined);
  const hasSpecificSignal = hasSpecificContextSignal(stripped);
  const meaningfulTokenCount = countMeaningfulTokens(stripped);
  const cjkSignalChars = countCjkSignalChars(stripped);

  const duplicatesLabel =
    snippet.length > 0 &&
    [title, sourceTitle, sourceLabel].some((label) =>
      label ? areEquivalentInformationTexts(snippet, label) : false,
    );
  if (
    duplicatesLabel &&
    !hasSpecificSignal &&
    meaningfulTokenCount < 4 &&
    cjkSignalChars < 8
  ) {
    return false;
  }

  if (
    looksLikeContextShell(combined) &&
    !hasSpecificSignal &&
    meaningfulTokenCount < 3 &&
    cjkSignalChars < 8
  ) {
    return false;
  }

  const signalChars = countSignalChars(stripped);
  if (!hasSpecificSignal && signalChars < 10) {
    return false;
  }

  return hasSpecificSignal || meaningfulTokenCount >= 3 || cjkSignalChars >= 8;
}

function normalizeInformationText(value?: string | null): string {
  return (value || '').replace(/\s+/g, ' ').trim();
}

function normalizeComparableText(value: string): string {
  return stripContextShellLabels(value)
    .toLowerCase()
    .replace(/[^a-z0-9\u3400-\u9fff]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function stripContextShellLabels(value: string): string {
  return value
    .replace(
      /\b(calendar event|content|current context|current group|current chat|current thread|group|meeting|memory|related memory|send(?:ing)? location|source|webpage|web page|page)\b\s*[:：-]*/gi,
      ' ',
    )
    .replace(
      /(?:^|\s)(会议|网页|页面|来源|记忆|相关记忆|内容|发送位置|当前位置|当前这个|当前|这个|群聊|群|会话|消息)\s*[:：-]*/g,
      ' ',
    )
    .replace(/\s+/g, ' ')
    .trim();
}

function areEquivalentInformationTexts(left: string, right: string): boolean {
  const normalizedLeft = normalizeComparableText(left);
  const normalizedRight = normalizeComparableText(right);
  return (
    normalizedLeft.length > 0 &&
    normalizedRight.length > 0 &&
    normalizedLeft === normalizedRight
  );
}

function looksLikeContextShell(value: string): boolean {
  const comparable = normalizeComparableText(value);
  if (!comparable) return true;
  if (
    LOW_INFORMATION_CONTEXT_SHELL_PATTERN.test(value) &&
    countMeaningfulTokens(comparable) < 2 &&
    countCjkSignalChars(comparable) < 8
  ) {
    return true;
  }
  return (
    comparable === 'ringcentral video' ||
    comparable === 'video meetings' ||
    comparable === 'meeting' ||
    comparable === 'calendar event' ||
    comparable === 'webpage' ||
    comparable === 'page' ||
    /\bringcentral video\b/.test(comparable)
  );
}

function hasSpecificContextSignal(value: string): boolean {
  return (
    ISSUE_KEY_PATTERN.test(value) ||
    SPECIFIC_CONTEXT_SIGNAL_PATTERN.test(value) ||
    CJK_SPECIFIC_CONTEXT_SIGNAL_PATTERN.test(value)
  );
}

function countSignalChars(value: string): number {
  return (value.match(/[A-Za-z0-9\u3400-\u9fff]/g) || []).length;
}

function countCjkSignalChars(value: string): number {
  const withoutShellTerms = stripContextShellLabels(value).replace(
    /会议|网页|页面|来源|记忆|相关|当前/g,
    '',
  );
  return (withoutShellTerms.match(/[\u3400-\u9fff]/g) || []).length;
}

function countMeaningfulTokens(value: string): number {
  const tokens = value.toLowerCase().match(/[a-z0-9][a-z0-9_-]*/g) || [];
  return new Set(
    tokens.filter((token) => {
      if (token.length < 2) return false;
      if (/^\d+$/.test(token)) return false;
      return !GENERIC_CONTEXT_TERMS.has(token);
    }),
  ).size;
}

function explainMatch(item: RecallItem, req: ContextRecallRequest): string {
  const channels = (item.metadata?.channels as string[] | undefined) || [];
  const channelLabel = channels.length
    ? channels
        .map((c) => (c === 'vector' ? '向量' : c === 'fts' ? '关键词' : c))
        .join('+')
    : '匹配';
  const surfaceLabel =
    req.surface === 'web_passive'
      ? '网页上下文'
      : req.surface === 'meeting_passive'
      ? '会议上下文'
      : req.surface === 'follow_thread'
      ? '消息上下文'
      : req.surface === 'meeting_prep'
      ? '会前准备'
      : req.surface === 'composer_guard'
      ? '写作上下文'
      : '当前上下文';
  return `${channelLabel} 命中 ${surfaceLabel}`;
}
