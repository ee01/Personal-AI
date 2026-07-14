import { createHash } from 'node:crypto';
import type Database from 'better-sqlite3';

import type { MemoryContextMatchResult } from './MemoryContextMatchService.js';
import type { ParsedQueryIntent } from './QueryIntentParser.js';
import type { RecallChannelDiagnostic, RecallItem } from '../types/index.js';
import {
  AnswerMemoryRepository,
  type AnswerMemoryEvidenceRef,
  type AnswerMemoryThreadRecord,
  type AnswerMemoryThreadStatus,
} from '../repositories/AnswerMemoryRepository.js';
import { now } from '../utils/time.js';

export type AnswerMemoryIntent =
  | 'status'
  | 'owner_eta'
  | 'decision_status'
  | 'fact_followup'
  | 'how_to';

export type AnswerMemoryDiagnosticState =
  | 'priorHit'
  | 'observed'
  | 'promoted'
  | 'updated'
  | 'skipped';

export interface AnswerMemoryDiagnostic {
  state: AnswerMemoryDiagnosticState;
  threadId?: string;
  canonicalKey?: string;
  skipReason?: string;
  receipt?: AnswerMemoryReceipt;
  authority?: AnswerMemoryAuthorityReceipt;
}

export interface AnswerMemoryReceipt {
  label: string;
  detail: string;
  tone: 'info' | 'success' | 'warning' | 'muted';
  currentEvidenceCount?: number;
  priorEvidenceCount?: number;
  followUpActionCount?: number;
  missingInfoCount?: number;
  stale?: boolean;
  lastVerifiedAt?: number;
  staleAfter?: number;
}

export type AnswerMemoryEvidenceRole =
  | 'authority'
  | 'supporting'
  | 'derived'
  | 'query'
  | 'prior';

export type AnswerMemoryAuthorityDecision =
  | 'authorized_change'
  | 'same_meaning_no_change'
  | 'supporting_only'
  | 'wait_for_authority_source';

export interface AnswerMemoryEvidenceRoleSummary {
  role: AnswerMemoryEvidenceRole;
  count: number;
  reason: string;
}

export interface AnswerMemoryAuthorityReceipt {
  decision: AnswerMemoryAuthorityDecision;
  summary: string;
  evidenceRoles: AnswerMemoryEvidenceRoleSummary[];
  subjectKey?: string;
  currentStance?: string;
  priorStance?: string;
  sameEvidence?: boolean;
  suppressedUpdate?: boolean;
}

export interface AnswerMemoryPrior {
  threadId: string;
  canonicalKey: string;
  canonicalQuestion: string;
  topicLabel: string;
  intent: AnswerMemoryIntent;
  currentAnswer: string;
  stance: string;
  confidence: number;
  evidenceRefs: AnswerMemoryEvidenceRef[];
  unknowns: string[];
  changeConditions: string[];
  status: AnswerMemoryThreadStatus;
  lastAskedAt?: number;
  lastVerifiedAt?: number;
  staleAfter?: number;
}

export interface AnswerMemoryFindPriorResult {
  prior?: AnswerMemoryPrior;
  diagnostic: AnswerMemoryDiagnostic;
}

export interface AnswerMemoryObserveInput {
  requestId?: string;
  query: string;
  answer: string;
  contextMatch?: MemoryContextMatchResult;
  parsedIntent?: ParsedQueryIntent;
  recalledItems: RecallItem[];
  channelDiagnostics?: RecallChannelDiagnostic[];
  followUpActions?: Array<{ id: string }>;
  missingInfo?: string[];
  confidence?: number;
}

interface CanonicalContext {
  canonicalKey: string;
  canonicalQuestion: string;
  topicLabel: string;
  topicId?: string;
  intent: AnswerMemoryIntent;
}

const OBSERVATION_WINDOW_SECONDS = 90 * 24 * 60 * 60;
const STATUS_STALE_SECONDS = 14 * 24 * 60 * 60;
const DEFAULT_STALE_SECONDS = 30 * 24 * 60 * 60;

const SUPPORTED_INTENTS = new Set<AnswerMemoryIntent>([
  'status',
  'owner_eta',
  'decision_status',
  'fact_followup',
  'how_to',
]);

const STATUS_PATTERN =
  /ready|done|complete|completed|pending|blocked?|waiting?|status|progress|merge|merged|ship|shipped|deployed|完成|就绪|状态|进展|阻塞|等待|合了|上线|发布|方案|设计|还没有|未完成|搞定|定了/i;
const OWNER_ETA_PATTERN =
  /\b(owner|assignee|responsible|eta|when|deadline|due|time|date)\b|负责人|谁负责|owner|什么时候|时间|排期|截止|预计|ETA/i;
const DECISION_STATUS_PATTERN =
  /\b(decision|decided|final|approved|confirmed)\b|决定|决策|确定|定了|拍板|确认/i;
const FACT_FOLLOWUP_PATTERN =
  /\b(verify|check|recheck|validate|evidence|source|follow[-\s]?up)\b|查证|核实|继续查|证据|来源|追查|复核/i;
const HOW_TO_PATTERN = /\b(how to|how do|use|setup|configure)\b|怎么|如何|使用|配置|接入|设置/i;
const BROAD_PROFILE_PATTERN =
  /\b(my|me)\b.*\b(preference|habit|style|pattern)\b|我的?(偏好|习惯|风格|模式|喜好|工作偏好|关注点)/i;
const DERIVED_EVIDENCE_PATTERN =
  /answer[_\s-]?memory|prior|derived|summary|reflection|llm|assistant|generated/i;
const QUERY_EVIDENCE_PATTERN = /query|prompt|user_request|user-query/i;

function normalizeText(value?: string | null): string {
  return (value || '').replace(/\s+/g, ' ').trim();
}

function normalizeKeyPart(value?: string | null): string {
  return normalizeText(value)
    .toLowerCase()
    .replace(/[^a-z0-9\u3400-\u9fff]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function hashText(value: string): string {
  return createHash('sha256')
    .update(normalizeText(value).toLowerCase())
    .digest('hex')
    .slice(0, 32);
}

function uniqStrings(values: Array<string | undefined | null>): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const value of values) {
    const cleaned = normalizeText(value);
    if (!cleaned) continue;
    const key = normalizeKeyPart(cleaned);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(cleaned);
  }
  return out;
}

function clip(value: string, maxLength: number): string {
  const normalized = normalizeText(value);
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, maxLength - 1)}...`;
}

function inferAnswerIntent(
  query: string,
  parsedIntent?: ParsedQueryIntent,
): AnswerMemoryIntent | null {
  if (parsedIntent?.intent === 'profile' || BROAD_PROFILE_PATTERN.test(query)) {
    return null;
  }
  if (FACT_FOLLOWUP_PATTERN.test(query)) return 'fact_followup';
  if (OWNER_ETA_PATTERN.test(query)) return 'owner_eta';
  if (DECISION_STATUS_PATTERN.test(query)) return 'decision_status';
  if (STATUS_PATTERN.test(query)) return 'status';
  if (HOW_TO_PATTERN.test(query)) return 'how_to';
  return null;
}

function stanceFromAnswer(answer: string): string {
  const text = normalizeText(answer).toLowerCase();
  if (!text) return 'unknown';
  if (/无法判断|不知道|不明确|no evidence|not enough|unknown|unclear/.test(text)) {
    return 'unknown';
  }
  if (/not ready|not done|pending|blocked|waiting|还没有|未完成|等待|阻塞/.test(text)) {
    return 'negative_or_pending';
  }
  if (/ready|done|completed|deployed|merged|完成|就绪|搞定|上线|已合/.test(text)) {
    return 'positive';
  }
  if (/partial|部分|一部分|partly/.test(text)) return 'partial';
  return 'informational';
}

function defaultChangeConditions(intent: AnswerMemoryIntent): string[] {
  if (intent === 'status' || intent === 'owner_eta') {
    return ['新的项目消息、Jira 状态、owner/ETA 或外部查证结果出现时需要更新'];
  }
  if (intent === 'decision_status') {
    return ['新的决策记录、审批状态或会议结论出现时需要更新'];
  }
  if (intent === 'fact_followup') {
    return ['新的权威证据或外部查证结果出现时需要更新'];
  }
  return ['新的使用说明、配置步骤或相关产品行为变化时需要更新'];
}

function countPresent(values?: unknown[]): number {
  return Array.isArray(values) ? values.length : 0;
}

function buildAnswerMemoryReceipt(params: {
  state: AnswerMemoryDiagnosticState;
  skipReason?: string;
  currentEvidenceCount?: number;
  priorEvidenceCount?: number;
  followUpActionCount?: number;
  missingInfoCount?: number;
  stale?: boolean;
  lastVerifiedAt?: number;
  staleAfter?: number;
}): AnswerMemoryReceipt {
  const currentEvidenceCount = params.currentEvidenceCount ?? 0;
  const priorEvidenceCount = params.priorEvidenceCount ?? 0;
  const followUpActionCount = params.followUpActionCount ?? 0;
  const missingInfoCount = params.missingInfoCount ?? 0;
  const reviewTimeBasis = {
    lastVerifiedAt: params.lastVerifiedAt,
    staleAfter: params.staleAfter,
  };

  if (params.state === 'observed') {
    return {
      label: '已记录活答案候选',
      detail: `本轮使用 ${currentEvidenceCount} 条当前证据，只先记为 observation；还不会把它当长期答案复用。`,
      tone: 'info',
      currentEvidenceCount,
      followUpActionCount,
      missingInfoCount,
      ...reviewTimeBasis,
    };
  }

  if (params.state === 'promoted') {
    return {
      label: '已建立活答案',
      detail: `重复问题已合并为活答案 thread；本轮答案仍以 ${currentEvidenceCount} 条当前证据为准。`,
      tone: 'success',
      currentEvidenceCount,
      followUpActionCount,
      missingInfoCount,
      ...reviewTimeBasis,
    };
  }

  if (params.state === 'updated') {
    return {
      label: '活答案已更新',
      detail: `当前证据或答案状态发生变化，已写入新版本；旧证据 ${priorEvidenceCount} 条只作为对比线索。`,
      tone: 'success',
      currentEvidenceCount,
      priorEvidenceCount,
      followUpActionCount,
      missingInfoCount,
      stale: params.stale,
      ...reviewTimeBasis,
    };
  }

  if (params.state === 'priorHit') {
    return {
      label: params.stale ? '活答案需复核' : '活答案已复核',
      detail: params.stale
        ? `命中过往活答案，但它已到复核时间；本轮仍用 ${currentEvidenceCount} 条当前证据重新判断。`
        : `命中过往活答案，但旧答案只用于聚焦召回；本轮用 ${currentEvidenceCount} 条当前证据复核。`,
      tone: params.stale ? 'warning' : 'info',
      currentEvidenceCount,
      priorEvidenceCount,
      followUpActionCount,
      missingInfoCount,
      stale: params.stale,
      ...reviewTimeBasis,
    };
  }

  if (params.skipReason === 'context_ambiguous') {
    return {
      label: '等待话题确认',
      detail: '这轮没有写入活答案；确认候选话题后才继续查证状态和证据。',
      tone: 'warning',
      currentEvidenceCount,
      priorEvidenceCount,
      ...reviewTimeBasis,
    };
  }

  if (params.skipReason === 'no_evidence') {
    return {
      label: '活答案未复核',
      detail: priorEvidenceCount > 0
        ? '命中过往活答案，但本轮没有当前证据；不会把旧答案当作事实复述。'
        : '本轮没有可用证据，因此不会写入或更新活答案。',
      tone: 'warning',
      currentEvidenceCount,
      priorEvidenceCount,
      ...reviewTimeBasis,
    };
  }

  return {
    label: '未启用活答案',
    detail: params.skipReason
      ? `这轮 Ask 不满足活答案条件：${params.skipReason}。`
      : '这轮 Ask 不满足活答案条件。',
    tone: 'muted',
    currentEvidenceCount,
    priorEvidenceCount,
    ...reviewTimeBasis,
  };
}

function extractUnknowns(answer: string, missingInfo?: string[]): string[] {
  const unknowns = [...(missingInfo ?? [])];
  const text = normalizeText(answer);
  if (/无法判断|不知道|不明确|no evidence|not enough|unknown|unclear/i.test(text)) {
    unknowns.push('当前证据不足以确认最终状态');
  }
  if (/需要确认|needs? confirmation|需要查证|need to verify/i.test(text)) {
    unknowns.push('仍有待确认信息');
  }
  return uniqStrings(unknowns).slice(0, 6);
}

function buildEvidenceRefs(items: RecallItem[]): AnswerMemoryEvidenceRef[] {
  return items
    .filter((item) => item.id && item.type)
    .slice(0, 8)
    .map((item) => ({
      id: item.id,
      type: item.type,
      source: item.source,
      title: item.displayTitle ?? item.sourceTitle,
      timestamp: item.timestamp,
      score: item.score,
    }));
}

function hashEvidenceRefs(evidenceRefs: AnswerMemoryEvidenceRef[]): string {
  const key = evidenceRefs
    .map((ref) =>
      [
        ref.type,
        ref.id,
        ref.timestamp ? String(ref.timestamp) : '',
        ref.title ?? '',
      ].join(':'),
    )
    .sort()
    .join('|');
  return hashText(key);
}

function classifyEvidenceRole(ref: AnswerMemoryEvidenceRef): AnswerMemoryEvidenceRole {
  const type = normalizeKeyPart(ref.type);
  const source = normalizeKeyPart(ref.source);
  if (type.includes('prior') || source.includes('prior')) return 'prior';
  if (QUERY_EVIDENCE_PATTERN.test(type) || QUERY_EVIDENCE_PATTERN.test(source)) {
    return 'query';
  }
  if (DERIVED_EVIDENCE_PATTERN.test(type) || DERIVED_EVIDENCE_PATTERN.test(source)) {
    return 'derived';
  }
  if (
    type.includes('message') ||
    type.includes('chunk') ||
    type.includes('document') ||
    type.includes('calendar') ||
    type.includes('source')
  ) {
    return 'authority';
  }
  return source ? 'authority' : 'supporting';
}

function summarizeEvidenceRoles(params: {
  evidenceRefs: AnswerMemoryEvidenceRef[];
  priorEvidenceCount?: number;
}): AnswerMemoryEvidenceRoleSummary[] {
  const counts = new Map<AnswerMemoryEvidenceRole, number>();
  for (const ref of params.evidenceRefs) {
    const role = classifyEvidenceRole(ref);
    counts.set(role, (counts.get(role) ?? 0) + 1);
  }
  if (params.priorEvidenceCount) {
    counts.set('prior', (counts.get('prior') ?? 0) + params.priorEvidenceCount);
  }
  const reasons: Record<AnswerMemoryEvidenceRole, string> = {
    authority: '原始消息、chunk、文档或日历等当前召回证据，可以驱动长期答案更新。',
    supporting: '仅作辅助排序或解释，不能单独改写长期答案。',
    derived: '摘要、LLM 输出或派生记忆只能辅助理解，不能作为事实更新源。',
    query: '用户本轮问题只表达需求，不能作为事实本身。',
    prior: '旧活答案只用于对比和聚焦召回，不是本轮事实来源。',
  };
  const roleOrder: AnswerMemoryEvidenceRole[] = [
    'authority',
    'supporting',
    'derived',
    'query',
    'prior',
  ];
  return roleOrder
    .map((role) => ({
      role,
      count: counts.get(role) ?? 0,
      reason: reasons[role],
    }))
    .filter((item) => item.count > 0);
}

function buildAuthorityReceipt(params: {
  subjectKey?: string;
  evidenceRefs: AnswerMemoryEvidenceRef[];
  priorEvidenceCount?: number;
  currentStance?: string;
  priorStance?: string;
  sameEvidence?: boolean;
  stale?: boolean;
  wouldWriteVersion?: boolean;
}): AnswerMemoryAuthorityReceipt {
  const evidenceRoles = summarizeEvidenceRoles({
    evidenceRefs: params.evidenceRefs,
    priorEvidenceCount: params.priorEvidenceCount,
  });
  const authorityCount =
    evidenceRoles.find((item) => item.role === 'authority')?.count ?? 0;
  const hasCurrentEvidence = params.evidenceRefs.length > 0;
  const sameStance = Boolean(
    params.currentStance &&
      params.priorStance &&
      params.currentStance === params.priorStance,
  );
  const wouldWriteVersion = params.wouldWriteVersion ?? false;

  if (!hasCurrentEvidence || authorityCount === 0) {
    const decision: AnswerMemoryAuthorityDecision = hasCurrentEvidence
      ? 'supporting_only'
      : 'wait_for_authority_source';
    return {
      decision,
      subjectKey: params.subjectKey,
      currentStance: params.currentStance,
      priorStance: params.priorStance,
      sameEvidence: params.sameEvidence,
      suppressedUpdate: wouldWriteVersion,
      evidenceRoles,
      summary: hasCurrentEvidence
        ? '本轮只有辅助/派生证据，不能改写长期答案。'
        : '本轮没有当前权威证据，不能写入或改写长期答案。',
    };
  }

  if (
    params.priorStance &&
    params.currentStance &&
    params.sameEvidence &&
    !params.stale
  ) {
    if (sameStance) {
      return {
        decision: 'same_meaning_no_change',
        subjectKey: params.subjectKey,
        currentStance: params.currentStance,
        priorStance: params.priorStance,
        sameEvidence: params.sameEvidence,
        suppressedUpdate: wouldWriteVersion,
        evidenceRoles,
        summary: '同一组权威证据下答案语义没有变化，只记录本轮复核，不写新版本。',
      };
    }
    return {
      decision: 'wait_for_authority_source',
      subjectKey: params.subjectKey,
      currentStance: params.currentStance,
      priorStance: params.priorStance,
      sameEvidence: params.sameEvidence,
      suppressedUpdate: wouldWriteVersion,
      evidenceRoles,
      summary: '同一组权威证据下出现答案状态翻转，先等待新的权威来源，不用一次生成结果改写长期答案。',
    };
  }

  return {
    decision: 'authorized_change',
    subjectKey: params.subjectKey,
    currentStance: params.currentStance,
    priorStance: params.priorStance,
    sameEvidence: params.sameEvidence,
    suppressedUpdate: false,
    evidenceRoles,
    summary: '本轮包含当前权威证据，可用于创建、提升或更新长期答案。',
  };
}

function staleAfterForIntent(intent: AnswerMemoryIntent, currentTime: number): number {
  return (
    currentTime +
    (intent === 'status' ||
    intent === 'owner_eta' ||
    intent === 'decision_status'
      ? STATUS_STALE_SECONDS
      : DEFAULT_STALE_SECONDS)
  );
}

function contextToCanonical(
  query: string,
  contextMatch: MemoryContextMatchResult | undefined,
  parsedIntent?: ParsedQueryIntent,
): { value?: CanonicalContext; skipReason?: string } {
  if (contextMatch?.state === 'ambiguous') {
    return { skipReason: 'context_ambiguous' };
  }
  if (contextMatch?.state !== 'locked' || !contextMatch.selectedTopic) {
    return { skipReason: 'context_not_locked' };
  }
  const intent = inferAnswerIntent(query, parsedIntent);
  if (!intent || !SUPPORTED_INTENTS.has(intent)) {
    return { skipReason: 'unsupported_intent' };
  }
  const topic = contextMatch.selectedTopic;
  const roleTerms = uniqStrings(topic.roleTerms).map(normalizeKeyPart).sort();
  const anchors = uniqStrings([
    ...topic.anchors,
    ...topic.sourceIds,
    ...topic.aliases.slice(0, 3),
  ])
    .map(normalizeKeyPart)
    .filter(Boolean)
    .sort()
    .slice(0, 8);
  const topicKey = normalizeKeyPart(topic.id || topic.label);
  if (!topicKey) return { skipReason: 'missing_topic_key' };
  const canonicalKey = [
    `topic:${topicKey}`,
    `intent:${intent}`,
    roleTerms.length ? `roles:${roleTerms.join(',')}` : '',
    anchors.length ? `anchors:${anchors.join(',')}` : '',
  ]
    .filter(Boolean)
    .join('|');
  const canonicalQuestion = `${topic.label} / ${intent}${
    roleTerms.length ? ` / ${roleTerms.join(', ')}` : ''
  }`;
  return {
    value: {
      canonicalKey,
      canonicalQuestion,
      topicLabel: topic.label,
      topicId: topic.id,
      intent,
    },
  };
}

export class AnswerMemoryService {
  private readonly repo: AnswerMemoryRepository;

  constructor(db: Database.Database) {
    this.repo = new AnswerMemoryRepository(db);
  }

  findPrior(input: {
    query: string;
    contextMatch?: MemoryContextMatchResult;
    parsedIntent?: ParsedQueryIntent;
  }): AnswerMemoryFindPriorResult {
    const canonical = contextToCanonical(
      input.query,
      input.contextMatch,
      input.parsedIntent,
    );
    if (!canonical.value) {
      return {
        diagnostic: {
          state: 'skipped',
          skipReason: canonical.skipReason ?? 'canonical_unavailable',
          receipt: buildAnswerMemoryReceipt({
            state: 'skipped',
            skipReason: canonical.skipReason ?? 'canonical_unavailable',
          }),
        },
      };
    }
    const thread = this.repo.getThreadByCanonicalKey(
      canonical.value.canonicalKey,
    );
    if (!thread?.currentVersionId) {
      return {
        diagnostic: {
          state: 'skipped',
          canonicalKey: canonical.value.canonicalKey,
          skipReason: 'no_thread',
          receipt: buildAnswerMemoryReceipt({
            state: 'skipped',
            skipReason: 'no_thread',
          }),
        },
      };
    }
    const version = this.repo.getVersionById(thread.currentVersionId);
    if (!version) {
      return {
        diagnostic: {
          state: 'skipped',
          canonicalKey: canonical.value.canonicalKey,
          threadId: thread.id,
          skipReason: 'missing_current_version',
          receipt: buildAnswerMemoryReceipt({
            state: 'skipped',
            skipReason: 'missing_current_version',
          }),
        },
      };
    }
    const stale =
      typeof thread.staleAfter === 'number' && thread.staleAfter <= now();
    return {
      prior: {
        threadId: thread.id,
        canonicalKey: thread.canonicalKey,
        canonicalQuestion: thread.canonicalQuestion,
        topicLabel: thread.topicLabel,
        intent: thread.intent as AnswerMemoryIntent,
        currentAnswer: version.answerMd,
        stance: version.stance,
        confidence: version.confidence,
        evidenceRefs: version.evidenceRefs,
        unknowns: thread.unknowns,
        changeConditions: thread.changeConditions,
        status: thread.status,
        lastAskedAt: thread.lastAskedAt,
        lastVerifiedAt: thread.lastVerifiedAt,
        staleAfter: thread.staleAfter,
      },
      diagnostic: {
        state: 'priorHit',
        canonicalKey: thread.canonicalKey,
        threadId: thread.id,
        receipt: buildAnswerMemoryReceipt({
          state: 'priorHit',
          priorEvidenceCount: version.evidenceRefs.length,
          stale,
          lastVerifiedAt: thread.lastVerifiedAt,
          staleAfter: thread.staleAfter,
        }),
      },
    };
  }

  observeAskOutcome(input: AnswerMemoryObserveInput): AnswerMemoryDiagnostic {
    const canonical = contextToCanonical(
      input.query,
      input.contextMatch,
      input.parsedIntent,
    );
    if (!canonical.value) {
      return {
        state: 'skipped',
        skipReason: canonical.skipReason ?? 'canonical_unavailable',
        receipt: buildAnswerMemoryReceipt({
          state: 'skipped',
          skipReason: canonical.skipReason ?? 'canonical_unavailable',
        }),
      };
    }
    const evidenceRefs = buildEvidenceRefs(input.recalledItems);
    if (evidenceRefs.length === 0) {
      return {
        state: 'skipped',
        canonicalKey: canonical.value.canonicalKey,
        skipReason: 'no_evidence',
        receipt: buildAnswerMemoryReceipt({
          state: 'skipped',
          skipReason: 'no_evidence',
        }),
      };
    }

    const currentTime = now();
    const answerHash = hashText(input.answer);
    const evidenceHash = hashEvidenceRefs(evidenceRefs);
    const observation = this.repo.createObservation({
      requestId: input.requestId,
      canonicalKey: canonical.value.canonicalKey,
      canonicalQuestion: canonical.value.canonicalQuestion,
      topicLabel: canonical.value.topicLabel,
      topicId: canonical.value.topicId,
      intent: canonical.value.intent,
      queryHash: hashText(input.query),
      answerHash,
      evidenceHash,
      evidenceRefs,
      contextMatch: input.contextMatch as unknown as Record<string, unknown>,
      recallDiagnostics: input.channelDiagnostics ?? [],
      createdAt: currentTime,
    });

    const existingThread = this.repo.getThreadByCanonicalKey(
      canonical.value.canonicalKey,
    );
    if (existingThread) {
      return this.updateExistingThread({
        thread: existingThread,
        canonical: canonical.value,
        answer: input.answer,
        answerHash,
        evidenceHash,
        evidenceRefs,
        missingInfo: input.missingInfo,
        confidence: input.confidence,
        channelDiagnostics: input.channelDiagnostics,
        askedAt: currentTime,
      });
    }

    const recentObservations = this.repo.listRecentObservations(
      canonical.value.canonicalKey,
      currentTime - OBSERVATION_WINDOW_SECONDS,
    );
    const shouldPromote =
      recentObservations.length >= 2 ||
      Boolean(input.followUpActions && input.followUpActions.length > 0);
    if (!shouldPromote) {
      return {
        state: 'observed',
        canonicalKey: canonical.value.canonicalKey,
        authority: buildAuthorityReceipt({
          subjectKey: canonical.value.canonicalKey,
          evidenceRefs,
          currentStance: stanceFromAnswer(input.answer),
        }),
        receipt: buildAnswerMemoryReceipt({
          state: 'observed',
          currentEvidenceCount: evidenceRefs.length,
          followUpActionCount: countPresent(input.followUpActions),
          missingInfoCount: countPresent(input.missingInfo),
        }),
      };
    }

    const thread = this.repo.createThread({
      canonicalKey: canonical.value.canonicalKey,
      canonicalQuestion: canonical.value.canonicalQuestion,
      aliases: [input.query],
      topicLabel: canonical.value.topicLabel,
      topicId: canonical.value.topicId,
      intent: canonical.value.intent,
      status: this.statusForAnswer(input.answer, input.missingInfo),
      askCount: Math.max(1, recentObservations.length),
      confidence: input.confidence ?? 0.55,
      evidenceHash,
      unknowns: extractUnknowns(input.answer, input.missingInfo),
      changeConditions: defaultChangeConditions(canonical.value.intent),
      lastAskedAt: currentTime,
      lastVerifiedAt: currentTime,
      staleAfter: staleAfterForIntent(canonical.value.intent, currentTime),
      createdAt: currentTime,
      updatedAt: currentTime,
    });
    const version = this.repo.createVersion({
      threadId: thread.id,
      answerMd: input.answer,
      stance: stanceFromAnswer(input.answer),
      confidence: input.confidence ?? thread.confidence,
      evidenceRefs,
      missingEvidence: extractUnknowns(input.answer, input.missingInfo),
      recallDiagnostics: input.channelDiagnostics ?? [],
      answerHash,
      evidenceHash,
      createdAt: currentTime,
    });
    this.repo.updateThreadCurrentVersion({
      threadId: thread.id,
      versionId: version.id,
      status: thread.status,
      confidence: version.confidence,
      evidenceHash,
      unknowns: extractUnknowns(input.answer, input.missingInfo),
      changeConditions: defaultChangeConditions(canonical.value.intent),
      lastAskedAt: currentTime,
      lastVerifiedAt: currentTime,
      staleAfter: staleAfterForIntent(canonical.value.intent, currentTime),
      updatedAt: currentTime,
    });
    this.repo.markObservationsPromoted(observation.canonicalKey, thread.id);

    return {
      state: 'promoted',
      threadId: thread.id,
      canonicalKey: canonical.value.canonicalKey,
      authority: buildAuthorityReceipt({
        subjectKey: canonical.value.canonicalKey,
        evidenceRefs,
        currentStance: version.stance,
      }),
      receipt: buildAnswerMemoryReceipt({
        state: 'promoted',
        currentEvidenceCount: evidenceRefs.length,
        followUpActionCount: countPresent(input.followUpActions),
        missingInfoCount: countPresent(input.missingInfo),
        lastVerifiedAt: currentTime,
        staleAfter: thread.staleAfter,
      }),
    };
  }

  formatPriorForPrompt(prior: AnswerMemoryPrior | undefined): string {
    if (!prior) return '';
    const evidenceSummary = prior.evidenceRefs
      .slice(0, 4)
      .map((ref) => `${ref.type}:${ref.id}${ref.title ? ` (${ref.title})` : ''}`)
      .join(', ');
    return [
      'Answer memory prior (previous state, not authoritative):',
      `- Canonical question: ${prior.canonicalQuestion}`,
      `- Previous answer: ${clip(prior.currentAnswer, 900)}`,
      `- Previous stance/confidence: ${prior.stance} / ${prior.confidence.toFixed(2)}`,
      prior.unknowns.length
        ? `- Known gaps: ${prior.unknowns.join('; ')}`
        : '- Known gaps: none recorded',
      prior.changeConditions.length
        ? `- Re-check if: ${prior.changeConditions.join('; ')}`
        : '- Re-check if: new evidence appears',
      evidenceSummary ? `- Prior evidence refs: ${evidenceSummary}` : '',
      'Use this only to focus recall and compare state. The final answer must still be supported by current evidence.',
    ]
      .filter(Boolean)
      .join('\n');
  }

  buildRecallHintText(prior: AnswerMemoryPrior | undefined): string {
    if (!prior) return '';
    return clip(
      [
        prior.topicLabel,
        prior.intent,
        prior.unknowns.join(' '),
        prior.changeConditions.join(' '),
        prior.evidenceRefs
          .map((ref) => `${ref.title ?? ''} ${ref.id}`)
          .join(' '),
      ].join(' '),
      400,
    );
  }

  verificationIdempotencyKey(prior: AnswerMemoryPrior | undefined): string | undefined {
    return prior ? `answer_thread:${prior.threadId}:verification` : undefined;
  }

  private updateExistingThread(input: {
    thread: AnswerMemoryThreadRecord;
    canonical: CanonicalContext;
    answer: string;
    answerHash: string;
    evidenceHash: string;
    evidenceRefs: AnswerMemoryEvidenceRef[];
    missingInfo?: string[];
    confidence?: number;
    channelDiagnostics?: RecallChannelDiagnostic[];
    askedAt: number;
  }): AnswerMemoryDiagnostic {
    this.repo.incrementThreadAskCount(input.thread.id, input.askedAt);
    const currentVersion = input.thread.currentVersionId
      ? this.repo.getVersionById(input.thread.currentVersionId)
      : null;
    const stale =
      typeof input.thread.staleAfter === 'number' &&
      input.thread.staleAfter <= input.askedAt;
    const priorEvidenceCount = currentVersion?.evidenceRefs.length ?? 0;
    const currentStance = stanceFromAnswer(input.answer);
    const sameEvidence =
      Boolean(currentVersion?.evidenceHash) &&
      currentVersion?.evidenceHash === input.evidenceHash;
    const wouldWriteVersion =
      !currentVersion ||
      currentVersion.answerHash !== input.answerHash ||
      currentVersion.evidenceHash !== input.evidenceHash ||
      stale;
    const authority = buildAuthorityReceipt({
      subjectKey: input.thread.canonicalKey,
      evidenceRefs: input.evidenceRefs,
      priorEvidenceCount,
      currentStance,
      priorStance: currentVersion?.stance,
      sameEvidence,
      stale,
      wouldWriteVersion,
    });
    const shouldCreateVersion =
      wouldWriteVersion && authority.suppressedUpdate !== true;

    if (!shouldCreateVersion) {
      return {
        state: 'priorHit',
        threadId: input.thread.id,
        canonicalKey: input.thread.canonicalKey,
        authority,
        receipt: buildAnswerMemoryReceipt({
          state: 'priorHit',
          currentEvidenceCount: input.evidenceRefs.length,
          priorEvidenceCount,
          missingInfoCount: countPresent(input.missingInfo),
          stale,
          lastVerifiedAt: input.thread.lastVerifiedAt,
          staleAfter: input.thread.staleAfter,
        }),
      };
    }

    const unknowns = extractUnknowns(input.answer, input.missingInfo);
    const nextStaleAfter = staleAfterForIntent(input.canonical.intent, input.askedAt);
    const version = this.repo.createVersion({
      threadId: input.thread.id,
      answerMd: input.answer,
      stance: currentStance,
      confidence: input.confidence ?? input.thread.confidence,
      evidenceRefs: input.evidenceRefs,
      missingEvidence: unknowns,
      recallDiagnostics: input.channelDiagnostics ?? [],
      answerHash: input.answerHash,
      evidenceHash: input.evidenceHash,
      createdAt: input.askedAt,
    });
    this.repo.updateThreadCurrentVersion({
      threadId: input.thread.id,
      versionId: version.id,
      status: this.statusForAnswer(input.answer, input.missingInfo),
      confidence: version.confidence,
      evidenceHash: input.evidenceHash,
      unknowns,
      changeConditions: defaultChangeConditions(input.canonical.intent),
      lastAskedAt: input.askedAt,
      lastVerifiedAt: input.askedAt,
      staleAfter: nextStaleAfter,
      updatedAt: input.askedAt,
    });
    return {
      state: 'updated',
      threadId: input.thread.id,
      canonicalKey: input.thread.canonicalKey,
      authority,
      receipt: buildAnswerMemoryReceipt({
        state: 'updated',
        currentEvidenceCount: input.evidenceRefs.length,
        priorEvidenceCount,
        missingInfoCount: countPresent(input.missingInfo),
        stale,
        lastVerifiedAt: input.askedAt,
        staleAfter: nextStaleAfter,
      }),
    };
  }

  private statusForAnswer(
    answer: string,
    missingInfo?: string[],
  ): AnswerMemoryThreadStatus {
    const unknowns = extractUnknowns(answer, missingInfo);
    return unknowns.length > 0 ? 'needs_verification' : 'active';
  }
}
