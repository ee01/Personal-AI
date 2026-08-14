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
  ContextRecallScopeCounts,
  ContextRecallScopeReceipt,
  MemoryScope,
  RecallItem,
  RecallQuery,
  RecallSourceType,
  SceneFrame,
} from '../types/index.js';
import { RecallEngine } from './RecallEngine.js';
import {
  RecallContextExpansionService,
  type RecallContextExpansion,
} from './RecallContextExpansionService.js';
import { CueCompilerService } from './CueCompilerService.js';
import {
  EvidenceCohesionGateService,
  type EvidenceCohesionCandidate,
  type EvidenceCohesionResult,
} from './EvidenceCohesionGateService.js';
import {
  LensPresentationCompiler,
  matchHasVisibleFieldNovelty,
} from './LensPresentationCompiler.js';
import { MemoryCueFactService } from './MemoryCueFactService.js';
import { MemoryChangeLedgerService } from './MemoryChangeLedgerService.js';
import { MemoryOutcomeLoopService } from './MemoryOutcomeLoopService.js';
import { RecallRelevancePatchService } from './RecallRelevancePatchService.js';
import { RehearsalActivationService } from './RehearsalActivationService.js';
import { SceneFrameService } from './SceneFrameService.js';
import { buildExploreLink } from '../utils/exploreLink.js';
import { buildRecallPresentation } from '../utils/recallPresentation.js';
import { getRecallFeedbackAction } from '../utils/recallFeedback.js';
import { MemoryClaimAttributionService } from './MemoryClaimAttributionService.js';

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
const CONTEXT_FAST_OVER_FETCH_FACTOR = 1;
const PASSIVE_FAST_QUERY_MAX_CHARS = 240;
const PASSIVE_FAST_QUERY_MAX_TOKENS = 12;
const PASSIVE_FAST_MODE_SURFACES = new Set([
  'web_passive',
  'meeting_passive',
  'popup_passive',
  'follow_thread',
  'composer_guard',
]);

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
const SOURCE_MEMORY_QUERY_STOP_TERMS = new Set([
  'after',
  'and',
  'before',
  'for',
  'from',
  'how',
  'into',
  'that',
  'the',
  'this',
  'under',
  'what',
  'when',
  'where',
  'which',
  'who',
  'why',
  'with',
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

const SOURCE_MEMORY_KIND_LABELS: Record<string, string> = {
  jira_comment: 'Jira 评论',
  ai_conversation: 'AI 对话',
  document: '文档资料',
  manual: '手动资料',
  meeting_material: '会议资料',
  message_reply: '外发回复',
  selection: '选区资料',
  visual_memory: '视觉证据',
  web_ai_prompt: 'AI 提问',
  webpage: '整页资料',
};

const SOURCE_MEMORY_CAPTURE_MODE_LABELS: Record<string, string> = {
  auto: '自动保存',
  manual: '主动保存',
  suggested: '建议保存',
};

interface SourceMemoryContextRow {
  id: string;
  source_kind: string;
  source_url: string | null;
  source_title: string;
  capture_mode: string;
  summary: string | null;
  content_preview: string | null;
  message_id: string | null;
  metadata_json: string | null;
  created_at: number;
  updated_at: number;
  anchor_preview: string | null;
  takeaway_text: string | null;
}

interface SourceMemoryRecallTriggerCard {
  sceneType: string;
  description: string;
  showAs: string;
  budget: string;
  keywords: string[];
  confidence: number;
  evidenceSpanIds: string[];
}

interface AnchorOverlap {
  people: string[];
  topics: string[];
  projects: string[];
  source: string[];
}

type SuppressionReason =
  | 'broadcast_without_scene_anchor'
  | 'current_page_field_echo'
  | 'generic_title_without_anchor'
  | 'low_anchor_overlap'
  | 'off_domain_tool_context'
  | 'source_memory_missing_issue_anchor'
  | 'user_relevance_patch'
  | 'weak_semantic_only';

function parseOptionalBooleanEnv(name: string): boolean | null {
  const raw = process.env[name];
  if (raw === undefined) return null;
  const normalized = raw.trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(normalized)) return true;
  if (['0', 'false', 'no', 'off'].includes(normalized)) return false;
  return null;
}

function isPassiveFastModeEnabled(request: ContextRecallRequest): boolean {
  if (!PASSIVE_FAST_MODE_SURFACES.has(request.surface)) return false;
  const envValue = parseOptionalBooleanEnv('CONTEXT_RECALL_PASSIVE_FAST_MODE');
  if (envValue !== null) return envValue;
  return process.env.NODE_ENV !== 'test' && process.env.VITEST !== 'true';
}

function isPassiveFastVectorEnabled(): boolean {
  return parseOptionalBooleanEnv('CONTEXT_RECALL_PASSIVE_VECTOR_ENABLED') === true;
}

function isPassiveFastSearchEnabled(): boolean {
  return parseOptionalBooleanEnv('CONTEXT_RECALL_PASSIVE_SEARCH_ENABLED') === true;
}

function getContextRecallChannels(
  passiveFastMode: boolean,
): Array<'vector' | 'fts'> {
  if (passiveFastMode && !isPassiveFastVectorEnabled()) {
    return ['fts'];
  }
  return ['vector', 'fts'];
}

function getRecallQueryText(
  query: string,
  passiveFastMode: boolean,
): string {
  if (!passiveFastMode) return query;
  return compactPassiveFastQuery(query);
}

function compactPassiveFastQuery(query: string): string {
  const issueKeys = query.match(ISSUE_KEY_PATTERN) ?? [];
  const selected: string[] = [];
  const seen = new Set<string>();

  for (const token of issueKeys) {
    const key = token.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      selected.push(token);
    }
  }

  for (const rawToken of query.match(/[\p{L}\p{N}_-]+/gu) ?? []) {
    const token = rawToken.trim();
    const normalized = token.toLowerCase();
    if (!token || seen.has(normalized)) continue;
    if (GENERIC_CONTEXT_TERMS.has(normalized)) continue;
    if (!isUsefulPassiveFastToken(normalized)) continue;
    seen.add(normalized);
    selected.push(token);
    if (selected.length >= PASSIVE_FAST_QUERY_MAX_TOKENS) break;
  }

  const compact = selected.join(' ').trim();
  return (compact || query).slice(0, PASSIVE_FAST_QUERY_MAX_CHARS);
}

function isUsefulPassiveFastToken(token: string): boolean {
  if (/\d/.test(token)) return token.length >= 2;
  if (/[\u3400-\u9fff\uf900-\ufaff]/u.test(token)) return token.length >= 2;
  return token.length >= 3;
}

const AUTOPILOT_QUIET_REASON_LABELS: Record<string, string> = {
  ambiguous_context: '当前指代存在多个候选话题',
  broadcast_without_scene_anchor: '广播/公告缺少当前场景锚点',
  current_page_field_echo: '当前页面已经显示该字段值',
  duplicate_source_cluster: '同一来源的重复记忆已合并',
  generic_title_without_anchor: '标题信息量低且无场景锚点',
  low_anchor_overlap: '缺少当前场景锚点',
  low_information_match: '候选内容信息量不足',
  low_information_meeting_context: '当前会议只是空壳信息',
  passive_fast_search_disabled: '被动召回检索已关闭',
  low_value_lens_presentation: '没有可展示的新增记忆信息',
  anchor_only_lens_presentation: '只命中同一主题或字段',
  fact_followup_without_extractable_value: '事实跟进缺少可提取字段值',
  source_memory_without_distilled_cue: '资料记忆尚未蒸馏成可展示提示',
  off_domain_tool_context: '工具或项目场景不一致',
  source_memory_missing_issue_anchor: '资料记忆缺少当前 Jira 票号锚点',
  evidence_cohesion_cross_topic: '跨主题候选已静默过滤',
  evidence_cohesion_split_required: '候选证据属于多个独立问题',
  evidence_cohesion_insufficient_anchor: '缺少可靠的主题或场景锚点',
  evidence_cohesion_blocked_cross_scene: '候选证据跨越当前场景边界',
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
  private sceneFrames: SceneFrameService;
  private cueFacts: MemoryCueFactService;
  private cueCompiler: CueCompilerService;
  private lensPresentation: LensPresentationCompiler;
  private outcomeLoop: MemoryOutcomeLoopService;
  private changeLedger: MemoryChangeLedgerService;
  private cohesionGate: EvidenceCohesionGateService;
  private claimAttribution: MemoryClaimAttributionService;

  constructor(
    private db: Database.Database,
    userId = 'default',
  ) {
    this.engine = new RecallEngine(db);
    this.contextExpansion = new RecallContextExpansionService(db);
    this.rehearsalActivation = new RehearsalActivationService(db);
    this.relevancePatches = new RecallRelevancePatchService(db, userId);
    this.sceneFrames = new SceneFrameService();
    this.cueFacts = new MemoryCueFactService();
    this.cueCompiler = new CueCompilerService();
    this.lensPresentation = new LensPresentationCompiler();
    this.outcomeLoop = new MemoryOutcomeLoopService(db, userId);
    this.changeLedger = new MemoryChangeLedgerService(db);
    this.cohesionGate = new EvidenceCohesionGateService();
    this.claimAttribution = new MemoryClaimAttributionService(db);
  }

  async recall(request: ContextRecallRequest): Promise<ContextRecallResponse> {
    const response = await this.recallBase(request);
    try {
      const changeProjections = this.changeLedger.getContextProjections(request);
      return changeProjections.length ? { ...response, changeProjections } : response;
    } catch (error) {
      if (request.debug) {
        console.warn('[ContextRecallService] Change projection lookup failed:', error);
      }
      return response;
    }
  }

  private async recallBase(request: ContextRecallRequest): Promise<ContextRecallResponse> {
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
        scopeReceipt: buildContextRecallScopeReceipt(request, [], []),
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

    const preliminaryPassiveFastMode = isPassiveFastModeEnabled(request);
    if (preliminaryPassiveFastMode && !isPassiveFastSearchEnabled()) {
      const sceneAnchors = extractSceneAnchors(
        request,
        preliminaryNormalized.query,
      );
      const autopilot = buildAutopilotDecision({
        request,
        sceneAnchors,
        matches: [],
        candidateCount: 0,
        hiddenCount: 0,
        lowInformationCount: 0,
        sourceExcludedCount: 0,
        duplicateMergedCount: 0,
        quietReasons: [
          {
            reason: 'passive_fast_search_disabled',
            count: 1,
          },
        ],
      });
      return {
        matches: [],
        topMatch: null,
        queryTimeMs: Date.now() - startedAt,
        scopeReceipt: buildContextRecallScopeReceipt(request, [], []),
        autopilot,
        debug: request.debug
          ? {
              normalizedQuery: preliminaryNormalized.query,
              channelsHit: [],
              rejectedReason: 'passive_fast_search_disabled',
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
    const sceneFrame = this.sceneFrames.fromContextRecallRequest(
      request,
      preliminaryNormalized.query,
    );
    const debug: ContextRecallDebug | undefined = request.debug
      ? {
          normalizedQuery: normalized.query,
          channelsHit: [] as string[],
          sceneFrame,
          interactionScene: request.interactionScene,
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
        scopeReceipt: buildContextRecallScopeReceipt(expandedRequest, [], []),
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
        scopeReceipt: buildContextRecallScopeReceipt(
          expandedRequest,
          rehearsalMatches,
          rehearsalMatches,
        ),
        autopilot,
        debug: debug
          ? { ...debug, rejectedReason: normalized.rejectedReason, autopilot }
          : undefined,
      };
    }

    // Pin to vector + fts. Graph & time would slow us down without much win
    // for purely associative cases.
    const requestedSourceTypes = expandedRequest.sourceTypes ?? [];
    const passiveFastMode = isPassiveFastModeEnabled(expandedRequest);
    if (passiveFastMode && !isPassiveFastSearchEnabled()) {
      const sceneAnchors = extractSceneAnchors(expandedRequest, normalized.query);
      const autopilot = buildAutopilotDecision({
        request: expandedRequest,
        sceneAnchors,
        matches: [],
        candidateCount: 0,
        hiddenCount: 0,
        lowInformationCount: 0,
        sourceExcludedCount: 0,
        duplicateMergedCount: 0,
        quietReasons: [
          {
            reason: 'passive_fast_search_disabled',
            count: 1,
          },
        ],
      });
      return {
        matches: [],
        topMatch: null,
        queryTimeMs: Date.now() - startedAt,
        scopeReceipt: buildContextRecallScopeReceipt(expandedRequest, [], []),
        autopilot,
        debug: debug
          ? {
              ...debug,
              rejectedReason: 'passive_fast_search_disabled',
              autopilot,
            }
          : undefined,
      };
    }
    const recallQueryText = getRecallQueryText(
      normalized.query,
      passiveFastMode,
    );
    const sourceMemoryRequested =
      requestedSourceTypes.includes('source_memory');
    const sourceMemoryOnly =
      requestedSourceTypes.length > 0 &&
      requestedSourceTypes.every(
        (sourceType) => sourceType === 'source_memory',
      );
    const recallQuery: RecallQuery = {
      query: recallQueryText,
      scope: (expandedRequest.scope ?? 'all') as ContextRecallScope,
      topK:
        limit *
        (passiveFastMode
          ? CONTEXT_FAST_OVER_FETCH_FACTOR
          : CONTEXT_OVER_FETCH_FACTOR),
      channels: getContextRecallChannels(passiveFastMode),
      sourceTypes: expandSourceMemorySourceTypes(requestedSourceTypes),
      includeMetadata: true,
      presentationHint: 'compact',
      lifecycleMode:
        expandedRequest.surface === 'composer_guard'
          ? 'composer_surface'
          : 'passive_surface',
      previewMaxLength: PREVIEW_MAX,
      // Context Recall calls RecallEngine directly: evidence-only, no LLM.
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
          allowEmbeddingColdStart: false,
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
    const rehearsalMatches = passiveFastMode
      ? []
      : this.rehearsalActivation.getMatches(expandedRequest, limit);
    const sourceMemoryMatches = sourceMemoryRequested && !passiveFastMode
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

    if (passiveFastMode) {
      const hiddenCount = rankedMatches.filter(
        (match) => match.displayPriority === 'hidden',
      ).length;
      const attributedCandidates = this.claimAttribution.filterContextMatches(
        rankedMatches.filter(isDisplayableContextMatch),
      );
      const cohesion = applyContextRecallCohesion({
        gate: this.cohesionGate,
        request: expandedRequest,
        authorityRequest: request,
        authorityQuery: preliminaryNormalized.query,
        matches: attributedCandidates.items,
      });
      const finalAttribution = this.claimAttribution.filterContextMatches(
        cohesion.matches.slice(0, limit),
      );
      const matches = finalAttribution.items;
      const cohesionQuietReasons = buildCohesionQuietReasons(cohesion.result);
      const autopilot = buildAutopilotDecision({
        request: expandedRequest,
        sceneAnchors,
        matches,
        candidateCount: result.items.length,
        hiddenCount: hiddenCount + (cohesion.result?.receipt.excludedCount ?? 0),
        lowInformationCount: lowInformationMatches,
        sourceExcludedCount,
        duplicateMergedCount,
        quietReasons: [
          ...buildAutopilotQuietReasons({
            rankedMatches,
            lowInformationCount: lowInformationMatches,
            sourceExcludedCount,
            duplicateMergedCount,
            rejectedReason:
              matches.length === 0 &&
              (lowInformationMatches > 0 || sourceExcludedCount > 0)
                ? LOW_INFORMATION_REJECT_REASON
                : undefined,
          }),
          ...cohesionQuietReasons,
        ],
      });
      if (debug) {
        debug.autopilot = autopilot;
      }

      return {
        matches,
        topMatch: matches[0] ?? null,
        queryTimeMs: Date.now() - startedAt,
        scopeReceipt: buildContextRecallScopeReceipt(
          expandedRequest,
          matches,
          candidateMatches,
        ),
        cohesionReceipt: cohesion.result?.receipt,
        attributionReceipt: finalAttribution.attributionReceipt,
        autopilot,
        debug,
      };
    }

    const patchedCandidateMatches = this.relevancePatches.applyPatchesToMatches(
      expandedRequest,
      candidateMatches,
    );
    const surfaceAwareCandidateMatches =
      applySourceMemoryIssueAnchorSuppression(
        applyCurrentSurfaceEchoSuppression(
          patchedCandidateMatches,
          expandedRequest,
        ),
        request,
      );
    const cueFacts = this.cueFacts.extractFactsForScene(
      sceneFrame,
      surfaceAwareCandidateMatches.filter(
        (match) => match.displayPriority !== 'hidden',
      ),
    );
    const cueCompilation = this.cueCompiler.attachCuesToMatches({
      sceneFrame,
      matches: surfaceAwareCandidateMatches,
      facts: cueFacts,
      policyResolver: (cue) =>
        this.outcomeLoop.getCuePolicy({
          cueKey: cue.cueKey,
          surface: sceneFrame.surface,
          sceneKey: buildOutcomeSceneKey(sceneFrame, request.url),
        }),
    });
    const lensPresentationCompilation = this.lensPresentation.attachPresentations({
      request: expandedRequest,
      sceneFrame,
      matches: cueCompilation.matches,
    });
    const cueCandidateMatches = lensPresentationCompilation.matches;
    const hiddenCount = cueCandidateMatches.filter(
      (match) => match.displayPriority === 'hidden',
    ).length;
    const suppressionReasons = Array.from(
      new Set(
        cueCandidateMatches
          .map((match) => match.suppressionReason)
          .filter((reason): reason is string => Boolean(reason)),
      ),
    );
    let displayFilteredMatches = 0;
    const displayCandidates = cueCandidateMatches
      .filter((match) => {
        if (!isDisplayableContextMatch(match)) {
          displayFilteredMatches += 1;
          return false;
        }
        return true;
      })
      .sort(compareContextMatches);
    const attributedCandidates = this.claimAttribution.filterContextMatches(
      displayCandidates,
    );
    const cohesion = applyContextRecallCohesion({
      gate: this.cohesionGate,
      request: expandedRequest,
      authorityRequest: request,
      authorityQuery: preliminaryNormalized.query,
      matches: attributedCandidates.items,
    });
    const finalAttribution = this.claimAttribution.filterContextMatches(
      cohesion.matches.slice(0, limit),
    );
    const matches = finalAttribution.items;
    const cohesionQuietReasons = buildCohesionQuietReasons(cohesion.result);

    let rejectedReason: string | undefined;
    if (cohesion.result && isBlockingCohesionResult(cohesion.result)) {
      rejectedReason = `evidence_cohesion_${cohesion.result.state}`;
      if (debug) debug.rejectedReason = rejectedReason;
    }
    if (
      !rejectedReason &&
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
    if (debug) {
      debug.cueCompiler = {
        sceneType: sceneFrame.sceneType,
        compiledCount: cueCompilation.compiledCount,
        suppressedCount: cueCompilation.suppressedCount,
        policySuppressedCount: cueCompilation.policySuppressedCount,
        boostedCount: cueCompilation.boostedCount,
        needsMoreEvidenceCount: cueCompilation.needsMoreEvidenceCount,
        factCount: cueFacts.length,
      };
      debug.lensPresentation = {
        readyCount: lensPresentationCompilation.readyCount,
        partialCount: lensPresentationCompilation.partialCount,
        blockedCount: lensPresentationCompilation.blockedCount,
        hiddenByPresentationCount:
          lensPresentationCompilation.hiddenByPresentationCount,
      };
    }
      const autopilot = buildAutopilotDecision({
        request: expandedRequest,
        sceneAnchors,
      matches,
      candidateCount:
        result.items.length + rehearsalMatches.length + sourceMemoryMatches.length,
      hiddenCount: hiddenCount + (cohesion.result?.receipt.excludedCount ?? 0),
      lowInformationCount: lowInformationMatches,
      sourceExcludedCount,
      duplicateMergedCount,
      quietReasons: [
        ...buildAutopilotQuietReasons({
          rankedMatches: cueCandidateMatches,
          lowInformationCount: lowInformationMatches,
          sourceExcludedCount,
          duplicateMergedCount,
          rejectedReason,
        }),
        ...cohesionQuietReasons,
      ],
    });
    if (debug) {
      debug.autopilot = autopilot;
    }
    const scopeReceipt = buildContextRecallScopeReceipt(
      expandedRequest,
      matches,
      candidateMatches,
    );

    return {
      matches,
      topMatch: matches[0] ?? null,
      queryTimeMs: Date.now() - startedAt,
      scopeReceipt,
      cohesionReceipt: cohesion.result?.receipt,
      attributionReceipt: finalAttribution.attributionReceipt,
      autopilot,
      debug,
    };
  }
}

function applyContextRecallCohesion(input: {
  gate: EvidenceCohesionGateService;
  request: ContextRecallRequest;
  authorityRequest: ContextRecallRequest;
  authorityQuery: string;
  matches: ContextRecallMatch[];
}): { matches: ContextRecallMatch[]; result?: EvidenceCohesionResult } {
  if (input.matches.length === 0) return { matches: [] };

  const selectedTopic = getContextRecallSelectedTopic(input.authorityRequest);
  const allowedScopes =
    input.request.scope === 'work' || input.request.scope === 'personal'
      ? [input.request.scope]
      : undefined;
  const candidates = input.matches.map(toContextRecallCohesionCandidate);
  const result = input.gate.evaluate({
    entrypoint: 'context_recall',
    intent: 'answer_question',
    questionOrTask: input.authorityQuery,
    selectedTopic,
    sceneAnchors: getContextRecallCohesionSceneAnchors(
      input.authorityRequest,
      selectedTopic?.sourceAnchors,
      candidates,
    ),
    claimSlots: getContextRecallClaimSlots(input.authorityRequest),
    candidates,
    policy: {
      allowBackground: true,
      allowedScopes,
      // Passive recall can legitimately span topics. Only explicit or locked
      // anchors justify deleting a neighboring cluster.
      unanchoredMultipleClusters: 'preserve',
    },
  });
  if (isBlockingCohesionResult(result)) {
    return { matches: [], result };
  }

  const includedRefs = new Set(result.includedEvidenceRefs);
  return {
    matches: input.matches.filter((match) => includedRefs.has(match.id)),
    result,
  };
}

function getContextRecallSelectedTopic(
  request: ContextRecallRequest,
): {
  id?: string;
  label: string;
  aliases?: string[];
  sourceAnchors?: string[];
} | undefined {
  const issueKey = [
    request.interactionScene?.issueKey,
    request.currentContext?.issueKey,
    request.sourceContext?.issueKey,
  ].find((value): value is string => Boolean(value));
  if (issueKey) {
    return {
      id: issueKey,
      label: issueKey,
      sourceAnchors: [`issue:${issueKey}`, issueKey],
    };
  }

  const projectHint = request.entityHints?.find((hint) =>
    /project|jira|issue/i.test(hint.kind),
  );
  if (projectHint) {
    return {
      id: projectHint.entityId,
      label: projectHint.value,
    };
  }

  if (request.surface === 'meeting_prep' && request.title?.trim()) {
    return {
      label: request.title.trim(),
      aliases: uniqueStrings(
        request.entityHints?.map((hint) => hint.value) ?? [],
      ),
    };
  }
  return undefined;
}

function getContextRecallCohesionSceneAnchors(
  request: ContextRecallRequest,
  selectedTopicAnchors: string[] = [],
  candidates: EvidenceCohesionCandidate[] = [],
): string[] {
  const requestedAnchors = uniqueStrings([
    ...selectedTopicAnchors,
    prefixAnchor('group', request.sourceContext?.groupId),
    prefixAnchor('conversation', request.sourceContext?.conversationId),
    prefixAnchor('meeting', request.sourceContext?.meetingId),
    prefixAnchor('issue', request.sourceContext?.issueKey),
    prefixAnchor('group', request.currentContext?.groupId),
    prefixAnchor('conversation', request.currentContext?.conversationId),
    prefixAnchor('meeting', request.currentContext?.meetingId),
    prefixAnchor('issue', request.currentContext?.issueKey),
    ...(request.currentContext?.sourceAnchorHints ?? []),
    prefixAnchor('group', request.interactionScene?.groupId),
    prefixAnchor('conversation', request.interactionScene?.conversationId),
    prefixAnchor('meeting', request.interactionScene?.meetingId),
    prefixAnchor('issue', request.interactionScene?.issueKey),
    ...(request.interactionScene?.sourceAnchorHints ?? []),
  ]);
  const candidateAnchors = uniqueStrings(
    candidates.flatMap((candidate) => [
      candidate.sourceAnchor,
      ...(candidate.sceneAnchors ?? []),
    ]),
  );
  return requestedAnchors.filter((anchor) =>
    candidateAnchors.some((candidateAnchor) =>
      contextRecallSceneAnchorsRelated(anchor, candidateAnchor),
    ),
  );
}

function getContextRecallClaimSlots(request: ContextRecallRequest): string[] {
  return uniqueStrings([
    ...(request.currentContext?.visibleFields ?? []).map((field) => field.name),
    ...(request.interactionScene?.visibleFacts ?? [])
      .map((fact) => fact.name)
      .filter((value): value is string => Boolean(value)),
  ]);
}

function toContextRecallCohesionCandidate(
  match: ContextRecallMatch,
): EvidenceCohesionCandidate {
  const metadata = match.metadata ?? {};
  const subjectKeys = uniqueStrings([
    ...(match.matchedAnchors?.projects ?? []),
    ...(match.matchedAnchors?.topics ?? []),
    ...getMetadataValues(metadata, [
      'relatedProject',
      'related_project',
      'project',
      'projectName',
      'matchedProjects',
      'issueKey',
      'issue_key',
    ]),
    ...getMetadataValues(metadata.entities, ['projects', 'topics']),
  ]);
  const sceneAnchors = uniqueStrings([
    match.sourceClusterKey,
    match.sourceUrl,
    ...(match.matchedAnchors?.source ?? []),
    ...getMetadataValues(metadata, [
      'groupId',
      'group_id',
      'conversationId',
      'conversation_id',
      'meetingId',
      'meeting_id',
      'issueKey',
      'issue_key',
      'sourceUrl',
      'source_url',
    ]),
  ]);
  return {
    evidenceRef: match.id,
    sourceType: match.type,
    title: match.title || match.sourceTitle,
    snippet: match.uiSummary || match.snippet,
    sourceAnchor: match.sourceClusterKey || match.sourceUrl,
    subjectKeys,
    sceneAnchors,
    scope: match.scope,
    role: match.evidenceRole === 'context' ? 'background' : 'supporting',
    score: match.score,
    timestamp: match.timestamp,
  };
}

function getMetadataValues(
  metadata: unknown,
  keys: string[],
): string[] {
  if (!metadata || typeof metadata !== 'object') return [];
  const record = metadata as Record<string, unknown>;
  return keys.flatMap((key) => flattenMetadataValue(record[key]));
}

function flattenMetadataValue(value: unknown): string[] {
  if (typeof value === 'string') return [value];
  if (Array.isArray(value)) return value.flatMap(flattenMetadataValue);
  if (!value || typeof value !== 'object') return [];
  const record = value as Record<string, unknown>;
  return [record.name, record.label, record.value, record.id]
    .filter((item): item is string => typeof item === 'string');
}

function prefixAnchor(kind: string, value?: string): string | undefined {
  return value ? `${kind}:${value}` : undefined;
}

function contextRecallSceneAnchorsRelated(
  left: string,
  right: string,
): boolean {
  const normalize = (value: string): string =>
    value
      .toLowerCase()
      .replace(/^(group|conversation|meeting|issue)[:\s]+/, '')
      .replace(/[^\p{L}\p{N}._/-]+/gu, ' ')
      .trim();
  const leftValue = normalize(left);
  const rightValue = normalize(right);
  if (!leftValue || !rightValue) return false;
  return (
    leftValue === rightValue ||
    (leftValue.length >= 4 && rightValue.includes(leftValue)) ||
    (rightValue.length >= 4 && leftValue.includes(rightValue))
  );
}

function uniqueStrings(values: Array<string | undefined | null>): string[] {
  return Array.from(
    new Set(
      values
        .map((value) => value?.trim())
        .filter((value): value is string => Boolean(value)),
    ),
  );
}

type BlockingContextRecallCohesionResult = EvidenceCohesionResult & {
  state: 'split_required' | 'insufficient_anchor' | 'blocked_cross_scene';
};

function isBlockingCohesionResult(
  result: EvidenceCohesionResult | undefined,
): result is BlockingContextRecallCohesionResult {
  return (
    result?.state === 'split_required' ||
    result?.state === 'insufficient_anchor' ||
    result?.state === 'blocked_cross_scene'
  );
}

function buildCohesionQuietReasons(
  result: EvidenceCohesionResult | undefined,
): AutopilotQuietReasonInput[] {
  if (!result) return [];
  if (isBlockingCohesionResult(result)) {
    return [
      {
        reason: `evidence_cohesion_${result.state}`,
        count: Math.max(1, result.receipt.excludedCount),
      },
    ];
  }
  return result.receipt.excludedCount > 0
    ? [
        {
          reason: 'evidence_cohesion_cross_topic',
          count: result.receipt.excludedCount,
        },
      ]
    : [];
}

function normalizeContextRecallScope(
  scope: ContextRecallScope | undefined,
): ContextRecallScope {
  return scope ?? 'all';
}

function getEffectiveContextRecallScope(
  scope: ContextRecallScope,
): MemoryScope | 'both' {
  return scope === 'all' || scope === 'both' ? 'both' : scope;
}

function normalizeContextMatchScope(scope: unknown): MemoryScope | undefined {
  return scope === 'personal' || scope === 'work' ? scope : undefined;
}

function getContextMatchScope(
  match: ContextRecallMatch,
): MemoryScope | undefined {
  return normalizeContextMatchScope(match.scope ?? match.metadata?.scope);
}

function countContextMatchScopes(
  matches: ContextRecallMatch[],
): ContextRecallScopeCounts {
  return matches.reduce<ContextRecallScopeCounts>(
    (counts, match) => {
      const scope = getContextMatchScope(match);
      if (scope === 'work' || scope === 'personal') {
        counts[scope] += 1;
      } else {
        counts.unknown += 1;
      }
      counts.total += 1;
      return counts;
    },
    { work: 0, personal: 0, unknown: 0, total: 0 },
  );
}

function formatContextRecallScopeNote(params: {
  requestedScope: ContextRecallScope;
  effectiveScope: MemoryScope | 'both';
  shown: ContextRecallScopeCounts;
  candidates: ContextRecallScopeCounts;
}): string {
  const { requestedScope, effectiveScope, shown, candidates } = params;
  if (effectiveScope === 'work') {
    return '本次被动召回仅检索工作记忆，未纳入个人记忆。';
  }
  if (effectiveScope === 'personal') {
    return '本次被动召回仅检索个人记忆，未纳入工作记忆。';
  }

  const scopeName = requestedScope === 'both' ? '工作和个人记忆' : '全部记忆';
  if (shown.personal > 0) {
    return `本次被动召回检索${scopeName}，已展示 ${shown.personal} 条个人记忆；展示前已按场景过滤，引用到工作场景前请确认。`;
  }
  if (candidates.personal > 0) {
    return `本次被动召回检索${scopeName}；个人记忆只进入候选，展示前已被过滤。`;
  }
  if (shown.total === 0) {
    return `本次被动召回检索${scopeName}，没有展示可用记忆。`;
  }
  return `本次被动召回检索${scopeName}，当前展示未包含个人记忆。`;
}

function buildContextRecallScopeReceipt(
  request: Pick<ContextRecallRequest, 'scope'>,
  shownMatches: ContextRecallMatch[],
  candidateMatches: ContextRecallMatch[],
): ContextRecallScopeReceipt {
  const requestedScope = normalizeContextRecallScope(request.scope);
  const effectiveScope = getEffectiveContextRecallScope(requestedScope);
  const shown = countContextMatchScopes(shownMatches);
  const candidates = countContextMatchScopes(candidateMatches);
  return {
    requestedScope,
    effectiveScope,
    shown,
    candidates,
    note: formatContextRecallScopeNote({
      requestedScope,
      effectiveScope,
      shown,
      candidates,
    }),
    includesPersonal: shown.personal > 0,
  };
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
         c.metadata_json,
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
             AND COALESCE(t.origin, 'capture_seed') <> 'deep_distillation'
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
      const readyDistillation = readReadySourceMemoryDistillation(row.metadata_json);
      const baseHaystack = normalizeInformationText(
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
      const deepHaystack = normalizeInformationText(
        [
          readyDistillation.oneLineCue,
          readyDistillation.compactMemo,
          readyDistillation.fullMemo,
          ...readyDistillation.triggerCards.flatMap((card) => [
            card.description,
            ...card.keywords,
          ]),
        ]
          .filter(Boolean)
          .join(' '),
      ).toLowerCase();
      const haystack = `${baseHaystack} ${deepHaystack}`.trim();
      const matchedTerms = terms.filter((term) =>
        haystack.includes(term.toLowerCase()),
      );
      if (matchedTerms.length === 0) return null;
      const baseMatchedTerms = terms.filter((term) =>
        baseHaystack.includes(term.toLowerCase()),
      );
      const sceneTrigger = findSourceMemorySceneTrigger(
        readyDistillation.triggerCards,
        req,
        query,
      );
      if (
        readyDistillation.deepStatus === 'ready' &&
        baseMatchedTerms.length === 0 &&
        !sceneTrigger
      ) {
        return null;
      }

      const overlapScore = Math.min(0.22, matchedTerms.length * 0.07);
      const feedbackBoost = recallFeedback === 'positive' ? 0.08 : 0;
      const sceneBoost = sceneTrigger
        ? Math.min(0.1, 0.04 + sceneTrigger.confidence * 0.06)
        : 0;
      const score = Math.min(
        0.97,
        0.58 + overlapScore + feedbackBoost + sceneBoost,
      );
      const distilledDisplay = sceneTrigger
        ? sceneTrigger.budget === 'one_line'
          ? readyDistillation.oneLineCue
          : sceneTrigger.budget === 'full'
            ? readyDistillation.fullMemo || readyDistillation.compactMemo
            : readyDistillation.compactMemo || readyDistillation.oneLineCue
        : readyDistillation.oneLineCue;
      const snippet = clipContextText(
        distilledDisplay ||
          row.summary ||
          row.content_preview ||
          row.anchor_preview ||
          row.source_title,
        PREVIEW_MAX,
      );
      if (!snippet) return null;

      const sourceKindLabel = formatSourceMemoryKindLabel(row.source_kind);
      const captureModeLabel = formatSourceMemoryCaptureModeLabel(
        row.capture_mode,
      );
      const provenance = [sourceKindLabel, captureModeLabel]
        .filter(Boolean)
        .join(' / ');
      const whyRelevant = [
        provenance ? `已保存资料：${provenance}` : '',
        readyDistillation.oneLineCue
          ? `蒸馏提示：${readyDistillation.oneLineCue}`
          : '',
        sceneTrigger
          ? `场景触发：${sceneTrigger.description}`
          : '',
        matchedTerms.length
          ? `命中资料关键词：${matchedTerms.slice(0, 3).join(' / ')}`
          : '',
        row.source_title ? `来源：${row.source_title}` : '',
      ].filter(Boolean);

      return {
        id: `source-memory:${row.id}`,
        type: 'source_memory',
        score,
        scope: undefined,
        title: row.source_title,
        snippet,
        sourceLabel: 'source_memory',
        sourceUrl,
        sourceTitle: row.source_title,
        exploreLink: `#/source-memory/${encodeURIComponent(row.id)}`,
        links: sourceUrl ? [{ label: '打开来源', url: sourceUrl }] : [],
        whyMatched: sceneTrigger
          ? '资料记忆的场景触发卡与当前上下文匹配'
          : '资料记忆与当前上下文有关键词重合',
        whyRelevant,
        reasonType: 'keyword',
        evidenceRole: 'artifact',
        displayPriority: matchedTerms.length >= 2 ? 'p1' : 'p2',
        metadata: {
          sourceMemoryCapsuleId: row.id,
          sourceKind: row.source_kind,
          captureMode: row.capture_mode,
          sourceKindLabel,
          captureModeLabel,
          matchedTerms,
          ...(readyDistillation.status
            ? {
                sourceMemoryDistillationStatus: readyDistillation.status,
                sourceMemoryDeepStatus: readyDistillation.deepStatus,
                sourceMemoryCue: readyDistillation.oneLineCue,
                sourceMemoryCompactMemo: readyDistillation.compactMemo,
                sourceMemoryEvidenceSpanCount:
                  readyDistillation.evidenceSpanCount,
                ...(sceneTrigger
                  ? {
                      sourceMemoryTriggerCard: sceneTrigger,
                    }
                  : {}),
              }
            : {}),
          ...(recallFeedback ? { recallFeedback } : {}),
        },
        sourceClusterKey:
          readyDistillation.clusterKey || `source-memory:${row.id}`,
        timestamp: row.updated_at || row.created_at,
      } as ContextRecallMatch;
    })
    .filter((match): match is ContextRecallMatch => match != null)
    .sort(compareContextMatches)
    .slice(0, limit);
}

function formatSourceMemoryKindLabel(value?: string | null): string {
  const normalized = normalizeInformationText(value || '').toLowerCase();
  return (
    SOURCE_MEMORY_KIND_LABELS[normalized] ||
    normalizeInformationText(value || '')
  );
}

function formatSourceMemoryCaptureModeLabel(value?: string | null): string {
  const normalized = normalizeInformationText(value || '').toLowerCase();
  return (
    SOURCE_MEMORY_CAPTURE_MODE_LABELS[normalized] ||
    normalizeInformationText(value || '')
  );
}

function readReadySourceMemoryDistillation(raw?: string | null): {
  status?: string;
  deepStatus?: string;
  oneLineCue?: string;
  compactMemo?: string;
  fullMemo?: string;
  triggerCards: SourceMemoryRecallTriggerCard[];
  clusterKey?: string;
  evidenceSpanCount?: number;
} {
  const metadata = parseContextObject(raw);
  const distillation = asContextObject(metadata.distillation);
  if (distillation.status !== 'ready') {
    return { triggerCards: [] };
  }
  const deep = asContextObject(distillation.deep);
  const deepReady =
    deep.status === 'ready' &&
    typeof deep.inputHash === 'string' &&
    deep.inputHash === distillation.inputHash;
  const oneLineCue = readContextString(
    deepReady ? deep.oneLineCue : distillation.oneLineCue,
    220,
  ) || readContextString(distillation.oneLineCue, 220);
  if (!oneLineCue) {
    return { triggerCards: [] };
  }
  const triggerCards = deepReady
    ? readSourceMemoryTriggerCards(deep.triggerCards)
    : [];
  const cluster = asContextObject(deep.cluster);
  const evidenceSpans = Array.isArray(deep.evidenceSpans)
    ? deep.evidenceSpans
    : [];
  return {
    status: 'ready',
    deepStatus: readContextString(deep.status, 40),
    oneLineCue,
    compactMemo:
      readContextString(deepReady ? deep.compactMemo : undefined, 900) ||
      readContextString(distillation.compactMemo, 700),
    fullMemo: readContextString(deepReady ? deep.fullMemo : undefined, 1800),
    triggerCards,
    clusterKey: readContextString(cluster.key, 180),
    evidenceSpanCount: evidenceSpans.length,
  };
}

function readSourceMemoryTriggerCards(
  value: unknown,
): SourceMemoryRecallTriggerCard[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      const card = asContextObject(item);
      const description = readContextString(card.description, 320);
      if (!description) return null;
      return {
        sceneType: readContextString(card.sceneType, 40) || 'general',
        description,
        showAs: readContextString(card.showAs, 40) || 'source_card',
        budget: readContextString(card.budget, 40) || 'compact',
        keywords: Array.isArray(card.keywords)
          ? card.keywords
              .map((keyword) => readContextString(keyword, 80))
              .filter(Boolean)
              .slice(0, 12)
          : [],
        confidence:
          typeof card.confidence === 'number' && Number.isFinite(card.confidence)
            ? Math.min(1, Math.max(0, card.confidence))
            : 0.65,
        evidenceSpanIds: Array.isArray(card.evidenceSpanIds)
          ? card.evidenceSpanIds
              .map((id) => readContextString(id, 180))
              .filter(Boolean)
              .slice(0, 8)
          : [],
      };
    })
    .filter((card): card is SourceMemoryRecallTriggerCard => card != null)
    .slice(0, 8);
}

function findSourceMemorySceneTrigger(
  cards: SourceMemoryRecallTriggerCard[],
  req: ContextRecallRequest,
  query: string,
): SourceMemoryRecallTriggerCard | undefined {
  if (cards.length === 0) return undefined;
  const scenes = getSourceMemorySceneKinds(req);
  const normalizedQuery = normalizeInformationText(query).toLowerCase();
  return cards
    .filter((card) => scenes.has(card.sceneType) || card.sceneType === 'general')
    .filter(
      (card) =>
        card.keywords.length === 0 ||
        card.keywords.some((keyword) =>
          normalizedQuery.includes(normalizeInformationText(keyword).toLowerCase()),
        ),
    )
    .sort((a, b) => b.confidence - a.confidence)[0];
}

function getSourceMemorySceneKinds(req: ContextRecallRequest): Set<string> {
  const scenes = new Set<string>(['general']);
  const interaction = req.interactionScene;
  const sceneType = interaction?.sceneType || '';
  const url = [req.url, req.sourceContext?.url, interaction?.url]
    .filter(Boolean)
    .join(' ');
  if (req.surface === 'composer_guard' || interaction?.surface === 'compose_assist') {
    scenes.add('compose');
  }
  if (
    req.surface === 'meeting_passive' ||
    req.surface === 'meeting_prep' ||
    sceneType === 'meeting_live'
  ) {
    scenes.add('meeting');
  }
  if (interaction?.surface === 'ask' || sceneType === 'web_ai_prompt_composing') {
    scenes.add('ask');
  }
  if (sceneType.startsWith('jira_') || /\/browse\/[A-Z][A-Z0-9]+-\d+|jira/i.test(url)) {
    scenes.add('jira');
  }
  if (sceneType === 'web_reading' || req.surface === 'web_passive') {
    scenes.add('page');
  }
  if (/research|论文|调研/i.test([req.title, req.primaryText].filter(Boolean).join(' '))) {
    scenes.add('research');
  }
  return scenes;
}

function parseContextObject(raw?: string | null): Record<string, unknown> {
  if (!raw) return {};
  try {
    return asContextObject(JSON.parse(raw));
  } catch {
    return {};
  }
}

function asContextObject(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function readContextString(value: unknown, maxLength: number): string {
  return typeof value === 'string' ? clipContextText(value, maxLength) : '';
}

function extractSourceMemorySearchTerms(query: string): string[] {
  const normalized = normalizeInformationText(query);
  const latinTerms =
    normalized.toLowerCase().match(/[a-z0-9][a-z0-9_-]{2,}/g) ?? [];
  const cjkTerms = normalized.match(/[\u3400-\u9fff]{2,}/g) ?? [];
  return Array.from(new Set([...latinTerms, ...cjkTerms]))
    .filter(
      (term) =>
        !GENERIC_CONTEXT_TERMS.has(term) &&
        !SOURCE_MEMORY_QUERY_STOP_TERMS.has(term),
    )
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
  const sourceMemoryCapsuleId = isSourceMemory
    ? String(item.metadata?.sourceMemoryCapsuleId)
    : '';
  const presentation = buildRecallPresentation({
    content: item.displayText || item.content || '',
    query: req.title || req.primaryText || '',
    source: item.source,
    sourceTitle: item.sourceTitle,
    presentationHint: 'compact',
    previewMaxLength: PREVIEW_MAX,
  });

  const exploreLink = sourceMemoryCapsuleId
    ? `#/source-memory/${encodeURIComponent(sourceMemoryCapsuleId)}`
    : item.exploreLink ||
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
      ? `source-memory:${sourceMemoryCapsuleId}`
      : item.id,
    type: isSourceMemory ? 'source_memory' : item.type,
    score: item.score,
    scope: normalizeContextMatchScope(item.scope ?? item.metadata?.scope),
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
    sourceClusterKey: sourceMemoryCapsuleId
      ? `source-memory:${sourceMemoryCapsuleId}`
      : getSourceClusterKey(item),
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
    const capRehearsalToWeakPrompt = isStaleRehearsalMatch(match);
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
    const nextWhyRelevant = mergeRehearsalWhyRelevant(match, whyRelevant);
    const nextMatch: ContextRecallMatch = {
      ...match,
      score: nextScore,
      whyRelevant: nextWhyRelevant.length ? nextWhyRelevant : undefined,
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
      nextMatch.displayPriority = capRehearsalToWeakPrompt ? 'p2' : 'p1';
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
    if (capRehearsalToWeakPrompt && nextMatch.displayPriority === 'p1') {
      nextMatch.displayPriority = 'p2';
    }

    if (nextMatch.displayPriority === 'hidden') {
      nextMatch.suppressionReason = suppressionReason || 'weak_semantic_only';
    }

    return nextMatch;
  });
}

function isStaleRehearsalMatch(match: ContextRecallMatch): boolean {
  return (
    match.type === 'rehearsal' &&
    String(match.metadata?.rehearsal?.status || '') === 'stale'
  );
}

function mergeRehearsalWhyRelevant(
  match: ContextRecallMatch,
  rerankReasons: string[],
): string[] {
  if (match.type !== 'rehearsal') return rerankReasons;
  return Array.from(new Set([...(match.whyRelevant ?? []), ...rerankReasons])).slice(0, 4);
}

function applyCurrentSurfaceEchoSuppression(
  matches: ContextRecallMatch[],
  request: ContextRecallRequest,
): ContextRecallMatch[] {
  const visibleFields = getCurrentJiraEstimateFields(request);
  if (!visibleFields.length) return matches;

  return matches.map((match) => {
    if (match.displayPriority === 'hidden') return match;
    const echoedField = visibleFields.find((field) =>
      matchEchoesVisibleField(match, field),
    );
    if (!echoedField) return match;
    if (matchHasVisibleFieldNovelty(match, echoedField)) return match;
    return {
      ...match,
      displayPriority: 'hidden' as const,
      suppressionReason: 'current_page_field_echo',
      metadata: {
        ...(match.metadata ?? {}),
        currentPageFieldEcho: {
          field: echoedField.name,
          value: echoedField.value,
        },
      },
    };
  });
}

function applySourceMemoryIssueAnchorSuppression(
  matches: ContextRecallMatch[],
  request: ContextRecallRequest,
): ContextRecallMatch[] {
  const issueKeys = extractExplicitIssueKeys(request);
  if (!issueKeys.length) return matches;

  return matches.map((match) => {
    if (match.displayPriority === 'hidden') return match;
    if (match.type !== 'source_memory') return match;
    if (matchContainsIssueKey(match, issueKeys)) return match;

    return {
      ...match,
      displayPriority: 'hidden' as const,
      suppressionReason: 'source_memory_missing_issue_anchor',
      metadata: {
        ...(match.metadata ?? {}),
        sourceMemoryIssueAnchorGate: {
          requiredIssueKeys: issueKeys,
        },
      },
    };
  });
}

function extractExplicitIssueKeys(request: ContextRecallRequest): string[] {
  const directValues = [
    request.sourceContext?.issueKey,
    request.currentContext?.issueKey,
    request.interactionScene?.issueKey,
    ...(request.entityHints ?? [])
      .filter((hint) => /jira|issue|ticket|key/i.test(hint.kind))
      .map((hint) => hint.value),
  ];
  const textValues = [
    request.title,
    request.url,
    request.primaryText,
    ...(request.secondaryTexts ?? []),
    request.sourceContext?.title,
    request.sourceContext?.url,
    request.sourceContext?.topic,
    request.currentContext?.title,
    request.currentContext?.url,
    ...(request.currentContext?.sourceAnchorHints ?? []),
    ...(request.currentContext?.visibleMessages ?? []).map((message) =>
      [message.sender, message.text].filter(Boolean).join(': '),
    ),
    request.interactionScene?.title,
    request.interactionScene?.url,
    request.interactionScene?.draftText,
    request.interactionScene?.selectedText,
    ...(request.interactionScene?.sourceAnchorHints ?? []),
    ...(request.interactionScene?.nearbyMessages ?? []).map((message) =>
      [message.sender, message.text].filter(Boolean).join(': '),
    ),
    ...(request.interactionScene?.visibleFacts ?? []).flatMap((fact) => [
      fact.issueKey,
      fact.rawText,
      fact.name,
      fact.value,
    ]),
  ];
  const issueKeys = new Set<string>();
  for (const value of [...directValues, ...textValues]) {
    for (const issueKey of extractIssueKeysFromText(value)) {
      issueKeys.add(issueKey);
    }
  }
  return Array.from(issueKeys).slice(0, 8);
}

function matchContainsIssueKey(
  match: ContextRecallMatch,
  issueKeys: string[],
): boolean {
  const text = [
    buildMatchRerankText(match),
    match.sourceUrl,
    ...(match.links ?? []).map((link) => link.url),
    ...(match.whyRelevant ?? []),
  ]
    .filter(Boolean)
    .join(' ');
  return issueKeys.some((issueKey) =>
    issueKeyRegex(issueKey).test(text),
  );
}

function extractIssueKeysFromText(value?: string | null): string[] {
  if (!value) return [];
  const matches = value.match(/\b[A-Z][A-Z0-9]+-\d+\b/gi) ?? [];
  return matches.map((match) => match.toUpperCase());
}

function issueKeyRegex(issueKey: string): RegExp {
  return new RegExp(`\\b${escapeRegExp(issueKey)}\\b`, 'i');
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function getCurrentJiraEstimateFields(
  request: ContextRecallRequest,
): Array<{ name: string; value: string }> {
  if (request.surface !== 'web_passive' || request.contextType !== 'jira_issue') {
    return [];
  }
  return (request.currentContext?.visibleFields ?? [])
    .map((field) => ({ name: field.name, value: field.value }))
    .concat(
      (request.interactionScene?.visibleFacts ?? [])
        .filter((fact) => fact.kind === 'jira_field' && fact.name)
        .map((fact) => ({
          name: fact.name || '',
          value: fact.value,
        })),
    )
    .filter(
      (field) =>
        isEstimateFieldName(field.name) &&
        normalizeVisibleFieldValue(field.value).length > 0,
    )
    .slice(0, 12);
}

function isEstimateFieldName(name: string): boolean {
  return /\b(?:dev\s+estimate\s+new|dev\s+estimate|original\s+estimate|remaining\s+estimate|time\s+estimate|story\s*points?|estimate)\b|估算|预估|工时|人天|人日/i.test(
    name,
  );
}

function matchEchoesVisibleField(
  match: ContextRecallMatch,
  field: { name: string; value: string },
): boolean {
  const text = normalizeEchoComparableText(buildMatchRerankText(match));
  const fieldName = normalizeEchoComparableText(field.name);
  const fieldValue = normalizeVisibleFieldValue(field.value);
  if (!fieldName || !fieldValue) return false;
  const fieldTokens = getFieldNameTokens(fieldName);
  const hasFieldName = fieldTokens.some((token) => text.includes(token));
  if (!hasFieldName) return false;
  if (!text.includes(fieldValue)) return false;

  return true;
}

function getFieldNameTokens(fieldName: string): string[] {
  const tokens = new Set<string>([fieldName]);
  if (fieldName.includes('dev estimate new')) tokens.add('development estimate');
  if (fieldName.includes('dev estimate')) tokens.add('development estimate');
  if (fieldName.includes('original estimate')) tokens.add('original estimate');
  if (fieldName.includes('story points')) tokens.add('story points');
  if (fieldName.includes('estimate')) tokens.add('estimate');
  if (/估算|预估|工时|人天|人日/.test(fieldName)) {
    tokens.add('估算');
    tokens.add('工时');
  }
  return Array.from(tokens).filter((token) => token.length >= 2);
}

function normalizeEchoComparableText(value: string): string {
  return value.replace(/\s+/g, ' ').trim().toLowerCase();
}

function normalizeVisibleFieldValue(value: string): string {
  return normalizeEchoComparableText(value)
    .replace(/\b(hours?|days?|sp)\b/g, '')
    .trim();
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
  if (match.lensPresentation) {
    if (match.lensPresentation.status === 'blocked') return false;
    if (
      match.lensPresentation.status === 'ready' &&
      match.lensPresentation.informationValue !== 'low' &&
      normalizeInformationText(
        match.lensPresentation.extractedInfo || match.lensPresentation.title,
      )
    ) {
      return true;
    }
  }

  const title = normalizeInformationText(match.title);
  const uiSummary = normalizeInformationText(match.uiSummary);
  const snippet = normalizeInformationText(match.snippet);
  const sourceTitle = normalizeInformationText(match.sourceTitle);
  const sourceLabel = normalizeInformationText(match.sourceLabel);
  const lensInfo = normalizeInformationText(match.lensPresentation?.extractedInfo);
  const lensTitle = normalizeInformationText(match.lensPresentation?.title);

  if (!title && !uiSummary && !snippet && !lensInfo && !lensTitle) return false;

  const combined = [lensInfo, lensTitle, title, uiSummary, snippet, sourceTitle]
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

function buildOutcomeSceneKey(
  sceneFrame: SceneFrame,
  fallbackUrl?: string,
): string {
  const modeSuffix = sceneFrame.userMode ? `:${sceneFrame.userMode}` : '';
  const interactionSuffix = sceneFrame.interactionSceneType
    ? `:${sceneFrame.interactionSceneType}`
    : '';
  if (sceneFrame.anchors.issueKey) {
    return `jira:${sceneFrame.anchors.issueKey}${interactionSuffix}${modeSuffix}`;
  }
  if (sceneFrame.anchors.groupId) {
    return `group:${sceneFrame.anchors.groupId}${interactionSuffix}${modeSuffix}`;
  }
  if (sceneFrame.anchors.conversationId) {
    return `conversation:${sceneFrame.anchors.conversationId}${interactionSuffix}${modeSuffix}`;
  }
  return `${fallbackUrl || sceneFrame.sceneType}${interactionSuffix}${modeSuffix}`;
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
