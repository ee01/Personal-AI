import type { FastifyInstance } from 'fastify';

import { OutreachEngine } from '../core/OutreachEngine.js';
import type {
  OutreachApprovalPolicy,
  OutreachSessionStatus,
  OutreachTemplateSyncState,
} from '../repositories/OutreachRepository.js';

interface UpsertTemplateBody {
  id?: string;
  sourceKind: string;
  sourceRefId?: string;
  sheetMessageId?: string;
  title: string;
  questionTemplate: string;
  contextTemplate?: string;
  informationGoalTemplate?: string;
  targetType: string;
  targetRef: string;
  scheduleSpec?: Record<string, unknown>;
  enabled?: boolean;
  approvalPolicy?: OutreachApprovalPolicy;
  maxFollowup?: number;
  followupIntervalSeconds?: number;
  nextDispatchAt?: number;
  syncState?: OutreachTemplateSyncState;
  lastSyncError?: string;
}

interface UpdateSessionBody {
  targetType?: string;
  targetRef?: string;
  targetResolutionStatus?: 'unresolved' | 'ambiguous' | 'resolved';
  targetResolvedType?: string;
  targetResolvedId?: string;
  targetResolvedLabel?: string;
  targetResolvedChatId?: string;
  targetCandidates?: Array<Record<string, unknown>>;
  renderedQuestion?: string;
  renderedContext?: string;
  nextCheckAt?: number | null;
}

interface CreateSessionFromMessageBody {
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
  informationGoal?: string;
}

interface TargetSearchCacheEntry {
  expiresAt: number;
  payload: {
    items: Awaited<ReturnType<OutreachEngine['searchTargets']>>;
    total: number;
    directoryStatus: Awaited<
      ReturnType<OutreachEngine['getTargetDirectoryStatus']>
    >;
  };
}

const targetSearchCache = new Map<string, TargetSearchCacheEntry>();
const TARGET_SEARCH_CACHE_TTL_MS = 3_000;

function parseStatuses(raw?: string): OutreachSessionStatus[] | undefined {
  if (!raw) return undefined;
  const statuses = raw
    .split(',')
    .map((item) => item.trim())
    .filter((item): item is OutreachSessionStatus =>
      [
        'pending_approval',
        'scheduled',
        'waiting_reply',
        'deferred',
        'resolved',
        'no_reply',
        'escalated',
        'cancelled',
        'failed',
      ].includes(item),
    );
  return statuses.length > 0 ? statuses : undefined;
}

function deriveUpstreamStatus(message: string): number | undefined {
  if (/timeout/i.test(message)) {
    return 504;
  }
  const match = message.match(/\((\d{3})\)/);
  if (!match) return undefined;
  const status = Number(match[1]);
  return Number.isFinite(status) && status >= 400 && status < 600
    ? status
    : undefined;
}

export async function outreachRoutes(app: FastifyInstance): Promise<void> {
  app.post<{
    Body: UpsertTemplateBody;
  }>('/outreach/templates/upsert', async (request, reply) => {
    const { db, userDataManager } = request.userContext;
    const engine = new OutreachEngine(db, userDataManager, request.userId);
    try {
      const template = engine.upsertTemplate({
        ...request.body,
        contextTemplate:
          request.body.informationGoalTemplate ?? request.body.contextTemplate,
      });
      return reply.status(200).send({ template });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return reply.status(400).send({ error: message });
    }
  });

  app.post<{
    Params: { id: string };
  }>('/outreach/templates/:id/pause', async (request, reply) => {
    const { db, userDataManager } = request.userContext;
    const engine = new OutreachEngine(db, userDataManager, request.userId);
    const template = engine.pauseTemplate(request.params.id);
    if (!template) {
      return reply.status(404).send({ error: 'Outreach template not found' });
    }
    return reply.status(200).send({ template });
  });

  app.post<{
    Params: { id: string };
  }>('/outreach/templates/:id/cancel', async (request, reply) => {
    const { db, userDataManager } = request.userContext;
    const engine = new OutreachEngine(db, userDataManager, request.userId);
    const template = engine.cancelTemplate(request.params.id);
    if (!template) {
      return reply.status(404).send({ error: 'Outreach template not found' });
    }
    return reply.status(200).send({ template });
  });

  app.get<{
    Querystring: { limit?: string; ids?: string };
  }>('/outreach/templates/runtime-status', async (request, reply) => {
    const { db, userDataManager } = request.userContext;
    const engine = new OutreachEngine(db, userDataManager, request.userId);
    const ids =
      typeof request.query.ids === 'string'
        ? request.query.ids
            .split(',')
            .map((item) => item.trim())
            .filter(Boolean)
        : undefined;
    const items = engine.listTemplateRuntimeStatus(
      parseInt(request.query.limit ?? '100', 10) || 100,
      ids,
    );
    return reply.status(200).send({ items, total: items.length });
  });

  app.get('/outreach/summary', async (request, reply) => {
    const { db, userDataManager } = request.userContext;
    const engine = new OutreachEngine(db, userDataManager, request.userId);
    const summary = engine.getSummary();
    return reply.status(200).send(summary);
  });

  app.get<{
    Querystring: {
      limit?: string;
    };
  }>('/glip-message-markers', async (request, reply) => {
    const { db, userDataManager } = request.userContext;
    const engine = new OutreachEngine(db, userDataManager, request.userId);
    const limit = parseInt(request.query.limit ?? '500', 10) || 500;
    return reply.status(200).send(engine.listGlipMessageMarkers(limit));
  });

  app.get('/outreach/directory/status', async (request, reply) => {
    const { db, userDataManager } = request.userContext;
    const engine = new OutreachEngine(db, userDataManager, request.userId);
    return reply.status(200).send({
      items: engine.getTargetDirectoryStatus(),
    });
  });

  app.post<{
    Querystring: {
      force?: string;
    };
  }>('/outreach/directory/sync', async (request, reply) => {
    const { db, userDataManager } = request.userContext;
    const engine = new OutreachEngine(db, userDataManager, request.userId);
    const items = await engine.syncTargetDirectory(
      request.query.force === 'true',
    );
    return reply.status(200).send({ items });
  });

  app.get<{
    Querystring: {
      targetType?: string;
      query?: string;
      limit?: string;
    };
  }>('/outreach/targets/search', async (request, reply) => {
    const { db, userDataManager } = request.userContext;
    const engine = new OutreachEngine(db, userDataManager, request.userId);
    const targetType =
      typeof request.query.targetType === 'string'
        ? request.query.targetType
        : 'private';
    const query =
      typeof request.query.query === 'string' ? request.query.query.trim() : '';
    if (!query) {
      return reply.status(200).send({ items: [], total: 0 });
    }
    const startedAt = Date.now();
    const normalizedLimit = parseInt(request.query.limit ?? '8', 10) || 8;
    const cacheKey = `${request.userId}|${targetType}|${normalizedLimit}|${query.toLowerCase()}`;
    const cached = targetSearchCache.get(cacheKey);
    if (cached && Date.now() < cached.expiresAt) {
      request.log.info(
        {
          targetType,
          query,
          total: cached.payload.total,
          durationMs: Date.now() - startedAt,
          userId: request.userId,
          cacheHit: true,
        },
        'outreach target search completed',
      );
      return reply.status(200).send(cached.payload);
    }
    try {
      const response = await engine.searchTargetsDetailed(
        targetType,
        query,
        normalizedLimit,
      );
      const payload = {
        items: response.items,
        total: response.total,
        directoryStatus: response.directoryStatus,
      };
      targetSearchCache.set(cacheKey, {
        payload,
        expiresAt: Date.now() + TARGET_SEARCH_CACHE_TTL_MS,
      });
      request.log.info(
        {
          targetType,
          query,
          total: response.total,
          durationMs: Date.now() - startedAt,
          userId: request.userId,
        },
        'outreach target search completed',
      );
      return reply.status(200).send(payload);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      request.log.warn(
        {
          targetType,
          query,
          durationMs: Date.now() - startedAt,
          userId: request.userId,
          message,
        },
        'outreach target search failed',
      );
      return reply
        .status(deriveUpstreamStatus(message) ?? 500)
        .send({ error: 'Target search failed', message });
    }
  });

  app.get<{
    Querystring: {
      status?: OutreachSessionStatus | 'all';
      statuses?: string;
      originKind?: string;
      templateId?: string;
      threadId?: string;
      actionId?: string;
      limit?: string;
      offset?: string;
    };
  }>('/outreach/sessions', async (request, reply) => {
    const { db, userDataManager } = request.userContext;
    const engine = new OutreachEngine(db, userDataManager, request.userId);
    const result = engine.listSessions({
      status: request.query.status,
      statuses: parseStatuses(request.query.statuses),
      originKind: request.query.originKind,
      templateId: request.query.templateId,
      threadId: request.query.threadId,
      actionId: request.query.actionId,
      limit: parseInt(request.query.limit ?? '20', 10) || 20,
      offset: parseInt(request.query.offset ?? '0', 10) || 0,
    });
    const items = await Promise.all(
      result.items.map(async (session) => {
        const detail = await engine.getSessionDetail(session.id);
        return detail
          ? { ...detail.session, evidence: detail.evidence }
          : session;
      }),
    );
    return reply.status(200).send({
      ...result,
      items,
    });
  });

  app.post<{
    Body: CreateSessionFromMessageBody;
  }>('/outreach/sessions/from-message', async (request, reply) => {
    const { db, userDataManager } = request.userContext;
    const engine = new OutreachEngine(db, userDataManager, request.userId);
    try {
      const session = await engine.createSessionFromMessage(request.body);
      return reply.status(200).send({ session });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return reply.status(400).send({ error: message });
    }
  });

  app.get<{
    Params: { id: string };
  }>('/outreach/sessions/:id', async (request, reply) => {
    const { db, userDataManager } = request.userContext;
    const engine = new OutreachEngine(db, userDataManager, request.userId);
    const detail = await engine.getSessionDetail(request.params.id);
    if (!detail) {
      return reply.status(404).send({ error: 'Outreach session not found' });
    }
    return reply.status(200).send({
      ...detail.session,
      events: detail.events,
      actions: detail.actions,
      evidence: detail.evidence,
    });
  });

  app.post<{
    Params: { id: string };
  }>('/outreach/sessions/:id/approve', async (request, reply) => {
    const { db, userDataManager } = request.userContext;
    const engine = new OutreachEngine(db, userDataManager, request.userId);
    const session = await engine.approveSession(request.params.id);
    if (!session) {
      return reply.status(404).send({ error: 'Outreach session not found' });
    }
    return reply.status(200).send({ session });
  });

  app.post<{
    Params: { id: string };
    Body: { reason?: string };
  }>('/outreach/sessions/:id/cancel', async (request, reply) => {
    const { db, userDataManager } = request.userContext;
    const engine = new OutreachEngine(db, userDataManager, request.userId);
    const session = engine.cancelSession(
      request.params.id,
      request.body?.reason,
    );
    if (!session) {
      return reply.status(404).send({ error: 'Outreach session not found' });
    }
    return reply.status(200).send({ session });
  });

  app.post<{
    Params: { id: string };
    Body: UpdateSessionBody;
  }>('/outreach/sessions/:id/update-draft', async (request, reply) => {
    const { db, userDataManager } = request.userContext;
    const engine = new OutreachEngine(db, userDataManager, request.userId);
    try {
      const session = engine.updateSessionDraft(
        request.params.id,
        request.body ?? {},
      );
      if (!session) {
        return reply.status(404).send({ error: 'Outreach session not found' });
      }
      return reply.status(200).send({ session });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return reply.status(400).send({ error: message });
    }
  });

  app.post<{
    Params: { id: string };
  }>('/outreach/sessions/:id/retry', async (request, reply) => {
    const { db, userDataManager } = request.userContext;
    const engine = new OutreachEngine(db, userDataManager, request.userId);
    const session = engine.retrySession(request.params.id);
    if (!session) {
      return reply.status(404).send({ error: 'Outreach session not found' });
    }
    return reply.status(200).send({ session });
  });
}
