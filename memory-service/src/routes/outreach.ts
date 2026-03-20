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

export async function outreachRoutes(app: FastifyInstance): Promise<void> {
  app.post<{
    Body: UpsertTemplateBody;
  }>('/outreach/templates/upsert', async (request, reply) => {
    const { db, userDataManager } = request.userContext;
    const engine = new OutreachEngine(db, userDataManager, request.userId);
    try {
      const template = engine.upsertTemplate(request.body);
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
    const ids = typeof request.query.ids === 'string'
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
      targetType?: string;
      query?: string;
      limit?: string;
    };
  }>('/outreach/targets/search', async (request, reply) => {
    const { db, userDataManager } = request.userContext;
    const engine = new OutreachEngine(db, userDataManager, request.userId);
    const targetType = typeof request.query.targetType === 'string' ? request.query.targetType : 'private';
    const query = typeof request.query.query === 'string' ? request.query.query.trim() : '';
    if (!query) {
      return reply.status(200).send({ items: [], total: 0 });
    }
    const items = await engine.searchTargets(
      targetType,
      query,
      parseInt(request.query.limit ?? '8', 10) || 8,
    );
    return reply.status(200).send({ items, total: items.length });
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
    return reply.status(200).send(result);
  });

  app.get<{
    Params: { id: string };
  }>('/outreach/sessions/:id', async (request, reply) => {
    const { db, userDataManager } = request.userContext;
    const engine = new OutreachEngine(db, userDataManager, request.userId);
    const detail = engine.getSessionDetail(request.params.id);
    if (!detail) {
      return reply.status(404).send({ error: 'Outreach session not found' });
    }
    return reply.status(200).send({
      ...detail.session,
      events: detail.events,
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
    const session = engine.cancelSession(request.params.id, request.body?.reason);
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
      const session = engine.updateSessionDraft(request.params.id, request.body ?? {});
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
