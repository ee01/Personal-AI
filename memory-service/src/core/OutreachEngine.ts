import { randomUUID } from 'node:crypto';
import type Database from 'better-sqlite3';

import { RingCentralClient } from '../integrations/RingCentralClient.js';
import {
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
import { ReflectionThreadService } from './ReflectionThreadService.js';

interface ParsedReply {
  classification: 'answer' | 'defer' | 'irrelevant' | 'decline' | 'unclear';
  confidence: number;
  etaAt?: number;
  reason?: string;
}

interface CreateSessionFromActionInput {
  action: QueuedActionRecord;
}

interface OutreachSessionDetail {
  session: OutreachSessionRecord;
  events: ReturnType<OutreachRepository['listEventsBySession']>;
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

const TERMINAL_STATUSES = new Set<OutreachSessionStatus>([
  'resolved',
  'no_reply',
  'escalated',
  'cancelled',
  'failed',
]);

function buildSessionSummary(status: OutreachSessionStatus, question: string): string {
  if (status === 'resolved') return `Outreach resolved: ${question}`;
  if (status === 'no_reply') return `Outreach timed out with no reply: ${question}`;
  if (status === 'escalated') return `Outreach escalated for manual decision: ${question}`;
  if (status === 'failed') return `Outreach failed to dispatch: ${question}`;
  if (status === 'cancelled') return `Outreach cancelled: ${question}`;
  return `Outreach status ${status}: ${question}`;
}

function normalizeString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
}

function isSelfDirectedTarget(targetType: string, targetRef: string): boolean {
  const normalizedTargetType = targetType.trim().toLowerCase();
  const normalizedTargetRef = targetRef.trim().toLowerCase();
  if (normalizedTargetRef === 'user' || normalizedTargetRef === 'me' || normalizedTargetRef === 'self') {
    return normalizedTargetType === 'private' || normalizedTargetType === 'person';
  }
  return normalizedTargetType === 'person' && normalizedTargetRef === 'current-user';
}

function isResolvedTargetStatus(status: string | undefined): boolean {
  return status === 'resolved';
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

  if (scheduleDate) {
    const seed = new Date(`${scheduleDate}T${scheduleTime.length === 5 ? `${scheduleTime}:00` : scheduleTime}`);
    if (!Number.isNaN(seed.getTime())) {
      const candidate = new Date(seed.getTime());
      if (Number.isFinite(repeatEvery) && repeatEvery > 0 && repeatUnit) {
        while (Math.floor(candidate.getTime() / 1000) <= baseline) {
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
        const nextAt = Math.floor(candidate.getTime() / 1000);
        return nextAt > baseline ? nextAt : null;
      }

      const oneShotAt = Math.floor(seed.getTime() / 1000);
      return oneShotAt > baseline ? oneShotAt : null;
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

function parseEtaFromText(text: string, currentTime: number): number | undefined {
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
    return { classification: 'unclear', confidence: 0.2, reason: 'empty_reply' };
  }
  if (/not now|later|稍后|晚点|以后|下周|tomorrow|明天|\d+\s*(day|days|天|hour|hours|小时)/.test(lower)) {
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
  private readonly actionResultRepo: ActionResultRepository;
  private readonly confirmRequestRepo: ConfirmRequestRepository;
  private readonly threadService: ReflectionThreadService;
  private readonly ringClient: RingCentralClient;

  constructor(
    private readonly db: Database.Database,
    private readonly userDataManager?: UserDataManager,
    private readonly userId?: string,
  ) {
    this.repo = new OutreachRepository(db);
    this.actionResultRepo = new ActionResultRepository(db);
    this.confirmRequestRepo = new ConfirmRequestRepository(db);
    this.threadService = new ReflectionThreadService(db, userDataManager, userId);
    this.ringClient = new RingCentralClient(userDataManager, db, userId);
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
    const templates = ids && ids.length > 0
      ? this.repo.listTemplateRuntimeStatus(ids)
      : this.repo.listTemplates(limit);
    return templates.map((template) => {
      const latestSession = template.lastSessionId
        ? this.repo.getSessionById(template.lastSessionId)
        : this.repo
            .listSessions({ templateId: template.id, limit: 1 })
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

  async searchTargets(targetType: string, query: string, limit = 8) {
    return this.ringClient.searchTargets({ targetType, targetRef: query, limit });
  }

  async searchTargetsDetailed(targetType: string, query: string, limit = 8) {
    return this.ringClient.searchTargetsDetailed({ targetType, targetRef: query, limit });
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
    return {
      session,
      events: this.repo.listEventsBySession(id, 200),
    };
  }

  updateSessionDraft(
    id: string,
    input: UpdateOutreachSessionDraftInput,
  ): OutreachSessionRecord | null {
    const session = this.repo.getSessionById(id);
    if (!session) return null;
    if (session.status !== 'pending_approval' && session.status !== 'scheduled') {
      throw new Error('Only pending approval or scheduled outreach sessions can be edited.');
    }

    const nextTargetType = normalizeString(input.targetType) ?? session.targetType;
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
      targetResolutionStatus:
        explicitResolutionProvided
          ? input.targetResolutionStatus ?? 'unresolved'
          : targetChanged
            ? 'unresolved'
            : session.targetResolutionStatus,
      targetResolvedType:
        explicitResolutionProvided
          ? input.targetResolvedType ?? null
          : targetChanged
            ? null
            : session.targetResolvedType ?? null,
      targetResolvedId:
        explicitResolutionProvided
          ? input.targetResolvedId ?? null
          : targetChanged
            ? null
            : session.targetResolvedId ?? null,
      targetResolvedLabel:
        explicitResolutionProvided
          ? input.targetResolvedLabel ?? null
          : targetChanged
            ? null
            : session.targetResolvedLabel ?? null,
      targetResolvedChatId:
        explicitResolutionProvided
          ? input.targetResolvedChatId ?? null
          : targetChanged
            ? null
            : session.targetResolvedChatId ?? null,
      targetCandidates:
        explicitResolutionProvided
          ? (input.targetCandidates as unknown as Array<Record<string, unknown>> | null | undefined) ?? null
          : targetChanged
            ? null
            : (session.targetCandidates as unknown as Array<Record<string, unknown>> | null | undefined) ?? null,
      renderedQuestion: normalizeString(input.renderedQuestion) ?? session.renderedQuestion,
      renderedContext:
        input.renderedContext === undefined
          ? session.renderedContext ?? null
          : normalizeString(input.renderedContext) ?? null,
      nextCheckAt:
        input.nextCheckAt === undefined
          ? session.nextCheckAt ?? null
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
      throw new Error('Target is not confirmed yet. Please resolve the RingCentral user/group before approving.');
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
    this.repo.createEvent(id, 'cancelled', reason ? { reason } : undefined, reason);
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

  async createSessionFromAction(input: CreateSessionFromActionInput): Promise<OutreachSessionRecord> {
    const existing = this.repo.getSessionByActionId(input.action.id);
    if (existing) return existing;

    const action = input.action;
    const params = action.params ?? {};
    const targetObject =
      params.target && typeof params.target === 'object' && !Array.isArray(params.target)
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
      throw new Error('Self-directed ask_external_user should not create outreach sessions.');
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
        params.followupIntervalSeconds ?? params.followup_interval_seconds ?? 86400,
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

      const nextDispatch = parseNextDispatch(template.scheduleSpec, currentTime);
      this.repo.markTemplateDispatch(template.id, nextDispatch, session.id);

      if (!resolved.requiresApproval && resolved.status !== 'pending_approval') {
        await this.dispatchSession(resolved);
      }
    }
  }

  private async dispatchSession(session: OutreachSessionRecord): Promise<void> {
    if (session.status === 'pending_approval' || session.status === 'cancelled') return;
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
      const text = session.renderedContext
        ? `${session.renderedQuestion}\n\nContext:\n${session.renderedContext}`
        : session.renderedQuestion;
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

  private async handleWaitingSession(session: OutreachSessionRecord): Promise<void> {
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
      const posts = await this.ringClient.listPosts(session.sentChatId, session.lastPollAt ?? session.createdAt);
      this.repo.updateSession(session.id, { lastPollAt: currentTime });

      const newestReply = posts.find((post) => post.id !== session.sentPostId && post.text.trim().length > 0);
      if (newestReply) {
        const parsed = classifyReply(newestReply.text, currentTime);
        const replySender = newestReply.creatorName ?? newestReply.creatorId ?? null;
        this.repo.updateSession(session.id, {
          replyPostId: newestReply.id,
          replySender,
          replyRawText: newestReply.text,
          replyClassification: parsed.classification,
          replyConfidence: parsed.confidence,
        });
        this.repo.createEvent(session.id, 'reply_received', {
          replyPostId: newestReply.id,
          replySender,
          classification: parsed.classification,
          confidence: parsed.confidence,
        });
        this.insertOutreachMessage('outreach_reply', session, newestReply.text, {
          postId: newestReply.id,
          sender: replySender,
        });

        if (parsed.classification === 'answer' || parsed.classification === 'decline') {
          this.markTerminal(session.id, 'resolved', {
            classification: parsed.classification,
            confidence: parsed.confidence,
            reply: newestReply.text,
          });
          return;
        }
        if (parsed.classification === 'defer' && parsed.etaAt) {
          this.repo.updateSession(session.id, {
            status: 'deferred',
            waitUntil: parsed.etaAt,
            nextCheckAt: parsed.etaAt,
            outcome: {
              classification: parsed.classification,
              reason: parsed.reason,
              etaAt: parsed.etaAt,
            },
          });
          this.repo.createEvent(session.id, 'deferred_by_reply', {
            etaAt: parsed.etaAt,
          });
          return;
        }
        if (
          (parsed.classification === 'irrelevant' || parsed.classification === 'unclear') &&
          session.followupCount >= session.maxFollowup &&
          session.waitUntil &&
          currentTime >= session.waitUntil
        ) {
          this.markTerminal(session.id, 'escalated', {
            reason: 'reply_not_actionable',
            classification: parsed.classification,
            reply: newestReply.text,
          });
          await this.createEscalationConfirmRequest(session, 'reply_not_actionable');
          return;
        }

        this.repo.updateSession(session.id, {
          nextCheckAt: currentTime + 300,
          outcome: {
            classification: parsed.classification,
            reason: parsed.reason,
          },
        });
        return;
      }

      if (session.waitUntil && currentTime >= session.waitUntil) {
        if (session.followupCount < session.maxFollowup) {
          await this.sendFollowup(session);
          return;
        }

        this.markTerminal(session.id, 'no_reply', {
          reason: 'timeout_without_reply',
          followupCount: session.followupCount,
        });
        await this.createEscalationConfirmRequest(session, 'timeout_without_reply');
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

  private async resolveSessionTarget(session: OutreachSessionRecord): Promise<OutreachSessionRecord> {
    const resolution = await this.ringClient.resolveTarget({
      targetType: session.targetType,
      targetRef: session.targetRef,
      limit: 8,
    });
    const needsReview = resolution.status !== 'resolved';
    const updated = this.repo.updateSession(session.id, {
      targetResolutionStatus: resolution.status,
      targetResolvedType: resolution.resolved?.kind ?? null,
      targetResolvedId: resolution.resolved?.entityId ?? null,
      targetResolvedLabel: resolution.resolved?.label ?? null,
      targetResolvedChatId: resolution.resolved?.chatId ?? null,
      targetCandidates: resolution.candidates as unknown as Array<Record<string, unknown>>,
      status: needsReview ? 'pending_approval' : session.status,
      requiresApproval: needsReview ? true : session.requiresApproval,
      nextCheckAt: needsReview ? null : session.nextCheckAt ?? null,
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

  private markTerminal(
    sessionId: string,
    status: Extract<OutreachSessionStatus, 'resolved' | 'no_reply' | 'escalated'>,
    outcome: Record<string, unknown>,
  ): void {
    const currentTime = now();
    this.repo.updateSession(sessionId, {
      status,
      outcome,
      nextCheckAt: null,
      resolvedAt: currentTime,
    });
    this.repo.createEvent(sessionId, status, outcome);
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
        summary: buildSessionSummary(session.status, session.renderedQuestion),
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
      if (runtime.reflectionEnabled) {
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
  ): void {
    const id = randomUUID();
    const currentTime = now();
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
        currentTime,
        JSON.stringify({
          sessionId: session.id,
          originKind: session.originKind,
          ...metadata,
        }),
        currentTime,
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
      const posts = await this.ringClient.listPosts(session.sentChatId, session.createdAt);
      const reply = posts.find((item) => item.id === session.replyPostId);
      const replySender = reply?.creatorName ?? reply?.creatorId;
      if (!replySender) {
        return session;
      }
      return this.repo.updateSession(session.id, { replySender }) ?? {
        ...session,
        replySender,
      };
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
