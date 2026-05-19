import { randomUUID } from 'node:crypto';
import type Database from 'better-sqlite3';

import {
  RingCentralClient,
  type RingCentralActorIdentity,
  type RingCentralPost,
} from '../integrations/RingCentralClient.js';
import {
  ActionRepository,
  type QueuedActionRecord,
} from '../repositories/ActionRepository.js';
import { ActionResultRepository } from '../repositories/ActionResultRepository.js';
import { ConfirmRequestRepository } from '../repositories/ConfirmRequestRepository.js';
import {
  OutreachRepository,
  type OutreachOriginKind,
  type OutreachSessionListFilters,
  type OutreachSessionRecord,
  type OutreachSessionStatus,
  type OutreachSummary,
  type UpsertOutreachTemplateInput,
} from '../repositories/OutreachRepository.js';
import { getUserRuntimeConfig } from '../runtimeConfig.js';
import type { UserDataManager } from '../storage/UserDataManager.js';
import { now } from '../utils/time.js';
import { getLLMClient } from '../llm/LLMClient.js';
import { RecallEngine } from './RecallEngine.js';
import { ReflectionThreadService } from './ReflectionThreadService.js';
import {
  EvidenceResolutionPlanner,
  type CandidateArtifact,
  type EvidenceResolutionPlan,
  type EvidenceResolutionPolicy,
} from './EvidenceResolutionPlanner.js';
import type {
  DelegationArtifact,
  DelegationOutcome,
} from '../integrations/OpenClawDelegationService.js';
import { resolveDelegateOpenClawPolicy } from './actions/delegateOpenClawPolicy.js';
import { NotificationCenterService } from './NotificationCenterService.js';

interface ParsedReply {
  classification: 'answer' | 'defer' | 'irrelevant' | 'decline' | 'unclear';
  confidence: number;
  etaAt?: number;
  reason?: string;
}

interface CreateSessionFromActionInput {
  action: QueuedActionRecord;
}

interface CreateSessionFromMessageInput {
  chatId: string;
  postId: string;
  messageText: string;
  messageUrl?: string;
  messageCreatedAt?: number;
  messageTimestampText?: string;
  senderName?: string;
  groupName?: string;
  targetType?: string;
  targetRef?: string;
  targetResolvedChatId?: string;
  targetResolvedLabel?: string;
  followupIntervalSeconds?: number;
  maxFollowup?: number;
  context?: string;
}

export type GlipMessageMarkerType =
  | 'outreach_initial_ask'
  | 'outreach_followup';

export interface GlipMessageMarker {
  id: string;
  type: GlipMessageMarkerType;
  label: string;
  chatId: string;
  postId: string;
  source: 'memory_service';
  sourceId: string;
  sessionId: string;
  status: OutreachSessionStatus;
  tooltip?: string;
  updatedAt: number;
  nextCheckAt?: number;
}

interface OutreachSessionDetail {
  session: OutreachSessionRecord;
  events: ReturnType<OutreachRepository['listEventsBySession']>;
  actions: ReturnType<ActionRepository['list']>['items'];
  evidence: OutreachSessionEvidenceItem[];
}

interface OutreachSessionEvidenceItem {
  sourceKind: string;
  sourceId?: string;
  title?: string;
  content: string;
  createdAt?: number;
  metadata?: Record<string, unknown>;
}

interface UpdateOutreachSessionDraftInput {
  targetType?: string;
  targetRef?: string;
  targetResolutionStatus?: 'unresolved' | 'ambiguous' | 'resolved';
  targetResolvedType?: string | null;
  targetResolvedId?: string | null;
  targetResolvedLabel?: string | null;
  targetResolvedChatId?: string | null;
  targetCandidates?: Array<Record<string, unknown>> | null;
  renderedQuestion?: string;
  renderedContext?: string | null;
  nextCheckAt?: number | null;
}

interface AggregatedReplyBatch {
  latestPostId: string;
  replyPostIds: string[];
  replySender: string | null;
  replyText: string;
}

type OutreachAnswerResolutionPhase =
  | 'before_dispatch'
  | 'before_followup'
  | 'direct_reply';
type OutreachAnswerHitSource =
  | 'direct_reply'
  | 'target_channel_history'
  | 'global_memory';

interface OutreachAnswerEvidenceItem {
  sourceKind: OutreachAnswerHitSource;
  sourceId?: string;
  title?: string;
  content: string;
  createdAt?: number;
  metadata?: Record<string, unknown>;
}

interface OutreachAnswerResolutionHit {
  phase: OutreachAnswerResolutionPhase;
  hitSource: OutreachAnswerHitSource;
  relatedMessage?: string;
  relatedMessageId?: string;
  evidence: OutreachAnswerEvidenceItem[];
  resolution: EvidenceResolutionPlan;
  summary: string;
}

const TERMINAL_STATUSES = new Set<OutreachSessionStatus>([
  'resolved',
  'no_reply',
  'escalated',
  'cancelled',
  'failed',
]);
const GLIP_MARKER_ACTIVE_STATUSES = new Set<OutreachSessionStatus>([
  'pending_approval',
  'scheduled',
  'waiting_reply',
  'deferred',
]);
const REPLY_BURST_WINDOW_SECONDS = 5 * 60;
const OUTREACH_RECENT_QA_PAIR_WINDOW_SECONDS = 24 * 60 * 60;
const PERSON_MENTION_RE = /!\[:Person\]\(([^)]+)\)/g;

function parsePostCreatedAtSeconds(post: RingCentralPost): number | null {
  if (!post.createdAt) return null;
  const parsed = Date.parse(post.createdAt);
  return Number.isFinite(parsed) ? Math.floor(parsed / 1000) : null;
}

function normalizeIdentityValue(
  value: string | null | undefined,
): string | undefined {
  if (typeof value !== 'string') return undefined;
  const normalized = value.trim().toLowerCase();
  return normalized.length > 0 ? normalized : undefined;
}

function isSelfAuthoredPost(
  post: RingCentralPost,
  selfActor: RingCentralActorIdentity | null,
): boolean {
  if (!selfActor) return false;
  const creatorId = normalizeIdentityValue(post.creatorId);
  const creatorName = normalizeIdentityValue(post.creatorName);
  const selfExtensionId = normalizeIdentityValue(selfActor.extensionId);
  const selfEmail = normalizeIdentityValue(selfActor.email);
  const selfDisplayName = normalizeIdentityValue(selfActor.displayName);

  if (creatorId && selfExtensionId && creatorId === selfExtensionId) {
    return true;
  }
  if (creatorName && selfEmail && creatorName === selfEmail) {
    return true;
  }
  if (creatorName && selfDisplayName && creatorName === selfDisplayName) {
    return true;
  }
  return false;
}

function normalizeIdentityFingerprint(
  value: string | null | undefined,
): string | undefined {
  if (typeof value !== 'string') return undefined;
  const compact = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fff]+/gu, '');
  return compact.length > 0 ? compact : undefined;
}

function buildTargetIdentityFingerprints(
  session: Pick<
    OutreachSessionRecord,
    'targetResolvedId' | 'targetResolvedLabel' | 'targetRef'
  >,
): string[] {
  return uniqStrings([
    session.targetResolvedId,
    session.targetResolvedLabel,
    session.targetRef,
  ])
    .map((value) => normalizeIdentityFingerprint(value))
    .filter((value): value is string => Boolean(value));
}

function isTargetAuthoredPost(
  post: RingCentralPost,
  session: Pick<
    OutreachSessionRecord,
    'targetResolvedId' | 'targetResolvedLabel' | 'targetRef'
  >,
): boolean {
  const targetResolvedId = normalizeIdentityValue(session.targetResolvedId);
  const creatorId = normalizeIdentityValue(post.creatorId);
  if (targetResolvedId && creatorId && targetResolvedId === creatorId) {
    return true;
  }

  const targetFingerprints = new Set(buildTargetIdentityFingerprints(session));
  if (targetFingerprints.size === 0) return false;

  const creatorFingerprints = uniqStrings([post.creatorId, post.creatorName])
    .map((value) => normalizeIdentityFingerprint(value))
    .filter((value): value is string => Boolean(value));

  return creatorFingerprints.some((value) => targetFingerprints.has(value));
}

function isLikelyPromptPost(
  post: RingCentralPost,
  session: Pick<
    OutreachSessionRecord,
    'targetType' | 'targetResolvedId' | 'targetResolvedLabel' | 'targetRef'
  >,
  selfActor: RingCentralActorIdentity | null,
): boolean {
  if (selfActor) {
    return isSelfAuthoredPost(post, selfActor);
  }
  if (session.targetType === 'private') {
    return !isTargetAuthoredPost(post, session);
  }
  return false;
}

function isLikelyReplyPost(
  post: RingCentralPost,
  session: Pick<
    OutreachSessionRecord,
    'targetType' | 'targetResolvedId' | 'targetResolvedLabel' | 'targetRef'
  >,
  selfActor: RingCentralActorIdentity | null,
): boolean {
  if (selfActor) {
    return !isSelfAuthoredPost(post, selfActor);
  }
  if (session.targetType === 'private') {
    return isTargetAuthoredPost(post, session);
  }
  return true;
}

function aggregateReplyBatch(
  posts: RingCentralPost[],
  session: OutreachSessionRecord,
  processedReplyPostIds: Set<string>,
  selfActor: RingCentralActorIdentity | null,
): AggregatedReplyBatch | null {
  const candidates = posts
    .filter((post) => post.id !== session.sentPostId)
    .filter((post) => post.text.trim().length > 0)
    .filter((post) => !processedReplyPostIds.has(post.id))
    .filter((post) => isLikelyReplyPost(post, session, selfActor))
    .sort(
      (a, b) =>
        (parsePostCreatedAtSeconds(a) ?? 0) -
        (parsePostCreatedAtSeconds(b) ?? 0),
    );

  if (candidates.length === 0) return null;

  const latest = candidates[candidates.length - 1];
  const anchorSeconds = parsePostCreatedAtSeconds(latest);
  const anchorSender = latest.creatorId ?? latest.creatorName ?? null;
  const burst: RingCentralPost[] = [];

  for (let index = candidates.length - 1; index >= 0; index -= 1) {
    const post = candidates[index];
    const sender = post.creatorId ?? post.creatorName ?? null;
    const postSeconds = parsePostCreatedAtSeconds(post);
    const sameSender =
      Boolean(anchorSender && sender && anchorSender === sender) ||
      (!anchorSender && !sender);
    const insideWindow =
      anchorSeconds == null || postSeconds == null
        ? true
        : anchorSeconds - postSeconds <= REPLY_BURST_WINDOW_SECONDS;
    if (burst.length > 0 && (!sameSender || !insideWindow)) {
      break;
    }
    burst.unshift(post);
  }

  return {
    latestPostId: latest.id,
    replyPostIds: burst.map((item) => item.id),
    replySender: latest.creatorName ?? latest.creatorId ?? null,
    replyText: burst.map((item) => item.text.trim()).join('\n'),
  };
}

function buildSessionSummary(
  status: OutreachSessionStatus,
  question: string,
): string {
  if (status === 'resolved') return `Outreach resolved: ${question}`;
  if (status === 'no_reply')
    return `Outreach timed out with no reply: ${question}`;
  if (status === 'escalated')
    return `Outreach escalated for manual decision: ${question}`;
  if (status === 'failed') return `Outreach failed to dispatch: ${question}`;
  if (status === 'cancelled') return `Outreach cancelled: ${question}`;
  return `Outreach status ${status}: ${question}`;
}

function uniqStrings(values: Array<string | null | undefined>): string[] {
  return Array.from(
    new Set(
      values
        .filter(
          (value): value is string =>
            typeof value === 'string' && value.trim().length > 0,
        )
        .map((value) => value.trim()),
    ),
  );
}

function firstNonEmptyString(...values: unknown[]): string | undefined {
  for (const value of values) {
    if (typeof value === 'string' && value.trim().length > 0) {
      return value.trim();
    }
  }
  return undefined;
}

function readStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return uniqStrings(
    value.map((item) => (typeof item === 'string' ? item : undefined)),
  );
}

function extractTextTerms(value: string): string[] {
  const matches =
    value.match(/[a-z0-9][a-z0-9._:-]{1,}|[\u4e00-\u9fff]{2,}/giu) ?? [];
  const expanded: string[] = [];
  for (const match of matches) {
    const normalized = match.toLowerCase();
    expanded.push(normalized);
    if (/^[\u4e00-\u9fff]{3,}$/u.test(match)) {
      for (let index = 0; index <= match.length - 2; index += 1) {
        expanded.push(match.slice(index, index + 2));
      }
    }
  }
  return uniqStrings(expanded).filter((item) => item.length >= 2);
}

function computeTextOverlapScore(text: string, terms: string[]): number {
  const normalized = text.toLowerCase();
  let score = 0;
  for (const term of terms) {
    if (!normalized.includes(term)) continue;
    score += term.length >= 4 ? 2 : 1;
  }
  return score;
}

function stringifyStructuredValue(
  value: unknown,
  limit = 1600,
): string | undefined {
  if (value == null) return undefined;
  if (typeof value === 'string') {
    return value.trim().slice(0, limit) || undefined;
  }
  try {
    const serialized = JSON.stringify(value);
    if (!serialized) return undefined;
    return serialized.slice(0, limit);
  } catch {
    return undefined;
  }
}

function delegationArtifactToCandidateArtifact(
  artifact: DelegationArtifact,
): CandidateArtifact {
  return {
    kind: artifact.kind || 'external_evidence',
    title: artifact.title,
    content: artifact.content,
    sourceKind: 'delegate_openclaw',
    metadata:
      artifact.metadata &&
      typeof artifact.metadata === 'object' &&
      !Array.isArray(artifact.metadata)
        ? { ...artifact.metadata }
        : undefined,
  };
}

function mergeCandidateArtifacts(
  ...groups: Array<unknown>
): CandidateArtifact[] {
  const merged: CandidateArtifact[] = [];
  const seen = new Set<string>();

  for (const group of groups) {
    if (!Array.isArray(group)) continue;
    for (const item of group) {
      if (!item || typeof item !== 'object' || Array.isArray(item)) continue;
      const artifact = item as CandidateArtifact;
      const key = [
        artifact.kind ?? '',
        artifact.title ?? '',
        artifact.url ?? '',
        artifact.content ?? '',
      ].join('|');
      if (seen.has(key)) continue;
      seen.add(key);
      merged.push(artifact);
    }
  }

  return merged.slice(0, 12);
}

function extractOutcomeSummary(
  outcome: Record<string, unknown> | null | undefined,
): string | undefined {
  if (!outcome) return undefined;
  const candidates = [
    outcome.resolvedConclusion,
    outcome.summary,
    outcome.reason,
    outcome.answer,
    outcome.answerText,
    outcome.reply,
  ];
  const found = candidates.find(
    (value) => typeof value === 'string' && value.trim().length > 0,
  );
  return typeof found === 'string' ? found.trim() : undefined;
}

function formatTimestampAsLocale(value: number): string {
  const ms = value > 1_000_000_000_000 ? value : value * 1000;
  return new Date(ms).toLocaleString('zh-CN', {
    hour12: false,
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function buildFallbackOutcomeSummary(
  session: OutreachSessionRecord,
  classification: ParsedReply['classification'],
  replyText?: string,
  etaAt?: number,
): string {
  const target = session.targetResolvedLabel ?? session.targetRef;
  const reply = replyText?.trim();
  if (classification === 'answer') {
    return reply ? `${target} 已回复：${reply}` : `${target} 已给出可用回复。`;
  }
  if (classification === 'decline') {
    return reply
      ? `${target} 明确表示无法提供信息：${reply}`
      : `${target} 明确拒绝了这次询问。`;
  }
  if (classification === 'defer') {
    if (etaAt) {
      return `${target} 表示稍后回复，预计 ${formatTimestampAsLocale(etaAt)} 前后再跟进。`;
    }
    return `${target} 表示稍后回复，系统将继续等待。`;
  }
  if (classification === 'unclear' || classification === 'irrelevant') {
    return reply
      ? `${target} 已回复，但当前还不足以直接使用：${reply}`
      : `${target} 已回复，但内容暂时不可直接使用。`;
  }
  return reply ? `${target} 回复：${reply}` : `已收到来自 ${target} 的回复。`;
}

function normalizeString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0
    ? value.trim()
    : undefined;
}

function normalizeUnixTimestamp(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
    return Math.floor(value > 1_000_000_000_000 ? value / 1000 : value);
  }
  if (typeof value === 'string' && value.trim().length > 0) {
    const numeric = Number(value);
    if (Number.isFinite(numeric) && numeric > 0) {
      return Math.floor(numeric > 1_000_000_000_000 ? numeric / 1000 : numeric);
    }
    const parsed = Date.parse(value);
    if (Number.isFinite(parsed)) {
      return Math.floor(parsed / 1000);
    }
  }
  return undefined;
}

function extractPersonMentionIds(text: string): string[] {
  const ids: string[] = [];
  PERSON_MENTION_RE.lastIndex = 0;
  for (const match of text.matchAll(PERSON_MENTION_RE)) {
    const id = match[1]?.trim();
    if (id) ids.push(id);
  }
  return uniqStrings(ids);
}

function mergeMentionLabelsIntoMetadata(
  metadata: Record<string, unknown> | undefined,
  mentionLabels: Record<string, string>,
): Record<string, unknown> | undefined {
  if (Object.keys(mentionLabels).length === 0) {
    return metadata;
  }
  return {
    ...(metadata ?? {}),
    mentionLabels,
  };
}

function mergePostMentionLabels(...posts: RingCentralPost[]): Record<string, string> {
  const labels: Record<string, string> = {};
  for (const post of posts) {
    if (!post.mentionLabels) continue;
    for (const [id, label] of Object.entries(post.mentionLabels)) {
      if (label) {
        labels[id] = label;
      }
    }
  }
  return labels;
}

function sanitizeEvidenceMetadata(
  value: unknown,
): Record<string, unknown> | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return undefined;
  }

  const record = value as Record<string, unknown>;
  const allowed: Record<string, unknown> = {};
  const allowList = [
    'sourceSystem',
    'answerResolutionPhase',
    'phase',
    'hitSource',
    'ruleRef',
    'replyClassification',
    'replyConfidence',
    'mentionLabels',
  ];

  for (const key of allowList) {
    if (record[key] !== undefined) {
      allowed[key] = record[key];
    }
  }

  return Object.keys(allowed).length > 0 ? allowed : undefined;
}

function stripDelegationFailureSuffix(value: unknown): string | undefined {
  let current = normalizeString(value);
  while (current) {
    const markerIndex = current.lastIndexOf('；但外部查证暂未成功：');
    if (markerIndex < 0) {
      return current;
    }
    current = normalizeString(current.slice(0, markerIndex));
  }
  return undefined;
}

function stripDelegationFailureFields(
  outcome: Record<string, unknown>,
): Record<string, unknown> {
  const {
    delegationFailureStatus: _delegationFailureStatus,
    delegationFailureSummary: _delegationFailureSummary,
    delegationRecoveryActionIds: _delegationRecoveryActionIds,
    delegationRecoveryPrompt: _delegationRecoveryPrompt,
    ...rest
  } = outcome;
  return rest;
}

function isSelfDirectedTarget(targetType: string, targetRef: string): boolean {
  const normalizedTargetType = targetType.trim().toLowerCase();
  const normalizedTargetRef = targetRef.trim().toLowerCase();
  if (
    normalizedTargetRef === 'user' ||
    normalizedTargetRef === 'me' ||
    normalizedTargetRef === 'self'
  ) {
    return (
      normalizedTargetType === 'private' || normalizedTargetType === 'person'
    );
  }
  return (
    normalizedTargetType === 'person' && normalizedTargetRef === 'current-user'
  );
}

function isResolvedTargetStatus(status: string | undefined): boolean {
  return status === 'resolved';
}

function parseScheduleSeed(
  scheduleDate: string,
  scheduleTime: string,
): Date | null {
  const seed = new Date(
    `${scheduleDate}T${scheduleTime.length === 5 ? `${scheduleTime}:00` : scheduleTime}`,
  );
  return Number.isNaN(seed.getTime()) ? null : seed;
}

function parseRepeatDays(value: unknown): number[] {
  const rawDays = Array.isArray(value)
    ? value
    : typeof value === 'string'
      ? value.split(',')
      : [];

  return Array.from(
    new Set(
      rawDays
        .map((item) => Number(String(item).trim()))
        .filter((day) => Number.isInteger(day) && day >= 0 && day <= 6),
    ),
  ).sort((left, right) => left - right);
}

function getDayStart(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function getWeekIndexSinceStart(candidate: Date, start: Date): number {
  const daysSinceStart = Math.floor(
    (getDayStart(candidate).getTime() - getDayStart(start).getTime()) /
      86400000,
  );
  return Math.floor(daysSinceStart / 7);
}

function isAfterScheduleEndDate(candidate: Date, endDate?: string): boolean {
  if (!endDate) return false;
  const parsedEndDate = parseScheduleSeed(endDate, '00:00');
  if (!parsedEndDate) return false;
  return (
    getDayStart(candidate).getTime() > getDayStart(parsedEndDate).getTime()
  );
}

function findNextWeeklyRepeatDay(
  seed: Date,
  baselineDate: Date,
  every: number,
  allowedDays: number[],
  endDate?: string,
): Date | null {
  const searchFrom = new Date(Math.max(seed.getTime(), baselineDate.getTime()));
  const searchDay = getDayStart(searchFrom);

  for (let offset = 0; offset <= 366; offset += 1) {
    const candidate = new Date(
      searchDay.getFullYear(),
      searchDay.getMonth(),
      searchDay.getDate() + offset,
      seed.getHours(),
      seed.getMinutes(),
      0,
      0,
    );

    if (isAfterScheduleEndDate(candidate, endDate)) return null;
    if (candidate.getTime() <= baselineDate.getTime()) continue;
    if (!allowedDays.includes(candidate.getDay())) continue;

    const weekIndex = getWeekIndexSinceStart(candidate, seed);
    if (weekIndex >= 0 && weekIndex % every === 0) {
      return candidate;
    }
  }

  return null;
}

function parseNextDispatch(
  scheduleSpec: Record<string, unknown> | undefined,
  baseline: number,
): number | null {
  if (!scheduleSpec) return null;
  const scheduleDate = normalizeString(scheduleSpec.scheduleDate);
  const scheduleTime = normalizeString(scheduleSpec.scheduleTime) ?? '09:00';
  const repeatEvery = Number(scheduleSpec.repeatEvery);
  const repeatUnit = normalizeString(scheduleSpec.repeatUnit);
  const repeatDays = repeatUnit === 'Week'
    ? parseRepeatDays(scheduleSpec.repeatDays)
    : [];
  const endDate = normalizeString(scheduleSpec.endDate);
  const baselineDate = new Date(baseline * 1000);

  if (scheduleDate) {
    const seed = parseScheduleSeed(scheduleDate, scheduleTime);
    if (seed) {
      const candidate = new Date(seed.getTime());
      if (Number.isFinite(repeatEvery) && repeatEvery > 0 && repeatUnit) {
        if (repeatUnit === 'Week' && repeatDays.length > 0) {
          const nextWeeklyDay = findNextWeeklyRepeatDay(
            candidate,
            baselineDate,
            repeatEvery,
            repeatDays,
            endDate,
          );
          return nextWeeklyDay
            ? Math.floor(nextWeeklyDay.getTime() / 1000)
            : null;
        }

        for (let attempts = 0; attempts < 1000; attempts += 1) {
          if (isAfterScheduleEndDate(candidate, endDate)) return null;

          if (candidate.getTime() > baselineDate.getTime()) {
            if (
              repeatUnit !== 'Day' ||
              (candidate.getDay() >= 1 && candidate.getDay() <= 5)
            ) {
              return Math.floor(candidate.getTime() / 1000);
            }
          }

          if (repeatUnit === 'Day') {
            candidate.setDate(candidate.getDate() + repeatEvery);
          } else if (repeatUnit === 'Week') {
            candidate.setDate(candidate.getDate() + repeatEvery * 7);
          } else if (repeatUnit === 'Month') {
            candidate.setMonth(candidate.getMonth() + repeatEvery);
          } else if (repeatUnit === 'Year') {
            candidate.setFullYear(candidate.getFullYear() + repeatEvery);
          } else {
            break;
          }
        }
        return null;
      }

      const oneShotAt = Math.floor(seed.getTime() / 1000);
      return oneShotAt > baseline && !isAfterScheduleEndDate(seed, endDate)
        ? oneShotAt
        : null;
    }
  }

  const intervalSeconds = Number(scheduleSpec.intervalSeconds);
  const nextDispatchAt = Number(scheduleSpec.nextDispatchAt);
  if (Number.isFinite(intervalSeconds) && intervalSeconds > 0) {
    return Math.max(baseline + Math.floor(intervalSeconds), baseline + 60);
  }
  if (Number.isFinite(nextDispatchAt) && nextDispatchAt > baseline) {
    return Math.floor(nextDispatchAt);
  }
  return null;
}

function parseEtaFromText(
  text: string,
  currentTime: number,
): number | undefined {
  const lower = text.toLowerCase();
  const dayMatch = lower.match(/(\d+)\s*(day|days|天)/);
  if (dayMatch) {
    const days = Number(dayMatch[1]);
    if (Number.isFinite(days) && days > 0) {
      return currentTime + days * 86400;
    }
  }
  const hourMatch = lower.match(/(\d+)\s*(hour|hours|小时)/);
  if (hourMatch) {
    const hours = Number(hourMatch[1]);
    if (Number.isFinite(hours) && hours > 0) {
      return currentTime + hours * 3600;
    }
  }
  if (/tomorrow|明天|下周|next week/.test(lower)) {
    return currentTime + 86400;
  }
  return undefined;
}

function classifyReply(text: string, currentTime: number): ParsedReply {
  const normalized = text.trim();
  const lower = normalized.toLowerCase();

  if (!normalized) {
    return {
      classification: 'unclear',
      confidence: 0.2,
      reason: 'empty_reply',
    };
  }
  if (
    /not now|later|稍后|晚点|以后|下周|tomorrow|明天|\d+\s*(day|days|天|hour|hours|小时)/.test(
      lower,
    )
  ) {
    return {
      classification: 'defer',
      confidence: 0.75,
      etaAt: parseEtaFromText(normalized, currentTime),
      reason: 'defer_intent',
    };
  }
  if (/no|cannot|can't|拒绝|不方便|不行/.test(lower)) {
    return {
      classification: 'decline',
      confidence: 0.8,
      reason: 'decline_intent',
    };
  }
  if (normalized.length < 6) {
    return {
      classification: 'unclear',
      confidence: 0.35,
      reason: 'too_short',
    };
  }
  if (/ok|thanks|收到|好的/.test(lower) && normalized.length < 24) {
    return {
      classification: 'irrelevant',
      confidence: 0.55,
      reason: 'ack_without_answer',
    };
  }
  return {
    classification: 'answer',
    confidence: 0.7,
  };
}

export class OutreachEngine {
  private readonly repo: OutreachRepository;
  private readonly actionRepo: ActionRepository;
  private readonly actionResultRepo: ActionResultRepository;
  private readonly confirmRequestRepo: ConfirmRequestRepository;
  private readonly threadService: ReflectionThreadService;
  private readonly ringClient: RingCentralClient;
  private readonly evidencePlanner: EvidenceResolutionPlanner;
  private readonly recallEngine: RecallEngine;
  private readonly notificationCenterService: NotificationCenterService;

  constructor(
    private readonly db: Database.Database,
    private readonly userDataManager?: UserDataManager,
    private readonly userId?: string,
  ) {
    this.repo = new OutreachRepository(db);
    this.actionRepo = new ActionRepository(db);
    this.actionResultRepo = new ActionResultRepository(db);
    this.confirmRequestRepo = new ConfirmRequestRepository(db);
    this.threadService = new ReflectionThreadService(
      db,
      userDataManager,
      userId,
    );
    this.ringClient = new RingCentralClient(userDataManager, db, userId);
    this.evidencePlanner = new EvidenceResolutionPlanner();
    this.recallEngine = new RecallEngine(db);
    this.notificationCenterService = new NotificationCenterService(db);
  }

  private getRuntimeConfig() {
    return getUserRuntimeConfig(this.userDataManager);
  }

  async runSchedulerCycle(): Promise<void> {
    const runtime = this.getRuntimeConfig();
    if (!runtime.outreachEnabled) return;

    await this.ringClient.maintainDirectoryCache();
    await this.dispatchDueTemplates();
    await this.advancePendingSessions();
    await this.syncTerminalReflectionSessions();
  }

  upsertTemplate(input: UpsertOutreachTemplateInput) {
    if (isSelfDirectedTarget(input.targetType, input.targetRef)) {
      throw new Error('Outreach templates cannot target the current user.');
    }
    return this.repo.upsertTemplate(input);
  }

  pauseTemplate(id: string) {
    return this.repo.pauseTemplate(id);
  }

  cancelTemplate(id: string) {
    return this.repo.cancelTemplate(id);
  }

  listTemplateRuntimeStatus(limit = 100, ids?: string[]) {
    const templates =
      ids && ids.length > 0
        ? this.repo.listTemplateRuntimeStatus(ids)
        : this.repo.listTemplates(limit);
    return templates.map((template) => {
      const latestSession = template.lastSessionId
        ? this.repo.getSessionById(template.lastSessionId)
        : this.repo.listSessions({ templateId: template.id, limit: 1 })
            .items[0];
      return {
        template,
        latestSession: latestSession ?? null,
      };
    });
  }

  getSummary(): OutreachSummary {
    return this.repo.getSummary();
  }

  listSessions(filters: OutreachSessionListFilters = {}) {
    return this.repo.listSessions(filters);
  }

  async createSessionFromMessage(
    input: CreateSessionFromMessageInput,
  ): Promise<OutreachSessionRecord> {
    const chatId = normalizeString(input.chatId);
    const postId = normalizeString(input.postId);
    const question = normalizeString(input.messageText);
    if (!chatId || !postId) {
      throw new Error('chatId and postId are required.');
    }
    if (!question) {
      throw new Error('messageText is required.');
    }

    const existing =
      this.repo.getMessageReactionSessionByPost(chatId, postId) ??
      this.findMessageReactionSessionByOriginalPost(chatId, postId);
    if (existing) return existing;

    const createdAt =
      normalizeUnixTimestamp(input.messageCreatedAt) ??
      normalizeUnixTimestamp(input.messageTimestampText) ??
      now();
    const currentTime = now();
    const followupIntervalSeconds = Math.max(
      60,
      Math.floor(Number(input.followupIntervalSeconds ?? 86400)),
    );
    const maxFollowup = Math.max(
      0,
      Math.floor(Number(input.maxFollowup ?? 1)),
    );
    const targetType = normalizeString(input.targetType) ?? 'group';
    const targetRef = normalizeString(input.targetRef) ?? chatId;
    const targetResolvedChatId =
      normalizeString(input.targetResolvedChatId) ?? chatId;
    const targetResolvedLabel =
      normalizeString(input.targetResolvedLabel) ??
      normalizeString(input.groupName) ??
      targetRef;

    const session = this.repo.createSession({
      originKind: 'message_reaction',
      targetType,
      targetRef,
      targetResolutionStatus: 'resolved',
      targetResolvedType: targetType === 'private' ? 'person' : 'chat',
      targetResolvedLabel,
      targetResolvedChatId,
      renderedQuestion: question,
      renderedContext: normalizeString(input.context),
      status: 'waiting_reply',
      requiresApproval: false,
      followupCount: 0,
      maxFollowup,
      followupIntervalSeconds,
      waitUntil: createdAt + followupIntervalSeconds,
      nextCheckAt: currentTime,
      sentChatId: chatId,
      sentPostId: postId,
      createdAt,
      outcome: {
        originKind: 'message_reaction',
        originalChatId: chatId,
        originalPostId: postId,
        messageUrl: normalizeString(input.messageUrl),
        senderName: normalizeString(input.senderName),
      },
    });
    this.repo.createEvent(session.id, 'created', {
      originKind: 'message_reaction',
      source: 'glip_message_reaction',
      chatId,
      postId,
    });
    this.repo.createEvent(session.id, 'manual_initial_ask_registered', {
      chatId,
      postId,
      messageUrl: normalizeString(input.messageUrl) ?? null,
      senderName: normalizeString(input.senderName) ?? null,
      messageCreatedAt: createdAt,
    });
    this.insertOutreachMessage(
      'outreach_question',
      session,
      question,
      {
        chatId,
        postId,
        manualInitialAsk: true,
        messageUrl: normalizeString(input.messageUrl),
      },
      createdAt,
    );

    return this.repo.getSessionById(session.id)!;
  }

  listGlipMessageMarkers(limit = 500): {
    items: GlipMessageMarker[];
    generatedAt: number;
  } {
    const sessions = this.repo.listSessions({
      originKind: 'message_reaction',
      limit: Math.max(1, Math.min(limit, 500)),
    }).items;
    const markers: GlipMessageMarker[] = [];

    for (const session of sessions) {
      if (!GLIP_MARKER_ACTIVE_STATUSES.has(session.status)) {
        continue;
      }

      const events = this.repo.listEventsBySession(session.id, 500);
      const initialEvent = events.find(
        (event) => event.eventType === 'manual_initial_ask_registered',
      );
      const initialChatId =
        normalizeString(initialEvent?.payload?.chatId) ??
        normalizeString(session.outcome?.originalChatId) ??
        session.sentChatId;
      const initialPostId =
        normalizeString(initialEvent?.payload?.postId) ??
        normalizeString(session.outcome?.originalPostId);

      if (initialChatId && initialPostId) {
        markers.push({
          id: `outreach-initial:${session.id}:${initialChatId}:${initialPostId}`,
          type: 'outreach_initial_ask',
          label: '跟进中',
          chatId: initialChatId,
          postId: initialPostId,
          source: 'memory_service',
          sourceId: session.id,
          sessionId: session.id,
          status: session.status,
          tooltip: session.renderedQuestion,
          updatedAt: session.updatedAt,
          nextCheckAt: session.nextCheckAt,
        });
      }

      events
        .filter((event) => event.eventType === 'followup_sent')
        .forEach((event) => {
          const chatId = normalizeString(event.payload?.chatId);
          const postId = normalizeString(event.payload?.postId);
          if (!chatId || !postId) return;
          markers.push({
            id: `outreach-followup:${session.id}:${postId}`,
            type: 'outreach_followup',
            label: 'AI追问',
            chatId,
            postId,
            source: 'memory_service',
            sourceId: session.id,
            sessionId: session.id,
            status: session.status,
            tooltip: session.renderedQuestion,
            updatedAt: event.createdAt,
            nextCheckAt: session.nextCheckAt,
          });
        });
    }

    return { items: markers, generatedAt: now() };
  }

  async searchTargets(targetType: string, query: string, limit = 8) {
    return this.ringClient.searchTargets({
      targetType,
      targetRef: query,
      limit,
    });
  }

  async searchTargetsDetailed(targetType: string, query: string, limit = 8) {
    return this.ringClient.searchTargetsDetailed({
      targetType,
      targetRef: query,
      limit,
    });
  }

  getTargetDirectoryStatus() {
    return this.ringClient.getDirectoryStatus();
  }

  async syncTargetDirectory(force = false) {
    return this.ringClient.syncDirectory({ scopes: ['users', 'teams'], force });
  }

  async getSessionDetail(id: string): Promise<OutreachSessionDetail | null> {
    const session = await this.hydrateReplySender(this.repo.getSessionById(id));
    if (!session) return null;
    const actions = this.actionRepo.list({
      sourceKind: 'outreach_session',
      sourceRefId: id,
      limit: 20,
    }).items;
    return {
      session,
      events: this.repo.listEventsBySession(id, 200),
      actions,
      evidence: await this.buildSessionEvidence(session),
    };
  }

  async syncDelegationResultToSession(
    action: QueuedActionRecord,
    outcome: DelegationOutcome,
  ): Promise<void> {
    if (action.sourceKind !== 'outreach_session' || !action.sourceRefId) {
      return;
    }
    const session = this.repo.getSessionById(action.sourceRefId);
    if (!session) return;

    const existingOutcome =
      session.outcome &&
      typeof session.outcome === 'object' &&
      !Array.isArray(session.outcome)
        ? session.outcome
        : {};
    const baseOutcome = stripDelegationFailureFields(existingOutcome);
    const replyText =
      firstNonEmptyString(
        session.replyRawText,
        String(baseOutcome.reply ?? ''),
      ) ?? '';
    const evidence = this.buildDelegationSynthesisEvidence(
      session,
      action,
      outcome,
    );
    const synthesis = await this.evidencePlanner.resolve({
      question: session.renderedQuestion,
      context: session.renderedContext,
      evidence,
      policy: {
        scene: 'outreach',
        userIntentMode: 'informational',
        externalRead: 'disabled',
        externalWrite: 'disabled',
        allowAskExternalUser: false,
        allowCreateConfirmRequest: false,
      },
    });

    const resolutionState =
      synthesis.resolutionState === 'insufficient'
        ? baseOutcome.resolutionState === 'complete'
          ? 'complete'
          : 'partial'
        : synthesis.resolutionState;
    const directFindings = uniqStrings([
      ...readStringArray(baseOutcome.directFindings),
      ...synthesis.directFindings,
      synthesis.directFindings.length === 0 ? outcome.summary : undefined,
    ]);
    const resolvedConclusion =
      firstNonEmptyString(
        synthesis.resolvedConclusion,
        outcome.summary,
        stripDelegationFailureSuffix(baseOutcome.resolvedConclusion),
      ) ?? outcome.summary;
    const remainingQuestions =
      resolutionState === 'complete'
        ? []
        : readStringArray(synthesis.remainingQuestions);
    const candidateArtifacts = mergeCandidateArtifacts(
      baseOutcome.candidateArtifacts,
      synthesis.candidateArtifacts,
      outcome.artifacts.map((artifact) =>
        delegationArtifactToCandidateArtifact(artifact),
      ),
    );
    const confidence = Math.max(
      session.replyConfidence ?? 0,
      synthesis.confidence,
      0.78,
    );
    const classification =
      directFindings.length > 0 || resolvedConclusion
        ? 'answer'
        : synthesis.legacyClassification;
    const followUpActions = this.actionRepo
      .list({
        sourceKind: 'outreach_session',
        sourceRefId: session.id,
        limit: 20,
      })
      .items.map((item) => ({
        id: item.id,
        queueStatus: item.queueStatus,
      }));
    const summary =
      resolutionState === 'complete' || resolutionState === 'partial'
        ? await this.buildResolvedOutcomeSummary(
            session,
            replyText,
            classification === 'decline' ? 'decline' : 'answer',
            resolvedConclusion,
          )
        : synthesis.summary || outcome.summary;
    const mergedOutcome: Record<string, unknown> = {
      ...baseOutcome,
      classification,
      confidence,
      reply: replyText,
      resolutionState,
      directFindings,
      resolvedConclusion,
      remainingQuestions,
      candidateArtifacts,
      recommendedAction: baseOutcome.recommendedAction ?? action.actionType,
      spawnedActionIds: uniqStrings([
        ...readStringArray(baseOutcome.spawnedActionIds),
        action.id,
      ]),
      followUpActions,
      reason: firstNonEmptyString(
        synthesis.reason,
        String(baseOutcome.reason ?? ''),
      ),
      summary,
      externalSummary: outcome.summary,
      externalEvidence: outcome.artifacts.map((artifact) => ({
        kind: artifact.kind,
        title: artifact.title,
        content: artifact.content,
        metadata: artifact.metadata,
      })),
      externalPayload:
        outcome.payload &&
        typeof outcome.payload === 'object' &&
        !Array.isArray(outcome.payload)
          ? outcome.payload
          : undefined,
    };

    this.repo.updateSession(session.id, {
      status: 'resolved',
      replyClassification: classification,
      replyConfidence: confidence,
      outcome: mergedOutcome,
      nextCheckAt: null,
      errorCode: null,
      errorMessage: null,
      resolvedAt: now(),
    });
    this.repo.createEvent(session.id, 'resolved', mergedOutcome);
  }

  async syncDelegationFailureToSession(
    action: QueuedActionRecord,
    outcome: DelegationOutcome,
    result?: Record<string, unknown>,
  ): Promise<void> {
    if (action.sourceKind !== 'outreach_session' || !action.sourceRefId) {
      return;
    }
    const session = this.repo.getSessionById(action.sourceRefId);
    if (!session) return;

    const existingOutcome =
      session.outcome &&
      typeof session.outcome === 'object' &&
      !Array.isArray(session.outcome)
        ? session.outcome
        : {};
    const baseResolvedConclusion = firstNonEmptyString(
      stripDelegationFailureSuffix(existingOutcome.resolvedConclusion),
      stripDelegationFailureSuffix(existingOutcome.summary),
    );
    const recoveryActionIds = Array.isArray(result?.followUpActionIds)
      ? result?.followUpActionIds.filter(
          (value): value is string =>
            typeof value === 'string' && value.trim().length > 0,
        )
      : [];
    const remainingQuestions = uniqStrings([
      ...readStringArray(existingOutcome.remainingQuestions),
      typeof outcome.payload?.question === 'string'
        ? outcome.payload.question
        : undefined,
    ]);
    const followUpActions = this.actionRepo
      .list({
        sourceKind: 'outreach_session',
        sourceRefId: session.id,
        limit: 20,
      })
      .items.map((item) => ({
        id: item.id,
        queueStatus: item.queueStatus,
      }));
    const summary = baseResolvedConclusion
      ? `${baseResolvedConclusion}；但外部查证暂未成功：${outcome.summary}`
      : outcome.summary;
    const mergedOutcome: Record<string, unknown> = {
      ...existingOutcome,
      classification:
        existingOutcome.classification ??
        session.replyClassification ??
        'answer',
      confidence: Math.max(
        session.replyConfidence ?? 0,
        action.confidence,
        0.72,
      ),
      reply: session.replyRawText ?? existingOutcome.reply,
      resolutionState:
        existingOutcome.resolutionState === 'complete' ||
        existingOutcome.resolutionState === 'partial'
          ? existingOutcome.resolutionState
          : 'partial',
      directFindings: readStringArray(existingOutcome.directFindings),
      resolvedConclusion: summary,
      remainingQuestions,
      recommendedAction: existingOutcome.recommendedAction ?? action.actionType,
      spawnedActionIds: uniqStrings([
        ...readStringArray(existingOutcome.spawnedActionIds),
        action.id,
      ]),
      followUpActions,
      reason: outcome.summary,
      summary,
      delegationFailureStatus: outcome.status,
      delegationFailureSummary: outcome.summary,
      delegationRecoveryActionIds: recoveryActionIds,
      delegationRecoveryPrompt:
        outcome.payload &&
        typeof outcome.payload === 'object' &&
        !Array.isArray(outcome.payload)
          ? outcome.payload
          : undefined,
    };

    this.repo.updateSession(session.id, {
      status: 'resolved',
      replyClassification:
        typeof mergedOutcome.classification === 'string'
          ? mergedOutcome.classification
          : session.replyClassification,
      replyConfidence:
        typeof mergedOutcome.confidence === 'number'
          ? mergedOutcome.confidence
          : session.replyConfidence,
      outcome: mergedOutcome,
      nextCheckAt: null,
      resolvedAt: now(),
    });
    this.repo.createEvent(session.id, 'resolved', mergedOutcome);
  }

  updateSessionDraft(
    id: string,
    input: UpdateOutreachSessionDraftInput,
  ): OutreachSessionRecord | null {
    const session = this.repo.getSessionById(id);
    if (!session) return null;
    if (
      session.status !== 'pending_approval' &&
      session.status !== 'scheduled'
    ) {
      throw new Error(
        'Only pending approval or scheduled outreach sessions can be edited.',
      );
    }

    const nextTargetType =
      normalizeString(input.targetType) ?? session.targetType;
    const nextTargetRef = normalizeString(input.targetRef) ?? session.targetRef;
    if (isSelfDirectedTarget(nextTargetType, nextTargetRef)) {
      throw new Error('Outreach sessions cannot target the current user.');
    }
    const targetChanged =
      nextTargetType !== session.targetType ||
      nextTargetRef !== session.targetRef;
    const explicitResolutionProvided =
      input.targetResolutionStatus !== undefined ||
      input.targetResolvedType !== undefined ||
      input.targetResolvedId !== undefined ||
      input.targetResolvedLabel !== undefined ||
      input.targetResolvedChatId !== undefined ||
      input.targetCandidates !== undefined;

    const updated = this.repo.updateSession(id, {
      targetType: nextTargetType,
      targetRef: nextTargetRef,
      targetResolutionStatus: explicitResolutionProvided
        ? (input.targetResolutionStatus ?? 'unresolved')
        : targetChanged
          ? 'unresolved'
          : session.targetResolutionStatus,
      targetResolvedType: explicitResolutionProvided
        ? (input.targetResolvedType ?? null)
        : targetChanged
          ? null
          : (session.targetResolvedType ?? null),
      targetResolvedId: explicitResolutionProvided
        ? (input.targetResolvedId ?? null)
        : targetChanged
          ? null
          : (session.targetResolvedId ?? null),
      targetResolvedLabel: explicitResolutionProvided
        ? (input.targetResolvedLabel ?? null)
        : targetChanged
          ? null
          : (session.targetResolvedLabel ?? null),
      targetResolvedChatId: explicitResolutionProvided
        ? (input.targetResolvedChatId ?? null)
        : targetChanged
          ? null
          : (session.targetResolvedChatId ?? null),
      targetCandidates: explicitResolutionProvided
        ? ((input.targetCandidates as unknown as
            | Array<Record<string, unknown>>
            | null
            | undefined) ?? null)
        : targetChanged
          ? null
          : ((session.targetCandidates as unknown as
              | Array<Record<string, unknown>>
              | null
              | undefined) ?? null),
      renderedQuestion:
        normalizeString(input.renderedQuestion) ?? session.renderedQuestion,
      renderedContext:
        input.renderedContext === undefined
          ? (session.renderedContext ?? null)
          : (normalizeString(input.renderedContext) ?? null),
      nextCheckAt:
        input.nextCheckAt === undefined
          ? (session.nextCheckAt ?? null)
          : input.nextCheckAt,
    });

    if (!updated) return null;
    this.repo.createEvent(id, 'edited', {
      targetType: updated.targetType,
      targetRef: updated.targetRef,
      renderedQuestion: updated.renderedQuestion,
      renderedContext: updated.renderedContext ?? null,
      nextCheckAt: updated.nextCheckAt ?? null,
    });
    return updated;
  }

  async approveSession(id: string): Promise<OutreachSessionRecord | null> {
    const session = this.repo.getSessionById(id);
    if (!session) return null;
    if (session.status !== 'pending_approval') return session;
    if (!isResolvedTargetStatus(session.targetResolutionStatus)) {
      throw new Error(
        'Target is not confirmed yet. Please resolve the RingCentral user/group before approving.',
      );
    }
    const currentTime = now();
    const nextCheckAt =
      session.nextCheckAt && session.nextCheckAt > currentTime
        ? session.nextCheckAt
        : currentTime;
    const updated = this.repo.updateSession(id, {
      status: 'scheduled',
      requiresApproval: false,
      nextCheckAt,
      errorCode: null,
      errorMessage: null,
    });
    if (!updated) return null;
    this.repo.createEvent(id, 'approved');
    if ((updated.nextCheckAt ?? currentTime) <= currentTime) {
      await this.dispatchSession(updated);
    }
    return this.repo.getSessionById(id);
  }

  cancelSession(id: string, reason?: string): OutreachSessionRecord | null {
    const session = this.repo.getSessionById(id);
    if (!session) return null;
    const updated = this.repo.updateSession(id, {
      status: 'cancelled',
      nextCheckAt: null,
      resolvedAt: now(),
      errorCode: reason ? 'cancelled_by_user' : null,
      errorMessage: reason ?? null,
    });
    this.repo.createEvent(
      id,
      'cancelled',
      reason ? { reason } : undefined,
      reason,
    );
    return updated;
  }

  retrySession(id: string): OutreachSessionRecord | null {
    const session = this.repo.getSessionById(id);
    if (!session) return null;
    if (!TERMINAL_STATUSES.has(session.status)) return session;
    const updated = this.repo.updateSession(id, {
      status: session.requiresApproval ? 'pending_approval' : 'scheduled',
      followupCount: 0,
      waitUntil: null,
      nextCheckAt: now(),
      replyPostId: null,
      replySender: null,
      replyRawText: null,
      replyClassification: null,
      replyConfidence: null,
      errorCode: null,
      errorMessage: null,
      terminalSyncedAt: null,
      actionResultId: null,
      resolvedAt: null,
    });
    if (!updated) return null;
    this.repo.createEvent(id, 'created', { retried: true });
    return updated;
  }

  async createSessionFromAction(
    input: CreateSessionFromActionInput,
  ): Promise<OutreachSessionRecord> {
    const existing = this.repo.getSessionByActionId(input.action.id);
    if (existing) return existing;

    const action = input.action;
    const params = action.params ?? {};
    const targetObject =
      params.target &&
      typeof params.target === 'object' &&
      !Array.isArray(params.target)
        ? (params.target as Record<string, unknown>)
        : {};
    const targetType =
      normalizeString(params.targetType) ??
      normalizeString(params.target_type) ??
      normalizeString(targetObject.type) ??
      'group';
    const targetRef =
      normalizeString(params.targetRef) ??
      normalizeString(params.target_ref) ??
      normalizeString(params.targetId) ??
      normalizeString(params.chatId) ??
      normalizeString(targetObject.id);
    if (!targetRef) {
      throw new Error('ask_external_user action missing targetRef/chatId');
    }
    if (isSelfDirectedTarget(targetType, targetRef)) {
      throw new Error(
        'Self-directed ask_external_user should not create outreach sessions.',
      );
    }

    const question =
      normalizeString(params.question) ??
      normalizeString(params.prompt) ??
      action.description ??
      action.title;
    const context = normalizeString(params.context);
    const runtime = this.getRuntimeConfig();
    const originKind: OutreachOriginKind =
      action.threadId || action.runId || action.sourceKind === 'reflection_run'
        ? 'reflection_action'
        : 'manual_action';

    const requiresApproval =
      action.requiresApproval ||
      (originKind === 'reflection_action'
        ? runtime.outreachRequireApprovalForReflection
        : runtime.outreachRequireApprovalForManual);

    const created = this.repo.createSession({
      originKind,
      actionId: action.id,
      threadId: action.threadId,
      runId: action.runId,
      targetType,
      targetRef,
      renderedQuestion: question,
      renderedContext: context,
      status: requiresApproval ? 'pending_approval' : 'scheduled',
      requiresApproval,
      maxFollowup: Number(params.maxFollowup ?? params.max_followup ?? 1),
      followupIntervalSeconds: Number(
        params.followupIntervalSeconds ??
          params.followup_interval_seconds ??
          86400,
      ),
      nextCheckAt: requiresApproval ? null : now(),
    });
    const resolved = await this.resolveSessionTarget(created);
    this.repo.createEvent(resolved.id, 'created', {
      actionId: action.id,
      originKind,
      requiresApproval: resolved.requiresApproval,
      targetResolutionStatus: resolved.targetResolutionStatus,
      targetResolvedLabel: resolved.targetResolvedLabel ?? null,
      targetCandidates: resolved.targetCandidates?.length ?? 0,
    });

    if (!resolved.requiresApproval && resolved.status !== 'pending_approval') {
      await this.dispatchSession(resolved);
    }

    return this.repo.getSessionById(created.id)!;
  }

  private findMessageReactionSessionByOriginalPost(
    chatId: string,
    postId: string,
  ): OutreachSessionRecord | null {
    const sessions = this.repo.listSessions({
      originKind: 'message_reaction',
      limit: 100,
    }).items;

    for (const session of sessions) {
      if (
        normalizeString(session.outcome?.originalChatId) === chatId &&
        normalizeString(session.outcome?.originalPostId) === postId
      ) {
        return session;
      }
      const event = this.repo
        .listEventsBySession(session.id, 50)
        .find(
          (item) =>
            item.eventType === 'manual_initial_ask_registered' &&
            normalizeString(item.payload?.chatId) === chatId &&
            normalizeString(item.payload?.postId) === postId,
        );
      if (event) {
        return session;
      }
    }

    return null;
  }

  private async dispatchDueTemplates(): Promise<void> {
    const currentTime = now();
    const templates = this.repo.listDueTemplates(currentTime, 100);
    if (templates.length === 0) return;

    const runtime = this.getRuntimeConfig();
    for (const template of templates) {
      const requiresApproval = runtime.outreachRequireApprovalForManual;
      const session = this.repo.createSession({
        templateId: template.id,
        originKind: 'scheduled_template',
        targetType: template.targetType,
        targetRef: template.targetRef,
        renderedQuestion: template.questionTemplate,
        renderedContext: template.contextTemplate,
        status: requiresApproval ? 'pending_approval' : 'scheduled',
        requiresApproval,
        maxFollowup: template.maxFollowup,
        followupIntervalSeconds: template.followupIntervalSeconds,
        nextCheckAt: requiresApproval ? null : currentTime,
      });
      const resolved = await this.resolveSessionTarget(session);
      this.repo.createEvent(resolved.id, 'created', {
        templateId: template.id,
        originKind: 'scheduled_template',
        requiresApproval: resolved.requiresApproval,
        targetResolutionStatus: resolved.targetResolutionStatus,
        targetResolvedLabel: resolved.targetResolvedLabel ?? null,
        targetCandidates: resolved.targetCandidates?.length ?? 0,
      });

      const nextDispatch = parseNextDispatch(
        template.scheduleSpec,
        currentTime,
      );
      this.repo.markTemplateDispatch(template.id, nextDispatch, session.id);

      if (
        !resolved.requiresApproval &&
        resolved.status !== 'pending_approval'
      ) {
        await this.dispatchSession(resolved);
      }
    }
  }

  private async dispatchSession(session: OutreachSessionRecord): Promise<void> {
    if (session.status === 'pending_approval' || session.status === 'cancelled')
      return;
    const currentTime = now();
    if (!isResolvedTargetStatus(session.targetResolutionStatus)) {
      this.repo.updateSession(session.id, {
        status: 'pending_approval',
        requiresApproval: true,
        nextCheckAt: null,
      });
      this.repo.createEvent(session.id, 'edited', {
        reason: 'target_not_resolved',
      });
      return;
    }

    if (!this.ringClient.isConfigured()) {
      this.repo.updateSession(session.id, {
        status: 'failed',
        nextCheckAt: null,
        errorCode: 'missing_config',
        errorMessage: 'RingCentral not configured',
        resolvedAt: currentTime,
      });
      this.repo.createEvent(session.id, 'failed', {
        errorCode: 'missing_config',
      });
      return;
    }

    try {
      let preDispatchHit = await this.runAnswerResolutionPrecheck(
        session,
        'before_dispatch',
      );
      if (!preDispatchHit) {
        preDispatchHit = await this.runAnswerResolutionPrecheck(
          session,
          'before_dispatch',
          { trigger: 'dispatch_retry' },
        );
      }
      if (preDispatchHit) {
        await this.finalizeAnswerResolutionPrecheck(session, preDispatchHit);
        return;
      }

      const text = session.renderedQuestion;
      const sent = await this.ringClient.sendMessage({
        targetType: session.targetType,
        targetRef: session.targetRef,
        targetResolvedType: session.targetResolvedType,
        targetResolvedId: session.targetResolvedId,
        targetResolvedChatId: session.targetResolvedChatId,
        text,
      });
      const waitUntil = currentTime + session.followupIntervalSeconds;
      this.repo.updateSession(session.id, {
        status: 'waiting_reply',
        targetResolvedChatId: sent.chatId,
        sentChatId: sent.chatId,
        sentPostId: sent.postId,
        waitUntil,
        nextCheckAt: currentTime + 60,
        errorCode: null,
        errorMessage: null,
      });
      this.repo.createEvent(session.id, 'dispatched', {
        chatId: sent.chatId,
        postId: sent.postId,
        targetResolvedLabel: session.targetResolvedLabel ?? null,
      });
      this.insertOutreachMessage('outreach_question', session, text, {
        chatId: sent.chatId,
        postId: sent.postId,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.repo.updateSession(session.id, {
        status: 'failed',
        nextCheckAt: null,
        errorCode: 'dispatch_failed',
        errorMessage: message,
        resolvedAt: currentTime,
      });
      this.repo.createEvent(
        session.id,
        'failed',
        {
          errorCode: 'dispatch_failed',
          message,
        },
        message,
      );
    }
  }

  private async advancePendingSessions(): Promise<void> {
    const currentTime = now();
    const sessions = this.repo.listPendingSessions(currentTime, 200);
    for (const session of sessions) {
      if (session.status === 'scheduled') {
        await this.dispatchSession(session);
        continue;
      }
      if (session.status !== 'waiting_reply' && session.status !== 'deferred') {
        continue;
      }
      await this.handleWaitingSession(session);
    }
  }

  private async handleWaitingSession(
    session: OutreachSessionRecord,
  ): Promise<void> {
    const currentTime = now();
    if (!session.sentChatId) {
      this.repo.updateSession(session.id, {
        status: 'failed',
        errorCode: 'missing_chat_id',
        errorMessage: 'No chat id recorded for outreach session.',
        nextCheckAt: null,
        resolvedAt: currentTime,
      });
      this.repo.createEvent(session.id, 'failed', {
        errorCode: 'missing_chat_id',
      });
      return;
    }

    try {
      const posts = await this.ringClient.listPosts(
        session.sentChatId,
        session.lastPollAt ?? session.createdAt,
      );
      const selfActor = await this.ringClient
        .getCurrentActorIdentity()
        .catch(() => null);
      this.repo.updateSession(session.id, { lastPollAt: currentTime });

      const processedReplyPostIds = this.listProcessedReplyPostIds(
        session.id,
        session.replyPostId,
      );
      const replyBaselineAt =
        session.lastPollAt ??
        this.getLatestOutboundEventAt(session) ??
        session.createdAt;
      const replyBatch = aggregateReplyBatch(
        posts.filter((post) => {
          const createdAt = parsePostCreatedAtSeconds(post);
          return (
            createdAt == null ||
            !Number.isFinite(replyBaselineAt) ||
            createdAt >= replyBaselineAt
          );
        }),
        session,
        processedReplyPostIds,
        selfActor,
      );
      if (replyBatch) {
        const resolution = await this.resolveReplyBatch(session, replyBatch);
        this.repo.updateSession(session.id, {
          replyPostId: replyBatch.latestPostId,
          replySender: replyBatch.replySender,
          replyRawText: replyBatch.replyText,
          replyClassification: resolution.legacyClassification,
          replyConfidence: resolution.confidence,
        });
        this.repo.createEvent(session.id, 'reply_received', {
          replyPostId: replyBatch.latestPostId,
          replyPostIds: replyBatch.replyPostIds,
          replySender: replyBatch.replySender,
          replyText: replyBatch.replyText,
          classification: resolution.legacyClassification,
          confidence: resolution.confidence,
          resolutionState: resolution.resolutionState,
          recommendedAction: resolution.recommendedAction,
        });
        this.insertOutreachMessage(
          'outreach_reply',
          session,
          replyBatch.replyText,
          {
            postId: replyBatch.latestPostId,
            postIds: replyBatch.replyPostIds,
            sender: replyBatch.replySender,
          },
        );

        const followUpActions = await this.queueResolutionFollowUpActions(
          session,
          resolution,
          replyBatch,
        );
        const baseOutcome = this.buildResolutionOutcome(
          session,
          replyBatch,
          resolution,
          followUpActions,
        );

        if (
          resolution.resolutionState === 'complete' ||
          resolution.resolutionState === 'partial' ||
          resolution.legacyClassification === 'decline' ||
          followUpActions.length > 0
        ) {
          const summary =
            resolution.resolutionState === 'insufficient'
              ? (baseOutcome.summary as string)
              : await this.buildResolvedOutcomeSummary(
                  session,
                  replyBatch.replyText,
                  resolution.legacyClassification === 'decline'
                    ? 'decline'
                    : 'answer',
                  resolution.resolvedConclusion,
                );
          await this.markTerminal(session.id, 'resolved', {
            ...baseOutcome,
            summary,
          });
          return;
        }

        if (resolution.resolutionState === 'deferred' && resolution.etaAt) {
          const summary = baseOutcome.summary as string;
          this.repo.updateSession(session.id, {
            status: 'deferred',
            waitUntil: resolution.etaAt,
            nextCheckAt: resolution.etaAt,
            outcome: {
              ...baseOutcome,
              summary,
            },
          });
          this.repo.createEvent(session.id, 'deferred_by_reply', {
            etaAt: resolution.etaAt,
            summary,
          });
          return;
        }
        if (
          (resolution.legacyClassification === 'irrelevant' ||
            resolution.legacyClassification === 'unclear') &&
          session.followupCount >= session.maxFollowup &&
          session.waitUntil &&
          currentTime >= session.waitUntil
        ) {
          const summary = baseOutcome.summary as string;
          await this.markTerminal(session.id, 'escalated', {
            reason: 'reply_not_actionable',
            classification: resolution.legacyClassification,
            reply: replyBatch.replyText,
            summary,
          });
          await this.createEscalationConfirmRequest(
            session,
            'reply_not_actionable',
          );
          return;
        }

        const summary = baseOutcome.summary as string;
      this.repo.updateSession(session.id, {
        nextCheckAt: currentTime + 300,
        outcome: {
          ...baseOutcome,
          summary,
        },
      });
      return;
    }

      if (
        session.followupCount === 0 &&
        !session.replyPostId &&
        (!session.waitUntil || currentTime < session.waitUntil)
      ) {
        const replayedPreDispatchHit = await this.runAnswerResolutionPrecheck(
          session,
          'before_dispatch',
          { trigger: 'waiting_guard' },
        );
        if (replayedPreDispatchHit) {
          await this.finalizeAnswerResolutionPrecheck(session, replayedPreDispatchHit);
          return;
        }
      }

      if (session.waitUntil && currentTime >= session.waitUntil) {
        if (session.followupCount < session.maxFollowup) {
          const beforeFollowupHit = await this.runAnswerResolutionPrecheck(
            session,
            'before_followup',
          );
          if (beforeFollowupHit) {
            await this.finalizeAnswerResolutionPrecheck(session, beforeFollowupHit);
            return;
          }
          await this.sendFollowup(session);
          return;
        }

        await this.markTerminal(session.id, 'no_reply', {
          reason: 'timeout_without_reply',
          followupCount: session.followupCount,
          summary: '已达到等待与追问上限，仍未收到有效回复。',
        });
        await this.createEscalationConfirmRequest(
          session,
          'timeout_without_reply',
        );
        return;
      }

      this.repo.updateSession(session.id, {
        nextCheckAt: currentTime + 60,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.repo.updateSession(session.id, {
        status: 'failed',
        errorCode: 'polling_failed',
        errorMessage: message,
        nextCheckAt: null,
        resolvedAt: currentTime,
      });
      this.repo.createEvent(session.id, 'failed', {
        errorCode: 'polling_failed',
        message,
      });
    }
  }

  private getAnswerResolutionBaselineAt(
    session: OutreachSessionRecord,
    phase: OutreachAnswerResolutionPhase,
    currentTime: number,
    scope: 'target_channel_history' | 'global_memory',
  ): number {
    const runtime = this.getRuntimeConfig();
    const fallbackWindowSeconds =
      phase === 'before_dispatch' && scope === 'target_channel_history'
        ? runtime.outreachBeforeDispatchTargetChannelLookbackSeconds
        : runtime.outreachBeforeDispatchGlobalMemoryLookbackSeconds;
    const fallbackStart = currentTime - fallbackWindowSeconds;
    if (phase === 'before_dispatch') {
      const templateCreatedAt = session.templateId
        ? this.repo.getTemplateById(session.templateId)?.createdAt
        : undefined;
      const baseline = templateCreatedAt ?? session.createdAt;
      return Number.isFinite(baseline) && baseline > 0
        ? Math.min(baseline, fallbackStart)
        : fallbackStart;
    }

    const baseline = this.getLatestOutboundEventAt(session) ?? session.createdAt;
    return Number.isFinite(baseline) && baseline > 0
      ? baseline
      : fallbackStart;
  }

  private getLatestOutboundEventAt(
    session: OutreachSessionRecord,
  ): number | null {
    const latestOutboundEvent = this.repo
      .listEventsBySession(session.id, 50)
      .filter(
        (event) =>
          event.eventType === 'dispatched' ||
          event.eventType === 'followup_sent',
      )
      .sort((a, b) => b.createdAt - a.createdAt)[0];
    return Number.isFinite(latestOutboundEvent?.createdAt)
      ? latestOutboundEvent!.createdAt
      : null;
  }

  private getAnswerResolutionChatIds(session: OutreachSessionRecord): string[] {
    return uniqStrings([
      session.sentChatId,
      session.targetResolvedChatId,
      session.targetType === 'group' ? session.targetRef : undefined,
    ]);
  }

  private async collectTargetChannelAnswerEvidence(
    session: OutreachSessionRecord,
    phase: OutreachAnswerResolutionPhase,
    currentTime: number,
  ): Promise<OutreachAnswerEvidenceItem[]> {
    const chatId = this.getAnswerResolutionChatIds(session)[0];
    if (!chatId) return [];

    const baselineAt = this.getAnswerResolutionBaselineAt(
      session,
      phase,
      currentTime,
      'target_channel_history',
    );
    const posts = await this.ringClient.listPosts(chatId, baselineAt);
    if (posts.length === 0) return [];

    const selfActor = await this.ringClient
      .getCurrentActorIdentity()
      .catch(() => null);
    const processedReplyPostIds =
      phase === 'before_followup'
        ? this.listProcessedReplyPostIds(session.id, session.replyPostId)
        : new Set<string>();

    const normalized = posts
      .map((post) => ({
        post,
        createdAt: parsePostCreatedAtSeconds(post),
      }))
      .filter(({ post }) => post.text.trim().length > 0)
      .filter(
        ({ post, createdAt }) =>
          (createdAt == null || createdAt >= baselineAt) &&
          (createdAt == null || createdAt <= currentTime) &&
          post.id !== session.sentPostId &&
          !processedReplyPostIds.has(post.id),
      )
      .sort((a, b) => (a.createdAt ?? 0) - (b.createdAt ?? 0));

    const recentConversationEvidence =
      phase === 'before_dispatch'
        ? this.buildRecentConversationAnswerEvidence(
            normalized,
            session,
            selfActor,
            currentTime,
          )
        : [];

    const directAnswerEvidence: OutreachAnswerEvidenceItem[] = normalized
      .filter(({ post }) => isLikelyReplyPost(post, session, selfActor))
      .slice(-8)
      .map(({ post, createdAt }) => ({
        sourceKind: 'target_channel_history',
        sourceId: post.id,
        title:
          firstNonEmptyString(
            post.creatorName,
            session.targetResolvedLabel,
            session.targetRef,
          ) ?? '目标会话历史',
        content: post.text.trim(),
        createdAt: createdAt ?? currentTime,
        metadata: mergeMentionLabelsIntoMetadata(
          {
            sourceSystem: 'outreach_answer_resolution',
            answerResolutionPhase: phase,
            hitSource: 'target_channel_history',
          },
          post.mentionLabels ?? {},
        ),
      }));

    const deduped = new Set<string>();
    return [...recentConversationEvidence, ...directAnswerEvidence].filter(
      (item) => {
        const key = `${item.sourceId ?? ''}|${item.content}`;
        if (deduped.has(key)) return false;
        deduped.add(key);
        return true;
      },
    );
  }

  private buildRecentConversationAnswerEvidence(
    posts: Array<{ post: RingCentralPost; createdAt: number | null }>,
    session: OutreachSessionRecord,
    selfActor: RingCentralActorIdentity | null,
    currentTime: number,
  ): OutreachAnswerEvidenceItem[] {
    const questionTerms = extractTextTerms(
      [session.renderedQuestion, session.renderedContext]
        .filter(Boolean)
        .join('\n'),
    );
    if (questionTerms.length === 0) return [];

    const recentPairs: OutreachAnswerEvidenceItem[] = [];

    for (const [index, current] of posts.entries()) {
      if (!isLikelyReplyPost(current.post, session, selfActor)) continue;
      const replyText = current.post.text.trim();
      if (!replyText) continue;

      let matchedPrompt:
        | { post: RingCentralPost; createdAt: number | null }
        | undefined;
      let bestScore = 0;
      for (let cursor = index - 1; cursor >= 0; cursor -= 1) {
        const candidate = posts[cursor];
        if (!isLikelyPromptPost(candidate.post, session, selfActor)) continue;
        const promptText = candidate.post.text.trim();
        if (!promptText) continue;
        if (
          current.createdAt != null &&
          candidate.createdAt != null &&
          current.createdAt - candidate.createdAt >
            OUTREACH_RECENT_QA_PAIR_WINDOW_SECONDS
        ) {
          break;
        }
        const score = computeTextOverlapScore(promptText, questionTerms);
        if (score < 2 || score < bestScore) continue;
        matchedPrompt = candidate;
        bestScore = score;
      }

      if (!matchedPrompt) continue;

      recentPairs.push({
        sourceKind: 'target_channel_history',
        sourceId: current.post.id,
        title:
          firstNonEmptyString(
            current.post.creatorName,
            session.targetResolvedLabel,
            session.targetRef,
          ) ?? '目标会话历史',
        content: `同一会话中你已经问过相近问题“${matchedPrompt.post.text.trim()}”，${firstNonEmptyString(
          current.post.creatorName,
          session.targetResolvedLabel,
          session.targetRef,
        )} 回复“${replyText}”。`,
        createdAt: current.createdAt ?? currentTime,
        metadata: mergeMentionLabelsIntoMetadata(
          {
            sourceSystem: 'outreach_answer_resolution',
            answerResolutionPhase: 'before_dispatch',
            hitSource: 'target_channel_history',
            conversationMatched: true,
            promptPostId: matchedPrompt.post.id,
            replyText,
          },
          mergePostMentionLabels(matchedPrompt.post, current.post),
        ),
      });
    }

    return recentPairs.slice(-4).reverse();
  }

  private async collectGlobalMemoryAnswerEvidence(
    session: OutreachSessionRecord,
    phase: OutreachAnswerResolutionPhase,
    currentTime: number,
  ): Promise<OutreachAnswerEvidenceItem[]> {
    const baselineAt = this.getAnswerResolutionBaselineAt(
      session,
      phase,
      currentTime,
      'global_memory',
    );
    const query = uniqStrings([
      session.renderedQuestion,
      session.renderedContext,
      session.targetResolvedLabel,
      session.targetRef,
    ]).join('\n');
    if (!query) return [];

    const senderFilter =
      session.targetType === 'private'
        ? uniqStrings([session.targetResolvedLabel, session.targetRef])
        : undefined;
    const targetChatIds = new Set(
      this.getAnswerResolutionChatIds(session).map((item) =>
        item.toLowerCase(),
      ),
    );

    const recall = await this.recallEngine.recall({
      query,
      topK: 12,
      channels: ['fts', 'time'],
      timeRange: {
        start: baselineAt,
        end: currentTime,
      },
      senderFilter,
      sourceTypes: ['glip'],
      includeMetadata: true,
    });

    return recall.items
      .filter((item) => item.type === 'message')
      .filter((item) => item.content.trim().length > 0)
      .filter((item) => {
        const metadata =
          item.metadata &&
          typeof item.metadata === 'object' &&
          !Array.isArray(item.metadata)
            ? (item.metadata as Record<string, unknown>)
            : undefined;
        const groupId = firstNonEmptyString(
          normalizeString(metadata?.groupId),
          normalizeString(metadata?.teamId),
          normalizeString(metadata?.group_id),
        );
        return !groupId || !targetChatIds.has(groupId.toLowerCase());
      })
      .slice(0, 8)
      .map((item) => {
        const metadata =
          item.metadata &&
          typeof item.metadata === 'object' &&
          !Array.isArray(item.metadata)
            ? (item.metadata as Record<string, unknown>)
            : undefined;
        const sender = firstNonEmptyString(
          normalizeString(metadata?.sender),
          normalizeString(metadata?.sourceAuthor),
          session.targetResolvedLabel,
          session.targetRef,
        );
        const groupName = firstNonEmptyString(
          normalizeString(metadata?.groupName),
          normalizeString(metadata?.group_name),
        );
        const title = [sender, groupName].filter(Boolean).join(' @ ');

        return {
          sourceKind: 'global_memory' as const,
          sourceId: item.id,
          title: title || '全局记忆',
          content: item.content.trim(),
          createdAt: item.timestamp,
          metadata: {
            sourceSystem: 'outreach_answer_resolution',
            answerResolutionPhase: phase,
            hitSource: 'global_memory',
          },
        };
      });
  }

  private shouldResolveFromAnswerResolution(
    phase: Exclude<OutreachAnswerResolutionPhase, 'direct_reply'>,
    resolution: EvidenceResolutionPlan,
    evidence: OutreachAnswerEvidenceItem[],
  ): boolean {
    const hasRecentConversationMatch =
      phase === 'before_dispatch' &&
      evidence.some(
        (item) =>
          item.metadata &&
          typeof item.metadata === 'object' &&
          item.metadata.conversationMatched === true,
      );
    if (hasRecentConversationMatch) {
      return true;
    }
    return (
      resolution.resolutionState === 'complete' ||
      resolution.resolutionState === 'partial' ||
      resolution.legacyClassification === 'decline'
    );
  }

  private buildAnswerResolutionOutcome(params: {
    session: OutreachSessionRecord;
    resolution: EvidenceResolutionPlan;
    phase: OutreachAnswerResolutionPhase;
    hitSource: OutreachAnswerHitSource;
    summary: string;
    relatedMessage?: string;
    relatedMessageId?: string;
    replyText?: string;
    actions?: Array<{ id: string; queueStatus: string }>;
    externalEvidence?: Array<{
      kind: string;
      title?: string;
      content: string;
      metadata?: Record<string, unknown>;
    }>;
  }): Record<string, unknown> {
    const actions = params.actions ?? [];
    return {
      classification: params.resolution.legacyClassification,
      confidence: params.resolution.confidence,
      reply: params.replyText ?? params.relatedMessage ?? '',
      resolutionState: params.resolution.resolutionState,
      directFindings: params.resolution.directFindings,
      resolvedConclusion: params.resolution.resolvedConclusion,
      remainingQuestions: params.resolution.remainingQuestions,
      candidateArtifacts: params.resolution.candidateArtifacts,
      recommendedAction: params.resolution.recommendedAction,
      spawnedActionIds: actions.map((action) => action.id),
      followUpActions: actions.map((action) => ({
        id: action.id,
        queueStatus: action.queueStatus,
      })),
      etaAt: params.resolution.etaAt,
      reason: params.resolution.reason,
      summary: params.summary,
      answerResolutionPhase: params.phase,
      hitSource: params.hitSource,
      evidenceSummary: params.summary,
      relatedMessage: params.relatedMessage,
      relatedMessageId: params.relatedMessageId,
      externalEvidence: params.externalEvidence ?? [],
    };
  }

  private async runAnswerResolutionPrecheck(
    session: OutreachSessionRecord,
    phase: Exclude<OutreachAnswerResolutionPhase, 'direct_reply'>,
    options?: {
      trigger?: 'dispatch' | 'dispatch_retry' | 'waiting_guard' | 'followup';
    },
  ): Promise<OutreachAnswerResolutionHit | null> {
    const currentTime = now();
    const baselineAt = this.getAnswerResolutionBaselineAt(
      session,
      phase,
      currentTime,
      'target_channel_history',
    );
    this.repo.createEvent(session.id, 'answer_precheck_started', {
      phase,
      baselineAt,
      trigger:
        options?.trigger ??
        (phase === 'before_followup' ? 'followup' : 'dispatch'),
    });

    const evidence: OutreachAnswerEvidenceItem[] = [];
    try {
      evidence.push(
        ...(await this.collectTargetChannelAnswerEvidence(
          session,
          phase,
          currentTime,
        )),
      );
    } catch (error) {
      console.warn('outreach target channel precheck failed:', error);
    }

    try {
      evidence.push(
        ...(await this.collectGlobalMemoryAnswerEvidence(
          session,
          phase,
          currentTime,
        )),
      );
    } catch (error) {
      console.warn('outreach global memory precheck failed:', error);
    }

    if (evidence.length === 0) {
      return null;
    }

    const resolution = await this.evidencePlanner.resolve({
      question: session.renderedQuestion,
      context: session.renderedContext,
      evidence,
      policy: {
        scene: 'outreach',
        userIntentMode: 'informational',
        externalRead: 'disabled',
        externalWrite: 'disabled',
        allowAskExternalUser: false,
        allowCreateConfirmRequest: false,
      },
    });

    if (!this.shouldResolveFromAnswerResolution(phase, resolution, evidence)) {
      return null;
    }

    const primaryEvidence = evidence[0];
    const summary = await this.buildResolvedOutcomeSummary(
      session,
      normalizeString(primaryEvidence.metadata?.replyText) ??
        primaryEvidence.content,
      resolution.legacyClassification === 'decline' ? 'decline' : 'answer',
      resolution.resolvedConclusion,
    );

    return {
      phase,
      hitSource: primaryEvidence.sourceKind,
      relatedMessage:
        normalizeString(primaryEvidence.metadata?.replyText) ??
        primaryEvidence.content,
      relatedMessageId: primaryEvidence.sourceId,
      evidence,
      resolution,
      summary,
    };
  }

  private async finalizeAnswerResolutionPrecheck(
    session: OutreachSessionRecord,
    hit: OutreachAnswerResolutionHit,
  ): Promise<void> {
    const alreadyDispatched = Boolean(session.sentPostId || session.sentChatId);
    if (
      hit.evidence.some((item) => item.sourceKind === 'target_channel_history')
    ) {
      this.repo.createEvent(session.id, 'answer_hit_target_channel', {
        phase: hit.phase,
        relatedMessageId: hit.relatedMessageId ?? null,
      });
    }
    if (hit.evidence.some((item) => item.sourceKind === 'global_memory')) {
      this.repo.createEvent(session.id, 'answer_hit_global_memory', {
        phase: hit.phase,
        relatedMessageId: hit.relatedMessageId ?? null,
      });
    }

    const outcome = this.buildAnswerResolutionOutcome({
      session,
      resolution: hit.resolution,
      phase: hit.phase,
      hitSource: hit.hitSource,
      summary: hit.summary,
      relatedMessage: hit.relatedMessage,
      relatedMessageId: hit.relatedMessageId,
      externalEvidence: hit.evidence.map((item) => ({
        kind: item.sourceKind,
        title: item.title,
        content: item.content,
        metadata: item.metadata,
      })),
    });

    if (hit.phase === 'before_dispatch' && !alreadyDispatched) {
      this.repo.createEvent(session.id, 'resolved_without_dispatch', {
        phase: hit.phase,
        hitSource: hit.hitSource,
        relatedMessageId: hit.relatedMessageId ?? null,
      });
    } else {
      this.repo.createEvent(session.id, 'followup_skipped_by_answer', {
        phase: hit.phase,
        hitSource: hit.hitSource,
        relatedMessageId: hit.relatedMessageId ?? null,
        recoveredAfterDispatch:
          hit.phase === 'before_dispatch' && alreadyDispatched,
      });
    }

    await this.markTerminal(session.id, 'resolved', outcome);
  }

  private async resolveReplyBatch(
    session: OutreachSessionRecord,
    replyBatch: AggregatedReplyBatch,
  ): Promise<EvidenceResolutionPlan> {
    const policy: EvidenceResolutionPolicy = {
      scene: 'outreach',
      userIntentMode: 'informational',
      externalRead: 'auto',
      externalWrite: 'disabled',
      allowAskExternalUser: false,
      allowCreateConfirmRequest: true,
    };
    const resolved = await this.evidencePlanner.resolve({
      question: session.renderedQuestion,
      context: session.renderedContext,
      evidence: [
        {
          sourceKind: 'outreach_reply',
          sourceId: replyBatch.latestPostId,
          title:
            replyBatch.replySender ??
            session.targetResolvedLabel ??
            session.targetRef,
          content: replyBatch.replyText,
          metadata: {
            replyPostIds: replyBatch.replyPostIds,
            sender: replyBatch.replySender,
          },
        },
      ],
      policy,
    });

    if (
      resolved.resolutionState === 'deferred' &&
      resolved.directFindings.length === 0 &&
      resolved.candidateArtifacts.length === 0
    ) {
      return resolved;
    }
    if (
      resolved.legacyClassification === 'defer' &&
      resolved.directFindings.length > 0
    ) {
      return {
        ...resolved,
        legacyClassification: 'answer',
      };
    }
    return resolved;
  }

  private buildDelegationSynthesisEvidence(
    session: OutreachSessionRecord,
    action: QueuedActionRecord,
    outcome: DelegationOutcome,
  ): Array<{
    sourceKind: string;
    sourceId?: string;
    title?: string;
    content: string;
    metadata?: Record<string, unknown>;
  }> {
    const evidence: Array<{
      sourceKind: string;
      sourceId?: string;
      title?: string;
      content: string;
      metadata?: Record<string, unknown>;
    }> = [];

    if (session.replyRawText?.trim()) {
      evidence.push({
        sourceKind: 'outreach_reply',
        sourceId: session.replyPostId ?? undefined,
        title:
          session.replySender ??
          session.targetResolvedLabel ??
          session.targetRef,
        content: session.replyRawText.trim(),
        metadata: {
          sessionId: session.id,
        },
      });
    }

    const payloadSnippet = stringifyStructuredValue(outcome.payload);
    evidence.push({
      sourceKind: 'delegate_openclaw',
      sourceId: action.id,
      title: action.title,
      content: [outcome.summary, payloadSnippet].filter(Boolean).join('\n'),
      metadata: {
        actionId: action.id,
        targetSystem:
          typeof action.params?.targetSystem === 'string'
            ? action.params.targetSystem
            : undefined,
      },
    });

    for (const [index, artifact] of outcome.artifacts.entries()) {
      const metadataSnippet = stringifyStructuredValue(artifact.metadata, 600);
      const content = [artifact.title, artifact.content, metadataSnippet]
        .filter(
          (value): value is string =>
            typeof value === 'string' && value.trim().length > 0,
        )
        .join('\n');
      if (!content) continue;
      evidence.push({
        sourceKind: 'delegate_openclaw_artifact',
        sourceId: `${action.id}:${index}`,
        title: artifact.title,
        content,
        metadata:
          artifact.metadata &&
          typeof artifact.metadata === 'object' &&
          !Array.isArray(artifact.metadata)
            ? { ...artifact.metadata }
            : undefined,
      });
    }

    return evidence;
  }

  private async buildSessionEvidence(
    session: OutreachSessionRecord,
  ): Promise<OutreachSessionEvidenceItem[]> {
    const evidence: OutreachSessionEvidenceItem[] = [];

    if (session.replyRawText?.trim()) {
      evidence.push({
        sourceKind: 'outreach_reply',
        sourceId: session.replyPostId,
        title:
          session.replySender ??
          session.targetResolvedLabel ??
          session.targetRef,
        content: session.replyRawText.trim(),
        createdAt: session.updatedAt,
        metadata: {
          replyClassification: session.replyClassification,
          replyConfidence: session.replyConfidence,
        },
      });
    }

    const outcome =
      session.outcome &&
      typeof session.outcome === 'object' &&
      !Array.isArray(session.outcome)
        ? session.outcome
        : undefined;

    const externalEvidence = Array.isArray(outcome?.externalEvidence)
      ? outcome.externalEvidence
      : [];
    for (const [index, item] of externalEvidence.entries()) {
      if (!item || typeof item !== 'object' || Array.isArray(item)) {
        continue;
      }
      const content = [
        typeof item.content === 'string' ? item.content.trim() : '',
        typeof item.url === 'string' ? item.url.trim() : '',
      ]
        .filter(Boolean)
        .join('\n');
      if (!content) {
        continue;
      }

      evidence.push({
        sourceKind:
          typeof item.kind === 'string' ? item.kind : 'external_evidence',
        sourceId: `external:${session.id}:${index}`,
        title: typeof item.title === 'string' ? item.title : undefined,
        content,
        createdAt: session.updatedAt,
        metadata: sanitizeEvidenceMetadata(item.metadata),
      });
    }

    const candidateArtifacts = Array.isArray(outcome?.candidateArtifacts)
      ? outcome.candidateArtifacts
      : [];
    for (const [index, item] of candidateArtifacts.entries()) {
      if (!item || typeof item !== 'object' || Array.isArray(item)) {
        continue;
      }
      const content = [
        typeof item.content === 'string' ? item.content.trim() : '',
        typeof item.url === 'string' ? item.url.trim() : '',
      ]
        .filter(Boolean)
        .join('\n');
      if (!content) {
        continue;
      }

      evidence.push({
        sourceKind:
          typeof item.kind === 'string' ? item.kind : 'candidate_artifact',
        sourceId: `candidate:${session.id}:${index}`,
        title: typeof item.title === 'string' ? item.title : undefined,
        content,
        createdAt: session.updatedAt,
        metadata: sanitizeEvidenceMetadata(item.metadata),
      });
    }

    return this.attachMentionLabelsToEvidence(evidence, session);
  }

  private async attachMentionLabelsToEvidence(
    evidence: OutreachSessionEvidenceItem[],
    session: OutreachSessionRecord,
  ): Promise<OutreachSessionEvidenceItem[]> {
    const mentionIds = uniqStrings(
      evidence.flatMap((item) => extractPersonMentionIds(item.content)),
    );
    if (mentionIds.length === 0) {
      return evidence;
    }

    const chatId = this.getAnswerResolutionChatIds(session)[0];
    const allMentionLabels: Record<string, string> = await this.ringClient
      .resolvePersonMentionLabels(mentionIds, chatId)
      .catch(() => ({} as Record<string, string>));
    if (Object.keys(allMentionLabels).length === 0) {
      return evidence;
    }

    return evidence.map((item) => {
      const itemMentionLabels: Record<string, string> = {};
      for (const id of extractPersonMentionIds(item.content)) {
        const label = allMentionLabels[id];
        if (label) {
          itemMentionLabels[id] = label;
        }
      }
      return {
        ...item,
        metadata: mergeMentionLabelsIntoMetadata(
          item.metadata,
          itemMentionLabels,
        ),
      };
    });
  }

  private listProcessedReplyPostIds(
    sessionId: string,
    currentReplyPostId?: string,
  ): Set<string> {
    const seen = new Set<string>();
    if (currentReplyPostId) {
      seen.add(currentReplyPostId);
    }
    const events = this.repo.listEventsBySession(sessionId, 200);
    for (const event of events) {
      if (event.eventType !== 'reply_received' || !event.payload) continue;
      const replyPostId = normalizeString(event.payload.replyPostId);
      if (replyPostId) seen.add(replyPostId);
      const replyPostIds = Array.isArray(event.payload.replyPostIds)
        ? event.payload.replyPostIds.filter(
            (value): value is string =>
              typeof value === 'string' && value.trim().length > 0,
          )
        : [];
      for (const id of replyPostIds) {
        seen.add(id.trim());
      }
    }
    return seen;
  }

  private async queueResolutionFollowUpActions(
    session: OutreachSessionRecord,
    resolution: EvidenceResolutionPlan,
    replyBatch: AggregatedReplyBatch,
  ) {
    if (resolution.recommendedAction === 'none') return [];

    const baseParams =
      resolution.actionParams &&
      typeof resolution.actionParams === 'object' &&
      !Array.isArray(resolution.actionParams)
        ? { ...resolution.actionParams }
        : {};
    const params: Record<string, unknown> = {
      ...baseParams,
      metadata: {
        ...(baseParams.metadata &&
        typeof baseParams.metadata === 'object' &&
        !Array.isArray(baseParams.metadata)
          ? (baseParams.metadata as Record<string, unknown>)
          : {}),
        sessionId: session.id,
        replyPostId: replyBatch.latestPostId,
      },
    };
    if (
      resolution.recommendedAction === 'create_confirm_request' &&
      typeof params.sourceAnchor !== 'string'
    ) {
      params.sourceAnchor = `outreach:${session.id}`;
    }
    const requestedMode = params.mode === 'write' ? 'write' : 'read';
    const delegatePolicy =
      resolution.recommendedAction === 'delegate_openclaw'
        ? resolveDelegateOpenClawPolicy({
            params,
            defaultExecutionMode: requestedMode === 'write' ? 'manual' : 'auto',
            defaultRequiresApproval: requestedMode === 'write',
          })
        : null;
    const action = this.actionRepo.create({
      actionType: resolution.recommendedAction,
      title: this.buildResolutionActionTitle(session, resolution),
      description: resolution.summary,
      params,
      threadId: session.threadId,
      runId: session.runId,
      executionMode: delegatePolicy?.executionMode ?? 'auto',
      requiresApproval: delegatePolicy?.requiresApproval ?? false,
      queueStatus: 'queued',
      priority:
        resolution.recommendedAction === 'create_confirm_request' ? 8 : 7,
      sourceKind: 'outreach_session',
      sourceRefId: session.id,
      confidence: resolution.confidence,
      evidenceRefs: [
        `outreach_session:${session.id}`,
        `outreach_reply:${replyBatch.latestPostId}`,
      ],
    });
    return [action];
  }

  private buildResolutionActionTitle(
    session: OutreachSessionRecord,
    resolution: EvidenceResolutionPlan,
  ): string {
    if (resolution.recommendedAction === 'delegate_openclaw') {
      return `继续查证: ${session.renderedQuestion.slice(0, 48)}`;
    }
    if (resolution.recommendedAction === 'create_confirm_request') {
      return `需要确认下一步: ${session.renderedQuestion.slice(0, 48)}`;
    }
    if (resolution.recommendedAction === 'ask_external_user') {
      return `继续询问外部对象: ${session.renderedQuestion.slice(0, 48)}`;
    }
    return session.renderedQuestion.slice(0, 48);
  }

  private buildResolutionOutcome(
    session: OutreachSessionRecord,
    replyBatch: AggregatedReplyBatch,
    resolution: EvidenceResolutionPlan,
    actions: Array<{ id: string; queueStatus: string }>,
  ): Record<string, unknown> {
    const summary =
      resolution.summary ||
      buildFallbackOutcomeSummary(
        session,
        resolution.legacyClassification === 'decline' ? 'decline' : 'answer',
        replyBatch.replyText,
        resolution.etaAt,
      );
    return this.buildAnswerResolutionOutcome({
      session,
      resolution,
      phase: 'direct_reply',
      hitSource: 'direct_reply',
      summary,
      relatedMessage: replyBatch.replyText,
      relatedMessageId: replyBatch.latestPostId,
      replyText: replyBatch.replyText,
      actions,
    });
  }

  private async buildResolvedOutcomeSummary(
    session: OutreachSessionRecord,
    replyText: string,
    classification: ParsedReply['classification'],
    resolvedConclusion?: string,
  ): Promise<string> {
    const fallback =
      (typeof resolvedConclusion === 'string' &&
      resolvedConclusion.trim().length > 0
        ? resolvedConclusion.trim()
        : undefined) ??
      buildFallbackOutcomeSummary(session, classification, replyText);
    try {
      const llm = getLLMClient();
      const prompt = [
        '请用中文总结一次主动询问的结果，输出一句简短结果摘要。',
        '要求：',
        '- 只输出摘要正文，不要标题，不要项目符号。',
        '- 控制在 50 个汉字以内。',
        '- 如果对方已经明确给出答案，就直接概括答案。',
        '- 如果对方拒绝或暂时无法提供信息，直接说明结论。',
        '',
        `问题：${session.renderedQuestion}`,
        `上下文：${session.renderedContext ?? '无'}`,
        `回复：${replyText}`,
      ].join('\n');
      const response = await llm.generate(prompt, {
        temperature: 0.1,
        maxTokens: 80,
        systemPrompt: '你负责为主动询问结果生成简短、准确、可展示的摘要。',
      });
      const summary = response.content.trim().replace(/\s+/g, ' ');
      return summary || fallback;
    } catch {
      return fallback;
    }
  }

  private async resolveSessionTarget(
    session: OutreachSessionRecord,
  ): Promise<OutreachSessionRecord> {
    const resolution = await this.ringClient.resolveTarget({
      targetType: session.targetType,
      targetRef: session.targetRef,
      limit: 8,
    });
    const normalizedTargetType = session.targetType.trim().toLowerCase();
    const resolvedChatId =
      ['private', 'person'].includes(normalizedTargetType) &&
      resolution.status === 'resolved' &&
      resolution.resolved?.kind === 'user' &&
      !resolution.resolved.chatId &&
      resolution.resolved.entityId
        ? await this.ringClient.resolveDirectConversationChatId(
            resolution.resolved.entityId,
          )
        : (resolution.resolved?.chatId ?? null);
    const needsReview = resolution.status !== 'resolved';
    const updated = this.repo.updateSession(session.id, {
      targetResolutionStatus: resolution.status,
      targetResolvedType: resolution.resolved?.kind ?? null,
      targetResolvedId: resolution.resolved?.entityId ?? null,
      targetResolvedLabel: resolution.resolved?.label ?? null,
      targetResolvedChatId: resolvedChatId,
      targetCandidates: resolution.candidates as unknown as Array<
        Record<string, unknown>
      >,
      status: needsReview ? 'pending_approval' : session.status,
      requiresApproval: needsReview ? true : session.requiresApproval,
      nextCheckAt: needsReview ? null : (session.nextCheckAt ?? null),
    });
    return updated ?? session;
  }

  private async sendFollowup(session: OutreachSessionRecord): Promise<void> {
    const currentTime = now();
    if (!session.sentChatId) {
      this.repo.updateSession(session.id, {
        status: 'failed',
        errorCode: 'missing_chat_id',
        errorMessage: 'No chat id recorded for follow-up.',
        nextCheckAt: null,
        resolvedAt: currentTime,
      });
      return;
    }

    try {
      const followupText = `Follow-up: ${session.renderedQuestion}`;
      const sent = await this.ringClient.sendMessage({
        targetType: session.targetType,
        targetRef: session.sentChatId,
        text: followupText,
        replyToPostId: session.sentPostId,
      });
      this.repo.updateSession(session.id, {
        status: 'waiting_reply',
        sentChatId: sent.chatId,
        sentPostId: sent.postId,
        followupCount: session.followupCount + 1,
        waitUntil: currentTime + session.followupIntervalSeconds,
        nextCheckAt: currentTime + 60,
      });
      this.repo.createEvent(session.id, 'followup_sent', {
        followupCount: session.followupCount + 1,
        chatId: sent.chatId,
        postId: sent.postId,
      });
      this.insertOutreachMessage('outreach_question', session, followupText, {
        followup: true,
        postId: sent.postId,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.repo.updateSession(session.id, {
        status: 'failed',
        errorCode: 'followup_failed',
        errorMessage: message,
        nextCheckAt: null,
        resolvedAt: currentTime,
      });
      this.repo.createEvent(session.id, 'failed', {
        errorCode: 'followup_failed',
        message,
      });
    }
  }

  private async markTerminal(
    sessionId: string,
    status: Extract<
      OutreachSessionStatus,
      'resolved' | 'no_reply' | 'escalated'
    >,
    outcome: Record<string, unknown>,
  ): Promise<void> {
    const currentTime = now();
    this.repo.updateSession(sessionId, {
      status,
      outcome,
      nextCheckAt: null,
      resolvedAt: currentTime,
    });
    this.repo.createEvent(sessionId, status, outcome);
    if (status === 'resolved') {
      await this.notifyResolvedSessionIfNeeded(sessionId, outcome);
    }
  }

  private async notifyResolvedSessionIfNeeded(
    sessionId: string,
    outcome: Record<string, unknown>,
  ): Promise<void> {
    const runtime = this.getRuntimeConfig();
    const targetMode = runtime.outreachResultPushTarget;
    const session = this.repo.getSessionById(sessionId);
    if (!session) return;

    const existingEvents = this.repo.listEventsBySession(sessionId, 200);
    if (existingEvents.some((event) => event.eventType === 'result_notified')) {
      return;
    }

    const summary = extractOutcomeSummary(outcome);
    if (!summary) return;

    const targetGroupId = runtime.outreachResultPushGroupId.trim();
    if (targetMode === 'group' && !targetGroupId) {
      this.repo.createEvent(sessionId, 'result_notification_failed', {
        reason: 'missing_group_id',
      });
      return;
    }

    const targetLabel =
      session.targetResolvedLabel?.trim() || session.targetRef.trim();
    const bodyLines = [
      targetLabel ? `对象：${targetLabel}` : '',
      `问题：${session.renderedQuestion}`,
      `结果：${summary}`,
    ].filter(Boolean);

    const result = await this.notificationCenterService.deliverNoticeToGlip({
      sourceRef: `outreach:${sessionId}:result`,
      title: '主动询问结果',
      body: bodyLines.join('\n'),
      mention: false,
      targetUserId: targetMode === 'me' ? this.userId : undefined,
      targetGroupId: targetMode === 'group' ? targetGroupId : undefined,
    });

    if (result.sent) {
      this.repo.createEvent(sessionId, 'result_notified', {
        mode: targetMode,
        messageId: result.messageId ?? null,
      });
      return;
    }

    this.repo.createEvent(sessionId, 'result_notification_failed', {
      mode: targetMode,
      error: result.error ?? null,
    });
  }

  private async syncTerminalReflectionSessions(): Promise<void> {
    const sessions = this.repo.listTerminalUnsyncedReflectionSessions(200);
    if (sessions.length === 0) return;

    const runtime = this.getRuntimeConfig();
    for (const session of sessions) {
      if (!session.actionId || !session.threadId) {
        this.repo.updateSession(session.id, { terminalSyncedAt: now() });
        continue;
      }
      const result = this.actionResultRepo.create({
        actionId: session.actionId,
        threadId: session.threadId,
        runId: session.runId,
        resultType: session.status,
        summary:
          extractOutcomeSummary(session.outcome) ??
          buildSessionSummary(session.status, session.renderedQuestion),
        payload: {
          status: session.status,
          targetType: session.targetType,
          targetRef: session.targetRef,
          reply: session.replyRawText,
          replyClassification: session.replyClassification,
          followupCount: session.followupCount,
          ...(session.outcome ?? {}),
        },
      });
      this.threadService.recordActionResult(result);
      this.repo.updateSession(session.id, {
        terminalSyncedAt: now(),
        actionResultId: result.id,
      });
      const spawnedActionIds = Array.isArray(session.outcome?.spawnedActionIds)
        ? session.outcome?.spawnedActionIds.filter(
            (value): value is string =>
              typeof value === 'string' && value.trim().length > 0,
          )
        : [];
      if (runtime.reflectionEnabled && spawnedActionIds.length === 0) {
        try {
          await this.threadService.runReflection(session.threadId, {
            runType: 'action_result_followup',
            triggerType: 'action_result',
            force: false,
          });
        } catch {
          // Keep terminal sync idempotent even if follow-up reflection fails.
        }
      }
    }
  }

  private insertOutreachMessage(
    sourceType: 'outreach_question' | 'outreach_reply',
    session: OutreachSessionRecord,
    content: string,
    metadata: Record<string, unknown>,
    timestamp = now(),
  ): void {
    const id = randomUUID();
    this.db
      .prepare(
        `INSERT INTO messages_raw
          (id, content, source_type, sender, group_id, group_name, timestamp, metadata_json, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        id,
        content,
        sourceType,
        this.userId ?? 'outreach-engine',
        session.targetType === 'group' ? session.targetRef : null,
        session.targetType === 'group' ? 'outreach-group' : null,
        timestamp,
        JSON.stringify({
          sessionId: session.id,
          originKind: session.originKind,
          ...metadata,
        }),
        timestamp,
      );
  }

  private async hydrateReplySender(
    session: OutreachSessionRecord | null,
  ): Promise<OutreachSessionRecord | null> {
    if (
      !session ||
      session.replySender ||
      !session.replyPostId ||
      !session.sentChatId ||
      !this.ringClient.isConfigured()
    ) {
      return session;
    }

    try {
      const posts = await this.ringClient.listPosts(
        session.sentChatId,
        session.createdAt,
      );
      const reply = posts.find((item) => item.id === session.replyPostId);
      const replySender = reply?.creatorName ?? reply?.creatorId;
      if (!replySender) {
        return session;
      }
      return (
        this.repo.updateSession(session.id, { replySender }) ?? {
          ...session,
          replySender,
        }
      );
    } catch {
      return session;
    }
  }

  private async createEscalationConfirmRequest(
    session: OutreachSessionRecord,
    reason: string,
  ): Promise<void> {
    const question = `外部询问未得到可用结论：是否继续跟进「${session.renderedQuestion.slice(0, 80)}」？`;
    const context = `Session ${session.id} 状态为 ${session.status}，原因：${reason}`;
    const options = [
      { label: '继续跟进', value: 'continue' },
      { label: '先暂停', value: 'pause' },
      { label: '关闭该询问', value: 'close' },
    ];
    this.confirmRequestRepo.createOrReusePending({
      question,
      context,
      options,
      evidenceRefs: [`outreach_session:${session.id}`],
      category: 'outreach_followup',
      priority: 'high',
      createdAt: now(),
    });
  }
}
